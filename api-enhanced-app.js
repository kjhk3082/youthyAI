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

// Initialize OpenAI
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
app.use('/images', express.static(path.join(__dirname, 'public/images')));

// Load local youth policies data
const youthPolicies = JSON.parse(fs.readFileSync(path.join(__dirname, 'database', 'youth_policies.json'), 'utf8'));

// Cache for API responses
const apiCache = new Map();
const CACHE_DURATION = 3600000; // 1 hour

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        message: 'YOUTHY AI Server with API Integration',
        timestamp: new Date().toISOString(),
        apis: {
            openai: !!process.env.OPENAI_API_KEY,
            tavily: !!process.env.TAVILY_API_KEY,
            perplexity: !!process.env.PERPLEXITY_API_KEY,
            youthcenter: !!process.env.YOUTHCENTER_API_KEY,
            seoul: !!process.env.SEOUL_OPEN_DATA_API_KEY
        }
    });
});

app.post('/api/chat', async (req, res) => {
    try {
        const { message, region } = req.body;
        console.log(`📨 Received message: ${message}`);
        
        // Get enhanced response using multiple APIs
        const response = await generateEnhancedResponse(message, region);
        
        res.json(response);
    } catch (error) {
        console.error('Chat error:', error);
        res.status(500).json({ 
            error: 'Failed to process message',
            message: '죄송합니다. 일시적인 오류가 발생했습니다. 다시 시도해주세요.' 
        });
    }
});

// Enhanced response generation with real APIs
async function generateEnhancedResponse(message, region) {
    const intent = analyzeIntent(message);
    
    // Check for self-introduction
    if (isSelfIntroductionRequest(message)) {
        return getSelfIntroduction();
    }
    
    // Parallel API calls for comprehensive data
    const [localPolicies, apiPolicies, webSearchResults] = await Promise.allSettled([
        findLocalPolicies(message, region),
        fetchYouthCenterPolicies(message, region),
        searchWebForPolicies(message)
    ]);
    
    // Combine all results
    let allPolicies = [];
    
    if (localPolicies.status === 'fulfilled') {
        allPolicies = [...allPolicies, ...localPolicies.value];
    }
    
    if (apiPolicies.status === 'fulfilled' && apiPolicies.value) {
        allPolicies = [...allPolicies, ...apiPolicies.value];
    }
    
    // Use OpenAI for intelligent response generation
    let enhancedMessage = '';
    if (process.env.OPENAI_API_KEY && allPolicies.length > 0) {
        try {
            enhancedMessage = await generateOpenAIResponse(message, allPolicies, intent);
        } catch (error) {
            console.error('OpenAI error:', error);
            enhancedMessage = generateFallbackResponse(intent, allPolicies, message);
        }
    } else {
        enhancedMessage = generateFallbackResponse(intent, allPolicies, message);
    }
    
    // Extract references from web search
    const references = [];
    if (webSearchResults.status === 'fulfilled' && webSearchResults.value) {
        references.push(...webSearchResults.value.slice(0, 3));
    }
    
    return {
        message: enhancedMessage,
        policies: allPolicies.slice(0, 5),
        references,
        followUpQuestions: generateFollowUpQuestions(intent),
        intent,
        totalFound: allPolicies.length,
        timestamp: new Date().toISOString()
    };
}

// Fetch policies from Youth Center API
async function fetchYouthCenterPolicies(query, region) {
    if (!process.env.YOUTHCENTER_API_KEY) {
        console.log('Youth Center API key not configured');
        return [];
    }
    
    const cacheKey = `youthcenter_${query}_${region}`;
    if (apiCache.has(cacheKey)) {
        const cached = apiCache.get(cacheKey);
        if (Date.now() - cached.timestamp < CACHE_DURATION) {
            return cached.data;
        }
    }
    
    try {
        const response = await axios.get('https://www.youthcenter.go.kr/opi/openApiPolicyList.do', {
            params: {
                apiKey: process.env.YOUTHCENTER_API_KEY,
                srchPolyBizSecd: '003002001', // 청년정책
                display: 20,
                pageIndex: 1,
                query: query,
                srchPolyBizArea: region
            },
            timeout: 5000
        });
        
        const policies = response.data?.policyList || [];
        const formattedPolicies = policies.map(p => ({
            id: p.polyBizSjnm,
            title: p.polyBizSjnm,
            category: p.polyBizTy,
            region: p.polyBizArea || '전국',
            description: p.polyBizCn,
            amount: p.sporAmt || '상세내용 참조',
            eligibility: p.ageInfo || '청년',
            applicationPeriod: p.rqutPrdCn || '상시',
            applicationMethod: p.applUrl || '온라인 신청',
            url: p.applUrl,
            source: 'YouthCenter API'
        }));
        
        apiCache.set(cacheKey, { data: formattedPolicies, timestamp: Date.now() });
        return formattedPolicies;
    } catch (error) {
        console.error('Youth Center API error:', error.message);
        return [];
    }
}

