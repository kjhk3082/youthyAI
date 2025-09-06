"""
YOUTHY AI 정책 데이터 모델

Pydantic 모델을 사용하여 정책 데이터의 구조를 정의합니다.
API 요청/응답의 일관성을 보장하고 자동 검증을 제공합니다.
"""

from pydantic import BaseModel, Field, validator
from typing import List, Dict, Any, Optional
from datetime import datetime, date
from enum import Enum

class PolicyStatus(str, Enum):
    """정책 상태 열거형"""
    OPEN = "open"           # 신청 가능
    CLOSED = "closed"       # 마감
    UPCOMING = "upcoming"   # 신청 예정

class PolicyCategory(str, Enum):
    """정책 카테고리 열거형"""
    HOUSING = "주거"
    EMPLOYMENT = "취업"
    STARTUP = "창업"
    EDUCATION = "교육"
    CULTURE = "문화"
    FINANCE = "금융"
    WELFARE = "복지"
    TRANSPORT = "교통"
    OTHER = "기타"

class EligibilityCondition(BaseModel):
    """자격 조건 모델"""
    age: Optional[Dict[str, int]] = Field(None, description="연령 조건 (min, max)")
    residency: Optional[Dict[str, Any]] = Field(None, description="거주 조건")
    student: Optional[bool] = Field(None, description="학생 여부")
    income: Optional[Dict[str, Any]] = Field(None, description="소득 조건")
    employment: Optional[str] = Field(None, description="취업 상태")
    other_conditions: Optional[List[str]] = Field(None, description="기타 조건")

class BenefitInfo(BaseModel):
    """혜택 정보 모델"""
    type: str = Field(..., description="혜택 유형 (cash, voucher, service 등)")
    amount: Optional[int] = Field(None, description="지원 금액")
    duration: Optional[str] = Field(None, description="지원 기간")
    max_months: Optional[int] = Field(None, description="최대 지원 개월")
    description: Optional[str] = Field(None, description="혜택 설명")

class ApplyMethod(BaseModel):
    """신청 방법 모델"""
    method: str = Field(..., description="신청 방법 (online, offline, both)")
    url: Optional[str] = Field(None, description="신청 URL")
    procedure: Optional[str] = Field(None, description="신청 절차")
    documents: Optional[List[str]] = Field(None, description="필요 서류")
    deadline: Optional[date] = Field(None, description="신청 마감일")

class ContactInfo(BaseModel):
    """연락처 정보 모델"""
    department: Optional[str] = Field(None, description="담당 부서")
    phone: Optional[str] = Field(None, description="전화번호")
    email: Optional[str] = Field(None, description="이메일")
    address: Optional[str] = Field(None, description="주소")
    hours: Optional[str] = Field(None, description="운영 시간")

class PolicyResponse(BaseModel):
    """정책 응답 모델 (API 출력용)"""
    id: str = Field(..., description="정책 고유 ID")
    title: str = Field(..., description="정책명")
    summary: str = Field(..., description="정책 요약")
    issuing_agency: str = Field(..., description="발행 기관")
    program_type: str = Field(..., description="프로그램 유형")
    region: str = Field(..., description="대상 지역")
    category: List[str] = Field(..., description="정책 카테고리")
    
    # 구조화된 정보
    eligibility: Optional[EligibilityCondition] = Field(None, description="신청 자격")
    benefit: Optional[BenefitInfo] = Field(None, description="지원 혜택")
    apply_method: Optional[ApplyMethod] = Field(None, description="신청 방법")
    contact: Optional[ContactInfo] = Field(None, description="연락처")
    
    # 메타데이터
    source_url: str = Field(..., description="원본 URL")
    source_name: str = Field(..., description="출처명")
    valid_from: Optional[str] = Field(None, description="유효 시작일")
    valid_to: Optional[str] = Field(None, description="유효 종료일")
    status: PolicyStatus = Field(..., description="현재 상태")
    
    # 검색 관련
    relevance_score: Optional[float] = Field(None, description="관련도 점수 (0-1)")
    search_rank: Optional[int] = Field(None, description="검색 순위")
    matched_section: Optional[str] = Field(None, description="매칭된 섹션")
    
    updated_at: Optional[str] = Field(None, description="마지막 업데이트")

class Citation(BaseModel):
    """인용 출처 모델 (Perplexity 스타일)"""
    id: str = Field(..., description="인용 ID")
    title: str = Field(..., description="정책/문서 제목")
    url: str = Field(..., description="원본 URL")
    snippet: str = Field(..., description="관련 텍스트 발췌")
    source: str = Field(..., description="출처 기관")
    relevance_score: float = Field(..., description="관련도 점수")
    section: Optional[str] = Field(None, description="참조 섹션")
    last_updated: str = Field(..., description="마지막 업데이트")

class SearchFilters(BaseModel):
    """검색 필터 모델"""
    region: Optional[str] = Field(None, description="지역 필터")
    age: Optional[int] = Field(None, description="나이 필터", ge=15, le=100)
    category: Optional[List[str]] = Field(None, description="카테고리 필터")
    status: str = Field("open", description="정책 상태 필터")
    include_expired: bool = Field(False, description="만료된 정책 포함 여부")
    
    @validator('category')
    def validate_category(cls, v):
        """카테고리 유효성 검사"""
        if v is None:
            return v
        
        valid_categories = [item.value for item in PolicyCategory]
        for cat in v:
            if cat not in valid_categories:
                raise ValueError(f"유효하지 않은 카테고리: {cat}")
        return v

