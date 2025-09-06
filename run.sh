#!/bin/bash

# YOUTHY AI 빠른 실행 스크립트
# 2025년 9월 기준 MVP 버전

echo "🚀 YOUTHY AI 시스템 시작 중..."

# 1. Python 가상환경 확인 및 생성
if [ ! -d "venv" ]; then
    echo "📦 Python 가상환경 생성 중..."
    python3 -m venv venv
fi

# 2. 가상환경 활성화
echo "🔧 가상환경 활성화..."
source venv/bin/activate

# 3. 의존성 설치
echo "📚 의존성 설치 중..."
pip install -r backend/requirements.txt

# 4. PostgreSQL 실행 확인 (Docker 사용)
echo "🗄️ 데이터베이스 확인 중..."
if ! docker ps | grep -q youthy-db; then
    echo "🐳 PostgreSQL + pgvector 컨테이너 시작..."
    docker run -d --name youthy-db \
        -p 5432:5432 \
        -e POSTGRES_DB=youthy_ai \
        -e POSTGRES_USER=postgres \
        -e POSTGRES_PASSWORD=password \
        pgvector/pgvector:pg16
    
    echo "⏳ 데이터베이스 시작 대기 (10초)..."
    sleep 10
fi

# 5. 스키마 생성
echo "🏗️ 데이터베이스 스키마 생성..."
PGPASSWORD=password psql -h localhost -U postgres -d youthy_ai -f database/schema.sql 2>/dev/null || echo "⚠️ 스키마가 이미 존재하거나 생성 중 오류 발생"

# 6. 초기 데이터 수집
echo "📡 초기 정책 데이터 수집 중..."
cd data_ingestion
python real_time_crawler.py &
CRAWLER_PID=$!
cd ..

# 7. FastAPI 서버 시작
echo "🌐 FastAPI 서버 시작..."
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &
SERVER_PID=$!

echo "✅ YOUTHY AI 시스템 시작 완료!"
echo ""
echo "📋 접속 정보:"
echo "   🌐 메인 페이지: http://localhost:8000"
echo "   🧪 테스트 페이지: http://localhost:8000/test"
echo "   📖 API 문서: http://localhost:8000/docs"
echo "   💚 상태 확인: http://localhost:8000/health"
echo ""
echo "🛑 종료하려면 Ctrl+C를 누르세요"

# 종료 신호 처리
trap 'echo "🛑 YOUTHY AI 시스템 종료 중..."; kill $SERVER_PID $CRAWLER_PID 2>/dev/null; exit 0' INT

# 서버 실행 유지
wait $SERVER_PID
