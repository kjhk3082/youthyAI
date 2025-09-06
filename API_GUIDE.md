# 🎯 YOUTHY AI API 가이드

> **유씨 청년정책 AI 어시스턴트** 완전한 개발자 가이드  
> 초보 프론트엔드 개발자를 위한 A-Z 완벽 설명서

## 📋 목차
- [시작하기](#-시작하기)
- [API 개요](#-api-개요)
- [인증 및 설정](#-인증-및-설정)
- [주요 엔드포인트](#-주요-엔드포인트)
- [실제 사용 예시](#-실제-사용-예시)
- [프론트엔드 통합 가이드](#-프론트엔드-통합-가이드)
- [에러 처리](#-에러-처리)
- [자주 묻는 질문](#-자주-묻는-질문)

## 🚀 시작하기

### 서버 실행 방법

```bash
# 1. 프로젝트 폴더로 이동
cd "YOUTHY AI"

# 2. Python 가상환경 활성화
source venv/bin/activate

# 3. 필요한 패키지 설치
pip install fastapi uvicorn python-dotenv aiohttp openai

# 4. 환경변수 설정 (.env 파일)
OPENAI_API_KEY=your-openai-api-key
SEOUL_OPEN_DATA_API_KEY=your-seoul-api-key

# 5. 서버 실행
python server.py
```

### 서버 상태 확인
서버가 정상 실행되면 다음 URL들에 접속할 수 있습니다:

- **메인 페이지**: http://localhost:8000/
- **데모 채팅 페이지**: http://localhost:8000/test
- **API 문서 (Swagger)**: http://localhost:8000/docs
- **시스템 상태**: http://localhost:8000/api/v1/health

## 📊 API 개요

YOUTHY AI는 서울시 청년정책 정보를 제공하는 완전한 RAG(Retrieval-Augmented Generation) 시스템입니다.

### 핵심 기능
- **실시간 정책 데이터 검색**: 서울시 열린데이터광장 API 연동
- **AI 기반 자연어 답변**: OpenAI GPT-4o-mini 활용
- **10개 카테고리 자동 분류**: 취업, 창업, 주거, 금융 등
- **신뢰성 있는 출처 제공**: 각 정책의 공식 링크와 연락처
- **상세 정보 제공**: 연령, 자격, 혜택, 신청방법 등

### 지원하는 정책 카테고리

| 카테고리 | 이모지 | 주요 키워드 |
|----------|--------|-------------|
| 취업 | 🎯 | 취업, 일자리, 구직, 채용, 면접 |
| 창업 | 🚀 | 창업, 사업, 스타트업, 기업가 |
| 진로 | 🧭 | 진로, 직업, 경력, 멘토링 |
| 주거 | 🏠 | 주거, 임대, 전세, 월세, 주택 |
| 금융 | 💰 | 금융, 대출, 적금, 투자, 신용 |
| 교육 | 📚 | 교육, 학습, 강의, 자격증, 연수 |
| 정신건강 | 🧠 | 정신건강, 상담, 심리, 스트레스 |
| 신체건강 | 💪 | 건강, 의료, 운동, 체력 |
| 생활지원 | 🤝 | 생활, 지원, 복지, 혜택 |
| 문화/예술 | 🎨 | 문화, 예술, 공연, 전시 |

## 🔐 인증 및 설정

### 환경 변수 (.env 파일)

```bash
# OpenAI API (필수)
OPENAI_API_KEY=sk-your-openai-api-key-here

# 서울시 열린데이터광장 API (선택, fallback 데이터 있음)
SEOUL_OPEN_DATA_API_KEY=your-seoul-api-key-here

# 기타 설정
LLM_TYPE=openai
USE_LOCAL_CACHE=true
AUTO_REFRESH_INTERVAL=24
```

### API 키 발급 방법

**OpenAI API 키** (필수):
1. [OpenAI Platform](https://platform.openai.com/) 접속
2. API Keys 메뉴에서 새 키 생성
3. `.env` 파일에 `OPENAI_API_KEY` 설정

**서울시 API 키** (선택):
1. [서울 열린데이터광장](https://data.seoul.go.kr/) 접속
2. 회원가입 후 인증키 발급
3. `.env` 파일에 `SEOUL_OPEN_DATA_API_KEY` 설정

## 📡 주요 엔드포인트

### 1. 시스템 상태 확인

```http
GET /api/v1/health
```

**응답 예시:**
```json
{
  "status": "healthy",
  "timestamp": "2025-09-02T19:00:00.000Z",
  "service": "YOUTHY AI",
  "version": "1.0.0",
  "message": "유씨 청년정책 AI 어시스턴트가 정상 작동 중입니다! 🎉",
  "features": {
    "local_cache": "활성화",
    "categories": 10,
    "database": "PostgreSQL (connected)",
    "crawling": "자동 분류 시스템"
  },
  "categories": ["취업", "창업", "진로", "주거", "금융", "교육", "정신건강", "신체건강", "생활지원", "문화/예술"]
}
```

### 2. AI 채팅 (메인 API)

```http
POST /api/v1/chat
```

**요청 본문:**
```json
{
  "message": "서울 청년 주거지원 정책 알려줘",
  "user_context": {
    "age": 25,
    "location": "서울시 강남구"
  }
}
```

**응답 구조:**
```json
{
  "message": "질문에 대한 답변을 생성했습니다.",
  "answer": "AI가 생성한 자연어 답변...",
  "thinking_process": [
    "사용자 질문을 분석하고 관련 키워드를 추출했습니다.",
    "3개의 관련 정책을 서울시 데이터에서 검색했습니다.",
    "정책 정보를 바탕으로 정확한 답변을 생성했습니다."
  ],
  "references": [
    {
      "id": "policy_001",
      "title": "서울청년주택 (SH공사)",
      "url": "https://www.i-sh.co.kr/",
      "snippet": "서울시 청년을 위한 저렴한 임대주택...",
      "source": "서울주택도시공사",
      "category": "주거",
      "age_range": "만 19세 ~ 39세",
      "benefits": "시세 대비 80% 수준의 임대료...",
      "how_to_apply": "온라인 신청",
      "contact": "1600-3456"
    }
  ],
  "policy_details": [
    {
      "title": "서울청년주택 (SH공사)",
      "agency": "서울주택도시공사",
      "category": "주거",
      "age_range": "만 19세 ~ 39세",
      "eligibility": ["무주택자", "소득 기준 충족"],
      "benefits": "시세 대비 80% 수준의 임대료...",
      "period": "2년 + 재계약 2년 (최대 4년)",
      "how_to_apply": "온라인 신청",
      "documents": ["신청서", "소득증명서", "재직증명서"],
      "url": "https://www.i-sh.co.kr/",
      "contact": "1600-3456"
    }
  ],
  "detected_categories": ["주거", "생활지원"],
  "available_categories": ["취업", "창업", "진로", "주거", "금융", "교육", "정신건강", "신체건강", "생활지원", "문화/예술"],
  "search_stats": {
    "policies_found": 3,
    "processing_time": "2.45초",
    "data_source": "Seoul Open Data API"
  },
  "timestamp": "2025-09-02T19:00:00.000Z"
}
```

### 3. 빠른 질문

```http
POST /api/v1/chat/quick-ask
```

**요청 본문:**
```json
{
  "question": "청년 취업지원 있나요?"
}
```

### 4. 질문 제안

```http
GET /api/v1/chat/suggestions?category=주거
```

**응답 예시:**
```json
{
  "suggestions": [
    "🏠 주거 관련 정책을 알려주세요",
    "청년들이 받을 수 있는 주거 지원 정책은 어떤 것들이 있나요?",
    "대학생도 신청할 수 있는 취업 지원 프로그램을 알려주세요."
  ],
  "category": "주거",
  "timestamp": "2025-09-02T19:00:00.000Z"
}
```

### 5. 캐시 갱신

```http
POST /api/v1/refresh-cache
```

**요청 본문:**
```json
{
  "force": true
}
```

## 💻 실제 사용 예시

### JavaScript (Vanilla)

```javascript
// 기본 채팅 API 호출
async function askYouthyAI(message) {
  try {
    const response = await fetch('http://localhost:8000/api/v1/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: message,
        user_context: {
          age: 25,
          location: '서울시'
        }
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('API 호출 오류:', error);
    return null;
  }
}

// 사용 예시
askYouthyAI('서울 청년 주거지원 정책 알려줘').then(result => {
  if (result) {
    console.log('AI 답변:', result.answer);
    console.log('관련 정책 수:', result.policy_details.length);
    console.log('출처:', result.references);
  }
});
```

### React (함수형 컴포넌트)

```jsx
import React, { useState } from 'react';

const YouthyAIChat = () => {
  const [message, setMessage] = useState('');
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!message.trim()) return;
    
    setLoading(true);
    try {
      const res = await fetch('http://localhost:8000/api/v1/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message })
      });

      const data = await res.json();
      setResponse(data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="youthy-ai-chat">
      <div className="input-section">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="청년정책에 대해 질문하세요..."
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
        />
        <button onClick={sendMessage} disabled={loading}>
          {loading ? '전송 중...' : '전송'}
        </button>
      </div>

      {response && (
        <div className="response-section">
          {/* Thinking Process */}
          <div className="thinking-process">
            <h4>🤔 생각하는 과정:</h4>
            <ul>
              {response.thinking_process.map((step, index) => (
                <li key={index}>{step}</li>
              ))}
            </ul>
          </div>

          {/* AI Answer */}
          <div className="ai-answer">
            <h4>🎯 YOUTHY AI 답변:</h4>
            <div dangerouslySetInnerHTML={{ 
              __html: response.answer.replace(/\n/g, '<br>') 
            }} />
          </div>

          {/* Policy Details */}
          {response.policy_details.length > 0 && (
            <div className="policy-details">
              <h4>📋 관련 정책 상세 정보:</h4>
              {response.policy_details.map((policy, index) => (
                <div key={index} className="policy-card">
                  <h5>{policy.title}</h5>
                  <p><strong>주관기관:</strong> {policy.agency}</p>
                  <p><strong>대상연령:</strong> {policy.age_range}</p>
                  <p><strong>지원혜택:</strong> {policy.benefits}</p>
                  <p><strong>신청방법:</strong> {policy.how_to_apply}</p>
                  <p><strong>연락처:</strong> {policy.contact}</p>
                  <a href={policy.url} target="_blank" rel="noopener noreferrer">
                    🔗 공식 홈페이지
                  </a>
                </div>
              ))}
            </div>
          )}

          {/* Sources */}
          {response.references.length > 0 && (
            <div className="sources">
              <h4>📚 출처 및 참고자료:</h4>
              {response.references.map((ref, index) => (
                <div key={index} className="source-item">
                  <h6>[{index + 1}] {ref.title}</h6>
                  <p>{ref.snippet}</p>
                  <a href={ref.url} target="_blank" rel="noopener noreferrer">
                    🔗 {ref.source}
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default YouthyAIChat;
```

### Vue.js 3 (Composition API)

```vue
<template>
  <div class="youthy-ai-chat">
    <div class="input-section">
      <input
        v-model="message"
        @keyup.enter="sendMessage"
        placeholder="청년정책에 대해 질문하세요..."
        :disabled="loading"
      />
      <button @click="sendMessage" :disabled="loading || !message.trim()">
        {{ loading ? '전송 중...' : '전송' }}
      </button>
    </div>

    <div v-if="response" class="response-section">
      <!-- Thinking Process -->
      <div class="thinking-process">
        <h4>🤔 생각하는 과정:</h4>
        <ul>
          <li v-for="(step, index) in response.thinking_process" :key="index">
            {{ step }}
          </li>
        </ul>
      </div>

      <!-- AI Answer -->
      <div class="ai-answer">
        <h4>🎯 YOUTHY AI 답변:</h4>
        <div v-html="response.answer.replace(/\n/g, '<br>')"></div>
      </div>

      <!-- Policy Details -->
      <div v-if="response.policy_details.length > 0" class="policy-details">
        <h4>📋 관련 정책 상세 정보:</h4>
        <div
          v-for="(policy, index) in response.policy_details"
          :key="index"
          class="policy-card"
        >
          <h5>{{ policy.title }}</h5>
          <p><strong>주관기관:</strong> {{ policy.agency }}</p>
          <p><strong>대상연령:</strong> {{ policy.age_range }}</p>
          <p><strong>지원혜택:</strong> {{ policy.benefits }}</p>
          <a :href="policy.url" target="_blank">🔗 공식 홈페이지</a>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const message = ref('')
const response = ref(null)
const loading = ref(false)

const sendMessage = async () => {
  if (!message.value.trim()) return
  
  loading.value = true
  try {
    const res = await fetch('http://localhost:8000/api/v1/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: message.value })
    })

    const data = await res.json()
    response.value = data
    message.value = ''
  } catch (error) {
    console.error('Error:', error)
  } finally {
    loading.value = false
  }
}
</script>
```

## 🎨 프론트엔드 통합 가이드

### CSS 스타일링 예시

```css
.youthy-ai-chat {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.input-section {
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
}

.input-section input {
  flex: 1;
  padding: 1rem;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  font-size: 1rem;
}

.input-section input:focus {
  outline: none;
  border-color: #4f46e5;
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
}

.input-section button {
  padding: 1rem 2rem;
  background: linear-gradient(135deg, #4f46e5, #7c3aed);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1rem;
  transition: transform 0.2s;
}

.input-section button:hover {
  transform: translateY(-1px);
}

.input-section button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.thinking-process {
  background: #f3f4f6;
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 1rem;
  border-left: 4px solid #8b5cf6;
}

.ai-answer {
  background: white;
  padding: 1.5rem;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  margin-bottom: 1rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.policy-card {
  background: #f0f9ff;
  border: 1px solid #0ea5e9;
  border-radius: 8px;
  padding: 1rem;
  margin: 1rem 0;
}

.policy-card h5 {
  color: #0c4a6e;
  margin-bottom: 0.5rem;
}

.source-item {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 1rem;
  margin: 0.5rem 0;
}

.source-item:hover {
  border-color: #4f46e5;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(79, 70, 229, 0.1);
}
```

### 실시간 타이핑 효과 구현

```javascript
// 타이핑 효과 함수
async function typeMessage(element, text, speed = 30) {
  element.innerHTML = '';
  for (let i = 0; i < text.length; i++) {
    element.innerHTML += text.charAt(i);
    element.scrollIntoView({ behavior: 'smooth', block: 'end' });
    await new Promise(resolve => setTimeout(resolve, speed));
  }
}

// 사용 예시
const responseElement = document.getElementById('ai-response');
typeMessage(responseElement, response.answer);
```

### 로딩 상태 및 에러 처리

```javascript
class YouthyAIClient {
  constructor(baseURL = 'http://localhost:8000') {
    this.baseURL = baseURL;
  }

  async chat(message, userContext = null) {
    try {
      // 로딩 상태 표시
      this.showLoading();

      const response = await fetch(`${this.baseURL}/api/v1/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          user_context: userContext
        }),
        // 타임아웃 설정 (30초)
        signal: AbortSignal.timeout(30000)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      // 로딩 상태 해제
      this.hideLoading();
      
      return data;
    } catch (error) {
      this.hideLoading();
      this.showError(error.message);
      throw error;
    }
  }

  showLoading() {
    // 로딩 스피너 표시
    const loadingElement = document.getElementById('loading');
    if (loadingElement) {
      loadingElement.style.display = 'block';
    }
  }

  hideLoading() {
    // 로딩 스피너 숨김
    const loadingElement = document.getElementById('loading');
    if (loadingElement) {
      loadingElement.style.display = 'none';
    }
  }

  showError(message) {
    // 에러 메시지 표시
    const errorElement = document.getElementById('error');
    if (errorElement) {
      errorElement.textContent = message;
      errorElement.style.display = 'block';
      setTimeout(() => {
        errorElement.style.display = 'none';
      }, 5000);
    }
  }
}

// 사용 예시
const client = new YouthyAIClient();
client.chat('서울 청년 주거지원 정책 알려줘')
  .then(response => {
    console.log('성공:', response);
  })
  .catch(error => {
    console.error('실패:', error);
  });
```

## ⚠️ 에러 처리

### 일반적인 에러 응답

```json
{
  "detail": "채팅 처리 중 오류가 발생했습니다: 구체적인 오류 내용",
  "status_code": 500,
  "timestamp": "2025-09-02T19:00:00.000Z"
}
```

### HTTP 상태 코드

| 코드 | 의미 | 해결방법 |
|------|------|----------|
| 200 | 성공 | - |
| 400 | 잘못된 요청 | 요청 본문 형식 확인 |
| 429 | 요청 한도 초과 | 잠시 후 다시 시도 |
| 500 | 서버 오류 | 서버 로그 확인, 잠시 후 재시도 |

### 에러 처리 베스트 프랙티스

```javascript
async function handleYouthyAIRequest(message) {
  try {
    const response = await fetch('/api/v1/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });

    // HTTP 상태 확인
    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('요청이 너무 많습니다. 잠시 후 다시 시도해주세요.');
      } else if (response.status === 500) {
        throw new Error('서버에 일시적인 문제가 있습니다. 잠시 후 다시 시도해주세요.');
      } else {
        throw new Error(`HTTP ${response.status}: 요청을 처리할 수 없습니다.`);
      }
    }

    const data = await response.json();
    
    // API 키 오류 확인
    if (data.status === 'api_key_required') {
      throw new Error('API 키가 설정되지 않았습니다. 관리자에게 문의하세요.');
    }

    return data;
  } catch (error) {
    // 네트워크 오류
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error('서버에 연결할 수 없습니다. 인터넷 연결을 확인해주세요.');
    }
    
    // 타임아웃 오류
    if (error.name === 'AbortError') {
      throw new Error('요청 시간이 초과되었습니다. 다시 시도해주세요.');
    }

    throw error;
  }
}
```

## ❓ 자주 묻는 질문

### Q1. API 키 없이도 사용할 수 있나요?
**A:** OpenAI API 키가 없으면 AI 답변 생성이 불가능합니다. 하지만 서울시 API 키가 없어도 fallback 데이터를 통해 기본적인 정책 정보는 제공됩니다.

### Q2. 응답 시간이 오래 걸려요.
**A:** 
- OpenAI API 호출: 보통 5-10초
- 정책 데이터 검색: 1-3초  
- 총 처리시간: 보통 10초 내외
- 초기 응답 후 캐시를 통해 빠른 응답 가능

### Q3. CORS 에러가 발생해요.
**A:** 서버에서 CORS가 설정되어 있지만, 프로덕션에서는 특정 도메인만 허용하도록 수정 필요:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://yourdomain.com"],  # 실제 도메인으로 변경
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Q4. 응답에 정책이 나오지 않아요.
**A:** 
1. 검색어에 관련 키워드가 포함되어 있는지 확인
2. 카테고리별 키워드 참조 (위 표 참조)
3. 더 구체적인 질문으로 재시도
4. 예: "주거" → "서울 청년 주거지원 정책"

### Q5. 모바일에서도 사용할 수 있나요?
**A:** 네, 반응형 웹 디자인이 적용되어 있어 모바일에서도 최적화된 경험을 제공합니다.

### Q6. 실제 서비스에 적용할 때 주의사항은?
**A:**
- API 키 보안 관리 (환경변수 사용)
- 요청 빈도 제한 (Rate Limiting) 적용
- 에러 처리 및 사용자 친화적 메시지
- 로딩 상태 및 프로그레스 표시
- 캐시 전략 수립

---

## 📞 지원

- **문의**: GitHub Issues
- **문서 업데이트**: 이 문서는 API 변경사항에 따라 업데이트됩니다.
- **예제 코드**: `/examples` 폴더에서 더 많은 예시를 확인하세요.

---

**© 2025 YOUTHY AI Team. 완전한 실서비스용 구현체.**