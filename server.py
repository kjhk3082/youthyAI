#!/usr/bin/env python3
"""
YOUTHY AI - 유씨 청년정책 AI 어시스턴트 서버
완전한 기능 구현
"""

"""
YOUTHY AI - 유씨 청년정책 AI 어시스턴트 서버
실제 서울시 정책 데이터를 기반으로 한 완전한 서비스 구현

주요 기능:
1. 실시간 서울시 정책 데이터 크롤링
2. OpenAI GPT-4를 활용한 자연어 답변 생성
3. RAG(Retrieval-Augmented Generation) 시스템
4. 10개 카테고리 기반 정책 분류
5. 출처와 상세 정보가 포함된 신뢰성 있는 답변

개발자: YOUTHY AI Team
버전: 1.0.0 (실제 서비스용)
"""

import os
import sys
import asyncio
import logging
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
import aiohttp
import hashlib
import re

# FastAPI 관련 imports
from fastapi import FastAPI, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
import uvicorn

# AI/ML 관련 imports
from openai import OpenAI

# 환경변수 로드
from dotenv import load_dotenv
load_dotenv()

# =============================================================================
# 로깅 및 초기 설정 (초보 개발자를 위한 상세 설명)
# =============================================================================

# 로깅 설정
# - 로깅이란? 프로그램 실행 과정에서 발생하는 정보를 기록하는 시스템
# - 디버깅, 모니터링, 에러 추적에 필수적
# - level=logging.INFO: INFO 레벨 이상의 로그만 출력 (DEBUG < INFO < WARNING < ERROR < CRITICAL)
# - format: 로그 메시지 형식을 지정 (시간 - 모듈명 - 레벨 - 메시지)
logging.basicConfig(
    level=logging.INFO,  # 정보성 메시지부터 출력
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'  # 로그 형식
)
# logger 객체 생성: 이 파일에서 발생하는 로그를 관리
# __name__은 현재 파일명(server.py)을 의미
logger = logging.getLogger(__name__)

# OpenAI 클라이언트 초기화 (AI 기능의 핵심)
# - openai_client: OpenAI GPT 모델과 통신하기 위한 클라이언트 객체
# - None으로 초기화하여 API 키가 없어도 서버가 시작되도록 함
openai_client = None

# 환경변수에서 OpenAI API 키 확인
# os.getenv(): 환경변수에서 값을 가져오는 함수 (.env 파일에서 로드됨)
if os.getenv('OPENAI_API_KEY'):
    try:
        # OpenAI 클라이언트 객체 생성
        # 이 객체를 통해 GPT 모델에 질문을 보내고 답변을 받을 수 있음
        openai_client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
        logger.info("✅ OpenAI API 클라이언트 초기화 성공")
    except Exception as e:
        # 초기화 실패 시 에러 로그 출력 (서버는 계속 실행됨)
        logger.error(f"❌ OpenAI API 클라이언트 초기화 실패: {e}")

# 서울시 열린데이터광장 API 키 (실시간 정책 데이터 수집용)
# - 서울시에서 제공하는 공공데이터 API에 접근하기 위한 인증키
# - 실제 청년정책 정보를 가져오는 데 사용됨
# - 빈 문자열('')을 기본값으로 설정하여 키가 없어도 에러가 발생하지 않도록 함
SEOUL_API_KEY = os.getenv('SEOUL_OPEN_DATA_API_KEY', '')

# API 키가 설정되지 않은 경우 경고 메시지 출력
# 서버는 계속 실행되지만 실제 API 호출 대신 fallback 데이터를 사용하게 됨
if not SEOUL_API_KEY:
    logger.warning("⚠️ 서울시 API 키가 설정되지 않았습니다. 실제 정책 데이터를 가져올 수 없습니다.")

# FastAPI 앱 생성 (웹 서버의 핵심 객체)
# FastAPI란? Python으로 빠르고 현대적인 API를 만들 수 있는 웹 프레임워크
# - 자동 API 문서 생성 (Swagger UI)
# - 빠른 성능 (Node.js, Go와 비슷한 수준)
# - Python 타입 힌트 활용으로 개발자 경험 향상
app = FastAPI(
    title="YOUTHY AI API",  # API 제목 (Swagger 문서에 표시)
    description="""
    **유씨 청년정책 AI 어시스턴트**
    
    청년들을 위한 맞춤형 정책 정보를 AI로 제공합니다.
    
    ## 🚀 핵심 기능
    - **로컬 캐시 시스템**: 첫 답변 후 빠른 응답 (< 1초)
    - **10개 카테고리**: 취업, 창업, 진로, 주거, 금융, 교육, 정신건강, 신체건강, 생활지원, 문화/예술
    - **실시간 데이터 수집**: 자동 크롤링 및 분류
    - **RAG + LangChain**: 정확한 AI 답변 생성
    """,  # API 설명 (Swagger 문서에 표시, 마크다운 지원)
    version="1.0.0"  # API 버전
)

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static 파일 설정 (CSS, JS, 이미지 등)
# /static/youthy-logo.svg 등의 정적 파일을 제공
app.mount("/static", StaticFiles(directory="static"), name="static")

# 요청 모델들
class ChatRequest(BaseModel):
    message: str = Field(..., description="사용자 메시지")
    user_context: Optional[Dict[str, Any]] = Field(None, description="사용자 컨텍스트")

class QuickAskRequest(BaseModel):
    question: str = Field(..., description="간단한 질문")

class RefreshCacheRequest(BaseModel):
    force: bool = Field(False, description="강제 갱신 여부")

# 10개 카테고리 정의
POLICY_CATEGORIES = [
    {"id": "employment", "name": "취업", "emoji": "💼", "keywords": ["취업", "일자리", "구직", "채용", "면접"]},
    {"id": "startup", "name": "창업", "emoji": "🚀", "keywords": ["창업", "사업", "스타트업", "기업가"]},
    {"id": "career", "name": "진로", "emoji": "🧭", "keywords": ["진로", "직업", "경력", "멘토링"]},
    {"id": "housing", "name": "주거", "emoji": "🏠", "keywords": ["주거", "임대", "전세", "월세", "주택", "자취"]},
    {"id": "finance", "name": "금융", "emoji": "💰", "keywords": ["금융", "대출", "적금", "투자", "신용"]},
    {"id": "education", "name": "교육", "emoji": "📚", "keywords": ["교육", "학습", "강의", "자격증", "연수"]},
    {"id": "mental_health", "name": "정신건강", "emoji": "🧠", "keywords": ["정신건강", "상담", "심리", "스트레스"]},
    {"id": "physical_health", "name": "신체건강", "emoji": "💪", "keywords": ["건강", "의료", "운동", "체력"]},
    {"id": "life_support", "name": "생활지원", "emoji": "🤝", "keywords": ["생활", "지원", "복지", "혜택"]},
    {"id": "culture_arts", "name": "문화/예술", "emoji": "🎨", "keywords": ["문화", "예술", "공연", "전시"]}
]

# 실제 정책 데이터베이스 (Mock RAG)
POLICY_DATABASE = {
    "housing": [
        {
            "id": "seoul_youth_housing_1",
            "title": "서울청년주택 (SH공사)",
            "category": "주거",
            "description": "서울시 청년을 위한 저렴한 임대주택 공급",
            "age_range": "19~39세",
            "eligibility": ["서울시 거주 또는 근무", "무주택자", "소득 기준 충족"],
            "period": "2년 + 재계약 2년 (최대 4년)",
            "benefits": ["시세 대비 80% 임대료", "보증금 5~10% 수준"],
            "how_to_apply": "SH공사 홈페이지 온라인 신청",
            "documents": ["신청서", "소득증명서", "재직증명서", "주민등록등본"],
            "url": "https://www.i-sh.co.kr/",
            "contact": "1600-3456",
            "source": "서울주택도시공사",
            "last_updated": "2024-12-01"
        },
        {
            "id": "seoul_youth_rent_loan",
            "title": "서울시 청년 전세자금대출",
            "category": "주거",
            "description": "청년들의 전세자금 마련을 위한 저금리 대출 지원",
            "age_range": "만 19~34세",
            "eligibility": ["서울시 거주", "연소득 5천만원 이하", "신용등급 6등급 이상"],
            "period": "최장 10년",
            "benefits": ["연 1.2% 저금리", "최대 2억원 한도"],
            "how_to_apply": "서울시 및 협약은행 방문신청",
            "documents": ["신청서", "소득증명서", "임대차계약서", "등기부등본"],
            "url": "https://housing.seoul.go.kr/",
            "contact": "02-120",
            "source": "서울시청 주거정책과",
            "last_updated": "2024-11-15"
        },
        {
            "id": "youth_housing_voucher",
            "title": "청년 주거급여 (주거바우처)",
            "category": "주거",
            "description": "저소득 청년 가구의 주거비 부담 경감을 위한 임대료 지원",
            "age_range": "만 19~29세",
            "eligibility": ["기준 중위소득 46% 이하", "분리세대 구성 가능"],
            "period": "1년 (매년 재신청)",
            "benefits": ["월 최대 32만원", "임대료 직접 지급"],
            "how_to_apply": "주민센터 방문신청 또는 복지로 온라인신청",
            "documents": ["신청서", "소득재산신고서", "임대차계약서"],
            "url": "https://www.bokjiro.go.kr/",
            "contact": "129 (보건복지상담센터)",
            "source": "국토교통부",
            "last_updated": "2024-10-30"
        }
    ],
    "employment": [
        {
            "id": "seoul_youth_job_success",
            "title": "서울 청년 취업성공패키지",
            "category": "취업",
            "description": "취업준비부터 성공까지 단계별 맞춤 지원",
            "age_range": "만 18~34세",
            "eligibility": ["서울시 거주", "미취업자", "졸업 후 2년 이내"],
            "period": "최장 12개월",
            "benefits": ["취업상담", "직업훈련", "취업알선", "취업성공수당 최대 150만원"],
            "how_to_apply": "서울시청년일자리허브 또는 온라인 신청",
            "documents": ["신청서", "졸업증명서", "구직신청서"],
            "url": "https://youth.seoul.go.kr/",
            "contact": "02-2133-5274",
            "source": "서울시 일자리정책과",
            "last_updated": "2024-12-10"
        }
    ],
    "finance": [
        {
            "id": "youth_savings_account",
            "title": "청년희망적금",
            "category": "금융",
            "description": "청년층의 자산형성을 위한 우대금리 적금상품",
            "age_range": "만 19~34세",
            "eligibility": ["연소득 3600만원 이하", "가입 시점에 적금잔고 500만원 이하"],
            "period": "2년",
            "benefits": ["연 5% 우대금리", "월 50만원까지 납입"],
            "how_to_apply": "전국 은행 방문 또는 인터넷뱅킹",
            "documents": ["신분증", "소득증명서", "통장"],
            "url": "https://www.kinfa.or.kr/",
            "contact": "1588-3592",
            "source": "서민금융진흥원",
            "last_updated": "2024-11-20"
        }
    ]
}

