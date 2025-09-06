"""
YOUTHY AI 시스템 설정

이 파일은 애플리케이션의 모든 설정을 관리합니다.
환경변수를 통해 설정값을 주입받아 보안성과 유연성을 확보합니다.

설정 항목:
- 데이터베이스 연결 정보
- 서울 열린데이터광장 API 키
- AI 모델 설정
- 서버 설정
"""

from pydantic_settings import BaseSettings
from typing import List, Optional
import os

class Settings(BaseSettings):
    """
    애플리케이션 설정 클래스
    
    환경변수나 .env 파일에서 설정값을 자동으로 로드합니다.
    개발/운영 환경별로 다른 설정을 사용할 수 있습니다.
    """
    
    # ========================================
    # 기본 애플리케이션 설정
    # ========================================
    APP_NAME: str = "YOUTHY AI"
    VERSION: str = "1.0.0"
    DEBUG: bool = True                      # 개발모드 (운영시 False)
    PORT: int = 8000
    
    # ========================================
    # 데이터베이스 설정
    # ========================================
    # PostgreSQL 연결 정보
    DB_HOST: str = "localhost"
    DB_PORT: int = 5432
    DB_NAME: str = "youthy_ai"
    DB_USER: str = "postgres"
    DB_PASSWORD: str = "password"
    
    # 연결 풀 설정
    DB_POOL_MIN_SIZE: int = 5
    DB_POOL_MAX_SIZE: int = 20
    
    @property
    def DATABASE_URL(self) -> str:
        """데이터베이스 연결 URL 생성"""
        return f"postgresql://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
    
    @property
    def ASYNC_DATABASE_URL(self) -> str:
        """비동기 데이터베이스 연결 URL 생성"""
        return f"postgresql+asyncpg://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
    
    # ========================================
    # 외부 API 설정
    # ========================================
    # 서울 열린데이터광장 API 키 (환경변수에서 로드)
    SEOUL_OPEN_DATA_API_KEY: str = ""  # .env 파일이나 환경변수에서 설정
    
    # OpenAI API 키 (ChatGPT 사용)
    OPENAI_API_KEY: str = ""  # .env 파일이나 환경변수에서 설정
    
    # Hugging Face 토큰 (대안 LLM 사용시)
    HF_API_TOKEN: str = ""  # .env 파일이나 환경변수에서 설정
    
    # LLM 설정
    LLM_TYPE: str = "openai"  # openai, ollama, huggingface, template
    
    # API 호출 제한 설정
    API_RATE_LIMIT: int = 1000              # 시간당 최대 호출 수
    API_TIMEOUT: int = 30                   # API 타임아웃 (초)
    
    # ========================================
    # AI/ML 모델 설정
    # ========================================
    # 임베딩 모델 설정 (한국어 특화)
    EMBEDDING_MODEL: str = "BAAI/bge-m3"    # 다국어 지원, 1024차원
    EMBEDDING_DIMENSION: int = 1024
    
    # 리랭커 모델 (검색 결과 재정렬용)
    RERANKER_MODEL: str = "BAAI/bge-reranker-v2-m3"
    
    # 검색 설정
    SEARCH_TOP_K: int = 20                  # 1차 검색 결과 수
    RERANK_TOP_K: int = 5                   # 재정렬 후 최종 결과 수
    SIMILARITY_THRESHOLD: float = 0.7       # 유사도 임계값
    
    # ========================================
    # 데이터 수집 설정
    # ========================================
    # 수집 스케줄 (Cron 표현식)
    INGEST_SCHEDULE_DAILY: str = "0 6 * * *"      # 매일 오전 6시
    INGEST_SCHEDULE_HOURLY: str = "0 * * * *"     # 매시간 (긴급 공고용)
    
    # 수집 소스 URL 목록
    DATA_SOURCES: dict = {
        "seoul_open_data": {
            "base_url": "https://data.seoul.go.kr/dataList/OA-20180",
            "api_key_param": "KEY",
            "format": "json"
        },
        "youth_policy_portal": {
            "base_url": "https://www.youthcenter.go.kr",
            "crawl_pages": ["/board/policy"]
        },
        "seoul_notices": {
            "rss_url": "https://www.seoul.go.kr/news/rss.do?type=notice"
        }
    }
    
    # ========================================
    # 캐싱 설정
    # ========================================
    CACHE_TTL: int = 3600                   # 캐시 유효시간 (초)
    REDIS_URL: Optional[str] = None         # Redis 사용시 (선택사항)
    
    # ========================================
    # 로깅 및 모니터링 설정
    # ========================================
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    
    # Prometheus 메트릭 수집 여부
    ENABLE_METRICS: bool = True
    
    # ========================================
    # 보안 설정
    # ========================================
    # API 키 검증 (필요시)
    API_KEY_HEADER: str = "X-API-Key"
    ALLOWED_HOSTS: List[str] = ["*"]        # 개발용: 모든 호스트 허용
    
    # CORS 설정
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",            # React 개발 서버
        "http://localhost:8080",            # Vue 개발 서버
        "http://localhost:5173",            # Vite 개발 서버
    ]
    
    # ========================================
    # 품질 보장 설정
    # ========================================
    # 응답 품질 임계값
    MIN_CONFIDENCE_SCORE: float = 0.6       # 최소 신뢰도 점수
    MAX_RESPONSE_LENGTH: int = 2000         # 최대 응답 길이
    
    # 정책 유효성 검사
    POLICY_EXPIRY_WARNING_DAYS: int = 30    # 만료 N일 전 경고
    
    # ========================================
    # 캐시 설정
    # ========================================
    USE_LOCAL_CACHE: bool = True            # 로컬 캐시 사용 여부
    CACHE_EXPIRY_HOURS: int = 24           # 캐시 만료 시간 (시간)
    AUTO_REFRESH_INTERVAL: int = 24        # 자동 갱신 간격 (시간)
    
    class Config:
        """Pydantic 설정"""
        env_file = ".env"                   # .env 파일에서 환경변수 로드
        case_sensitive = True               # 대소문자 구분

