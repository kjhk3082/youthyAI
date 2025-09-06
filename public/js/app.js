// Chat Application JavaScript
class YouthyChat {
    constructor() {
        this.chatMessages = document.getElementById('chatMessages');
        this.chatInput = document.getElementById('chatInput');
        this.sendBtn = document.getElementById('sendBtn');
        this.suggestionPills = document.querySelectorAll('.suggestion-pill');
        this.actionCards = document.querySelectorAll('.action-card');
        this.welcomeSection = document.querySelector('.welcome-section');
        this.actionCardsSection = document.querySelector('.action-cards');
        this.suggestionsSection = document.querySelector('.suggestions');
        
        this.isTyping = false;
        this.messageHistory = [];
        this.hasMessages = false;
        
        // Policy poster data
        this.policyPosters = {
            '월세지원': {
                title: '청년 월세 지원',
                image: '/images/posters/monthly_rent_support.jpg',
                description: '만 19-39세 청년 월 최대 20만원 지원'
            },
            '전세대출': {
                title: '청년 전세자금 대출',
                image: '/images/posters/lease_loan.jpg',
                description: '최대 2억원 저금리 대출'
            },
            '창업지원': {
                title: '청년 창업 지원금',
                image: '/images/posters/startup_support.jpg',
                description: '최대 1억원 창업 지원'
            },
            '취업지원': {
                title: '청년 취업 프로그램',
                image: '/images/posters/job_program.jpg',
                description: '인턴십 및 직업훈련 제공'
            }
        };
        
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
        this.hasMessages = false;
    }

