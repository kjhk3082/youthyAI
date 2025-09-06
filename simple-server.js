const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        message: 'YOUTHY AI Server is running!',
        timestamp: new Date().toISOString()
    });
});

app.post('/api/chat', async (req, res) => {
    const { message } = req.body;
    
    // Simple response for now
    res.json({
        message: `서버가 복구되었습니다! 받은 메시지: "${message}"`,
        timestamp: new Date().toISOString()
    });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Simple YOUTHY Server is running on http://localhost:${PORT}`);
    console.log(`📱 Test page available at http://localhost:${PORT}`);
    console.log(`🔍 API Health: http://localhost:${PORT}/api/health`);
});