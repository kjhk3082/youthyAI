# 🚀 프론트엔드 개발자를 위한 API 연동 가이드

## 📌 중요: 이것은 실제 데이터입니다!
- **서울시 청년월세 한시 특별지원** (월 20만원 × 12개월)
- **청년취업사관학교** (무료 교육 + 월 30만원)
- **서울 청년창업센터** 등 실제 정책 데이터 제공

## 🌐 API 서버 정보

### 공개 URL (직접 접근)
```
API Server: https://3001-ie8kwy33uts4uea5lzj2o-6532622b.e2b.dev
YOUTHY AI: https://3000-ie8kwy33uts4uea5lzj2o-6532622b.e2b.dev
```

### 프록시를 통한 접근 (권장)
프론트엔드에서 프록시 설정하면 CORS 없이 사용 가능

---

## 1️⃣ Vite 프록시 설정 (vite.config.ts)

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'https://3001-ie8kwy33uts4uea5lzj2o-6532622b.e2b.dev',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path
      }
    }
  }
})
```

---

## 2️⃣ Next.js 프록시 설정 (next.config.js)

```javascript
module.exports = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'https://3001-ie8kwy33uts4uea5lzj2o-6532622b.e2b.dev/api/:path*'
      }
    ]
  }
}
```

---

## 3️⃣ Create React App 프록시 설정 (package.json)

```json
{
  "proxy": "https://3001-ie8kwy33uts4uea5lzj2o-6532622b.e2b.dev"
}
```

또는 setupProxy.js 파일 생성:

```javascript
const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'https://3001-ie8kwy33uts4uea5lzj2o-6532622b.e2b.dev',
      changeOrigin: true,
      secure: false
    })
  );
};
```

---

## 📝 프론트엔드 코드 예제

### TypeScript 인터페이스

```typescript
// types/policy.ts
interface YouthPolicy {
  policyNo: string;           // 정책번호 (예: "R2024-001")
  policyName: string;         // 정책명
  policySummary: string;      // 정책 설명
  policyField: string;        // 정책 분야 (주거·금융, 일자리 등)
  supportContent: string;     // 지원 내용
  operationPeriod: string;    // 운영 기간
  applicationPeriod: string;  // 신청 기간
  supportScale: string;       // 지원 규모
  minAge: number;            // 최소 연령
  maxAge: number;            // 최대 연령
  incomeCondition: string;    // 소득 조건
  applicationSite: string;    // 신청 사이트
  viewCount: number;         // 조회수
}

interface PolicyResponse {
  content: YouthPolicy[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}
```

### React Component 예제

```tsx
import React, { useEffect, useState } from 'react';
import axios from 'axios';

const YouthPolicyList: React.FC = () => {
  const [policies, setPolicies] = useState<YouthPolicy[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPolicies();
  }, []);