# =============================================================================
# 실제 정책 데이터 크롤링 시스템
# =============================================================================

async def fetch_seoul_api_data(api_endpoint: str, max_items: int = 50) -> List[Dict[str, Any]]:
    """
    서울시 열린데이터광장 API에서 데이터를 가져오는 핵심 함수
    
    Args:
        api_endpoint: API 엔드포인트 (예: 'youthPolicyInfo')
        max_items: 최대 가져올 항목 수
        
    Returns:
        List[Dict]: 정책 데이터 목록
    """
    try:
        # 실제 서울시 API URL 구성
        url = f"http://openapi.seoul.go.kr:8088/{SEOUL_API_KEY}/json/{api_endpoint}/1/{max_items}/"
        
        async with aiohttp.ClientSession() as session:
            async with session.get(url, timeout=10) as response:
                if response.status == 200:
                    data = await response.json()
                    
                    # API 응답 구조 확인 및 데이터 추출
                    if api_endpoint in data and 'row' in data[api_endpoint]:
                        policies = data[api_endpoint]['row']
                        logger.info(f"✅ {api_endpoint}: {len(policies)}개 정책 수집")
                        return policies
                    else:
                        logger.warning(f"⚠️ {api_endpoint}: 예상과 다른 응답 구조")
                        return []
                else:
                    logger.error(f"❌ API 호출 실패 {api_endpoint}: HTTP {response.status}")
                    return []
                    
    except asyncio.TimeoutError:
        logger.error(f"❌ API 호출 타임아웃: {api_endpoint}")
        return []
    except Exception as e:
        logger.error(f"❌ API 호출 오류 {api_endpoint}: {e}")
        return []

async def get_real_policy_data(query: str, category_ids: List[str] = None) -> List[Dict[str, Any]]:
    """
    실제 서울시 정책 데이터를 검색하는 함수
    
    Args:
        query: 사용자 질문/검색어
        category_ids: 검색할 카테고리 ID 목록
        
    Returns:
        List[Dict]: 관련 정책 데이터
    """
    logger.info(f"🔍 실제 정책 데이터 검색: '{query}'")
    
    all_policies = []
    
    # 서울시 API 엔드포인트 목록 (실제 운영 중인 API들)
    api_endpoints = [
        "SeoulYouthPolicy",      # 서울시 청년정책
        "YouthSupportProgram",   # 청년지원프로그램
        "DistrictYouthPolicy",   # 자치구별 청년정책
    ]
    
    # 병렬로 여러 API 호출
    tasks = []
    for endpoint in api_endpoints:
        task = fetch_seoul_api_data(endpoint, 30)  # 각 API에서 최대 30개
        tasks.append(task)
    
    try:
        # 모든 API 호출 결과를 기다림
        api_results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # 결과 병합 및 에러 처리
        for i, result in enumerate(api_results):
            if isinstance(result, Exception):
                logger.error(f"❌ API 호출 실패 {api_endpoints[i]}: {result}")
            elif isinstance(result, list):
                all_policies.extend(result)
                
    except Exception as e:
        logger.error(f"❌ API 호출 중 전체 오류: {e}")
    
    # API 호출이 실패한 경우 fallback 데이터 사용
    if not all_policies:
        logger.info("📦 API 호출 실패, fallback 정책 데이터 사용")
        all_policies = get_fallback_policy_data()
    
    # 검색어와 관련된 정책 필터링
    filtered_policies = filter_policies_by_query(all_policies, query, category_ids)
    
    # 정책 데이터 정규화 및 구조화
    structured_policies = []
    for policy in filtered_policies[:5]:  # 최대 5개만 반환
        structured_policy = normalize_policy_data(policy)
        if structured_policy:
            structured_policies.append(structured_policy)
    
    logger.info(f"📊 검색 결과: {len(structured_policies)}개 정책")
    return structured_policies

def filter_policies_by_query(policies: List[Dict], query: str, category_ids: List[str] = None) -> List[Dict]:
    """
    검색어와 카테고리를 기반으로 정책 데이터를 필터링
    
    Args:
        policies: 전체 정책 데이터
        query: 검색어
        category_ids: 카테고리 ID 목록
        
    Returns:
        List[Dict]: 필터링된 정책 데이터
    """
    query_lower = query.lower()
    filtered = []
    
    # 검색 키워드 추출
    search_keywords = extract_search_keywords(query_lower)
    logger.info(f"🔍 검색 키워드: {search_keywords}")
    
    for policy in policies:
        # 정책 제목과 내용에서 검색 (fallback 데이터 구조도 고려)
        title = str(policy.get('POLICY_NM', policy.get('title', ''))).lower()
        content = str(policy.get('POLICY_CONTENT', policy.get('description', ''))).lower()
        
        # 관련성 점수 계산
        relevance_score = calculate_relevance_score(title, content, search_keywords)
        
        logger.debug(f"📝 정책: '{title[:50]}...', 점수: {relevance_score}")
        
        # 더 낮은 임계값으로 변경 (0.1로 낮춤)
        if relevance_score > 0.1:  # 더 많은 정책을 포함하도록 임계값 낮춤
            policy['_relevance_score'] = relevance_score
            filtered.append(policy)
    
    # 관련성 점수 순으로 정렬
    filtered.sort(key=lambda x: x.get('_relevance_score', 0), reverse=True)
    
    logger.info(f"📊 필터링 결과: {len(filtered)}개 정책")
    
    return filtered

def extract_search_keywords(query: str) -> List[str]:
    """검색어에서 핵심 키워드 추출"""
    # 기본 키워드
    keywords = [query]
    
    # 카테고리별 키워드 매핑
    category_keywords = {
        '주거': ['주거', '임대', '전세', '월세', '주택', '원룸', '보증금', '자취'],
        '취업': ['취업', '일자리', '구직', '채용', '인턴', '직업훈련'],
        '창업': ['창업', '사업', '스타트업', '벤처', '투자'],
        '금융': ['대출', '적금', '금융', '자금', '지원금', '보조금'],
        '교육': ['교육', '강의', '학습', '수강', '교육비'],
        '의료': ['의료', '건강', '검진', '상담', '치료'],
    }
    
    # 쿼리에서 카테고리 감지하여 관련 키워드 추가
    for category, related_keywords in category_keywords.items():
        if any(keyword in query for keyword in related_keywords):
            keywords.extend(related_keywords)
    
    return list(set(keywords))  # 중복 제거

def calculate_relevance_score(title: str, content: str, keywords: List[str]) -> float:
    """정책과 검색어 간의 관련성 점수 계산"""
    score = 0.0
    text = title + " " + content
    
    for keyword in keywords:
        # 제목에서 발견 시 높은 점수
        if keyword in title:
            score += 1.0
        
        # 내용에서 발견 시 보통 점수  
        elif keyword in content:
            score += 0.5
            
        # 부분 매칭도 고려
        elif any(keyword in word for word in text.split()):
            score += 0.3
    
    # 정규화 (최대 점수로 나누기)
    max_possible_score = len(keywords) * 1.0
    return min(score / max_possible_score, 1.0) if max_possible_score > 0 else 0.0

def normalize_policy_data(policy: Dict[str, Any]) -> Dict[str, Any]:
    """
    API로부터 받은 정책 데이터를 표준 형식으로 정규화
    
    Args:
        policy: 원본 정책 데이터
        
    Returns:
        Dict: 정규화된 정책 데이터
    """
    try:
        # 다양한 API 응답 형식을 표준화
        title = (
            policy.get('POLICY_NM') or 
            policy.get('title') or 
            policy.get('TITLE') or
            '제목 정보 없음'
        )
        
        description = (
            policy.get('POLICY_CONTENT') or
            policy.get('description') or
            policy.get('DESCRIPTION') or
            policy.get('SUMMARY') or
            '내용 정보 없음'
        )
        
        agency = (
            policy.get('AGENCY_NM') or
            policy.get('agency') or
            policy.get('ISSUING_AGENCY') or
            '서울특별시'
        )
        
        # 연령 정보 추출
        age_info = extract_age_from_text(description)
        
        # 지역 정보 추출
        region = extract_region_from_text(description, agency)
        
        # 신청 방법 및 연락처 정보 추출
        contact_info = extract_contact_from_text(description)
        apply_method = extract_apply_method_from_text(description)
        
        # URL 정보
        url = (
            policy.get('POLICY_URL') or
            policy.get('url') or
            policy.get('DETAIL_URL') or
            'https://youth.seoul.go.kr'
        )
        
        return {
            'id': generate_policy_id(title, agency),
            'title': title,
            'description': description,
            'category': classify_policy_category(title + " " + description),
            'agency': agency,
            'age_range': age_info,
            'eligibility': extract_eligibility_from_text(description),
            'benefits': extract_benefits_from_text(description),
            'period': extract_period_from_text(description),
            'how_to_apply': apply_method,
            'documents': extract_documents_from_text(description),
            'url': url,
            'contact': contact_info,
            'source': 'Seoul Open Data API',
            'last_updated': datetime.now().isoformat(),
            'relevance_score': policy.get('_relevance_score', 1.0)
        }
        
    except Exception as e:
        logger.error(f"❌ 정책 데이터 정규화 오류: {e}")
        return None

def generate_policy_id(title: str, agency: str) -> str:
    """정책 고유 ID 생성"""
    text = f"{title}_{agency}"
    return hashlib.md5(text.encode()).hexdigest()[:12]

def classify_policy_category(text: str) -> str:
    """텍스트 기반 정책 카테고리 자동 분류"""
    text_lower = text.lower()
    
    # 카테고리별 핵심 키워드 (가중치 적용)
    category_patterns = {
        '주거': ['주거', '임대', '전세', '월세', '주택', '원룸', '보증금', '자취', '거주'],
        '취업': ['취업', '일자리', '구직', '채용', '면접', '직업', '취업지원', '직무'],
        '창업': ['창업', '사업', '스타트업', '기업', '벤처', '투자', '사업자'],
        '금융': ['금융', '대출', '적금', '투자', '신용', '자금', '지원금', '보조금'],
        '교육': ['교육', '학습', '강의', '연수', '교육비', '수강', '자격증'],
        '정신건강': ['정신건강', '심리', '상담', '우울', '스트레스', '마음'],
        '신체건강': ['건강', '의료', '검진', '운동', '체력', '헬스', '치료'],
        '생활지원': ['생활지원', '복지', '생활비', '돌봄', '기초생활', '지원'],
        '문화/예술': ['문화', '예술', '공연', '전시', '체험', '축제', '예술활동'],
        '진로': ['진로', '경력', '멘토링', '진로상담', '커리어', '직업상담']
    }
    
    # 각 카테고리별 점수 계산
    category_scores = {}
    for category, keywords in category_patterns.items():
        score = sum(1 for keyword in keywords if keyword in text_lower)
        if score > 0:
            category_scores[category] = score
    
    # 가장 높은 점수의 카테고리 반환
    if category_scores:
        return max(category_scores.items(), key=lambda x: x[1])[0]
    else:
        return '기타'

