const express = require('express');
const axios = require('axios');
const router = express.Router();
require('dotenv').config();

// 지역구 매핑 (영문 -> 한글 -> API 코드)
const DISTRICT_MAPPING = {
  'Gangnam-gu': { ko: '강남구', code: '003002001001001' },
  'Gangdong-gu': { ko: '강동구', code: '003002001001002' },
  'Gangbuk-gu': { ko: '강북구', code: '003002001001003' },
  'Gangseo-gu': { ko: '강서구', code: '003002001001004' },
  'Gwanak-gu': { ko: '관악구', code: '003002001001005' },
  'Gwangjin-gu': { ko: '광진구', code: '003002001001006' },
  'Guro-gu': { ko: '구로구', code: '003002001001007' },
  'Geumcheon-gu': { ko: '금천구', code: '003002001001008' },
  'Nowon-gu': { ko: '노원구', code: '003002001001009' },
  'Dobong-gu': { ko: '도봉구', code: '003002001001010' },
  'Dongdaemun-gu': { ko: '동대문구', code: '003002001001011' },
  'Dongjak-gu': { ko: '동작구', code: '003002001001012' },
  'Mapo-gu': { ko: '마포구', code: '003002001001013' },
  'Seodaemun-gu': { ko: '서대문구', code: '003002001001014' },
  'Seocho-gu': { ko: '서초구', code: '003002001001015' },
  'Seongdong-gu': { ko: '성동구', code: '003002001001016' },
  'Seongbuk-gu': { ko: '성북구', code: '003002001001017' },
  'Songpa-gu': { ko: '송파구', code: '003002001001018' },
  'Yangcheon-gu': { ko: '양천구', code: '003002001001019' },
  'Yeongdeungpo-gu': { ko: '영등포구', code: '003002001001020' },
  'Yongsan-gu': { ko: '용산구', code: '003002001001021' },
  'Eunpyeong-gu': { ko: '은평구', code: '003002001001022' },
  'Jongno-gu': { ko: '종로구', code: '003002001001023' },
  'Jung-gu': { ko: '중구', code: '003002001001024' },
  'Jungnang-gu': { ko: '중랑구', code: '003002001001025' }
};

// 카테고리 매핑
const CATEGORY_MAPPING = {
  '003002001': '취업',
  '003002002': '창업',
  '003002003': '주거',
  '003002004': '교육',
  '003002005': '복지',
  '003002006': '문화/예술',
  '003002007': '참여권리',
  '003002008': '신체건강',
  '003002009': '정신건강',
  '003002010': '생활지원'
};

// 목데이터 생성 (API 키가 없거나 실패 시 사용)
function generateMockData(districtCode) {
  const categories = Object.values(CATEGORY_MAPPING);
  const districtName = Object.entries(DISTRICT_MAPPING).find(([k, v]) => v.code === districtCode)?.[1]?.ko || '서울';
  
  const mockPolicies = [
    {
      polyBizSjnm: `${districtName} 청년창업 공간 입주 모집`,
      polyBizTy: '003002002',
      polyBizCn: `${districtName} 거주 청년 대상 창업 공간 입주 지원. 월 임대료 지원 및 멘토링 프로그램 제공`,
      ageInfo: '만 19세 ~ 39세',
      rqutPrdEnd: '2025-09-30',
      rqutProcCn: '온라인 신청',
      applUrl: 'https://www.youthcenter.go.kr',
      sporCn: '월 50만원 임대료 지원'
    },
    {
      polyBizSjnm: `${districtName} 청년 주거 지원 프로그램`,
      polyBizTy: '003002003',
      polyBizCn: `${districtName} 거주 청년 대상 전세자금 대출 지원. 최대 1억원까지 저금리 대출`,
      ageInfo: '만 20세 ~ 39세',
      rqutPrdEnd: '2025-10-15',
      rqutProcCn: '방문 신청',
      applUrl: 'https://housing.seoul.go.kr',
      sporCn: '최대 1억원, 연 1.2%'
    },
    {
      polyBizSjnm: `${districtName} 청년 취업 준비 프로그램`,
      polyBizTy: '003002001',
      polyBizCn: `${districtName} 거주 청년 대상 취업 준비 교육 및 상담. 이력서 컨설팅 및 면접 코칭 제공`,
      ageInfo: '만 19세 ~ 34세',
      rqutPrdEnd: '2025-09-25',
      rqutProcCn: '온라인 신청',
      applUrl: 'https://job.seoul.go.kr',
      sporCn: '교육비 전액 무료'
    },
    {
      polyBizSjnm: `${districtName} 청년 문화 활동 지원`,
      polyBizTy: '003002006',
      polyBizCn: `${districtName} 거주 청년 대상 문화 활동비 지원. 연극, 영화, 전시 관람료 지원`,
      ageInfo: '만 19세 ~ 39세',
      rqutPrdEnd: '2025-09-20',
      rqutProcCn: '온라인/오프라인',
      applUrl: 'https://culture.seoul.go.kr',
      sporCn: '연 20만원 문화바우처'
    },
    {
      polyBizSjnm: `${districtName} 청년 건강검진 지원`,
      polyBizTy: '003002008',
      polyBizCn: `${districtName} 거주 청년 대상 종합 건강검진 지원. 기본 건강검진 및 정신건강 상담 제공`,
      ageInfo: '만 20세 ~ 39세',
      rqutPrdEnd: '상시',
      rqutProcCn: '병원 방문',
      applUrl: 'https://health.seoul.go.kr',
      sporCn: '검진비 50% 지원'
    }
  ];
  
  return mockPolicies;
}

