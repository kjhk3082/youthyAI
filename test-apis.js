#!/usr/bin/env node

const axios = require('axios');

const API_BASE = 'http://localhost:3000';

async function testAPI(message, description) {
    console.log(`\n📝 Testing: ${description}`);
    console.log(`   Query: "${message}"`);
    
    try {
        const response = await axios.post(`${API_BASE}/api/chat`, {
            message: message,
            userId: 'test-user'
        });
        
        const data = response.data;
        console.log(`✅ Response received (${data.message.length} chars)`);
        console.log(`   Intent: ${data.intent || 'general'}`);
        console.log(`   First 200 chars: ${data.message.substring(0, 200)}...`);
        
        if (data.references && data.references.length > 0) {
            console.log(`   References: ${data.references.length} sources`);
        }
        
        return true;
    } catch (error) {
        console.log(`❌ Error: ${error.message}`);
        return false;
    }
}

async function runTests() {
    console.log('🔬 YOUTHY AI API Integration Test Suite');
    console.log('=====================================');
    
    // Test 1: Self-introduction (uses OpenAI)
    await testAPI(
        "안녕 너는 누구야?",
        "Self-introduction (OpenAI integration)"
    );
    
    // Test 2: Static policy query (uses local DB)
    await testAPI(
        "청년 주거 정책 알려줘",
        "Housing policy query (Local DB + OpenAI)"
    );
    
    // Test 3: Web search query (uses Tavily API)
    await testAPI(
        "2025년 최신 청년 정책 온라인으로 검색해줘",
        "Current policy search (Tavily API + OpenAI)"
    );
    
    // Test 4: Regional query (uses YouthCenter API)
    await testAPI(
        "서울시 청년 창업 지원 정책",
        "Regional startup policy (YouthCenter API + OpenAI)"
    );
    
    // Test 5: Specific age query
    await testAPI(
        "25살인데 받을 수 있는 지원금",
        "Age-specific benefits (Multiple APIs)"
    );
    
    console.log('\n✨ Test suite completed!');
}

// Run tests
runTests().catch(console.error);