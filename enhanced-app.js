const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const compression = require('compression');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

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

// Static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/css', express.static(path.join(__dirname, 'public/css')));
app.use('/js', express.static(path.join(__dirname, 'public/js')));
app.use('/images', express.static(path.join(__dirname, 'public/images')));

// Load youth policies data
const youthPolicies = JSON.parse(fs.readFileSync(path.join(__dirname, 'database', 'youth_policies.json'), 'utf8'));

// Add more regional policies
const additionalPolicies = [
  {
    "id": "21",
    "title": "강원도 청년 구직활동 지원금",
    "category": "취업",
    "region": "강원도",
    "description": "강원도 거주 미취업 청년 대상 구직활동 지원",
    "amount": "월 50만원 × 6개월",
    "eligibility": "만 18~34세 강원도 6개월 이상 거주자",
    "applicationPeriod": "연 2회",
    "applicationMethod": "강원도 일자리정보망",
    "url": "https://job.gwd.go.kr",
    "documents": "주민등록등본, 구직활동계획서",
    "contact": "강원도 일자리센터 033-249-2722"
  },
  {
    "id": "22",
    "title": "춘천시 청년 창업지원금",
    "category": "창업",
    "region": "춘천",
    "description": "춘천시 청년 창업자 대상 초기 창업자금 지원",
    "amount": "최대 2,000만원",
    "eligibility": "만 19~39세 춘천시 거주 예비창업자",
    "applicationPeriod": "연 1회",
    "applicationMethod": "춘천시청 홈페이지",
    "url": "https://www.chuncheon.go.kr",
    "documents": "사업계획서, 주민등록등본",
    "contact": "춘천시청 033-250-3000"
  },
  {
    "id": "23",
    "title": "춘천 청년 월세 지원",
    "category": "주거",
    "region": "춘천",
    "description": "춘천시 거주 청년 1인가구 월세 지원",
    "amount": "월 10만원 (12개월)",
    "eligibility": "만 19~34세 춘천시 거주 무주택 청년",
    "applicationPeriod": "매년 3월",
    "applicationMethod": "춘천시청 방문 신청",
    "url": "https://www.chuncheon.go.kr",
    "documents": "임대차계약서, 월세납입증명",
    "contact": "춘천시청 주거복지과"
  }
];

const allPolicies = [...youthPolicies, ...additionalPolicies];

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        message: 'YOUTHY AI Server is healthy',
        timestamp: new Date().toISOString(),
        totalPolicies: allPolicies.length
    });
});

app.post('/api/chat', async (req, res) => {
    try {
        const { message, region } = req.body;
        console.log(`📨 Received message: ${message}, Region: ${region || 'none'}`);
        
        // Check for self-introduction request
        if (isSelfIntroductionRequest(message)) {
            res.json(getSelfIntroduction());
            return;
        }
        
        // Analyze intent
        const intent = analyzeIntent(message);
        
        // Find relevant policies with improved filtering
        const relevantPolicies = findRelevantPolicies(message, region);
        
        // Generate comprehensive response
        const response = generateDetailedResponse(intent, relevantPolicies, message, region);
        
        res.json(response);
    } catch (error) {
        console.error('Chat error:', error);
        res.status(500).json({ 
            error: 'Failed to process message',
            message: '죄송합니다. 일시적인 오류가 발생했습니다. 다시 시도해주세요.' 
        });
    }
});

app.get('/api/policies/:category', (req, res) => {
    const { category } = req.params;
    const policies = allPolicies.filter(p => p.category === category);
    res.json(policies);
});

app.get('/api/popular-policies', (req, res) => {
    const popularPolicies = getPopularPolicies();
    res.json(popularPolicies);
});

// Helper functions
function isSelfIntroductionRequest(message) {
    const selfKeywords = ['너 뭐야', '너 누구', '누구야', '뭐하는', '자기소개'];
    const lowerMessage = message.toLowerCase();
    // Avoid false positives with "소개" when asking for policy introductions
    if (lowerMessage.includes('정책') || lowerMessage.includes('맞는') || lowerMessage.includes('20대') || lowerMessage.includes('30대')) {
        return false;
    }
    return selfKeywords.some(keyword => lowerMessage.includes(keyword));
}

