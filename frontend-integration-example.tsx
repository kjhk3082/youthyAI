/**
 * 프론트엔드 개발자를 위한 API 통합 예제
 * 
 * 이 파일은 기존 Mock 데이터를 실제 API 데이터로 교체하는 방법을 보여줍니다.
 * localhost:3000에서 개발 중인 프론트엔드에서 바로 사용 가능합니다.
 */

import React, { useEffect, useState } from 'react';
import axios from 'axios';

// ============================================
// 1. TypeScript 인터페이스 정의 (기존과 동일)
// ============================================
interface Policy {
  id: number;
  title: string;
  category: '취업' | '창업' | '주거' | '교육' | '복지' | '문화/예술' | '참여권리' | '신체건강' | '정신건강' | '생활지원';
  target: string;
  deadline: string;
  description: string;
  district: string;
  isHot: boolean;
  isRecruiting: boolean;
  image: string;
  metadata?: {
    applicationUrl?: string;
    applicationMethod?: string;
    supportAmount?: string;
    contact?: string;
    documents?: string;
    lastUpdate?: string;
  };
}

interface DistrictPolicies {
  [district: string]: Policy[];
}

// ============================================
// 2. API 설정
// ============================================
const API_BASE = 'http://localhost:3001'; // API 서버 주소

// Axios 인스턴스 생성 (선택사항)
const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ============================================
// 3. API 호출 함수들
// ============================================

/**
 * 모든 구의 정책 가져오기
 * 기존 mock 데이터를 완전히 대체합니다
 */
export const fetchAllDistrictPolicies = async (): Promise<DistrictPolicies> => {
  try {
    const response = await apiClient.get('/api/district-policies');
    
    // response.data.data가 실제 정책 데이터
    // response.data.metadata에는 추가 정보 (총 개수, 데이터 소스 등)
    console.log('데이터 소스:', response.data.metadata.source); // "Youth Center API" or "mock"
    console.log('총 정책 수:', response.data.metadata.totalPolicies);
    
    return response.data.data;
  } catch (error) {
    console.error('정책 데이터 로드 실패:', error);
    // 에러 발생시 빈 객체 반환 또는 기존 mock 데이터 사용
    return {};
  }
};

/**
 * 특정 구들의 정책만 가져오기
 * @param districts - 구 이름 배열 (예: ['Gangnam-gu', 'Seocho-gu'])
 */
export const fetchSelectedDistrictPolicies = async (
  districts: string[]
): Promise<DistrictPolicies> => {
  try {
    const response = await apiClient.get('/api/district-policies', {
      params: {
        districts: districts.join(',')
      }
    });
    
    return response.data.data;
  } catch (error) {
    console.error('선택한 구의 정책 로드 실패:', error);
    return {};
  }
};

/**
 * 단일 구의 상세 정책 가져오기
 * @param district - 구 이름 (예: 'Gangnam-gu')
 */
export const fetchSingleDistrictPolicies = async (
  district: string
): Promise<Policy[]> => {
  try {
    const response = await apiClient.get(`/api/district-policies/${district}`);
    return response.data.policies;
  } catch (error) {
    console.error(`${district} 정책 로드 실패:`, error);
    return [];
  }
};

/**
 * 인기 정책만 가져오기
 */
export const fetchHotPolicies = async (): Promise<Policy[]> => {
  try {
    const response = await apiClient.get('/api/hot-policies');
    return response.data.policies;
  } catch (error) {
    console.error('인기 정책 로드 실패:', error);
    return [];
  }
};

// ============================================
// 4. React 컴포넌트 예제
// ============================================

/**
 * 정책 목록을 표시하는 컴포넌트
 */
