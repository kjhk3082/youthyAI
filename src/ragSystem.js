const axios = require('axios');
require('dotenv').config();
const DataFetcher = require('./dataFetcher');

class RAGSystem {
    constructor() {
        this.apiKey = process.env.OPENAI_API_KEY;
        this.apiUrl = 'https://api.openai.com/v1/chat/completions';
        this.embeddingsUrl = 'https://api.openai.com/v1/embeddings';
        this.model = 'gpt-3.5-turbo';
        this.embeddingsModel = process.env.EMBEDDINGS_MODEL || 'text-embedding-ada-002';
        
        // In-memory vector store for demo (실제로는 PostgreSQL with pgvector 사용)
        this.vectorStore = [];
        this.documentsStore = [];
        
        // Initialize data fetcher for real-time data
        this.dataFetcher = new DataFetcher();
        
        // Initialize with Korean youth policy data
        this.initializePolicyData();
        
        // Refresh data periodically
        this.startAutoRefresh();
    }

    initializePolicyData() {
        // 청년 정책 데이터베이스
        this.policyDatabase = [
            {
                id: 'housing-001',
                category: '주거',
                title: '서울시 청년 월세 지원',
                content: '서울시 청년 월세 지원은 만 19-39세 무주택 청년에게 월 최대 20만원을 12개월간 지원하는 정책입니다. 중위소득 150% 이하, 임차보증금 5천만원 이하, 월세 60만원 이하 조건을 충족해야 합니다.',
                keywords: ['월세', '주거', '서울시', '청년주택'],
                eligibility: '만 19-39세, 무주택, 중위소득 150% 이하',
                amount: '월 20만원 (최대 12개월)',
                url: 'https://youth.seoul.go.kr',
                application: {
                    contact: {
                        department: '서울시 청년정책담당관',
                        phone: '02-2133-6587'
                    }
                }
            },
            {
                id: 'housing-002',
                category: '주거',
                title: '청년 전세자금 대출',
                content: '청년 전세자금 대출은 만 19-34세 청년에게 최대 2억원까지 연 1.2~2.1%의 저금리로 전세자금을 대출해주는 정책입니다. 연소득 5천만원 이하, 순자산 3.61억원 이하 무주택자가 대상입니다.',
                keywords: ['전세', '대출', '주거', '전세자금'],
                eligibility: '만 19-34세, 무주택, 연소득 5천만원 이하',
                amount: '최대 2억원',
                url: 'https://nhuf.molit.go.kr',
                application: {
                    contact: {
                        department: '주택도시기금',
                        phone: '1566-9009'
                    }
                }
            },
            {
                id: 'employment-001',
                category: '취업',
                title: '청년 인턴십 프로그램',
                content: '청년 인턴십 프로그램은 만 15-34세 미취업 청년에게 3-6개월간 기업 인턴 기회를 제공하며, 월 180만원 이상의 급여를 지원합니다. 인턴 종료 후 정규직 전환 기회도 제공됩니다.',
                keywords: ['취업', '인턴', '일자리', '인턴십'],
                eligibility: '만 15-34세 미취업 청년',
                amount: '월 180만원 이상',
                url: 'https://www.work.go.kr',
                application: {
                    contact: {
                        department: '고용노동부 청년취업지원과',
                        phone: '1350'
                    }
                }
            },
            {
                id: 'startup-001',
                category: '창업',
                title: '청년 창업 지원금',
                content: '청년 창업 지원금은 만 39세 이하 예비창업자 또는 3년 이내 창업자에게 최대 1억원의 사업화 자금을 지원합니다. 창업 교육, 멘토링, 사무실 공간도 함께 제공됩니다.',
                keywords: ['창업', '지원금', '스타트업', '사업'],
                eligibility: '만 39세 이하 예비창업자 또는 3년 이내 창업자',
                amount: '최대 1억원',
                url: 'https://www.k-startup.go.kr',
                application: {
                    contact: {
                        department: '창업진흥원',
                        phone: '1357'
                    }
                }
            },
            {
                id: 'allowance-001',
                category: '수당',
                title: '서울시 청년수당',
                content: '서울시 청년수당은 만 19-34세 미취업 청년에게 월 50만원씩 최대 6개월간 지원합니다. 중위소득 150% 이하이며 주 20시간 이상 구직활동을 해야 합니다.',
                keywords: ['청년수당', '수당', '구직활동', '생활비'],
                eligibility: '만 19-34세 미취업, 중위소득 150% 이하',
                amount: '월 50만원 (최대 6개월)',
                url: 'https://youth.seoul.go.kr',
                application: {
                    contact: {
                        department: '서울시 청년정책담당관',
                        phone: '120'
                    }
                }
            }
        ];
    }

