const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const compression = require('compression');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// RAG System import
const RAGSystem = require('./src/ragSystem');
const ragSystem = new RAGSystem();

// Search Service import for enhanced responses
const SearchService = require('./services/searchService');
const searchService = new SearchService();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet({
    contentSecurityPolicy: false,
}));
app.use(compression());
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(morgan('combined'));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/css', express.static(path.join(__dirname, 'public/css')));
app.use('/js', express.static(path.join(__dirname, 'public/js')));
app.use('/images', express.static(path.join(__dirname, 'public/images')));

// In-memory storage for demo (replace with database in production)
const chatHistory = [];
const policyDatabase = {
    housing: [
        {
            id: 1,
            title: "서울시 청년 월세 지원",
            description: "만 19-39세 무주택 청년에게 월 최대 20만원 지원",
            eligibility: "중위소득 150% 이하",
            amount: "월 20만원 (최대 12개월)",
            url: "https://youth.seoul.go.kr",
            region: "서울"
        },
        {
            id: 2,
            title: "전세자금 대출 지원",
            description: "청년 전세자금 저리 대출",
            eligibility: "만 34세 이하 무주택자",
            amount: "최대 2억원",
            url: "https://nhuf.molit.go.kr",
            region: "전국"
        },
        {
            id: 11,
            title: "부산 청년 월세 지원",
            description: "부산시 거주 청년의 주거비 부담 완화",
            eligibility: "만 19-34세 부산 거주 무주택 청년",
            amount: "월 최대 10만원 (12개월간)",
            url: "https://www.busan.go.kr/young",
            region: "부산"
        },
        {
            id: 12,
            title: "경기도 청년 전월세 보증금 대출",
            description: "경기도 거주 청년을 위한 전월세 보증금 대출",
            eligibility: "만 19-34세 경기도 거주 무주택 청년",
            amount: "최대 7천만원, 연 1.2%",
            url: "https://youth.gg.go.kr",
            region: "경기"
        },
        {
            id: 13,
            title: "인천 청년 월세 지원",
            description: "인천시 청년의 안정적인 주거 생활 지원",
            eligibility: "만 19-39세 인천 거주 무주택 청년",
            amount: "월 최대 15만원 (10개월간)",
            url: "https://www.incheon.go.kr",
            region: "인천"
        },
        {
            id: 21,
            title: "강원도 청년 월세 지원",
            description: "강원도 청년의 주거 안정을 위한 월세 지원 사업",
            eligibility: "만 19-34세 강원도 거주 무주택 청년",
            amount: "월 최대 15만원 (12개월간)",
            url: "https://www.provin.gangwon.kr",
            region: "강원"
        },
        {
            id: 22,
            title: "춘천시 청년 창업 지원",
            description: "춘천시 청년 창업가를 위한 창업 지원금",
            eligibility: "만 19-39세 춘천시 거주 예비창업자",
            amount: "최대 3천만원",
            url: "https://www.chuncheon.go.kr",
            region: "강원"
        },
        {
            id: 31,
            title: "대구광역시 청년 월세 지원",
            description: "대구시 청년의 주거비 부담 완화를 위한 월세 지원",
            eligibility: "만 19-34세 대구 거주 무주택 청년",
            amount: "월 최대 10만원 (12개월간)",
            url: "https://www.daegu.go.kr",
            region: "대구"
        },
        {
            id: 32,
            title: "광주광역시 청년 월세 지원",
            description: "광주시 청년의 안정적인 주거 생활 지원",
            eligibility: "만 19-39세 광주 거주 무주택 청년",
            amount: "월 최대 15만원 (12개월간)",
            url: "https://www.gwangju.go.kr",
            region: "광주"
        },
        {
            id: 33,
            title: "대전광역시 청년 월세 지원",
            description: "대전시 청년의 주거 안정을 위한 월세 지원",
            eligibility: "만 19-34세 대전 거주 무주택 청년",
            amount: "월 최대 12만원 (12개월간)",
            url: "https://www.daejeon.go.kr",
            region: "대전"
        },
        {
            id: 34,
            title: "울산광역시 청년 전월세 보증금 대출",
            description: "울산시 청년을 위한 전월세 보증금 대출 지원",
            eligibility: "만 19-34세 울산 거주 무주택 청년",
            amount: "최대 5천만원, 연 1.5%",
            url: "https://www.ulsan.go.kr",
            region: "울산"
        },
        {
            id: 35,
            title: "세종특별자치시 청년 월세 지원",
            description: "세종시 청년의 주거비 부담 완화",
            eligibility: "만 19-39세 세종 거주 무주택 청년",
            amount: "월 최대 20만원 (12개월간)",
            url: "https://www.sejong.go.kr",
            region: "세종"
        },
        {
            id: 36,
            title: "충청북도 청년 월세 지원",
            description: "충북 청년의 주거 안정을 위한 월세 지원",
            eligibility: "만 19-34세 충북 거주 무주택 청년",
            amount: "월 최대 10만원 (12개월간)",
            url: "https://www.chungbuk.go.kr",
            region: "충북"
        },
        {
            id: 37,
            title: "충청남도 청년 주거비 지원",
            description: "충남 청년의 안정적인 주거 생활 지원",
            eligibility: "만 19-39세 충남 거주 무주택 청년",
            amount: "월 최대 15만원 (10개월간)",
            url: "https://www.chungnam.go.kr",
            region: "충남"
        },
        {
            id: 38,
            title: "전라북도 청년 월세 지원",
            description: "전북 청년의 주거비 부담 완화 사업",
            eligibility: "만 19-34세 전북 거주 무주택 청년",
            amount: "월 최대 10만원 (12개월간)",
            url: "https://www.jeonbuk.go.kr",
            region: "전북"
        },
        {
            id: 39,
            title: "전라남도 청년 주거비 지원",
            description: "전남 청년의 안정적인 자립 기반 마련",
            eligibility: "만 19-39세 전남 거주 무주택 청년",
            amount: "월 최대 15만원 (12개월간)",
            url: "https://www.jeonnam.go.kr",
            region: "전남"
        },
        {
            id: 40,
            title: "경상북도 청년 월세 지원",
            description: "경북 청년의 주거 안정을 위한 지원",
            eligibility: "만 19-34세 경북 거주 무주택 청년",
            amount: "월 최대 10만원 (12개월간)",
            url: "https://www.gb.go.kr",
            region: "경북"
        },
        {
            id: 41,
            title: "경상남도 청년 월세 지원",
            description: "경남 청년의 주거비 부담 완화",
            eligibility: "만 19-39세 경남 거주 무주택 청년",
            amount: "월 최대 12만원 (12개월간)",
            url: "https://www.gyeongnam.go.kr",
            region: "경남"
        },
        {
            id: 42,
            title: "제주특별자치도 청년 월세 지원",
            description: "제주 청년의 안정적인 주거 생활 지원",
            eligibility: "만 19-34세 제주 거주 무주택 청년",
            amount: "월 최대 20만원 (12개월간)",
            url: "https://www.jeju.go.kr",
            region: "제주"
        }
    ],
    employment: [
        {
            id: 3,
            title: "청년 인턴십 프로그램",
            description: "중소기업 인턴 근무 기회 제공",
            eligibility: "만 15-34세 미취업 청년",
            amount: "월 180만원 이상",
            url: "https://www.work.go.kr",
            region: "전국"
        },
        {
            id: 4,
            title: "직업훈련 프로그램",
            description: "IT, 디자인, 마케팅 무료 교육",
            eligibility: "만 34세 이하 구직자",
            amount: "교육비 전액 + 훈련수당",
            url: "https://www.hrd.go.kr",
            region: "전국"
        },
        {
            id: 14,
            title: "부산 청년 구직활동 지원금",
            description: "부산시 미취업 청년의 구직활동 지원",
            eligibility: "만 18-34세 부산 거주 미취업 청년",
            amount: "월 50만원 (최대 6개월)",
            url: "https://www.busan.go.kr/young",
            region: "부산"
        },
        {
            id: 15,
            title: "경기도 청년 면접수당",
            description: "경기도 거주 청년의 면접 활동 비용 지원",
            eligibility: "만 18-34세 경기도 거주 구직활동 청년",
            amount: "1회 5만원 (최대 6회)",
            url: "https://jobaba.net",
            region: "경기"
        },
        {
            id: 16,
            title: "서울시 청년수당",
            description: "미취업 청년 구직활동 지원",
            eligibility: "만 19-34세, 중위소득 150% 이하",
            amount: "월 50만원 (최대 6개월)",
            url: "https://youth.seoul.go.kr",
            region: "서울"
        },
        {
            id: 23,
            title: "강원도 청년 구직활동 지원금",
            description: "강원도 미취업 청년의 구직활동 지원",
            eligibility: "만 18-34세 강원도 거주 미취업 청년",
            amount: "월 50만원 (최대 6개월)",
            url: "https://www.provin.gangwon.kr",
            region: "강원"
        },
        {
            id: 24,
            title: "춘천시 청년 일자리 지원",
            description: "춘천시 청년 취업 지원 프로그램",
            eligibility: "만 18-39세 춘천시 거주 청년",
            amount: "취업 성공 시 100만원 지원",
            url: "https://www.chuncheon.go.kr",
            region: "강원"
        },
        {
            id: 51,
            title: "대구 청년 구직활동 지원금",
            description: "대구시 미취업 청년의 구직활동 지원",
            eligibility: "만 18-34세 대구 거주 미취업 청년",
            amount: "월 50만원 (최대 6개월)",
            url: "https://www.daegu.go.kr",
            region: "대구"
        },
        {
            id: 52,
            title: "광주 청년 일경험 드림",
            description: "광주시 청년 직무경험 및 취업 연계 프로그램",
            eligibility: "만 18-39세 광주 거주 미취업 청년",
            amount: "월 180만원 (최대 5개월)",
            url: "https://www.gwangju.go.kr",
            region: "광주"
        },
        {
            id: 53,
            title: "대전 청년 취업희망카드",
            description: "대전시 청년 구직활동 종합 지원",
            eligibility: "만 18-34세 대전 거주 구직 청년",
            amount: "월 50만원 (최대 6개월)",
            url: "https://www.daejeon.go.kr",
            region: "대전"
        },
        {
            id: 54,
            title: "울산 청년 구직활동 지원금",
            description: "울산시 미취업 청년 취업 준비 지원",
            eligibility: "만 18-34세 울산 거주 미취업 청년",
            amount: "월 60만원 (최대 6개월)",
            url: "https://www.ulsan.go.kr",
            region: "울산"
        },
        {
            id: 55,
            title: "세종 청년 취업 지원금",
            description: "세종시 청년 구직활동 및 역량강화 지원",
            eligibility: "만 18-34세 세종 거주 구직 청년",
            amount: "월 50만원 (최대 6개월)",
            url: "https://www.sejong.go.kr",
            region: "세종"
        },
        {
            id: 56,
            title: "충북 청년 구직활동 지원금",
            description: "충북 미취업 청년의 취업 준비 지원",
            eligibility: "만 18-34세 충북 거주 미취업 청년",
            amount: "월 50만원 (최대 6개월)",
            url: "https://www.chungbuk.go.kr",
            region: "충북"
        },
        {
            id: 57,
            title: "충남 청년 희망디딤돌",
            description: "충남 청년 구직활동 종합 지원 사업",
            eligibility: "만 18-34세 충남 거주 구직 청년",
            amount: "월 50만원 (최대 6개월)",
            url: "https://www.chungnam.go.kr",
            region: "충남"
        },
        {
            id: 58,
            title: "전북 청년 구직활동 지원금",
            description: "전북 미취업 청년의 취업 활동 지원",
            eligibility: "만 18-34세 전북 거주 미취업 청년",
            amount: "월 50만원 (최대 6개월)",
            url: "https://www.jeonbuk.go.kr",
            region: "전북"
        },
        {
            id: 59,
            title: "전남 청년 구직수당",
            description: "전남 청년의 구직활동 및 생활안정 지원",
            eligibility: "만 18-34세 전남 거주 미취업 청년",
            amount: "월 50만원 (최대 6개월)",
            url: "https://www.jeonnam.go.kr",
            region: "전남"
        },
        {
            id: 60,
            title: "경북 청년 구직활동 지원",
            description: "경북 미취업 청년의 취업 준비 지원",
            eligibility: "만 18-34세 경북 거주 미취업 청년",
            amount: "월 50만원 (최대 6개월)",
            url: "https://www.gb.go.kr",
            region: "경북"
        },
        {
            id: 61,
            title: "경남 청년 구직활동 지원금",
            description: "경남 청년의 구직활동 및 역량강화 지원",
            eligibility: "만 18-34세 경남 거주 미취업 청년",
            amount: "월 50만원 (최대 6개월)",
            url: "https://www.gyeongnam.go.kr",
            region: "경남"
        },
        {
            id: 62,
            title: "제주 청년 수당",
            description: "제주 미취업 청년의 자립 기반 마련 지원",
            eligibility: "만 19-34세 제주 거주 미취업 청년",
            amount: "월 50만원 (최대 6개월)",
            url: "https://www.jeju.go.kr",
            region: "제주"
        }
    ],
    startup: [
        {
            id: 5,
            title: "청년 창업 지원금",
            description: "예비창업자 및 초기창업자 지원",
            eligibility: "만 39세 이하 창업 3년 이내",
            amount: "최대 1억원",
            url: "https://www.k-startup.go.kr",
            region: "전국"
        },
        {
            id: 17,
            title: "경기도 청년 창업지원금",
            description: "경기도 청년 창업가를 위한 초기 사업자금 지원",
            eligibility: "만 19-39세 경기도 거주 예비창업자",
            amount: "최대 2천만원",
            url: "https://www.gsp.or.kr",
            region: "경기"
        },
        {
            id: 18,
            title: "부산 청년 창업 펀드",
            description: "부산시 청년 스타트업을 위한 투자 지원",
            eligibility: "만 19-39세 부산 소재 창업 3년 이내 기업",
            amount: "최대 5천만원",
            url: "https://www.busan.go.kr/startup",
            region: "부산"
        },
        {
            id: 71,
            title: "대구 청년 창업지원금",
            description: "대구시 청년 창업가를 위한 사업자금 지원",
            eligibility: "만 19-39세 대구 거주 예비창업자",
            amount: "최대 3천만원",
            url: "https://www.daegu.go.kr",
            region: "대구"
        },
        {
            id: 72,
            title: "광주 청년 창업 펀드",
            description: "광주시 청년 스타트업 육성 지원",
            eligibility: "만 19-39세 광주 소재 창업 3년 이내",
            amount: "최대 5천만원",
            url: "https://www.gwangju.go.kr",
            region: "광주"
        },
        {
            id: 73,
            title: "대전 청년 창업 지원금",
            description: "대전시 청년 창업 활성화 지원 사업",
            eligibility: "만 19-39세 대전 거주 예비창업자",
            amount: "최대 2천만원",
            url: "https://www.daejeon.go.kr",
            region: "대전"
        },
        {
            id: 74,
            title: "울산 청년 CEO 육성사업",
            description: "울산시 청년 창업가 양성 프로그램",
            eligibility: "만 19-39세 울산 거주 예비창업자",
            amount: "최대 3천만원",
            url: "https://www.ulsan.go.kr",
            region: "울산"
        },
        {
            id: 75,
            title: "세종 청년 창업 지원",
            description: "세종시 청년 스타트업 지원 사업",
            eligibility: "만 19-39세 세종 거주 창업 3년 이내",
            amount: "최대 3천만원",
            url: "https://www.sejong.go.kr",
            region: "세종"
        },
        {
            id: 76,
            title: "충북 청년 창업농 지원",
            description: "충북 청년 농업 창업 지원 사업",
            eligibility: "만 18-39세 충북 거주 예비 농업인",
            amount: "최대 3천만원",
            url: "https://www.chungbuk.go.kr",
            region: "충북"
        },
        {
            id: 77,
            title: "충남 청년 창업 지원금",
            description: "충남 청년 창업 활성화 지원",
            eligibility: "만 19-39세 충남 거주 예비창업자",
            amount: "최대 2천만원",
            url: "https://www.chungnam.go.kr",
            region: "충남"
        },
        {
            id: 78,
            title: "전북 청년 창업 지원",
            description: "전북 청년 창업가 육성 사업",
            eligibility: "만 19-39세 전북 거주 창업 3년 이내",
            amount: "최대 3천만원",
            url: "https://www.jeonbuk.go.kr",
            region: "전북"
        },
        {
            id: 79,
            title: "전남 청년 창업농장",
            description: "전남 청년 농업 창업 지원 프로그램",
            eligibility: "만 18-39세 전남 거주 예비 농업인",
            amount: "최대 3억원 (융자)",
            url: "https://www.jeonnam.go.kr",
            region: "전남"
        },
        {
            id: 80,
            title: "경북 청년 CEO 육성",
            description: "경북 청년 창업가 양성 지원 사업",
            eligibility: "만 19-39세 경북 거주 예비창업자",
            amount: "최대 2천만원",
            url: "https://www.gb.go.kr",
            region: "경북"
        },
        {
            id: 81,
            title: "경남 청년 창업 지원금",
            description: "경남 청년 스타트업 육성 지원",
            eligibility: "만 19-39세 경남 거주 창업 3년 이내",
            amount: "최대 3천만원",
            url: "https://www.gyeongnam.go.kr",
            region: "경남"
        },
        {
            id: 82,
            title: "제주 청년 창업 지원",
            description: "제주 청년 창업 생태계 활성화 사업",
            eligibility: "만 19-39세 제주 거주 예비창업자",
            amount: "최대 5천만원",
            url: "https://www.jeju.go.kr",
            region: "제주"
        }
    ]
};

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Scrap page route
app.get('/scrap.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'scrap.html'));
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        policies_count: Object.values(policyDatabase).flat().length
    });
});

