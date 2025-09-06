const fetch = require('node-fetch');
require('dotenv').config();

class SearchService {
    constructor() {
        this.tavilyApiKey = process.env.TAVILY_API_KEY;
        this.perplexityApiKey = process.env.PERPLEXITY_API_KEY;
        this.naverClientId = process.env.NAVER_MAP_CLIENT_ID;
        this.naverClientSecret = process.env.NAVER_MAP_CLIENT_SECRET;
    }

    // Tavily API - 실시간 웹 검색으로 최신 청년 정책 정보 가져오기
    async searchWithTavily(query) {
        try {
            if (!this.tavilyApiKey) {
                console.log('Tavily API key not configured');
                return null;
            }

            const response = await fetch('https://api.tavily.com/search', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    api_key: this.tavilyApiKey,
                    query: `청년 정책 ${query} 2024 2025`,
                    search_depth: 'advanced',
                    include_answer: true,
                    include_images: false,
                    max_results: 5,
                    include_domains: [
                        'youth.seoul.go.kr',
                        'www.youthcenter.go.kr',
                        'www.korea.kr',
                        'www.gov.kr',
                        'www.moel.go.kr',
                        'www.molit.go.kr'
                    ]
                })
            });

            if (!response.ok) {
                console.error('Tavily API error:', response.status);
                return null;
            }

            const data = await response.json();
            return {
                answer: data.answer,
                results: data.results?.map(r => ({
                    title: r.title,
                    content: r.content,
                    url: r.url,
                    score: r.score
                }))
            };
        } catch (error) {
            console.error('Tavily search error:', error);
            return null;
        }
    }

    // Perplexity API - AI 기반 정책 정보 요약 및 분석
    async searchWithPerplexity(query) {
        try {
            if (!this.perplexityApiKey) {
                console.log('Perplexity API key not configured');
                return null;
            }

            const response = await fetch('https://api.perplexity.ai/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.perplexityApiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'llama-3.1-sonar-small-128k-online',
                    messages: [
                        {
                            role: 'system',
                            content: '당신은 한국 청년 정책 전문가입니다. 최신 정책 정보를 정확하고 친근하게 안내해주세요.'
                        },
                        {
                            role: 'user',
                            content: `다음 질문에 대한 최신 청년 정책 정보를 알려주세요: ${query}`
                        }
                    ],
                    temperature: 0.2,
                    top_p: 0.9,
                    return_citations: true,
                    search_domain_filter: ['youth.seoul.go.kr', 'www.youthcenter.go.kr', 'www.korea.kr'],
                    search_recency_filter: 'month',
                    stream: false
                })
            });

            if (!response.ok) {
                console.error('Perplexity API error:', response.status);
                return null;
            }

            const data = await response.json();
            return {
                answer: data.choices[0]?.message?.content,
                citations: data.citations
            };
        } catch (error) {
            console.error('Perplexity search error:', error);
            return null;
        }
    }

    // Naver Maps API - 청년 센터, 정책 상담소 위치 정보
    async searchNearbyYouthCenters(query, region) {
        try {
            if (!this.naverClientId || !this.naverClientSecret) {
                console.log('Naver Maps API not configured');
                return null;
            }

            // 지역별 청년센터 검색
            const searchQuery = `${region} 청년센터 청년정책 상담`;
            
            const response = await fetch(
                `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(searchQuery)}&display=5&sort=random`,
                {
                    headers: {
                        'X-Naver-Client-Id': this.naverClientId,
                        'X-Naver-Client-Secret': this.naverClientSecret
                    }
                }
            );

            if (!response.ok) {
                console.error('Naver Maps API error:', response.status);
                return null;
            }

            const data = await response.json();
            return data.items?.map(item => ({
                title: item.title.replace(/<[^>]*>/g, ''), // HTML 태그 제거
                address: item.address || item.roadAddress,
                telephone: item.telephone,
                mapUrl: item.link,
                category: item.category
            }));
        } catch (error) {
            console.error('Naver Maps search error:', error);
            return null;
        }
    }

    // 통합 검색 - 모든 API를 활용한 종합 정보 제공
    async searchComprehensive(query, region = null) {
        console.log(`🔍 Comprehensive search for: ${query}`);
        
        // 병렬로 모든 API 호출
        const [tavilyResult, perplexityResult, naverResult] = await Promise.all([
            this.searchWithTavily(query),
            this.searchWithPerplexity(query),
            region ? this.searchNearbyYouthCenters(query, region) : Promise.resolve(null)
        ]);

        // 결과 통합
        const comprehensiveResult = {
            realTimeInfo: tavilyResult,
            aiAnalysis: perplexityResult,
            nearbyLocations: naverResult,
            timestamp: new Date().toISOString()
        };

        return comprehensiveResult;
    }

    // 정책 업데이트 확인
    async checkPolicyUpdates() {
        const updateQuery = '최신 청년 정책 업데이트 2024 신규 정책';
        const result = await this.searchWithTavily(updateQuery);
        return result;
    }
}

module.exports = SearchService;