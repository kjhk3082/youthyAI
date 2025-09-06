"""
YOUTHY AI 모니터링 서비스

시스템 성능과 상태를 실시간으로 모니터링합니다.
Prometheus 메트릭과 로깅을 통해 시스템 건강성을 추적합니다.
"""

import time
import logging
from typing import Dict, Any
from datetime import datetime

from fastapi import FastAPI, Request
from prometheus_client import Counter, Histogram, Gauge, generate_latest
import psutil

logger = logging.getLogger(__name__)

# Prometheus 메트릭 정의
REQUEST_COUNT = Counter(
    'youthy_api_requests_total',
    'Total API requests',
    ['method', 'endpoint', 'status_code']
)

REQUEST_DURATION = Histogram(
    'youthy_api_request_duration_seconds',
    'API request duration',
    ['method', 'endpoint']
)

ACTIVE_POLICIES = Gauge(
    'youthy_active_policies_total',
    'Number of active policies'
)

SEARCH_QUERIES = Counter(
    'youthy_search_queries_total',
    'Total search queries',
    ['query_type']
)

SYSTEM_MEMORY = Gauge(
    'youthy_system_memory_usage_bytes',
    'System memory usage'
)

SYSTEM_CPU = Gauge(
    'youthy_system_cpu_usage_percent',
    'System CPU usage percentage'
)

def setup_monitoring(app: FastAPI):
    """
    FastAPI 애플리케이션에 모니터링 설정
    
    미들웨어를 추가하여 모든 API 요청을 추적합니다.
    """
    
    @app.middleware("http")
    async def monitor_requests(request: Request, call_next):
        """
        HTTP 요청 모니터링 미들웨어
        
        모든 API 요청의 성능과 상태를 추적합니다.
        """
        start_time = time.time()
        
        # 요청 정보 추출
        method = request.method
        endpoint = request.url.path
        
        try:
            # 요청 처리
            response = await call_next(request)
            
            # 응답 시간 계산
            duration = time.time() - start_time
            status_code = response.status_code
            
            # 메트릭 업데이트
            REQUEST_COUNT.labels(
                method=method,
                endpoint=endpoint,
                status_code=status_code
            ).inc()
            
            REQUEST_DURATION.labels(
                method=method,
                endpoint=endpoint
            ).observe(duration)
            
            # 검색 쿼리 추적
            if '/chat' in endpoint:
                SEARCH_QUERIES.labels(query_type='chat').inc()
            elif '/search' in endpoint:
                SEARCH_QUERIES.labels(query_type='search').inc()
            
            # 로깅
            logger.info(f"📊 {method} {endpoint} - {status_code} ({duration:.3f}s)")
            
            return response
            
        except Exception as e:
            # 오류 발생 시 메트릭 업데이트
            REQUEST_COUNT.labels(
                method=method,
                endpoint=endpoint,
                status_code=500
            ).inc()
            
            logger.error(f"❌ 요청 처리 오류 {method} {endpoint}: {e}")
            raise
    
    @app.get("/metrics")
    async def get_metrics():
        """
        Prometheus 메트릭 엔드포인트
        
        시스템 모니터링 도구에서 메트릭을 수집할 때 사용합니다.
        """
        # 시스템 리소스 업데이트
        update_system_metrics()
        
        # Prometheus 형식으로 메트릭 반환
        return generate_latest()
    
    @app.get("/health")
    async def health_check():
        """
        헬스체크 엔드포인트
        
        시스템의 전반적인 상태를 확인합니다.
        로드밸런서나 모니터링 시스템에서 사용합니다.
        """
        try:
            from app.core.database import check_db_health
            
            # 데이터베이스 상태 확인
            db_health = await check_db_health()
            
            # 시스템 리소스 확인
            memory_usage = psutil.virtual_memory()
            cpu_usage = psutil.cpu_percent(interval=1)
            
            # 전반적인 상태 판단
            is_healthy = (
                db_health['status'] == 'healthy' and
                memory_usage.percent < 90 and
                cpu_usage < 90
            )
            
            status_code = 200 if is_healthy else 503
            
            return {
                "status": "healthy" if is_healthy else "unhealthy",
                "timestamp": datetime.now().isoformat(),
                "components": {
                    "database": db_health,
                    "system": {
                        "memory_usage_percent": memory_usage.percent,
                        "cpu_usage_percent": cpu_usage,
                        "available_memory_gb": memory_usage.available / (1024**3)
                    }
                },
                "version": "1.0.0"
            }
            
        except Exception as e:
            logger.error(f"❌ 헬스체크 오류: {e}")
            return {
                "status": "unhealthy",
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }

def update_system_metrics():
    """시스템 메트릭 업데이트"""
    try:
        # 메모리 사용량
        memory = psutil.virtual_memory()
        SYSTEM_MEMORY.set(memory.used)
        
        # CPU 사용률
        cpu_percent = psutil.cpu_percent()
        SYSTEM_CPU.set(cpu_percent)
        
    except Exception as e:
        logger.warning(f"⚠️ 시스템 메트릭 업데이트 실패: {e}")

async def update_policy_metrics(db_connection):
    """정책 관련 메트릭 업데이트"""
    try:
        # 활성 정책 수 조회
        active_count = await db_connection.fetchval(
            "SELECT COUNT(*) FROM policies WHERE status = 'open'"
        )
        
        ACTIVE_POLICIES.set(active_count or 0)
        
    except Exception as e:
        logger.warning(f"⚠️ 정책 메트릭 업데이트 실패: {e}")

class PerformanceTracker:
    """
    성능 추적기
    
    API 응답 시간, 검색 성능 등을 추적하여
    시스템 최적화에 활용합니다.
    """
    
    def __init__(self):
        self.metrics = {
            'total_requests': 0,
            'total_response_time': 0.0,
            'search_requests': 0,
            'chat_requests': 0,
            'error_count': 0
        }
    
    def record_request(self, endpoint: str, duration: float, success: bool):
        """요청 기록"""
        self.metrics['total_requests'] += 1
        self.metrics['total_response_time'] += duration
        
        if '/chat' in endpoint:
            self.metrics['chat_requests'] += 1
        elif '/search' in endpoint:
            self.metrics['search_requests'] += 1
        
        if not success:
            self.metrics['error_count'] += 1
    
    def get_stats(self) -> Dict[str, Any]:
        """통계 반환"""
        if self.metrics['total_requests'] > 0:
            avg_response_time = self.metrics['total_response_time'] / self.metrics['total_requests']
            error_rate = self.metrics['error_count'] / self.metrics['total_requests']
        else:
            avg_response_time = 0
            error_rate = 0
        
        return {
            'total_requests': self.metrics['total_requests'],
            'average_response_time_ms': avg_response_time * 1000,
            'error_rate_percent': error_rate * 100,
            'chat_requests': self.metrics['chat_requests'],
            'search_requests': self.metrics['search_requests']
        }

# 전역 성능 추적기 인스턴스
performance_tracker = PerformanceTracker()
