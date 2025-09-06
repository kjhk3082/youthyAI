"""
YOUTHY AI - 유씨 청년정책 AI 어시스턴트 백엔드

이 파일은 FastAPI 애플리케이션의 메인 진입점입니다.
프론트엔드에서 바로 호출할 수 있는 REST API를 제공합니다.

주요 기능:
1. /qa - AI 기반 정책 질의응답
2. /search - 정책 검색
3. /recommend - 개인화 정책 추천
4. /test - API 테스트 페이지
"""

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
import uvicorn
import logging
from datetime import datetime

# 내부 모듈 import
from app.api import llm_chat
from app.core.config import settings
from app.core.database import init_db, check_db_health
from app.services.rag_service import initialize_rag_system
from app.services.monitoring import setup_monitoring

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# FastAPI 앱 생성
app = FastAPI(
    title="YOUTHY AI API",
    description="""
    🎯 **유씨 청년정책 AI 어시스턴트**
    
    청년들을 위한 맞춤형 정책 정보를 AI로 제공합니다.
    
    ## 주요 기능
    - **AI 질의응답**: 자연어로 정책 문의
    - **스마트 검색**: 하이브리드 검색으로 정확한 결과
    - **개인화 추천**: 사용자 프로필 기반 맞춤 정책
    - **실시간 업데이트**: 최신 정책 정보 자동 수집
    
    ## 데이터 소스
    - 온통청년 API (상세 정책정보)
    - 서울 열린데이터광장
    - 서울 청년정책 포털
    - 각종 고시·공고
    - 정부24 공공서비스
    
    ## 🔥 주요 특징
    - **실시간 만료 필터링**: 서버 시간 기준으로 만료된 정책 자동 제거
    - **마감 임박 알림**: 신청 마감까지 남은 일수 표시
    - **상세 정책 정보**: 온통청년 API로 더욱 풍부한 정보 제공
    """,
    version="1.0.0",
    contact={
        "name": "YOUTHY AI Team",
        "email": "kjhk3082@naver.com"
    }
)

# CORS 설정 (프론트엔드에서 API 호출 가능하도록)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 개발용: 모든 도메인 허용
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 모니터링 설정 (선택적)
try:
    setup_monitoring(app)
    logger.info("✅ 모니터링 시스템 활성화")
except Exception as e:
    logger.warning(f"⚠️ 모니터링 시스템 비활성화: {e}")

# API 라우터 등록 - 통합형 LLM 채팅만 사용
app.include_router(llm_chat.router, prefix="/api/v1", tags=["AI 채팅"])

@app.on_event("startup")
async def startup_event():
    """
    애플리케이션 시작 시 실행되는 초기화 함수
    데이터베이스 연결 및 필요한 설정을 초기화합니다.
    """
    logger.info("🚀 YOUTHY AI 시스템 시작 중...")
    
    # 데이터베이스 초기화 (연결 실패 시 계속 진행)
    try:
        await init_db()
        logger.info("✅ 데이터베이스 연결 성공")
    except Exception as e:
        logger.warning(f"⚠️ 데이터베이스 연결 실패: {e}")
        logger.info("🔄 데이터베이스 없이 서버 시작됨")
    
    logger.info("✅ YOUTHY AI 시스템 시작 완료!")
    logger.info(f"📊 API 문서: http://localhost:{settings.PORT}/docs")
    logger.info(f"🧪 테스트 페이지: http://localhost:{settings.PORT}/test")