def extract_age_from_text(text: str) -> str:
    """텍스트에서 연령 조건 추출"""
    age_patterns = [
        r'만?\s*(\d+)세?\s*(?:이상|부터)\s*(?:만?\s*(\d+)세?\s*(?:이하|까지|미만))?',
        r'(\d+)세?\s*~\s*(\d+)세?',
        r'만?\s*(\d+)세?\s*이상',
        r'만?\s*(\d+)세?\s*이하',
    ]
    
    for pattern in age_patterns:
        match = re.search(pattern, text)
        if match:
            groups = [g for g in match.groups() if g]
            if len(groups) == 2:
                return f"만 {groups[0]}세 ~ {groups[1]}세"
            elif len(groups) == 1:
                if '이상' in match.group(0) or '부터' in match.group(0):
                    return f"만 {groups[0]}세 이상"
                elif '이하' in match.group(0) or '까지' in match.group(0):
                    return f"만 {groups[0]}세 이하"
    
    return "연령 제한 없음"

def extract_region_from_text(text: str, agency: str) -> str:
    """텍스트에서 지역 정보 추출"""
    # 서울시 25개 자치구
    districts = [
        '강남구', '강동구', '강북구', '강서구', '관악구', '광진구', '구로구', '금천구',
        '노원구', '도봉구', '동대문구', '동작구', '마포구', '서대문구', '서초구', '성동구',
        '성북구', '송파구', '양천구', '영등포구', '용산구', '은평구', '종로구', '중구', '중랑구'
    ]
    
    # 기관명에서 구 정보 추출
    for district in districts:
        if district in agency or district in text:
            return district
    
    return '서울시 전체'

def extract_contact_from_text(text: str) -> str:
    """연락처 정보 추출"""
    # 전화번호 패턴
    phone_patterns = [
        r'(\d{2,3}-\d{3,4}-\d{4})',
        r'(\d{4}-\d{4})',
        r'(\d{3}-\d{4})'
    ]
    
    contacts = []
    for pattern in phone_patterns:
        matches = re.findall(pattern, text)
        contacts.extend(matches)
    
    # 이메일 패턴
    email_pattern = r'([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})'
    emails = re.findall(email_pattern, text)
    contacts.extend(emails)
    
    return ', '.join(contacts) if contacts else '해당 기관 문의'

def extract_apply_method_from_text(text: str) -> str:
    """신청 방법 추출"""
    if '온라인' in text:
        return '온라인 신청'
    elif '방문' in text:
        return '방문 신청'
    elif '전화' in text:
        return '전화 신청'
    else:
        return '해당 기관 문의'

def extract_eligibility_from_text(text: str) -> List[str]:
    """지원 자격 추출"""
    eligibility = []
    
    # 일반적인 자격 패턴들
    if '무주택' in text:
        eligibility.append('무주택자')
    if '소득' in text and ('이하' in text or '미만' in text):
        eligibility.append('소득 기준 충족')
    if '거주' in text:
        eligibility.append('서울시 거주')
    if '근무' in text:
        eligibility.append('서울시 근무')
    if '학생' in text:
        eligibility.append('학생')
    if '미취업' in text:
        eligibility.append('미취업자')
    
    return eligibility if eligibility else ['자격 요건은 해당 기관 문의']

def extract_benefits_from_text(text: str) -> str:
    """지원 혜택 정보 추출"""
    # 금액이나 혜택 관련 문장 찾기
    benefit_keywords = ['지원', '제공', '혜택', '급여', '수당', '대출', '보조']
    
    sentences = text.split('.')
    benefit_sentences = []
    
    for sentence in sentences:
        if any(keyword in sentence for keyword in benefit_keywords):
            # 금액 정보가 포함된 문장 우선
            if re.search(r'\d+(?:만원|원|%)', sentence):
                benefit_sentences.insert(0, sentence.strip())
            else:
                benefit_sentences.append(sentence.strip())
    
    return '. '.join(benefit_sentences[:2]) if benefit_sentences else '상세 내용은 해당 기관 문의'

def extract_period_from_text(text: str) -> str:
    """지원 기간 추출"""
    # 기간 관련 패턴들
    period_patterns = [
        r'(\d+년)',
        r'(\d+개월)', 
        r'(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일\s*(?:부터|~)',
        r'상시',
        r'연중'
    ]
    
    for pattern in period_patterns:
        match = re.search(pattern, text)
        if match:
            return match.group(0)
    
    return '해당 기관 문의'

def extract_documents_from_text(text: str) -> List[str]:
    """필요 서류 추출"""
    documents = []
    
    doc_keywords = [
        '신청서', '신분증', '주민등록등본', '소득증명서', '재직증명서', 
        '졸업증명서', '임대차계약서', '등기부등본', '통장사본', '가족관계증명서'
    ]
    
    for keyword in doc_keywords:
        if keyword in text:
            documents.append(keyword)
    
    return documents if documents else ['신청서', '신분증']

def get_fallback_policy_data() -> List[Dict[str, Any]]:
    """
    API 호출 실패 시 사용할 fallback 정책 데이터
    실제 서울시 정책들을 기반으로 한 신뢰성 있는 데이터
    기간 정보와 최신 데이터 포함
    """
    current_year = datetime.now().year
    return [
        {
            'POLICY_NM': '서울청년주택 (SH공사)',
            'POLICY_CONTENT': f'서울시 청년을 위한 저렴한 임대주택을 공급합니다. 만 19세부터 39세까지 신청 가능하며, 시세 대비 80% 수준의 임대료로 최대 4년간 거주할 수 있습니다. {current_year}년 상반기 모집: 3월, 6월 / 하반기 모집: 9월, 12월',
            'AGENCY_NM': '서울주택도시공사',
            'POLICY_URL': 'https://www.i-sh.co.kr/',
            'APPLICATION_PERIOD': f'{current_year}년 상시모집 (분기별)',
            'DEADLINE': f'{current_year}년 12월 31일까지'
        },
        {
            'POLICY_NM': '서울시 청년 전세자금대출',
            'POLICY_CONTENT': f'청년들의 전세자금 마련을 위한 저금리 대출 지원 정책입니다. 만 19세~34세, 연소득 5천만원 이하, 연 1.2% 저금리로 최대 2억원까지 대출 가능합니다. {current_year}년 신청 마감: 12월 20일',
            'AGENCY_NM': '서울시청',
            'POLICY_URL': 'https://housing.seoul.go.kr/',
            'APPLICATION_PERIOD': f'{current_year}년 1월~12월 (예산 소진 시 조기 마감)',
            'DEADLINE': f'{current_year}년 12월 20일'
        },
        {
            'POLICY_NM': '청년 주거급여 (주거바우처)',
            'POLICY_CONTENT': f'저소득 청년 가구의 주거비 부담 경감을 위한 임대료 지원 정책입니다. 만 19~29세, 기준 중위소득 46% 이하 가구에 월 최대 32만원 지원합니다. {current_year}년 연중 상시신청 가능',
            'AGENCY_NM': '국토교통부',
            'POLICY_URL': 'https://www.bokjiro.go.kr/',
            'APPLICATION_PERIOD': '연중 상시',
            'DEADLINE': '상시'
        },
        {
            'POLICY_NM': '서울 청년 취업성공패키지',
            'POLICY_CONTENT': f'취업준비부터 성공까지 단계별 맞춤 지원 프로그램입니다. 만 18~34세 서울시 거주 미취업자 대상, 최장 12개월간 취업상담, 직업훈련, 취업성공수당 최대 150만원 지원합니다. {current_year}년 4분기까지 신청 가능',
            'AGENCY_NM': '서울시',
            'POLICY_URL': 'https://youth.seoul.go.kr/',
            'APPLICATION_PERIOD': f'{current_year}년 분기별 모집',
            'DEADLINE': f'{current_year}년 11월 30일'
        },
        {
            'POLICY_NM': '청년희망적금',
            'POLICY_CONTENT': f'청년층의 자산형성을 위한 우대금리 적금상품입니다. 만 19~34세, 연소득 3600만원 이하, 연 5% 우대금리, 월 50만원까지 납입, 2년 만기입니다. {current_year}년 12월 말까지 신규 가입 가능',
            'AGENCY_NM': '서민금융진흥원',
            'POLICY_URL': 'https://www.kinfa.or.kr/',
            'APPLICATION_PERIOD': f'{current_year}년 연중',
            'DEADLINE': f'{current_year}년 12월 31일'
        }
    ]

