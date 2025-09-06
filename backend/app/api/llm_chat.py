"""
YOUTHY AI 통합형 LLM 채팅 API

RAG + LangChain + OpenAI ChatGPT를 활용한 
Perplexity 스타일의 AI 어시스턴트입니다.

핵심 기능:
1. 자연어 대화형 인터페이스
2. 실시간 정책 데이터 검색 (RAG)
3. LangChain 기반 정확한 답변 생성
4. 출처 링크 및 레퍼런스 제공
5. 대화 컨텍스트 유지
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import logging
import json
import asyncio

from app.services.rag_service import get_rag_service, initialize_rag_system
from app.core.database import get_db_connection

logger = logging.getLogger(__name__)

# API 라우터 생성
router = APIRouter()

# ========================================
# 요청/응답 모델 정의
# ========================================

class UserContext(BaseModel):
    """사용자 컨텍스트 모델"""
    age: Optional[int] = Field(None, description="나이", ge=19, le=39)
    region: Optional[str] = Field(None, description="거주 지역 (예: 강남구)")
    student: Optional[bool] = Field(None, description="대학생 여부")
    income_level: Optional[str] = Field(None, description="소득 수준", enum=["low", "middle", "high"])
    employment_status: Optional[str] = Field(None, description="취업 상태", enum=["student", "unemployed", "employed", "freelancer"])

class ChatRequest(BaseModel):
    """채팅 요청 모델"""
    message: str = Field(..., description="사용자 메시지", min_length=1, max_length=1000)
    conversation_id: Optional[str] = Field(None, description="대화 ID (컨텍스트 유지용)")
    user_context: Optional[UserContext] = Field(None, description="사용자 컨텍스트")
    max_references: int = Field(5, description="최대 참조 수", ge=1, le=10)

class Reference(BaseModel):
    """참조 출처 모델 (Perplexity 스타일)"""
    id: str = Field(..., description="참조 ID")
    title: str = Field(..., description="정책/문서 제목")
    url: str = Field(..., description="원본 URL")
    snippet: str = Field(..., description="관련 텍스트 발췌")
    source: str = Field(..., description="출처 기관")
    relevance_score: float = Field(..., description="관련도 점수 (0-1)")
    last_updated: str = Field(..., description="마지막 업데이트 시간")

class ChatResponse(BaseModel):
    """채팅 응답 모델"""
    message: str = Field(..., description="AI 응답 메시지")
    references: List[Reference] = Field(..., description="참조 출처 목록")
    conversation_id: str = Field(..., description="대화 ID")
    response_time_ms: int = Field(..., description="응답 시간 (밀리초)")
    confidence_score: float = Field(..., description="답변 신뢰도 (0-1)")
    follow_up_questions: List[str] = Field(..., description="추천 후속 질문")
    timestamp: str = Field(..., description="응답 시간")
    model_used: str = Field(..., description="사용된 AI 모델")

# ========================================
# 메인 채팅 API
# ========================================

@router.post("/chat", response_model=ChatResponse)
async def chat_with_ai(
    request: ChatRequest,
    db = Depends(get_db_connection)
):
    """
    🤖 YOUTHY AI 메인 채팅 API
    
    **RAG + LangChain + OpenAI ChatGPT 통합 시스템**
    
    청년정책에 대한 모든 질문에 답변하고, 
    정확한 출처와 링크를 함께 제공합니다.
    
    **사용 예시:**
    ```json
    {
        "message": "성북구에 사는 25세 대학생인데, 월세 지원받을 수 있는 정책이 있을까요?",
        "user_context": {
            "age": 25,
            "region": "성북구",
            "student": true,
            "employment_status": "student"
        }
    }
    ```
    
    **응답 특징:**
    - 자연스러운 대화형 답변 (ChatGPT 품질)
    - 정확한 출처 링크 제공 [1], [2], [3] 형식
    - 개인 상황에 맞는 맞춤형 조언
    - 후속 질문 제안
    - 실시간 최신 정보 반영
    """
    start_time = datetime.now()
    
    try:
        logger.info(f"💬 채팅 요청: {request.message[:50]}...")
        
        # RAG 서비스로 통합 처리
        rag_service = await get_rag_service()
        response = await rag_service.chat_with_rag(
            user_message=request.message,
            user_context=request.user_context.dict() if request.user_context else None,
            conversation_id=request.conversation_id
        )
        
        # 응답 시간 계산
        response_time = int((datetime.now() - start_time).total_seconds() * 1000)
        
        # 대화 ID 생성 (새 대화인 경우)
        conversation_id = request.conversation_id or f"conv_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{hash(request.message) % 10000}"
        
        # 후속 질문 생성
        follow_up_questions = _generate_follow_up_questions(request.message, response['answer'], request.user_context)
        
        logger.info(f"✅ 채팅 응답 생성 완료 ({response_time}ms)")
        
        return ChatResponse(
            message=response['answer'],
            references=[
                Reference(
                    id=ref['id'],
                    title=ref['title'],
                    url=ref['url'],
                    snippet=ref['snippet'],
                    source=ref['source'],
                    relevance_score=ref['relevance_score'],
                    last_updated=ref['last_updated']
                ) for ref in response['references']
            ],
            conversation_id=conversation_id,
            response_time_ms=response_time,
            confidence_score=response['confidence_score'],
            follow_up_questions=follow_up_questions,
            timestamp=datetime.now().isoformat(),
            model_used=response.get('model_used', 'gpt-3.5-turbo')
        )
        
    except Exception as e:
        logger.error(f"❌ 채팅 처리 오류: {e}", exc_info=True)
        
        # 오류 시에도 기본 응답 제공
        return ChatResponse(
            message="죄송합니다. 일시적인 시스템 오류가 발생했습니다. 잠시 후 다시 시도해주세요. 🙏",
            references=[],
            conversation_id=request.conversation_id or "error_conv",
            response_time_ms=int((datetime.now() - start_time).total_seconds() * 1000),
            confidence_score=0.0,
            follow_up_questions=[
                "시스템 상태를 확인해주세요.",
                "다른 키워드로 다시 질문해보세요."
            ],
            timestamp=datetime.now().isoformat(),
            model_used="error"
        )

@router.post("/chat/stream")
async def stream_chat_response(
    request: ChatRequest,
    db = Depends(get_db_connection)
):
    """
    🌊 스트리밍 채팅 API
    
    실시간으로 응답을 스트리밍하여 사용자 경험을 향상시킵니다.
    ChatGPT처럼 답변이 타이핑되는 효과를 구현할 수 있습니다.
    
    **사용법:**
    ```javascript
    const response = await fetch('/api/v1/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: "질문내용" })
    });
    
    const reader = response.body.getReader();
    // 스트리밍 데이터 처리...
    ```
    """
    try:
        async def generate_stream():
            """스트리밍 응답 생성기"""
            
            # 1. 초기화
            yield f"data: {json.dumps({'type': 'status', 'message': 'YOUTHY AI 준비 중...'}, ensure_ascii=False)}\n\n"
            
            # 2. RAG 서비스 초기화
            rag_service = await get_rag_service()
            
            # 3. 관련 정책 검색
            yield f"data: {json.dumps({'type': 'status', 'message': '관련 정책 검색 중...'}, ensure_ascii=False)}\n\n"
            
            if rag_service.retriever:
                relevant_docs = await rag_service._retrieve_relevant_policies(
                    request.message, 
                    request.user_context.dict() if request.user_context else None
                )
                context = rag_service._build_context_from_docs(relevant_docs)
                references = rag_service._extract_references_from_docs(relevant_docs)
            else:
                context = ""
                references = []
            
            yield f"data: {json.dumps({'type': 'status', 'message': f'{len(references)}개 관련 정책 발견'}, ensure_ascii=False)}\n\n"
            
            # 4. AI 답변 스트리밍
            yield f"data: {json.dumps({'type': 'status', 'message': 'AI 답변 생성 중...'}, ensure_ascii=False)}\n\n"
            
            async for chunk in rag_service.generate_streaming_response(
                user_message=request.message,
                context=context,
                user_context=request.user_context.dict() if request.user_context else None
            ):
                yield f"data: {json.dumps({'type': 'content', 'data': chunk}, ensure_ascii=False)}\n\n"
            
            # 5. 참조 출처 전송
            if references:
                yield f"data: {json.dumps({'type': 'references', 'references': references}, ensure_ascii=False)}\n\n"
            
            # 6. 후속 질문 전송
            follow_ups = _generate_follow_up_questions(request.message, "", request.user_context)
            yield f"data: {json.dumps({'type': 'follow_up', 'questions': follow_ups}, ensure_ascii=False)}\n\n"
            
            # 7. 완료 신호
            yield f"data: {json.dumps({'type': 'done'}, ensure_ascii=False)}\n\n"
        
        return StreamingResponse(
            generate_stream(),
            media_type="text/plain",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Content-Type": "text/event-stream"
            }
        )
        
    except Exception as e:
        logger.error(f"❌ 스트리밍 채팅 오류: {e}")
        raise HTTPException(status_code=500, detail="스트리밍 응답 생성 중 오류가 발생했습니다.")

class QuickAskRequest(BaseModel):
    question: str = Field(..., description="간단한 질문")

@router.post("/chat/quick-ask")
async def quick_ask(
    request: QuickAskRequest,
    db = Depends(get_db_connection)
):
    """
    ⚡ 빠른 질문 API
    
    복잡한 설정 없이 간단하게 질문하고 답변받을 수 있는 API입니다.
    프론트엔드에서 간단한 검색창이나 FAQ 기능을 구현할 때 사용합니다.
    
    **사용법:**
    ```
    POST /api/v1/chat/quick-ask
    Content-Type: application/x-www-form-urlencoded
    
    question=월세 지원 정책이 뭐가 있어?
    ```
    """
    try:
        # RAG 기반 간단한 응답
        rag_service = await get_rag_service()
        response = await rag_service.chat_with_rag(
            user_message=request.question,
            user_context=None
        )
        
        # 간소화된 응답 반환
        return {
            "answer": response['answer'],
            "sources": [
                {
                    "title": ref['title'],
                    "url": ref['url'],
                    "agency": ref['source']
                }
                for ref in response['references'][:3]
            ],
            "confidence": response['confidence_score'],
            "model_used": response.get('model_used', 'gpt-3.5-turbo'),
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"❌ 빠른 질문 처리 오류: {e}")
        return {
            "answer": "죄송합니다. 질문 처리 중 오류가 발생했습니다.",
            "sources": [],
            "confidence": 0.0,
            "model_used": "error",
            "timestamp": datetime.now().isoformat()
        }

@router.get("/chat/categories")
async def get_policy_categories():
    """
    📋 정책 카테고리 목록 API
    
    8개 청년정책 카테고리 목록을 반환합니다.
    프론트엔드에서 카테고리 필터나 네비게이션을 구현할 때 사용합니다.
    """
    from app.services.youthcenter_api import YouthCenterAPIClient
    
    categories = list(YouthCenterAPIClient.POLICY_CATEGORIES.keys())
    
    return {
        "categories": categories,
        "total_count": len(categories),
        "category_details": {
            category: {
                "name": category,
                "keywords": YouthCenterAPIClient.POLICY_CATEGORIES[category][:3],  # 처음 3개만
                "description": _get_category_description(category)
            }
            for category in categories
        },
        "timestamp": datetime.now().isoformat()
    }

def _get_category_description(category: str) -> str:
    """카테고리별 설명 반환"""
    descriptions = {
        "취업": "일자리 찾기, 구직활동, 인턴십, 취업 지원 프로그램",
        "창업": "사업 시작, 스타트업 지원, 창업 교육, 사업자 등록",
        "주거": "월세 지원, 전세 대출, 임대주택, 주거 안정",
        "교육": "직업 훈련, 학습 지원, 교육비 지원, 온라인 강의",
        "복지": "생활비 지원, 의료 지원, 심리상담, 각종 수당",
        "문화/예술": "문화 체험, 예술 활동, 공연 관람, 전시 참여",
        "참여권리": "정책 참여, 시민 활동, 권익 보호, 위원회 활동",
        "기타": "종합 지원, 상담 서비스, 정보 제공, 기타 혜택"
    }
    return descriptions.get(category, "청년을 위한 다양한 정책 지원")

@router.get("/chat/suggestions")
async def get_chat_suggestions(
    user_context: Optional[str] = Query(None, description="사용자 컨텍스트 (JSON)"),
    category: Optional[str] = Query(None, description="카테고리 필터 (취업, 창업, 주거, 교육, 복지, 문화/예술, 참여권리, 기타)"),
    db = Depends(get_db_connection)
):
    """
    💡 질문 제안 API
    
    사용자가 무엇을 물어볼지 모를 때 도움이 되는 질문들을 제안합니다.
    프론트엔드에서 "이런 것도 물어보세요" 기능을 구현할 때 사용합니다.
    """
    try:
        # 기본 질문 템플릿
        base_suggestions = [
            "청년들이 받을 수 있는 주거 지원 정책은 어떤 것들이 있나요?",
            "대학생도 신청할 수 있는 취업 지원 프로그램을 알려주세요.",
            "청년 창업을 준비하는데 도움받을 수 있는 정책이 있을까요?",
            "월세가 부담스러운데 지원받을 수 있는 방법이 있나요?",
            "졸업 후 취업 준비를 위한 교육 프로그램은 어떤 게 있어요?",
            "청년 대상 문화 프로그램에는 어떤 것들이 있나요?",
            "각 구별로 다른 청년 정책이 있나요?",
            "소득이 낮은 청년도 신청할 수 있는 지원 정책은?"
        ]
        
        # 사용자 컨텍스트 기반 맞춤 질문
        personalized_suggestions = []
        
        if user_context:
            try:
                context = json.loads(user_context)
                age = context.get('age')
                region = context.get('region')
                student = context.get('student')
                
                if age and region:
                    personalized_suggestions.append(f"{region}에 사는 {age}세가 신청할 수 있는 정책들을 알려주세요.")
                    
                if student:
                    personalized_suggestions.append("대학생 전용 지원 정책에는 어떤 것들이 있나요?")
                    
                if region:
                    personalized_suggestions.append(f"{region}에서만 신청할 수 있는 특별한 정책이 있을까요?")
                    
            except:
                pass
        
        # 8개 카테고리별 질문
        category_suggestions = {
            "취업": [
                "취업성공패키지는 어떤 프로그램인가요?",
                "청년 인턴십 지원 사업이 있나요?",
                "취업 준비생을 위한 교육 프로그램은?",
                "구직활동 지원금은 어떻게 받나요?"
            ],
            "창업": [
                "청년 창업 지원금 신청 방법을 알려주세요.",
                "창업 교육 프로그램에는 어떤 것들이 있나요?",
                "스타트업 지원 정책이 궁금해요.",
                "사업자 등록 지원 제도가 있나요?"
            ],
            "주거": [
                "청년 월세 지원 정책의 신청 조건은?",
                "전세 자금 대출은 어떻게 신청하나요?",
                "청년 주택 공급 정책에 대해 알려주세요.",
                "임대주택 입주 자격이 궁금해요."
            ],
            "교육": [
                "청년 대상 교육 프로그램에는 어떤 것들이 있나요?",
                "직업 훈련 지원 정책을 알려주세요.",
                "학습비 지원 제도가 있나요?",
                "온라인 강의 지원 프로그램은?"
            ],
            "복지": [
                "청년 생활비 지원 정책은 어떤 게 있나요?",
                "의료비 지원 제도를 알려주세요.",
                "청년 수당 신청 방법이 궁금해요.",
                "심리상담 지원 서비스가 있나요?"
            ],
            "문화/예술": [
                "청년 문화 프로그램에는 어떤 것들이 있나요?",
                "예술 활동 지원 정책을 알려주세요.",
                "문화 체험 지원 제도가 있나요?",
                "공연 관람 할인 혜택은?"
            ],
            "참여권리": [
                "청년 정책 참여 방법을 알려주세요.",
                "청년 위원회 활동은 어떻게 하나요?",
                "시민 참여 프로그램이 있나요?",
                "청년 권익 보호 제도는?"
            ],
            "기타": [
                "청년 종합 지원 센터는 어디에 있나요?",
                "청년 정책 통합 정보는 어디서 볼 수 있나요?",
                "청년 지원 정책 신청 절차를 알려주세요.",
                "청년 정책 문의는 어디에 하나요?"
            ]
        }
        
        if category and category in category_suggestions:
            personalized_suggestions.extend(category_suggestions[category])
        
        all_suggestions = personalized_suggestions + base_suggestions
        
        return {
            "suggestions": all_suggestions[:12],  # 최대 12개
            "personalized_count": len(personalized_suggestions),
            "category": category,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"❌ 질문 제안 생성 오류: {e}")
        return {
            "suggestions": base_suggestions[:8],
            "personalized_count": 0,
            "timestamp": datetime.now().isoformat()
        }

@router.get("/chat/category/{category}")
async def get_policies_by_category(
    category: str,
    user_context: Optional[str] = Query(None, description="사용자 컨텍스트 (JSON)"),
    limit: int = Query(10, description="최대 정책 개수", ge=1, le=50),
    db = Depends(get_db_connection)
):
    """
    🏷️ 카테고리별 정책 검색 API
    
    특정 카테고리의 청년정책들을 검색합니다.
    온통청년 API를 통해 최신 정책 정보를 제공합니다.
    
    **사용 예시:**
    ```
    GET /api/v1/chat/category/취업?limit=5
    GET /api/v1/chat/category/주거?user_context={"region":"성북구","age":25}
    ```
    """
    try:
        from app.services.youthcenter_api import YouthCenterAPIClient
        
        # 카테고리 유효성 검사
        valid_categories = list(YouthCenterAPIClient.POLICY_CATEGORIES.keys())
        if category not in valid_categories:
            raise HTTPException(
                status_code=400, 
                detail=f"유효하지 않은 카테고리입니다. 가능한 카테고리: {valid_categories}"
            )
        
        # 사용자 컨텍스트 파싱
        user_ctx = None
        if user_context:
            try:
                user_ctx = json.loads(user_context)
            except:
                raise HTTPException(status_code=400, detail="사용자 컨텍스트 JSON 형식이 올바르지 않습니다.")
        
        # 온통청년 API로 카테고리별 정책 검색
        youthcenter_client = YouthCenterAPIClient()
        policies = await youthcenter_client.search_policies_by_category(
            category=category,
            user_context=user_ctx,
            max_results=limit
        )
        
        # 응답 포맷팅
        formatted_policies = []
        for policy in policies:
            # 정책 만료 상태 확인
            is_expired = youthcenter_client._is_policy_expired(policy)
            
            # 신청기간 파싱하여 남은 일수 계산
            application_period = policy.get('rqutPrdCn', 'N/A')
            start_date, end_date = youthcenter_client._parse_policy_period(application_period)
            
            remaining_days = None
            period_status = "진행중"
            if end_date:
                from datetime import date
                remaining_days = (end_date - date.today()).days
                if remaining_days < 0:
                    period_status = "만료됨"
                elif remaining_days == 0:
                    period_status = "오늘 마감"
                elif remaining_days <= 7:
                    period_status = f"마감 임박 ({remaining_days}일)"
                else:
                    period_status = f"{remaining_days}일 남음"
            elif any(keyword in application_period for keyword in ['상시', '연중', '수시']):
                period_status = "상시모집"
            
            formatted_policy = {
                "id": policy.get('bizId', ''),
                "title": policy.get('polyBizSjnm', 'N/A'),
                "agency": policy.get('cnsgNmor', 'N/A'),
                "category": category,
                "support_target": policy.get('sporTarget', 'N/A'),
                "support_content": policy.get('sporCn', 'N/A'),
                "application_period": application_period,
                "application_method": policy.get('rqutProcCn', 'N/A'),
                "detail_url": policy.get('rfcSiteUrla1', 'N/A'),
                "matched_keywords": policy.get('category_keywords', [])[:3],
                "is_expired": is_expired,
                "period_status": period_status,
                "remaining_days": remaining_days,
                "start_date": start_date.isoformat() if start_date else None,
                "end_date": end_date.isoformat() if end_date else None
            }
            formatted_policies.append(formatted_policy)
        
        return {
            "category": category,
            "category_description": _get_category_description(category),
            "policies": formatted_policies,
            "total_count": len(formatted_policies),
            "user_context": user_ctx,
            "search_keywords": YouthCenterAPIClient.POLICY_CATEGORIES[category][:5],
            "timestamp": datetime.now().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"카테고리별 정책 검색 오류: {e}")
        raise HTTPException(status_code=500, detail=f"정책 검색 중 오류가 발생했습니다: {str(e)}")

# ========================================
# 데이터 관리 API
# ========================================

class RefreshDataRequest(BaseModel):
    source: str = Field("all", description="데이터 소스")
    force: bool = Field(False, description="강제 업데이트 여부")

@router.post("/chat/refresh-data")
async def refresh_policy_data(
    request: RefreshDataRequest,
    db = Depends(get_db_connection)
):
    """
    🔄 정책 데이터 실시간 업데이트 API
    
    관리자가 수동으로 최신 정책 데이터를 업데이트할 때 사용합니다.
    또는 프론트엔드에서 "최신 정보 업데이트" 버튼을 구현할 때 사용합니다.
    """
    try:
        logger.info(f"🔄 데이터 업데이트 요청: {request.source}")
        
        # 실시간 크롤링 실행
        from data_ingestion.real_time_crawler import run_real_time_crawling
        import os
        
        api_key = os.getenv('SEOUL_OPEN_DATA_API_KEY', '')
        if not api_key:
            raise HTTPException(status_code=500, detail="서울 열린데이터 API 키가 설정되지 않았습니다.")
        
        new_policies = await run_real_time_crawling(api_key)
        
        # RAG 시스템 재초기화
        await initialize_rag_system(db)
        
        updated_count = len(new_policies)
        
        return {
            "message": f"✅ 데이터 업데이트 완료! {updated_count}개 정책 정보가 갱신되었습니다.",
            "updated_policies": updated_count,
            "source": request.source,
            "last_update": datetime.now().isoformat(),
            "next_auto_update": (datetime.now() + timedelta(hours=6)).isoformat()
        }
        
    except Exception as e:
        logger.error(f"❌ 데이터 업데이트 오류: {e}")
        raise HTTPException(status_code=500, detail=f"데이터 업데이트 중 오류가 발생했습니다: {str(e)}")

@router.get("/chat/health")
async def check_system_health(db = Depends(get_db_connection)):
    """
    🏥 시스템 상태 확인 API
    
    RAG 시스템의 전체적인 상태를 확인합니다.
    """
    try:
        rag_service = await get_rag_service()
        
        # 기본 상태 확인
        health_status = {
            "database": "healthy",
            "rag_service": "healthy" if rag_service else "error",
            "embeddings": "healthy" if rag_service.embeddings else "error",
            "retriever": "healthy" if rag_service.retriever else "not_initialized",
            "openai_api": "healthy" if rag_service.openai_client else "not_configured",
            "timestamp": datetime.now().isoformat()
        }
        
        # 전체 상태 계산
        error_count = sum(1 for status in health_status.values() if isinstance(status, str) and status in ["error", "not_configured"])
        overall_status = "healthy" if error_count == 0 else "partial" if error_count < 2 else "error"
        
        return {
            "overall_status": overall_status,
            "components": health_status,
            "recommendations": _get_health_recommendations(health_status),
            "version": "v1.0.0-mvp"
        }
        
    except Exception as e:
        logger.error(f"❌ 상태 확인 오류: {e}")
        return {
            "overall_status": "error",
            "components": {"error": str(e)},
            "recommendations": ["시스템 로그를 확인하세요."],
            "timestamp": datetime.now().isoformat()
        }

# ========================================
# 헬퍼 함수들
# ========================================

def _generate_follow_up_questions(user_message: str, ai_response: str, user_context: Optional[UserContext]) -> List[str]:
    """8개 카테고리 기반 후속 질문 생성"""
    follow_ups = []
    message_lower = user_message.lower()
    
    # 취업 관련
    if any(keyword in message_lower for keyword in ["취업", "일자리", "구직", "인턴", "채용"]):
        follow_ups.extend([
            "취업 교육 프로그램도 있나요?",
            "인턴십 기회는 어떻게 찾나요?",
            "구직활동 지원금도 받을 수 있나요?"
        ])
    
    # 창업 관련
    elif any(keyword in message_lower for keyword in ["창업", "사업", "스타트업", "기업"]):
        follow_ups.extend([
            "창업 교육은 어디서 받을 수 있나요?",
            "사업자 등록 지원도 있나요?",
            "창업 멘토링 프로그램이 있을까요?"
        ])
    
    # 주거 관련
    elif any(keyword in message_lower for keyword in ["주거", "월세", "전세", "임대", "주택"]):
        follow_ups.extend([
            "전세 대출도 받을 수 있나요?",
            "임대주택 입주 조건은 어떻게 되나요?",
            "주거 지원 외에 생활비 지원도 있나요?"
        ])
    
    # 교육 관련
    elif any(keyword in message_lower for keyword in ["교육", "학습", "강의", "훈련", "연수"]):
        follow_ups.extend([
            "온라인 교육 프로그램도 있나요?",
            "교육비 지원은 어떻게 받나요?",
            "직업 훈련 과정은 어떤 것들이 있나요?"
        ])
    
    # 복지 관련
    elif any(keyword in message_lower for keyword in ["복지", "지원금", "수당", "생활비", "의료"]):
        follow_ups.extend([
            "의료비 지원도 받을 수 있나요?",
            "심리상담 서비스는 어떻게 이용하나요?",
            "생활비 지원 외에 다른 복지 혜택은?"
        ])
    
    # 문화/예술 관련
    elif any(keyword in message_lower for keyword in ["문화", "예술", "공연", "전시", "체험"]):
        follow_ups.extend([
            "예술 활동 지원은 어떻게 받나요?",
            "문화 체험 프로그램 신청 방법은?",
            "공연 관람 할인 혜택도 있나요?"
        ])
    
    # 참여권리 관련
    elif any(keyword in message_lower for keyword in ["참여", "권리", "위원회", "시민", "봉사"]):
        follow_ups.extend([
            "청년 위원회 활동은 어떻게 참여하나요?",
            "정책 제안은 어떻게 할 수 있나요?",
            "청년 권익 보호 제도는 어떤 게 있나요?"
        ])
    
    # 기본 후속 질문 (카테고리 매칭이 안 된 경우)
    if not follow_ups:
        follow_ups = [
            "다른 카테고리 정책도 궁금해요",
            "신청 방법을 자세히 알려주세요",
            "비슷한 다른 정책도 있나요?"
        ]
    
    return follow_ups[:3]

def _get_health_recommendations(health_status: Dict) -> List[str]:
    """상태 기반 권장사항 생성"""
    recommendations = []
    
    if health_status.get("openai_api") == "not_configured":
        recommendations.append("OpenAI API 키를 설정하면 더 정확한 답변을 받을 수 있습니다.")
    
    if health_status.get("retriever") == "not_initialized":
        recommendations.append("데이터 업데이트를 실행하여 RAG 시스템을 초기화하세요.")
    
    if health_status.get("embeddings") == "error":
        recommendations.append("임베딩 모델 로드에 실패했습니다. requirements.txt 의존성을 확인하세요.")
    
    if not recommendations:
        recommendations.append("모든 시스템이 정상 작동 중입니다! 🎉")
    
    return recommendations

# ========================================
# 시스템 초기화 이벤트
# ========================================

@router.on_event("startup")
async def startup_rag_system():
    """서버 시작 시 RAG 시스템 초기화"""
    try:
        logger.info("🚀 YOUTHY AI RAG 시스템 초기화 중...")
        
        # DB 연결 테스트
        db = await get_db_connection()
        
        # RAG 시스템 초기화
        await initialize_rag_system(db)
        
        logger.info("✅ YOUTHY AI RAG 시스템 초기화 완료!")
        
    except Exception as e:
        logger.error(f"❌ RAG 시스템 초기화 실패: {e}")
        # 시스템은 계속 실행되지만 RAG 기능이 제한될 수 있음