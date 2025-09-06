# 🔑 OpenAI API 키 설정 가이드

## 1. API 키 받기
1. https://platform.openai.com/api-keys 접속
2. 로그인 또는 회원가입
3. "Create new secret key" 클릭
4. 키 복사 (sk-로 시작하는 키)

## 2. API 키 설정하기

### 방법 A: .env 파일 수정
```bash
# .env 파일 열기
nano .env

# 다음 라인 수정
OPENAI_API_KEY=sk-여기에-실제-API-키-입력
```

### 방법 B: 명령어로 설정
```bash
# 기존 .env 백업
cp .env .env.backup

# API 키 설정 (실제 키로 교체)
sed -i 's/your-api-key-here/sk-실제-API-키/' .env
```

## 3. 서버 재시작
```bash
npx pm2 restart youthy-ai-chatbot
```

## 4. 확인
```bash
# 로그 확인
npx pm2 logs youthy-ai-chatbot --nostream --lines 20

# "🤖 Using RAG System" 메시지가 보이면 성공!
```

## 5. 테스트
- 브라우저에서 https://3000-ie8kwy33uts4uea5lzj2o-6532622b.e2b.dev 접속
- 질문 입력 후 RAG 시스템 응답 확인

## ⚠️ 주의사항
- API 키는 절대 공개하지 마세요
- GitHub에 푸시하기 전에 .env 파일이 .gitignore에 포함되어 있는지 확인
- 무료 계정은 월 사용량 제한이 있습니다

## 🆘 문제 해결
- API 키 오류: 키가 올바른지, 잔액이 있는지 확인
- 연결 오류: 인터넷 연결 확인
- 권한 오류: API 키 권한 설정 확인