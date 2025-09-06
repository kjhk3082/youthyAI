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

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        message: 'YOUTHY AI Server is healthy',
        timestamp: new Date().toISOString(),
        totalPolicies: youthPolicies.length
    });
});

app.post('/api/chat', async (req, res) => {
    try {
        const { message, region } = req.body;
        console.log(`📨 Received message: ${message}`);
        
        // Analyze intent
        const intent = analyzeIntent(message);
        
        // Find relevant policies
        const relevantPolicies = findRelevantPolicies(message, region);
        
        // Generate comprehensive response
        const response = generateDetailedResponse(intent, relevantPolicies, message);
        
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
    const policies = youthPolicies.filter(p => p.category === category);
    res.json(policies);
});

app.get('/api/popular-policies', (req, res) => {
    // Return most popular policies
    const popularPolicies = [
        youthPolicies.find(p => p.title.includes('월세')),
        youthPolicies.find(p => p.title.includes('국민취업')),
        youthPolicies.find(p => p.title.includes('청년희망적금')),
        youthPolicies.find(p => p.title.includes('청년내일채움공제')),
        youthPolicies.find(p => p.title.includes('국민내일배움카드'))
    ].filter(Boolean);
    
    res.json(popularPolicies);
});

// Helper functions
function analyzeIntent(message) {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('인기') || lowerMessage.includes('추천') || lowerMessage.includes('best')) {
        return 'popular';
    } else if (lowerMessage.includes('월세') || lowerMessage.includes('전세') || lowerMessage.includes('주거') || lowerMessage.includes('집')) {
        return 'housing';
    } else if (lowerMessage.includes('취업') || lowerMessage.includes('일자리') || lowerMessage.includes('구직')) {
        return 'employment';
    } else if (lowerMessage.includes('창업') || lowerMessage.includes('사업')) {
        return 'startup';
    } else if (lowerMessage.includes('교육') || lowerMessage.includes('배움') || lowerMessage.includes('공부')) {
        return 'education';
    } else if (lowerMessage.includes('적금') || lowerMessage.includes('저축') || lowerMessage.includes('자산')) {
        return 'savings';
    } else if (lowerMessage.includes('20대') || lowerMessage.includes('25살') || lowerMessage.includes('30대')) {
        return 'age-specific';
    }
    return 'general';
}

function findRelevantPolicies(message, region = null) {
    const keywords = extractKeywords(message);
    const intent = analyzeIntent(message);
    
    let filtered = youthPolicies;
    
    // Filter by region if specified
    if (region && region !== '전국') {
        filtered = filtered.filter(p => p.region === region || p.region === '전국');
    }
    
    // Filter by intent category
    if (intent === 'popular') {
        return getPopularPolicies();
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
        
        return { ...policy, score };
    });
    
    return scored
        .filter(p => p.score > 0 || intent === 'general')
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);
}

function getPopularPolicies() {
    // Return pre-defined popular policies
    const popularIds = ['1', '3', '8', '14', '7', '5', '11', '2', '15', '13'];
    return popularIds
        .map(id => youthPolicies.find(p => p.id === id))
        .filter(Boolean)
        .map((p, index) => ({ ...p, score: 10 - index }));
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
    const stopWords = ['하는', '있는', '되는', '하고', '있고', '합니다', '입니다', '입니까', '있나요', '알려주세요', '추천', '어떤', '무엇', '뭐가', '해줘', '해주세요'];
    const words = message.split(/\s+/).filter(word => 
        word.length > 1 && !stopWords.includes(word)
    );
    return words;
}

function generateDetailedResponse(intent, policies, originalMessage) {
    let message = '';
    const references = [];
    const followUpQuestions = [];
    
    if (intent === 'popular' && policies.length > 0) {
        message = `🏆 **지금 가장 인기 있는 청년 정책 TOP ${Math.min(5, policies.length)}**\n\n`;
        message += `청년들이 가장 많이 찾고 있는 정책들을 소개해드립니다!\n\n`;
        
        policies.slice(0, 5).forEach((policy, index) => {
            message += `**${index + 1}. ${policy.title}** ${getEmojiForCategory(policy.category)}\n`;
            message += `📍 지역: ${policy.region}\n`;
            message += `📝 ${policy.description}\n`;
            message += `💰 지원금액: ${policy.amount}\n`;
            message += `✅ 자격조건: ${policy.eligibility}\n`;
            message += `📅 신청기간: ${policy.applicationPeriod}\n`;
            message += `🔗 신청방법: ${policy.applicationMethod}\n`;
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
        
        followUpQuestions.push(
            '신청 방법 자세히 알려주세요',
            '필요 서류는 뭐가 있나요?',
            '내가 해당되는 정책만 보여주세요'
        );
        
    } else if (policies.length > 0) {
        const messageIntro = getIntroMessage(intent, originalMessage);
        message = `${messageIntro}\n\n`;
        
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
        timestamp: new Date().toISOString()
    };
}

function getIntroMessage(intent, originalMessage) {
    switch(intent) {
        case 'housing':
            return '🏠 **청년 주거 지원 정책**을 찾아드렸습니다!';
        case 'employment':
            return '💼 **청년 취업 지원 정책**을 찾아드렸습니다!';
        case 'startup':
            return '🚀 **청년 창업 지원 정책**을 찾아드렸습니다!';
        case 'education':
            return '📚 **청년 교육 지원 정책**을 찾아드렸습니다!';
        case 'savings':
            return '💰 **청년 자산형성 지원 정책**을 찾아드렸습니다!';
        case 'age-specific':
            return `🎯 **"${originalMessage}"에 맞는 청년 정책**을 찾아드렸습니다!`;
        default:
            return `📋 **"${originalMessage}"** 관련 청년 정책 정보입니다`;
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

// Start server - CRITICAL: Always start regardless of environment
console.log('🔧 Starting YOUTHY AI Server...');
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 YOUTHY AI Server is running on http://localhost:${PORT}`);
    console.log(`📱 Test page available at http://localhost:${PORT}/test`);
    console.log(`🔍 API Health: http://localhost:${PORT}/api/health`);
    console.log(`📊 Total policies loaded: ${youthPolicies.length}`);
});

module.exports = app;