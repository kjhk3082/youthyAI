const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const compression = require('compression');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const OpenAI = require('openai');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Import district policies API
const districtPoliciesAPI = require('./district-policies-api');

// Initialize OpenAI with GPT-4
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(morgan('combined'));

// Static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/css', express.static(path.join(__dirname, 'public/css')));
app.use('/js', express.static(path.join(__dirname, 'public/js')));

// Mount district policies API
app.use('/api', districtPoliciesAPI);

// Current date for filtering expired policies
const CURRENT_DATE = new Date();

// Korean region mapping
const REGION_MAPPING = {
    '서울': '003002001001', '부산': '003002001002', '대구': '003002001003',
    '인천': '003002001004', '광주': '003002001005', '대전': '003002001006',
    '울산': '003002001007', '경기': '003002001008', '강원': '003002001009',
    '충북': '003002001010', '충남': '003002001011', '전북': '003002001012',
    '전남': '003002001013', '경북': '003002001014', '경남': '003002001015',
    '제주': '003002001016', '세종': '003002001017'
};

// Cache for API responses (5 minutes for real-time data)
const apiCache = new Map();
const CACHE_DURATION = 300000; // 5 minutes

// Calculate D-day
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
            return 'D-Day (오늘 마감!)';
        } else if (diffDays <= 7) {
            return `⚠️ D-${diffDays} (마감 임박!)`;
        } else {
            return `D-${diffDays}`;
        }
    } catch (error) {
        return '날짜 확인 필요';
    }
}

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        message: 'YOUTHY Realtime API Server (GPT-4 Turbo)',
        model: 'gpt-4-turbo-preview',
        serverTime: CURRENT_DATE.toISOString(),
        apis: {
            'OpenAI_GPT4': !!process.env.OPENAI_API_KEY,
            'YouthCenter': !!process.env.YOUTHCENTER_API_KEY,
            'Tavily': !!process.env.TAVILY_API_KEY,
            'Seoul': !!process.env.SEOUL_OPEN_DATA_API_KEY
        },
        features: ['실시간 데이터', 'D-Day 계산', '신청 정보', '전국 정책']
    });
});

// Main chat endpoint
app.post('/api/chat', async (req, res) => {
    const { message, userId, region } = req.body;
    console.log(`📨 실시간 요청: ${message}, 지역: ${region || '전국'}`);
    
    try {
        const response = await processRealtimeQuery(message, region);
        res.json(response);
    } catch (error) {
        console.error('처리 오류:', error);
        res.json({
            message: '죄송합니다. 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
            error: error.message
        });
    }
});

