"""
YOUTHY AI RAG 서비스 (LangChain + OpenAI)

LangChain을 활용한 고급 RAG (Retrieval-Augmented Generation) 시스템입니다.
ChatGPT API와 연동하여 최고 품질의 정책 상담 서비스를 제공합니다.

핵심 기능:
1. LangChain RAG 체인 구성
2. OpenAI ChatGPT API 연동
3. 정책 문서 검색 및 컨텍스트 구성
4. 출처 추적 및 인용
5. 대화 메모리 관리
"""

import os
import logging
import asyncio
from typing import List, Dict, Any, Optional, AsyncGenerator
from datetime import datetime
import json

# LangChain imports
from langchain.schema import Document
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.vectorstores import PGVector
from langchain_community.retrievers import BM25Retriever
from langchain.retrievers import EnsembleRetriever
from langchain.chains import RetrievalQA
from langchain.memory import ConversationBufferWindowMemory
from langchain.prompts import PromptTemplate
from langchain.callbacks.streaming_stdout import StreamingStdOutCallbackHandler

# OpenAI
from langchain_openai import ChatOpenAI
from openai import AsyncOpenAI

# 데이터베이스 연결
from app.core.database import get_db_connection
import asyncpg

logger = logging.getLogger(__name__)

class YouthyRAGService:
    """
    YOUTHY AI RAG 서비스
    
    LangChain을 사용한 체계적인 RAG 구현으로
    정확하고 신뢰할 수 있는 정책 상담을 제공합니다.
    """
    
    def __init__(self):
        # OpenAI 클라이언트 초기화
        self.openai_api_key = os.getenv('OPENAI_API_KEY', '')
        self.openai_client = None
        
        if self.openai_api_key:
            self.openai_client = AsyncOpenAI(api_key=self.openai_api_key)
            logger.info("✅ OpenAI API 연결 완료")
        else:
            logger.warning("⚠️ OpenAI API 키가 없습니다. 템플릿 모드로 실행됩니다.")
        
        # LangChain 컴포넌트 초기화
        self._setup_embeddings()
        self._setup_memory()
        self._setup_prompts()
        
        # 검색 관련
        self.retriever = None
        self.qa_chain = None
        
        # 로컬 캐시 설정
        self.use_local_cache = True
        self.cache_expiry_hours = 24  # 24시간 후 캐시 만료

    def _setup_embeddings(self):
        """임베딩 모델 설정"""
        try:
            # 한국어 특화 임베딩 모델
            self.embeddings = HuggingFaceEmbeddings(
                model_name="BAAI/bge-m3",
                model_kwargs={'device': 'cpu'},
                encode_kwargs={'normalize_embeddings': True}
            )
            logger.info("✅ 임베딩 모델 로드 완료")
            
        except Exception as e:
            logger.error(f"❌ 임베딩 모델 로드 실패: {e}")
            self.embeddings = None

    def _setup_memory(self):
        """대화 메모리 설정"""
        self.memory = ConversationBufferWindowMemory(
            k=5,  # 최근 5턴 대화 기억
            memory_key="chat_history",
            return_messages=True
        )

    def _setup_prompts(self):
        """프롬프트 템플릿 설정"""
        
        # 정책 상담 전용 프롬프트
        self.policy_prompt = PromptTemplate(
            input_variables=["context", "question", "chat_history"],
            template="""
당신은 YOUTHY AI입니다. 유씨 청년정책 전문 AI 어시스턴트로서 다음과 같이 행동해주세요:

**역할:**
- 청년(만 19~39세)을 위한 정책 정보 전문가
- 친근하고 도움이 되는 톤으로 대화
- 정확하고 검증된 정보만 제공

**엄격한 답변 원칙:**
1. **오직 제공된 정책 정보만을 기반으로 답변** - 추측이나 가상의 정보 절대 금지
2. **전화번호**: 정확한 번호가 없으면 "해당 기관에 문의하세요" 또는 "공식 홈페이지에서 확인하세요"
3. **웹사이트 URL**: 정확한 URL이 없으면 일반적인 표현 사용 (예: "해당 기관의 공식 홈페이지")
4. **사업 기간 구분 - 필수 포맷**: 
   - **사업 운영기간**: YYYY년 MM월 DD일 ~ YYYY년 MM월 DD일 (정책이 시행되는 전체 기간)
   - **사업 신청기간**: YYYY년 MM월 DD일 ~ YYYY년 MM월 DD일 (실제 신청할 수 있는 기간)
   - 반드시 위 형식으로 구분하여 제공하고, 각 기간이 다르면 명확히 구분 표시
5. **불확실한 정보**: "정확한 정보는 해당 기관에 문의하여 확인하세요"
6. **출처 표시**: [1], [2] 형식으로 반드시 표시
7. **가상의 예시나 가정 금지**: "예를 들어", "일반적으로" 같은 표현으로 추측 정보 제공 금지

**정책 정보:**
{context}

**이전 대화:**
{chat_history}

**사용자 질문:** {question}

**답변 형식 (필수):**
- **사업 운영기간**: YYYY년 MM월 DD일 ~ YYYY년 MM월 DD일
- **사업 신청기간**: YYYY년 MM월 DD일 ~ YYYY년 MM월 DD일
- 검증된 정보만 제공, 출처 [1], [2] 포함

**답변:**
"""
        )

    async def setup_retriever(self, db_connection):
        """
        하이브리드 검색기 설정
        
        PostgreSQL에서 정책 데이터를 가져와 
        BM25 + 벡터 검색을 결합한 앙상블 검색기를 구성합니다.
        """
        try:
            logger.info("🔍 RAG 검색기 설정 중...")
            
            # 정책 문서들을 LangChain Document 형태로 변환
            documents = await self._load_policy_documents(db_connection)
            
            if not documents:
                logger.warning("⚠️ 검색할 정책 문서가 없습니다.")
                return
            
            # 1. BM25 검색기 (키워드 기반)
            bm25_retriever = BM25Retriever.from_documents(documents)
            bm25_retriever.k = 10
            
            # 2. 벡터 검색기 (의미 기반) - PostgreSQL pgvector 사용
            if self.embeddings:
                # PostgreSQL 연결 정보
                db_config = {
                    'host': os.getenv('DB_HOST', 'localhost'),
                    'port': os.getenv('DB_PORT', '5432'),
                    'database': os.getenv('DB_NAME', 'youthy_ai'),
                    'user': os.getenv('DB_USER', 'postgres'),
                    'password': os.getenv('DB_PASSWORD', 'password')
                }
                
                connection_string = f"postgresql://{db_config['user']}:{db_config['password']}@{db_config['host']}:{db_config['port']}/{db_config['database']}"
                
                vector_store = PGVector(
                    connection_string=connection_string,
                    embedding_function=self.embeddings,
                    collection_name="policy_embeddings"
                )
                
                vector_retriever = vector_store.as_retriever(search_kwargs={"k": 10})
                
                # 3. 앙상블 검색기 (BM25 + 벡터 결합)
                self.retriever = EnsembleRetriever(
                    retrievers=[bm25_retriever, vector_retriever],
                    weights=[0.4, 0.6]  # 벡터 검색에 더 높은 가중치
                )
            else:
                # 임베딩 실패시 BM25만 사용
                self.retriever = bm25_retriever
            
            logger.info("✅ RAG 검색기 설정 완료")
            
        except Exception as e:
            logger.error(f"❌ RAG 검색기 설정 실패: {e}")

    async def _load_policy_documents(self, db_connection) -> List[Document]:
        """데이터베이스에서 정책 문서들을 LangChain Document로 변환"""
        try:
            # 활성 정책들만 조회
            policies_query = """
                SELECT p.*, 
                       string_agg(pc.chunk_text, ' ') as full_content
                FROM policies p
                LEFT JOIN policy_chunks pc ON p.id = pc.policy_id
                WHERE p.status IN ('open', 'upcoming')
                GROUP BY p.id
                ORDER BY p.updated_at DESC
                LIMIT 1000
            """
            
            rows = await db_connection.fetch(policies_query)
            documents = []
            
            for row in rows:
                # 메타데이터 구성
                metadata = {
                    'policy_id': row['id'],
                    'title': row['title'],
                    'agency': row['issuing_agency'],
                    'region': row['region'],
                    'category': row['category'],
                    'source_url': row['source_url'],
                    'status': row['status'],
                    'valid_from': str(row['valid_from']) if row['valid_from'] else None,
                    'valid_to': str(row['valid_to']) if row['valid_to'] else None
                }
                
                # 문서 내용 구성
                content = f"""
제목: {row['title']}
기관: {row['issuing_agency']}
지역: {row['region']}
카테고리: {', '.join(row['category'] or [])}
요약: {row['summary'] or ''}
상세내용: {row['full_content'] or ''}
출처: {row['source_url']}
"""
                
                doc = Document(
                    page_content=content,
                    metadata=metadata
                )
                documents.append(doc)
            
            logger.info(f"📚 {len(documents)}개 정책 문서 로드 완료")
            return documents
            
        except Exception as e:
            logger.error(f"❌ 정책 문서 로드 오류: {e}")
            return []
    
    async def search_local_policies(
        self, 
        query: str, 
        user_context: Optional[Dict] = None,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """
        로컬 데이터베이스에서 정책 검색
        
        키워드 검색과 사용자 컨텍스트를 조합하여
        가장 관련성 높은 정책들을 빠르게 반환합니다.
        """
        try:
            from app.core.database import _connection_pool
            
            if not _connection_pool:
                logger.warning("⚠️ 데이터베이스 연결 풀이 없습니다. 외부 검색을 사용합니다.")
                return []
            
            async with _connection_pool.acquire() as conn:
                # 기본 검색 쿼리 구성
                base_query = """
                    SELECT 
                        id, title, summary, body_html, issuing_agency, 
                        program_type, region, category, eligibility, 
                        benefit, apply_method, contact, source_url, 
                        source_name, valid_from, valid_to, status,
                        updated_at
                    FROM policies 
                    WHERE status = 'open'
                    AND (valid_to IS NULL OR valid_to >= CURRENT_DATE)
                """
                
                conditions = []
                params = []
                param_count = 0
                
                # 키워드 검색 조건 추가
                if query.strip():
                    param_count += 1
                    conditions.append(f"""
                        (title ILIKE ${param_count} 
                         OR summary ILIKE ${param_count}
                         OR body_html ILIKE ${param_count})
                    """)
                    params.append(f"%{query}%")
                
                # 사용자 컨텍스트 기반 필터링
                if user_context:
                    # 나이 조건
                    if 'age' in user_context:
                        age = user_context['age']
                        conditions.append(f"""
                            (eligibility->>'age' IS NULL 
                             OR (eligibility->'age'->>'min')::int <= {age}
                             AND (eligibility->'age'->>'max')::int >= {age})
                        """)
                    
                    # 지역 조건
                    if 'region' in user_context:
                        param_count += 1
                        conditions.append(f"""
                            (region = '서울시 전체' 
                             OR region = ${param_count})
                        """)
                        params.append(user_context['region'])
                    
                    # 학생 여부
                    if user_context.get('student'):
                        conditions.append("""
                            (eligibility->>'student' IS NULL 
                             OR eligibility->>'student' = 'true')
                        """)
                
                # 조건들을 쿼리에 추가
                if conditions:
                    base_query += " AND " + " AND ".join(conditions)
                
                # 정렬 및 제한
                base_query += f"""
                    ORDER BY 
                        CASE WHEN title ILIKE $1 THEN 1 ELSE 2 END,
                        updated_at DESC
                    LIMIT {limit}
                """
                
                # 쿼리 실행
                rows = await conn.fetch(base_query, *params)
                
                # 결과 변환
                policies = []
                for row in rows:
                    policy = {
                        'id': row['id'],
                        'title': row['title'],
                        'summary': row['summary'],
                        'content': row['body_html'],
                        'agency': row['issuing_agency'],
                        'program_type': row['program_type'],
                        'region': row['region'],
                        'category': row['category'],
                        'eligibility': row['eligibility'],
                        'benefit': row['benefit'],
                        'apply_method': row['apply_method'],
                        'contact': row['contact'],
                        'source_url': row['source_url'],
                        'source_name': row['source_name'],
                        'valid_from': str(row['valid_from']) if row['valid_from'] else None,
                        'valid_to': str(row['valid_to']) if row['valid_to'] else None,
                        'updated_at': row['updated_at'].isoformat() if row['updated_at'] else None
                    }
                    policies.append(policy)
                
                logger.info(f"🔍 로컬 DB에서 {len(policies)}개 정책 검색 완료")
                return policies
                
        except Exception as e:
            logger.error(f"❌ 로컬 정책 검색 오류: {e}")
            return []
    
    def _convert_policies_to_docs(self, policies: List[Dict[str, Any]]) -> List[Document]:
        """
        정책 딕셔너리를 LangChain Document 객체로 변환
        """
        documents = []
        
        for policy in policies:
            # 메타데이터 구성
            metadata = {
                'policy_id': policy['id'],
                'title': policy['title'],
                'agency': policy['agency'],
                'region': policy['region'],
                'category': policy['category'],
                'source_url': policy['source_url'],
                'source_name': policy['source_name'],
                'status': 'open',
                'valid_from': policy['valid_from'],
                'valid_to': policy['valid_to']
            }
            
            # 문서 내용 구성
            content = f"""
제목: {policy['title']}
기관: {policy['agency']}
지역: {policy['region']}
카테고리: {', '.join(policy['category'] or [])}
요약: {policy['summary'] or ''}
상세내용: {policy['content'] or ''}
출처: {policy['source_url']}
"""
            
            doc = Document(
                page_content=content,
                metadata=metadata
            )
            documents.append(doc)
        
        return documents

    async def chat_with_rag(
        self, 
        user_message: str, 
        user_context: Optional[Dict] = None,
        conversation_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        RAG 기반 채팅 응답 생성
        
        LangChain의 RetrievalQA 체인을 사용하여
        정책 정보를 검색하고 ChatGPT로 답변을 생성합니다.
        """
        try:
            if not self.openai_client:
                # OpenAI API가 없으면 템플릿 기반 응답
                return await self._generate_template_response(user_message, user_context)
            
            # 1. 로컬 데이터베이스에서 우선 검색 (빠른 응답)
            local_policies = []
            if self.use_local_cache:
                local_policies = await self.search_local_policies(
                    user_message, user_context, limit=5
                )
                logger.info(f"💾 로컬 캐시에서 {len(local_policies)}개 정책 발견")
            
            # 2. 로컬 데이터가 부족하면 외부 검색 추가
            relevant_docs = []
            if len(local_policies) >= 3:
                # 로컬 데이터가 충분하면 로컬 데이터만 사용
                relevant_docs = self._convert_policies_to_docs(local_policies)
                logger.info("⚡ 로컬 캐시 데이터로 빠른 응답 생성")
            else:
                # 로컬 데이터가 부족하면 외부 검색 병행
                if self.retriever:
                    external_docs = await self._retrieve_relevant_policies(user_message, user_context)
                    relevant_docs = self._convert_policies_to_docs(local_policies) + external_docs
                    logger.info(f"🔍 로컬({len(local_policies)}) + 외부({len(external_docs)}) 검색 결합")
                else:
                    relevant_docs = self._convert_policies_to_docs(local_policies)
            
            # 3. 컨텍스트 구성
            context = self._build_context_from_docs(relevant_docs)
            
            # 4. ChatGPT API로 응답 생성 (RAG Generation)
            response = await self._generate_with_openai(user_message, context, user_context)
            
            # 5. 출처 정보 추출
            references = self._extract_references_from_docs(relevant_docs)
            
            return {
                'answer': response,
                'references': references,
                'confidence_score': 0.9 if relevant_docs else 0.3,
                'context_used': len(relevant_docs),
                'model_used': 'gpt-3.5-turbo',
                'cache_used': len(local_policies) > 0
            }
            
        except Exception as e:
            logger.error(f"❌ RAG 채팅 오류: {e}")
            return await self._generate_fallback_response(user_message)

    async def _retrieve_relevant_policies(
        self, 
        query: str, 
        user_context: Optional[Dict] = None
    ) -> List[Document]:
        """관련 정책 문서 검색 (온통청년 API + 기존 데이터 통합)"""
        try:
            all_docs = []
            
            # 1. 온통청년 API에서 검색
            try:
                from app.services.youthcenter_api import youthcenter_client
                
                # 사용자 컨텍스트 기반 온통청년 정책 검색
                region = user_context.get('region') if user_context else None
                age = user_context.get('age') if user_context else None
                
                youthcenter_policies = await youthcenter_client.search_policies_by_region_and_age(
                    region=region, age=age, max_results=10
                )
                
                # 온통청년 정책을 Document 형태로 변환
                for policy in youthcenter_policies:
                    doc_content = youthcenter_client.format_policy_for_llm(policy)
                    
                    # 정책을 8개 카테고리로 자동 분류
                    auto_category = youthcenter_client.classify_policy_category(policy)
                    
                    doc = Document(
                        page_content=doc_content,
                        metadata={
                            'title': policy.get('polyBizSjnm', 'N/A'),
                            'agency': policy.get('cnsgNmor', 'N/A'),
                            'region': '전국' if not region else region,
                            'category': [auto_category],  # 8개 카테고리 중 하나
                            'original_category': policy.get('polyRlmCd', '기타'),
                            'status': '운영중',
                            'source_url': policy.get('rfcSiteUrla1', 'N/A'),
                            'source': '온통청년',
                            'policy_id': policy.get('bizId', ''),
                            'support_target': policy.get('sporTarget', 'N/A'),
                            'support_content': policy.get('sporCn', 'N/A'),
                            'application_period': policy.get('rqutPrdCn', 'N/A'),
                            'application_method': policy.get('rqutProcCn', 'N/A'),
                            'last_updated': datetime.now().isoformat(),
                            'matched_category': policy.get('matched_category', auto_category)
                        }
                    )
                    all_docs.append(doc)
                
                logger.info(f"✅ 온통청년 API: {len(youthcenter_policies)}개 정책 검색")
                
            except Exception as e:
                logger.warning(f"⚠️ 온통청년 API 검색 실패: {e}")
            
            # 2. 기존 벡터 검색도 병행 (있다면)
            if self.retriever:
                try:
                    # 사용자 컨텍스트를 검색 쿼리에 반영
                    enhanced_query = self._enhance_query_with_context(query, user_context)
                    
                    # LangChain 검색 실행
                    local_docs = await self.retriever.aget_relevant_documents(enhanced_query)
                    
                    # 사용자 조건에 맞는 정책만 필터링
                    filtered_local_docs = self._filter_docs_by_user_context(local_docs, user_context)
                    
                    all_docs.extend(filtered_local_docs)
                    logger.info(f"✅ 기존 데이터: {len(filtered_local_docs)}개 정책 검색")
                    
                except Exception as e:
                    logger.warning(f"⚠️ 기존 데이터 검색 실패: {e}")
            
            # 3. 중복 제거 및 관련도 순 정렬
            unique_docs = self._deduplicate_and_rank_docs(all_docs, query)
            
            logger.info(f"🔍 통합 검색 완료: {len(unique_docs)}개 관련 정책 발견")
            return unique_docs[:8]  # 최대 8개 (온통청년 + 기존 데이터)
            
        except Exception as e:
            logger.error(f"❌ 정책 검색 오류: {e}")
            return []

    def _enhance_query_with_context(self, query: str, user_context: Optional[Dict]) -> str:
        """사용자 컨텍스트로 검색 쿼리 향상"""
        enhanced_parts = [query]
        
        if user_context:
            if user_context.get('region'):
                enhanced_parts.append(f"지역: {user_context['region']}")
            
            if user_context.get('age'):
                enhanced_parts.append(f"나이: {user_context['age']}세")
            
            if user_context.get('student'):
                enhanced_parts.append("대학생")
        
        return ' '.join(enhanced_parts)

    def _filter_docs_by_user_context(self, docs: List[Document], user_context: Optional[Dict]) -> List[Document]:
        """사용자 조건에 맞는 문서만 필터링"""
        if not user_context:
            return docs
        
        filtered = []
        
        for doc in docs:
            metadata = doc.metadata
            
            # 지역 필터링
            if user_context.get('region'):
                doc_region = metadata.get('region', '')
                if doc_region != '서울시 전체' and doc_region != user_context['region']:
                    continue
            
            # 나이 필터링 (eligibility 정보가 있다면)
            if user_context.get('age'):
                # 실제로는 eligibility JSON을 파싱해서 나이 조건 확인
                # 여기서는 간단히 통과
                pass
            
            filtered.append(doc)
        
        return filtered

    def _deduplicate_and_rank_docs(self, docs: List[Document], query: str) -> List[Document]:
        """문서 중복 제거 및 관련도 순 정렬"""
        if not docs:
            return []
        
        # 제목 기준 중복 제거
        seen_titles = set()
        unique_docs = []
        
        for doc in docs:
            title = doc.metadata.get('title', '').strip()
            if title and title not in seen_titles:
                seen_titles.add(title)
                unique_docs.append(doc)
        
        # 간단한 키워드 매칭 기반 관련도 계산
        query_keywords = set(query.lower().split())
        
        def calculate_relevance(doc: Document) -> float:
            content = doc.page_content.lower()
            title = doc.metadata.get('title', '').lower()
            
            # 제목 매칭 점수 (가중치 높음)
            title_score = sum(1 for keyword in query_keywords if keyword in title) * 3
            
            # 내용 매칭 점수
            content_score = sum(1 for keyword in query_keywords if keyword in content)
            
            # 온통청년 데이터 우선 순위 (더 상세한 정보)
            source_bonus = 2 if doc.metadata.get('source') == '온통청년' else 0
            
            return title_score + content_score + source_bonus
        
        # 관련도 순 정렬
        unique_docs.sort(key=calculate_relevance, reverse=True)
        
        return unique_docs

    def _build_context_from_docs(self, docs: List[Document]) -> str:
        """검색된 문서들로부터 컨텍스트 구성"""
        if not docs:
            return "관련 정책 정보를 찾을 수 없습니다."
        
        context_parts = []
        
        for i, doc in enumerate(docs, 1):
            metadata = doc.metadata
            
            context_part = f"""
[정책 {i}]
제목: {metadata.get('title', '제목 없음')}
기관: {metadata.get('agency', '기관 없음')}
지역: {metadata.get('region', '지역 없음')}
카테고리: {', '.join(metadata.get('category', []))}
상태: {metadata.get('status', '상태 없음')}
출처: {metadata.get('source_url', 'URL 없음')}

내용:
{doc.page_content[:800]}...

---
"""
            context_parts.append(context_part)
        
        return '\n'.join(context_parts)

    def _extract_references_from_docs(self, docs: List[Document]) -> List[Dict]:
        """문서들에서 참조 정보 추출"""
        references = []
        
        for i, doc in enumerate(docs, 1):
            metadata = doc.metadata
            
            # 스니펫 생성 (첫 200자)
            snippet = doc.page_content[:200].replace('\n', ' ').strip()
            if len(doc.page_content) > 200:
                snippet += '...'
            
            references.append({
                'id': f'ref_{i}',
                'title': metadata.get('title', '제목 없음'),
                'url': metadata.get('source_url', '#'),
                'snippet': snippet,
                'source': metadata.get('agency', '기관 없음'),
                'relevance_score': 0.8,  # LangChain에서 실제 점수 받아올 수 있음
                'last_updated': metadata.get('updated_at', datetime.now().isoformat())
            })
        
        return references

    async def _generate_with_openai(
        self, 
        user_message: str, 
        context: str, 
        user_context: Optional[Dict] = None
    ) -> str:
        """OpenAI ChatGPT API로 응답 생성"""
        try:
            # 사용자 정보 추가
            user_info = ""
            if user_context:
                info_parts = []
                if user_context.get('age'):
                    info_parts.append(f"나이: {user_context['age']}세")
                if user_context.get('region'):
                    info_parts.append(f"거주지: {user_context['region']}")
                if user_context.get('student'):
                    info_parts.append("대학생")
                
                if info_parts:
                    user_info = f"사용자 정보: {', '.join(info_parts)}\n\n"
            
            # ChatGPT API 호출
            messages = [
                {
                    "role": "system",
                    "content": """당신은 YOUTHY AI, 유씨 청년정책 전문 AI 어시스턴트입니다.

**답변 규칙:**
1. 제공된 정책 정보만을 기반으로 정확하게 답변
2. 모든 정책에 출처 번호 [1], [2], [3] 표시
3. 사용자 상황에 맞는 구체적 조언 포함
4. 신청 방법과 연락처를 명확히 안내
5. 친근하고 도움이 되는 톤 유지

**응답 구조:**
1. 인사 및 상황 파악
2. 관련 정책들 소개 (번호와 출처 포함)
3. 개인화된 조언
4. 추가 문의 안내"""
                },
                {
                    "role": "user",
                    "content": f"{user_info}정책 정보:\n{context}\n\n질문: {user_message}"
                }
            ]
            
            response = await self.openai_client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=messages,
                max_tokens=1500,
                temperature=0.7,
                stream=False
            )
            
            answer = response.choices[0].message.content
            return answer
            
        except Exception as e:
            logger.error(f"❌ OpenAI API 호출 오류: {e}")
            return "OpenAI API 호출 중 오류가 발생했습니다. API 키를 확인해주세요."

    async def generate_streaming_response(
        self, 
        user_message: str, 
        context: str, 
        user_context: Optional[Dict] = None
    ) -> AsyncGenerator[str, None]:
        """OpenAI 스트리밍 응답 생성"""
        try:
            if not self.openai_client:
                # OpenAI가 없으면 템플릿 응답을 스트리밍
                response = await self._generate_template_response(user_message, user_context)
                sentences = response['answer'].split('\n')
                for sentence in sentences:
                    if sentence.strip():
                        yield sentence + '\n'
                        await asyncio.sleep(0.1)
                return
            
            # 사용자 정보 구성
            user_info = ""
            if user_context:
                info_parts = []
                if user_context.get('age'):
                    info_parts.append(f"나이: {user_context['age']}세")
                if user_context.get('region'):
                    info_parts.append(f"거주지: {user_context['region']}")
                if user_context.get('student'):
                    info_parts.append("대학생")
                
                if info_parts:
                    user_info = f"사용자 정보: {', '.join(info_parts)}\n\n"
            
            # OpenAI 스트리밍 API 호출
            messages = [
                {
                    "role": "system",
                    "content": "당신은 YOUTHY AI, 유씨 청년정책 전문 AI 어시스턴트입니다. 정확하고 친근한 답변을 제공하세요."
                },
                {
                    "role": "user",
                    "content": f"{user_info}정책 정보:\n{context}\n\n질문: {user_message}"
                }
            ]
            
            stream = await self.openai_client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=messages,
                max_tokens=1500,
                temperature=0.7,
                stream=True
            )
            
            async for chunk in stream:
                if chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content
                    
        except Exception as e:
            logger.error(f"❌ OpenAI 스트리밍 오류: {e}")
            yield "스트리밍 응답 생성 중 오류가 발생했습니다."

    async def _generate_template_response(self, user_message: str, user_context: Optional[Dict]) -> Dict[str, Any]:
        """템플릿 기반 대체 응답 (OpenAI 없을 때)"""
        return {
            'answer': f"""
안녕하세요! YOUTHY AI입니다. 😊

현재 OpenAI API 키가 설정되지 않아 템플릿 모드로 실행 중입니다.

**질문**: {user_message}

**임시 답변**: 
죄송합니다. 정확한 AI 답변을 위해서는 다음 중 하나를 설정해주세요:

1. **OpenAI API 키 설정** (권장)
   ```bash
   export OPENAI_API_KEY=sk-your-key-here
   ```

2. **Ollama 로컬 실행**
   ```bash
   brew install ollama
   ollama pull llama2:7b-chat
   ollama serve
   ```

3. **Hugging Face 토큰 설정**
   ```bash
   export HF_API_TOKEN=your-token-here
   ```

설정 후 다시 질문해주시면 정확한 정책 정보를 제공해드리겠습니다! 🙏
""",
            'references': [],
            'confidence_score': 0.1
        }

    async def _generate_fallback_response(self, user_message: str) -> Dict[str, Any]:
        """오류 시 대체 응답"""
        return {
            'answer': "죄송합니다. 일시적인 시스템 오류가 발생했습니다. 잠시 후 다시 시도해주세요. 🙏",
            'references': [],
            'confidence_score': 0.0,
            'model_used': 'fallback'
        }

    def add_conversation_to_memory(self, user_message: str, ai_response: str):
        """대화를 메모리에 추가"""
        try:
            self.memory.chat_memory.add_user_message(user_message)
            self.memory.chat_memory.add_ai_message(ai_response)
        except Exception as e:
            logger.warning(f"⚠️ 대화 메모리 추가 실패: {e}")

    def get_conversation_history(self) -> List[Dict]:
        """대화 기록 조회"""
        try:
            messages = self.memory.chat_memory.messages
            history = []
            
            for msg in messages:
                history.append({
                    'role': 'user' if msg.type == 'human' else 'assistant',
                    'content': msg.content,
                    'timestamp': datetime.now().isoformat()
                })
            
            return history
            
        except Exception as e:
            logger.error(f"❌ 대화 기록 조회 오류: {e}")
            return []

# ========================================
# RAG 서비스 인스턴스 생성
# ========================================

# 전역 RAG 서비스 인스턴스
_rag_service: Optional[YouthyRAGService] = None

async def get_rag_service() -> YouthyRAGService:
    """RAG 서비스 싱글톤 인스턴스 반환"""
    global _rag_service
    
    if _rag_service is None:
        _rag_service = YouthyRAGService()
        logger.info("✅ RAG 서비스 초기화 완료")
    
    return _rag_service

async def initialize_rag_system(db_connection):
    """RAG 시스템 초기화"""
    try:
        rag_service = await get_rag_service()
        await rag_service.setup_retriever(db_connection)
        logger.info("🚀 RAG 시스템 초기화 완료")
        
    except Exception as e:
        logger.error(f"❌ RAG 시스템 초기화 실패: {e}")

# ========================================
# 설정 가이드
# ========================================

def print_llm_setup_guide():
    """LLM 설정 가이드 출력"""
    print("""
🤖 YOUTHY AI LLM 설정 가이드

**🎯 추천 순서:**

1. 🥇 OpenAI ChatGPT (최고 품질, 유료)
   ```bash
   export OPENAI_API_KEY=sk-your-key-here
   ```
   - 비용: $0.002/1K 토큰 (매우 저렴)
   - 품질: ⭐⭐⭐⭐⭐
   - 속도: ⭐⭐⭐⭐⭐

2. 🥈 Ollama (무료, 로컬, 고품질)
   ```bash
   # 설치
   brew install ollama  # macOS
   # 또는 https://ollama.ai
   
   # 모델 다운로드 및 실행
   ollama pull llama2:7b-chat
   ollama serve
   
   export LLM_TYPE=ollama
   ```
   - 비용: 무료
   - 품질: ⭐⭐⭐⭐
   - 속도: ⭐⭐⭐

3. 🥉 Hugging Face (무료 API)
   ```bash
   # 토큰 발급: https://huggingface.co/settings/tokens
   export HF_API_TOKEN=your-token-here
   export LLM_TYPE=huggingface
   ```
   - 비용: 무료 (제한 있음)
   - 품질: ⭐⭐⭐
   - 속도: ⭐⭐

4. 🚀 템플릿 모드 (즉시 실행)
   - 설정 불필요
   - 구조화된 응답
   - 품질: ⭐⭐
   - 속도: ⭐⭐⭐⭐⭐

**💡 권장사항:**
- MVP/데모: 템플릿 모드로 시작
- 개발/테스트: Ollama 사용
- 운영: OpenAI ChatGPT 사용
""")

if __name__ == "__main__":
    print_llm_setup_guide()
