const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const compression = require('compression');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');

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
            url: "https://youth.seoul.go.kr"
        },
        {
            id: 2,
            title: "전세자금 대출 지원",
            description: "청년 전세자금 저리 대출",
            eligibility: "만 34세 이하 무주택자",
            amount: "최대 2억원",
            url: "https://nhuf.molit.go.kr"
        }
    ],
    employment: [
        {
            id: 3,
            title: "청년 인턴십 프로그램",
            description: "중소기업 인턴 근무 기회 제공",
            eligibility: "만 15-34세 미취업 청년",
            amount: "월 180만원 이상",
            url: "https://www.work.go.kr"
        },
        {
            id: 4,
            title: "직업훈련 프로그램",
            description: "IT, 디자인, 마케팅 무료 교육",
            eligibility: "만 34세 이하 구직자",
            amount: "교육비 전액 + 훈련수당",
            url: "https://www.hrd.go.kr"
        }
    ],
    startup: [
        {
            id: 5,
            title: "청년 창업 지원금",
            description: "예비창업자 및 초기창업자 지원",
            eligibility: "만 39세 이하 창업 3년 이내",
            amount: "최대 1억원",
            url: "https://www.k-startup.go.kr"
        }
    ]
};

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
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

// Main chat endpoint
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

        // Process the message and generate response
        const response = await processMessage(message);

        // Log AI response
        chatHistory.push({
            timestamp: new Date().toISOString(),
            ai: response.message
        });

        res.json(response);
    } catch (error) {
        console.error('Chat API Error:', error);
        res.status(500).json({ error: 'Internal server error' });
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
    
    // Get relevant policies
    const relevantPolicies = findRelevantPolicies(lowerMessage);
    
    // Generate response based on intent and policies
    const response = generateResponse(intent, relevantPolicies, message);
    
    return response;
}

function analyzeIntent(message) {
    if (message.includes('월세') || message.includes('주거') || message.includes('집')) {
        return 'housing';
    } else if (message.includes('취업') || message.includes('일자리') || message.includes('인턴')) {
        return 'employment';
    } else if (message.includes('창업') || message.includes('사업') || message.includes('스타트업')) {
        return 'startup';
    } else if (message.includes('안녕') || message.includes('반가')) {
        return 'greeting';
    } else if (message.includes('감사') || message.includes('고마')) {
        return 'thanks';
    } else {
        return 'general';
    }
}

function findRelevantPolicies(message) {
    const allPolicies = Object.values(policyDatabase).flat();
    const relevant = [];
    
    // Simple keyword matching (can be improved with NLP)
    const keywords = message.split(' ').filter(word => word.length > 2);
    
    allPolicies.forEach(policy => {
        const policyText = `${policy.title} ${policy.description}`.toLowerCase();
        const matches = keywords.filter(keyword => 
            policyText.includes(keyword.toLowerCase())
        ).length;
        
        if (matches > 0) {
            relevant.push({ ...policy, relevance: matches });
        }
    });
    
    // Sort by relevance
    relevant.sort((a, b) => b.relevance - a.relevance);
    
    return relevant.slice(0, 3); // Return top 3 most relevant
}

function generateResponse(intent, policies, originalMessage) {
    let message = '';
    let references = [];
    let followUpQuestions = [];
    
    switch (intent) {
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
            if (policies.length > 0) {
                message = '주거 관련 청년 정책을 찾아드렸습니다:\n\n';
                policies.forEach((policy, index) => {
                    message += `${index + 1}. **${policy.title}**\n`;
                    message += `   • ${policy.description}\n`;
                    message += `   • 지원금액: ${policy.amount}\n`;
                    message += `   • 자격조건: ${policy.eligibility}\n\n`;
                    
                    references.push({
                        title: policy.title,
                        url: policy.url,
                        snippet: policy.description
                    });
                });
                followUpQuestions = [
                    '신청 방법이 궁금해요',
                    '필요 서류는 뭔가요?',
                    '다른 지원과 중복 가능한가요?'
                ];
            }
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
    
    return {
        message,
        references,
        followUpQuestions,
        intent,
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