// 캐시 설정 (5분)
const cache = new Map();
const CACHE_DURATION = 5 * 60 * 1000;

// D-Day 계산
function calculateDDay(endDate) {
  if (!endDate || endDate === '상시' || endDate === '상시모집') {
    return '상시모집';
  }
  
  try {
    const end = new Date(endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    
    const diffTime = end - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return null; // 마감된 정책
    } else if (diffDays === 0) {
      return '~오늘';
    } else if (diffDays <= 30) {
      const endMonth = end.getMonth() + 1;
      const endDay = end.getDate();
      return `~${endMonth}/${endDay}`;
    } else {
      const endMonth = end.getMonth() + 1;
      const endDay = end.getDate();
      return `~${endMonth}/${endDay}`;
    }
  } catch (error) {
    return '날짜 확인 필요';
  }
}

// 나이 대상 포맷팅
function formatTarget(ageInfo, edubg) {
  if (!ageInfo) return '청년';
  
  // 나이 정보 파싱
  const ageMatch = ageInfo.match(/(\d+).*?(\d+)/);
  if (ageMatch) {
    return `${ageMatch[1]}-${ageMatch[2]}세`;
  }
  
  if (ageInfo.includes('청년')) {
    return '20-39세';
  }
  
  if (ageInfo.includes('모든') || ageInfo.includes('전체')) {
    return '모든 성인';
  }
  
  return ageInfo;
}

// Youth Center API 호출
async function fetchFromYouthCenter(districtCode, page = 1) {
  if (!process.env.YOUTHCENTER_API_KEY) {
    console.error('Youth Center API key not configured');
    // 임시 목데이터 반환 (API 키가 없을 때)
    return generateMockData(districtCode);
  }
  
  try {
    // 서울 전체 정책 가져오기 (구별 필터링은 클라이언트에서)
    const response = await axios.get('https://www.youthcenter.go.kr/opi/openApiPolicyList.do', {
      params: {
        apiKey: process.env.YOUTHCENTER_API_KEY,
        display: 50,
        pageIndex: page,
        srchPolyBizArea: '003002001001', // 서울 전체
        bizTycdSel: '003002001,003002002,003002003,003002004,003002005,003002006,003002007,003002008,003002009,003002010'
      },
      timeout: 10000
    });
    
    const policies = response.data?.policyList || [];
    return policies;
  } catch (error) {
    console.error('Youth Center API error:', error.message);
    // API 실패 시 목데이터 반환
    return generateMockData(districtCode);
  }
}

// 정책 데이터를 프론트엔드 형식으로 변환
function transformPolicy(policy, districtName, index) {
  const deadline = calculateDDay(policy.rqutPrdEnd || policy.rqutPrdCn);
  
  // 마감된 정책은 제외
  if (!deadline) {
    return null;
  }
  
  // 카테고리 결정
  let category = '기타';
  if (policy.polyBizTy) {
    const categoryCode = policy.polyBizTy.substring(0, 9);
    category = CATEGORY_MAPPING[categoryCode] || '기타';
  }
  
  // 핫 정책 판단 (조회수, 신청자 수 등으로 판단 - API에서 제공시)
  const isHot = index < 3; // 상위 3개를 핫으로 표시 (실제로는 조회수 등으로 판단)
  
  return {
    id: policy.polyBizSjnm ? policy.polyBizSjnm.hashCode() : Math.random() * 100000,
    title: policy.polyBizSjnm || '제목 없음',
    category: category,
    target: formatTarget(policy.ageInfo, policy.edubgReqmCn),
    deadline: deadline,
    description: policy.polyBizCn || policy.polyItcnCn || '상세 내용 참조',
    district: districtName,
    isHot: isHot,
    isRecruiting: deadline !== null,
    image: `/img/card/card${(index % 4) + 1}.png`, // 순환하며 이미지 할당
    // 추가 정보 (프론트에서 필요시 사용)
    metadata: {
      applicationUrl: policy.applUrl || policy.rfcSiteUrl,
      applicationMethod: policy.rqutProcCn,
      supportAmount: policy.sporCn,
      contact: policy.rfcSiteUrl,
      documents: policy.pstnPaprCn,
      lastUpdate: new Date().toISOString()
    }
  };
}

