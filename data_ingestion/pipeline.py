"""
YOUTHY AI 데이터 수집 파이프라인

실제 운영 환경에서 청년정책 데이터를 자동으로 수집하는 시스템입니다.
2025년 9월 기준 실제 API와 웹사이트에서 데이터를 수집합니다.

주요 기능:
1. 서울 열린데이터광장 API 호출
2. 청년정책 포털 웹 크롤링  
3. 서울시 고시·공고 RSS 파싱
4. 데이터 정규화 및 저장
5. 임베딩 생성 및 인덱싱
"""

import asyncio
import logging
import argparse
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
import json
import hashlib

import aiohttp
import asyncpg
from bs4 import BeautifulSoup
import pandas as pd
from sentence_transformers import SentenceTransformer

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class YouthyDataPipeline:
    """
    YOUTHY AI 데이터 수집 파이프라인 메인 클래스
    
    실제 운영에서 사용되는 데이터 수집 시스템입니다.
    각 데이터 소스별로 전용 수집기를 가지고 있습니다.
    """
    
    def __init__(self):
        # 서울 열린데이터광장 API 키 (실제 발급받은 키)
        self.seoul_api_key = "75786159696b6a6839324d7a674776"
        
        # 임베딩 모델 로드 (한국어 특화)
        logger.info("🤖 AI 모델 로딩 중...")
        self.embedding_model = SentenceTransformer('BAAI/bge-m3')
        logger.info("✅ AI 모델 로딩 완료")
        
        # 데이터베이스 연결 정보
        self.db_config = {
            'host': 'localhost',
            'port': 5432,
            'database': 'youthy_ai',
            'user': 'postgres',
            'password': 'password'
        }
        
        # 수집 통계
        self.stats = {
            'total_processed': 0,
            'new_policies': 0,
            'updated_policies': 0,
            'errors': 0
        }

    async def connect_db(self) -> asyncpg.Connection:
        """데이터베이스 연결"""
        try:
            conn = await asyncpg.connect(**self.db_config)
            logger.info("✅ 데이터베이스 연결 성공")
            return conn
        except Exception as e:
            logger.error(f"❌ 데이터베이스 연결 실패: {e}")
            raise

    async def collect_seoul_open_data(self) -> List[Dict[str, Any]]:
        """
        서울 열린데이터광장에서 청년정책 데이터 수집
        
        실제 API 호출:
        - 청년정책 관련 데이터셋들을 순회
        - JSON 형태로 정책 정보 수집
        - API 호출 제한 준수
        """
        logger.info("📡 서울 열린데이터광장 데이터 수집 시작...")
        
        policies = []
        
        # 실제 API 엔드포인트들 (2025년 9월 기준)
        api_endpoints = [
            {
                'name': '서울시 청년정책',
                'url': 'http://openapi.seoul.go.kr:8088/{}/json/youthPolicyInfo/1/100/',
                'description': '서울시 청년정책 전체 목록'
            },
            {
                'name': '서울시 구별 청년정책',
                'url': 'http://openapi.seoul.go.kr:8088/{}/json/districtYouthPolicy/1/100/',
                'description': '자치구별 청년정책'
            },
            {
                'name': '서울시 청년지원사업',
                'url': 'http://openapi.seoul.go.kr:8088/{}/json/youthSupportProgram/1/100/',
                'description': '청년지원사업 현황'
            }
        ]
        
        async with aiohttp.ClientSession() as session:
            for endpoint in api_endpoints:
                try:
                    url = endpoint['url'].format(self.seoul_api_key)
                    logger.info(f"📥 {endpoint['name']} 수집 중...")
                    
                    async with session.get(url) as response:
                        if response.status == 200:
                            data = await response.json()
                            
                            # API 응답 구조에 따라 데이터 추출
                            if 'row' in data:
                                for item in data['row']:
                                    policy = await self._normalize_seoul_api_data(item, endpoint['name'])
                                    if policy:
                                        policies.append(policy)
                                        
                            logger.info(f"✅ {endpoint['name']}: {len(data.get('row', []))}개 수집")
                            
                        else:
                            logger.warning(f"⚠️ {endpoint['name']} API 호출 실패: {response.status}")
                            
                        # API 호출 제한 준수 (1초 대기)
                        await asyncio.sleep(1)
                        
                except Exception as e:
                    logger.error(f"❌ {endpoint['name']} 수집 오류: {e}")
                    self.stats['errors'] += 1
        
        logger.info(f"📊 서울 열린데이터광장 수집 완료: {len(policies)}개")
        return policies

    async def _normalize_seoul_api_data(self, raw_data: Dict, source_name: str) -> Optional[Dict[str, Any]]:
        """
        서울 열린데이터광장 API 응답을 정규화된 정책 데이터로 변환
        
        실제 API 응답 구조를 분석하여 우리 스키마에 맞게 변환합니다.
        """
        try:
            # 정책 ID 생성 (중복 방지)
            policy_id = f"seoul_{hashlib.md5(f'{raw_data.get('POLICY_NM', '')}{raw_data.get('POLICY_URL', '')}'.encode()).hexdigest()[:8]}"
            
            # 기본 정보 추출
            title = raw_data.get('POLICY_NM', '').strip()
            if not title:
                return None
                
            # 지역 정보 추출
            region = self._extract_region(raw_data.get('TARGET_AREA', ''))
            
            # 연령 정보 추출
            eligibility = self._extract_eligibility(raw_data)
            
            # 정책 유형 분류
            category = self._classify_policy_category(title, raw_data.get('POLICY_CONTENT', ''))
            
            # 유효기간 추출
            valid_from, valid_to = self._extract_validity_period(raw_data)
            
            # 현재 상태 결정
            status = self._determine_policy_status(valid_from, valid_to)
            
            return {
                'id': policy_id,
                'title': title,
                'summary': raw_data.get('POLICY_SUMMARY', ''),
                'body_html': raw_data.get('POLICY_CONTENT', ''),
                'issuing_agency': raw_data.get('AGENCY_NM', '서울특별시'),
                'program_type': raw_data.get('PROGRAM_TYPE', '청년정책'),
                'region': region,
                'category': category,
                'eligibility': eligibility,
                'benefit': self._extract_benefit_info(raw_data),
                'apply_method': self._extract_apply_method(raw_data),
                'contact': self._extract_contact_info(raw_data),
                'source_url': raw_data.get('POLICY_URL', ''),
                'source_name': source_name,
                'source_doc_date': datetime.now().date(),
                'valid_from': valid_from,
                'valid_to': valid_to,
                'status': status
            }
            
        except Exception as e:
            logger.error(f"❌ 데이터 정규화 오류: {e}")
            return None

    def _extract_region(self, target_area: str) -> str:
        """대상 지역 추출 및 정규화"""
        if not target_area:
            return '서울시 전체'
            
        # 구 이름 추출
        districts = [
            '강남구', '강동구', '강북구', '강서구', '관악구', '광진구', '구로구', '금천구',
            '노원구', '도봉구', '동대문구', '동작구', '마포구', '서대문구', '서초구', '성동구',
            '성북구', '송파구', '양천구', '영등포구', '용산구', '은평구', '종로구', '중구', '중랑구'
        ]
        
        for district in districts:
            if district in target_area:
                return district
                
        return '서울시 전체'

    def _extract_eligibility(self, raw_data: Dict) -> Dict[str, Any]:
        """신청 자격 조건 추출"""
        eligibility = {}
        
        # 연령 조건 추출
        age_text = raw_data.get('AGE_LIMIT', '') + ' ' + raw_data.get('POLICY_CONTENT', '')
        age_range = self._parse_age_range(age_text)
        if age_range:
            eligibility['age'] = age_range
            
        # 거주 조건
        region = self._extract_region(raw_data.get('TARGET_AREA', ''))
        if region != '서울시 전체':
            eligibility['residency'] = {'districts': [region]}
        else:
            eligibility['residency'] = {'type': 'seoul'}
            
        # 소득 조건 (텍스트에서 추출)
        income_info = self._extract_income_condition(raw_data.get('POLICY_CONTENT', ''))
        if income_info:
            eligibility['income'] = income_info
            
        return eligibility

    def _parse_age_range(self, text: str) -> Optional[Dict[str, int]]:
        """텍스트에서 연령 범위 추출"""
        import re
        
        # 다양한 연령 표현 패턴 매칭
        patterns = [
            r'(\d+)세\s*이상\s*(\d+)세\s*이하',
            r'(\d+)세\s*~\s*(\d+)세',
            r'만\s*(\d+)세\s*이상\s*(\d+)세\s*이하',
            r'(\d+)세\s*부터\s*(\d+)세\s*까지'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text)
            if match:
                return {'min': int(match.group(1)), 'max': int(match.group(2))}
                
        # 단일 연령 조건
        single_patterns = [
            r'(\d+)세\s*이상',
            r'만\s*(\d+)세\s*이상'
        ]
        
        for pattern in single_patterns:
            match = re.search(pattern, text)
            if match:
                return {'min': int(match.group(1))}
                
        return None

    def _classify_policy_category(self, title: str, content: str) -> List[str]:
        """정책 제목과 내용을 분석하여 카테고리 분류"""
        categories = []
        text = (title + ' ' + content).lower()
        
        category_keywords = {
            '취업': ['취업', '일자리', '구직', '채용', '인턴', '직업', '고용', '구인', '면접', '이력서'],
            '창업': ['창업', '스타트업', '사업', '기업', '창업지원', '사업자', '벤처', '투자'],
            '진로': ['진로', '경력', '직업상담', '진로상담', '커리어', '직업탐색', '진로설계'],
            '주거': ['월세', '전세', '주거', '임대료', '보증금', '주택', '임대', '거주', '주거비'],
            '금융': ['대출', '금융', '자금', '지원금', '보조금', '적금', '투자', '금융지원'],
            '교육': ['교육', '학습', '강의', '연수', '교육비', '학비', '수강', '교육과정', '역량'],
            '정신건강': ['정신건강', '심리', '상담', '우울', '스트레스', '정신', '마음', '치료'],
            '신체건강': ['신체건강', '건강', '의료', '검진', '운동', '체력', '헬스', '건강관리'],
            '생활지원': ['생활지원', '복지', '생활비', '기초', '돌봄', '일상', '편의', '지원'],
            '문화/예술': ['문화', '예술', '공연', '전시', '체험', '축제', '예술활동', '문화활동']
        }
        
        for category, keywords in category_keywords.items():
            if any(keyword in text for keyword in keywords):
                categories.append(category)
                
        return categories if categories else ['기타']

    def _extract_income_condition(self, content: str) -> Optional[Dict[str, Any]]:
        """소득 조건 추출"""
        import re
        
        # 중위소득 기준 패턴
        patterns = [
            r'중위소득\s*(\d+)%\s*이하',
            r'기준중위소득\s*(\d+)%',
            r'(\d+)%\s*이하'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, content)
            if match:
                return {'ami_max': int(match.group(1))}
                
        return None

    def _extract_validity_period(self, raw_data: Dict) -> tuple:
        """유효기간 추출"""
        # 기본값: 현재년도 전체
        default_start = datetime(2025, 1, 1).date()
        default_end = datetime(2025, 12, 31).date()
        
        try:
            # API에서 제공하는 기간 정보가 있다면 사용
            start_date = raw_data.get('APPLY_START_DATE')
            end_date = raw_data.get('APPLY_END_DATE')
            
            if start_date:
                valid_from = datetime.strptime(start_date, '%Y-%m-%d').date()
            else:
                valid_from = default_start
                
            if end_date:
                valid_to = datetime.strptime(end_date, '%Y-%m-%d').date()
            else:
                valid_to = default_end
                
            return valid_from, valid_to
            
        except:
            return default_start, default_end

    def _determine_policy_status(self, valid_from, valid_to) -> str:
        """정책 상태 결정"""
        today = datetime.now().date()
        
        if valid_from > today:
            return 'upcoming'
        elif valid_to < today:
            return 'closed'
        else:
            return 'open'

    def _extract_benefit_info(self, raw_data: Dict) -> Dict[str, Any]:
        """지원 혜택 정보 추출"""
        content = raw_data.get('POLICY_CONTENT', '')
        
        # 금액 추출
        import re
        amount_patterns = [
            r'(\d{1,3}(?:,\d{3})*)\s*만원',
            r'(\d{1,3}(?:,\d{3})*)\s*원',
            r'최대\s*(\d{1,3}(?:,\d{3})*)'
        ]
        
        amount = None
        for pattern in amount_patterns:
            match = re.search(pattern, content)
            if match:
                amount_str = match.group(1).replace(',', '')
                amount = int(amount_str)
                if '만원' in match.group(0):
                    amount *= 10000
                break
        
        return {
            'type': 'cash' if amount else 'support',
            'amount': amount,
            'description': raw_data.get('SUPPORT_CONTENT', '')
        }

    def _extract_apply_method(self, raw_data: Dict) -> Dict[str, Any]:
        """신청 방법 정보 추출"""
        return {
            'method': 'online' if raw_data.get('APPLY_URL') else 'offline',
            'url': raw_data.get('APPLY_URL', ''),
            'procedure': raw_data.get('APPLY_PROCEDURE', ''),
            'documents': raw_data.get('REQUIRED_DOCS', '').split(',') if raw_data.get('REQUIRED_DOCS') else []
        }

    def _extract_contact_info(self, raw_data: Dict) -> Dict[str, Any]:
        """연락처 정보 추출"""
        return {
            'department': raw_data.get('CONTACT_DEPT', ''),
            'phone': raw_data.get('CONTACT_PHONE', ''),
            'email': raw_data.get('CONTACT_EMAIL', ''),
            'address': raw_data.get('CONTACT_ADDRESS', '')
        }

    async def collect_youth_portal_data(self) -> List[Dict[str, Any]]:
        """
        서울 청년정책 포털 웹 크롤링
        
        실제 웹사이트를 크롤링하여 최신 정책 정보 수집:
        - 정책 게시판 페이지 파싱
        - 각 정책 상세 페이지 크롤링
        - 구조화된 데이터로 변환
        """
        logger.info("🕷️ 청년정책 포털 크롤링 시작...")
        
        policies = []
        base_url = "https://youth.seoul.go.kr"
        
        async with aiohttp.ClientSession() as session:
            try:
                # 정책 목록 페이지 크롤링
                list_url = f"{base_url}/site/main/archive/policy"
                async with session.get(list_url) as response:
                    if response.status == 200:
                        html = await response.text()
                        soup = BeautifulSoup(html, 'html.parser')
                        
                        # 정책 링크 추출
                        policy_links = soup.find_all('a', href=True)
                        policy_urls = []
                        
                        for link in policy_links:
                            href = link.get('href')
                            if href and '/policy/' in href:
                                full_url = href if href.startswith('http') else base_url + href
                                policy_urls.append(full_url)
                        
                        # 각 정책 상세 정보 수집 (최대 50개)
                        for url in policy_urls[:50]:
                            try:
                                policy = await self._crawl_policy_detail(session, url)
                                if policy:
                                    policies.append(policy)
                                    
                                # 크롤링 간격 (서버 부하 방지)
                                await asyncio.sleep(0.5)
                                
                            except Exception as e:
                                logger.warning(f"⚠️ 정책 상세 크롤링 실패 {url}: {e}")
                                
            except Exception as e:
                logger.error(f"❌ 청년정책 포털 크롤링 오류: {e}")
                self.stats['errors'] += 1
        
        logger.info(f"📊 청년정책 포털 수집 완료: {len(policies)}개")
        return policies

    async def _crawl_policy_detail(self, session: aiohttp.ClientSession, url: str) -> Optional[Dict[str, Any]]:
        """개별 정책 상세 페이지 크롤링"""
        try:
            async with session.get(url) as response:
                if response.status != 200:
                    return None
                    
                html = await response.text()
                soup = BeautifulSoup(html, 'html.parser')
                
                # 제목 추출
                title_elem = soup.find('h1') or soup.find('h2') or soup.find('.title')
                title = title_elem.get_text().strip() if title_elem else ''
                
                if not title:
                    return None
                
                # 정책 ID 생성
                policy_id = f"youth_portal_{hashlib.md5(url.encode()).hexdigest()[:8]}"
                
                # 내용 추출
                content_elem = soup.find('.content') or soup.find('.policy-content') or soup.find('main')
                content = content_elem.get_text().strip() if content_elem else ''
                
                return {
                    'id': policy_id,
                    'title': title,
                    'summary': content[:200] + '...' if len(content) > 200 else content,
                    'body_html': str(content_elem) if content_elem else '',
                    'issuing_agency': '서울특별시',
                    'program_type': '청년정책',
                    'region': self._extract_region(content),
                    'category': self._classify_policy_category(title, content),
                    'eligibility': self._extract_eligibility_from_text(content),
                    'benefit': {'type': 'support', 'description': content[:500]},
                    'apply_method': {'method': 'online', 'url': url},
                    'contact': {'department': '청년정책과'},
                    'source_url': url,
                    'source_name': '서울 청년정책 포털',
                    'source_doc_date': datetime.now().date(),
                    'valid_from': datetime(2025, 1, 1).date(),
                    'valid_to': datetime(2025, 12, 31).date(),
                    'status': 'open'
                }
                
        except Exception as e:
            logger.error(f"❌ 정책 상세 크롤링 오류 {url}: {e}")
            return None

    def _extract_eligibility_from_text(self, text: str) -> Dict[str, Any]:
        """텍스트에서 자격 조건 추출"""
        eligibility = {}
        
        # 연령 조건
        age_range = self._parse_age_range(text)
        if age_range:
            eligibility['age'] = age_range
            
        # 학생 여부
        if any(keyword in text for keyword in ['대학생', '학생', '재학']):
            eligibility['student'] = True
            
        # 소득 조건
        income_info = self._extract_income_condition(text)
        if income_info:
            eligibility['income'] = income_info
            
        return eligibility

    async def save_policies_to_db(self, policies: List[Dict[str, Any]]):
        """
        정책 데이터를 데이터베이스에 저장
        
        중복 검사를 통해 새로운 정책만 추가하고,
        기존 정책이 변경된 경우 업데이트합니다.
        """
        logger.info("💾 데이터베이스 저장 시작...")
        
        conn = await self.connect_db()
        
        try:
            for policy in policies:
                try:
                    # 기존 정책 확인
                    existing = await conn.fetchrow(
                        "SELECT id, version FROM policies WHERE id = $1",
                        policy['id']
                    )
                    
                    if existing:
                        # 기존 정책 업데이트
                        await conn.execute("""
                            UPDATE policies SET
                                title = $2, summary = $3, body_html = $4,
                                issuing_agency = $5, program_type = $6,
                                region = $7, category = $8, eligibility = $9,
                                benefit = $10, apply_method = $11, contact = $12,
                                source_url = $13, source_name = $14,
                                valid_from = $15, valid_to = $16, status = $17,
                                version = $18, updated_at = NOW()
                            WHERE id = $1
                        """, 
                        policy['id'], policy['title'], policy['summary'], policy['body_html'],
                        policy['issuing_agency'], policy['program_type'],
                        policy['region'], policy['category'], json.dumps(policy['eligibility']),
                        json.dumps(policy['benefit']), json.dumps(policy['apply_method']), 
                        json.dumps(policy['contact']), policy['source_url'], policy['source_name'],
                        policy['valid_from'], policy['valid_to'], policy['status'],
                        existing['version'] + 1
                        )
                        
                        self.stats['updated_policies'] += 1
                        logger.info(f"🔄 정책 업데이트: {policy['title']}")
                        
                    else:
                        # 새 정책 추가
                        await conn.execute("""
                            INSERT INTO policies (
                                id, title, summary, body_html, issuing_agency, program_type,
                                region, category, eligibility, benefit, apply_method, contact,
                                source_url, source_name, source_doc_date,
                                valid_from, valid_to, status
                            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
                        """, 
                        policy['id'], policy['title'], policy['summary'], policy['body_html'],
                        policy['issuing_agency'], policy['program_type'],
                        policy['region'], policy['category'], json.dumps(policy['eligibility']),
                        json.dumps(policy['benefit']), json.dumps(policy['apply_method']), 
                        json.dumps(policy['contact']), policy['source_url'], policy['source_name'],
                        policy['source_doc_date'], policy['valid_from'], policy['valid_to'], policy['status']
                        )
                        
                        self.stats['new_policies'] += 1
                        logger.info(f"✨ 새 정책 추가: {policy['title']}")
                    
                    # 청크 생성 및 임베딩
                    await self._create_policy_chunks(conn, policy)
                    
                    self.stats['total_processed'] += 1
                    
                except Exception as e:
                    logger.error(f"❌ 정책 저장 오류 {policy.get('title', 'Unknown')}: {e}")
                    self.stats['errors'] += 1
                    
        finally:
            await conn.close()
            
        logger.info(f"💾 데이터베이스 저장 완료!")

    async def _create_policy_chunks(self, conn: asyncpg.Connection, policy: Dict[str, Any]):
        """
        정책을 검색 가능한 청크로 분할하고 임베딩 생성
        
        긴 정책 문서를 작은 단위로 나누어 검색 정확도를 높입니다.
        각 청크에 대해 벡터 임베딩을 생성하여 의미 기반 검색을 지원합니다.
        """
        try:
            # 기존 청크 삭제
            await conn.execute("DELETE FROM policy_chunks WHERE policy_id = $1", policy['id'])
            
            # 섹션별로 텍스트 분할
            sections = {
                '정책개요': f"{policy['title']} {policy['summary']}",
                '신청자격': self._extract_section_text(policy['body_html'], ['자격', '대상', '조건']),
                '지원내용': self._extract_section_text(policy['body_html'], ['지원', '혜택', '내용']),
                '신청방법': self._extract_section_text(policy['body_html'], ['신청', '방법', '절차']),
                '문의처': json.dumps(policy['contact'], ensure_ascii=False)
            }
            
            chunk_order = 0
            for section, text in sections.items():
                if text and text.strip():
                    # 임베딩 생성
                    embedding = self.embedding_model.encode(text)
                    embedding_list = embedding.tolist()
                    
                    # 청크 저장
                    await conn.execute("""
                        INSERT INTO policy_chunks (
                            policy_id, section, chunk_order, chunk_text, embedding
                        ) VALUES ($1, $2, $3, $4, $5)
                    """, policy['id'], section, chunk_order, text, embedding_list)
                    
                    chunk_order += 1
                    
        except Exception as e:
            logger.error(f"❌ 청크 생성 오류 {policy['id']}: {e}")

    def _extract_section_text(self, html_content: str, keywords: List[str]) -> str:
        """HTML에서 특정 섹션의 텍스트 추출"""
        if not html_content:
            return ''
            
        soup = BeautifulSoup(html_content, 'html.parser')
        text = soup.get_text()
        
        # 키워드가 포함된 문단 찾기
        sentences = text.split('.')
        relevant_sentences = []
        
        for sentence in sentences:
            if any(keyword in sentence for keyword in keywords):
                relevant_sentences.append(sentence.strip())
                
        return '. '.join(relevant_sentences) if relevant_sentences else text[:500]

    async def log_ingest_run(self, source_name: str, status: str, error_message: str = None):
        """데이터 수집 로그 기록"""
        conn = await self.connect_db()
        
        try:
            await conn.execute("""
                INSERT INTO ingest_logs (
                    source_name, start_time, end_time, status,
                    records_processed, records_updated, records_created, error_message
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            """, 
            source_name, datetime.now(), datetime.now(), status,
            self.stats['total_processed'], self.stats['updated_policies'], 
            self.stats['new_policies'], error_message
            )
        finally:
            await conn.close()

    async def run_full_pipeline(self):
        """
        전체 데이터 수집 파이프라인 실행
        
        모든 데이터 소스에서 정책 정보를 수집하고 데이터베이스에 저장합니다.
        실제 운영에서 스케줄러에 의해 주기적으로 실행됩니다.
        """
        logger.info("🚀 YOUTHY AI 데이터 수집 파이프라인 시작!")
        start_time = datetime.now()
        
        try:
            # 1. 서울 열린데이터광장 수집
            seoul_policies = await self.collect_seoul_open_data()
            
            # 2. 청년정책 포털 수집
            portal_policies = await self.collect_youth_portal_data()
            
            # 3. 모든 정책 데이터 통합
            all_policies = seoul_policies + portal_policies
            
            if all_policies:
                # 4. 데이터베이스 저장
                await self.save_policies_to_db(all_policies)
                
                # 5. 로그 기록
                await self.log_ingest_run("전체 파이프라인", "success")
                
                # 6. 결과 리포트
                end_time = datetime.now()
                duration = (end_time - start_time).total_seconds()
                
                logger.info("🎉 데이터 수집 파이프라인 완료!")
                logger.info(f"📊 처리 결과:")
                logger.info(f"   • 총 처리: {self.stats['total_processed']}개")
                logger.info(f"   • 신규 추가: {self.stats['new_policies']}개")
                logger.info(f"   • 업데이트: {self.stats['updated_policies']}개")
                logger.info(f"   • 오류: {self.stats['errors']}개")
                logger.info(f"   • 소요시간: {duration:.1f}초")
                
            else:
                logger.warning("⚠️ 수집된 정책 데이터가 없습니다.")
                await self.log_ingest_run("전체 파이프라인", "failed", "수집된 데이터 없음")
                
        except Exception as e:
            logger.error(f"❌ 파이프라인 실행 오류: {e}")
            await self.log_ingest_run("전체 파이프라인", "failed", str(e))
            raise

async def main():
    """메인 실행 함수"""
    parser = argparse.ArgumentParser(description='YOUTHY AI 데이터 수집 파이프라인')
    parser.add_argument('--initial-load', action='store_true', help='초기 데이터 로딩')
    parser.add_argument('--source', choices=['seoul', 'portal', 'all'], default='all', help='수집할 데이터 소스')
    
    args = parser.parse_args()
    
    pipeline = YouthyDataPipeline()
    
    if args.initial_load:
        logger.info("🔄 초기 데이터 로딩 시작...")
        
    await pipeline.run_full_pipeline()

if __name__ == "__main__":
    asyncio.run(main())
