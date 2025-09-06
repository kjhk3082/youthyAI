/**
 * 유씨 AI 챗봇용 온통청년 API 연동 모듈
 * 실제 청년정책 데이터를 챗봇에 제공
 */

const axios = require('axios');

class YouthPolicyService {
  constructor() {
    this.apiKey = '2a27a665-5b2c-48dd-913e-965ea1956104';
    this.apiUrl = 'https://www.youthcenter.go.kr/go/ythip/getPlcy';
    this.cache = new Map();
    this.cacheExpiry = 5 * 60 * 1000; // 5분 캐시
  }

  /**
   * 온통청년 API에서 정책 조회
   * @param {Object} params - 조회 파라미터
   * @returns {Array} 정책 목록
   */
  async fetchPolicies(params = {}) {
    const cacheKey = JSON.stringify(params);
    
    // 캐시 확인
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheExpiry) {
        console.log('📦 캐시에서 정책 반환');
        return cached.data;
      }
    }

    try {
      const defaultParams = {
        apiKeyNm: this.apiKey,
        pageNum: 1,
        pageSize: 20,
        rtnType: 'json'
      };

      const finalParams = { ...defaultParams, ...params };
      
      console.log('🔍 온통청년 API 호출:', finalParams);
      
      const response = await axios.get(this.apiUrl, {
        params: finalParams,
        timeout: 10000,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'YOUTHY-AI-Chatbot/1.0'
        }
      });

      if (response.data?.result?.youthPolicyList) {
        const policies = response.data.result.youthPolicyList;
        console.log(`✅ ${policies.length}개 정책 조회 성공`);
        
        // 캐시 저장
        this.cache.set(cacheKey, {
          data: policies,
          timestamp: Date.now()
        });
        
        return policies;
      }
      
      return [];
    } catch (error) {
      console.error('❌ API 오류:', error.message);
      return [];
    }
  }

  /**
   * 지역별 정책 조회
   * @param {string} zipCd - 법정동코드
   * @returns {Array} 지역 정책 목록
   */
  async getRegionalPolicies(zipCd) {
    return this.fetchPolicies({ zipCd });
  }

  /**
   * 키워드로 정책 검색
   * @param {string} keyword - 검색 키워드
   * @returns {Array} 검색된 정책 목록
   */
  async searchPolicies(keyword) {
    return this.fetchPolicies({ plcyNm: keyword });
  }

  /**
   * 인기 정책 TOP 10 조회
   * @returns {Array} 인기 정책 목록
   */
  async getPopularPolicies() {
    const policies = await this.fetchPolicies({
      pageSize: 100,
      srchOrder: '2' // 조회수순
    });

    // 조회수 기준 정렬 및 TOP 10
    return policies
      .sort((a, b) => (parseInt(b.inqCnt) || 0) - (parseInt(a.inqCnt) || 0))
      .slice(0, 10);
  }

  /**
   * 카테고리별 정책 조회
   * @param {string} category - 카테고리 (일자리, 주거, 복지문화 등)
   * @returns {Array} 카테고리 정책 목록
   */
  async getPoliciesByCategory(category) {
    return this.fetchPolicies({ lclsfNm: category });
  }

  /**
   * 연령대별 정책 조회
   * @param {number} age - 나이
   * @returns {Array} 해당 연령 지원 가능 정책
   */
  async getPoliciesByAge(age) {
    const allPolicies = await this.fetchPolicies({ pageSize: 100 });
    
    return allPolicies.filter(policy => {
      const minAge = parseInt(policy.sprtTrgtMinAge) || 0;
      const maxAge = parseInt(policy.sprtTrgtMaxAge) || 100;
      return age >= minAge && age <= maxAge;
    });
  }

  /**
   * 챗봇 응답용 정책 포맷팅
   * @param {Object} policy - 정책 객체
   * @returns {Object} 포맷된 정책 정보
   */
  formatPolicyForChat(policy) {
    return {
      name: policy.plcyNm,
      summary: policy.plcyExplnCn,
      category: policy.lclsfNm,
      subCategory: policy.mclsfNm,
      support: policy.plcySprtCn,
      ageRange: `${policy.sprtTrgtMinAge || 0}~${policy.sprtTrgtMaxAge || 100}세`,
      applicationPeriod: policy.aplyYmd || '상시',
      applicationUrl: policy.aplyUrlAddr || '온통청년 사이트 참조',
      organization: policy.sprvsnInstCdNm,
      views: policy.inqCnt || 0,
      region: policy.zipCd
    };
  }

  /**
   * 챗봇 메시지 분석 및 정책 추천
   * @param {string} message - 사용자 메시지
   * @returns {Object} 추천 정책 정보
   */
  async analyzeAndRecommend(message) {
    const analysis = {
      keywords: [],
      category: null,
      region: null,
      age: null
    };

    // 키워드 추출
    if (message.includes('주거') || message.includes('집') || message.includes('월세')) {
      analysis.category = '주거금융';
      analysis.keywords.push('주거');
    }
    if (message.includes('취업') || message.includes('일자리')) {
      analysis.category = '일자리';
      analysis.keywords.push('취업');
    }
    if (message.includes('창업') || message.includes('사업')) {
      analysis.category = '창업';
      analysis.keywords.push('창업');
    }
    if (message.includes('교육') || message.includes('학습')) {
      analysis.category = '교육';
      analysis.keywords.push('교육');
    }

    // 지역 추출
    const regions = {
      '강남': '11680',
      '서초': '11650',
      '송파': '11710',
      '마포': '11440',
      '성동': '11200'
    };

    for (const [name, code] of Object.entries(regions)) {
      if (message.includes(name)) {
        analysis.region = code;
        break;
      }
    }

    // 나이 추출
    const ageMatch = message.match(/(\d{2})세/);
    if (ageMatch) {
      analysis.age = parseInt(ageMatch[1]);
    }

    // 정책 검색
    let policies = [];
    
    if (analysis.category) {
      policies = await this.getPoliciesByCategory(analysis.category);
    } else if (analysis.region) {
      policies = await this.getRegionalPolicies(analysis.region);
    } else if (analysis.keywords.length > 0) {
      policies = await this.searchPolicies(analysis.keywords[0]);
    } else {
      policies = await this.getPopularPolicies();
    }

    // 나이 필터링
    if (analysis.age && policies.length > 0) {
      policies = policies.filter(p => {
        const minAge = parseInt(p.sprtTrgtMinAge) || 0;
        const maxAge = parseInt(p.sprtTrgtMaxAge) || 100;
        return analysis.age >= minAge && analysis.age <= maxAge;
      });
    }

    return {
      analysis,
      policies: policies.slice(0, 5).map(p => this.formatPolicyForChat(p)),
      totalCount: policies.length
    };
  }
}

// 지역 코드 매핑
const DISTRICT_CODES = {
  '서울': '11000',
  '강남구': '11680',
  '강동구': '11740',
  '강북구': '11305',
  '강서구': '11500',
  '관악구': '11620',
  '광진구': '11215',
  '구로구': '11530',
  '금천구': '11545',
  '노원구': '11350',
  '도봉구': '11320',
  '동대문구': '11230',
  '동작구': '11590',
  '마포구': '11440',
  '서대문구': '11410',
  '서초구': '11650',
  '성동구': '11200',
  '성북구': '11290',
  '송파구': '11710',
  '양천구': '11470',
  '영등포구': '11560',
  '용산구': '11170',
  '은평구': '11380',
  '종로구': '11110',
  '중구': '11140',
  '중랑구': '11260'
};

module.exports = {
  YouthPolicyService,
  DISTRICT_CODES
};