function getSelfIntroduction() {
    return {
        message: `안녕하세요! 저는 **YOUTHY AI 챗봇**입니다 🤖\n\n` +
                `저는 대한민국 청년들을 위한 정책 안내 도우미예요!\n\n` +
                `**제가 도와드릴 수 있는 것들:**\n` +
                `📌 전국 & 지역별 청년 정책 안내\n` +
                `💰 청년 지원금, 수당, 대출 정보\n` +
                `🏠 주거 지원 (월세, 전세, 청년주택)\n` +
                `💼 취업 지원 (국민취업지원제도 등)\n` +
                `🚀 창업 지원 (창업자금, 사관학교)\n` +
                `📚 교육 지원 (국민내일배움카드 등)\n` +
                `💎 자산형성 (청년희망적금, 내일채움공제)\n\n` +
                `**현재 제공 중인 정책 정보:** ${allPolicies.length}개\n\n` +
                `궁금한 정책이 있으시면 편하게 물어보세요! 😊`,
        references: [],
        followUpQuestions: [
            '인기 있는 정책 보여줘',
            '내 지역 정책 알려줘',
            '20대가 받을 수 있는 혜택은?'
        ],
        intent: 'self-introduction',
        timestamp: new Date().toISOString()
    };
}

function analyzeIntent(message) {
    const lowerMessage = message.toLowerCase();
    
    // Age-specific intents
    if (lowerMessage.includes('20대') || lowerMessage.includes('25살') || lowerMessage.includes('27살') || 
        lowerMessage.includes('대학생') || lowerMessage.includes('스물')) {
        return 'age-20s';
    } else if (lowerMessage.includes('30대') || lowerMessage.includes('35살') || lowerMessage.includes('서른')) {
        return 'age-30s';
    }
    
    // Category intents
    if (lowerMessage.includes('인기') || lowerMessage.includes('추천') || lowerMessage.includes('best') || lowerMessage.includes('핫한')) {
        return 'popular';
    } else if (lowerMessage.includes('월세') || lowerMessage.includes('전세') || lowerMessage.includes('주거') || lowerMessage.includes('집')) {
        return 'housing';
    } else if (lowerMessage.includes('취업') || lowerMessage.includes('일자리') || lowerMessage.includes('구직')) {
        return 'employment';
    } else if (lowerMessage.includes('창업') || lowerMessage.includes('사업')) {
        return 'startup';
    } else if (lowerMessage.includes('교육') || lowerMessage.includes('배움') || lowerMessage.includes('공부') || lowerMessage.includes('학원')) {
        return 'education';
    } else if (lowerMessage.includes('적금') || lowerMessage.includes('저축') || lowerMessage.includes('자산')) {
        return 'savings';
    }
    
    return 'general';
}