// Process realtime query with multiple APIs
async function processRealtimeQuery(message, userRegion) {
    const intent = analyzeIntent(message);
    const region = extractRegion(message) || userRegion;
    
    // Self introduction
    if (intent === 'self-introduction') {
        return getSelfIntroduction();
    }
    
    // Load local database as fallback
    let localPolicies = [];
    try {
        const dbPath = path.join(__dirname, 'database', 'youth_policies.json');
        if (fs.existsSync(dbPath)) {
            const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
            localPolicies = data.policies || [];
            console.log(`📂 로컬 DB: ${localPolicies.length}개 정책 로드됨`);
        }
    } catch (error) {
        console.error('로컬 DB 로드 오류:', error.message);
    }
    
    // Parallel API calls for real-time data
    const [youthCenterData, tavilyData, seoulData] = await Promise.allSettled([
        fetchYouthCenterRealtime(message, region),
        searchTavilyRealtime(message),
        region === '서울' ? fetchSeoulPolicies(message) : Promise.resolve([])
    ]);
    
    // Combine all results
    let allPolicies = [];
    let webReferences = [];
    
    if (youthCenterData.status === 'fulfilled') {
        allPolicies = [...allPolicies, ...youthCenterData.value];
        console.log(`✅ 청년센터 API: ${youthCenterData.value.length}개 정책 발견`);
    }
    
    if (tavilyData.status === 'fulfilled') {
        webReferences = tavilyData.value.references || [];
        allPolicies = [...allPolicies, ...(tavilyData.value.policies || [])];
        console.log(`✅ Tavily 검색: ${tavilyData.value.policies?.length || 0}개 정책, ${webReferences.length}개 참조`);
    }
    
    if (seoulData.status === 'fulfilled' && seoulData.value.length > 0) {
        allPolicies = [...allPolicies, ...seoulData.value];
        console.log(`✅ 서울시 API: ${seoulData.value.length}개 정책 발견`);
    }
    
    // Add local policies as fallback (filter by intent and region)
    if (allPolicies.length < 5 && localPolicies.length > 0) {
        const filteredLocal = localPolicies.filter(p => {
            const matchesRegion = !region || p.region === region || p.region === '전국';
            const matchesIntent = !intent || intent === 'general' || 
                (intent === 'housing' && p.category?.includes('주거')) ||
                (intent === 'employment' && p.category?.includes('취업')) ||
                (intent === 'startup' && p.category?.includes('창업')) ||
                (intent === 'education' && p.category?.includes('교육'));
            return matchesRegion && matchesIntent;
        }).map(p => ({
            ...p,
            deadline: p.applicationPeriod || '상시',
            applicationUrl: p.url || '정책 사이트 확인',
            applicationMethod: p.applicationMethod || '온라인/오프라인',
            applicationPlace: '관할 기관',
            documents: '신분증, 신청서',
            source: 'Local Database',
            lastUpdate: new Date().toISOString()
        }));
        
        allPolicies = [...allPolicies, ...filteredLocal];
        console.log(`📂 로컬 DB 백업: ${filteredLocal.length}개 정책 추가`);
    }
    
    // Filter out expired policies
    const activePolicies = allPolicies.filter(policy => {
        const dday = calculateDDay(policy.deadline);
        return dday !== null;
    });
    
    // Add D-day information
    activePolicies.forEach(policy => {
        policy.dday = calculateDDay(policy.deadline);
    });
    
    // Sort by urgency (closest deadline first)
    activePolicies.sort((a, b) => {
        if (a.dday === '상시모집') return 1;
        if (b.dday === '상시모집') return -1;
        const aDays = parseInt(a.dday.match(/D-(\d+)/)?.[1] || '999');
        const bDays = parseInt(b.dday.match(/D-(\d+)/)?.[1] || '999');
        return aDays - bDays;
    });
    
    // Generate GPT-4 response with real-time data
    const gptResponse = await generateRealtimeResponse(
        message, 
        activePolicies.slice(0, 10), 
        intent, 
        region,
        webReferences
    );
    
    return {
        message: gptResponse,
        policies: activePolicies.slice(0, 5).map(p => ({
            ...p,
            신청방법: p.applicationMethod,
            신청사이트: p.applicationUrl,
            신청장소: p.applicationPlace,
            마감일: p.dday
        })),
        references: webReferences.slice(0, 3),
        metadata: {
            totalFound: activePolicies.length,
            expiredFiltered: allPolicies.length - activePolicies.length,
            region: region || '전국',
            intent,
            serverTime: CURRENT_DATE.toISOString(),
            dataSource: '실시간 API'
        },
        followUpQuestions: [
            '신청 방법 자세히 알려줘',
            '필요한 서류는 뭐야?',
            '다른 지역 정책도 보여줘',
            '마감 임박한 정책 보여줘'
        ]
    };
}