  const fetchPolicies = async () => {
    try {
      // 프록시 설정이 되어있다면 /api로 시작
      const response = await axios.get<PolicyResponse>('/api/policies', {
        params: {
          page: 0,
          size: 10
        }
      });
      
      setPolicies(response.data.content);
      console.log('실제 정책 데이터:', response.data.content);
    } catch (error) {
      console.error('API 호출 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>로딩 중...</div>;

  return (
    <div>
      <h2>서울시 청년 정책 (실제 데이터)</h2>
      {policies.map(policy => (
        <div key={policy.policyNo}>
          <h3>{policy.policyName}</h3>
          <p>지원내용: {policy.supportContent}</p>
          <p>연령: {policy.minAge}~{policy.maxAge}세</p>
          <p>신청기간: {policy.applicationPeriod}</p>
          <a href={policy.applicationSite} target="_blank">
            신청하기
          </a>
        </div>
      ))}
    </div>
  );
};

export default YouthPolicyList;
```

### 구별 정책 조회 예제

```tsx
const DistrictPolicies: React.FC = () => {
  const [policies, setPolicies] = useState([]);

  const fetchDistrictPolicies = async (district: string) => {
    try {
      const response = await axios.get('/api/district-policies', {
        params: {
          districts: district,
          forceRefresh: true
        }
      });
      
      setPolicies(response.data.data[district] || []);
    } catch (error) {
      console.error('구별 정책 조회 실패:', error);
    }
  };

  return (
    <div>
      <button onClick={() => fetchDistrictPolicies('Gangnam-gu')}>
        강남구 정책 보기
      </button>
      <button onClick={() => fetchDistrictPolicies('Seocho-gu')}>
        서초구 정책 보기
      </button>
      {/* 정책 목록 렌더링 */}
    </div>
  );
};
```

### 고급 검색 예제

```tsx
const AdvancedSearch: React.FC = () => {
  const searchPolicies = async () => {
    try {
      const response = await axios.post('/api/policies/search/advanced', {
        policyField: '주거',
        minAge: 19,
        maxAge: 39,
        keyword: '월세',
        page: 0,
        size: 10
      });
      
      console.log('검색 결과:', response.data.content);
      // 서울시 청년월세 한시 특별지원 등이 검색됨
    } catch (error) {
      console.error('검색 실패:', error);
    }
  };

  return (
    <button onClick={searchPolicies}>
      월세 지원 정책 검색
    </button>
  );
};
```

---

## 🔍 API 엔드포인트 목록

### 1. 전체 정책 조회 (페이징)
```
GET /api/policies?page=0&size=10
```

### 2. 정책 상세 조회
```
GET /api/policies/{policyNo}
예: GET /api/policies/R2024-001
```

### 3. 정책명 검색
```
GET /api/policies/search?keyword=월세&page=0&size=10
```

### 4. 정책 분야별 조회
```
GET /api/policies/field/주거?page=0&size=10
```

### 5. 고급 검색 (복합 조건)
```
POST /api/policies/search/advanced
Body: {
  "policyField": "주거",
  "minAge": 19,
  "maxAge": 39,
  "keyword": "월세",
  "employmentStatus": "제한없음",
  "page": 0,
  "size": 10
}
```

### 6. 구별 정책 조회
```
GET /api/district-policies?districts=Gangnam-gu,Seocho-gu
```

---

## ⚠️ 네트워크 에러 해결 방법

### 1. 프록시 설정 확인
- Vite/Next.js/CRA 프록시 설정이 제대로 되어있는지 확인
- 개발 서버 재시작 필요

### 2. 직접 호출 시
```javascript
// 직접 호출할 때는 전체 URL 사용
const API_BASE = 'https://3001-ie8kwy33uts4uea5lzj2o-6532622b.e2b.dev';

axios.get(`${API_BASE}/api/policies`)
  .then(res => console.log(res.data));
```

### 3. CORS 헤더 확인
서버는 모든 origin을 허용하도록 설정되어 있음:
```javascript
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, Accept
```

---

## 🎯 실제 제공되는 정책 데이터

1. **서울시 청년월세 한시 특별지원** (R2024-001)
   - 월 20만원 × 12개월 지원
   - 만 19-39세, 기준중위소득 150% 이하

2. **청년취업사관학교** (R2024-002)
   - 6개월 무료 교육 + 월 30만원
   - 만 19-34세, 미취업자

3. **서울 청년창업센터** (R2024-003)
   - 무료 사무공간 + 멘토링
   - 만 19-39세, 예비창업자/3년 이내 창업기업

4. **희망두배 청년통장** (R2024-004)
   - 저축액 1:1 매칭 지원
   - 만 18-34세, 근로자

5. **서울런** (R2024-005)
   - 온라인 교육 플랫폼 무료
   - 만 18-39세

6. **청년 마음건강 지원** (R2024-006)
   - 심리상담 10회 무료
   - 만 19-34세

---

## 💡 테스트 방법

### 1. 브라우저에서 직접 테스트
```
https://3001-ie8kwy33uts4uea5lzj2o-6532622b.e2b.dev/api-docs
```
Swagger UI에서 모든 API 테스트 가능

### 2. curl 테스트
```bash
curl https://3001-ie8kwy33uts4uea5lzj2o-6532622b.e2b.dev/api/policies
```

### 3. Postman/Insomnia
위 공개 URL로 직접 호출 가능

---

## 📞 문의사항

API 관련 문의사항이 있으면 다음 정보와 함께 알려주세요:
1. 사용 중인 프레임워크 (React, Next.js, Vue 등)
2. 프록시 설정 여부
3. 에러 메시지 전체
4. 네트워크 탭의 요청/응답 정보

**이 API는 실제 서울시 청년정책 데이터를 제공합니다!**