# 🤖 YOUTHY AI - 유씨 청년정책 전문 AI 어시스턴트

> **RAG + LangChain + OpenAI ChatGPT**로 구현한 유씨 청년정책 상담 시스템
> 
> 🚀 **로컬 캐시 기반 빠른 응답** + **10개 카테고리 자동 분류** + **실시간 크롤링**

## ⚡ 5분 만에 시작하기

### 1. 환경 설정
```bash
# 의존성 설치
pip install -r backend/requirements.txt

# 환경변수 설정
cp env_example.env .env
# .env 파일에서 API 키 설정
```

### 2. 데이터베이스 설정
```bash
# PostgreSQL 설치 및 실행
brew install postgresql
brew services start postgresql

# 데이터베이스 생성
createdb youthy_ai
psql youthy_ai < database/schema.sql
```

### 3. 서버 실행
```bash
./run.sh
# 또는
cd backend && uvicorn app.main:app --reload --port 8000
```

### 4. 테스트
**http://localhost:8000/test** 접속하여 바로 테스트!

---

## 🚀 핵심 기능

### ⚡ 로컬 캐시 시스템
- **첫 번째 질문**: 실시간 크롤링으로 최신 데이터 수집 (약 3-5초)
- **이후 질문들**: 로컬 데이터베이스에서 즉시 응답 (< 1초)
- **자동 갱신**: 24시간마다 캐시 자동 업데이트

### 📊 10개 카테고리 자동 분류
정책을 다음 카테고리로 자동 분류하여 정확한 검색 제공:

| 카테고리 | 포함 정책 예시 |
|---------|-------------|
| 🎯 **취업** | 청년인턴, 취업성공패키지, 직업훈련 |
| 🚀 **창업** | 창업지원금, 스타트업 육성, 창업교육 |
| 🧭 **진로** | 진로상담, 멘토링, 직업체험 |
| 🏠 **주거** | 월세지원, 청년주택, 주거급여 |
| 💰 **금융** | 청년수당, 생활안정자금, 소액대출 |
| 📚 **교육** | 교육비지원, 직업교육, 역량개발 |
| 🧠 **정신건강** | 심리상담, 정신건강지원, 스트레스관리 |
| 💪 **신체건강** | 건강검진, 체육활동, 의료비지원 |
| 🤝 **생활지원** | 기초생활지원, 복지서비스, 생활편의 |
| 🎨 **문화/예술** | 문화프로그램, 예술활동, 공연관람 |

### 🔄 실시간 데이터 수집
- **자동 크롤링**: 서울 열린데이터광장, 청년정책 포털 등
- **스마트 업데이트**: 변경된 정책만 선별 업데이트
- **API 갱신**: `/api/v1/refresh-cache`로 수동 갱신 가능

### 🎯 동작 방식
1. **첫 번째 질문 시**: 
   - 로컬 DB 검색 → 부족하면 실시간 크롤링
   - 새로운 정책 자동 수집 및 10개 카테고리로 분류
   - PostgreSQL에 저장 후 응답 (3-5초)

2. **이후 질문들**: 
   - 로컬 DB에서 즉시 검색 및 응답 (< 1초)
   - 사용자 조건(나이, 지역, 학생여부)에 맞는 정책 필터링

3. **캐시 갱신**: 
   - 24시간마다 자동 갱신
   - 수동 갱신: 테스트 페이지의 "🔄 캐시 갱신" 버튼

---

## 🎮 API 사용법 (프론트엔드 개발자용)

### 기본 채팅 API

```javascript
// 메인 채팅 API
const response = await fetch('http://localhost:8000/api/v1/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        message: "성북구 25세 대학생, 월세 지원 정책 있나요?",
        user_context: {
            age: 25,
            region: "성북구", 
            student: true
        }
    })
});

const data = await response.json();

// 응답 구조
console.log(data.message);           // AI 답변
console.log(data.references);        // 출처 링크 [1], [2], [3]
console.log(data.follow_up_questions); // 후속 질문 제안
```

### 실시간 스트리밍 (ChatGPT 스타일)

```javascript
// 스트리밍 채팅 (타이핑 효과)
async function streamChat(message) {
    const response = await fetch('http://localhost:8000/api/v1/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const data = JSON.parse(line.slice(6));
                
                if (data.type === 'content') {
                    document.getElementById('response').innerHTML += data.data;
                } else if (data.type === 'references') {
                    showReferences(data.references);
                }
            }
        }
    }
}
```

### 간단한 질문 API

```javascript
// 빠른 질문 (설정 최소화)
const response = await fetch('http://localhost:8000/api/v1/chat/quick-ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'question=월세 지원 정책이 뭐가 있어?'
});

const data = await response.json();
console.log(data.answer);    // 간단한 답변
console.log(data.sources);   // 출처 목록
```

### 캐시 관리 API

```javascript
// 정책 캐시 갱신 (최신 데이터 수집)
const refreshResponse = await fetch('http://localhost:8000/api/v1/refresh-cache', {
    method: 'POST'
});

const refreshData = await refreshResponse.json();
console.log(refreshData.policies_updated); // 업데이트된 정책 수
console.log(refreshData.stats);            // 수집 통계

// 시스템 상태 확인 (DB 포함)
const healthResponse = await fetch('http://localhost:8000/api/v1/health');
const healthData = await healthResponse.json();
console.log(healthData.database.data_counts); // 저장된 정책 수
```

---

## 🔧 LLM 설정 옵션

### 🥇 OpenAI ChatGPT (권장)
```bash
# API 키 발급: https://platform.openai.com/api-keys
export OPENAI_API_KEY=sk-your-key-here
export LLM_TYPE=openai
```
- **품질**: ⭐⭐⭐⭐⭐ (최고)
- **속도**: ⭐⭐⭐⭐⭐ (매우 빠름)
- **비용**: $0.002/1K 토큰 (저렴)

