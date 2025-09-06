/**
 * 온통청년 API GET 메서드 테스트
 */

const axios = require('axios');

async function testYouthCenterAPIGet() {
  console.log('🔍 온통청년 API GET 테스트...\n');
  
  const apiUrl = 'https://www.youthcenter.go.kr/go/ythip/getPlcy';
  const apiKey = '2a27a665-5b2c-48dd-913e-965ea1956104';
  
  try {
    console.log('GET 요청 시도...');
    
    const params = {
      apiKeyNm: apiKey,
      pageNum: 1,
      pageSize: 10,
      rtnType: 'json',
      zipCd: '11680' // 강남구
    };
    
    console.log('URL:', apiUrl);
    console.log('Params:', params);
    
    const response = await axios.get(apiUrl, {
      params: params,
      timeout: 15000,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0'
      }
    });
    
    console.log('응답 상태:', response.status);
    console.log('응답 헤더:', response.headers);
    console.log('응답 데이터 타입:', typeof response.data);
    console.log('응답 데이터:', response.data);
    
    if (response.data) {
      if (typeof response.data === 'string') {
        console.log('문자열 응답 길이:', response.data.length);
        console.log('처음 500자:', response.data.substring(0, 500));
      } else if (typeof response.data === 'object') {
        console.log('객체 키:', Object.keys(response.data));
      }
    }
    
  } catch (error) {
    console.error('❌ 에러:', error.message);
    if (error.response) {
      console.error('응답 상태:', error.response.status);
      console.error('응답 헤더:', error.response.headers);
      console.error('응답 데이터:', error.response.data?.substring?.(0, 500) || error.response.data);
    }
  }
}

// 다른 API 엔드포인트 테스트
async function testAlternativeAPI() {
  console.log('\n\n🔍 대체 API 엔드포인트 테스트...\n');
  
  // 온통청년 정책 목록 API (다른 엔드포인트)
  const listApiUrl = 'https://www.youthcenter.go.kr/opi/youthPlcyList.do';
  const apiKey = '2a27a665-5b2c-48dd-913e-965ea1956104';
  
  try {
    const params = {
      openApiVlak: apiKey,
      pageIndex: 1,
      display: 10,
      query: '서울'
    };
    
    console.log('URL:', listApiUrl);
    console.log('Params:', params);
    
    const response = await axios.get(listApiUrl, {
      params: params,
      timeout: 15000,
      headers: {
        'Accept': 'application/json, text/html, */*',
        'User-Agent': 'Mozilla/5.0'
      }
    });
    
    console.log('응답 상태:', response.status);
    
    if (response.data) {
      if (typeof response.data === 'string') {
        // HTML 응답인지 확인
        if (response.data.includes('<!DOCTYPE') || response.data.includes('<html')) {
          console.log('HTML 응답 받음 (API가 HTML 반환)');
        } else {
          console.log('문자열 응답:', response.data.substring(0, 500));
        }
      } else if (typeof response.data === 'object') {
        console.log('✅ JSON 응답 받음!');
        console.log('객체 키:', Object.keys(response.data));
        
        if (response.data.youthPolicy) {
          console.log('정책 개수:', response.data.youthPolicy.length);
          if (response.data.youthPolicy.length > 0) {
            console.log('\n첫 번째 정책:');
            const first = response.data.youthPolicy[0];
            console.log('- 이름:', first.polyBizSjnm);
            console.log('- 내용:', first.polyItcnCn?.substring(0, 100));
          }
        }
      }
    }
    
  } catch (error) {
    console.error('❌ 에러:', error.message);
  }
}

// 실행
async function runTests() {
  await testYouthCenterAPIGet();
  await testAlternativeAPI();
}

runTests();