// Search web using Tavily API
async function searchWebForPolicies(query) {
    if (!process.env.TAVILY_API_KEY) {
        console.log('Tavily API key not configured');
        return [];
    }
    
    try {
        const response = await axios.post('https://api.tavily.com/search', {
            api_key: process.env.TAVILY_API_KEY,
            query: `${query} 청년 정책 지원 2025`,
            search_depth: 'basic',
            max_results: 5
        }, {
            timeout: 5000
        });
        
        return response.data?.results?.map(r => ({
            title: r.title,
            url: r.url,
            snippet: r.content
        })) || [];
    } catch (error) {
        console.error('Tavily API error:', error.message);
        return [];
    }
}

// Generate response using OpenAI
async function generateOpenAIResponse(userMessage, policies, intent) {
    const systemPrompt = `당신은 한국 청년 정책 전문 상담사입니다. 
    청년들에게 정책 정보를 친근하고 이해하기 쉽게 설명해주세요.
    이모지를 적절히 사용하고, 중요한 정보는 **볼드** 처리해주세요.`;
    
    const policiesContext = policies.slice(0, 5).map(p => 
        `- ${p.title}: ${p.description} (지원금: ${p.amount}, 자격: ${p.eligibility})`
    ).join('\n');
    
    const userPrompt = `
    사용자 질문: "${userMessage}"
    의도: ${intent}
    
    찾은 정책들:
    ${policiesContext}
    
    위 정책들을 바탕으로 사용자에게 도움이 되는 답변을 작성해주세요.
    각 정책의 핵심 정보를 포함하되, 자연스럽게 설명해주세요.`;
    
    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            max_tokens: 1000,
            temperature: 0.7
        });
        
        return completion.choices[0]?.message?.content || generateFallbackResponse(intent, policies, userMessage);
    } catch (error) {
        console.error('OpenAI API error:', error);
        return generateFallbackResponse(intent, policies, userMessage);
    }
}

