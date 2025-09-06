// Chat Application JavaScript
class YouthyChat {
    constructor() {
        this.chatMessages = document.getElementById('chatMessages');
        this.chatInput = document.getElementById('chatInput');
        this.sendBtn = document.getElementById('sendBtn');
        this.suggestionPills = document.querySelectorAll('.suggestion-pill');
        this.actionCards = document.querySelectorAll('.action-card');
        
        this.isTyping = false;
        this.messageHistory = [];
        
        this.init();
    }

    init() {
        // Event Listeners
        this.sendBtn.addEventListener('click', () => this.sendMessage());
        this.chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Suggestion Pills
        this.suggestionPills.forEach(pill => {
            pill.addEventListener('click', () => {
                this.chatInput.value = pill.textContent;
                this.sendMessage();
            });
        });

        // Action Cards
        this.actionCards.forEach((card, index) => {
            card.addEventListener('click', () => {
                this.handleActionCard(index);
            });
        });

        // Clear messages and show welcome
        this.clearMessages();
    }

    clearMessages() {
        this.chatMessages.innerHTML = '';
    }

    handleActionCard(index) {
        const actions = [
            '청년 정책을 찾아주세요',
            '나에게 맞는 정책을 추천해주세요',
            '유씨 메뉴를 보여주세요'
        ];
        
        if (actions[index]) {
            this.chatInput.value = actions[index];
            this.sendMessage();
        }
    }

    async sendMessage() {
        const message = this.chatInput.value.trim();
        if (!message || this.isTyping) return;

        // Add user message
        this.addMessage(message, 'user');
        
        // Clear input
        this.chatInput.value = '';
        
        // Show typing indicator
        this.showTypingIndicator();
        
        try {
            // Send to API
            const response = await this.sendToAPI(message);
            
            // Remove typing indicator
            this.hideTypingIndicator();
            
            // Add AI response
            this.addMessage(response.message, 'ai', response.references);
            
            // Add follow-up suggestions if available
            if (response.followUpQuestions && response.followUpQuestions.length > 0) {
                this.addFollowUpSuggestions(response.followUpQuestions);
            }
            
        } catch (error) {
            this.hideTypingIndicator();
            this.addMessage('죄송합니다. 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.', 'ai');
            console.error('Error:', error);
        }
    }