@app.get("/", response_class=HTMLResponse)
async def root():
    """
    루트 페이지 - 시스템 상태와 링크 제공
    """
    return """
    <html>
        <head>
            <title>YOUTHY AI - 유씨 청년정책 AI 어시스턴트</title>
            <meta charset="utf-8">
            <style>
                body { 
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    max-width: 800px; margin: 0 auto; padding: 2rem;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white; min-height: 100vh;
                }
                .container { 
                    background: rgba(255,255,255,0.1); 
                    padding: 2rem; border-radius: 20px;
                    backdrop-filter: blur(10px);
                }
                .link { 
                    display: inline-block; 
                    background: rgba(255,255,255,0.2);
                    padding: 1rem 2rem; margin: 1rem 0;
                    border-radius: 10px; text-decoration: none;
                    color: white; transition: all 0.3s;
                }
                .link:hover { background: rgba(255,255,255,0.3); transform: translateY(-2px); }
                .status { background: #10b981; padding: 0.5rem 1rem; border-radius: 20px; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🎯 YOUTHY AI</h1>
                <h2>유씨 청년정책 AI 어시스턴트</h2>
                <p><span class="status">🟢 시스템 정상 운영 중</span></p>
                
                <h3>📚 주요 링크</h3>
                <a href="/docs" class="link">📖 API 문서 (Swagger)</a><br>
                <a href="/test" class="link">🧪 테스트 페이지</a><br>
                <a href="/api/v1/health" class="link">💚 시스템 상태 확인</a>
                
                <h3>🚀 API 엔드포인트</h3>
                <ul>
                    <li><strong>POST /api/v1/chat</strong> - 통합형 AI 채팅 (온통청년 + 서울 데이터)</li>
                    <li><strong>POST /api/v1/chat/stream</strong> - 실시간 스트리밍 채팅</li>
                    <li><strong>POST /api/v1/chat/quick-ask</strong> - 빠른 질문</li>
                    <li><strong>GET /api/v1/chat/suggestions</strong> - 질문 제안</li>
                    <li><strong>GET /api/v1/chat/categories</strong> - 8개 정책 카테고리 목록</li>
                    <li><strong>GET /api/v1/chat/category/{category}</strong> - 카테고리별 정책 검색</li>
                </ul>
                
                <h3>📋 8개 정책 카테고리</h3>
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin: 1rem 0;">
                    <div style="background: rgba(255,255,255,0.1); padding: 10px; border-radius: 5px;">
                        <strong>🏢 취업</strong><br><small>일자리, 구직, 인턴십</small>
                    </div>
                    <div style="background: rgba(255,255,255,0.1); padding: 10px; border-radius: 5px;">
                        <strong>🚀 창업</strong><br><small>사업, 스타트업, 기업</small>
                    </div>
                    <div style="background: rgba(255,255,255,0.1); padding: 10px; border-radius: 5px;">
                        <strong>🏠 주거</strong><br><small>월세, 전세, 임대주택</small>
                    </div>
                    <div style="background: rgba(255,255,255,0.1); padding: 10px; border-radius: 5px;">
                        <strong>📚 교육</strong><br><small>훈련, 학습, 강의</small>
                    </div>
                    <div style="background: rgba(255,255,255,0.1); padding: 10px; border-radius: 5px;">
                        <strong>💝 복지</strong><br><small>지원금, 수당, 의료</small>
                    </div>
                    <div style="background: rgba(255,255,255,0.1); padding: 10px; border-radius: 5px;">
                        <strong>🎨 문화/예술</strong><br><small>공연, 전시, 체험</small>
                    </div>
                    <div style="background: rgba(255,255,255,0.1); padding: 10px; border-radius: 5px;">
                        <strong>🗳️ 참여권리</strong><br><small>정책참여, 시민활동</small>
                    </div>
                    <div style="background: rgba(255,255,255,0.1); padding: 10px; border-radius: 5px;">
                        <strong>📋 기타</strong><br><small>종합지원, 상담</small>
                    </div>
                </div>
                
                <p><small>🕐 현재 시간: """ + datetime.now().strftime("%Y-%m-%d %H:%M:%S") + """</small></p>
            </div>
        </body>
    </html>
    """

@app.get("/api/v1/health")
async def health_check():
    """
    시스템 상태 확인 API
    프론트엔드에서 백엔드 연결 상태를 확인할 때 사용
    """
    # 데이터베이스 상태도 함께 확인
    db_status = await check_db_health()
    
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "service": "YOUTHY AI",
        "version": "1.0.0",
        "message": "유씨 청년정책 AI 어시스턴트가 정상 작동 중입니다! 🎉",
        "database": db_status
    }