export const DistrictPoliciesComponent: React.FC = () => {
  const [policies, setPolicies] = useState<DistrictPolicies>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<string>('');

  useEffect(() => {
    loadPolicies();
  }, []);

  const loadPolicies = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await apiClient.get('/api/district-policies');
      setPolicies(response.data.data);
      setDataSource(response.data.metadata.source);
      
    } catch (err) {
      setError('정책 데이터를 불러오는데 실패했습니다.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>정책 데이터를 불러오는 중...</div>;
  }

  if (error) {
    return <div>에러: {error}</div>;
  }

  return (
    <div>
      <h2>서울시 청년 정책</h2>
      <p>데이터 소스: {dataSource === 'Youth Center API' ? '청년센터 실시간 데이터' : 'Mock 데이터'}</p>
      
      {Object.entries(policies).map(([district, districtPolicies]) => (
        <div key={district}>
          <h3>{district}</h3>
          <div className="policy-grid">
            {districtPolicies.map(policy => (
              <PolicyCard key={policy.id} policy={policy} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * 개별 정책 카드 컴포넌트
 */
const PolicyCard: React.FC<{ policy: Policy }> = ({ policy }) => {
  return (
    <div className="policy-card">
      <img src={policy.image} alt={policy.title} />
      <h4>{policy.title}</h4>
      <div className="badges">
        <span className="category">{policy.category}</span>
        {policy.isHot && <span className="hot">🔥 인기</span>}
        {policy.isRecruiting && <span className="recruiting">모집중</span>}
      </div>
      <p>{policy.description}</p>
      <div className="info">
        <span>대상: {policy.target}</span>
        <span>마감: {policy.deadline}</span>
        <span>지역: {policy.district}</span>
      </div>
      {policy.metadata?.supportAmount && (
        <div className="support">지원금: {policy.metadata.supportAmount}</div>
      )}
      {policy.metadata?.applicationUrl && (
        <a href={policy.metadata.applicationUrl} target="_blank" rel="noopener noreferrer">
          신청하기
        </a>
      )}
    </div>
  );
};

// ============================================
// 5. 기존 Mock 데이터 대체 방법
// ============================================

// 방법 1: 직접 export 변수 대체
export let districtPolicies: DistrictPolicies = {};

// 앱 초기화시 실제 데이터로 교체
export const initializeDistrictPolicies = async () => {
  districtPolicies = await fetchAllDistrictPolicies();
};

// 방법 2: Custom Hook 사용
export const useDistrictPolicies = () => {
  const [policies, setPolicies] = useState<DistrictPolicies>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAllDistrictPolicies().then(data => {
      setPolicies(data);
      setLoading(false);
    });
  }, []);

  return { policies, loading };
};

// ============================================
// 6. Next.js에서 사용하는 경우
// ============================================

// Server-side rendering
export async function getServerSideProps() {
  const policies = await fetchAllDistrictPolicies();
  
  return {
    props: {
      districtPolicies: policies,
    },
  };
}

// Static generation
export async function getStaticProps() {
  const policies = await fetchAllDistrictPolicies();
  
  return {
    props: {
      districtPolicies: policies,
    },
    revalidate: 3600, // 1시간마다 재생성
  };
}

// ============================================
// 7. 주의사항 및 팁
// ============================================

/**
 * 📌 중요 참고사항:
 * 
 * 1. CORS 이슈 해결됨
 *    - localhost:3000에서 API 호출 가능
 *    - 별도의 프록시 설정 불필요
 * 
 * 2. 데이터 형식
 *    - API 반환 데이터는 TypeScript 인터페이스와 100% 일치
 *    - 별도의 변환 작업 불필요
 * 
 * 3. 실시간 vs Mock 데이터
 *    - metadata.source로 구분 가능
 *    - "Youth Center API": 청년센터 실시간 데이터
 *    - "mock": 자동 생성된 Mock 데이터 (API 타임아웃시)
 * 
 * 4. 이미지 경로
 *    - 상대 경로로 제공 (/img/card/card1.png)
 *    - 프론트엔드 public 폴더에 이미지 필요
 * 
 * 5. 캐싱
 *    - API는 5분간 캐싱
 *    - forceRefresh=true 파라미터로 강제 새로고침 가능
 * 
 * 6. 에러 처리
 *    - API 실패시 빈 객체/배열 반환
 *    - 프론트엔드에서 적절한 에러 UI 표시 필요
 */

export default DistrictPoliciesComponent;