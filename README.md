# 🚀 YOUTHY AI - 대한민국 전 지역 청년정책 AI 챗봇

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-v20.0%2B-green)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-4.x-blue)](https://expressjs.com/)
[![PM2](https://img.shields.io/badge/PM2-Process%20Manager-purple)](https://pm2.keymetrics.io/)

> **🎯 전국 17개 시도 + 100개 이상 도시의 청년정책을 완벽 지원하는 AI 챗봇**
> 
> 한국 청년들을 위한 맞춤형 정책 안내 서비스 - "전국 다 넣어줄래? 전국 다!!" ✨

## 🌟 주요 특징

### 🗺️ 전국 모든 지역 지원
- **17개 시도 완벽 지원**: 서울, 부산, 대구, 인천, 광주, 대전, 울산, 세종, 경기, 강원, 충북, 충남, 전북, 전남, 경북, 경남, 제주
- **100+ 도시 자동 인식**: "춘천", "전주", "창원" 등 도시명 입력 시 자동으로 해당 지역 정책 표시
- **54개 지역별 맞춤 정책 + 4개 전국 정책**

### 🤖 AI 기반 스마트 기능

#### 1️⃣ **지능형 정책 매칭 시스템**
```javascript
// 사용자 질문: "부산 청년 정책 알려줘"
// AI 응답:
{
  "주거 지원": ["부산 청년 월세 지원 - 월 최대 10만원"],
  "취업 지원": ["부산 청년 구직활동 지원금 - 월 50만원"],
  "창업 지원": ["부산 청년 창업 펀드 - 최대 5천만원"]
}
```

#### 2️⃣ **자연어 처리 (NLP)**
- 다양한 표현 이해: "월세 지원", "집 구하기 도와줘", "주거비 부담" → 모두 주거 정책으로 인식
- 지역 방언/별칭 인식: "부산", "부산시", "해운대" → 부산 정책 표시
- 복합 질문 처리: "25살 대학생인데 서울에서 창업하려고 해" → 나이, 신분, 지역, 목적 동시 파악

#### 3️⃣ **컨텍스트 기반 대화**
- 이전 대화 내용 기억
- 후속 질문 자동 생성
- 개인화된 정책 추천

#### 4️⃣ **실시간 API 통합** (SearchService)
- **Tavily API**: 최신 정책 뉴스 검색
- **Perplexity API**: AI 기반 정책 분석
- **Naver Maps API**: 청년센터 위치 정보
- **Youth Center API**: 실시간 정책 업데이트

### 💎 혁신적인 UX/UI

#### 🎨 **스마트 하이라이팅 시스템**
```html
<!-- 자동으로 중요 정보를 파란색으로 강조 -->
<span class="highlight-blue">만 19-34세</span> 청년에게
<span class="highlight-blue">월 최대 20만원</span>을
<span class="highlight-blue">12개월간</span> 지원
```

#### 📌 **정책 스크랩 기능**
- 원클릭으로 관심 정책 저장
- localStorage 기반 영구 보관
- 스크랩 페이지에서 한눈에 확인

#### 🔄 **실시간 응답 스트리밍**
- ChatGPT 스타일 타이핑 애니메이션
- 청크 단위 실시간 렌더링
- 부드러운 스크롤 효과

## 🛠️ 기술 스택 & 아키텍처

### Backend Architecture
```
┌─────────────────────────────────────────────┐
│              Express.js Server              │
│                  (PM2 관리)                  │
├─────────────────────────────────────────────┤
│           Middleware Layer                  │
│  - Helmet (보안)                            │
│  - Compression (성능)                       │
│  - CORS (크로스 오리진)                     │
│  - Morgan (로깅)                            │
├─────────────────────────────────────────────┤
│          Core Services                      │
│  ┌──────────────┐  ┌──────────────┐       │
│  │ RAG System   │  │Search Service│       │
│  │ (Optional)   │  │   (APIs)     │       │
│  └──────────────┘  └──────────────┘       │
├─────────────────────────────────────────────┤
│         Policy Database                     │
│  - 54 Regional Policies                    │
│  - 4 National Policies                     │
│  - Real-time Updates                       │
└─────────────────────────────────────────────┘
```

### Frontend Features
```
┌─────────────────────────────────────────────┐
│           YOUTHY AI Interface               │
├─────────────────────────────────────────────┤
│  ┌──────────────────────────────────────┐  │
│  │     Smart Chat Interface             │  │
│  │  - Natural Language Input            │  │
│  │  - Blue Highlighting System          │  │
│  │  - Real-time Streaming               │  │
│  └──────────────────────────────────────┘  │
│                                             │
│  ┌──────────────────────────────────────┐  │
│  │     Policy Scrap System              │  │
│  │  - One-click Save                    │  │
│  │  - Persistent Storage                │  │
│  │  - Category Organization             │  │
│  └──────────────────────────────────────┘  │
│                                             │
│  ┌──────────────────────────────────────┐  │
│  │     Regional Navigation              │  │
│  │  - 17 Regions Support                │  │
│  │  - 100+ Cities Mapping               │  │
│  │  - Auto Region Detection             │  │
│  └──────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

## 🚀 빠른 시작

### 1. 클론 및 설치
```bash
# 저장소 클론
git clone https://github.com/kjhk3082/youthyAI.git
cd youthyAI

# 의존성 설치
npm install
```

### 2. 환경 설정
```bash
# .env 파일 생성 및 API 키 설정
cp .env.example .env

# .env 파일 편집
TAVILY_API_KEY=your-tavily-api-key
PERPLEXITY_API_KEY=your-perplexity-api-key
NAVER_CLIENT_ID=your-naver-client-id
NAVER_CLIENT_SECRET=your-naver-client-secret
OPENAI_API_KEY=your-openai-api-key  # Optional for RAG
```

### 3. 서버 실행
```bash
# PM2로 프로덕션 실행
npm start

# 또는 개발 모드
npm run dev

# 서버 상태 확인
pm2 status
```

### 4. 접속
- **로컬**: http://localhost:3000
- **건강 체크**: http://localhost:3000/api/health
- **테스트 페이지**: http://localhost:3000/test

## 📊 정책 데이터베이스 구조

### 지역별 정책 분포
| 지역 | 주거 지원 | 취업 지원 | 창업 지원 | 총 정책 수 |
|------|-----------|-----------|-----------|------------|
| 서울 | ✅ | ✅ | ❌ | 2 |
| 부산 | ✅ | ✅ | ✅ | 3 |
| 대구 | ✅ | ✅ | ✅ | 3 |
| 인천 | ✅ | ❌ | ❌ | 1 |
| 광주 | ✅ | ✅ | ✅ | 3 |
| 대전 | ✅ | ✅ | ✅ | 3 |
| 울산 | ✅ | ✅ | ✅ | 3 |
| 세종 | ✅ | ✅ | ✅ | 3 |
| 경기 | ✅ | ✅ | ✅ | 3 |
| 강원 | ✅ | ✅ | ❌ | 4 |
| 충북 | ✅ | ✅ | ✅ | 3 |
| 충남 | ✅ | ✅ | ✅ | 3 |
| 전북 | ✅ | ✅ | ✅ | 3 |
| 전남 | ✅ | ✅ | ✅ | 3 |
| 경북 | ✅ | ✅ | ✅ | 3 |
| 경남 | ✅ | ✅ | ✅ | 3 |
| 제주 | ✅ | ✅ | ✅ | 3 |
| **전국** | ✅ | ✅ | ✅ | 4 |
| **합계** | **18** | **17** | **16** | **58** |

## 🔥 AI 개발 특장점

### 1. **지능형 의도 분석 (Intent Analysis)**
```javascript
function analyzeIntent(message) {
    // 17개 시도 + 100개 도시 자동 인식
    // 정책 카테고리 자동 분류
    // 사용자 상황 컨텍스트 파악
}
```

### 2. **다중 API 병렬 처리**
```javascript
async searchComprehensive(query, region) {
    // Promise.allSettled로 3개 API 동시 호출
    // 실패해도 다른 API 결과 사용
    // 지역별 맞춤 검색 최적화
}
```

### 3. **스마트 하이라이팅 엔진**
```javascript
// 자동으로 중요 정보 감지 및 강조
const patterns = [
    /만\s*\d+[-~]\d+세/,  // 나이
    /월\s*최대?\s*\d+만원/, // 금액
    /\d+개월/,            // 기간
    // ... 20+ 패턴
];
```

### 4. **RAG 시스템 통합 (Optional)**
- OpenAI Embeddings 기반 벡터 검색
- 정책 문서 자동 임베딩
- 시맨틱 유사도 기반 매칭

### 5. **실시간 데이터 스크래핑**
- Youth Center API 실시간 연동
- 서울시 열린데이터광장 크롤링
- 24시간 주기 자동 업데이트

### 6. **고급 에러 핸들링**
```javascript
// Graceful Degradation
if (externalAPI.fails()) {
    return localDatabase.search();
}
```

### 7. **성능 최적화**
- Response Compression (gzip)
- Static File Caching
- Database Query Optimization
- PM2 Cluster Mode (멀티 프로세스)

## 📱 API 엔드포인트

### 메인 채팅 API
```http
POST /api/chat
Content-Type: application/json

{
  "message": "부산 청년 정책 알려줘",
  "context": {
    "region": "부산",
    "age": 25
  }
}
```

**Response:**
```json
{
  "message": "부산 청년 지원 정책을 안내해드립니다...",
  "references": [
    {
      "title": "부산 청년 월세 지원",
      "url": "https://www.busan.go.kr/young",
      "snippet": "월 최대 10만원 지원"
    }
  ],
  "followUpQuestions": [
    "부산 월세 지원 신청 방법은?",
    "부산 청년수당 자격 조건은?"
  ]
}
```

### 시스템 상태 확인
```http
GET /api/health
```

**Response:**
```json
{
  "status": "healthy",
  "policies_count": 58,
  "uptime": 3600,
  "memory": {
    "rss": 68000000,
    "heapUsed": 32000000
  }
}
```

## 🎯 사용 예시

### 💬 실제 대화 예시

**사용자**: "제주도 청년 정책 알려줘"

**YOUTHY AI**:
```
**제주 청년 지원 정책**

제주 지역 청년들을 위한 맞춤형 지원 정책을 안내해드립니다.

🏠 **주거 지원**
• 제주특별자치도 청년 월세 지원
  - 월 최대 20만원 (12개월간)
  - 만 19-34세 제주 거주 무주택 청년

💼 **취업/구직 지원**
• 제주 청년 수당
  - 월 50만원 (최대 6개월)
  - 만 19-34세 제주 거주 미취업 청년

🚀 **창업 지원**
• 제주 청년 창업 지원
  - 최대 5천만원
  - 만 19-39세 제주 거주 예비창업자

💡 더 자세한 정보는 제주 청년포털이나 해당 기관 홈페이지를 방문해주세요.
```

## 🔧 개발자 가이드

### 새로운 지역 정책 추가
```javascript
// app.js의 policyDatabase에 추가
const policyDatabase = {
    housing: [
        {
            id: 100,
            title: "새로운 지역 월세 지원",
            description: "지원 내용",
            eligibility: "자격 조건",
            amount: "지원 금액",
            url: "https://example.com",
            region: "지역명"
        }
    ]
};
```

### 새로운 API 서비스 추가
```javascript
// services/searchService.js
async searchNewAPI(query) {
    const response = await axios.get('https://api.example.com', {
        params: { q: query }
    });
    return this.processResults(response.data);
}
```

## 🤝 기여하기

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 라이선스

MIT License - 자유롭게 사용, 수정, 배포 가능합니다.

## 🙏 감사의 말

- 모든 한국 청년들을 위해 만들어진 서비스입니다
- 청년정책 정보를 제공해주신 정부 기관들께 감사드립니다
- 오픈소스 커뮤니티의 기여에 감사드립니다

## 📞 문의 및 지원

- kjhk3082@naver.com 기획 김재형

- **GitHub Issues**: [https://github.com/kjhk3082/youthyAI/issues](https://github.com/kjhk3082/youthyAI/issues)
- **Pull Requests**: [https://github.com/kjhk3082/youthyAI/pulls](https://github.com/kjhk3082/youthyAI/pulls)

---

**Made with ❤️ for Korean Youth by YOUTHY AI Team**

*"청년정책 지도에서 콕! 전국 다!!" - 이제 모든 지역의 청년 정책을 한 곳에서!* 🚀
