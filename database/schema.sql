-- YOUTHY AI 데이터베이스 스키마
-- PostgreSQL + pgvector 확장을 사용한 하이브리드 검색 시스템

-- pgvector 확장 설치 (벡터 검색용)
CREATE EXTENSION IF NOT EXISTS vector;

-- 정책 메인 테이블
-- 청년정책의 모든 정보를 정규화하여 저장
CREATE TABLE policies (
    -- 기본 식별자
    id TEXT PRIMARY KEY,                    -- 정책 고유 ID (기관코드_정책명_해시)
    
    -- 정책 기본 정보
    title TEXT NOT NULL,                    -- 정책명 (예: "성북구 청년월세지원")
    summary TEXT,                           -- 한줄 요약
    body_html TEXT,                         -- 상세 내용 (HTML 형태)
    
    -- 발행 기관 정보
    issuing_agency TEXT,                    -- 발행 기관 (예: "성북구청")
    program_type TEXT,                      -- 프로그램 유형 (지원금/교육/취업 등)
    
    -- 지역 및 분류
    region TEXT,                            -- 대상 지역 (구 단위: "성북구", "전체" 등)
    category TEXT[],                        -- 카테고리 배열 (주거, 금융, 문화, 교육 등)
    
    -- 자격 요건 (JSON 형태로 유연하게 저장)
    -- 예: {"age": {"min":19, "max":34}, "residency":{"districts":["성북구"]}, "student": true}
    eligibility JSONB,                      -- 신청 자격 조건
    
    -- 혜택 정보 (JSON 형태)
    -- 예: {"type":"cash", "amount":200000, "duration":"monthly", "max_months":12}
    benefit JSONB,                          -- 지원 혜택 내용
    
    -- 신청 방법 (JSON 형태)
    -- 예: {"method":"online", "url":"https://...", "documents":["주민등록등본"]}
    apply_method JSONB,                     -- 신청 방법 및 절차
    
    -- 연락처 정보 (JSON 형태)
    contact JSONB,                          -- 문의처 정보
    
    -- 소스 추적
    source_url TEXT,                        -- 원본 URL
    source_name TEXT,                       -- 소스명 (예: "서울 열린데이터광장")
    source_doc_date DATE,                   -- 원본 문서 작성일
    
    -- 유효성 관리 (매우 중요!)
    valid_from DATE,                        -- 정책 시작일
    valid_to DATE,                          -- 정책 종료일
    status TEXT CHECK (status IN ('open','closed','upcoming')), -- 현재 상태
    
    -- 메타데이터
    last_seen_at TIMESTAMPTZ DEFAULT NOW(), -- 마지막 확인 시점
    version INT DEFAULT 1,                  -- 정책 버전 (수정 시 증가)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 정책 청크 테이블 (RAG용 텍스트 분할 저장)
-- 긴 정책 문서를 검색 가능한 작은 단위로 분할하여 저장
CREATE TABLE policy_chunks (
    id BIGSERIAL PRIMARY KEY,
    policy_id TEXT REFERENCES policies(id) ON DELETE CASCADE,
    
    -- 청크 메타데이터
    section TEXT,                           -- 섹션명 (예: "신청자격", "신청기간", "문의처")
    chunk_order INT,                        -- 청크 순서
    chunk_text TEXT NOT NULL,               -- 실제 텍스트 내용
    
    -- 검색용 인덱스
    embedding VECTOR(1024),                 -- 벡터 임베딩 (bge-m3 모델 사용)
    tsv tsvector,                          -- 전문검색용 벡터 (BM25)
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 데이터 수집 로그 테이블
-- 언제, 어떤 소스에서, 얼마나 많은 데이터를 수집했는지 추적
CREATE TABLE ingest_logs (
    id BIGSERIAL PRIMARY KEY,
    source_name TEXT NOT NULL,              -- 데이터 소스명
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    status TEXT CHECK (status IN ('running','success','failed')),
    records_processed INT DEFAULT 0,
    records_updated INT DEFAULT 0,
    records_created INT DEFAULT 0,
    error_message TEXT,
    metadata JSONB                          -- 추가 메타데이터
);

-- 원본 데이터 스냅샷 테이블 (감사 및 추적용)
-- 원본 데이터를 그대로 보관하여 나중에 문제 발생 시 추적 가능
CREATE TABLE raw_snapshots (
    id BIGSERIAL PRIMARY KEY,
    policy_id TEXT,
    source_url TEXT,
    raw_content TEXT,                       -- 원본 HTML/JSON 내용
    content_hash TEXT,                      -- 변경 감지용 해시
    captured_at TIMESTAMPTZ DEFAULT NOW()
);

-- 사용자 질의 로그 (분석 및 개선용)
CREATE TABLE query_logs (
    id BIGSERIAL PRIMARY KEY,
    question TEXT NOT NULL,
    user_profile JSONB,
    response_time_ms INT,
    result_count INT,
    satisfaction_score FLOAT,              -- 사용자 만족도 (선택적)
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================
-- 인덱스 생성 (성능 최적화)
-- ========================================

-- 정책 테이블 인덱스
CREATE INDEX idx_policies_status ON policies(status);
CREATE INDEX idx_policies_region ON policies(region);
CREATE INDEX idx_policies_valid_period ON policies(valid_from, valid_to);
CREATE INDEX idx_policies_category ON policies USING GIN(category);
CREATE INDEX idx_policies_eligibility ON policies USING GIN(eligibility);
CREATE INDEX idx_policies_updated_at ON policies(updated_at);

-- 청크 테이블 인덱스
-- 벡터 검색용 인덱스 (IVFFlat 알고리즘 사용)
CREATE INDEX idx_policy_chunks_embedding ON policy_chunks 
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- 전문검색용 인덱스 (BM25)
CREATE INDEX idx_policy_chunks_tsv ON policy_chunks USING gin(tsv);

-- 정책 ID별 청크 조회용
CREATE INDEX idx_policy_chunks_policy_id ON policy_chunks(policy_id);

-- 로그 테이블 인덱스
CREATE INDEX idx_ingest_logs_source_time ON ingest_logs(source_name, start_time);
CREATE INDEX idx_query_logs_created_at ON query_logs(created_at);

-- ========================================
-- 트리거 및 함수 (자동화)
-- ========================================

-- 정책 업데이트 시 updated_at 자동 갱신
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER policies_updated_at
    BEFORE UPDATE ON policies
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- 청크 텍스트 변경 시 tsvector 자동 업데이트
CREATE OR REPLACE FUNCTION update_chunk_tsv()
RETURNS TRIGGER AS $$
BEGIN
    NEW.tsv = to_tsvector('korean', NEW.chunk_text);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER policy_chunks_tsv_update
    BEFORE INSERT OR UPDATE ON policy_chunks
    FOR EACH ROW
    EXECUTE FUNCTION update_chunk_tsv();

-- ========================================
-- 운영 환경 준비 완료
-- ========================================

-- 스키마 생성 완료. 실제 정책 데이터는 data_ingestion 파이프라인을 통해 수집됩니다.
-- 초기 데이터 로딩: python data_ingestion/pipeline.py --initial-load

-- ========================================
-- 유용한 뷰 (자주 사용하는 쿼리)
-- ========================================

-- 현재 유효한 정책만 조회하는 뷰
CREATE VIEW active_policies AS
SELECT * FROM policies 
WHERE status = 'open' 
  AND (valid_to IS NULL OR valid_to >= CURRENT_DATE);

-- 지역별 정책 통계 뷰
CREATE VIEW policy_stats_by_region AS
SELECT 
    region,
    COUNT(*) as total_policies,
    COUNT(*) FILTER (WHERE status = 'open') as open_policies,
    COUNT(*) FILTER (WHERE valid_to < CURRENT_DATE) as expired_policies
FROM policies 
GROUP BY region;

-- ========================================
-- 설명 및 사용법
-- ========================================

/*
이 스키마의 핵심 설계 원칙:

1. 유효기간 중심 설계
   - valid_from, valid_to, status를 통해 정책의 현재 상태를 명확히 관리
   - 모든 검색과 추천은 이 필드들을 기준으로 필터링

2. 유연한 JSON 스키마
   - eligibility, benefit, apply_method 등을 JSONB로 저장
   - 정책마다 다른 구조를 가질 수 있어 확장성 확보

3. 하이브리드 검색 지원
   - embedding: 의미 기반 벡터 검색
   - tsv: 키워드 기반 전문검색 (BM25)
   - 두 방식을 조합하여 검색 정확도 향상

4. 감사 추적
   - raw_snapshots: 원본 데이터 보관
   - ingest_logs: 수집 과정 추적
   - version: 정책 변경 이력 관리

사용 예시:
- 벡터 검색: SELECT * FROM policy_chunks ORDER BY embedding <=> '[임베딩벡터]' LIMIT 10;
- 키워드 검색: SELECT * FROM policy_chunks WHERE tsv @@ plainto_tsquery('korean', '월세 지원');
- 조건 검색: SELECT * FROM policies WHERE eligibility @> '{"student": true}';
*/