// Local policy search
function findLocalPolicies(message, region) {
    const keywords = extractKeywords(message);
    const intent = analyzeIntent(message);
    
    let filtered = [...youthPolicies];
    
    // Extract region from message
    let targetRegion = region;
    const lowerMessage = message.toLowerCase();
    if (!targetRegion) {
        if (lowerMessage.includes('서울')) targetRegion = '서울';
        else if (lowerMessage.includes('부산')) targetRegion = '부산';
        else if (lowerMessage.includes('경기')) targetRegion = '경기도';
        else if (lowerMessage.includes('강원')) targetRegion = '강원도';
        else if (lowerMessage.includes('춘천')) targetRegion = '춘천';
    }
    
    // Filter by region
    if (targetRegion && targetRegion !== '전국') {
        filtered = filtered.filter(p => 
            p.region === targetRegion || p.region === '전국'
        );
    }
    
    // Filter by category based on intent
    const categoryMap = {
        'housing': '주거',
        'employment': '취업',
        'startup': '창업',
        'education': '교육',
        'savings': '자산형성'
    };
    
    if (categoryMap[intent]) {
        filtered = filtered.filter(p => p.category === categoryMap[intent]);
    }
    
    // Score by relevance
    return filtered.map(policy => {
        let score = 0;
        const policyText = `${policy.title} ${policy.description}`.toLowerCase();
        keywords.forEach(keyword => {
            if (policyText.includes(keyword.toLowerCase())) score += 2;
        });
        return { ...policy, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
}

// Helper functions
function analyzeIntent(message) {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('20대')) return 'age-20s';
    if (lowerMessage.includes('30대')) return 'age-30s';
    if (lowerMessage.includes('인기') || lowerMessage.includes('추천')) return 'popular';
    if (lowerMessage.includes('월세') || lowerMessage.includes('전세') || lowerMessage.includes('주거')) return 'housing';
    if (lowerMessage.includes('취업') || lowerMessage.includes('일자리')) return 'employment';
    if (lowerMessage.includes('창업')) return 'startup';
    if (lowerMessage.includes('교육') || lowerMessage.includes('배움')) return 'education';
    if (lowerMessage.includes('적금') || lowerMessage.includes('자산')) return 'savings';
    
    return 'general';
}

function isSelfIntroductionRequest(message) {
    const selfKeywords = ['너 뭐야', '너 누구', '누구야', '뭐하는', '자기소개'];
    const lowerMessage = message.toLowerCase();
    if (lowerMessage.includes('정책') || lowerMessage.includes('20대') || lowerMessage.includes('30대')) {
        return false;
    }
    return selfKeywords.some(keyword => lowerMessage.includes(keyword));
}

function getSelfIntroduction() {
    return {
        message: `안녕하세요! 저는 **YOUTHY AI 챗봇**입니다 🤖\n\n` +
                `저는 실시간 API를 활용해 최신 청년 정책을 안내해드립니다!\n\n` +
                `**🔥 활용 중인 데이터:**\n` +
                `• 청년센터 실시간 API\n` +
                `• 서울 열린데이터 광장\n` +
                `• Tavily 웹 검색\n` +
                `• OpenAI GPT-3.5\n` +
                `• 로컬 정책 DB (20+ 정책)\n\n` +
                `**💡 제공 서비스:**\n` +
                `• 실시간 청년 정책 검색\n` +
                `• 지역별 맞춤 정책 안내\n` +
                `• AI 기반 상세 설명\n` +
                `• 신청 방법 & 자격 조건 안내\n\n` +
                `궁금한 정책이 있으시면 편하게 물어보세요! 😊`,
        references: [],
        followUpQuestions: [
            '최신 청년 정책 보여줘',
            '내 지역 정책 알려줘',
            '인기 있는 정책 추천해줘'
        ],
        intent: 'self-introduction',
        timestamp: new Date().toISOString()
    };
}

function extractKeywords(message) {
    const stopWords = ['하는', '있는', '되는', '하고', '있고', '합니다', '좀', '소개', '알려', '해줘'];
    return message.split(/\s+/).filter(word => 
        word.length > 1 && !stopWords.includes(word)
    );
}

function generateFollowUpQuestions(intent) {
    const questions = {
        'popular': ['신청 방법 자세히 알려줘', '자격 조건은 어떻게 되나요?', '다른 인기 정책도 보여줘'],
        'housing': ['월세 지원 자격 조건은?', '전세 대출도 가능한가요?', '신청 서류는 뭐가 필요해요?'],
        'employment': ['취업 준비생도 가능한가요?', '지원금은 얼마나 되나요?', '신청 기간은 언제까지?'],
        'startup': ['창업 자금 규모는?', '사업계획서 필요한가요?', '심사 기준은 뭐예요?'],
        'education': ['교육비 전액 지원인가요?', '어떤 교육이 가능해요?', '수료 후 취업 연계되나요?'],
        'savings': ['얼마까지 적금 가능해요?', '이자율은 어떻게 되나요?', '중도 해지 가능한가요?'],
        'general': ['인기 있는 정책 보여줘', '내 나이에 맞는 정책은?', '우리 지역 정책 알려줘']
    };
    
    return questions[intent] || questions['general'];
}

function generateFallbackResponse(intent, policies, message) {
    if (policies.length === 0) {
        return `😅 "${message}"에 대한 정책을 찾지 못했어요.\n\n` +
               `다른 키워드로 검색하거나 아래 카테고리를 선택해보세요:\n` +
               `• 🏠 주거 (월세, 전세)\n` +
               `• 💼 취업 (구직, 교육)\n` +
               `• 🚀 창업 (자금, 공간)\n` +
               `• 💰 자산 (적금, 대출)`;
    }
    
    let response = getIntroByIntent(intent, message) + '\n\n';
    
    policies.slice(0, 5).forEach((policy, idx) => {
        response += `**${idx + 1}. ${policy.title}**\n`;
        response += `📍 ${policy.region} | 💰 ${policy.amount}\n`;
        response += `📝 ${policy.description}\n`;
        response += `✅ ${policy.eligibility}\n\n`;
    });
    
    if (policies.length > 5) {
        response += `\n📌 추가로 ${policies.length - 5}개의 정책이 더 있습니다!`;
    }
    
    return response;
}

function getIntroByIntent(intent, message) {
    const intros = {
        'popular': '🏆 **인기 청년 정책**',
        'housing': '🏠 **청년 주거 지원 정책**',
        'employment': '💼 **청년 취업 지원 정책**',
        'startup': '🚀 **청년 창업 지원 정책**',
        'education': '📚 **청년 교육 지원 정책**',
        'savings': '💰 **청년 자산형성 지원**',
        'age-20s': '🎯 **20대 맞춤 정책**',
        'age-30s': '🎯 **30대 맞춤 정책**',
        'general': `📋 **"${message}" 검색 결과**`
    };
    
    return intros[intent] || intros['general'];
}

// Error handling
app.use((err, req, res, next) => {
    console.error('Error:', err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

// Start server
console.log('🔧 Starting API-Enhanced YOUTHY Server...');
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 API-Enhanced YOUTHY Server running on http://localhost:${PORT}`);
    console.log(`📊 APIs configured:`, {
        OpenAI: !!process.env.OPENAI_API_KEY,
        Tavily: !!process.env.TAVILY_API_KEY,
        YouthCenter: !!process.env.YOUTHCENTER_API_KEY,
        Seoul: !!process.env.SEOUL_OPEN_DATA_API_KEY
    });
});

module.exports = app;