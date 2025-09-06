# 🛠️ YOUTHY AI - 기술 스택 상세

## 📊 개발 스택 개요

### Frontend
- **Pure JavaScript (ES6+)** - 프레임워크 없는 순수 자바스크립트
- **HTML5 & CSS3** - 시맨틱 마크업과 모던 CSS
- **Web APIs** - Fetch API, LocalStorage, History API

### Backend
- **Node.js v20.x** - JavaScript 런타임
- **Express.js 4.x** - 웹 프레임워크
- **PM2 6.x** - 프로세스 매니저 (클러스터 모드)

### Database & Storage
- **In-Memory Database** - JavaScript 객체 기반 정책 데이터베이스
- **LocalStorage** - 클라이언트 사이드 데이터 영구 저장 (스크랩 기능)
- **File System** - 로그 및 정적 파일 관리

### External APIs
- **Tavily API** - 실시간 웹 검색
- **Perplexity API** - AI 기반 정보 분석
- **Naver Maps API** - 지역 정보 및 위치 데이터
- **Youth Center API** - 청년 정책 실시간 업데이트
- **OpenAI API** (Optional) - RAG 시스템용

---

## 🏗️ 아키텍처 구조

```
youthy-ai/
├── 📁 public/                 # 정적 파일 (Frontend)
│   ├── 📁 css/
│   │   └── styles.css         # 메인 스타일시트
│   ├── 📁 js/
│   │   └── app.js            # 메인 애플리케이션 로직
│   ├── 📁 images/
│   │   └── logo.svg          # YOUTHY 로고
│   ├── index.html            # 메인 채팅 인터페이스
│   ├── scrap.html            # 스크랩 페이지
│   └── test.html             # 테스트 페이지
│
├── 📁 services/              # 백엔드 서비스
│   └── searchService.js      # 외부 API 통합 서비스
│
├── 📁 src/                   # 소스 코드
│   ├── ragSystem.js          # RAG 시스템 (Optional)
│   ├── dataFetcher.js        # 데이터 수집기
│   └── youthCenterScraper.js # 청년센터 크롤러
│
├── 📁 logs/                  # PM2 로그 파일
│   ├── out-0.log            # 표준 출력
│   └── err-0.log            # 에러 로그
│
├── app.js                    # Express 서버 메인 파일
├── ecosystem.config.js       # PM2 설정
├── package.json             # 프로젝트 의존성
├── .env                     # 환경 변수 (API 키)
└── README.md               # 프로젝트 문서
```

---

## 💻 Frontend 기술 상세

### 1. Pure JavaScript Architecture
```javascript
// No React, No Vue, No Angular - Just Pure JS
class YouthyChat {
    constructor() {
        this.messages = [];
        this.scrappedMessages = JSON.parse(localStorage.getItem('scrapped') || '[]');
    }
    
    // DOM Manipulation
    render() {
        document.getElementById('chat').innerHTML = this.generateHTML();
    }
}
```

### 2. CSS Features
- **CSS Variables** - 테마 일관성
- **Flexbox & Grid** - 반응형 레이아웃
- **CSS Animations** - 부드러운 전환 효과
- **Custom Properties** - 블루 하이라이트 시스템

```css
:root {
    --primary-blue: #007AFF;
    --highlight-blue: rgba(0, 122, 255, 0.1);
    --message-radius: 16px;
}

.highlight-blue {
    background: var(--highlight-blue);
    color: var(--primary-blue);
    padding: 2px 6px;
    border-radius: 4px;
}
```

### 3. LocalStorage 활용
```javascript
// 영구 데이터 저장
const scrapManager = {
    save(messageId, content) {
        const scraps = JSON.parse(localStorage.getItem('scraps') || '[]');
        scraps.push({ id: messageId, content, date: new Date() });
        localStorage.setItem('scraps', JSON.stringify(scraps));
    },
    
    load() {
        return JSON.parse(localStorage.getItem('scraps') || '[]');
    }
};
```

---

## 🚀 Backend 기술 상세

### 1. Express.js Middleware Stack
```javascript
app.use(helmet());           // 보안 헤더
app.use(compression());      // Gzip 압축
app.use(cors());            // CORS 처리
app.use(morgan('combined')); // 로깅
app.use(express.json());    // JSON 파싱
app.use(express.static());  // 정적 파일 서빙
```

### 2. PM2 Cluster Mode Configuration
```javascript
// ecosystem.config.js
module.exports = {
    apps: [{
        name: 'youthy-ai-chatbot',
        script: './app.js',
        instances: 'max',        // CPU 코어 수만큼 인스턴스
        exec_mode: 'cluster',    // 클러스터 모드
        watch: false,
        max_memory_restart: '1G',
        error_file: './logs/err.log',
        out_file: './logs/out.log',
        merge_logs: true,
        time: true
    }]
};
```

### 3. In-Memory Database Structure
```javascript
const policyDatabase = {
    housing: [
        {
            id: 1,
            title: "서울시 청년 월세 지원",
            description: "무주택 청년 월세 지원",
            eligibility: "만 19-39세",
            amount: "월 최대 20만원",
            region: "서울",
            category: "housing",
            keywords: ["월세", "주거", "임대"],
            priority: 1
        }
        // ... 58개 정책
    ],
    employment: [...],
    startup: [...]
};
```

---