# 전역 설정 인스턴스
settings = Settings()

# ========================================
# 설정 검증 함수
# ========================================

def validate_settings():
    """
    설정값 유효성 검사
    애플리케이션 시작 시 필수 설정이 올바른지 확인
    """
    errors = []
    
    # API 키 검증
    if not settings.SEOUL_OPEN_DATA_API_KEY:
        errors.append("서울 열린데이터광장 API 키가 설정되지 않았습니다.")
    
    # 데이터베이스 설정 검증
    if not all([settings.DB_HOST, settings.DB_NAME, settings.DB_USER]):
        errors.append("데이터베이스 연결 정보가 불완전합니다.")
    
    # AI 모델 설정 검증
    if settings.EMBEDDING_DIMENSION <= 0:
        errors.append("임베딩 차원수가 올바르지 않습니다.")
    
    if errors:
        raise ValueError(f"설정 오류:\n" + "\n".join(f"- {error}" for error in errors))
    
    return True

# ========================================
# 환경별 설정 프리셋
# ========================================

class DevelopmentSettings(Settings):
    """개발 환경 설정"""
    DEBUG: bool = True
    LOG_LEVEL: str = "DEBUG"
    DB_NAME: str = "youthy_ai_dev"

class ProductionSettings(Settings):
    """운영 환경 설정"""
    DEBUG: bool = False
    LOG_LEVEL: str = "INFO"
    ALLOWED_HOSTS: List[str] = ["youthy.ai", "api.youthy.ai"]
    CORS_ORIGINS: List[str] = ["https://youthy.ai"]

class TestSettings(Settings):
    """테스트 환경 설정"""
    DEBUG: bool = True
    DB_NAME: str = "youthy_ai_test"
    CACHE_TTL: int = 1  # 테스트시 캐시 비활성화

def get_settings() -> Settings:
    """
    환경에 따른 설정 반환
    ENVIRONMENT 환경변수로 제어 (development/production/test)
    """
    env = os.getenv("ENVIRONMENT", "development").lower()
    
    if env == "production":
        return ProductionSettings()
    elif env == "test":
        return TestSettings()
    else:
        return DevelopmentSettings()

# 현재 환경의 설정 사용
settings = get_settings()

# 시작 시 설정 검증
if __name__ == "__main__":
    try:
        validate_settings()
        print("✅ 설정 검증 완료!")
        print(f"📊 환경: {os.getenv('ENVIRONMENT', 'development')}")
        print(f"🗄️ 데이터베이스: {settings.DATABASE_URL}")
        print(f"🔑 API 키: {'설정됨' if settings.SEOUL_OPEN_DATA_API_KEY else '미설정'}")
    except ValueError as e:
        print(f"❌ 설정 오류: {e}")
        exit(1)