// String.hashCode 확장 (안정적인 ID 생성용)
String.prototype.hashCode = function() {
  let hash = 0;
  for (let i = 0; i < this.length; i++) {
    const char = this.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
};

// 메인 API 엔드포인트
router.get('/district-policies', async (req, res) => {
  const { districts, forceRefresh } = req.query;
  
  // 캐시 확인
  const cacheKey = districts || 'all';
  if (!forceRefresh && cache.has(cacheKey)) {
    const cached = cache.get(cacheKey);
    if (Date.now() - cached.timestamp < CACHE_DURATION) {
      return res.json(cached.data);
    }
  }
  
  try {
    const result = {};
    const requestedDistricts = districts ? districts.split(',') : Object.keys(DISTRICT_MAPPING);
    
    // 병렬로 모든 구의 정책 가져오기
    const promises = requestedDistricts.map(async (districtEn) => {
      const districtInfo = DISTRICT_MAPPING[districtEn];
      if (!districtInfo) {
        return { district: districtEn, policies: [] };
      }
      
      const policies = await fetchFromYouthCenter(districtInfo.code);
      const transformed = policies
        .map((p, i) => transformPolicy(p, districtInfo.ko, i))
        .filter(p => p !== null) // 마감된 정책 제외
        .slice(0, 10); // 각 구당 최대 10개
      
      return { district: districtEn, policies: transformed };
    });
    
    const results = await Promise.all(promises);
    
    // 결과 정리
    results.forEach(({ district, policies }) => {
      result[district] = policies;
    });
    
    // API 실패 여부 체크 (모든 데이터가 동일한지 확인)
    const isMockData = Object.values(result).every(policies => 
      policies.length > 0 && 
      policies[0]?.title?.includes('청년창업 공간 입주 모집')
    );
    
    // 캐시 저장
    const responseData = {
      data: result,
      metadata: {
        totalPolicies: Object.values(result).reduce((sum, arr) => sum + arr.length, 0),
        districts: Object.keys(result),
        lastUpdate: new Date().toISOString(),
        source: isMockData ? 'mock' : 'Youth Center API',
        notice: isMockData ? '청년센터 API 연결 실패로 Mock 데이터를 제공합니다' : undefined
      }
    };
    
    cache.set(cacheKey, { data: responseData, timestamp: Date.now() });
    
    res.json(responseData);
  } catch (error) {
    console.error('District policies API error:', error);
    res.status(500).json({
      error: 'Failed to fetch district policies',
      message: error.message
    });
  }
});

// 특정 구의 정책만 가져오기
router.get('/district-policies/:district', async (req, res) => {
  const { district } = req.params;
  const { page = 1 } = req.query;
  
  const districtInfo = DISTRICT_MAPPING[district];
  if (!districtInfo) {
    return res.status(404).json({
      error: 'District not found',
      availableDistricts: Object.keys(DISTRICT_MAPPING)
    });
  }
  
  // 캐시 확인
  const cacheKey = `${district}_${page}`;
  if (cache.has(cacheKey)) {
    const cached = cache.get(cacheKey);
    if (Date.now() - cached.timestamp < CACHE_DURATION) {
      return res.json(cached.data);
    }
  }
  
  try {
    const policies = await fetchFromYouthCenter(districtInfo.code, page);
    const transformed = policies
      .map((p, i) => transformPolicy(p, districtInfo.ko, i))
      .filter(p => p !== null);
    
    const responseData = {
      district: district,
      districtKo: districtInfo.ko,
      policies: transformed,
      metadata: {
        page: parseInt(page),
        totalPolicies: transformed.length,
        lastUpdate: new Date().toISOString(),
        source: 'Youth Center API'
      }
    };
    
    cache.set(cacheKey, { data: responseData, timestamp: Date.now() });
    
    res.json(responseData);
  } catch (error) {
    console.error(`Error fetching policies for ${district}:`, error);
    res.status(500).json({
      error: 'Failed to fetch district policies',
      message: error.message
    });
  }
});

// 핫한 정책만 가져오기
router.get('/hot-policies', async (req, res) => {
  try {
    // 모든 구에서 상위 정책들 가져오기
    const allDistricts = Object.keys(DISTRICT_MAPPING).slice(0, 5); // 주요 5개 구
    const promises = allDistricts.map(async (districtEn) => {
      const districtInfo = DISTRICT_MAPPING[districtEn];
      const policies = await fetchFromYouthCenter(districtInfo.code);
      return policies
        .slice(0, 2) // 각 구에서 상위 2개
        .map((p, i) => transformPolicy(p, districtInfo.ko, i))
        .filter(p => p !== null);
    });
    
    const results = await Promise.all(promises);
    const hotPolicies = results.flat().filter(p => p && p.isHot);
    
    res.json({
      policies: hotPolicies,
      metadata: {
        totalPolicies: hotPolicies.length,
        lastUpdate: new Date().toISOString(),
        source: 'Youth Center API'
      }
    });
  } catch (error) {
    console.error('Error fetching hot policies:', error);
    res.status(500).json({
      error: 'Failed to fetch hot policies',
      message: error.message
    });
  }
});

module.exports = router;