    async getEmbedding(text) {
        if (!this.apiKey || this.apiKey === 'your-api-key-here') {
            // API 키가 없으면 간단한 해시 기반 벡터 생성 (데모용)
            return this.generateMockEmbedding(text);
        }

        try {
            const response = await axios.post(
                this.embeddingsUrl,
                {
                    model: this.embeddingsModel,
                    input: text
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            return response.data.data[0].embedding;
        } catch (error) {
            console.error('Embedding API Error:', error.message);
            return this.generateMockEmbedding(text);
        }
    }

    generateMockEmbedding(text) {
        // 간단한 TF-IDF 스타일 벡터 생성 (데모용)
        const vector = new Array(1536).fill(0);
        for (let i = 0; i < text.length; i++) {
            const index = text.charCodeAt(i) % 1536;
            vector[index] += 1 / text.length;
        }
        return vector;
    }

    cosineSimilarity(vec1, vec2) {
        let dotProduct = 0;
        let norm1 = 0;
        let norm2 = 0;
        
        for (let i = 0; i < vec1.length; i++) {
            dotProduct += vec1[i] * vec2[i];
            norm1 += vec1[i] * vec1[i];
            norm2 += vec2[i] * vec2[i];
        }
        
        return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
    }

    async searchSimilarDocuments(query, topK = 3) {
        // 먼저 실시간 데이터 가져오기
        const realTimePolicies = await this.dataFetcher.searchPolicies(query);
        
        // 실시간 데이터가 있으면 우선 사용
        if (realTimePolicies.length > 0) {
            console.log(`🎯 Found ${realTimePolicies.length} real-time policies`);
            return realTimePolicies.slice(0, topK);
        }
        
        // 실시간 데이터가 없으면 기존 데이터베이스 검색
        const queryEmbedding = await this.getEmbedding(query);
        const similarities = [];

        // 정책 데이터베이스에서 검색
        for (const policy of this.policyDatabase) {
            const policyText = `${policy.title} ${policy.content} ${policy.keywords ? policy.keywords.join(' ') : ''}`;
            const policyEmbedding = await this.getEmbedding(policyText);
            const similarity = this.cosineSimilarity(queryEmbedding, policyEmbedding);
            
            similarities.push({
                ...policy,
                similarity
            });
        }

        // 유사도 순으로 정렬
        similarities.sort((a, b) => b.similarity - a.similarity);
        
        return similarities.slice(0, topK);
    }

    buildContext(documents) {
        let context = '다음은 관련 청년 정책 정보입니다:\n\n';
        
        documents.forEach((doc, index) => {
            context += `[정책 ${index + 1}]\n`;
            context += `제목: ${doc.title}\n`;
            context += `내용: ${doc.content || doc.summary || ''}\n`;
            
            // 자격 조건 상세 표시
            if (typeof doc.eligibility === 'object') {
                context += `자격조건:\n`;
                context += `  - 연령: ${doc.eligibility.age || '제한 없음'}\n`;
                context += `  - 거주지: ${doc.eligibility.residence || '제한 없음'}\n`;
                context += `  - 소듍: ${doc.eligibility.income || '제한 없음'}\n`;
                context += `  - 취업상태: ${doc.eligibility.employment || '무관'}\n`;
                context += `  - 추가조건: ${doc.eligibility.additional || '없음'}\n`;
            } else {
                context += `자격조건: ${doc.eligibility || '제한 없음'}\n`;
            }
            
            // 지원 내용 상세 표시
            if (doc.support && typeof doc.support === 'object') {
                context += `지원내용:\n`;
                context += `  - 내용: ${doc.support.content || ''}\n`;
                context += `  - 규모: ${doc.support.scale || ''}\n`;
                if (doc.support.details) {
                    context += `  - 상세: ${doc.support.details}\n`;
                }
            } else {
                context += `지원금액: ${doc.amount || doc.support || ''}\n`;
            }
            
            // 신청 기간 정보 (중요!)
            if (doc.period) {
                context += `신청기간:\n`;
                if (doc.period.application?.display) {
                    context += `  - 신청: ${doc.period.application.display}\n`;
                }
                if (doc.period.operation?.display) {
                    context += `  - 운영: ${doc.period.operation.display}\n`;
                }
            } else if (doc.applicationPeriod) {
                context += `신청기간: ${doc.applicationPeriod}\n`;
            }
            
            // 신청 방법
            if (doc.application) {
                context += `신청방법: ${doc.application.method || doc.applicationMethod || '방문 신청'}\n`;
                if (doc.application.url) {
                    context += `신청링크: ${doc.application.url}\n`;
                }
                
                // 연락처 정보 (중요!)
                if (doc.application.contact) {
                    if (doc.application.contact.phone) {
                        context += `📞 문의전화: ${doc.application.contact.phone}\n`;
                    }
                    if (doc.application.contact.department) {
                        context += `담당부서: ${doc.application.contact.department}\n`;
                    }
                    if (doc.application.contact.name) {
                        context += `담당자: ${doc.application.contact.name}\n`;
                    }
                }
            } else {
                context += `신청링크: ${doc.url || 'https://www.youthcenter.go.kr'}\n`;
                // 기본 연락처
                context += `📞 문의전화: 1811-9876 (온라인청년센터)\n`;
            }
            
            context += '\n';
        });
        
        return context;
    }

    async generateResponse(query, context) {
        if (!this.apiKey || this.apiKey === 'your-api-key-here') {
            // API 키가 없으면 컨텍스트 기반 응답 생성
            return this.generateContextBasedResponse(query, context);
        }

        try {
            const systemPrompt = `당신은 한국 청년 정책 전문 AI 어시스턴트 '유씨'입니다. 
            친절하고 정확하게 청년 정책 정보를 제공하세요.
            제공된 컨텍스트를 바탕으로 답변하되, 없는 정보는 만들지 마세요.
            특히 신청 기간, 운영 기간, 그리고 문의 전화번호를 반드시 포함해주세요.
            전화번호는 📞 아이콘과 함께 강조하여 표시해주세요.
            답변은 구조화하여 읽기 쉽게 작성하세요.`;

            const userPrompt = `컨텍스트:\n${context}\n\n질문: ${query}`;

            const response = await axios.post(
                this.apiUrl,
                {
                    model: this.model,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt }
                    ],
                    temperature: parseFloat(process.env.TEMPERATURE) || 0.7,
                    max_tokens: parseInt(process.env.MAX_TOKENS) || 2000
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: parseInt(process.env.API_TIMEOUT) || 30000
                }
            );

            return response.data.choices[0].message.content;
        } catch (error) {
            console.error('OpenAI API Error:', error.message);
            return this.generateContextBasedResponse(query, context);
        }
    }

