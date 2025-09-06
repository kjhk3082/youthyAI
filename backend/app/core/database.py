"""
YOUTHY AI 데이터베이스 연결 관리

PostgreSQL + pgvector 데이터베이스와의 연결을 관리합니다.
비동기 연결 풀을 사용하여 높은 성능을 보장합니다.
"""

import asyncio
import asyncpg
import logging
from typing import Optional, Dict, Any
from contextlib import asynccontextmanager
from datetime import datetime

from app.core.config import settings

logger = logging.getLogger(__name__)

# 전역 연결 풀
_connection_pool: Optional[asyncpg.Pool] = None

async def init_db():
    """
    데이터베이스 초기화
    
    애플리케이션 시작 시 연결 풀을 생성하고
    필요한 확장(pgvector)을 설치합니다.
    """
    global _connection_pool
    
    try:
        logger.info("🗄️ 데이터베이스 연결 풀 생성 중...")
        
        # 연결 풀 생성
        _connection_pool = await asyncpg.create_pool(
            host=settings.DB_HOST,
            port=settings.DB_PORT,
            user=settings.DB_USER,
            password=settings.DB_PASSWORD,
            database=settings.DB_NAME,
            min_size=settings.DB_POOL_MIN_SIZE,
            max_size=settings.DB_POOL_MAX_SIZE,
            command_timeout=60
        )
        
        # 연결 테스트 및 확장 설치
        async with _connection_pool.acquire() as conn:
            # pgvector 확장 설치
            await conn.execute("CREATE EXTENSION IF NOT EXISTS vector")
            
            # 테이블 존재 확인
            tables_exist = await conn.fetchval("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = 'policies'
                )
            """)
            
            if not tables_exist:
                logger.warning("⚠️ 정책 테이블이 존재하지 않습니다. 스키마를 먼저 생성해주세요.")
                logger.info("💡 실행: psql -h localhost -U postgres -d youthy_ai -f database/schema.sql")
            else:
                # 정책 수 확인
                policy_count = await conn.fetchval("SELECT COUNT(*) FROM policies")
                logger.info(f"📊 현재 저장된 정책 수: {policy_count}개")
        
        logger.info("✅ 데이터베이스 초기화 완료")
        
    except Exception as e:
        logger.error(f"❌ 데이터베이스 초기화 실패: {e}")
        raise

async def close_db():
    """데이터베이스 연결 풀 종료"""
    global _connection_pool
    
    if _connection_pool:
        await _connection_pool.close()
        _connection_pool = None
        logger.info("✅ 데이터베이스 연결 풀 종료")

async def get_db_connection():
    """
    데이터베이스 연결 의존성
    
    FastAPI 의존성 주입에서 사용됩니다.
    각 API 요청마다 연결 풀에서 연결을 가져와 사용합니다.
    """
    global _connection_pool
    
    if not _connection_pool:
        await init_db()
    
    async with _connection_pool.acquire() as connection:
        yield connection

@asynccontextmanager
async def get_db_transaction():
    """
    트랜잭션 컨텍스트 매니저
    
    여러 데이터베이스 작업을 하나의 트랜잭션으로 묶을 때 사용합니다.
    데이터 일관성을 보장합니다.
    """
    global _connection_pool
    
    if not _connection_pool:
        await init_db()
    
    async with _connection_pool.acquire() as conn:
        async with conn.transaction():
            yield conn

async def execute_schema_migration():
    """
    스키마 마이그레이션 실행
    
    schema.sql 파일을 실행하여 데이터베이스 구조를 생성합니다.
    """
    try:
        logger.info("🔧 스키마 마이그레이션 시작...")
        
        # schema.sql 파일 읽기
        schema_path = "database/schema.sql"
        with open(schema_path, 'r', encoding='utf-8') as f:
            schema_sql = f.read()
        
        # 스키마 실행
        async with get_db_transaction() as conn:
            await conn.execute(schema_sql)
        
        logger.info("✅ 스키마 마이그레이션 완료")
        
    except FileNotFoundError:
        logger.error("❌ schema.sql 파일을 찾을 수 없습니다.")
        raise
    except Exception as e:
        logger.error(f"❌ 스키마 마이그레이션 실패: {e}")
        raise

async def check_db_health() -> Dict[str, Any]:
    """
    데이터베이스 상태 확인
    
    연결 상태, 테이블 존재 여부, 데이터 수 등을 확인합니다.
    헬스체크 API에서 사용됩니다.
    """
    try:
        global _connection_pool
        
        if not _connection_pool:
            return {"status": "disconnected", "error": "연결 풀이 초기화되지 않았습니다."}
        
        async with _connection_pool.acquire() as conn:
            # 연결 테스트
            await conn.fetchval("SELECT 1")
            
            # 테이블 존재 확인
            tables = await conn.fetch("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name IN ('policies', 'policy_chunks', 'ingest_logs')
            """)
            
            table_names = [row['table_name'] for row in tables]
            
            # 데이터 수 확인
            data_counts = {}
            for table in table_names:
                count = await conn.fetchval(f"SELECT COUNT(*) FROM {table}")
                data_counts[table] = count
            
            # 최근 업데이트 시간
            last_update = None
            if 'policies' in table_names:
                last_update_row = await conn.fetchrow(
                    "SELECT MAX(updated_at) as last_update FROM policies"
                )
                if last_update_row and last_update_row['last_update']:
                    last_update = last_update_row['last_update'].isoformat()
            
            return {
                "status": "healthy",
                "connection_pool_size": len(_connection_pool._holders),
                "tables_exist": table_names,
                "data_counts": data_counts,
                "last_data_update": last_update,
                "timestamp": datetime.now().isoformat()
            }
            
    except Exception as e:
        logger.error(f"❌ 데이터베이스 상태 확인 오류: {e}")
        return {
            "status": "unhealthy",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }
