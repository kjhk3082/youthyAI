const axios = require('axios');
require('dotenv').config();
const YouthCenterScraper = require('./youthCenterScraper');

class DataFetcher {
    constructor() {
        this.seoulApiKey = process.env.SEOUL_OPEN_DATA_API_KEY;
        this.youthCenterApiKey = process.env.YOUTHCENTER_API_KEY;
        this.cache = new Map();
        this.cacheExpiry = parseInt(process.env.CACHE_EXPIRY_HOURS) * 60 * 60 * 1000;
        this.youthCenterScraper = new YouthCenterScraper();
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

    // 온라인청년센터 API - 전국 청년정책 (개선된 버전)
    async fetchYouthCenterPolicies(options = {}) {
        const { query = '', region = '', category = '', forceRefresh = false } = options;
        const cacheKey = `youth_center_policies_${query}_${region}_${category}`;
        
        // 캐시 확인 (forceRefresh가 아닐 경우)
        if (!forceRefresh && this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheExpiry) {
                console.log('📦 Using cached Youth Center policies');
                return cached.data;
            }
        }

        try {
            console.log('🔄 Fetching detailed Youth Center policies...');
            
            // YouthCenterScraper 사용
            const policies = await this.youthCenterScraper.fetchPolicies({
                query,
                region,
                category,
                display: 100,
                pageIndex: 1
            });

            if (policies && policies.length > 0) {
                // 상세 정보가 포함된 정책 데이터
                const detailedPolicies = policies.map(policy => ({
                    id: `youthcenter-${policy.id}`,
                    title: policy.title,
                    category: policy.category,
                    content: policy.content,
                    summary: policy.summary,
                    
                    // 자격 조건 상세
                    eligibility: {
                        age: policy.eligibility?.age || '연령 제한 없음',
                        education: policy.eligibility?.education || '학력 무관',
                        employment: policy.eligibility?.employment || '취업상태 무관',
                        residence: policy.eligibility?.residence || '거주지 무관',
                        income: policy.eligibility?.income || '소득 무관',
                        additional: policy.eligibility?.additional || '추가 조건 없음'
                    },
                    
                    // 지원 내용 상세
                    support: {
                        content: policy.support?.content || '',
                        scale: policy.support?.scale || '',
                        details: policy.support?.details || ''
                    },
                    
                    // 신청 기간 (중요!)
                    period: {
                        operation: {
                            start: policy.period?.operation?.start || '',
                            end: policy.period?.operation?.end || '',
                            display: policy.period?.operation?.display || '상시 운영'
                        },
                        application: {
                            start: policy.period?.application?.start || '',
                            end: policy.period?.application?.end || '',
                            display: policy.period?.application?.display || '상시 신청'
                        }
                    },
                    
                    // 신청 방법
                    application: {
                        method: policy.application?.method || '방문 신청',
                        documents: policy.application?.documents || '신청서',
                        process: policy.application?.process || '',
                        url: policy.application?.url || 'https://www.youthcenter.go.kr',
                        contact: policy.application?.contact || {}
                    },
                    
                    // 메타 정보
                    region: policy.meta?.region || '전국',
                    institution: policy.meta?.institution || '',
                    source: 'youth_center_detailed'
                }));

                // 캐시 저장
                this.cache.set(cacheKey, {
                    data: detailedPolicies,
                    timestamp: Date.now()
                });

                console.log(`✅ Fetched ${detailedPolicies.length} detailed policies`);
                return detailedPolicies;
            }
            
            return [];
        } catch (error) {
            console.error('❌ Youth Center API Error:', error.message);
            // Fallback 데이터 반환
            return this.youthCenterScraper.getFallbackPolicies();
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

    // 모든 정책 데이터 통합 조회 (상세 정보 포함)
    async fetchAllPolicies(options = {}) {
        console.log('🚀 Fetching all policy data with details...');
        
        const [seoulPolicies, youthCenterPolicies] = await Promise.all([
            this.fetchSeoulYouthPolicies(),
            this.fetchYouthCenterPolicies(options)
        ]);

        const allPolicies = [...seoulPolicies, ...youthCenterPolicies];
        
        // 중복 제거
        const uniquePolicies = new Map();
        allPolicies.forEach(policy => {
            uniquePolicies.set(policy.id, policy);
        });
        
        const finalPolicies = Array.from(uniquePolicies.values());
        
        console.log(`✅ Total unique policies fetched: ${finalPolicies.length}`);
        console.log(`  - Seoul: ${seoulPolicies.length}`);
        console.log(`  - Youth Center (detailed): ${youthCenterPolicies.length}`);
        
        return finalPolicies;
    }

    // 특정 정책 상세 정보 조회
    async getPolicyFullDetail(policyId) {
        console.log(`🔍 Fetching full details for policy: ${policyId}`);
        
        // Youth Center 정책인 경우
        if (policyId.startsWith('youthcenter-')) {
            const actualId = policyId.replace('youthcenter-', '');
            return await this.youthCenterScraper.getPolicyDetail(actualId);
        }
        
        // 기본 조회
        return await this.getPolicyDetail(policyId);
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