    generateContextBasedResponse(query, context) {
        // 컨텍스트 기반 템플릿 응답 생성
        const lines = context.split('\n');
        let response = '';
        
        // 질문 키워드 추출
        const keywords = ['월세', '전세', '취업', '창업', '수당', '인턴', '지원금'];
        const foundKeyword = keywords.find(k => query.includes(k));
        
        if (foundKeyword) {
            response = `"${query}"에 대한 답변입니다.\n\n`;
            
            // 컨텍스트에서 관련 정보 추출
            const relevantLines = lines.filter(line => 
                line.includes(foundKeyword) || line.includes('제목:') || line.includes('지원금액:')
            );
            
            if (relevantLines.length > 0) {
                response += relevantLines.join('\n');
            }
        } else {
            response = context;
        }
        
        return response;
    }

    async processQuery(query) {
        try {
            // 1. 유사한 문서 검색 (상세 정보 포함)
            const similarDocuments = await this.searchSimilarDocuments(query);
            
            // 2. 상세 정보가 필요한 경우 추가 조회
            if (similarDocuments.length > 0 && similarDocuments[0].id) {
                // 상위 1개 정책에 대해 상세 정보 조회 시도
                try {
                    const detailedPolicy = await this.dataFetcher.getPolicyFullDetail(similarDocuments[0].id);
                    if (detailedPolicy && detailedPolicy.period) {
                        // 상세 정보로 업데이트
                        similarDocuments[0] = { ...similarDocuments[0], ...detailedPolicy };
                    }
                } catch (detailError) {
                    console.log('⚠️ Could not fetch detailed info:', detailError.message);
                }
            }
            
            // 3. 컨텍스트 구축 (상세 정보 포함)
            const context = this.buildContext(similarDocuments);
            
            // 4. 응답 생성
            const message = await this.generateResponse(query, context);
            
            // 5. 참조 링크 생성 (개선된 버전 - 전화번호 포함)
            const references = similarDocuments.map(doc => {
                const snippet = doc.content || doc.summary || '';
                const url = doc.application?.url || doc.url || 'https://www.youthcenter.go.kr';
                
                // 신청 기간 및 전화번호 정보 추가
                let displaySnippet = snippet.substring(0, 100) + '...';
                if (doc.period?.application?.display) {
                    displaySnippet += ` [신청: ${doc.period.application.display}]`;
                }
                if (doc.application?.contact?.phone) {
                    displaySnippet += ` [📞 ${doc.application.contact.phone}]`;
                }
                
                return {
                    title: doc.title,
                    url: url,
                    snippet: displaySnippet,
                    phone: doc.application?.contact?.phone || '1811-9876' // 전화번호 포함
                };
            });
            
            // 6. 후속 질문 생성
            const followUpQuestions = this.generateFollowUpQuestions(similarDocuments);
            
            return {
                message,
                references,
                followUpQuestions,
                documents: similarDocuments,
                hasDetailedInfo: similarDocuments.some(doc => doc.period?.application?.display)
            };
        } catch (error) {
            console.error('RAG System Error:', error);
            throw error;
        }
    }