// Fetch real-time data from Youth Center API
async function fetchYouthCenterRealtime(query, region) {
    if (!process.env.YOUTHCENTER_API_KEY) {
        return [];
    }
    
    try {
        const params = {
            apiKey: process.env.YOUTHCENTER_API_KEY,
            display: 30,  // 더 많은 결과
            pageIndex: 1,
            srchWord: query,
            bizTycdSel: '003002001,003002002,003002003'  // 모든 청년정책 유형
        };
        
        if (region && REGION_MAPPING[region]) {
            params.srchPolyBizArea = REGION_MAPPING[region];
        }
        
        const response = await axios.get('https://www.youthcenter.go.kr/opi/openApiPolicyList.do', {
            params,
            timeout: 5000
        });
        
        const policies = response.data?.policyList || [];
        
        return policies.map(p => ({
            id: p.polyBizSjnm,
            title: p.polyBizSjnm,
            category: p.polyBizTy,
            region: p.polyBizArea || '전국',
            description: p.polyBizCn || p.polyItcnCn,
            amount: p.sporCn || '지원 내용 참조',
            eligibility: `${p.ageInfo || '청년'} / ${p.edubgReqmCn || '제한없음'}`,
            deadline: p.rqutPrdEnd || p.rqutPrdCn || '상시',
            applicationMethod: p.rqutProcCn || '온라인/오프라인',
            applicationUrl: p.applUrl || p.rfcSiteUrl || '정책 사이트 참조',
            applicationPlace: p.basDaddr || '관할 기관',
            documents: p.pstnPaprCn || '신분증, 신청서',
            contact: p.rfcSiteUrl || p.applUrl,
            source: 'Youth Center API',
            lastUpdate: new Date().toISOString()
        }));
    } catch (error) {
        console.error('Youth Center API 오류:', error.message);
        return [];
    }
}

// Search using Tavily for the latest policy information
async function searchTavilyRealtime(query) {
    if (!process.env.TAVILY_API_KEY) {
        return { policies: [], references: [] };
    }
    
    try {
        // 더 정확한 검색 쿼리
        const currentYear = new Date().getFullYear();
        const searchQuery = `${query} 청년 정책 지원 ${currentYear} 신청`;
        
        const response = await axios.post('https://api.tavily.com/search', {
            api_key: process.env.TAVILY_API_KEY,
            query: searchQuery,
            search_depth: 'advanced',
            max_results: 10,
            include_answer: true
        }, {
            timeout: 10000
        });
        
        const results = response.data?.results || [];
        
        // Extract policy information from search results
        const policies = [];
        const references = [];
        
        results.forEach(result => {
            references.push({
                title: result.title,
                url: result.url,
                snippet: result.content?.substring(0, 200)
            });
            
            // Try to extract policy info from content
            if (result.content?.includes('신청') || result.content?.includes('지원')) {
                const policy = extractPolicyFromText(result.content, result.title, result.url);
                if (policy) {
                    policies.push(policy);
                }
            }
        });
        
        return { policies, references };
    } catch (error) {
        console.error('Tavily API 오류:', error.message);
        return { policies: [], references: [] };
    }
}

// Fetch Seoul city policies
async function fetchSeoulPolicies(query) {
    if (!process.env.SEOUL_OPEN_DATA_API_KEY) {
        return [];
    }
    
    try {
        const response = await axios.get(`http://openapi.seoul.go.kr:8088/${process.env.SEOUL_OPEN_DATA_API_KEY}/json/youngManPolicy/1/20/${encodeURIComponent(query)}`, {
            timeout: 5000
        });
        
        const policies = response.data?.youngManPolicy?.row || [];
        
        return policies.map(p => ({
            title: p.POLICY_NAME,
            category: p.POLICY_TYPE,
            region: '서울',
            description: p.POLICY_DESC,
            amount: p.SUPPORT_CONTENT,
            eligibility: p.APPLY_TARGET,
            deadline: p.APPLY_PERIOD,
            applicationMethod: p.APPLY_METHOD,
            applicationUrl: p.DETAIL_URL,
            applicationPlace: p.APPLY_PLACE,
            documents: p.NECESSARY_DOC,
            contact: p.INQUIRY,
            source: 'Seoul Open Data',
            lastUpdate: new Date().toISOString()
        }));
    } catch (error) {
        console.error('Seoul API 오류:', error.message);
        return [];
    }
}