// Main chat endpoint with RAG System
app.post('/api/chat', async (req, res) => {
    try {
        const { message, context } = req.body;
        
        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        // Log the conversation
        chatHistory.push({
            timestamp: new Date().toISOString(),
            user: message,
            context: context
        });

        // Check if API key is configured
        if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your-api-key-here') {
            console.log('⚠️  OpenAI API key not configured. Using fallback response.');
            console.log('📝 To use RAG system, please set OPENAI_API_KEY in .env file');
            
            // Use existing processMessage as fallback
            const response = await processMessage(message);
            
            // Add warning to response
            response.warning = 'RAG system not active. Please configure API key.';
            
            res.json(response);
        } else {
            // Use RAG System for response
            console.log('🤖 Using RAG System for response generation');
            const response = await ragSystem.processQuery(message);
            
            // Log AI response
            chatHistory.push({
                timestamp: new Date().toISOString(),
                ai: response.message,
                method: 'RAG'
            });
            
            res.json({
                ...response,
                timestamp: new Date().toISOString(),
                method: 'RAG'
            });
        }
    } catch (error) {
        console.error('Chat API Error:', error);
        
        // Fallback to local response on error
        try {
            const fallbackResponse = await processMessage(req.body.message);
            res.json({
                ...fallbackResponse,
                warning: 'Using fallback response due to RAG error'
            });
        } catch (fallbackError) {
            res.status(500).json({ error: 'Internal server error' });
        }
    }
});