class PolicyChunk(BaseModel):
    """정책 청크 모델 (RAG용)"""
    id: int = Field(..., description="청크 ID")
    policy_id: str = Field(..., description="정책 ID")
    section: str = Field(..., description="섹션명")
    chunk_order: int = Field(..., description="청크 순서")
    chunk_text: str = Field(..., description="청크 텍스트")
    embedding: Optional[List[float]] = Field(None, description="벡터 임베딩")

class IngestLog(BaseModel):
    """데이터 수집 로그 모델"""
    id: int = Field(..., description="로그 ID")
    source_name: str = Field(..., description="데이터 소스명")
    start_time: datetime = Field(..., description="시작 시간")
    end_time: Optional[datetime] = Field(None, description="종료 시간")
    status: str = Field(..., description="실행 상태")
    records_processed: int = Field(0, description="처리된 레코드 수")
    records_updated: int = Field(0, description="업데이트된 레코드 수")
    records_created: int = Field(0, description="생성된 레코드 수")
    error_message: Optional[str] = Field(None, description="오류 메시지")

# ========================================
# 유틸리티 함수들
# ========================================

def create_policy_id(title: str, agency: str, url: str = "") -> str:
    """
    정책 고유 ID 생성
    
    제목, 기관, URL을 조합하여 중복되지 않는 ID를 생성합니다.
    """
    import hashlib
    
    # 정책 식별 정보 조합
    identifier = f"{agency}_{title}_{url}"
    
    # 해시 생성
    hash_object = hashlib.md5(identifier.encode('utf-8'))
    hash_hex = hash_object.hexdigest()
    
    # 기관 코드 + 해시 조합
    agency_code = agency.replace('구청', '').replace('시', '')[:3]
    policy_id = f"seoul_{agency_code}_{hash_hex[:8]}"
    
    return policy_id

def normalize_region_name(region_text: str) -> str:
    """
    지역명 정규화
    
    다양한 형태의 지역 표현을 표준 형태로 변환합니다.
    """
    # 서울시 25개 자치구 표준명
    standard_districts = {
        '강남': '강남구', '강동': '강동구', '강북': '강북구', '강서': '강서구',
        '관악': '관악구', '광진': '광진구', '구로': '구로구', '금천': '금천구',
        '노원': '노원구', '도봉': '도봉구', '동대문': '동대문구', '동작': '동작구',
        '마포': '마포구', '서대문': '서대문구', '서초': '서초구', '성동': '성동구',
        '성북': '성북구', '송파': '송파구', '양천': '양천구', '영등포': '영등포구',
        '용산': '용산구', '은평': '은평구', '종로': '종로구', '중구': '중구', '중랑': '중랑구'
    }
    
    # 정확한 구명이 포함된 경우
    for standard_name in standard_districts.values():
        if standard_name in region_text:
            return standard_name
    
    # 구명 없이 지역명만 있는 경우
    for short_name, full_name in standard_districts.items():
        if short_name in region_text:
            return full_name
    
    # 서울시 전체 관련 키워드
    if any(keyword in region_text for keyword in ['서울시', '서울 전체', '전 지역']):
        return '서울시 전체'
    
    return region_text  # 그대로 반환

def parse_age_condition(text: str) -> Optional[Dict[str, int]]:
    """
    텍스트에서 연령 조건 파싱
    
    다양한 연령 표현을 구조화된 형태로 변환합니다.
    """
    import re
    
    # 연령 범위 패턴들
    patterns = [
        r'만?\s*(\d+)세\s*이상\s*(\d+)세\s*이하',
        r'만?\s*(\d+)세\s*~\s*(\d+)세',
        r'(\d+)세\s*부터\s*(\d+)세\s*까지',
        r'만?\s*(\d+)세\s*이상',
        r'(\d+)세\s*미만'
    ]
    
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            groups = match.groups()
            
            if len(groups) == 2:  # 범위
                return {'min': int(groups[0]), 'max': int(groups[1])}
            elif len(groups) == 1:  # 단일 조건
                if '이상' in match.group(0):
                    return {'min': int(groups[0])}
                elif '미만' in match.group(0):
                    return {'max': int(groups[0]) - 1}
    
    return None

def extract_monetary_amount(text: str) -> Optional[int]:
    """
    텍스트에서 금액 정보 추출
    
    다양한 금액 표현을 정수로 변환합니다.
    """
    import re
    
    # 금액 패턴들
    patterns = [
        r'(\d{1,3}(?:,\d{3})*)\s*만원',      # 100만원
        r'(\d{1,3}(?:,\d{3})*)\s*원',        # 1,000,000원
        r'최대\s*(\d{1,3}(?:,\d{3})*)',      # 최대 100
        r'월\s*(\d{1,3}(?:,\d{3})*)',        # 월 20
    ]
    
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            amount_str = match.group(1).replace(',', '')
            amount = int(amount_str)
            
            # 만원 단위 변환
            if '만원' in match.group(0):
                amount *= 10000
            
            return amount
    
    return None

def validate_policy_data(policy_dict: Dict[str, Any]) -> bool:
    """
    정책 데이터 유효성 검사
    
    필수 필드와 데이터 형식을 검증합니다.
    """
    required_fields = ['title', 'issuing_agency', 'source_url']
    
    # 필수 필드 확인
    for field in required_fields:
        if not policy_dict.get(field):
            return False
    
    # 제목 길이 확인
    if len(policy_dict['title']) < 5:
        return False
    
    # URL 형식 확인
    source_url = policy_dict['source_url']
    if not (source_url.startswith('http://') or source_url.startswith('https://')):
        return False
    
    return True