    generateFollowUpQuestions(documents) {
        const questions = new Set();
        
        documents.forEach(doc => {
            if (doc.category === '주거') {
                questions.add('월세 지원 신청 방법은?');
                questions.add('전세자금 대출 조건은?');
            } else if (doc.category === '취업') {
                questions.add('인턴십 프로그램 신청하려면?');
                questions.add('취업 지원 프로그램 종류는?');
            } else if (doc.category === '창업') {
                questions.add('창업 지원금 신청 조건은?');
                questions.add('창업 교육 프로그램은?');
            } else if (doc.category === '수당' || doc.category === '복지') {
                questions.add('청년수당 신청 자격은?');
                questions.add('구직활동 증명 방법은?');
            } else if (doc.category === '교육') {
                questions.add('교육비 지원 받으려면?');
                questions.add('직업훈련 프로그램은?');
            }
        });
        
        return Array.from(questions).slice(0, 3);
    }
    
    // 자동 데이터 갱신
    startAutoRefresh() {
        const interval = parseInt(process.env.AUTO_REFRESH_INTERVAL) || 24;
        const milliseconds = interval * 60 * 60 * 1000;
        
        setInterval(async () => {
            console.log('🔄 Auto-refreshing policy data...');
            try {
                const freshPolicies = await this.dataFetcher.fetchAllPolicies();
                if (freshPolicies.length > 0) {
                    this.policyDatabase = [...this.policyDatabase, ...freshPolicies];
                    // 중복 제거
                    const uniquePolicies = new Map();
                    this.policyDatabase.forEach(p => uniquePolicies.set(p.id, p));
                    this.policyDatabase = Array.from(uniquePolicies.values());
                    console.log(`✅ Policy database updated: ${this.policyDatabase.length} policies`);
                }
            } catch (error) {
                console.error('❌ Auto-refresh failed:', error.message);
            }
        }, milliseconds);
        
        console.log(`⏰ Auto-refresh scheduled every ${interval} hours`);
    }
}

module.exports = RAGSystem;