// Quick ask endpoint
app.post('/api/quick-ask', (req, res) => {
    const { question } = req.body;
    
    if (!question) {
        return res.status(400).json({ error: 'Question is required' });
    }

    const quickResponse = getQuickResponse(question);
    res.json(quickResponse);
});

// Get chat suggestions
app.get('/api/suggestions', (req, res) => {
    const suggestions = [
        "청년 월세 지원 자격 조건은?",
        "창업 지원금 신청 방법 알려줘",
        "취업 프로그램 추천해줘",
        "전세 대출 받을 수 있을까?",
        "청년수당 신청하고 싶어"
    ];
    res.json({ suggestions });
});

// Get policies by category
app.get('/api/policies/:category', (req, res) => {
    const { category } = req.params;
    const policies = policyDatabase[category] || [];
    res.json({ category, policies });
});

// Search policies
app.get('/api/search', (req, res) => {
    const { q } = req.query;
    
    if (!q) {
        return res.status(400).json({ error: 'Query parameter is required' });
    }

    const allPolicies = Object.values(policyDatabase).flat();
    const results = allPolicies.filter(policy => 
        policy.title.toLowerCase().includes(q.toLowerCase()) ||
        policy.description.toLowerCase().includes(q.toLowerCase())
    );

    res.json({ query: q, results });
});

