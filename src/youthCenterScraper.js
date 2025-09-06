const axios = require('axios');

class YouthCenterScraper {
    constructor() {
        this.apiKey = process.env.YOUTHCENTER_API_KEY;
        this.baseUrl = 'https://www.youthcenter.go.kr';
        this.cache = new Map();
        this.cacheExpiry = 24 * 60 * 60 * 1000; // 24시간
    }

    // 정책 상세 정보 가져오기
    async getPolicyDetail(policyId) {
        const cacheKey = `policy_${policyId}`;
        
        // 캐시 확인
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheExpiry) {
                console.log(`📦 Using cached data for policy ${policyId}`);
                return cached.data;
            }
        }

        try {
            console.log(`🔍 Fetching detail for policy ${policyId}...`);
            
            // API v2 엔드포인트 시도
            const apiUrl = `${this.baseUrl}/opi/empList.do`;
            const params = {
                openApiVlak: this.apiKey,
                display: 100,
                pageIndex: 1,
                bizId: policyId
            };

            const response = await axios.get(apiUrl, { 
                params,
                timeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'application/json, text/plain, */*'
                }
            });

            if (response.data && response.data.empList) {
                const policy = this.parseDetailedPolicy(response.data.empList[0]);
                
                // 캐시 저장
                this.cache.set(cacheKey, {
                    data: policy,
                    timestamp: Date.now()
                });

                return policy;
            }
        } catch (error) {
            console.error(`❌ Failed to fetch policy ${policyId}:`, error.message);
        }

        // Fallback: 기본 정보 반환
        return this.getDefaultPolicyInfo(policyId);
    }

    // 정책 목록 가져오기 (개선된 버전)
    async fetchPolicies(options = {}) {
        const {
            query = '',
            region = '',
            category = '',
            age = '',
            pageIndex = 1,
            display = 100
        } = options;

        const cacheKey = `policies_${query}_${region}_${category}_${age}_${pageIndex}`;
        
        // 캐시 확인
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheExpiry) {
                console.log('📦 Using cached policy list');
                return cached.data;
            }
        }

        try {
            console.log('🔄 Fetching policy list from Youth Center...');
            
            // 정책 목록 API
            const listUrl = `${this.baseUrl}/opi/empList.do`;
            const params = {
                openApiVlak: this.apiKey,
                display: display,
                pageIndex: pageIndex,
                query: query,
                bizTycdSel: this.mapCategoryToCode(category),
                srchPolyBizSecd: this.mapRegionToCode(region)
            };

            const response = await axios.get(listUrl, {
                params,
                timeout: 15000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'application/json, text/plain, */*',
                    'Referer': 'https://www.youthcenter.go.kr'
                }
            });

            if (response.data && response.data.empList) {
                const policies = response.data.empList.map(item => this.parseDetailedPolicy(item));
                
                // 캐시 저장
                this.cache.set(cacheKey, {
                    data: policies,
                    timestamp: Date.now()
                });

                console.log(`✅ Fetched ${policies.length} policies`);
                return policies;
            }

            return [];
        } catch (error) {
            console.error('❌ Youth Center API Error:', error.message);
            
            // Fallback 데이터
            return this.getFallbackPolicies();
        }
    }

    // 상세 정책 정보 파싱
    parseDetailedPolicy(data) {
        if (!data) return null;

        return {
            // 기본 정보
            id: data.bizId || data.polyBizSjnm,
            title: data.polyBizSjnm || '정책명 없음',
            category: this.mapCodeToCategory(data.polyRlmCd),
            
            // 상세 내용
            content: data.polyItcnCn || '내용 없음',
            summary: data.sporScvl || '',
            purpose: data.polyBizPrpsCn || '',
            
            // 자격 조건
            eligibility: {
                age: data.ageInfo || '연령 제한 없음',
                education: data.accrRqisCn || '학력 무관',
                employment: data.empmSttsCn || '취업상태 무관',
                specialization: data.splzRlmRqisCn || '전공 무관',
                residence: data.resiCn || '거주지 무관',
                income: data.prcpCn || '소득 무관',
                additional: data.majrRqisCn || '추가 조건 없음'
            },
            
            // 지원 내용
            support: {
                content: data.sporCn || '지원 내용 없음',
                scale: data.sporScvl || '',
                details: data.etct || ''
            },
            
            // 신청 정보
            application: {
                period: data.rqutPrdCn || '상시 신청',
                operationPeriod: data.bizPrdCn || '', // 사업 운영 기간
                method: data.rqutProcCn || '방문 신청',
                documents: data.pstnPaprCn || '신청서',
                process: data.jdgnPresCn || '',
                url: data.rqutUrla || '',
                contact: {
                    department: data.mngtMson || '',
                    name: data.cherCtpcCn || '',
                    phone: data.cnsgNmor || '',
                    refUrl: data.rfcSiteUrla1 || ''
                }
            },
            
            // 기간 정보 (중요!)
            period: {
                operation: {
                    start: data.bizBgnDt || '',
                    end: data.bizEndDt || '',
                    display: data.bizPrdCn || '상시 운영'
                },
                application: {
                    start: data.rqutBgnDt || '',
                    end: data.rqutEndDt || '',
                    display: data.rqutPrdCn || '상시 신청'
                }
            },
            
            // 메타 정보
            meta: {
                region: data.polyBizSecd || '전국',
                institution: data.mngtMson || '',
                createdAt: data.creatDt || '',
                viewCount: data.inqCnt || 0,
                source: 'youth_center'
            }
        };
    }

    // 카테고리 코드 매핑
    mapCategoryToCode(category) {
        const map = {
            '일자리': '023010',
            '취업': '023010',
            '창업': '023020',
            '주거': '023030',
            '교육': '023040',
            '복지': '023050',
            '문화': '023060',
            '참여': '023070'
        };
        return map[category] || '';
    }

    // 코드를 카테고리로 변환
    mapCodeToCategory(code) {
        const map = {
            '023010': '일자리',
            '023020': '창업',
            '023030': '주거',
            '023040': '교육',
            '023050': '복지·문화',
            '023060': '문화',
            '023070': '참여·권리'
        };
        return map[code] || '기타';
    }

    // 지역 코드 매핑
    mapRegionToCode(region) {
        const map = {
            '서울': '003002001',
            '부산': '003002002',
            '대구': '003002003',
            '인천': '003002004',
            '광주': '003002005',
            '대전': '003002006',
            '울산': '003002007',
            '경기': '003002008',
            '강원': '003002009',
            '충북': '003002010',
            '충남': '003002011',
            '전북': '003002012',
            '전남': '003002013',
            '경북': '003002014',
            '경남': '003002015',
            '제주': '003002016',
            '세종': '003002017'
        };
        return map[region] || '';
    }

    // Fallback 정책 데이터
    getFallbackPolicies() {
        return [
            {
                id: 'fallback-001',
                title: '청년 월세 특별지원',
                category: '주거',
                content: '청년 월세 부담 완화를 위한 특별 지원 사업',
                eligibility: {
                    age: '만 19~39세',
                    residence: '서울시 거주',
                    income: '중위소득 150% 이하'
                },
                support: {
                    content: '월 최대 20만원 지원',
                    scale: '최대 12개월'
                },
                application: {
                    period: '2025년 1월 1일 ~ 12월 31일',
                    method: '온라인 신청',
                    url: 'https://youth.seoul.go.kr'
                },
                period: {
                    operation: {
                        start: '2025-01-01',
                        end: '2025-12-31',
                        display: '2025년 1월 1일 ~ 2025년 12월 31일'
                    },
                    application: {
                        start: '2025-01-01',
                        end: '2025-12-31',
                        display: '2025년 1월 1일 ~ 2025년 12월 31일'
                    }
                }
            }
        ];
    }

    // 기본 정책 정보
    getDefaultPolicyInfo(policyId) {
        return {
            id: policyId,
            title: '정책 정보 로딩 중',
            content: '상세 정보를 가져오는 중입니다.',
            meta: {
                source: 'youth_center',
                error: 'fetch_failed'
            }
        };
    }

    // 캐시 초기화
    clearCache() {
        this.cache.clear();
        console.log('🗑️ Youth Center cache cleared');
    }
}

module.exports = YouthCenterScraper;