// Extract policy information from text
function extractPolicyFromText(text, title, url) {
    const policy = {
        title: title,
        description: text.substring(0, 300),
        applicationUrl: url,
        source: 'Web Search',
        lastUpdate: new Date().toISOString()
    };
    
    // Extract deadline
    const deadlineMatch = text.match(/(\d{4})[년\.]?\s*(\d{1,2})[월\.]?\s*(\d{1,2})[일]?\s*까지/);
    if (deadlineMatch) {
        policy.deadline = `${deadlineMatch[1]}-${deadlineMatch[2].padStart(2, '0')}-${deadlineMatch[3].padStart(2, '0')}`;
    }
    
    // Extract amount
    const amountMatch = text.match(/(\d{1,4}만\s?원|월\s?\d{1,3}만\s?원)/);
    if (amountMatch) {
        policy.amount = amountMatch[0];
    }
    
    // Extract application method
    if (text.includes('온라인')) {
        policy.applicationMethod = '온라인 신청';
    }
    if (text.includes('방문')) {
        policy.applicationMethod = (policy.applicationMethod ? policy.applicationMethod + ', ' : '') + '방문 신청';
    }
    
    return policy;
}

// Generate response using GPT-4 with real-time data
async function generateRealtimeResponse(userMessage, policies, intent, region, references) {
    const systemPrompt = `당신은 한국 청년정책 실시간 정보 전문가입니다.
    
현재 서버 시간: ${CURRENT_DATE.toLocaleString('ko-KR')}
사용자 지역: ${region || '전국'}

중요 원칙:
1. 반드시 실시간 API 데이터를 기반으로 답변
2. 마감일이 지난 정책은 절대 안내하지 않음
3. D-Day 정보를 명확히 표시 (D-7 이내는 강조)
4. 신청 방법, 신청 사이트, 필요 서류를 구체적으로 안내
5. 정보 출처와 최종 업데이트 시간 명시
6. 신뢰성을 위해 공식 사이트 링크 제공

응답 구조:
- 정책별로 번호를 매겨 구분
- 각 정책마다: 제목, D-Day, 지원내용, 신청방법, 신청링크 포함
- **링크는 반드시 [바로가기](URL) 형식으로 작성**
- 마감 임박 정책은 ⚠️ 표시
- 정보 출처 명시`;

    const policiesInfo = policies.map((p, i) => `
${i + 1}. **${p.title}**
   - 마감: ${p.dday}
   - 지역: ${p.region}
   - 지원: ${p.amount || '상세내용 참조'}
   - 자격: ${p.eligibility || '청년'}
   - 신청방법: ${p.applicationMethod || '온라인/오프라인'}
   - 신청사이트: ${p.applicationUrl || '확인 필요'}
   - 신청장소: ${p.applicationPlace || '해당 기관'}
   - 필요서류: ${p.documents || '신분증, 신청서'}
   - 출처: ${p.source}
   - 업데이트: ${p.lastUpdate}
`).join('\n');

    const referencesInfo = references.map(r => `- ${r.title}: ${r.url}`).join('\n');

    const userPrompt = `
사용자 질문: "${userMessage}"

실시간 조회 결과 (${policies.length}개 정책):
${policiesInfo}

웹 검색 참조:
${referencesInfo}

위 실시간 데이터를 바탕으로 사용자에게 신뢰할 수 있는 답변을 작성해주세요.
반드시 D-Day 정보와 신청 방법을 포함하고, 정보가 실시간 API에서 조회된 것임을 명시하세요.
**모든 신청 사이트 링크는 [바로가기](URL) 형식의 클릭 가능한 링크로 작성하세요.**`;

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4-turbo-preview",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            max_tokens: 2500,
            temperature: 0.7
        });
        
        return completion.choices[0]?.message?.content || generateFallbackResponse(policies);
    } catch (error) {
        console.error('OpenAI 오류:', error);
        return generateFallbackResponse(policies);
    }
}