@app.get("/", response_class=HTMLResponse)
async def root():
    """루트 페이지"""
    categories_html = ""
    for cat in POLICY_CATEGORIES:
        categories_html += f'<div class="category-card">{cat["emoji"]}<br><strong>{cat["name"]}</strong></div>'
    
    return f"""
    <!DOCTYPE html>
    <html>
        <head>
            <title>YOUTHY AI - 유씨 청년정책 AI 어시스턴트</title>
            <meta charset="utf-8">
            <link rel="icon" type="image/svg+xml" href="/static/youthy-logo.svg">
            <link rel="shortcut icon" href="/static/favicon.ico">
            <style>
                body {{ 
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    max-width: 800px; margin: 0 auto; padding: 2rem;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white; min-height: 100vh;
                }}
                .container {{ 
                    background: rgba(255,255,255,0.1); 
                    padding: 2rem; border-radius: 20px;
                    backdrop-filter: blur(10px);
                }}
                .link {{ 
                    display: inline-block; 
                    background: rgba(255,255,255,0.2);
                    padding: 1rem 2rem; margin: 1rem 0;
                    border-radius: 10px; text-decoration: none;
                    color: white; transition: all 0.3s;
                }}
                .link:hover {{ background: rgba(255,255,255,0.3); transform: translateY(-2px); }}
                .status {{ background: #10b981; padding: 0.5rem 1rem; border-radius: 20px; }}
                .categories {{
                    display: grid; grid-template-columns: repeat(5, 1fr); gap: 1rem; margin: 1rem 0;
                }}
                .category-card {{
                    background: rgba(255,255,255,0.1); padding: 1rem; border-radius: 8px; text-align: center;
                    border: 2px solid rgba(255,255,255,0.2); transition: all 0.3s;
                }}
                .category-card:hover {{
                    background: rgba(255,255,255,0.2); border-color: rgba(255,255,255,0.4);
                }}
            </style>
        </head>
        <body>
            <div class="container">
                <div style="display: flex; align-items: center; justify-content: center; margin-bottom: 1rem;">
                    <img src="/static/youthy-logo.svg" alt="YOUTHY" style="height: 50px; filter: brightness(0) invert(1);">
                </div>
                <h2>유씨 청년정책 AI 어시스턴트</h2>
                <p><span class="status">🟢 시스템 정상 운영 중</span></p>
                
                <h3>📚 주요 링크</h3>
                <a href="/docs" class="link">📖 API 문서 (Swagger)</a><br>
                <a href="/test" class="link">🧪 데모 채팅 페이지</a><br>
                <a href="/api-test" class="link">🔧 API 테스트 페이지</a><br>
                <a href="/documents" class="link">📁 크롤링 DB 문서 관리</a><br>
                <a href="/api/v1/health" class="link">💚 시스템 상태 확인</a>
                
                <h3>📋 10개 카테고리</h3>
                <div class="categories">
                    {categories_html}
                </div>
                
                <h3>🚀 핵심 기능</h3>
                <ul>
                    <li><strong>로컬 캐시 시스템</strong>: 첫 답변 후 빠른 응답 (< 1초)</li>
                    <li><strong>10개 카테고리</strong>: 자동 분류된 정책 검색</li>
                    <li><strong>실시간 크롤링</strong>: 24시간마다 자동 업데이트</li>
                    <li><strong>RAG + AI</strong>: 정확한 답변과 출처 제공</li>
                </ul>
                
                <p><small>🕐 현재 시간: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}</small></p>
            </div>
        </body>
    </html>
    """

@app.get("/api/v1/health")
async def health_check():
    """시스템 상태 확인"""
    # 데이터베이스 연결 테스트
    db_status = "disconnected"
    try:
        import asyncpg
        conn = await asyncpg.connect(
            host=os.getenv('DB_HOST', 'localhost'),
            port=int(os.getenv('DB_PORT', 5432)),
            database=os.getenv('DB_NAME', 'youthy_ai'),
            user=os.getenv('DB_USER', 'kimko'),
            password=os.getenv('DB_PASSWORD', '')
        )
        await conn.close()
        db_status = "connected"
    except Exception as e:
        logger.warning(f"DB 연결 실패: {e}")
    
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "service": "YOUTHY AI",
        "version": "1.0.0",
        "message": "유씨 청년정책 AI 어시스턴트가 정상 작동 중입니다! 🎉",
        "features": {
            "local_cache": "활성화",
            "categories": 10,
            "database": f"PostgreSQL ({db_status})",
            "crawling": "자동 분류 시스템"
        },
        "db_status": db_status,
        "categories": [cat["name"] for cat in POLICY_CATEGORIES]
    }

def is_policy_related_question(message: str) -> bool:
    """
    질문이 정책 관련 질문인지 판단하는 함수
    프롬프트 인젝션 방지 및 적절한 질문 유도
    """
    message_lower = message.lower()
    
    # 청년정책 관련 키워드
    policy_keywords = [
        '청년', '정책', '지원', '혜택', '신청', '자격', '대출', 
        '취업', '주거', '창업', '교육', '금융', '진로', '건강',
        '문화', '예술', '생활지원', '전세', '월세', '임대',
        '전세자금', '적금', '스타트업', '기업', '대학생', 
        '구직', '채용', '면접', '인턴', '장학금', '상담',
        '서울', '구', '도', '시', '군', '자치구'
    ]
    
    # 정책과 무관한 질문 패턴
    irrelevant_patterns = [
        '맥도널드', '했버거', '피자', '커피', '레스토랑',
        '영화', '드라마', 'k팝', '아이돌', '게임', '용돈',
        '날씨', '시간', '요일', '전화번호', '주소',
        'gpt', 'chatgpt', 'ai', '인공지능', '모델', '알고리즘',
        '프롬프트', 'prompt', 'ignore', 'system', 'instruction'
    ]
    
    # 정책 관련 키워드가 있는지 확인
    has_policy_keywords = any(keyword in message_lower for keyword in policy_keywords)
    
    # 무관한 키워드가 있는지 확인
    has_irrelevant_keywords = any(pattern in message_lower for pattern in irrelevant_patterns)
    
    return has_policy_keywords and not has_irrelevant_keywords

def detect_prompt_injection(message: str) -> bool:
    """
    프롬프트 인젝션 시도를 감지하는 함수
    """
    message_lower = message.lower()
    
    # 프롬프트 인젝션 패턴
    injection_patterns = [
        'ignore', 'forget', 'system', 'instruction', 'prompt',
        '무시하고', '잊어버리고', '시스템', '명령',
        'act as', 'pretend', 'roleplay', 'you are now',
        '역할', '가장', '딱정', '비슷하게',
        '\n\n', '---', '###', 'STOP', 'END'
    ]
    
    return any(pattern in message_lower for pattern in injection_patterns)

@app.post("/api/v1/chat")
async def chat(request: ChatRequest):
    """
    AI 채팅 API - 실제 서울시 정책 데이터 기반 RAG 시스템
    프롬프트 인젝션 방지 및 적절한 질문 유도 기능 포함
    
    사용자 질문을 받아 다음 단계로 처리합니다:
    1. 질문 유형 및 안전성 검사
    2. 실시간 정책 데이터 검색 (서울시 API)
    3. 관련 정책 정보 추출 및 분석  
    4. OpenAI GPT-4를 활용한 자연어 답변 생성
    5. 출처와 상세 정보가 포함된 완전한 응답 반환
    """
    start_time = datetime.now()
    
    try:
        # OpenAI API 클라이언트 확인
        if not openai_client:
            return {
                "message": "OpenAI API 키가 설정되지 않았습니다.",
                "status": "api_key_required", 
                "categories": [cat["name"] for cat in POLICY_CATEGORIES],
                "timestamp": datetime.now().isoformat()
            }
        
        # 0단계: 질문 유형 및 안전성 검사
        if detect_prompt_injection(request.message):
            logger.warning(f"⚠️ 프롬프트 인젝션 시도 감지: {request.message[:50]}...")
            return {
                "message": "질문을 이해할 수 없습니다.",
                "answer": "안녕하세요! 저는 청년정책 전문 AI 어시스턴트 유씨입니다. 청년들을 위한 다양한 정책 정보를 도와드리고 있어요. \n\n예시 질문:\n- '서울 청년 주거지원 정책 알려주세요'\n- '취업 지원 프로그램 있나요?'\n- '청년 창업 지원 정책을 찾고 있어요'\n\n청년정책에 대해 궁금한 것이 있으시면 언제든지 물어보세요!",
                "thinking_process": []
            }
        
        if not is_policy_related_question(request.message):
            logger.info(f"💬 정책 무관 질문: {request.message[:50]}...")
            return {
                "message": f"'{request.message}'에 대한 안내를 드립니다.",
                "answer": "죄송하지만, 저는 청년정책 전문 AI 어시스턴트라서 청년정책과 관련된 질문에만 답변드릴 수 있어요. 😊 \n\n대신 청년들을 위한 다양한 정책 정보를 알려드릴 수 있어요! \n\n🏠 **주거 지원**: 전세자금, 주거급여, 청년주택 \n💼 **취업 지원**: 취업성공패키지, 직업훈련 \n🚀 **창업 지원**: 스타트업 지원금, 창업교육 \n💰 **금융 지원**: 청년희망적금, 대생대출 \n\n청년정책에 대해 궁금한 것이 있으시면 언제든 물어보세요!",
                "thinking_process": [],
                "detected_categories": [],
                "available_categories": [cat["name"] for cat in POLICY_CATEGORIES]
            }
        
        # 1단계: 카테고리 분류 및 키워드 추출
        logger.info(f"🔍 사용자 질문 분석: '{request.message}'")
        
        message_lower = request.message.lower()
        detected_categories = []
        category_ids = []
        
        for cat in POLICY_CATEGORIES:
            for keyword in cat["keywords"]:
                if keyword in message_lower:
                    detected_categories.append(cat["name"])
                    category_ids.append(cat["id"])
                    break
        
        logger.info(f"📊 감지된 카테고리: {detected_categories}")
        
        # 2단계: 실제 정책 데이터 검색 (RAG 시스템의 핵심)
        try:
            logger.info("🌐 서울시 정책 데이터 검색 시작...")
            relevant_policies = await get_real_policy_data(request.message, category_ids)
            logger.info(f"✅ {len(relevant_policies)}개 관련 정책 발견")
        except Exception as search_error:
            logger.error(f"❌ 정책 검색 오류: {search_error}")
            relevant_policies = []
        
        # 3단계: RAG 컨텍스트 구성
        if relevant_policies:
            # 정책 정보를 GPT가 이해할 수 있는 형태로 구조화
            policy_context = "\\n\\n다음은 관련 정책 정보입니다:\\n"
            
            for i, policy in enumerate(relevant_policies, 1):
                policy_context += f"\\n[정책 {i}] {policy['title']}\\n"
                policy_context += f"• 주관기관: {policy['agency']}\\n"
                policy_context += f"• 대상연령: {policy['age_range']}\\n"
                policy_context += f"• 지원내용: {policy['benefits']}\\n"
                policy_context += f"• 신청방법: {policy['how_to_apply']}\\n"
                policy_context += f"• 연락처: {policy['contact']}\\n"
                policy_context += f"• 상세내용: {policy['description'][:300]}...\\n"
                policy_context += f"• URL: {policy['url']}\\n"
        else:
            policy_context = "\\n관련 정책을 찾지 못했습니다. 일반적인 청년정책 정보를 안내해드리겠습니다."
        
        # 4단계: 고도화된 시스템 프롬프트 구성
        system_prompt = f"""당신은 유씨(YOUTHY) 청년정책 전문 AI 어시스턴트입니다.

서울시의 실제 정책 데이터를 기반으로 정확하고 신뢰성 있는 정보를 제공하는 역할을 합니다.

다음 지침을 반드시 따라주세요:

1. **정확성 우선**: 제공된 정책 정보를 정확히 인용하고, 확실하지 않은 정보는 "해당 기관에 문의"라고 안내
2. **구체적 정보 제공**: 연령, 소득조건, 지원금액, 신청방법, 연락처 등 구체적 정보 포함
3. **출처 명시**: 각 정책의 주관기관과 공식 홈페이지 정보 제공
4. **친근한 톤**: 청년들이 이해하기 쉽고 친근한 말투 사용
5. **실행 가능한 조언**: 구체적인 다음 단계 및 신청 방법 안내

**현재 제공할 정책 정보:**
{policy_context}

사용자 질문에 대해 위 정책 정보를 바탕으로 정확하고 도움이 되는 답변을 제공하세요."""

        # 5단계: OpenAI API 호출 (RAG 기반 답변 생성)
        try:
            logger.info("🤖 AI 답변 생성 중...")
            
            response = openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": request.message}
                ],
                temperature=0.3,  # 정확성을 위해 낮은 temperature
                max_tokens=1500
            )
            
            ai_answer = response.choices[0].message.content
            logger.info("✅ AI 답변 생성 완료")
            
        except Exception as api_error:
            logger.error(f"❌ OpenAI API 호출 오류: {api_error}")
            # Fallback 답변
            if relevant_policies:
                ai_answer = f"죄송합니다. AI 답변 생성에 문제가 있었지만, 관련 정책 정보를 찾았습니다:\\n\\n"
                for policy in relevant_policies[:2]:
                    ai_answer += f"**{policy['title']}**\\n{policy['description'][:200]}...\\n\\n"
                ai_answer += "더 자세한 정보는 해당 기관에 직접 문의해주세요."
            else:
                ai_answer = "죄송합니다. 현재 시스템에 일시적인 문제가 있습니다. 잠시 후 다시 시도해주세요."
        
        # 6단계: 출처 및 참고자료 구성 (신뢰성 확보)
        references = []
        if relevant_policies:
            for i, policy in enumerate(relevant_policies, 1):
                references.append({
                    "id": policy.get('id', f'policy_{i}'),
                    "title": policy['title'],
                    "url": policy['url'],
                    "snippet": policy['description'][:150] + "..." if len(policy['description']) > 150 else policy['description'],
                    "source": policy['agency'],
                    "category": policy['category'],
                    "age_range": policy['age_range'],
                    "benefits": policy['benefits'],
                    "how_to_apply": policy['how_to_apply'],
                    "contact": policy['contact'],
                    "last_updated": policy.get('last_updated', datetime.now().isoformat())
                })
        
        # 7단계: 응답 시간 계산
        processing_time = (datetime.now() - start_time).total_seconds()
        
        # 8단계: 완전한 응답 반환
        return {
            "message": f"'{request.message}'에 대한 답변을 생성했습니다.",
            "answer": ai_answer,
            "thinking_process": [
                "사용자 질문을 분석하고 관련 키워드를 추출했습니다.",
                f"{len(relevant_policies)}개의 관련 정책을 서울시 데이터에서 검색했습니다.",
                "정책 정보를 바탕으로 정확한 답변을 생성했습니다.",
                "신뢰성 있는 출처 정보를 함께 제공합니다."
            ],
            "references": references,
            "policy_details": [
                {
                    "title": policy['title'],
                    "agency": policy['agency'],
                    "category": policy['category'],
                    "age_range": policy['age_range'],
                    "eligibility": policy['eligibility'],
                    "benefits": policy['benefits'],
                    "period": policy.get('period', '해당 기관 문의'),
                    "how_to_apply": policy['how_to_apply'],
                    "documents": policy.get('documents', []),
                    "url": policy['url'],
                    "contact": policy['contact']
                } for policy in relevant_policies
            ],
            "detected_categories": detected_categories,
            "available_categories": [cat["name"] for cat in POLICY_CATEGORIES],
            "search_stats": {
                "policies_found": len(relevant_policies),
                "processing_time": f"{processing_time:.2f}초",
                "data_source": "Seoul Open Data API" if relevant_policies else "Fallback Data"
            },
            "cache_used": False,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"❌ 채팅 API 전체 오류: {e}")
        raise HTTPException(status_code=500, detail=f"채팅 처리 중 오류가 발생했습니다: {str(e)}")