### 🥈 Ollama (무료, 로컬)
```bash
# 설치 및 실행
brew install ollama
ollama pull llama2:7b-chat
ollama serve

export LLM_TYPE=ollama
```
- **품질**: ⭐⭐⭐⭐ (좋음)
- **속도**: ⭐⭐⭐ (보통)
- **비용**: 무료

### 🥉 템플릿 모드 (즉시 실행)
```bash
export LLM_TYPE=template
# 추가 설정 불필요!
```
- **품질**: ⭐⭐ (기본)
- **속도**: ⭐⭐⭐⭐⭐ (매우 빠름)
- **비용**: 무료

---

## 📱 React 컴포넌트 예시

```jsx
import React, { useState } from 'react';

function YouthyChat() {
    const [message, setMessage] = useState('');
    const [conversation, setConversation] = useState([]);
    const [loading, setLoading] = useState(false);

    const sendMessage = async () => {
        if (!message.trim()) return;
        
        setLoading(true);
        
        try {
            const response = await fetch('http://localhost:8000/api/v1/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message,
                    user_context: {
                        age: 25,
                        region: "강남구",
                        student: true
                    }
                })
            });
            
            const data = await response.json();
            
            setConversation([
                ...conversation,
                { role: 'user', content: message },
                { 
                    role: 'assistant', 
                    content: data.message,
                    references: data.references,
                    followUp: data.follow_up_questions
                }
            ]);
            
            setMessage('');
            
        } catch (error) {
            console.error('채팅 오류:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="youthy-chat">
            <div className="messages">
                {conversation.map((msg, idx) => (
                    <div key={idx} className={`message ${msg.role}`}>
                        <div className="content">{msg.content}</div>
                        
                        {/* Perplexity 스타일 출처 링크 */}
                        {msg.references && (
                            <div className="references">
                                <h4>📚 출처:</h4>
                                {msg.references.map((ref, refIdx) => (
                                    <div key={refIdx} className="reference">
                                        <a href={ref.url} target="_blank" rel="noopener noreferrer">
                                            [{refIdx + 1}] {ref.title}
                                        </a>
                                        <p className="snippet">{ref.snippet}</p>
                                        <small>{ref.source}</small>
                                    </div>
                                ))}
                            </div>
                        )}
                        
                        {/* 후속 질문 버튼 */}
                        {msg.followUp && (
                            <div className="follow-up">
                                <h4>💡 이런 것도 물어보세요:</h4>
                                {msg.followUp.map((q, qIdx) => (
                                    <button key={qIdx} 
                                            onClick={() => setMessage(q)}
                                            className="follow-up-btn">
                                        {q}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
            
            <div className="input-area">
                <input 
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="청년정책에 대해 무엇이든 물어보세요..."
                    disabled={loading}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                />
                <button onClick={sendMessage} disabled={loading || !message}>
                    {loading ? '답변 중...' : '전송'}
                </button>
            </div>
        </div>
    );
}

export default YouthyChat;
```

---

## 🔗 API 엔드포인트

| 엔드포인트 | 설명 | 용도 |
|-----------|------|------|
| `POST /api/v1/chat` | 메인 채팅 | 기본 대화 (로컬 캐시 우선) |
| `POST /api/v1/chat/stream` | 스트리밍 채팅 | 실시간 타이핑 효과 |
| `POST /api/v1/chat/quick-ask` | 간단한 질문 | 검색창, FAQ |
| `GET /api/v1/chat/suggestions` | 질문 제안 | 추천 질문 |
| `POST /api/v1/refresh-cache` | **캐시 갱신** | **정책 데이터 최신화** |
| `GET /api/v1/health` | 시스템 상태 | 모니터링 (DB 상태 포함) |

---

## 🚨 문제 해결

### OpenAI API 키 오류
```bash
# 해결: API 키 설정
export OPENAI_API_KEY=sk-your-key-here
```

### 데이터베이스 연결 실패
```bash
# 해결: PostgreSQL 설치 및 실행
brew install postgresql
brew services start postgresql
createdb youthy_ai
```

### 의존성 설치 오류
```bash
# 해결: 가상환경 재생성
rm -rf venv
python -m venv venv
source venv/bin/activate
pip install -r backend/requirements.txt
```

---

## 💡 실제 사용 예시

**질문**: "강남구에 사는 26세 직장인인데, 월세 지원받을 수 있나요?"

**AI 응답**:
```
안녕하세요! 강남구 거주 26세 직장인분을 위한 월세 지원 정책을 찾아드렸습니다.

🏠 **추천 정책:**

1. **서울시 청년 월세 지원** [1]
   - 지원금액: 월 최대 20만원 (12개월)
   - 신청조건: 만 19~39세, 서울시 거주
   - 신청: 서울시 청년포털

2. **강남구 청년 주거비 지원** [2]
   - 지원금액: 월 최대 15만원
   - 신청조건: 강남구 거주 1년 이상
   - 신청: 강남구청 방문

**📞 문의**: 02-120 (서울시), 02-3423-5432 (강남구청)

**출처:**
[1] 서울시 청년포털 - https://youth.seoul.go.kr/...
[2] 강남구청 - https://gangnam.go.kr/...
```

---

**🎉 이제 바로 사용할 수 있습니다!**

1. 위 설정 완료 후 `./run.sh` 실행
2. `/test` 페이지에서 테스트
3. API 예시 코드로 프론트엔드 구현

질문이 있으시면 `/api/v1/chat/health`에서 시스템 상태를 먼저 확인해보세요! 😊