    hideWelcomeContent() {
        // Hide welcome section and related content when first message is sent
        if (!this.hasMessages) {
            this.welcomeSection.classList.add('hidden');
            this.actionCardsSection.classList.add('hidden');
            this.suggestionsSection.classList.add('hidden');
            this.hasMessages = true;
            
            // Scroll to top of chat container
            const chatContainer = document.querySelector('.chat-container');
            chatContainer.scrollTop = 0;
        }
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

        // Hide welcome content on first message
        this.hideWelcomeContent();

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
            
            // Add AI response with poster option if applicable
            this.addMessage(response.message, 'ai', response.references, response.hasPoster);
            
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
            // Throw error to be handled by parent catch block
            throw new Error('서버 연결에 실패했습니다. 잠시 후 다시 시도해주세요.');
        }
    }

    addMessage(text, sender, references = [], hasPoster = false) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}`;
        
        const avatarDiv = document.createElement('div');
        
        if (sender === 'ai') {
            // Use YOUTHY logo for AI messages
            avatarDiv.className = 'message-avatar youthy-logo';
            avatarDiv.innerHTML = `
                <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect width="100" height="100" fill="black"/>
                    <g transform="translate(20, 25)">
                        <!-- Star shape -->
                        <path d="M30 10L35 22L47 27L35 32L30 44L25 32L13 27L25 22L30 10Z" fill="#007AFF"/>
                        <!-- Small diamond -->
                        <rect x="24" y="0" width="12" height="12" rx="2" transform="rotate(45 30 6)" fill="#007AFF"/>
                    </g>
                    <text x="50" y="75" text-anchor="middle" fill="#007AFF" font-family="Arial, sans-serif" font-size="14" font-weight="bold">YOUTHY</text>
                </svg>
            `;
        } else {
            avatarDiv.className = 'message-avatar';
            avatarDiv.textContent = '나';
        }
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        
        const textDiv = document.createElement('div');
        textDiv.className = 'message-text';
        textDiv.innerHTML = this.formatMessage(text);
        
        // Add poster view button if policy-related
        if (sender === 'ai' && hasPoster) {
            const posterBtn = this.createPosterButton();
            textDiv.appendChild(posterBtn);
        }
        
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

    createPosterButton() {
        const button = document.createElement('button');
        button.className = 'view-poster-btn';
        button.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" stroke-width="1.5"/>
                <path d="M2 10L6 6L10 10L14 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                <circle cx="11" cy="5" r="1" fill="currentColor"/>
            </svg>
            홍보 포스터 보기
        `;
        
        button.addEventListener('click', () => {
            this.showPosterModal();
        });
        
        return button;
    }

    showPosterModal() {
        // Create modal if it doesn't exist
        let modal = document.getElementById('posterModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'posterModal';
            modal.className = 'poster-modal';
            modal.innerHTML = `
                <div class="poster-content">
                    <div class="poster-header">
                        <h3 class="poster-title">청년 정책 홍보 포스터</h3>
                        <button class="poster-close" id="posterCloseBtn">
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                                <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                            </svg>
                        </button>
                    </div>
                    <div class="poster-body">
                        <div class="poster-grid">
                            ${this.generatePosterGrid()}
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            
            // Add close event
            document.getElementById('posterCloseBtn').addEventListener('click', () => {
                modal.classList.remove('active');
            });
            
            // Close on outside click
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                }
            });
        }
        
        modal.classList.add('active');
    }

    generatePosterGrid() {
        // Generate placeholder poster items
        const posters = [
            { title: '청년 월세 지원', desc: '월 최대 20만원 지원' },
            { title: '청년 전세자금 대출', desc: '최대 2억원 저금리' },
            { title: '청년 창업 지원금', desc: '최대 1억원 지원' },
            { title: '청년 취업 프로그램', desc: '인턴십 및 교육' },
            { title: '청년수당', desc: '월 50만원 현금 지원' },
            { title: '청년 교육 지원', desc: '학자금 대출 이자 지원' }
        ];
        
        return posters.map(poster => `
            <div class="poster-item">
                <div style="height: 150px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; color: white; font-size: 18px; font-weight: bold; text-align: center; padding: 20px;">
                    ${poster.title}
                </div>
                <div class="poster-item-title">${poster.desc}</div>
            </div>
        `).join('');
    }

    formatMessage(text) {
        // Convert line breaks to <br>
        text = text.replace(/\n/g, '<br>');
        
        // Convert markdown-style bold
        text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        
        // Convert bullet points
        text = text.replace(/•/g, '&bull;');
        
        // Parse numbered lists
        text = text.replace(/(\d+)\.\s/g, '<br>$1. ');
        
        return text;
    }

    createReferences(references) {
        const refsDiv = document.createElement('div');
        refsDiv.className = 'message-references';
        
        references.forEach(ref => {
            const refItem = document.createElement('a');
            refItem.href = ref.url;
            refItem.target = '_blank';
            refItem.className = 'reference-item';
            
            const title = document.createElement('div');
            title.className = 'reference-title';
            title.textContent = ref.title;
            
            const snippet = document.createElement('div');
            snippet.className = 'reference-snippet';
            snippet.textContent = ref.snippet || '';
            
            const url = document.createElement('div');
            url.className = 'reference-url';
            url.textContent = ref.url;
            
            refItem.appendChild(title);
            if (ref.snippet) refItem.appendChild(snippet);
            refItem.appendChild(url);
            
            refsDiv.appendChild(refItem);
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
        if (lastMessage && lastMessage.querySelector('.message-content')) {
            lastMessage.querySelector('.message-content').appendChild(suggestionsDiv);
        }
    }

    showTypingIndicator() {
        this.isTyping = true;
        
        const typingDiv = document.createElement('div');
        typingDiv.className = 'message ai';
        typingDiv.id = 'typing-indicator';
        
        // Add YOUTHY logo for typing indicator
        const avatarDiv = document.createElement('div');
        avatarDiv.className = 'message-avatar youthy-logo';
        avatarDiv.innerHTML = `
            <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="100" height="100" fill="black"/>
                <g transform="translate(20, 25)">
                    <path d="M30 10L35 22L47 27L35 32L30 44L25 32L13 27L25 22L30 10Z" fill="#007AFF"/>
                    <rect x="24" y="0" width="12" height="12" rx="2" transform="rotate(45 30 6)" fill="#007AFF"/>
                </g>
                <text x="50" y="75" text-anchor="middle" fill="#007AFF" font-family="Arial, sans-serif" font-size="14" font-weight="bold">YOUTHY</text>
            </svg>
        `;
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        
        const dotsDiv = document.createElement('div');
        dotsDiv.className = 'typing-indicator';
        
        for (let i = 0; i < 3; i++) {
            const dot = document.createElement('div');
            dot.className = 'typing-dot';
            dotsDiv.appendChild(dot);
        }
        
        contentDiv.appendChild(dotsDiv);
        typingDiv.appendChild(avatarDiv);
        typingDiv.appendChild(contentDiv);
        
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