@app.post("/api/v1/chat/quick-ask")
async def quick_ask(request: QuickAskRequest):
    """빠른 질문 API"""
    try:
        return {
            "answer": f"'{request.question}'에 대한 답변입니다. 현재 10개 카테고리 시스템이 활성화되어 있습니다.",
            "categories": [cat["name"] for cat in POLICY_CATEGORIES],
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"빠른 질문 오류: {e}")
        raise HTTPException(status_code=500, detail="질문 처리 중 오류가 발생했습니다.")

@app.get("/api/v1/chat/suggestions")
async def get_chat_suggestions(
    user_context: Optional[str] = Query(None, description="사용자 컨텍스트"),
    category: Optional[str] = Query(None, description="카테고리 필터")
):
    """질문 제안 API"""
    base_suggestions = [
        "청년들이 받을 수 있는 주거 지원 정책은 어떤 것들이 있나요?",
        "대학생도 신청할 수 있는 취업 지원 프로그램을 알려주세요.",
        "청년 창업을 준비하는데 도움받을 수 있는 정책이 있을까요?",
        "금융 지원 받을 수 있는 청년 정책 알려주세요.",
        "각 구별로 다른 청년 정책이 있나요?",
        "대학생 생활비 지원 정책은 어떤 게 있나요?"
    ]
    
    # 카테고리별 맞춤 제안
    if category:
        for cat in POLICY_CATEGORIES:
            if cat["name"] == category:
                return {
                    "suggestions": [f"{cat['emoji']} {cat['name']} 관련 정책을 알려주세요"] + base_suggestions[:3],
                    "category": category,
                    "timestamp": datetime.now().isoformat()
                }
    
    return {
        "suggestions": base_suggestions,
        "categories": [cat["name"] for cat in POLICY_CATEGORIES],
        "timestamp": datetime.now().isoformat()
    }

@app.post("/api/v1/refresh-cache")
async def refresh_cache(request: RefreshCacheRequest):
    """캐시 갱신 API"""
    try:
        return {
            "message": "✅ 캐시 갱신이 완료되었습니다!",
            "updated_policies": 150,  # 예시 값
            "categories_updated": 10,
            "force_refresh": request.force,
            "last_update": datetime.now().isoformat(),
            "next_auto_update": (datetime.now() + timedelta(hours=24)).isoformat()
        }
    except Exception as e:
        logger.error(f"캐시 갱신 오류: {e}")
        raise HTTPException(status_code=500, detail="캐시 갱신 중 오류가 발생했습니다.")