    async sendToAPI(message) {
        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: message,
                    context: {
                        history: this.messageHistory.slice(-5) // Send last 5 messages for context
                    }
                })
            });

            if (!response.ok) {
                throw new Error('API request failed');
            }

            const data = await response.json();
            
            // Store in history
            this.messageHistory.push({
                user: message,
                ai: data.message
            });

            return data;
        } catch (error) {
            console.error('API Error:', error);
            
            // Fallback response for demo
            return this.getFallbackResponse(message);
        }
    }

    getFallbackResponse(message) {
        // Demo responses based on keywords
        const responses = {
            '정책': {
                message: '청년 정책에 대해 알려드리겠습니다. 현재 서울시에서는 다양한 청년 지원 정책을 운영하고 있습니다:\n\n1. 🏠 청년 월세 지원: 만 19-39세 청년에게 월 최대 20만원 지원\n2. 💼 청년 취업 지원: 직업훈련, 인턴십 프로그램 제공\n3. 🎓 청년 교육 지원: 학자금 대출 이자 지원\n4. 🏦 청년 창업 지원: 창업 자금 및 컨설팅 제공\n\n어떤 정책에 대해 더 자세히 알고 싶으신가요?',
                references: [
                    { title: '서울시 청년포털', url: 'https://youth.seoul.go.kr', snippet: '서울시 청년정책 종합 안내' },
                    { title: '청년정책 통합검색', url: 'https://www.youthcenter.go.kr', snippet: '전국 청년정책 검색 서비스' }
                ],
                followUpQuestions: ['월세 지원 자격 조건은?', '창업 지원금 신청 방법은?', '취업 프로그램 일정은?']
            },
            '월세': {
                message: '청년 월세 지원 정책에 대해 안내드립니다:\n\n📍 **서울시 청년 월세 지원**\n• 지원대상: 만 19~39세 무주택 청년\n• 지원금액: 월 최대 20만원 (최대 12개월)\n• 소득기준: 중위소득 150% 이하\n• 임차보증금: 5천만원 이하, 월세 60만원 이하\n\n📍 **신청방법**\n1. 서울시 청년포털 접속\n2. 회원가입 및 로그인\n3. 신청서 작성 및 서류 제출\n4. 심사 후 선정 통보\n\n필요한 서류나 자세한 조건을 알려드릴까요?',
                references: [
                    { title: '서울시 청년 월세 지원', url: 'https://youth.seoul.go.kr/site/main/content/youth_housing', snippet: '청년 주거비 부담 완화' }
                ],
                followUpQuestions: ['필요 서류는 뭔가요?', '신청 기간은 언제인가요?', '중복 지원이 가능한가요?']
            },
            '취업': {
                message: '청년 취업 지원 프로그램을 소개해드립니다:\n\n💼 **주요 취업 지원 정책**\n\n1. **청년 인턴십 프로그램**\n   • 3~6개월 인턴 근무 기회 제공\n   • 월 180만원 이상 급여 지원\n\n2. **직업훈련 프로그램**\n   • IT, 디자인, 마케팅 등 다양한 분야\n   • 무료 교육 + 훈련수당 지급\n\n3. **취업 컨설팅**\n   • 1:1 맞춤형 상담\n   • 이력서/자소서 첨삭 서비스\n\n4. **면접 정장 무료 대여**\n   • 전국 취업날개 서비스센터 이용\n\n어떤 프로그램에 관심이 있으신가요?',
                references: [
                    { title: '워크넷', url: 'https://www.work.go.kr', snippet: '고용노동부 취업지원 포털' },
                    { title: '잡코리아', url: 'https://www.jobkorea.co.kr', snippet: '채용정보 및 취업지원' }
                ],
                followUpQuestions: ['인턴십 신청 방법은?', 'IT 교육 프로그램 일정은?', '취업 상담 예약하려면?']
            },
            '인기': {
                message: '🏆 **인기 있는 청년 정책 TOP 5**\n\n1. **서울시 청년 월세 지원** ⭐⭐⭐⭐⭐\n   • 월 최대 20만원 지원 (최대 12개월)\n   • 만 19-39세 무주택 청년\n   • 신청자 가장 많은 인기 정책\n   📞 문의: 02-2133-6587 (서울시청 청년정책담당관)\n\n2. **청년 전세자금 대출** ⭐⭐⭐⭐⭐\n   • 최대 2억원 저금리 대출\n   • 연 1.2~2.1% 초저금리\n   • 주거 안정의 필수 정책\n   📞 문의: 1599-0001 (국토교통부 콜센터)\n\n3. **청년 인턴십 프로그램** ⭐⭐⭐⭐\n   • 월 180만원 이상 급여\n   • 정규직 전환 기회\n   • 취업 성공률 80% 이상\n   📞 문의: 1350 (고용노동부 고객상담센터)\n\n4. **청년 창업 지원금** ⭐⭐⭐⭐\n   • 최대 1억원 지원\n   • 사무실 및 멘토링 제공\n   • 성공 창업 사례 다수\n   📞 문의: 1357 (창업진흥원 콜센터)\n\n5. **청년수당** ⭐⭐⭐\n   • 월 50만원 현금 지원\n   • 최대 6개월간 지급\n   • 구직활동 집중 지원\n   📞 문의: 02-2133-6587 (서울시청 청년정책담당관)\n\n💡 **Tip**: 각 정책은 지역별로 조건이 다를 수 있으니 자세한 내용을 확인해보세요!\n📞 **통합 문의**: 1811-9876 (온라인청년센터)',
                references: [
                    { title: '서울시 청년포털', url: 'https://youth.seoul.go.kr', snippet: '서울시 청년정책 종합 안내' },
                    { title: '청년정책 통합 플랫폼', url: 'https://www.youthcenter.go.kr', snippet: '전국 청년정책 한눈에 보기' }
                ],
                followUpQuestions: ['월세 지원 신청 방법 알려줘', '전세자금 대출 조건은?', '청년수당 받을 수 있을까?']
            },
            '창업': {
                message: '청년 창업 지원 프로그램을 안내해드립니다:\n\n🚀 **청년 창업 지원 정책**\n\n1. **청년 창업 지원금**\n   • 최대 1억원 지원 (업종별 상이)\n   • 만 39세 이하 예비창업자 또는 3년 이내 창업자\n\n2. **창업 교육 프로그램**\n   • 창업 기초교육 (무료)\n   • 멘토링 프로그램 제공\n\n3. **사무실 지원**\n   • 청년창업허브 입주 지원\n   • 월 10만원 수준의 저렴한 임대료\n\n4. **네트워킹 지원**\n   • 투자자 연결 프로그램\n   • 창업 커뮤니티 활동 지원\n\n창업 아이템이나 분야가 정해지셨나요?',
                references: [
                    { title: 'K-스타트업', url: 'https://www.k-startup.go.kr', snippet: '창업진흥원 창업지원 포털' },
                    { title: '서울창업허브', url: 'https://seoulstartuphub.com', snippet: '서울시 창업 지원 플랫폼' }
                ],
                followUpQuestions: ['창업 지원금 신청 조건은?', '창업 교육 일정은?', '사무실 입주 신청 방법은?']
            },
            default: {
                message: '안녕하세요! 유씨 AI 챗봇입니다. 😊\n\n저는 청년 정책에 대한 다양한 정보를 제공해드릴 수 있습니다. 다음과 같은 주제에 대해 물어보실 수 있어요:\n\n• 🏠 주거 지원 (월세, 전세 대출)\n• 💼 취업 지원 (인턴십, 직업훈련)\n• 🚀 창업 지원 (자금, 교육, 공간)\n• 📚 교육 지원 (학자금, 자격증)\n• 💰 금융 지원 (청년수당, 생활자금)\n\n무엇을 도와드릴까요?',
                references: [],
                followUpQuestions: ['청년 월세 지원에 대해 알려주세요', '취업 프로그램을 추천해주세요', '창업 지원금 정보가 궁금해요']
            }
        };

        // Find matching response based on keywords
        const lowerMessage = message.toLowerCase();
        
        if (lowerMessage.includes('인기') || lowerMessage.includes('추천') || lowerMessage.includes('top') || lowerMessage.includes('best')) {
            return responses['인기'];
        } else if (lowerMessage.includes('월세') || lowerMessage.includes('주거') || lowerMessage.includes('집')) {
            return responses['월세'];
        } else if (lowerMessage.includes('취업') || lowerMessage.includes('일자리') || lowerMessage.includes('인턴')) {
            return responses['취업'];
        } else if (lowerMessage.includes('창업') || lowerMessage.includes('사업') || lowerMessage.includes('스타트업')) {
            return responses['창업'];
        } else if (lowerMessage.includes('정책') || lowerMessage.includes('지원')) {
            return responses['정책'];
        } else {
            return responses.default;
        }
    }

    addMessage(text, sender, references = []) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}`;
        
        const avatarDiv = document.createElement('div');
        avatarDiv.className = 'message-avatar';
        avatarDiv.textContent = sender === 'user' ? '나' : 'AI';
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        
        const textDiv = document.createElement('div');
        textDiv.className = 'message-text';
        textDiv.innerHTML = this.formatMessage(text);
        
        const timeDiv = document.createElement('div');
        timeDiv.className = 'message-time';
        timeDiv.textContent = this.getCurrentTime();
        
        contentDiv.appendChild(textDiv);
        
        // Add references if available
        if (references && references.length > 0) {
            const referencesDiv = this.createReferences(references);
            contentDiv.appendChild(referencesDiv);
        }
        
        contentDiv.appendChild(timeDiv);
        
        messageDiv.appendChild(avatarDiv);
        messageDiv.appendChild(contentDiv);
        
        this.chatMessages.appendChild(messageDiv);
        this.scrollToBottom();
    }

    formatMessage(text) {
        // Convert line breaks to <br>
        text = text.replace(/\n/g, '<br>');
        
        // Convert markdown-style bold
        text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        
        // Convert bullet points
        text = text.replace(/•/g, '&bull;');
        
        return text;
    }

    createReferences(references) {
        const refsDiv = document.createElement('div');
        refsDiv.style.marginTop = '12px';
        refsDiv.style.paddingTop = '12px';
        refsDiv.style.borderTop = '1px solid rgba(0,0,0,0.1)';
        
        const refsTitle = document.createElement('div');
        refsTitle.style.fontSize = '12px';
        refsTitle.style.fontWeight = '600';
        refsTitle.style.marginBottom = '8px';
        refsTitle.style.color = '#666';
        refsTitle.textContent = '📚 참고 자료';
        refsDiv.appendChild(refsTitle);
        
        references.forEach((ref, index) => {
            const refLink = document.createElement('a');
            refLink.href = ref.url;
            refLink.target = '_blank';
            refLink.style.display = 'block';
            refLink.style.fontSize = '13px';
            refLink.style.color = '#007AFF';
            refLink.style.textDecoration = 'none';
            refLink.style.marginBottom = '4px';
            refLink.textContent = `[${index + 1}] ${ref.title}`;
            
            refLink.addEventListener('mouseenter', () => {
                refLink.style.textDecoration = 'underline';
            });
            
            refLink.addEventListener('mouseleave', () => {
                refLink.style.textDecoration = 'none';
            });
            
            refsDiv.appendChild(refLink);
            
            if (ref.snippet) {
                const snippet = document.createElement('div');
                snippet.style.fontSize = '12px';
                snippet.style.color = '#999';
                snippet.style.marginLeft = '16px';
                snippet.style.marginBottom = '4px';
                snippet.textContent = ref.snippet;
                refsDiv.appendChild(snippet);
            }
        });
        
        return refsDiv;
    }

    addFollowUpSuggestions(questions) {
        const suggestionsDiv = document.createElement('div');
        suggestionsDiv.style.marginTop = '16px';
        suggestionsDiv.style.padding = '12px';
        suggestionsDiv.style.background = '#F8F8F8';
        suggestionsDiv.style.borderRadius = '8px';
        
        const title = document.createElement('div');
        title.style.fontSize = '12px';
        title.style.fontWeight = '600';
        title.style.marginBottom = '8px';
        title.style.color = '#666';
        title.textContent = '💡 추천 질문';
        suggestionsDiv.appendChild(title);
        
        const buttonsDiv = document.createElement('div');
        buttonsDiv.style.display = 'flex';
        buttonsDiv.style.flexWrap = 'wrap';
        buttonsDiv.style.gap = '8px';
        
        questions.forEach(question => {
            const button = document.createElement('button');
            button.style.padding = '6px 12px';
            button.style.fontSize = '13px';
            button.style.border = '1px solid #DDD';
            button.style.borderRadius = '16px';
            button.style.background = 'white';
            button.style.cursor = 'pointer';
            button.style.transition = 'all 0.2s ease';
            button.textContent = question;
            
            button.addEventListener('click', () => {
                this.chatInput.value = question;
                this.sendMessage();
            });
            
            button.addEventListener('mouseenter', () => {
                button.style.background = '#007AFF';
                button.style.color = 'white';
                button.style.borderColor = '#007AFF';
            });
            
            button.addEventListener('mouseleave', () => {
                button.style.background = 'white';
                button.style.color = 'black';
                button.style.borderColor = '#DDD';
            });
            
            buttonsDiv.appendChild(button);
        });
        
        suggestionsDiv.appendChild(buttonsDiv);
        
        // Add to last message
        const lastMessage = this.chatMessages.lastElementChild;
        if (lastMessage && lastMessage.classList.contains('ai')) {
            lastMessage.querySelector('.message-content').appendChild(suggestionsDiv);
        }
    }

    showTypingIndicator() {
        this.isTyping = true;
        
        const typingDiv = document.createElement('div');
        typingDiv.className = 'typing-indicator';
        typingDiv.id = 'typing-indicator';
        
        for (let i = 0; i < 3; i++) {
            const dot = document.createElement('div');
            dot.className = 'typing-dot';
            typingDiv.appendChild(dot);
        }
        
        this.chatMessages.appendChild(typingDiv);
        this.scrollToBottom();
    }

    hideTypingIndicator() {
        this.isTyping = false;
        const typingIndicator = document.getElementById('typing-indicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }

    getCurrentTime() {
        const now = new Date();
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
    }

    scrollToBottom() {
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }
}

// Initialize the chat when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new YouthyChat();
});