@app.post("/api/v1/refresh-cache")
async def refresh_policy_cache():
    """
    정책 데이터 캐시 갱신 API
    
    크롤링을 실행하여 최신 정책 정보를 수집하고
    로컬 데이터베이스에 저장합니다.
    """
    try:
        logger.info("🔄 정책 캐시 갱신 시작...")
        
        # 데이터 수집 파이프라인 실행
        import sys
        import os
        
        # 프로젝트 루트 경로 추가
        project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..'))
        if project_root not in sys.path:
            sys.path.append(project_root)
        
        from data_ingestion.pipeline import YouthPolicyDataPipeline
        
        pipeline = YouthPolicyDataPipeline()
        
        # 비동기로 데이터 수집 실행
        result = await pipeline.run_full_pipeline()
        
        logger.info("✅ 정책 캐시 갱신 완료")
        
        return {
            "status": "success",
            "message": "정책 데이터 캐시가 성공적으로 갱신되었습니다.",
            "timestamp": datetime.now().isoformat(),
            "stats": result.get('stats', {}),
            "policies_updated": result.get('total_policies', 0)
        }
        
    except Exception as e:
        logger.error(f"❌ 정책 캐시 갱신 실패: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"캐시 갱신 중 오류가 발생했습니다: {str(e)}"
        )