## 🔌 External API Integration

### 1. SearchService Architecture
```javascript
class SearchService {
    constructor() {
        this.tavilyKey = process.env.TAVILY_API_KEY;
        this.perplexityKey = process.env.PERPLEXITY_API_KEY;
        this.naverClientId = process.env.NAVER_CLIENT_ID;
    }
    
    async searchComprehensive(query, region) {
        const results = await Promise.allSettled([
            this.searchTavily(query),
            this.searchPerplexity(query),
            this.searchNaverLocal(region)
        ]);
        
        return this.mergeResults(results);
    }
}
```

### 2. API Rate Limiting
```javascript
const rateLimiter = {
    tavily: { max: 100, per: 'hour' },
    perplexity: { max: 50, per: 'hour' },
    naver: { max: 25000, per: 'day' }
};
```

---

## 📦 Dependencies

### Production Dependencies
```json
{
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "body-parser": "^1.20.2",
    "compression": "^1.7.4",
    "helmet": "^7.0.0",
    "morgan": "^1.10.0",
    "dotenv": "^16.3.1",
    "axios": "^1.5.0",
    "cheerio": "^1.0.0-rc.12",
    "openai": "^4.0.0"
}
```

### Development Dependencies
```json
{
    "nodemon": "^3.0.1",
    "eslint": "^8.50.0",
    "prettier": "^3.0.3"
}
```

---

## 🔐 Security Features

### 1. Environment Variables (.env)
```bash
# API Keys (Never commit to Git!)
TAVILY_API_KEY=tvly-xxxxxxxxxxxxxxxxx
PERPLEXITY_API_KEY=pplx-xxxxxxxxxxxxxxxxx
NAVER_CLIENT_ID=xxxxxxxxxxxxxxxxx
NAVER_CLIENT_SECRET=xxxxxxxxxx
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxx
```

### 2. Security Headers (Helmet.js)
- **X-Frame-Options**: SAMEORIGIN
- **X-Content-Type-Options**: nosniff
- **X-XSS-Protection**: 1; mode=block
- **Strict-Transport-Security**: max-age=31536000

### 3. Input Sanitization
```javascript
function sanitizeInput(input) {
    return input
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '');
}
```

---

## 🚄 Performance Optimizations

### 1. Response Compression
- **Gzip Compression**: 70% 크기 감소
- **Static File Caching**: 브라우저 캐싱 활용
- **CDN Ready**: 정적 파일 CDN 배포 가능

### 2. Database Query Optimization
```javascript
// Indexed search with caching
const searchCache = new Map();

function searchPolicies(query) {
    const cacheKey = query.toLowerCase();
    
    if (searchCache.has(cacheKey)) {
        return searchCache.get(cacheKey);
    }
    
    const results = performSearch(query);
    searchCache.set(cacheKey, results);
    
    return results;
}
```

### 3. PM2 Cluster Benefits
- **Multi-core Utilization**: 모든 CPU 코어 활용
- **Zero-downtime Reload**: 무중단 배포
- **Auto-restart**: 크래시 시 자동 재시작
- **Memory Management**: 메모리 임계값 초과 시 재시작

---

## 📈 Monitoring & Logging

### 1. PM2 Monitoring
```bash
pm2 monit              # 실시간 모니터링
pm2 status            # 프로세스 상태
pm2 logs              # 로그 확인
pm2 web               # 웹 대시보드
```

### 2. Custom Logging
```javascript
const logger = {
    info: (msg) => console.log(`ℹ️  ${new Date().toISOString()}: ${msg}`),
    error: (msg) => console.error(`❌ ${new Date().toISOString()}: ${msg}`),
    success: (msg) => console.log(`✅ ${new Date().toISOString()}: ${msg}`)
};
```

---

## 🌐 Deployment Ready

### 1. Environment Support
- **Development**: `npm run dev` (nodemon)
- **Production**: `npm start` (PM2)
- **Testing**: `npm test` (Jest)

### 2. Cloud Platform Ready
- **AWS EC2**: PM2 ecosystem 지원
- **Heroku**: Procfile 지원
- **Docker**: Dockerfile 준비
- **Vercel/Netlify**: 정적 파일 호스팅

### 3. CI/CD Pipeline Ready
```yaml
# GitHub Actions Example
name: Deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm ci
      - run: npm test
      - run: pm2 deploy production
```

---

## 📋 Tech Stack Summary

| Category | Technology | Version | Purpose |
|----------|------------|---------|---------|
| **Runtime** | Node.js | v20.x | Server-side JavaScript |
| **Framework** | Express.js | 4.x | Web application framework |
| **Process Manager** | PM2 | 6.x | Production process management |
| **Language** | JavaScript | ES6+ | Full-stack development |
| **Styling** | CSS3 | Latest | Modern styling with variables |
| **Markup** | HTML5 | Latest | Semantic web structure |
| **APIs** | REST | - | API architecture |
| **Storage** | LocalStorage | - | Client-side persistence |
| **Database** | In-Memory | - | Fast policy retrieval |
| **Security** | Helmet.js | 7.x | Security headers |
| **Compression** | Gzip | - | Response compression |
| **Logging** | Morgan | 1.x | HTTP request logging |
| **Environment** | Dotenv | 16.x | Environment variables |

---

**Built with ❤️ using modern web technologies for optimal performance and user experience**