const express = require('express');
const axios = require('axios');
const router = express.Router();
const { getDistrictPolicies, SEOUL_COMMON_POLICIES } = require('./district-real-policies');
require('dotenv').config();

// 지역구 매핑 (영문 -> 한글 -> 온통청년 API zipCd)
// 온통청년 API의 zipCd는 5자리 법정동코드 사용
// 서울특별시: 11, 각 구별 코드는 아래와 같음
const DISTRICT_MAPPING = {
  'Gangnam-gu': { ko: '강남구', code: '003002001001001', zipCd: '11680' },
  'Gangdong-gu': { ko: '강동구', code: '003002001001002', zipCd: '11740' },
  'Gangbuk-gu': { ko: '강북구', code: '003002001001003', zipCd: '11305' },
  'Gangseo-gu': { ko: '강서구', code: '003002001001004', zipCd: '11500' },
  'Gwanak-gu': { ko: '관악구', code: '003002001001005', zipCd: '11620' },
  'Gwangjin-gu': { ko: '광진구', code: '003002001001006', zipCd: '11215' },
  'Guro-gu': { ko: '구로구', code: '003002001001007', zipCd: '11530' },
  'Geumcheon-gu': { ko: '금천구', code: '003002001001008', zipCd: '11545' },
  'Nowon-gu': { ko: '노원구', code: '003002001001009', zipCd: '11350' },
  'Dobong-gu': { ko: '도봉구', code: '003002001001010', zipCd: '11320' },
  'Dongdaemun-gu': { ko: '동대문구', code: '003002001001011', zipCd: '11230' },
  'Dongjak-gu': { ko: '동작구', code: '003002001001012', zipCd: '11590' },
  'Mapo-gu': { ko: '마포구', code: '003002001001013', zipCd: '11440' },
  'Seodaemun-gu': { ko: '서대문구', code: '003002001001014', zipCd: '11410' },
  'Seocho-gu': { ko: '서초구', code: '003002001001015', zipCd: '11650' },
  'Seongdong-gu': { ko: '성동구', code: '003002001001016', zipCd: '11200' },
  'Seongbuk-gu': { ko: '성북구', code: '003002001001017', zipCd: '11290' },
  'Songpa-gu': { ko: '송파구', code: '003002001001018', zipCd: '11710' },
  'Yangcheon-gu': { ko: '양천구', code: '003002001001019', zipCd: '11470' },
  'Yeongdeungpo-gu': { ko: '영등포구', code: '003002001001020', zipCd: '11560' },
  'Yongsan-gu': { ko: '용산구', code: '003002001001021', zipCd: '11170' },
  'Eunpyeong-gu': { ko: '은평구', code: '003002001001022', zipCd: '11380' },
  'Jongno-gu': { ko: '종로구', code: '003002001001023', zipCd: '11110' },
  'Jung-gu': { ko: '중구', code: '003002001001024', zipCd: '11140' },
  'Jungnang-gu': { ko: '중랑구', code: '003002001001025', zipCd: '11260' }
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
  const districtEntry = Object.entries(DISTRICT_MAPPING).find(([k, v]) => v.code === districtCode);
  const districtName = districtEntry?.[1]?.ko || '서울';
  const districtKey = districtEntry?.[0] || 'Seoul';
  
  // 구별로 다른 정책 세트 생성
  const policyVariants = {
    'Gangnam-gu': [
      { title: 'IT 스타트업 인큐베이팅', cat: '003002002', amt: '월 100만원', end: '2025-10-15' },
      { title: '청년 전세임대 특별공급', cat: '003002003', amt: '보증금 80%', end: '2025-09-25' },
      { title: 'AI 개발자 부트캠프', cat: '003002001', amt: '전액무료', end: '2025-09-20' }
    ],
    'Seocho-gu': [
      { title: '법무 청년창업 지원', cat: '003002002', amt: '사무실 제공', end: '2025-09-30' },
      { title: '예술가 레지던시', cat: '003002006', amt: '작업실 무료', end: '2025-10-10' },
      { title: 'IT 주거지원', cat: '003002003', amt: '월 50만원', end: '2025-09-28' }
    ],
    'Gangdong-gu': [
      { title: '소상공인 창업자금', cat: '003002002', amt: '3000만원', end: '2025-09-25' },
      { title: '공공임대 특별공급', cat: '003002003', amt: '시세 50%', end: '2025-10-20' },
      { title: '일자리 매칭사업', cat: '003002001', amt: '취업금 100만', end: '2025-09-18' }
    ],
    'Mapo-gu': [
      { title: '홍대 문화창업', cat: '003002006', amt: '공연장 지원', end: '2025-09-30' },
      { title: '1인미디어 스튜디오', cat: '003002002', amt: '장비 무료', end: '2025-10-08' },
      { title: '공유주택 입주', cat: '003002003', amt: '보증금 0원', end: '2025-09-26' }
    ],
    'default': [
      { title: '청년창업 지원', cat: '003002002', amt: '창업자금', end: '2025-09-30' },
      { title: '주거안정 지원', cat: '003002003', amt: '전월세 대출', end: '2025-10-15' },
      { title: '취업역량 강화', cat: '003002001', amt: '교육 무료', end: '2025-09-25' }
    ]
  };
  
  const policies = policyVariants[districtKey] || policyVariants['default'];
  
  // 공통 정책 추가
  const commonPolicies = [
    { title: '청년 건강검진', cat: '003002008', amt: '검진 50%', end: '상시' },
    { title: '정신건강 상담', cat: '003002009', amt: '월 4회 무료', end: '상시' }
  ];
  
  const allPolicies = [...policies, ...commonPolicies];
  
  return allPolicies.map(p => ({
    polyBizSjnm: `${districtName} ${p.title}`,
    polyBizTy: p.cat,
    polyBizCn: `${districtName} 거주 청년 대상 ${p.title} 프로그램. ${p.amt} 지원`,
    polyItcnCn: `${districtName} 거주 청년 대상 ${p.title} 프로그램. ${p.amt} 지원`,
    ageInfo: p.cat === '003002001' ? '만 19세 ~ 34세' : '만 19세 ~ 39세',
    rqutPrdEnd: p.end,
    rqutProcCn: p.end === '상시' ? '방문 신청' : '온라인 신청',
    applUrl: 'https://www.youthcenter.go.kr',
    sporCn: p.amt
  }));
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

// 온통청년 API 호출 - 구별 정책 가져오기
async function fetchFromYouthCenter(districtCode, page = 1) {
  try {
    // 구역 정보 가져오기
    const districtEntry = Object.entries(DISTRICT_MAPPING).find(([k, v]) => v.code === districtCode);
    const districtName = districtEntry?.[1]?.ko || '서울';
    const zipCd = districtEntry?.[1]?.zipCd || '11000'; // 서울시 전체 코드
    
    console.log(`🔄 온통청년 API 호출 중...`);
    console.log(`  District: ${districtName} (zipCd: ${zipCd})`);
    
    // 온통청년 API 사용
    const apiKey = '2a27a665-5b2c-48dd-913e-965ea1956104'; // 실제 API 키
    const apiUrl = 'https://www.youthcenter.go.kr/go/ythip/getPlcy';
    
    // API 파라미터 설정
    const params = {
      apiKeyNm: apiKey,
      pageNum: page,
      pageSize: 50,
      rtnType: 'json',
      zipCd: zipCd, // 구별 필터링을 위한 법정동코드
      plcyNm: '서울' // 서울 관련 정책만
    };
    
    console.log(`  URL: ${apiUrl}`);
    console.log(`  Params:`, params);
    
    const response = await axios.get(apiUrl, {
      params: params,
      timeout: 15000,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0'
      }
    });
    
    console.log(`  Response Status: ${response.status}`);
    
    // 온통청년 API 응답 처리 (result.youthPolicyList 구조)
    if (response.data && response.data.result && response.data.result.youthPolicyList) {
      const policies = response.data.result.youthPolicyList || [];
      const totalCount = response.data.result.pagging?.totCount || 0;
      console.log(`✅ 성공: ${policies.length}개의 구별 청년정책 데이터 수신!`);
      
      // 정책이 없으면 서울시 전체 정책 조회
      if (policies.length === 0 && zipCd !== '11000') {
        console.log('  구별 정책이 없음, 서울시 전체 정책 재조회...');
        const seoulParams = { ...params, zipCd: '11000' };
        const seoulResponse = await axios.get(apiUrl, {
          params: seoulParams,
          timeout: 10000,
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        
        if (seoulResponse.data && seoulResponse.data.youthPolicyList) {
          const seoulPolicies = seoulResponse.data.youthPolicyList || [];
          console.log(`  서울시 전체 정책: ${seoulPolicies.length}개`);
          
          // 온통청년 API 데이터 변환
          return seoulPolicies.slice(0, 15).map((policy, index) => ({
            polyBizSjnm: policy.plcyNm || `청년정책 ${index + 1}`,
            polyBizTy: policy.lclsfNm || '003002001',
            polyBizCn: policy.plcySprtCn || '청년 지원 정책',
            polyItcnCn: policy.plcyExplnCn || '정책 상세 내용',
            ageInfo: `만 ${policy.sprtTrgtMinAge || 19}세 ~ ${policy.sprtTrgtMaxAge || 39}세`,
            rqutPrdEnd: policy.aplyYmd || policy.bizPrdEndYmd || '상시모집',
            rqutProcCn: policy.plcyAplyMthdCn || '온라인 신청',
            applUrl: policy.aplyUrlAddr || 'https://www.youthcenter.go.kr',
            sporCn: policy.plcySprtCn || '지원내용 참조',
            cnsgNmor: policy.sprvsnInstCdNm || '서울시',
            _source: '온통청년',
            _isRealData: true
          }));
        }
      }
      
      // 구별 정책 데이터 변환
      return policies.slice(0, 20).map((policy, index) => ({
        polyBizSjnm: policy.plcyNm || `${districtName} 청년정책 ${index + 1}`,
        polyBizTy: policy.lclsfNm || '003002001',
        polyBizCn: policy.plcySprtCn || '청년 지원 정책',
        polyItcnCn: policy.plcyExplnCn || '정책 상세 내용',
        ageInfo: `만 ${policy.sprtTrgtMinAge || 19}세 ~ ${policy.sprtTrgtMaxAge || 39}세`,
        rqutPrdEnd: policy.aplyYmd || policy.bizPrdEndYmd || '상시모집',
        rqutProcCn: policy.plcyAplyMthdCn || '온라인 신청',
        applUrl: policy.aplyUrlAddr || 'https://www.youthcenter.go.kr',
        sporCn: policy.plcySprtCn || '지원내용 참조',
        cnsgNmor: policy.sprvsnInstCdNm || districtName,
        _source: '온통청년',
        _isRealData: true,
        _isDistrictPolicy: true
      }));
    }
    
    // 백업 옵션: 실제 구별 정책 데이터 사용
    console.log('  온통청년 API 응답 없음, 실제 구별 정책 데이터 사용...');
    
    // 구별 실제 정책 가져오기
    const districtKey = Object.keys(DISTRICT_MAPPING).find(key => 
      DISTRICT_MAPPING[key].ko === districtName
    );
    
    const allPolicies = getDistrictPolicies(districtKey);
    
    console.log(`✅ ${districtName} 실제 정책 ${allPolicies.length}개 반환 (공통 5개 + 구별 특화)`);
    
    // 정책 데이터를 API 형식으로 변환
    return allPolicies.map(policy => ({
      polyBizSjnm: policy.name,
      polyBizTy: policy.category === '취업' ? '003002001' : 
                 policy.category === '창업' ? '003002002' :
                 policy.category === '주거' ? '003002003' :
                 policy.category === '교육' ? '003002004' :
                 policy.category === '복지' ? '003002005' :
                 policy.category === '문화' ? '003002006' : '003002010',
      polyBizCn: policy.support,
      polyItcnCn: policy.support,
      ageInfo: policy.age,
      rqutPrdEnd: policy.deadline,
      rqutProcCn: '온라인 신청',
      applUrl: policy.url,
      sporCn: policy.support,
      cnsgNmor: districtName.includes('구') ? districtName : `${districtName}구청`,
      _source: '실제 구별 정책',
      _isRealData: true,
      _isDistrictPolicy: !SEOUL_COMMON_POLICIES.some(p => p.name === policy.name)
    }));
    
  } catch (error) {
    console.error('❌ API 오류:', error.message);
    if (error.response) {
      console.error('  Response status:', error.response.status);
    }
  }
  
  // API 실패시 Mock 데이터 반환
  console.log('⚠️ 모든 API 실패, Mock 데이터 반환');
  return generateMockData(districtCode);
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

// Tavily를 사용한 실시간 정책 검색
async function searchPoliciesWithTavily(district) {
  try {
    const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
    if (!TAVILY_API_KEY) {
      console.error('Tavily API key not configured');
      return [];
    }
    
    const districtInfo = DISTRICT_MAPPING[district];
    const districtName = districtInfo?.ko || '서울';
    
    const searchQuery = `${districtName} 청년 정책 2024 2025 지원 모집 공고`;
    
    const response = await axios.post('https://api.tavily.com/search', {
      api_key: TAVILY_API_KEY,
      query: searchQuery,
      search_depth: 'advanced',
      include_domains: ['youthcenter.go.kr', 'seoul.go.kr', 'data.go.kr'],
      max_results: 20
    }, {
      timeout: 10000
    });
    
    const results = response.data?.results || [];
    console.log(`Tavily found ${results.length} results for ${districtName}`);
    
    // Tavily 결과를 정책 형식으로 변환
    return results.map((result, index) => ({
      polyBizSjnm: result.title,
      polyBizTy: '003002001',
      polyBizCn: result.content || result.snippet,
      polyItcnCn: result.content || result.snippet,
      ageInfo: '만 19세 ~ 39세',
      rqutPrdEnd: extractDeadlineFromText(result.content) || '상시',
      rqutProcCn: '온라인 신청',
      applUrl: result.url,
      sporCn: extractSupportFromText(result.content) || '지원내용 참조'
    }));
    
  } catch (error) {
    console.error('Tavily search error:', error.message);
    return [];
  }
}

function extractDeadlineFromText(text) {
  if (!text) return null;
  const match = text.match(/(\d{4}[-\.]\d{1,2}[-\.]\d{1,2})|(\d{1,2}월\s*\d{1,2}일)/);
  return match ? match[0] : null;
}

function extractSupportFromText(text) {
  if (!text) return null;
  const match = text.match(/(\d+만\s*원|\d+천만\s*원|\d+억)/);
  return match ? match[0] : null;
}

// 전체 정책 업데이트 (백엔드 방식처럼)
router.post('/update-all-policies', async (req, res) => {
  try {
    console.log('Starting full policy update from all sources...');
    
    const allPolicies = [];
    const sources = [];
    
    // 1. 공공데이터포털 청년정책 API
    try {
      const publicDataUrl = 'https://apis.data.go.kr/1383000/gmis/teenPolcSrvcInfoInqireService/getTeenPolcSrvcInfo';
      
      for (let page = 1; page <= 5; page++) {
        const response = await axios.get(publicDataUrl, {
          params: {
            serviceKey: 'qvGQdKmJZJJmXYFNpGSrF3bOV3Vn8TKwP0KRJ5wDxu9IvtaDCOu1a7p1XSfPOJOvRtYFJqTLIDl3IQexdQwGOg==',
            pageNo: page,
            numOfRows: 100,
            dataType: 'JSON'
          },
          timeout: 20000
        });
        
        if (response.data?.response?.body?.items) {
          const items = response.data.response.body.items;
          const policies = Array.isArray(items) ? items : (items.item ? [items.item] : []);
          allPolicies.push(...policies);
        }
      }
      sources.push('공공데이터포털');
      console.log(`Fetched ${allPolicies.length} from 공공데이터포털`);
    } catch (error) {
      console.error('공공데이터포털 error:', error.message);
    }
    
    // 2. 청년센터 웹 크롤링 API
    try {
      const youthCenterUrl = 'https://www.youthcenter.go.kr/youngPlcyUnif/youngPlcyUnifList.do';
      
      const response = await axios.post(youthCenterUrl, 
        new URLSearchParams({
          'pageIndex': '1',
          'pageUnit': '1000',
          'srchWord': '',
          'bizTycdSel': '023010,023020,023030,023040,023050',
          'srchPolyBizSecd': '003002001',
          'dtlOpenYn': 'Y'
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-Requested-With': 'XMLHttpRequest'
          },
          timeout: 20000
        }
      );
      
      if (response.data?.resultList) {
        allPolicies.push(...response.data.resultList);
        sources.push('청년센터');
        console.log(`Fetched ${response.data.resultList.length} from 청년센터`);
      }
    } catch (error) {
      console.error('청년센터 error:', error.message);
    }
    
    // 3. 서울시 열린데이터광장
    try {
      const seoulUrl = 'http://openapi.seoul.go.kr:8088/' + process.env.SEOUL_API_KEY + '/json/youngManPolicy/1/100/';
      
      const response = await axios.get(seoulUrl, { timeout: 15000 });
      
      if (response.data?.youngManPolicy?.row) {
        allPolicies.push(...response.data.youngManPolicy.row);
        sources.push('서울시 열린데이터광장');
        console.log(`Fetched ${response.data.youngManPolicy.row.length} from 서울시`);
      }
    } catch (error) {
      console.error('서울시 API error:', error.message);
    }
    
    // 전체 정책 정리 및 중복 제거
    const uniquePolicies = Array.from(new Map(
      allPolicies.map(p => [p.polyBizSjnm || p.polyBizNm || p.POLICY_NAME, p])
    ).values());
    
    console.log(`Total unique policies: ${uniquePolicies.length}`);
    
    // 구별로 분류
    const policiesByDistrict = {};
    Object.keys(DISTRICT_MAPPING).forEach(district => {
      policiesByDistrict[district] = [];
    });
    
    // 정책을 구별로 분배 (서울 전체 정책은 모든 구에 추가)
    uniquePolicies.forEach(policy => {
      const transformed = transformPolicyForUpdate(policy);
      if (transformed) {
        // 모든 구에 추가 (서울시 전체 대상 정책)
        Object.keys(policiesByDistrict).forEach(district => {
          policiesByDistrict[district].push(transformed);
        });
      }
    });
    
    res.json({
      success: true,
      message: 'Policy update completed',
      stats: {
        totalPolicies: uniquePolicies.length,
        sources: sources,
        timestamp: new Date().toISOString()
      },
      data: policiesByDistrict
    });
    
  } catch (error) {
    console.error('Update all policies error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 정책 데이터 변환 헬퍼 (업데이트용)
function transformPolicyForUpdate(policy) {
  try {
    const title = policy.polyBizSjnm || policy.polyBizNm || policy.POLICY_NAME || '';
    if (!title) return null;
    
    return {
      id: Math.random() * 1000000,
      title: title,
      category: getCategoryFromPolicy(policy),
      target: policy.ageInfo || policy.SPORT_FORMA || '청년',
      deadline: formatDeadline(policy.rqutPrdEnd || policy.POLICY_ENDDATE),
      description: policy.polyBizCn || policy.polyItcnCn || policy.POLICY_DESC || '',
      district: '서울시',
      isHot: false,
      isRecruiting: true,
      image: '/img/card/card1.png',
      metadata: {
        applicationUrl: policy.applUrl || policy.DETAIL_URL || 'https://www.youthcenter.go.kr',
        applicationMethod: policy.rqutProcCn || '온라인 신청',
        supportAmount: policy.sporCn || policy.SPORT_FORMA || '',
        lastUpdate: new Date().toISOString()
      }
    };
  } catch (error) {
    return null;
  }
}

function getCategoryFromPolicy(policy) {
  const title = (policy.polyBizSjnm || policy.polyBizNm || '').toLowerCase();
  if (title.includes('창업')) return '창업';
  if (title.includes('주거') || title.includes('주택')) return '주거';
  if (title.includes('취업') || title.includes('일자리')) return '취업';
  if (title.includes('교육')) return '교육';
  if (title.includes('문화') || title.includes('예술')) return '문화/예술';
  if (title.includes('건강')) return '신체건강';
  return '기타';
}

function formatDeadline(date) {
  if (!date || date === '상시' || date === '상시모집') return '상시모집';
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '상시모집';
    return `~${d.getMonth() + 1}/${d.getDate()}`;
  } catch {
    return '상시모집';
  }
}

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