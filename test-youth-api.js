/**
 * 온통청년 API 직접 테스트
 * 백엔드와 동일한 방식으로 POST 요청
 */

const axios = require('axios');
const FormData = require('form-data');

async function testYouthCenterAPI() {
  console.log('🔍 온통청년 API 테스트 시작...\n');
  
  const apiUrl = 'https://www.youthcenter.go.kr/go/ythip/getPlcy';
  const apiKey = '2a27a665-5b2c-48dd-913e-965ea1956104';
  
  // 테스트 1: 서울시 전체 정책
  console.log('1️⃣ 서울시 전체 정책 조회...');
  try {
    const formData1 = new FormData();
    formData1.append('apiKeyNm', apiKey);
    formData1.append('pageNum', '1');
    formData1.append('pageSize', '10');
    formData1.append('rtnType', 'json');
    formData1.append('zipCd', '11000'); // 서울시 전체
    
    const response1 = await axios.post(apiUrl, formData1, {
      timeout: 15000,
      headers: {
        ...formData1.getHeaders(),
        'Accept': 'application/json'
      }
    });
    
    if (response1.data) {
      console.log('✅ 응답 받음!');
      console.log('응답 구조:', Object.keys(response1.data));
      
      if (response1.data.youthPolicyList) {
        const policies = response1.data.youthPolicyList;
        console.log(`정책 개수: ${policies.length}개`);
        
        if (policies.length > 0) {
          console.log('\n첫 번째 정책:');
          console.log('- 이름:', policies[0].plcyNm);
          console.log('- 분야:', policies[0].lclsfNm);
          console.log('- 지원내용:', policies[0].plcySprtCn?.substring(0, 50) + '...');
          console.log('- 조회수:', policies[0].inqCnt);
        }
      }
    }
  } catch (error) {
    console.error('❌ 서울시 전체 조회 실패:', error.message);
    if (error.response) {
      console.error('응답 상태:', error.response.status);
      console.error('응답 데이터:', error.response.data);
    }
  }
  
  console.log('\n-------------------\n');
  
  // 테스트 2: 강남구 정책
  console.log('2️⃣ 강남구 정책 조회...');
  try {
    const formData2 = new FormData();
    formData2.append('apiKeyNm', apiKey);
    formData2.append('pageNum', '1');
    formData2.append('pageSize', '10');
    formData2.append('rtnType', 'json');
    formData2.append('zipCd', '11680'); // 강남구
    
    const response2 = await axios.post(apiUrl, formData2, {
      timeout: 15000,
      headers: {
        ...formData2.getHeaders(),
        'Accept': 'application/json'
      }
    });
    
    if (response2.data && response2.data.youthPolicyList) {
      const policies = response2.data.youthPolicyList;
      console.log(`✅ 강남구 정책 ${policies.length}개 조회 성공!`);
      
      if (policies.length > 0) {
        console.log('\n강남구 정책 목록:');
        policies.slice(0, 5).forEach((p, idx) => {
          console.log(`${idx + 1}. ${p.plcyNm}`);
        });
      }
    }
  } catch (error) {
    console.error('❌ 강남구 조회 실패:', error.message);
  }
  
  console.log('\n-------------------\n');
  
  // 테스트 3: 조회수 TOP 정책 (정렬 파라미터 테스트)
  console.log('3️⃣ 조회수 TOP 정책 조회...');
  try {
    const formData3 = new FormData();
    formData3.append('apiKeyNm', apiKey);
    formData3.append('pageNum', '1');
    formData3.append('pageSize', '10');
    formData3.append('rtnType', 'json');
    // 정렬 파라미터 추가 (조회수 내림차순)
    formData3.append('srchOrder', '2'); // 1: 정확도순, 2: 조회수순
    
    const response3 = await axios.post(apiUrl, formData3, {
      timeout: 15000,
      headers: {
        ...formData3.getHeaders(),
        'Accept': 'application/json'
      }
    });
    
    if (response3.data && response3.data.youthPolicyList) {
      const policies = response3.data.youthPolicyList;
      console.log(`✅ 인기 정책 ${policies.length}개 조회 성공!`);
      
      console.log('\n🏆 조회수 TOP 10:');
      policies.slice(0, 10).forEach((p, idx) => {
        console.log(`${idx + 1}. ${p.plcyNm} (조회수: ${p.inqCnt || 0})`);
      });
    }
  } catch (error) {
    console.error('❌ 인기 정책 조회 실패:', error.message);
  }
}

// 실행
testYouthCenterAPI().then(() => {
  console.log('\n✨ 테스트 완료!');
}).catch(err => {
  console.error('테스트 실패:', err);
});