# 테스트 페이지 (프론트엔드 개발자가 API 테스트할 수 있도록)
@app.get("/test", response_class=HTMLResponse)
async def test_page():
    """
    API 테스트용 웹 페이지
    개발자가 실제 API 호출을 테스트해볼 수 있는 간단한 UI 제공
    """
    return """
    <!DOCTYPE html>
    <html>
    <head>
        <title>YOUTHY AI API 테스트</title>
        <meta charset="utf-8">
        <style>
            body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                max-width: 1200px; margin: 0 auto; padding: 2rem;
                background: #f8fafc;
            }
            .container { background: white; padding: 2rem; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
            .test-section { margin: 2rem 0; padding: 1.5rem; border: 1px solid #e2e8f0; border-radius: 8px; }
            .btn { 
                background: #3b82f6; color: white; padding: 0.75rem 1.5rem; 
                border: none; border-radius: 6px; cursor: pointer; margin: 0.5rem;
            }
            .btn:hover { background: #2563eb; }
            textarea, input { 
                width: 100%; padding: 0.75rem; border: 1px solid #d1d5db; 
                border-radius: 6px; margin: 0.5rem 0;
            }
            .result { 
                background: #f3f4f6; padding: 1rem; border-radius: 6px; 
                margin-top: 1rem; white-space: pre-wrap; max-height: 400px; overflow-y: auto;
            }
            .success { border-left: 4px solid #10b981; }
            .error { border-left: 4px solid #ef4444; }
        </style>
    </head>
    <body>
                    <div class="container">
                <h1>🧪 YOUTHY AI 테스트 페이지</h1>
                <p>유씨 청년정책 통합형 AI 어시스턴트를 테스트해보세요! (Perplexity 스타일)</p>
                
                <!-- 통합 AI 채팅 테스트 -->
                <div class="test-section">
                    <h2>🤖 AI 채팅 테스트</h2>
                    <p><strong>설명:</strong> 청년정책에 대해 무엇이든 자연스럽게 대화하세요. 출처 링크와 함께 정확한 답변을 받을 수 있습니다.</p>
                    
                    <label>질문/대화:</label>
                    <textarea id="chatMessage" rows="4" placeholder="예: 성북구에 사는 25세 대학생인데, 월세 지원받을 수 있는 정책이 있을까요? 신청 조건과 방법도 알려주세요."></textarea>
                    
                    <label>사용자 정보 (JSON, 선택사항):</label>
                    <textarea id="userContext" rows="4" placeholder='{"age": 25, "region": "성북구", "student": true, "income_bracket": "low"}'></textarea>
                    
                    <button class="btn" onclick="testChat()">💬 AI와 대화하기</button>
                    <button class="btn" onclick="testStreamChat()" style="background: #10b981;">🌊 스트리밍 채팅</button>
                    <div id="chatResult" class="result" style="display:none;"></div>
                </div>
                
                <!-- 빠른 질문 테스트 -->
                <div class="test-section">
                    <h2>⚡ 빠른 질문 테스트</h2>
                    <p><strong>설명:</strong> 복잡한 설정 없이 간단하게 질문하고 답변받기</p>
                    
                    <input type="text" id="quickQuestion" placeholder="예: 청년 월세 지원 정책이 뭐가 있어?" style="width: 70%;">
                    <button class="btn" onclick="testQuickAsk()">⚡ 빠른 질문</button>
                    <div id="quickResult" class="result" style="display:none;"></div>
                </div>
                
                <!-- 카테고리별 정책 검색 테스트 -->
                <div class="test-section">
                    <h2>📋 카테고리별 정책 검색 테스트</h2>
                    <p><strong>설명:</strong> 8개 카테고리로 정리된 청년정책을 검색해보세요 (온통청년 API + 만료 필터링)</p>
                    
                    <label>카테고리 선택:</label>
                    <select id="categorySelect" style="padding: 0.5rem; margin: 0.5rem;">
                        <option value="취업">🏢 취업 (일자리, 구직, 인턴십)</option>
                        <option value="창업">🚀 창업 (사업, 스타트업, 기업)</option>
                        <option value="주거">🏠 주거 (월세, 전세, 임대주택)</option>
                        <option value="교육">📚 교육 (훈련, 학습, 강의)</option>
                        <option value="복지">💝 복지 (지원금, 수당, 의료)</option>
                        <option value="문화/예술">🎨 문화/예술 (공연, 전시, 체험)</option>
                        <option value="참여권리">🗳️ 참여권리 (정책참여, 시민활동)</option>
                        <option value="기타">📋 기타 (종합지원, 상담)</option>
                    </select>
                    
                    <label>최대 정책 개수:</label>
                    <input type="number" id="policyLimit" value="5" min="1" max="20" style="width: 80px;">
                    
                    <button class="btn" onclick="testCategorySearch()">🔍 카테고리 검색</button>
                    <button class="btn" onclick="testGetCategories()" style="background: #8b5cf6;">📋 카테고리 목록</button>
                    <div id="categoryResult" class="result" style="display:none;"></div>
                </div>
                
                <!-- 시스템 상태 -->
                <div class="test-section">
                    <h2>📊 시스템 상태</h2>
                    <button class="btn" onclick="checkHealth()">💚 상태 확인</button>
                    <button class="btn" onclick="refreshCache()" style="background: #f59e0b;">🔄 캐시 갱신</button>
                    <div id="healthResult" class="result" style="display:none;"></div>
                </div>
        </div>
        
        <script>
            // API 호출 공통 함수
            async function callAPI(endpoint, method = 'GET', body = null) {
                try {
                    const options = {
                        method: method,
                        headers: {
                            'Content-Type': 'application/json',
                        }
                    };
                    
                    if (body) {
                        options.body = JSON.stringify(body);
                    }
                    
                    const response = await fetch(endpoint, options);
                    const data = await response.json();
                    
                    return {
                        success: response.ok,
                        data: data,
                        status: response.status
                    };
                } catch (error) {
                    return {
                        success: false,
                        data: { error: error.message },
                        status: 0
                    };
                }
            }
            
            // 결과 표시 함수
            function showResult(elementId, result) {
                const element = document.getElementById(elementId);
                element.style.display = 'block';
                element.className = 'result ' + (result.success ? 'success' : 'error');
                
                // 카테고리 검색 결과인 경우 특별한 포맷팅
                if (result.success && result.data.policies && Array.isArray(result.data.policies)) {
                    let html = `<h4>📋 ${result.data.category} 정책 (${result.data.total_count}개)</h4>`;
                    
                    result.data.policies.forEach((policy, index) => {
                        const statusEmoji = policy.is_expired ? '🔴' : '🟢';
                        const statusColor = policy.is_expired ? '#ef4444' : '#10b981';
                        
                        html += `
                            <div style="margin: 15px 0; padding: 15px; border: 1px solid #e2e8f0; border-radius: 8px; background: #fafafa;">
                                <h5 style="margin: 0 0 10px 0; color: #1f2937;">${index + 1}. ${policy.title}</h5>
                                <p style="margin: 5px 0; color: ${statusColor}; font-weight: bold;">
                                    ${statusEmoji} ${policy.period_status}
                                </p>
                                <p style="margin: 5px 0; color: #6b7280;"><strong>기관:</strong> ${policy.agency}</p>
                                <p style="margin: 5px 0; color: #6b7280;"><strong>신청기간:</strong> ${policy.application_period}</p>
                                <p style="margin: 5px 0; color: #6b7280;"><strong>지원대상:</strong> ${policy.support_target}</p>
                                ${policy.detail_url !== 'N/A' ? `<a href="${policy.detail_url}" target="_blank" style="color: #3b82f6;">🔗 상세보기</a>` : ''}
                            </div>
                        `;
                    });
                    
                    element.innerHTML = html;
                } else {
                    element.textContent = JSON.stringify(result.data, null, 2);
                }
            }
            
            // AI 채팅 테스트
            async function testChat() {
                const message = document.getElementById('chatMessage').value;
                const userContextText = document.getElementById('userContext').value;
                
                if (!message.trim()) {
                    alert('메시지를 입력해주세요!');
                    return;
                }
                
                let userContext = null;
                if (userContextText.trim()) {
                    try {
                        userContext = JSON.parse(userContextText);
                    } catch (e) {
                        alert('사용자 정보 JSON 형식이 올바르지 않습니다!');
                        return;
                    }
                }
                
                const result = await callAPI('/api/v1/chat', 'POST', {
                    message: message,
                    user_context: userContext,
                    max_references: 5
                });
                
                showResult('chatResult', result);
            }
            
            // 스트리밍 채팅 테스트
            async function testStreamChat() {
                const message = document.getElementById('chatMessage').value;
                const userContextText = document.getElementById('userContext').value;
                
                if (!message.trim()) {
                    alert('메시지를 입력해주세요!');
                    return;
                }
                
                let userContext = null;
                if (userContextText.trim()) {
                    try {
                        userContext = JSON.parse(userContextText);
                    } catch (e) {
                        alert('사용자 정보 JSON 형식이 올바르지 않습니다!');
                        return;
                    }
                }
                
                const resultDiv = document.getElementById('chatResult');
                resultDiv.style.display = 'block';
                resultDiv.className = 'result success';
                resultDiv.innerHTML = '<div style="color: #3b82f6;">🤖 AI가 답변을 생성하고 있습니다...</div>';
                
                try {
                    const response = await fetch('/api/v1/chat/stream', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            message: message,
                            user_context: userContext
                        })
                    });
                    
                    const reader = response.body.getReader();
                    const decoder = new TextDecoder();
                    let fullResponse = '';
                    
                    while (true) {
                        const { value, done } = await reader.read();
                        if (done) break;
                        
                        const chunk = decoder.decode(value);
                        const lines = chunk.split('\\n');
                        
                        for (const line of lines) {
                            if (line.startsWith('data: ')) {
                                try {
                                    const data = JSON.parse(line.slice(6));
                                    
                                    if (data.type === 'content') {
                                        fullResponse += data.content;
                                        resultDiv.innerHTML = '<div style="white-space: pre-wrap;">' + fullResponse + '</div>';
                                    } else if (data.type === 'references') {
                                        let refsHtml = '<hr><h4>📚 참조 출처:</h4>';
                                        data.references.forEach((ref, i) => {
                                            refsHtml += `<div style="margin: 10px 0; padding: 10px; background: #f8f9fa; border-radius: 5px;">
                                                <strong>[${i+1}] ${ref.title}</strong><br>
                                                <small>${ref.source}</small><br>
                                                <a href="${ref.url}" target="_blank" style="color: #3b82f6;">${ref.url}</a><br>
                                                <em>${ref.snippet}</em>
                                            </div>`;
                                        });
                                        resultDiv.innerHTML = '<div style="white-space: pre-wrap;">' + fullResponse + '</div>' + refsHtml;
                                    }
                                } catch (e) {
                                    console.error('스트리밍 데이터 파싱 오류:', e);
                                }
                            }
                        }
                    }
                } catch (error) {
                    resultDiv.innerHTML = '<div style="color: #ef4444;">❌ 스트리밍 오류: ' + error.message + '</div>';
                }
            }
            
            // 빠른 질문 테스트
            async function testQuickAsk() {
                const question = document.getElementById('quickQuestion').value;
                
                if (!question.trim()) {
                    alert('질문을 입력해주세요!');
                    return;
                }
                
                const result = await callAPI('/api/v1/chat/quick-ask', 'POST', {
                    question: question
                });
                
                showResult('quickResult', result);
            }
            
            // 시스템 상태 확인
            async function checkHealth() {
                const result = await callAPI('/health');
                showResult('healthResult', result);
            }
            
            // 캐시 갱신
            async function refreshCache() {
                const result = await callAPI('/api/v1/refresh-cache', 'POST');
                showResult('healthResult', result);
            }
            
            // 카테고리별 정책 검색 테스트
            async function testCategorySearch() {
                const category = document.getElementById('categorySelect').value;
                const limit = document.getElementById('policyLimit').value;
                const userContextText = document.getElementById('userContext').value;
                
                let userContextParam = '';
                if (userContextText.trim()) {
                    try {
                        const userContext = JSON.parse(userContextText);
                        userContextParam = '&user_context=' + encodeURIComponent(JSON.stringify(userContext));
                    } catch (e) {
                        alert('사용자 정보 JSON 형식이 올바르지 않습니다!');
                        return;
                    }
                }
                
                const result = await callAPI(`/api/v1/chat/category/${encodeURIComponent(category)}?limit=${limit}${userContextParam}`);
                showResult('categoryResult', result);
            }
            
            // 카테고리 목록 조회 테스트
            async function testGetCategories() {
                const result = await callAPI('/api/v1/chat/categories');
                showResult('categoryResult', result);
            }
            
            // 페이지 로드 시 샘플 데이터 입력
            window.onload = function() {
                document.getElementById('chatMessage').value = '성북구에 사는 25세 대학생인데, 월세 지원받을 수 있는 정책이 있을까요? 신청 조건과 방법도 알려주세요.';
                document.getElementById('userContext').value = JSON.stringify({
                    "age": 25,
                    "region": "성북구", 
                    "student": true,
                    "income_bracket": "low"
                }, null, 2);
                
                document.getElementById('quickQuestion').value = '청년 월세 지원 정책이 뭐가 있어?';
            };
        </script>
    </body>
    </html>
    """

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    전역 예외 처리기
    예상치 못한 오류 발생 시 사용자에게 친화적인 메시지 제공
    """
    logger.error(f"예상치 못한 오류 발생: {exc}", exc_info=True)
    
    return {
        "error": "시스템 오류가 발생했습니다.",
        "message": "잠시 후 다시 시도해주세요. 문제가 지속되면 관리자에게 문의하세요.",
        "timestamp": datetime.now().isoformat(),
        "request_id": str(id(request))  # 디버깅용 요청 ID
    }

if __name__ == "__main__":
    # 개발 서버 실행
    # 프로덕션에서는 gunicorn 등을 사용 권장
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=settings.PORT,
        reload=True,  # 코드 변경 시 자동 재시작
        log_level="info"
    )