// Get chat history
app.get('/api/history', (req, res) => {
    const { limit = 10 } = req.query;
    const recentHistory = chatHistory.slice(-limit);
    res.json({ history: recentHistory });
});

// Test page route
app.get('/test', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'test.html'));
});

// Helper functions
async function processMessage(message) {
    const lowerMessage = message.toLowerCase();
    
    // Analyze message intent
    const intent = analyzeIntent(lowerMessage);
    
    // Get relevant policies based on intent and region
    const region = intent.region || null;
    const relevantPolicies = findRelevantPolicies(lowerMessage, region);
    
    // Try to get enhanced information from external APIs
    let enhancedInfo = null;
    try {
        console.log(`🔍 Searching for enhanced information for: "${message}" (region: ${region || 'none'})`);
        enhancedInfo = await searchService.searchComprehensive(message, region);
        console.log('✅ Enhanced info retrieved:', enhancedInfo ? 'Success' : 'No data');
    } catch (error) {
        console.error('External API search failed:', error);
        console.log('Using local data as fallback');
    }
    
    // Generate response based on intent, policies, and enhanced info
    const response = generateEnhancedResponse(intent, relevantPolicies, message, enhancedInfo);
    
    return response;
}

function analyzeIntent(message) {
    // Check for region-specific queries - ALL regions in Korea
    const regions = ['서울', '부산', '경기', '인천', '대구', '광주', '대전', '울산', '세종', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'];
    
    // City to region mapping for major cities
    const cityToRegion = {
        // 서울
        '강남': '서울', '강동': '서울', '강북': '서울', '강서': '서울', '관악': '서울',
        '광진': '서울', '구로': '서울', '금천': '서울', '노원': '서울', '도봉': '서울',
        '동대문': '서울', '동작': '서울', '마포': '서울', '서대문': '서울', '서초': '서울',
        '성동': '서울', '성북': '서울', '송파': '서울', '양천': '서울', '영등포': '서울',
        '용산': '서울', '은평': '서울', '종로': '서울', '중구': '서울', '중랑': '서울',
        
        // 경기
        '수원': '경기', '성남': '경기', '고양': '경기', '용인': '경기', '부천': '경기',
        '안산': '경기', '안양': '경기', '남양주': '경기', '화성': '경기', '평택': '경기',
        '의정부': '경기', '시흥': '경기', '파주': '경기', '광명': '경기', '김포': '경기',
        '군포': '경기', '광주': '경기', '이천': '경기', '양주': '경기', '오산': '경기',
        '구리': '경기', '안성': '경기', '포천': '경기', '의왕': '경기', '하남': '경기',
        '여주': '경기', '양평': '경기', '동두천': '경기', '과천': '경기', '가평': '경기', '연천': '경기',
        
        // 강원
        '춘천': '강원', '원주': '강원', '강릉': '강원', '동해': '강원', '태백': '강원',
        '속초': '강원', '삼척': '강원', '홍천': '강원', '횡성': '강원', '영월': '강원',
        '평창': '강원', '정선': '강원', '철원': '강원', '화천': '강원', '양구': '강원',
        '인제': '강원', '고성': '강원', '양양': '강원',
        
        // 충북
        '청주': '충북', '충주': '충북', '제천': '충북', '보은': '충북', '옥천': '충북',
        '영동': '충북', '증평': '충북', '진천': '충북', '괴산': '충북', '음성': '충북', '단양': '충북',
        
        // 충남
        '천안': '충남', '공주': '충남', '보령': '충남', '아산': '충남', '서산': '충남',
        '논산': '충남', '계룡': '충남', '당진': '충남', '금산': '충남', '부여': '충남',
        '서천': '충남', '청양': '충남', '홍성': '충남', '예산': '충남', '태안': '충남',
        
        // 전북
        '전주': '전북', '군산': '전북', '익산': '전북', '정읍': '전북', '남원': '전북',
        '김제': '전북', '완주': '전북', '진안': '전북', '무주': '전북', '장수': '전북',
        '임실': '전북', '순창': '전북', '고창': '전북', '부안': '전북',
        
        // 전남
        '목포': '전남', '여수': '전남', '순천': '전남', '나주': '전남', '광양': '전남',
        '담양': '전남', '곡성': '전남', '구례': '전남', '고흥': '전남', '보성': '전남',
        '화순': '전남', '장흥': '전남', '강진': '전남', '해남': '전남', '영암': '전남',
        '무안': '전남', '함평': '전남', '영광': '전남', '장성': '전남', '완도': '전남',
        '진도': '전남', '신안': '전남',
        
        // 경북
        '포항': '경북', '경주': '경북', '김천': '경북', '안동': '경북', '구미': '경북',
        '영주': '경북', '영천': '경북', '상주': '경북', '문경': '경북', '경산': '경북',
        '군위': '경북', '의성': '경북', '청송': '경북', '영양': '경북', '영덕': '경북',
        '청도': '경북', '고령': '경북', '성주': '경북', '칠곡': '경북', '예천': '경북',
        '봉화': '경북', '울진': '경북', '울릉': '경북',
        
        // 경남
        '창원': '경남', '진주': '경남', '통영': '경남', '사천': '경남', '김해': '경남',
        '밀양': '경남', '거제': '경남', '양산': '경남', '의령': '경남', '함안': '경남',
        '창녕': '경남', '고성': '경남', '남해': '경남', '하동': '경남', '산청': '경남',
        '함양': '경남', '거창': '경남', '합천': '경남',
        
        // 제주
        '제주시': '제주', '서귀포': '제주', '서귀포시': '제주'
    };
    
    let region = null;
    
    // First check for major regions
    for (const r of regions) {
        if (message.includes(r)) {
            region = r;
            break;
        }
    }
    
    // If no major region found, check for cities and map to their regions
    if (!region) {
        for (const [city, cityRegion] of Object.entries(cityToRegion)) {
            if (message.includes(city)) {
                region = cityRegion;
                break;
            }
        }
    }
    
    let type = 'general';
    if (message.includes('월세') || message.includes('주거') || message.includes('집')) {
        type = 'housing';
    } else if (message.includes('전세') || message.includes('전세자금')) {
        type = 'jeonse';
    } else if (message.includes('청년수당') || message.includes('수당')) {
        type = 'allowance';
    } else if (message.includes('신청') && (message.includes('방법') || message.includes('어떻게'))) {
        type = 'application';
    } else if (message.includes('취업') || message.includes('일자리') || message.includes('인턴')) {
        type = 'employment';
    } else if (message.includes('창업') || message.includes('사업') || message.includes('스타트업')) {
        type = 'startup';
    } else if (message.includes('인기') || message.includes('추천') || message.includes('best')) {
        type = 'popular';
    } else if (message.includes('안녕') || message.includes('반가')) {
        type = 'greeting';
    } else if (message.includes('감사') || message.includes('고마')) {
        type = 'thanks';
    } else if (region && !message.includes('서울')) {
        // If region is mentioned but no specific policy type, show regional policies
        type = 'regional';
    }
    
    return { type, region };
}

function findRelevantPolicies(message, region = null) {
    const allPolicies = Object.values(policyDatabase).flat();
    const relevant = [];
    
    // Simple keyword matching (can be improved with NLP)
    const keywords = message.split(' ').filter(word => word.length > 2);
    
    allPolicies.forEach(policy => {
        // Filter by region if specified
        if (region && policy.region && policy.region !== '전국' && policy.region !== region) {
            return;
        }
        
        const policyText = `${policy.title} ${policy.description}`.toLowerCase();
        const matches = keywords.filter(keyword => 
            policyText.includes(keyword.toLowerCase())
        ).length;
        
        if (matches > 0 || region === policy.region) {
            relevant.push({ ...policy, relevance: matches });
        }
    });
    
    // Sort by relevance
    relevant.sort((a, b) => b.relevance - a.relevance);
    
    return relevant.slice(0, 5); // Return top 5 most relevant
}

function generateEnhancedResponse(intent, policies, originalMessage, enhancedInfo) {
    // If we have enhanced info from APIs, use it to enrich the response
    if (enhancedInfo) {
        return generateResponseWithEnhancedInfo(intent, policies, originalMessage, enhancedInfo);
    }
    // Otherwise, fall back to regular response
    return generateResponse(intent, policies, originalMessage);
}

function generateResponseWithEnhancedInfo(intent, policies, originalMessage, enhancedInfo) {
    let message = '';
    let references = [];
    let followUpQuestions = [];
    
    // Start with basic response
    const basicResponse = generateResponse(intent, policies, originalMessage);
    message = basicResponse.message;
    references = basicResponse.references || [];
    followUpQuestions = basicResponse.followUpQuestions || [];
    
    // Add real-time information from Tavily if available
    if (enhancedInfo.realTimeInfo?.answer) {
        message += '\n\n### 🔍 최신 정보\n';
        message += enhancedInfo.realTimeInfo.answer + '\n';
        
        // Add Tavily search results as references
        if (enhancedInfo.realTimeInfo.results) {
            enhancedInfo.realTimeInfo.results.forEach(result => {
                references.push({
                    title: result.title,
                    url: result.url,
                    snippet: result.content?.substring(0, 200) + '...'
                });
            });
        }
    }
    
    // Add AI analysis from Perplexity if available
    if (enhancedInfo.aiAnalysis?.answer) {
        message += '\n\n### 💡 AI 분석\n';
        message += enhancedInfo.aiAnalysis.answer + '\n';
    }
    
    // Add nearby youth centers if location info is available
    if (enhancedInfo.nearbyLocations && enhancedInfo.nearbyLocations.length > 0) {
        message += '\n\n### 📍 가까운 청년센터\n';
        enhancedInfo.nearbyLocations.slice(0, 3).forEach(location => {
            message += `• **${location.title}**\n`;
            message += `  주소: ${location.address}\n`;
            if (location.telephone) {
                message += `  📞 ${location.telephone}\n`;
            }
            message += '\n';
        });
    }
    
    return {
        message: message,
        references: references,
        followUpQuestions: followUpQuestions,
        hasEnhancedInfo: true
    };
}

function generateResponse(intent, policies, originalMessage) {
    let message = '';
    let references = [];
    let followUpQuestions = [];
    
    // Handle regional queries
    if (intent.type === 'regional' && intent.region) {
        const regionName = intent.region;
        const regionalPolicies = policies.filter(p => p.region === regionName || p.region === '전국');
        
        if (regionalPolicies.length > 0) {
            message = `### 🏛️ ${regionName} 청년 정책\n\n`;
            message += `${regionName} 지역 청년들을 위한 다양한 지원 정책을 안내해드립니다.\n\n`;
            
            regionalPolicies.forEach((policy) => {
                message += `📍 **${policy.title}**\n\n`;
                message += `${policy.description}\n\n`;
                if (policy.amount) message += `지원금액: ${policy.amount}\n\n`;
                if (policy.eligibility) message += `자격조건: ${policy.eligibility}\n\n`;
                message += '\n---\n\n';
                
                references.push({
                    title: policy.title,
                    url: policy.url || '#',
                    snippet: policy.description
                });
            });
            
            followUpQuestions = [
                `${regionName} 주거 지원 정책 자세히 알려주세요`,
                `${regionName} 취업 지원 프로그램은?`,
                `${regionName} 창업 지원금 신청 방법은?`
            ];
        } else {
            message = `죄송합니다. 현재 ${regionName} 지역의 청년 정책 정보가 준비되어 있지 않습니다.\n\n`;
            message += `대신 전국 단위로 시행되는 청년 정책을 안내해드릴 수 있습니다.`;
            
            followUpQuestions = [
                '전국 청년 주거 지원 정책 알려주세요',
                '청년 취업 지원 프로그램 추천해주세요',
                '청년 창업 지원금 정보가 궁금해요'
            ];
        }
        
        return { message, references, followUpQuestions };
    }
    
    switch (intent.type) {
        case 'greeting':
            message = '안녕하세요! 유씨 AI 챗봇입니다. 😊\n\n청년 정책에 대한 궁금한 점을 물어보세요. 주거, 취업, 창업, 교육 등 다양한 분야의 정책 정보를 제공해드립니다.';
            followUpQuestions = [
                '청년 월세 지원에 대해 알려주세요',
                '취업 프로그램을 추천해주세요',
                '창업 지원금 정보가 궁금해요'
            ];
            break;
            
        case 'thanks':
            message = '도움이 되셨다니 기쁩니다! 😊 더 궁금한 점이 있으시면 언제든지 물어보세요.';
            break;
            
        case 'housing':
            // Only show housing-related policies
            const housingPolicies = policyDatabase.housing || [];
            
            message = '### 🏠 청년 주거 지원 정책\n\n';
            message += '청년 주거 안정을 위한 다양한 지원 정책을 안내해드립니다.\n\n';
            
            housingPolicies.forEach((policy) => {
                message += `📍 **${policy.title}**\n`;
                message += `${policy.description}\n\n`;
                message += `• **지원금액**: ${policy.amount}\n`;
                message += `• **자격조건**: ${policy.eligibility}\n`;
                message += `• **신청방법**: 온라인 또는 방문 신청\n`;
                if (policy.url) {
                    message += `• **문의처**: ${policy.url}\n`;
                }
                message += '\n---\n\n';
                
                references.push({
                    title: policy.title,
                    url: policy.url,
                    snippet: policy.description + ' [' + policy.amount + ']'
                });
            });
            
            // Add related housing support info
            message += '💡 **추가 정보**\n';
            message += '• 서울시 청년주거포털: youth.seoul.go.kr/housing\n';
            message += '• 청년전세임대: 전화 1600-1004\n';
            message += '• LH 청년주택: 전화 1600-1004\n';
            
            followUpQuestions = [
                '월세 지원 신청 방법 자세히 알려주세요',
                '전세자금 대출 조건이 궁금해요',
                '청년 공공임대주택 신청하려면?'
            ];
            break;
            
        case 'employment':
            if (policies.length > 0) {
                message = '취업 지원 프로그램을 소개해드립니다:\n\n';
                policies.forEach((policy, index) => {
                    message += `${index + 1}. **${policy.title}**\n`;
                    message += `   • ${policy.description}\n`;
                    message += `   • 지원내용: ${policy.amount}\n`;
                    message += `   • 대상: ${policy.eligibility}\n\n`;
                    
                    references.push({
                        title: policy.title,
                        url: policy.url,
                        snippet: policy.description
                    });
                });
                followUpQuestions = [
                    '인턴십 신청 방법은?',
                    'IT 교육 프로그램 일정은?',
                    '취업 상담 예약하려면?'
                ];
            }
            break;
            
        case 'popular':
            message = '### 🔥 지금 가장 핫한 청년 정책\n\n';
            message += '2024년 청년들이 가장 많이 찾는 인기 정책을 소개합니다!\n\n';
            
            message += '**1. 🏠 서울시 청년 월세 지원** ⭐⭐⭐⭐⭐\n';
            message += '월 최대 20만원을 12개월간 지원하는 대표 주거 정책입니다.\n';
            message += '• **지원대상**: 만 19-39세 무주택 청년\n';
            message += '• **소득기준**: 중위소득 150% 이하\n';
            message += '• **임차조건**: 보증금 5천만원, 월세 60만원 이하\n';
            message += '• 📞 문의: 02-2133-6587\n\n';
            
            message += '2. **청년 전세자금 대출** ⭐⭐⭐⭐⭐\n';
            message += '   • 최대 2억원 저금리 대출\n';
            message += '   • 연 1.2~2.1% 초저금리\n';
            message += '   • 주거 안정의 필수 정책\n\n';
            
            message += '3. **청년 인턴십 프로그램** ⭐⭐⭐⭐\n';
            message += '   • 월 180만원 이상 급여\n';
            message += '   • 정규직 전환 기회\n';
            message += '   • 취업 성공률 80% 이상\n\n';
            
            message += '4. **🚀 청년 창업 지원금** ⭐⭐⭐⭐\n';
            message += '예비창업자와 초기창업자를 위한 든든한 지원!\n';
            message += '• **지원금액**: 최대 1억원\n';
            message += '• **지원내용**: 사업화 자금, 사무실, 멘토링\n';
            message += '• **대상**: 만 39세 이하, 창업 3년 이내\n';
            message += '• 📞 문의: 1357 (창업진흥원)\n\n';
            
            message += '5. **청년수당** ⭐⭐⭐\n';
            message += '   • 월 50만원 현금 지원\n';
            message += '   • 최대 6개월간 지급\n';
            message += '   • 구직활동 집중 지원\n\n';
            
            message += '💡 **Tip**: 각 정책은 지역별로 조건이 다를 수 있으니 자세한 내용을 확인해보세요!';
            
            references = [
                { title: '서울시 청년포털', url: 'https://youth.seoul.go.kr', snippet: '서울시 청년정책 종합 안내' },
                { title: '온통청년', url: 'https://www.youthcenter.go.kr', snippet: '전국 청년정책 통합 검색' }
            ];
            
            followUpQuestions = [
                '월세 지원 신청 방법 알려줘',
                '전세자금 대출 조건은?',
                '청년수당 받을 수 있을까?'
            ];
            break;
            
        case 'jeonse':
            message = '📍 **청년 전세자금 대출 상세 조건**\n\n';
            message += '**1. 기본 자격 요건**\n';
            message += '• 연령: 만 19세~34세 (단독세대주 포함)\n';
            message += '• 소득: 연 소득 5천만원 이하\n';
            message += '• 자산: 순자산 3.61억원 이하\n';
            message += '• 주택: 무주택자\n\n';
            
            message += '**2. 대출 조건**\n';
            message += '• 대출한도: 최대 2억원 (보증금의 80% 이내)\n';
            message += '• 금리: 연 1.2~2.1% (소득수준별 차등)\n';
            message += '• 대출기간: 2년 (4회 연장 가능, 최장 10년)\n\n';
            
            message += '**3. 대상 주택**\n';
            message += '• 임차보증금 3억원 이하\n';
            message += '• 전용면적 85㎡ 이하\n';
            message += '• 수도권: 보증금 3억원 이하\n';
            message += '• 지방: 보증금 2억원 이하\n\n';
            
            message += '**4. 신청 방법**\n';
            message += '• 온라인: 기금e든든 홈페이지\n';
            message += '• 오프라인: 우리은행, 국민은행, 신한은행, 농협, 하나은행\n\n';
            
            message += '💡 **Tip**: 중소기업 재직자는 더 낮은 금리 적용!';
            
            references = [
                { title: '주택도시기금', url: 'https://nhuf.molit.go.kr', snippet: '청년 전세자금대출 공식 안내' },
                { title: '기금e든든', url: 'https://enhuf.molit.go.kr', snippet: '온라인 신청 사이트' }
            ];
            
            followUpQuestions = [
                '필요 서류는 뭔가요?',
                '중소기업 재직자 혜택은?',
                '대출 승인까지 얼마나 걸려요?'
            ];
            break;
            
        case 'allowance':
            message = '💰 **청년수당 상세 정보**\n\n';
            message += '**서울시 청년수당**\n';
            message += '• 지원대상: 만 19~34세 미취업 청년\n';
            message += '• 지원금액: 월 50만원 × 최대 6개월\n';
            message += '• 소득조건: 중위소득 150% 이하\n';
            message += '• 활동조건: 주 20시간 이상 구직활동\n\n';
            
            message += '**신청 절차**\n';
            message += '1. 서울시 청년포털 회원가입\n';
            message += '2. 온라인 신청서 작성\n';
            message += '3. 자기활동계획서 제출\n';
            message += '4. 서류 심사 (2주)\n';
            message += '5. 면접 심사\n';
            message += '6. 최종 선발\n\n';
            
            message += '**의무사항**\n';
            message += '• 매월 활동보고서 제출\n';
            message += '• 청년활동 프로그램 참여\n';
            message += '• 취업 시 즉시 신고\n\n';
            
            message += '⚠️ **주의**: 타 정부지원금과 중복 수급 불가!';
            
            references = [
                { title: '서울시 청년수당', url: 'https://youth.seoul.go.kr/site/main/content/youth_allowance', snippet: '청년수당 공식 안내' }
            ];
            
            followUpQuestions = [
                '청년수당 신청 기간은?',
                '활동보고서 어떻게 쓰나요?',
                '다른 지원금과 중복 가능한가요?'
            ];
            break;
            
        case 'application':
            const originalLower = originalMessage.toLowerCase();
            if (originalLower.includes('월세')) {
                message = '📝 **청년 월세 지원 신청 방법**\n\n';
                message += '**Step 1: 자격 확인**\n';
                message += '• 만 19~39세\n';
                message += '• 무주택자\n';
                message += '• 중위소득 150% 이하\n';
                message += '• 임차보증금 5천만원 이하, 월세 60만원 이하\n\n';
                
                message += '**Step 2: 서류 준비**\n';
                message += '• 신분증\n';
                message += '• 임대차계약서\n';
                message += '• 소득증빙서류\n';
                message += '• 주민등록등본\n';
                message += '• 무주택 확인서\n\n';
                
                message += '**Step 3: 온라인 신청**\n';
                message += '1. 서울시 청년포털 접속 (youth.seoul.go.kr)\n';
                message += '2. 회원가입 및 로그인\n';
                message += '3. "청년 월세 지원" 메뉴 클릭\n';
                message += '4. 신청서 작성\n';
                message += '5. 서류 업로드\n';
                message += '6. 제출 완료\n\n';
                
                message += '**Step 4: 결과 확인**\n';
                message += '• 심사기간: 약 2~3주\n';
                message += '• 결과통보: 문자 및 이메일\n';
                message += '• 지급시작: 선정 다음달부터\n\n';
                
                message += '📅 **신청기간**: 매년 상/하반기 (공고 확인 필수!)';
                
                references = [
                    { title: '서울시 청년포털', url: 'https://youth.seoul.go.kr', snippet: '월세 지원 신청 페이지' }
                ];
                
                followUpQuestions = [
                    '소득증빙서류 뭐가 필요해?',
                    '신청 후 언제부터 받을 수 있어?',
                    '이사하면 어떻게 해?'
                ];
            } else {
                message = '신청 방법에 대해 더 구체적으로 알려주시면 자세히 안내해드리겠습니다.\n\n';
                message += '예시:\n';
                message += '• "월세 지원 신청 방법 알려줘"\n';
                message += '• "전세자금 대출 신청하려면?"\n';
                message += '• "청년수당 신청 절차는?"';
                
                followUpQuestions = [
                    '월세 지원 신청 방법',
                    '전세자금 대출 신청',
                    '청년수당 신청하기'
                ];
            }
            break;
            
        case 'startup':
            if (policies.length > 0) {
                message = '창업 지원 프로그램을 안내해드립니다:\n\n';
                policies.forEach((policy, index) => {
                    message += `${index + 1}. **${policy.title}**\n`;
                    message += `   • ${policy.description}\n`;
                    message += `   • 지원금액: ${policy.amount}\n`;
                    message += `   • 자격요건: ${policy.eligibility}\n\n`;
                    
                    references.push({
                        title: policy.title,
                        url: policy.url,
                        snippet: policy.description
                    });
                });
                followUpQuestions = [
                    '창업 지원금 신청 조건은?',
                    '창업 교육 일정은?',
                    '사무실 입주 신청 방법은?'
                ];
            }
            break;
            
        default:
            if (policies.length > 0) {
                message = '관련 정책을 찾아드렸습니다:\n\n';
                policies.forEach((policy, index) => {
                    message += `${index + 1}. **${policy.title}**\n`;
                    message += `   • ${policy.description}\n`;
                    message += `   • 지원내용: ${policy.amount}\n\n`;
                    
                    references.push({
                        title: policy.title,
                        url: policy.url,
                        snippet: policy.description
                    });
                });
            } else {
                message = '죄송합니다. "' + originalMessage + '"에 대한 정확한 정보를 찾지 못했습니다.\n\n다음과 같은 주제로 질문해보세요:\n• 주거 지원 (월세, 전세)\n• 취업 지원 (인턴십, 교육)\n• 창업 지원 (자금, 공간)\n• 교육 지원 (학자금, 자격증)';
                followUpQuestions = [
                    '청년 정책 전체 보기',
                    '나에게 맞는 정책 찾기',
                    '인기 있는 정책 추천'
                ];
            }
    }
    
    // Check if response contains policy information (for poster display)
    const hasPoster = ['housing', 'employment', 'startup', 'popular', 'jeonse', 'allowance', 'application'].includes(intent) && 
                      (policies.length > 0 || intent === 'popular');
    
    return {
        message,
        references,
        followUpQuestions,
        intent,
        hasPoster,
        timestamp: new Date().toISOString()
    };
}

function getQuickResponse(question) {
    const lowerQuestion = question.toLowerCase();
    
    // Simple pattern matching for quick responses
    if (lowerQuestion.includes('자격') || lowerQuestion.includes('조건')) {
        return {
            answer: '대부분의 청년 정책은 만 19-39세 청년을 대상으로 합니다. 정책별로 소득, 거주지, 학력 등 추가 조건이 있을 수 있습니다.',
            sources: ['청년정책 통합 플랫폼']
        };
    } else if (lowerQuestion.includes('신청') || lowerQuestion.includes('방법')) {
        return {
            answer: '정책 신청은 주로 온라인으로 진행됩니다. 각 정책 홈페이지에서 회원가입 후 신청서를 작성하고 필요 서류를 제출하면 됩니다.',
            sources: ['정책 신청 가이드']
        };
    } else {
        return {
            answer: '자세한 답변을 위해 채팅 기능을 이용해주세요.',
            sources: []
        };
    }
}

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 YOUTHY AI Server is running on http://localhost:${PORT}`);
    console.log(`📱 Test page available at http://localhost:${PORT}/test`);
    console.log(`🔍 API Health: http://localhost:${PORT}/api/health`);
});