// Fallback response
function generateFallbackResponse(policies) {
    if (policies.length === 0) {
        return `죄송합니다. 현재 조건에 맞는 청년 정책을 찾을 수 없습니다.

다른 검색어나 지역으로 다시 시도해보시거나, 아래 공식 사이트를 직접 방문해주세요:
- 온라인청년센터: https://www.youthcenter.go.kr
- 서울청년포털: https://youth.seoul.go.kr`;
    }
    
    let response = `🔍 **실시간 조회 결과** (${new Date().toLocaleString('ko-KR')})\n\n`;
    response += `총 ${policies.length}개의 청년 정책을 찾았습니다:\n\n`;
    
    policies.slice(0, 5).forEach((p, i) => {
        response += `**${i + 1}. ${p.title}**\n`;
        response += `   📅 마감: ${p.dday}\n`;
        response += `   💰 지원: ${p.amount || '상세내용 참조'}\n`;
        response += `   📍 지역: ${p.region}\n`;
        if (p.applicationUrl && p.applicationUrl !== '확인 필요') {
            response += `   🔗 신청: [바로가기](${p.applicationUrl})\n\n`;
        } else {
            response += `   🔗 신청: 공식 사이트 확인 필요\n\n`;
        }
    });
    
    return response;
}

// Analyze user intent
function analyzeIntent(message) {
    const msg = message.toLowerCase();
    
    if (msg.includes('안녕') || msg.includes('누구') || msg.includes('소개')) {
        return 'self-introduction';
    }
    if (msg.includes('주거') || msg.includes('주택') || msg.includes('월세') || msg.includes('전세')) {
        return 'housing';
    }
    if (msg.includes('취업') || msg.includes('일자리') || msg.includes('구직')) {
        return 'employment';
    }
    if (msg.includes('창업') || msg.includes('사업')) {
        return 'startup';
    }
    if (msg.includes('교육') || msg.includes('학습')) {
        return 'education';
    }
    if (msg.includes('마감') || msg.includes('임박') || msg.includes('d-')) {
        return 'urgent';
    }
    return 'general';
}

// Extract region from message
function extractRegion(message) {
    for (const region of Object.keys(REGION_MAPPING)) {
        if (message.includes(region)) {
            return region;
        }
    }
    return null;
}

// Self introduction
function getSelfIntroduction() {
    return {
        message: `안녕하세요! 저는 **YOUTHY 실시간 청년정책 AI**입니다 🚀

**💎 실시간 데이터 기반 서비스**
• 🔥 **GPT-4 Turbo** 최고급 AI 모델
• ⚡ **실시간 API 연동** - 청년센터, 정부, 지자체
• 📅 **D-Day 자동 계산** - 마감일 실시간 체크
• 🏛️ **전국 17개 시도** 정책 완벽 커버
• 📝 **신청 정보 완벽 제공** - 사이트, 장소, 서류

**✅ 제공 정보**
• 신청 기간 및 D-Day (마감 임박 알림)
• 신청 사이트 직접 링크
• 방문 신청 장소 안내
• 필요 서류 목록
• 지원 금액 및 혜택
• 자격 요건 상세

**🚫 과거 정책 자동 필터링**
서버 시간(${CURRENT_DATE.toLocaleDateString('ko-KR')}) 기준 만료된 정책은 표시하지 않습니다.

무엇을 도와드릴까요? 지역과 관심 분야를 말씀해주세요! 😊`,
        metadata: {
            serverTime: CURRENT_DATE.toISOString(),
            model: 'GPT-4 Turbo',
            dataSource: 'Realtime APIs'
        },
        followUpQuestions: [
            '오늘 마감하는 정책 보여줘',
            '서울 청년 주거 정책 알려줘',
            '전국 창업 지원금 보여줘',
            'D-7 이내 마감 정책 알려줘'
        ]
    };
}

// Start server
console.log('🚀 Starting YOUTHY Realtime Policy Server...');
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✨ YOUTHY Realtime Server running on http://localhost:${PORT}`);
    console.log(`📅 Server Time: ${CURRENT_DATE.toLocaleString('ko-KR')}`);
    console.log(`🤖 AI Model: GPT-4 Turbo`);
    console.log(`⚡ APIs: YouthCenter, Tavily, Seoul OpenData`);
    console.log(`📊 Features: Real-time data, D-Day calculation, Application info`);
});

module.exports = app;