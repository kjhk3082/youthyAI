# District Policies API Documentation

## 개요
온통청년 API를 활용하여 서울시 각 구별 청년 정책을 프론트엔드에서 바로 사용할 수 있는 형식으로 제공하는 API입니다.

## Base URL
```
http://localhost:3000/api
```

## Endpoints

### 1. 모든 구 또는 특정 구들의 정책 가져오기
```
GET /district-policies
```

#### Query Parameters
- `districts` (optional): 콤마로 구분된 구 이름들 (예: `Gangnam-gu,Seocho-gu`)
- `forceRefresh` (optional): 캐시 무시하고 새로 가져오기 (`true`/`false`)

#### Response
```json
{
  "data": {
    "Gangnam-gu": [
      {
        "id": 12345,
        "title": "강남구 청년창업 공간 입주 모집",
        "category": "창업",
        "target": "20-39세",
        "deadline": "~9/30",
        "description": "강남구 거주 청년 대상 창업 공간 입주 지원",
        "district": "강남구",
        "isHot": true,
        "isRecruiting": true,
        "image": "/img/card/card1.png",
        "metadata": {
          "applicationUrl": "https://example.com/apply",
          "applicationMethod": "온라인 신청",
          "supportAmount": "월 100만원",
          "contact": "02-1234-5678",
          "documents": "신분증, 사업계획서",
          "lastUpdate": "2025-09-06T19:30:00.000Z"
        }
      }
    ],
    "Seocho-gu": [...]
  },
  "metadata": {
    "totalPolicies": 25,
    "districts": ["Gangnam-gu", "Seocho-gu"],
    "lastUpdate": "2025-09-06T19:30:00.000Z",
    "source": "Youth Center API"
  }
}
```

### 2. 특정 구의 정책 상세 가져오기
```
GET /district-policies/:district
```

#### Parameters
- `district`: 구 이름 (예: `Gangnam-gu`)

#### Query Parameters
- `page` (optional): 페이지 번호 (기본값: 1)

#### Response
```json
{
  "district": "Gangnam-gu",
  "districtKo": "강남구",
  "policies": [...],
  "metadata": {
    "page": 1,
    "totalPolicies": 10,
    "lastUpdate": "2025-09-06T19:30:00.000Z",
    "source": "Youth Center API"
  }
}
```

### 3. 인기 정책 가져오기
```
GET /hot-policies
```

#### Response
```json
{
  "policies": [
    {
      "id": 12345,
      "title": "서울시 청년 월세 지원",
      "category": "주거",
      "isHot": true,
      ...
    }
  ],
  "metadata": {
    "totalPolicies": 10,
    "lastUpdate": "2025-09-06T19:30:00.000Z",
    "source": "Youth Center API"
  }
}
```

## 구 이름 매핑

| 영문 | 한글 |
|------|------|
| Gangnam-gu | 강남구 |
| Gangdong-gu | 강동구 |
| Gangbuk-gu | 강북구 |
| Gangseo-gu | 강서구 |
| Gwanak-gu | 관악구 |
| Gwangjin-gu | 광진구 |
| Guro-gu | 구로구 |
| Geumcheon-gu | 금천구 |
| Nowon-gu | 노원구 |
| Dobong-gu | 도봉구 |
| Dongdaemun-gu | 동대문구 |
| Dongjak-gu | 동작구 |
| Mapo-gu | 마포구 |
| Seodaemun-gu | 서대문구 |
| Seocho-gu | 서초구 |
| Seongdong-gu | 성동구 |
| Seongbuk-gu | 성북구 |
| Songpa-gu | 송파구 |
| Yangcheon-gu | 양천구 |
| Yeongdeungpo-gu | 영등포구 |
| Yongsan-gu | 용산구 |
| Eunpyeong-gu | 은평구 |
| Jongno-gu | 종로구 |
| Jung-gu | 중구 |
| Jungnang-gu | 중랑구 |

## 카테고리 매핑

| 카테고리 | 설명 |
|----------|------|
| 취업 | 취업 지원 정책 |
| 창업 | 창업 지원 정책 |
| 주거 | 주거 지원 정책 |
| 교육 | 교육 지원 정책 |
| 복지 | 복지 지원 정책 |
| 문화/예술 | 문화 예술 지원 |
| 참여권리 | 참여 권리 정책 |
| 신체건강 | 건강 관련 정책 |
| 정신건강 | 정신건강 지원 |
| 생활지원 | 생활 지원 정책 |

## 프론트엔드 통합 예제

### 1. 기존 목데이터 대체
```typescript
// Before (Mock Data)
import { districtPolicies } from '@/mock/policies';

// After (Real API)
import { useDistrictPolicies } from '@/hooks/useDistrictPolicies';

const Component = () => {
  const { policies, loading } = useDistrictPolicies();
  
  if (loading) return <Loading />;
  
  // policies를 districtPolicies 대신 사용
  return <PoliciesGrid data={policies} />;
};
```

### 2. React Query 사용 예제
```typescript
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

const fetchDistrictPolicies = async (districts?: string[]) => {
  const params = districts ? `?districts=${districts.join(',')}` : '';
  const { data } = await axios.get(`/api/district-policies${params}`);
  return data;
};

export const useDistrictPolicies = (districts?: string[]) => {
  return useQuery({
    queryKey: ['district-policies', districts],
    queryFn: () => fetchDistrictPolicies(districts),
    staleTime: 5 * 60 * 1000, // 5분
    cacheTime: 10 * 60 * 1000, // 10분
  });
};
```

### 3. Next.js SSR/SSG 예제
```typescript
// pages/policies/[district].tsx
export const getStaticProps: GetStaticProps = async ({ params }) => {
  const district = params?.district as string;
  
  const res = await fetch(`${API_URL}/api/district-policies/${district}`);
  const data = await res.json();
  
  return {
    props: {
      policies: data.policies,
      district: data.district,
    },
    revalidate: 300, // 5분마다 재생성
  };
};
```

## 특징

1. **실시간 데이터**: 온통청년 API에서 실시간으로 데이터 가져옴
2. **자동 필터링**: 마감된 정책 자동 제외
3. **캐싱**: 5분간 캐시로 성능 최적화
4. **타입 안정성**: TypeScript 타입 정의 제공
5. **프론트엔드 친화적**: 바로 사용 가능한 형식으로 제공

## 에러 처리

API 호출 실패 시:
```json
{
  "error": "Failed to fetch district policies",
  "message": "Error details here"
}
```

## 주의사항

1. Youth Center API 키가 `.env` 파일에 설정되어 있어야 함
2. 캐시는 5분간 유지되므로, 실시간 업데이트가 필요한 경우 `forceRefresh=true` 사용
3. 각 구당 최대 10개의 정책만 반환 (성능 최적화)
4. 이미지는 `/img/card/card1.png` ~ `/img/card/card4.png` 순환 할당