function findRelevantPolicies(message, region = null) {
    const keywords = extractKeywords(message);
    const intent = analyzeIntent(message);
    const lowerMessage = message.toLowerCase();
    
    let filtered = [...allPolicies];
    
    // Extract region from message if not provided
    let targetRegion = region;
    if (!targetRegion) {
        if (lowerMessage.includes('서울')) targetRegion = '서울';
        else if (lowerMessage.includes('부산')) targetRegion = '부산';
        else if (lowerMessage.includes('경기')) targetRegion = '경기도';
        else if (lowerMessage.includes('강원')) targetRegion = '강원도';
        else if (lowerMessage.includes('춘천')) targetRegion = '춘천';
    }
    
    // Filter by region if specified
    if (targetRegion && targetRegion !== '전국') {
        filtered = filtered.filter(p => 
            p.region === targetRegion || 
            p.region === '전국' ||
            (targetRegion === '춘천' && p.region === '강원도') // Include 강원도 policies for 춘천
        );
    }
    
    // Handle age-specific intents
    if (intent === 'age-20s') {
        // Prioritize policies suitable for 20s
        filtered = filtered.filter(p => {
            const eligible = p.eligibility.toLowerCase();
            return eligible.includes('19') || eligible.includes('20') || 
                   eligible.includes('대학') || eligible.includes('34') ||
                   eligible.includes('39') || !eligible.includes('30');
        });
    } else if (intent === 'age-30s') {
        // Prioritize policies suitable for 30s
        filtered = filtered.filter(p => {
            const eligible = p.eligibility.toLowerCase();
            return eligible.includes('30') || eligible.includes('34') || 
                   eligible.includes('39') || eligible.includes('69');
        });
    }
    
    // Filter by intent category
    if (intent === 'popular') {
        return getPopularPolicies(targetRegion);
    } else if (intent === 'housing') {
        filtered = filtered.filter(p => p.category === '주거');
    } else if (intent === 'employment') {
        filtered = filtered.filter(p => p.category === '취업');
    } else if (intent === 'startup') {
        filtered = filtered.filter(p => p.category === '창업');
    } else if (intent === 'education') {
        filtered = filtered.filter(p => p.category === '교육');
    } else if (intent === 'savings') {
        filtered = filtered.filter(p => p.category === '자산형성');
    }
    
    // Score and sort by relevance
    const scored = filtered.map(policy => {
        let score = 0;
        const policyText = `${policy.title} ${policy.description} ${policy.category}`.toLowerCase();
        
        keywords.forEach(keyword => {
            if (policyText.includes(keyword.toLowerCase())) {
                score += 2;
            }
        });
        
        // Boost score for exact category match
        if (intent !== 'general' && policy.category === getCategoryFromIntent(intent)) {
            score += 5;
        }
        
        // Boost score for regional match
        if (targetRegion && policy.region === targetRegion) {
            score += 3;
        }
        
        return { ...policy, score };
    });
    
    return scored
        .filter(p => p.score > 0 || intent === 'general' || intent.startsWith('age-'))
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);
}

function getPopularPolicies(region = null) {
    let policies = allPolicies;
    
    if (region && region !== '전국') {
        policies = policies.filter(p => p.region === region || p.region === '전국');
    }
    
    const popularIds = ['1', '3', '8', '14', '7', '5', '11', '2', '15', '13'];
    return popularIds
        .map(id => policies.find(p => p.id === id))
        .filter(Boolean)
        .map((p, index) => ({ ...p, score: 10 - index }))
        .slice(0, 5);
}

function getCategoryFromIntent(intent) {
    const mapping = {
        'housing': '주거',
        'employment': '취업',
        'startup': '창업',
        'education': '교육',
        'savings': '자산형성'
    };
    return mapping[intent] || null;
}

function extractKeywords(message) {
    const stopWords = ['하는', '있는', '되는', '하고', '있고', '합니다', '입니다', '입니까', '있나요', '알려주세요', '추천', '어떤', '무엇', '뭐가', '해줘', '해주세요', '좀', '소개'];
    const words = message.split(/\s+/).filter(word => 
        word.length > 1 && !stopWords.includes(word)
    );
    return words;
}

