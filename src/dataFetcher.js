const axios = require('axios');
require('dotenv').config();

class DataFetcher {
    constructor() {
        this.seoulApiKey = process.env.SEOUL_OPEN_DATA_API_KEY;
        this.youthCenterApiKey = process.env.YOUTHCENTER_API_KEY;
        this.cache = new Map();
        this.cacheExpiry = parseInt(process.env.CACHE_EXPIRY_HOURS) * 60 * 60 * 1000;
    }

    // 서울 열린데이터광장 API - 청년정책 데이터
    async fetchSeoulYouthPolicies() {
        const cacheKey = 'seoul_youth_policies';
        
        // 캐시 확인
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheExpiry) {
                console.log('📦 Using cached Seoul youth policies');
                return cached.data;
            }
        }

        try {
            console.log('🔄 Fetching fresh Seoul youth policies...');
            
            // 서울시 청년정책 API
            const url = `http://openapi.seoul.go.kr:8088/${this.seoulApiKey}/json/youthPolicy/1/100/`;
            
            const response = await axios.get(url, {
                timeout: 10000
            });

            if (response.data && response.data.youthPolicy) {
                const policies = response.data.youthPolicy.row.map(policy => ({
                    id: `seoul-${policy.POLICY_ID}`,
                    title: policy.POLICY_NAME,
                    category: this.mapCategory(policy.POLICY_TYPE),
                    content: policy.POLICY_DESC,
                    eligibility: policy.TARGET_INFO,
                    amount: policy.SUPPORT_CONTENT,
                    applicationPeriod: policy.APPLY_PERIOD,
                    url: policy.DETAIL_URL || 'https://youth.seoul.go.kr',
                    source: 'seoul_open_data'
                }));

                // 캐시 저장
                this.cache.set(cacheKey, {
                    data: policies,
                    timestamp: Date.now()
                });

                return policies;
            }
            
            return [];
        } catch (error) {
            console.error('❌ Seoul API Error:', error.message);
            return [];
        }
    }

    // 온라인청년센터 API - 전국 청년정책
    async fetchYouthCenterPolicies() {
        const cacheKey = 'youth_center_policies';
        
        // 캐시 확인
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheExpiry) {
                console.log('📦 Using cached Youth Center policies');
                return cached.data;
            }
        }

        try {
            console.log('🔄 Fetching fresh Youth Center policies...');
            
            const url = 'https://www.youthcenter.go.kr/opi/openApi.do';
            const params = {
                apiKey: this.youthCenterApiKey,
                display: 100,
                pageIndex: 1,
                srchPolicyId: '',
                query: '',
                bizTycdSel: ''  // 정책유형코드
            };

            const response = await axios.get(url, {
                params,
                timeout: 10000
            });

            if (response.data && response.data.youthPolicy) {
                const policies = response.data.youthPolicy.map(policy => ({
                    id: `youthcenter-${policy.bizId}`,
                    title: policy.polyBizSjnm,
                    category: this.mapCategory(policy.polyRlmCd),
                    content: policy.polyItcnCn,
                    eligibility: `${policy.ageInfo} / ${policy.majrRqisCn}`,
                    amount: policy.sporCn,
                    applicationPeriod: `${policy.rqutPrdCn}`,
                    applicationMethod: policy.rqutProcCn,
                    url: policy.rqutUrla || 'https://www.youthcenter.go.kr',
                    region: policy.polyBizSecd,
                    source: 'youth_center'
                }));

                // 캐시 저장
                this.cache.set(cacheKey, {
                    data: policies,
                    timestamp: Date.now()
                });

                return policies;
            }
            
            return [];
        } catch (error) {
            console.error('❌ Youth Center API Error:', error.message);
            return [];
        }
    }

    // 카테고리 매핑
    mapCategory(type) {
        const categoryMap = {
            '일자리': '취업',
            '주거': '주거',
            '교육': '교육',
            '복지': '복지',
            '참여': '참여',
            '일자리분야': '취업',
            '주거분야': '주거',
            '교육분야': '교육',
            '023010': '취업',  // 취업지원
            '023020': '창업',  // 창업지원
            '023030': '주거',  // 주거지원
            '023040': '교육',  // 교육지원
            '023050': '복지'   // 생활지원
        };

        return categoryMap[type] || '기타';
    }

    // 모든 정책 데이터 통합 조회
    async fetchAllPolicies() {
        console.log('🚀 Fetching all policy data...');
        
        const [seoulPolicies, youthCenterPolicies] = await Promise.all([
            this.fetchSeoulYouthPolicies(),
            this.fetchYouthCenterPolicies()
        ]);

        const allPolicies = [...seoulPolicies, ...youthCenterPolicies];
        
        console.log(`✅ Total policies fetched: ${allPolicies.length}`);
        console.log(`  - Seoul: ${seoulPolicies.length}`);
        console.log(`  - Youth Center: ${youthCenterPolicies.length}`);
        
        return allPolicies;
    }

    // 키워드로 정책 검색
    async searchPolicies(keyword) {
        const allPolicies = await this.fetchAllPolicies();
        
        const results = allPolicies.filter(policy => {
            const searchText = `${policy.title} ${policy.content} ${policy.category}`.toLowerCase();
            return searchText.includes(keyword.toLowerCase());
        });

        return results;
    }

    // 카테고리별 정책 조회
    async getPoliciesByCategory(category) {
        const allPolicies = await this.fetchAllPolicies();
        return allPolicies.filter(policy => policy.category === category);
    }

    // 지역별 정책 조회
    async getPoliciesByRegion(region) {
        const allPolicies = await this.fetchAllPolicies();
        return allPolicies.filter(policy => 
            policy.region && policy.region.includes(region)
        );
    }

    // 캐시 초기화
    clearCache() {
        this.cache.clear();
        console.log('🗑️ Cache cleared');
    }

    // 정책 상세 정보 조회
    async getPolicyDetail(policyId) {
        const allPolicies = await this.fetchAllPolicies();
        return allPolicies.find(policy => policy.id === policyId);
    }
}

module.exports = DataFetcher;