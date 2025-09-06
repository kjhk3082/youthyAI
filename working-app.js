const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const compression = require('compression');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Delayed RAG System initialization
let ragSystem = null;
let searchService = null;

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
        timestamp: new Date().toISOString()
    });
});

app.post('/api/chat', async (req, res) => {
    try {
        const { message } = req.body;
        console.log(`📨 Received message: ${message}`);
        
        // Find relevant policies
        const relevantPolicies = findRelevantPolicies(message);
        
        // Generate response
        const response = {
            message: generateChatResponse(message, relevantPolicies),
            policies: relevantPolicies.slice(0, 5),
            timestamp: new Date().toISOString()
        };
        
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

// Helper functions
function findRelevantPolicies(message) {
    const keywords = extractKeywords(message);
    
    return youthPolicies.filter(policy => {
        const policyText = `${policy.title} ${policy.description} ${policy.category}`.toLowerCase();
        return keywords.some(keyword => policyText.includes(keyword.toLowerCase()));
    }).map(policy => ({
        ...policy,
        relevanceScore: Math.random()
    })).sort((a, b) => b.relevanceScore - a.relevanceScore);
}

function extractKeywords(message) {
    const commonWords = ['하는', '있는', '되는', '하고', '있고', '합니다', '입니다', '입니까', '있나요', '알려주세요', '추천', '어떤', '무엇', '뭐가'];
    const words = message.split(/\s+/).filter(word => 
        word.length > 1 && !commonWords.includes(word)
    );
    
    // Add category keywords
    const categories = ['주거', '취업', '창업', '교육', '복지', '문화'];
    categories.forEach(cat => {
        if (message.includes(cat)) words.push(cat);
    });
    
    return words;
}

function generateChatResponse(message, policies) {
    if (policies.length === 0) {
        return `"${message}"에 대한 정확한 정책 정보를 찾지 못했습니다. 

다음과 같은 주제로 질문해보세요:
• 청년 주거 지원 (월세, 전세 대출)
• 취업 지원 프로그램
• 창업 지원금
• 교육 및 자격증 지원
• 문화 활동 지원`;
    }
    
    let response = `"${message}"에 대한 청년 정책 정보입니다:\n\n`;
    
    policies.slice(0, 3).forEach((policy, index) => {
        response += `${index + 1}. **${policy.title}**\n`;
        response += `   📍 지역: ${policy.region}\n`;
        response += `   📝 내용: ${policy.description}\n`;
        response += `   💰 지원: ${policy.amount || '정보 없음'}\n`;
        response += `   ✅ 자격: ${policy.eligibility || '만 19-39세 청년'}\n\n`;
    });
    
    if (policies.length > 3) {
        response += `\n📌 ${policies.length - 3}개의 추가 정책이 더 있습니다.`;
    }
    
    return response;
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

// Start server - ALWAYS start the server
console.log('Starting server...');
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 YOUTHY AI Server is running on http://localhost:${PORT}`);
    console.log(`📱 Test page available at http://localhost:${PORT}/test`);
    console.log(`🔍 API Health: http://localhost:${PORT}/api/health`);
    
    // Lazy load heavy modules after server starts
    setTimeout(() => {
        try {
            console.log('Loading additional modules...');
            const RAGSystem = require('./src/ragSystem');
            const SearchService = require('./services/searchService');
            ragSystem = new RAGSystem();
            searchService = new SearchService();
            console.log('✅ All modules loaded successfully');
        } catch (error) {
            console.log('⚠️ Some modules failed to load, but server is running');
        }
    }, 1000);
});

module.exports = app;