function generateDetailedResponse(intent, policies, originalMessage, region) {
    let message = '';
    const references = [];
    const followUpQuestions = [];
    
    // Handle age-specific responses
    if (intent === 'age-20s' && policies.length > 0) {
        message = `🎯 **20대 청년을 위한 맞춤 정책**을 찾아드렸습니다!\n\n`;
        message += `20대에 꼭 필요한 정책들을 모아봤어요 💪\n\n`;
    } else if (intent === 'age-30s' && policies.length > 0) {
        message = `🎯 **30대 청년을 위한 맞춤 정책**을 찾아드렸습니다!\n\n`;
        message += `30대 청년들에게 유용한 정책들입니다 💪\n\n`;
    } else if (intent === 'popular' && policies.length > 0) {
        message = `🏆 **지금 가장 인기 있는 청년 정책 TOP ${Math.min(5, policies.length)}**\n\n`;
        message += `청년들이 가장 많이 찾고 있는 정책들을 소개해드립니다!\n\n`;
    } else if (policies.length > 0) {
        message = getIntroMessage(intent, originalMessage, region) + '\n\n';
    }
    
    if (policies.length > 0) {
        policies.slice(0, 5).forEach((policy, index) => {
            message += `**${index + 1}. ${policy.title}** ${getEmojiForCategory(policy.category)}\n`;
            message += `📍 지역: ${policy.region}\n`;
            message += `📝 ${policy.description}\n`;
            message += `💰 지원금액: ${policy.amount}\n`;
            message += `✅ 자격조건: ${policy.eligibility}\n`;
            message += `📅 신청기간: ${policy.applicationPeriod}\n`;
            message += `🔗 신청방법: ${policy.applicationMethod}\n`;
            if (policy.documents) {
                message += `📋 필요서류: ${policy.documents}\n`;
            }
            if (policy.contact) {
                message += `📞 문의: ${policy.contact}\n`;
            }
            message += '\n';
            
            references.push({
                title: policy.title,
                url: policy.url || '#',
                snippet: `${policy.description} - ${policy.amount}`
            });
        });
        
        if (policies.length > 5) {
            message += `\n📌 **추가로 ${policies.length - 5}개의 정책이 더 있습니다!**\n`;
            message += '더 자세한 정보가 필요하시면 말씀해주세요.';
        }
        
        followUpQuestions.push(
            '신청 조건 자세히 알려주세요',
            '다른 지역 정책도 보여주세요',
            '비슷한 정책 더 있나요?'
        );
        
    } else {
        message = `😅 "${originalMessage}"에 대한 정확한 정책을 찾지 못했어요.\n\n`;
        message += `**다음과 같은 정책들을 찾아보실 수 있습니다:**\n\n`;
        message += `🏠 **주거 지원**: 월세 지원, 전세 대출, 청년 주택\n`;
        message += `💼 **취업 지원**: 국민취업지원제도, 청년도전지원사업\n`;
        message += `🚀 **창업 지원**: 창업자금, 창업사관학교\n`;
        message += `📚 **교육 지원**: 국민내일배움카드, K-디지털 트레이닝\n`;
        message += `💰 **자산 형성**: 청년희망적금, 청년내일채움공제\n\n`;
        message += `어떤 분야의 정책이 궁금하신가요?`;
        
        followUpQuestions.push(
            '인기 있는 정책 보여주세요',
            '주거 지원 정책 알려주세요',
            '취업 지원 정책 알려주세요'
        );
    }
    
    return {
        message,
        references,
        followUpQuestions,
        intent,
        policies: policies.slice(0, 5),
        totalFound: policies.length,
        region: region,
        timestamp: new Date().toISOString()
    };
}

function getIntroMessage(intent, originalMessage, region) {
    const regionText = region ? `${region} ` : '';
    
    switch(intent) {
        case 'housing':
            return `🏠 **${regionText}청년 주거 지원 정책**을 찾아드렸습니다!`;
        case 'employment':
            return `💼 **${regionText}청년 취업 지원 정책**을 찾아드렸습니다!`;
        case 'startup':
            return `🚀 **${regionText}청년 창업 지원 정책**을 찾아드렸습니다!`;
        case 'education':
            return `📚 **${regionText}청년 교육 지원 정책**을 찾아드렸습니다!`;
        case 'savings':
            return `💰 **${regionText}청년 자산형성 지원 정책**을 찾아드렸습니다!`;
        default:
            return `📋 **"${originalMessage}"** 관련 ${regionText}청년 정책 정보입니다`;
    }
}

function getEmojiForCategory(category) {
    const emojis = {
        '주거': '🏠',
        '취업': '💼',
        '창업': '🚀',
        '교육': '📚',
        '자산형성': '💰',
        '복지': '🎁',
        '문화': '🎨'
    };
    return emojis[category] || '📌';
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
console.log('🔧 Starting Enhanced YOUTHY AI Server...');
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Enhanced YOUTHY AI Server is running on http://localhost:${PORT}`);
    console.log(`📱 Test page available at http://localhost:${PORT}/test`);
    console.log(`🔍 API Health: http://localhost:${PORT}/api/health`);
    console.log(`📊 Total policies loaded: ${allPolicies.length}`);
    console.log(`🎯 Features: Self-introduction, Age-specific filtering, Regional search`);
});

module.exports = app;