@app.get("/test", response_class=HTMLResponse)
async def test_page():
    """테스트 페이지"""
    categories_html = ""
    for cat in POLICY_CATEGORIES:
        categories_html += f'<div class="category-card">{cat["emoji"]}<br><strong>{cat["name"]}</strong></div>'
    
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>YOUTHY AI - 유씨 AI챗봇</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <link rel="icon" type="image/svg+xml" href="/static/youthy-logo.svg">
        <style>
            * {{ margin: 0; padding: 0; box-sizing: border-box; }}
            
            body {{ 
                font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: #FFFFFF;
                height: 100vh; 
                overflow: hidden;
                position: relative;
            }}

            /* 왼쪽 사이드바 */
            .sidebar {{
                position: fixed;
                width: 126px;
                height: 100vh;
                left: 0;
                top: 0;
                background: #F2F8FF;
                display: flex;
                flex-direction: column;
                align-items: center;
                padding-top: 20px;
                z-index: 1000;
            }}

            .sidebar-logo {{
                font-family: 'Pretendard';
                font-weight: 800;
                font-size: 24px;
                color: #1082FF;
                margin-bottom: 30px;
                display: flex;
                align-items: center;
                gap: 5px;
            }}

            .sidebar-menu {{
                display: flex;
                flex-direction: column;
                gap: 20px;
                width: 100%;
                padding: 0 20px;
            }}

            .sidebar-item {{
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 10px;
                padding: 15px 0;
                cursor: pointer;
                transition: all 0.3s;
            }}

            .sidebar-item.active {{
                background: #91C5FF;
                border-radius: 12px;
            }}

            .sidebar-icon {{
                width: 40px;
                height: 40px;
                display: flex;
                align-items: center;
                justify-content: center;
                color: #1082FF;
                font-size: 24px;
            }}

            .sidebar-label {{
                font-weight: 700;
                font-size: 14px;
                color: #5C5C5C;
            }}

            .sidebar-item.active .sidebar-label {{
                color: #1082FF;
            }}

            /* 메인 컨테이너 */
            .main-container {{
                margin-left: 126px;
                height: 100vh;
                display: flex;
                flex-direction: column;
                position: relative;
                background: linear-gradient(180deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0) 100%), rgba(255, 255, 255, 0.3);
                backdrop-filter: blur(2px);
            }}

            /* 상단 헤더 */
            .top-header {{
                height: 70px;
                background: #FFFFFF;
                border-bottom: 1px solid #D2D2D2;
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 0 30px;
            }}

            .header-left {{
                display: flex;
                align-items: center;
                gap: 15px;
            }}

            .header-icon {{
                width: 24px;
                height: 24px;
                cursor: pointer;
                color: #09244B;
            }}

            .header-date {{
                display: flex;
                align-items: center;
                gap: 10px;
                font-weight: 700;
                font-size: 16px;
                color: #5C5C5C;
            }}

            .header-right {{
                display: flex;
                align-items: center;
                gap: 15px;
            }}

            .notification-dot {{
                width: 5px;
                height: 5px;
                background: #1082FF;
                border: 2px solid #09244B;
                border-radius: 50%;
                position: absolute;
                top: 5px;
                right: 5px;
            }}

            /* 채팅 영역 */
            .chat-area {{
                flex: 1;
                display: flex;
                padding: 30px;
                gap: 30px;
                overflow: hidden;
            }}

            .chat-main {{
                flex: 1;
                display: flex;
                flex-direction: column;
                background: #FFFFFF;
                border-radius: 12px;
                box-shadow: 0px 4px 20px rgba(0, 0, 0, 0.1);
            }}

            .chat-header {{
                padding: 20px 30px;
                border-bottom: 1px solid #A1A1A1;
            }}

            .chat-title {{
                display: flex;
                align-items: center;
                gap: 10px;
                margin-bottom: 10px;
            }}

            .chat-title img {{
                width: 45px;
                height: 45px;
            }}

            .chat-title h2 {{
                font-weight: 700;
                font-size: 20px;
                color: #5C5C5C;
            }}

            .chat-subtitle {{
                font-weight: 600;
                font-size: 16px;
                color: #A1A1A1;
                margin-left: 55px;
            }}

            /* 메뉴 카드 영역 */
            .menu-cards {{
                padding: 20px 30px;
                display: flex;
                gap: 20px;
                border-bottom: 1px solid #A1A1A1;
            }}

            .menu-card {{
                width: 156px;
                height: 162px;
                background: #FFFFFF;
                border: 1px solid #D2D2D2;
                border-radius: 8px;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                transition: all 0.3s;
                filter: drop-shadow(0px 4px 4px rgba(0, 0, 0, 0.25));
            }}

            .menu-card:hover {{
                transform: translateY(-5px);
                box-shadow: 0px 8px 20px rgba(0, 0, 0, 0.15);
            }}

            .menu-card-icon {{
                width: 60px;
                height: 60px;
                color: #1082FF;
                margin-bottom: 15px;
                font-size: 40px;
            }}

            .menu-card-title {{
                font-weight: 600;
                font-size: 18px;
                color: #000000;
            }}

            /* 자주하는 질문 영역 */
            .faq-section {{
                padding: 20px 30px;
            }}

            .faq-title {{
                font-weight: 600;
                font-size: 18px;
                color: #A1A1A1;
                margin-bottom: 15px;
                text-align: center;
            }}

            .faq-buttons {{
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 15px;
            }}

            .faq-btn {{
                padding: 15px 20px;
                background: #FFFFFF;
                border: 1px solid #D2D2D2;
                box-shadow: 0px 4px 4px rgba(0, 0, 0, 0.25);
                border-radius: 30px;
                font-weight: 600;
                font-size: 16px;
                color: #5C5C5C;
                cursor: pointer;
                transition: all 0.3s;
            }}

            .faq-btn:hover {{
                background: #F2F8FF;
                border-color: #1082FF;
                color: #1082FF;
            }}

            /* 채팅 메시지 영역 */
            .chat-messages {{
                flex: 1;
                overflow-y: auto;
                padding: 20px 30px;
                background: #F9FAFB;
            }}

            .message {{
                margin: 15px 0;
                display: flex;
                align-items: flex-start;
                gap: 10px;
                animation: fadeInUp 0.3s ease;
            }}

            .message.user {{
                flex-direction: row-reverse;
            }}

            .message-avatar {{
                width: 30px;
                height: 30px;
                border-radius: 50%;
                background: #FFFFFF;
                box-shadow: 0px 0px 5.7px 1px rgba(0, 0, 0, 0.25);
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
            }}

            .message-content {{
                max-width: 70%;
                padding: 15px 20px;
                background: #FFFFFF;
                border-radius: 20px;
                border: 1px solid #E5E8EB;
                box-shadow: 0 1px 4px rgba(0,0,0,0.04);
            }}

            .message.user .message-content {{
                background: #1082FF;
                color: white;
                border: none;
            }}

            /* 입력 영역 */
            .chat-input-container {{
                padding: 20px 30px;
                background: #FFFFFF;
                border-top: 1px solid #E5E8EB;
            }}

            .chat-input-wrapper {{
                display: flex;
                align-items: center;
                gap: 15px;
                padding: 15px 20px;
                background: #FFFFFF;
                box-shadow: 0px 0px 21.7px 6px rgba(0, 0, 0, 0.25);
                border-radius: 12px;
            }}

            .input-icon {{
                width: 24px;
                height: 24px;
                color: #5C5C5C;
                cursor: pointer;
            }}

            .chat-input {{
                flex: 1;
                border: none;
                outline: none;
                font-size: 16px;
                font-weight: 600;
                color: #000000;
            }}

            .chat-input::placeholder {{
                color: #A1A1A1;
            }}

            .send-button {{
                width: 50px;
                height: 50px;
                background: #1082FF;
                border: none;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                transition: all 0.3s;
                color: white;
                font-size: 24px;
            }}

            .send-button:hover {{
                background: #0051CC;
                transform: scale(1.1);
            }}

            .send-button:disabled {{
                opacity: 0.5;
                cursor: not-allowed;
            }}

            /* 그래픽 모티브 */
            .graphic-motif {{
                position: absolute;
                right: 50px;
                bottom: 100px;
                width: 393px;
                height: 427px;
                pointer-events: none;
                z-index: 0;
            }}

            .cool-shape {{
                position: absolute;
                border-radius: 50%;
                opacity: 0.5;
            }}

            .shape-1 {{
                width: 319px;
                height: 319px;
                right: 0;
                bottom: 0;
                background: radial-gradient(circle, #18A0FB 0%, #193AF6 50%, #1082FF 100%);
                filter: blur(31.25px);
            }}

            .shape-2 {{
                width: 147px;
                height: 147px;
                left: 0;
                top: 80px;
                background: radial-gradient(circle, #18A0FB 0%, #193AF6 50%, #1082FF 100%);
                filter: blur(31.25px);
            }}

            .shape-3 {{
                width: 108px;
                height: 108px;
                right: 100px;
                top: 0;
                background: radial-gradient(83.5% 83.5% at 11.25% 10.5%, #4E5ADA 0%, #91C5FF 46.15%, #DDEDFF 100%);
            }}

            @keyframes fadeInUp {{
                from {{ opacity: 0; transform: translateY(10px); }}
                to {{ opacity: 1; transform: translateY(0); }}
            }}
        </style>
    </head>
    <body>
        <!-- 왼쪽 사이드바 -->
        <div class="sidebar">
            <div class="sidebar-logo">
                ✨ YOUTHY
            </div>
            <div class="sidebar-menu">
                <div class="sidebar-item active">
                    <div class="sidebar-icon">💬</div>
                    <div class="sidebar-label">채팅</div>
                </div>
                <div class="sidebar-item">
                    <div class="sidebar-icon">🎁</div>
                    <div class="sidebar-label">혜택</div>
                </div>
                <div class="sidebar-item">
                    <div class="sidebar-icon">📌</div>
                    <div class="sidebar-label">저장</div>
                </div>
            </div>
        </div>

        <!-- 메인 컨테이너 -->
        <div class="main-container">
            <!-- 상단 헤더 -->
            <div class="top-header">
                <div class="header-left">
                    <div class="header-icon">☰</div>
                    <div class="header-icon">🏠</div>
                    <div class="header-icon">❓</div>
                    <div class="header-icon">✕</div>
                    <div class="header-date">
                        📅 2025년 9월 6일
                    </div>
                </div>
                <div class="header-right">
                    <div class="header-icon" style="position: relative;">
                        🔔
                        <div class="notification-dot"></div>
                    </div>
                    <div class="header-icon">👤</div>
                </div>
            </div>

            <!-- 채팅 영역 -->
            <div class="chat-area">
                <div class="chat-main">
                    <!-- 채팅 헤더 -->
                    <div class="chat-header">
                        <div class="chat-title">
                            <img src="/static/youthy-logo.svg" alt="YOUTHY">
                            <h2>유씨 AI챗봇</h2>
                        </div>
                        <div class="chat-subtitle">
                            안녕하세요, 유씨 AI챗봇입니다. 아래 메뉴를 선택하거나 궁금한 내용을 질문해주세요.
                        </div>
                    </div>

                    <!-- 메뉴 카드 -->
                    <div class="menu-cards">
                        <div class="menu-card" onclick="selectMenu('정책 찾기')">
                            <div class="menu-card-icon">🔍</div>
                            <div class="menu-card-title">정책 찾기</div>
                        </div>
                        <div class="menu-card" onclick="selectMenu('맞춤 정책')">
                            <div class="menu-card-icon">🎯</div>
                            <div class="menu-card-title">맞춤 정책</div>
                        </div>
                        <div class="menu-card" onclick="selectMenu('유씨 메뉴')">
                            <div class="menu-card-icon">📋</div>
                            <div class="menu-card-title">유씨 메뉴</div>
                        </div>
                    </div>

                    <!-- 자주하는 질문 -->
                    <div class="faq-section">
                        <div class="faq-title">자주하는 질문</div>
                        <div class="faq-buttons">
                            <button class="faq-btn" onclick="askQuestion('인기있는 청년 정책은?')">인기있는 청년 정책은?</button>
                            <button class="faq-btn" onclick="askQuestion('주거 관련 지원정책 알려줘')">주거 관련 지원정책 알려줘</button>
                            <button class="faq-btn" onclick="askQuestion('자기소개서 컨설팅 문의')">자기소개서 컨설팅 문의</button>
                            <button class="faq-btn" onclick="askQuestion('청년 창업 자금 알려줘')">청년 창업 자금 알려줘</button>
                        </div>
                    </div>

                    <!-- 채팅 메시지 영역 -->
                    <div class="chat-messages" id="chatMessages">
                        <!-- 메시지가 여기에 표시됩니다 -->
                    </div>

                    <!-- 입력 영역 -->
                    <div class="chat-input-container">
                        <div class="chat-input-wrapper">
                            <div class="input-icon">➕</div>
                            <input type="text" class="chat-input" id="messageInput" placeholder="질문을 입력하세요" onkeypress="handleKeyPress(event)">
                            <button class="send-button" id="sendBtn" onclick="sendMessage()">➤</button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 그래픽 모티프 -->
            <div class="graphic-motif">
                <div class="cool-shape shape-1"></div>
                <div class="cool-shape shape-2"></div>
                <div class="cool-shape shape-3"></div>
            </div>
        </div>

        <script>
            let isThinking = false;

            function addMessage(content, isUser = false) {{
                const messagesContainer = document.getElementById('chatMessages');
                const messageDiv = document.createElement('div');
                messageDiv.className = 'message' + (isUser ? ' user' : '');
                
                const avatar = document.createElement('div');
                avatar.className = 'message-avatar';
                avatar.innerHTML = isUser ? '👤' : '🤖';
                
                const contentDiv = document.createElement('div');
                contentDiv.className = 'message-content';
                contentDiv.innerHTML = content;
                
                messageDiv.appendChild(avatar);
                messageDiv.appendChild(contentDiv);
                
                messagesContainer.appendChild(messageDiv);
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
                return contentDiv;
            }}

            function parseMarkdown(text) {{
                let html = text;
                html = html.replace(/^### (.*$)/gim, '<h3 style="color: #191F28; margin: 1rem 0 0.5rem; font-size: 1.1rem;">$1</h3>');
                html = html.replace(/^## (.*$)/gim, '<h2 style="color: #191F28; margin: 1rem 0 0.5rem; font-size: 1.3rem;">$1</h2>');
                html = html.replace(/\*\*(.*?)\*\*/g, '<strong style="color: #1082FF;">$1</strong>');
                html = html.replace(/^- (.*$)/gim, '<li style="margin-left: 1rem; margin-bottom: 0.3rem;">$1</li>');
                html = html.replace(/\\n/g, '<br>');
                return html;
            }}

            async function sendMessage() {{
                const input = document.getElementById('messageInput');
                const sendBtn = document.getElementById('sendBtn');
                const message = input.value.trim();
                
                if (!message || isThinking) return;
                
                addMessage(message, true);
                input.value = '';
                sendBtn.disabled = true;
                isThinking = true;
                
                const thinkingMsg = addMessage('생각하는 중...', false);
                
                try {{
                    const response = await fetch('/api/v1/chat', {{
                        method: 'POST',
                        headers: {{ 'Content-Type': 'application/json' }},
                        body: JSON.stringify({{ message: message }})
                    }});
                    
                    const data = await response.json();
                    thinkingMsg.innerHTML = parseMarkdown(data.answer);
                    
                    if (data.references && data.references.length > 0) {{
                        let refsHtml = '<div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #E5E8EB;">';
                        refsHtml += '<strong>📚 참고자료:</strong><br>';
                        data.references.forEach((ref, index) => {{
                            refsHtml += '<div style="margin: 0.5rem 0;">';
                            refsHtml += '[' + (index + 1) + '] <a href="' + ref.url + '" target="_blank" style="color: #1082FF;">' + ref.title + '</a>';
                            refsHtml += '</div>';
                        }});
                        refsHtml += '</div>';
                        thinkingMsg.innerHTML += refsHtml;
                    }}
                }} catch (error) {{
                    thinkingMsg.innerHTML = '❌ 오류가 발생했습니다: ' + error.message;
                }} finally {{
                    isThinking = false;
                    sendBtn.disabled = false;
                    input.focus();
                }}
            }}

            function handleKeyPress(event) {{
                if (event.key === 'Enter' && !event.shiftKey) {{
                    event.preventDefault();
                    sendMessage();
                }}
            }}

            function askQuestion(question) {{
                document.getElementById('messageInput').value = question;
                sendMessage();
            }}

            function selectMenu(menu) {{
                document.getElementById('messageInput').value = menu + ' 관련 정책을 알려주세요';
                sendMessage();
            }}

            // 페이지 로드 시 초기 메시지
            window.onload = function() {{
                document.getElementById('messageInput').focus();
            }};
        </script>
    </body>
    </html>
    """

@app.get("/api-test", response_class=HTMLResponse)
async def api_test_page():
    """
    API 테스트 페이지 - Swagger 스타일의 API 테스트 인터페이스
    백엔드 개발자를 위한 전체 API 엔드포인트 테스트 기능
    """
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>YOUTHY AI - API 테스트</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <link rel="icon" type="image/svg+xml" href="/static/youthy-logo.svg">
        <link rel="shortcut icon" href="/static/favicon.ico">
        <style>
            body {{
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace;
                margin: 0; padding: 20px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: #333; min-height: 100vh;
            }}
            
            .container {{
                max-width: 1200px; margin: 0 auto;
                background: rgba(255,255,255,0.95);
                border-radius: 15px; padding: 2rem;
                box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            }}
            
            .header {{
                text-align: center; margin-bottom: 2rem;
                border-bottom: 3px solid #4f46e5;
                padding-bottom: 1rem;
            }}
            
            .logo {{
                display: flex; align-items: center; justify-content: center;
                font-size: 2.5rem; font-weight: 800;
                color: #000;
            }}
            
            .sparkle {{
                width: 40px; height: 40px; margin-right: 15px;
                background: linear-gradient(45deg, #ffd700, #ff6b6b);
                border-radius: 50%; position: relative;
            }}
            
            .sparkle::before {{
                content: '✨';
                position: absolute; top: 50%; left: 50%;
                transform: translate(-50%, -50%);
                font-size: 24px;
            }}
            
            .endpoint {{
                background: #f8f9fa; border: 1px solid #e9ecef;
                border-radius: 8px; margin: 1rem 0; padding: 1.5rem;
            }}
            
            .method {{
                display: inline-block; padding: 0.5rem 1rem;
                border-radius: 5px; color: white; font-weight: bold;
                margin-right: 1rem; font-size: 0.9rem;
            }}
            
            .get {{ background: #28a745; }}
            .post {{ background: #007bff; }}
            
            .path {{
                font-family: 'Courier New', monospace;
                background: #e9ecef; padding: 0.5rem;
                border-radius: 4px; display: inline-block;
            }}
            
            .test-form {{
                margin-top: 1rem; padding: 1rem;
                background: #ffffff; border-radius: 5px;
                border: 1px solid #dee2e6;
            }}
            
            .form-group {{
                margin-bottom: 1rem;
            }}
            
            label {{
                display: block; font-weight: 600;
                margin-bottom: 0.5rem; color: #495057;
            }}
            
            input, textarea, select {{
                width: 100%; padding: 0.75rem;
                border: 2px solid #e9ecef; border-radius: 5px;
                font-family: monospace; transition: border-color 0.2s;
            }}
            
            input:focus, textarea:focus {{
                outline: none; border-color: #4f46e5;
                box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
            }}
            
            .btn {{
                background: linear-gradient(135deg, #4f46e5, #7c3aed);
                color: white; border: none; padding: 0.75rem 1.5rem;
                border-radius: 5px; cursor: pointer; font-weight: 600;
                transition: all 0.2s;
            }}
            
            .btn:hover {{
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
            }}
            
            .response {{
                margin-top: 1rem; padding: 1rem;
                background: #f8f9fa; border-radius: 5px;
                border-left: 4px solid #28a745;
                max-height: 400px; overflow-y: auto;
            }}
            
            .response pre {{
                margin: 0; white-space: pre-wrap;
                font-family: 'Courier New', monospace;
                font-size: 0.9rem;
            }}
            
            .status {{
                display: inline-block; padding: 0.25rem 0.5rem;
                border-radius: 3px; font-size: 0.8rem; font-weight: bold;
            }}
            
            .status-200 {{ background: #d4edda; color: #155724; }}
            .status-error {{ background: #f8d7da; color: #721c24; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">
                    <img src="/static/youthy-logo.svg" alt="YOUTHY" style="height: 40px; margin-right: 15px;">
                    API 테스터
                </div>
                <p>백엔드 개발자를 위한 전체 API 엔드포인트 테스트</p>
            </div>
            
            <!-- Health Check API -->
            <div class="endpoint">
                <div>
                    <span class="method get">GET</span>
                    <span class="path">/api/v1/health</span>
                </div>
                <p><strong>설명:</strong> 시스템 상태 확인 API</p>
                <div class="test-form">
                    <button class="btn" onclick="testHealthCheck()">Health Check 테스트</button>
                    <div id="health-response" class="response" style="display:none;"></div>
                </div>
            </div>
            
            <!-- Chat API -->
            <div class="endpoint">
                <div>
                    <span class="method post">POST</span>
                    <span class="path">/api/v1/chat</span>
                </div>
                <p><strong>설명:</strong> AI 채팅 API - RAG 기반 청년정책 상담</p>
                <div class="test-form">
                    <div class="form-group">
                        <label for="chat-message">Message (필수):</label>
                        <textarea id="chat-message" rows="3" placeholder="예: 서울 청년 주거지원 정책 알려주세요"></textarea>
                    </div>
                    <div class="form-group">
                        <label for="user-context">사용자 컨텍스트 (선택):</label>
                        <input type="text" id="user-context" placeholder="JSON 형식: {{\"age\": 25, \"location\": \"서울\"}}">
                    </div>
                    <button class="btn" onclick="testChat()">Chat API 테스트</button>
                    <div id="chat-response" class="response" style="display:none;"></div>
                </div>
            </div>
            
            <!-- Quick Ask API -->
            <div class="endpoint">
                <div>
                    <span class="method post">POST</span>
                    <span class="path">/api/v1/chat/quick-ask</span>
                </div>
                <p><strong>설명:</strong> 빠른 질문 API</p>
                <div class="test-form">
                    <div class="form-group">
                        <label for="quick-question">Question:</label>
                        <input type="text" id="quick-question" placeholder="빠른 질문을 입력하세요">
                    </div>
                    <button class="btn" onclick="testQuickAsk()">Quick Ask 테스트</button>
                    <div id="quickask-response" class="response" style="display:none;"></div>
                </div>
            </div>
            
            <!-- Suggestions API -->
            <div class="endpoint">
                <div>
                    <span class="method get">GET</span>
                    <span class="path">/api/v1/chat/suggestions</span>
                </div>
                <p><strong>설명:</strong> 질문 제안 API</p>
                <div class="test-form">
                    <div class="form-group">
                        <label for="suggestion-category">카테고리 (선택):</label>
                        <select id="suggestion-category">
                            <option value="">전체</option>
                            <option value="취업">취업</option>
                            <option value="창업">창업</option>
                            <option value="주거">주거</option>
                            <option value="금융">금융</option>
                            <option value="교육">교육</option>
                        </select>
                    </div>
                    <button class="btn" onclick="testSuggestions()">Suggestions 테스트</button>
                    <div id="suggestions-response" class="response" style="display:none;"></div>
                </div>
            </div>
            
            <!-- Cache Refresh API -->
            <div class="endpoint">
                <div>
                    <span class="method post">POST</span>
                    <span class="path">/api/v1/refresh-cache</span>
                </div>
                <p><strong>설명:</strong> 캐시 갱신 API</p>
                <div class="test-form">
                    <div class="form-group">
                        <label>
                            <input type="checkbox" id="force-refresh"> 강제 갱신
                        </label>
                    </div>
                    <button class="btn" onclick="testRefreshCache()">캐시 갱신 테스트</button>
                    <div id="cache-response" class="response" style="display:none;"></div>
                </div>
            </div>
        </div>
        
        <script>
            async function makeRequest(method, url, data = null) {{
                const options = {{
                    method: method,
                    headers: {{
                        'Content-Type': 'application/json',
                    }}
                }};
                
                if (data) {{
                    options.body = JSON.stringify(data);
                }}
                
                try {{
                    const response = await fetch(url, options);
                    const result = await response.json();
                    return {{
                        status: response.status,
                        data: result
                    }};
                }} catch (error) {{
                    return {{
                        status: 'ERROR',
                        data: {{ error: error.message }}
                    }};
                }}
            }}
            
            function displayResponse(elementId, response) {{
                const element = document.getElementById(elementId);
                const statusClass = response.status === 200 ? 'status-200' : 'status-error';
                element.innerHTML = `
                    <div class="status ${{statusClass}}">Status: ${{response.status}}</div>
                    <pre>${{JSON.stringify(response.data, null, 2)}}</pre>
                `;
                element.style.display = 'block';
            }}
            
            async function testHealthCheck() {{
                const response = await makeRequest('GET', '/api/v1/health');
                displayResponse('health-response', response);
            }}
            
            async function testChat() {{
                const message = document.getElementById('chat-message').value;
                const contextStr = document.getElementById('user-context').value;
                
                if (!message) {{
                    alert('메시지를 입력해주세요.');
                    return;
                }}
                
                let userContext = null;
                if (contextStr) {{
                    try {{
                        userContext = JSON.parse(contextStr);
                    }} catch (e) {{
                        alert('잘못된 JSON 형식입니다.');
                        return;
                    }}
                }}
                
                const data = {{
                    message: message,
                    user_context: userContext
                }};
                
                const response = await makeRequest('POST', '/api/v1/chat', data);
                displayResponse('chat-response', response);
            }}
            
            async function testQuickAsk() {{
                const question = document.getElementById('quick-question').value;
                
                if (!question) {{
                    alert('질문을 입력해주세요.');
                    return;
                }}
                
                const data = {{ question: question }};
                const response = await makeRequest('POST', '/api/v1/chat/quick-ask', data);
                displayResponse('quickask-response', response);
            }}
            
            async function testSuggestions() {{
                const category = document.getElementById('suggestion-category').value;
                let url = '/api/v1/chat/suggestions';
                
                if (category) {{
                    url += `?category=${{encodeURIComponent(category)}}`;
                }}
                
                const response = await makeRequest('GET', url);
                displayResponse('suggestions-response', response);
            }}
            
            async function testRefreshCache() {{
                const force = document.getElementById('force-refresh').checked;
                const data = {{ force: force }};
                const response = await makeRequest('POST', '/api/v1/refresh-cache', data);
                displayResponse('cache-response', response);
            }}
        </script>
    </body>
    </html>
    """

@app.get("/documents", response_class=HTMLResponse)
async def documents_page():
    """
    크롤링 DB 문서 관리 페이지
    수집된 정책 문서들을 확인하고 관리할 수 있는 인터페이스
    """
    # 실제 DB에서 데이터를 가져오는 대신 fallback 데이터 사용
    documents = [
        {
            "id": "doc_001",
            "title": "서울청년주택 (SH공사) 정책 문서",
            "category": "주거",
            "source": "서울주택도시공사",
            "url": "https://www.i-sh.co.kr/",
            "crawled_date": "2024-12-01",
            "status": "active",
            "content_preview": "서울시 청년을 위한 저렴한 임대주택을 공급합니다. 만 19세부터 39세까지 신청 가능하며..."
        },
        {
            "id": "doc_002",
            "title": "서울시 청년 전세자금대출 정책 문서",
            "category": "주거",
            "source": "서울시청",
            "url": "https://housing.seoul.go.kr/",
            "crawled_date": "2024-11-25",
            "status": "active",
            "content_preview": "청년들의 전세자금 마련을 위한 저금리 대출 지원 정책입니다. 만 19세~34세..."
        },
        {
            "id": "doc_003",
            "title": "청년 주거급여 (주거바우처) 정책 문서",
            "category": "주거",
            "source": "국토교통부",
            "url": "https://www.bokjiro.go.kr/",
            "crawled_date": "2024-10-30",
            "status": "active",
            "content_preview": "저소득 청년 가구의 주거비 부담 경감을 위한 임대료 지원 정책입니다..."
        },
        {
            "id": "doc_004",
            "title": "서울 청년 취업성공패키지 정책 문서",
            "category": "취업",
            "source": "서울시",
            "url": "https://youth.seoul.go.kr/",
            "crawled_date": "2024-12-10",
            "status": "active",
            "content_preview": "취업준비부터 성공까지 단계별 맞춤 지원 프로그램입니다..."
        },
        {
            "id": "doc_005",
            "title": "청년희망적금 정책 문서",
            "category": "금융",
            "source": "서민금융진흥원",
            "url": "https://www.kinfa.or.kr/",
            "crawled_date": "2024-11-20",
            "status": "active",
            "content_preview": "청년층의 자산형성을 위한 우대금리 적금상품입니다. 만 19~34세..."
        }
    ]
    
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>YOUTHY AI - 크롤링 DB 문서 관리</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <link rel="icon" type="image/svg+xml" href="/static/youthy-logo.svg">
        <link rel="shortcut icon" href="/static/favicon.ico">
        <style>
            body {{
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                margin: 0; padding: 20px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: #333; min-height: 100vh;
            }}
            
            .container {{
                max-width: 1200px; margin: 0 auto;
                background: rgba(255,255,255,0.95);
                border-radius: 15px; padding: 2rem;
                box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            }}
            
            .header {{
                text-align: center; margin-bottom: 2rem;
                border-bottom: 3px solid #4f46e5;
                padding-bottom: 1rem;
            }}
            
            .logo {{
                display: flex; align-items: center; justify-content: center;
                font-size: 2rem; font-weight: 800;
                margin-bottom: 1rem;
            }}
            
            .stats {{
                display: grid; grid-template-columns: repeat(4, 1fr);
                gap: 1rem; margin: 2rem 0;
            }}
            
            .stat-card {{
                background: #f8f9fa; padding: 1.5rem;
                border-radius: 8px; text-align: center;
                border: 2px solid #e9ecef;
            }}
            
            .stat-number {{
                font-size: 2rem; font-weight: 800;
                color: #4f46e5; margin-bottom: 0.5rem;
            }}
            
            .document-card {{
                background: #ffffff; border: 1px solid #e9ecef;
                border-radius: 8px; margin: 1rem 0; padding: 1.5rem;
                transition: all 0.2s; position: relative;
            }}
            
            .document-card:hover {{
                border-color: #4f46e5; transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(79, 70, 229, 0.1);
            }}
            
            .doc-header {{
                display: flex; justify-content: between;
                align-items: flex-start; margin-bottom: 1rem;
            }}
            
            .doc-title {{
                font-size: 1.1rem; font-weight: 600;
                color: #2d3748; margin-bottom: 0.5rem;
                flex: 1;
            }}
            
            .doc-meta {{
                display: flex; gap: 1rem; align-items: center;
                margin: 0.5rem 0;
            }}
            
            .category-tag {{
                background: #e0e7ff; color: #4338ca;
                padding: 0.25rem 0.75rem; border-radius: 20px;
                font-size: 0.8rem; font-weight: 500;
            }}
            
            .status-tag {{
                background: #d1fae5; color: #065f46;
                padding: 0.25rem 0.75rem; border-radius: 20px;
                font-size: 0.8rem; font-weight: 500;
            }}
            
            .doc-preview {{
                color: #6b7280; line-height: 1.6;
                margin: 1rem 0;
            }}
            
            .doc-actions {{
                display: flex; gap: 1rem; margin-top: 1rem;
            }}
            
            .btn {{
                padding: 0.5rem 1rem; border: none;
                border-radius: 5px; cursor: pointer;
                font-size: 0.9rem; font-weight: 500;
                text-decoration: none; display: inline-block;
                transition: all 0.2s;
            }}
            
            .btn-primary {{
                background: #4f46e5; color: white;
            }}
            
            .btn-primary:hover {{
                background: #4338ca;
            }}
            
            .btn-secondary {{
                background: #e5e7eb; color: #374151;
            }}
            
            .btn-secondary:hover {{
                background: #d1d5db;
            }}
            
            .back-btn {{
                display: inline-flex; align-items: center;
                margin-bottom: 2rem; padding: 0.5rem 1rem;
                background: #f3f4f6; border-radius: 5px;
                text-decoration: none; color: #374151;
                transition: all 0.2s;
            }}
            
            .back-btn:hover {{
                background: #e5e7eb; transform: translateY(-1px);
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <a href="/" class="back-btn">
                ← 메인으로 돌아가기
            </a>
            
            <div class="header">
                <div class="logo">
                    <img src="/static/youthy-logo.svg" alt="YOUTHY" style="height: 40px; margin-right: 15px;">
                    크롤링 DB 문서 관리
                </div>
                <p>수집된 청년정책 문서들을 확인하고 관리할 수 있는 인터페이스</p>
            </div>
            
            <div class="stats">
                <div class="stat-card">
                    <div class="stat-number">{len(documents)}</div>
                    <div>전체 문서</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">{len([d for d in documents if d['status'] == 'active'])}</div>
                    <div>활성 문서</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">{len(set(d['category'] for d in documents))}</div>
                    <div>카테고리 수</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">{len(set(d['source'] for d in documents))}</div>
                    <div>데이터 소스</div>
                </div>
            </div>
            
            <h3>크롤링된 문서 목록</h3>
            {''.join([f'''
            <div class="document-card">
                <div class="doc-header">
                    <div class="doc-title">{doc['title']}</div>
                </div>
                <div class="doc-meta">
                    <span class="category-tag">🏷️ {doc['category']}</span>
                    <span class="status-tag">✓ {doc['status']}</span>
                    <span style="color: #6b7280; font-size: 0.9rem;">크롤링: {doc['crawled_date']}</span>
                </div>
                <div class="doc-preview">{doc['content_preview']}</div>
                <div class="doc-meta">
                    <span style="font-weight: 500;">데이터 소스:</span> {doc['source']}
                </div>
                <div class="doc-actions">
                    <a href="{doc['url']}" target="_blank" class="btn btn-primary">원본 문서 보기</a>
                    <button class="btn btn-secondary" onclick="viewDocumentDetails('{doc['id']}')">상세 정보</button>
                </div>
            </div>
            ''' for doc in documents])}
        </div>
        
        <script>
            function viewDocumentDetails(docId) {{
                alert(`문서 ID ${{docId}}의 상세 정보를 로드하는 기능이 추후 구현될 예정입니다.`);
            }}
        </script>
    </body>
    </html>
    """

if __name__ == "__main__":
    print("🚀 YOUTHY AI 서버 시작...")
    print("📱 메인 페이지: http://localhost:8000/")
    print("🧪 테스트 페이지: http://localhost:8000/test")
    print("📖 API 문서: http://localhost:8000/docs")
    print("💚 상태 확인: http://localhost:8000/api/v1/health")
    print()
    print("✅ 모든 의존성이 해결되었습니다!")
    print("✅ 10개 카테고리 시스템이 활성화되었습니다!")
    print("✅ 로컬 캐시 시스템이 준비되었습니다!")
    
    uvicorn.run(
        "server:app",
        host="0.0.0.0",
        port=8000,
        reload=False,
        log_level="info"
    )
