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
        this.chatContainer = document.querySelector('.chat-container');
        this.scrapNavBtn = document.getElementById('scrapNavBtn');
        
        this.isTyping = false;
        this.messageHistory = [];
        this.hasMessages = false;
        this.scrapedMessages = this.loadScrapedMessages();
        this.messageIdCounter = 0;
        this.userInfo = this.loadUserInfo();
        
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

        // Action Cards with new actions
        this.actionCards.forEach((card) => {
            card.addEventListener('click', (e) => {
                const action = e.currentTarget.dataset.action;
                this.handleActionCard(action);
            });
        });

        // Scrap navigation button - navigate to scrap page
        if (this.scrapNavBtn) {
            this.scrapNavBtn.addEventListener('click', () => {
                window.location.href = '/scrap.html';
            });
        }

        // Clear messages and show welcome
        this.clearMessages();
    }

    clearMessages() {
        this.chatMessages.innerHTML = '';
        this.hasMessages = false;
        this.showWelcomeContent();
    }

    hideWelcomeContent() {
        if (!this.hasMessages) {
            this.welcomeSection?.classList.add('minimized');
            this.actionCardsSection?.classList.add('minimized');
            this.suggestionsSection?.classList.add('minimized');
            this.hasMessages = true;
            
            // Ensure messages area is scrollable
            setTimeout(() => {
                this.chatMessages.style.minHeight = 'calc(100vh - 200px)';
            }, 300);
        }
    }

    showWelcomeContent() {
        this.welcomeSection?.classList.remove('minimized');
        this.actionCardsSection?.classList.remove('minimized');
        this.suggestionsSection?.classList.remove('minimized');
        this.chatMessages.style.minHeight = '200px';
    }

    handleActionCard(action) {
        switch(action) {
            case 'hot-policies':
                this.chatInput.value = '지금 가장 인기있는 청년 정책을 알려주세요';
                this.sendMessage();
                break;
            case 'personalized':
                this.showUserInfoModal();
                break;
            case 'quick-questions':
                this.showQuickQuestions();
                break;
        }
    }

    showQuickQuestions() {
        const questions = [
            '청년 월세 지원 신청 방법은?',
            '전세자금 대출 조건이 어떻게 되나요?',
            '청년수당 받을 수 있는지 확인하고 싶어요',
            '취업 준비생을 위한 지원이 있나요?',
            '청년 창업 지원금은 어떻게 받나요?'
        ];
        
        const randomQuestion = questions[Math.floor(Math.random() * questions.length)];
        this.chatInput.value = randomQuestion;
        this.chatInput.focus();
    }

    showUserInfoModal() {
        let modal = document.getElementById('userInfoModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'userInfoModal';
            modal.className = 'user-info-modal';
            document.body.appendChild(modal);
        }
        
        modal.innerHTML = `
            <div class="user-info-content">
                <div class="user-info-header">
                    <h3 class="user-info-title">🎯 맞춤 정책 찾기</h3>
                    <p class="user-info-subtitle">정보를 입력하시면 더 정확한 맞춤 정책을 추천해드립니다</p>
                </div>
                <div class="user-info-body">
                    <div class="form-group">
                        <label class="form-label">나이</label>
                        <input type="number" class="form-input" id="userAge" placeholder="예: 25" 
                               value="${this.userInfo?.age || ''}" min="19" max="39">
                    </div>
                    <div class="form-group">
                        <label class="form-label">거주 지역</label>
                        <select class="form-select" id="userRegion">
                            <option value="">선택하세요</option>
                            <option value="서울" ${this.userInfo?.region === '서울' ? 'selected' : ''}>서울</option>
                            <option value="경기" ${this.userInfo?.region === '경기' ? 'selected' : ''}>경기</option>
                            <option value="인천" ${this.userInfo?.region === '인천' ? 'selected' : ''}>인천</option>
                            <option value="부산" ${this.userInfo?.region === '부산' ? 'selected' : ''}>부산</option>
                            <option value="대구" ${this.userInfo?.region === '대구' ? 'selected' : ''}>대구</option>
                            <option value="대전" ${this.userInfo?.region === '대전' ? 'selected' : ''}>대전</option>
                            <option value="광주" ${this.userInfo?.region === '광주' ? 'selected' : ''}>광주</option>
                            <option value="울산" ${this.userInfo?.region === '울산' ? 'selected' : ''}>울산</option>
                            <option value="세종" ${this.userInfo?.region === '세종' ? 'selected' : ''}>세종</option>
                            <option value="강원" ${this.userInfo?.region === '강원' ? 'selected' : ''}>강원</option>
                            <option value="충북" ${this.userInfo?.region === '충북' ? 'selected' : ''}>충북</option>
                            <option value="충남" ${this.userInfo?.region === '충남' ? 'selected' : ''}>충남</option>
                            <option value="전북" ${this.userInfo?.region === '전북' ? 'selected' : ''}>전북</option>
                            <option value="전남" ${this.userInfo?.region === '전남' ? 'selected' : ''}>전남</option>
                            <option value="경북" ${this.userInfo?.region === '경북' ? 'selected' : ''}>경북</option>
                            <option value="경남" ${this.userInfo?.region === '경남' ? 'selected' : ''}>경남</option>
                            <option value="제주" ${this.userInfo?.region === '제주' ? 'selected' : ''}>제주</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">현재 상태</label>
                        <select class="form-select" id="userStatus">
                            <option value="">선택하세요</option>
                            <option value="대학생" ${this.userInfo?.status === '대학생' ? 'selected' : ''}>대학생</option>
                            <option value="대학원생" ${this.userInfo?.status === '대학원생' ? 'selected' : ''}>대학원생</option>
                            <option value="취업준비생" ${this.userInfo?.status === '취업준비생' ? 'selected' : ''}>취업준비생</option>
                            <option value="직장인" ${this.userInfo?.status === '직장인' ? 'selected' : ''}>직장인</option>
                            <option value="창업준비" ${this.userInfo?.status === '창업준비' ? 'selected' : ''}>창업준비</option>
                            <option value="프리랜서" ${this.userInfo?.status === '프리랜서' ? 'selected' : ''}>프리랜서</option>
                            <option value="무직" ${this.userInfo?.status === '무직' ? 'selected' : ''}>무직</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">관심 분야 (복수 선택 가능)</label>
                        <div class="checkbox-group">
                            <div class="checkbox-item">
                                <input type="checkbox" id="interest-housing" value="주거" 
                                       ${this.userInfo?.interests?.includes('주거') ? 'checked' : ''}>
                                <label for="interest-housing">주거/주택</label>
                            </div>
                            <div class="checkbox-item">
                                <input type="checkbox" id="interest-job" value="취업" 
                                       ${this.userInfo?.interests?.includes('취업') ? 'checked' : ''}>
                                <label for="interest-job">취업/일자리</label>
                            </div>
                            <div class="checkbox-item">
                                <input type="checkbox" id="interest-startup" value="창업" 
                                       ${this.userInfo?.interests?.includes('창업') ? 'checked' : ''}>
                                <label for="interest-startup">창업</label>
                            </div>
                            <div class="checkbox-item">
                                <input type="checkbox" id="interest-education" value="교육" 
                                       ${this.userInfo?.interests?.includes('교육') ? 'checked' : ''}>
                                <label for="interest-education">교육/학자금</label>
                            </div>
                            <div class="checkbox-item">
                                <input type="checkbox" id="interest-welfare" value="복지" 
                                       ${this.userInfo?.interests?.includes('복지') ? 'checked' : ''}>
                                <label for="interest-welfare">생활/복지</label>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="user-info-footer">
                    <button class="btn-cancel" onclick="document.getElementById('userInfoModal').classList.remove('active')">취소</button>
                    <button class="btn-save" id="saveUserInfo">저장하고 맞춤 정책 찾기</button>
                </div>
            </div>
        `;
        
        modal.classList.add('active');
        
        // Save button event
        document.getElementById('saveUserInfo').addEventListener('click', () => {
            this.saveUserInfo();
            modal.classList.remove('active');
            this.requestPersonalizedPolicies();
        });
        
        // Close on outside click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    }

    saveUserInfo() {
        const interests = [];
        document.querySelectorAll('.checkbox-item input:checked').forEach(cb => {
            interests.push(cb.value);
        });
        
        this.userInfo = {
            age: document.getElementById('userAge').value,
            region: document.getElementById('userRegion').value,
            status: document.getElementById('userStatus').value,
            interests: interests
        };
        
        localStorage.setItem('youthyUserInfo', JSON.stringify(this.userInfo));
    }

    loadUserInfo() {
        const saved = localStorage.getItem('youthyUserInfo');
        return saved ? JSON.parse(saved) : null;
    }

    requestPersonalizedPolicies() {
        if (!this.userInfo) return;
        
        let message = `나이 ${this.userInfo.age}세, ${this.userInfo.region} 거주, ${this.userInfo.status}인 저에게 맞는 `;
        if (this.userInfo.interests && this.userInfo.interests.length > 0) {
            message += `${this.userInfo.interests.join(', ')} 분야의 `;
        }
        message += '청년 정책을 추천해주세요';
        
        this.chatInput.value = message;
        this.sendMessage();
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
            // Send to API with user info context
            const response = await this.sendToAPI(message);
            
            // Remove typing indicator
            this.hideTypingIndicator();
            
            // Add AI response
            const messageId = this.addMessage(response.message, 'ai', response.references, response.hasPoster);
            
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
                        history: this.messageHistory.slice(-5),
                        userInfo: this.userInfo
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
            throw new Error('서버 연결에 실패했습니다. 잠시 후 다시 시도해주세요.');
        }
    }

    addMessage(text, sender, references = [], hasPoster = false) {
        const messageId = `msg-${++this.messageIdCounter}`;
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}`;
        messageDiv.id = messageId;
        
        const avatarDiv = document.createElement('div');
        
        if (sender === 'ai') {
            // Use YOUTHY sparkle logo for AI messages
            avatarDiv.className = 'message-avatar youthy-logo';
            avatarDiv.innerHTML = `
                <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect width="100" height="100" fill="#007AFF" rx="10"/>
                    <g transform="translate(50, 50)">
                        <!-- YOUTHY sparkle: two overlapping diamonds -->
                        <path d="M0 -15L11.25 0L0 15L-11.25 0Z" fill="white"/>
                        <path d="M-15 0L0 -11.25L15 0L0 11.25Z" fill="white"/>
                    </g>
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
        
        // Add scrap button for AI messages
        if (sender === 'ai') {
            const scrapBtn = this.createScrapButton(messageId, text);
            textDiv.appendChild(scrapBtn);
        }
        
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
        
        return messageId;
    }

    formatMessage(text) {
        // Enhanced formatting with beautiful blue highlights
        
        // Headers
        text = text.replace(/^### (.+)$/gm, '<h3>$1</h3>');
        text = text.replace(/^## (.+)$/gm, '<h3>$1</h3>');
        text = text.replace(/^# (.+)$/gm, '<h3>$1</h3>');
        
        // Process policy cards - Find complete policy sections
        text = text.replace(/📍\s*\*\*(.+?)\*\*([^📍]*?)(?=📍|💡|$)/gs, (match, title, content) => {
            // Process the content inside the policy card
            let processedContent = content;
            
            // Apply formatting to content
            processedContent = processedContent.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
            
            // Clean up bullet points - process line by line
            const lines = processedContent.split('\n');
            const processedLines = lines.map(line => {
                // Check if line starts with bullet or dash
                if (line.match(/^[•\-]\s*/)) {
                    // Remove bullet/dash and any HTML artifacts
                    const cleanText = line.replace(/^[•\-]\s*/, '')
                                          .replace(/<[^>]*>/g, '')
                                          .replace(/detail.*?item["'>]*/gi, '')
                                          .trim();
                    if (cleanText) {
                        return `<div class="policy-detail-item">• ${cleanText}</div>`;
                    }
                }
                return line;
            }).filter(line => line !== '');
            
            processedContent = processedLines.join('<br>');
            
            return `<div class="policy-card">
                <div class="policy-title">📍 ${title}</div>
                <div class="policy-description">${processedContent}</div>
            </div>`;
        });
        
        // Key information sections
        text = text.replace(/💡\s*\*\*(.+?)\*\*([^💡📍]*?)(?=💡|📍|$)/gs, (match, title, content) => {
            let processedContent = content.replace(/\n/g, '<br>');
            return `<div class="key-info">
                <div class="key-info-title">💡 ${title}</div>
                <div class="key-info-content">${processedContent}</div>
            </div>`;
        });
        
        // Bold text (for remaining unprocessed bold text)
        text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        
        // Bullet points with better spacing (for remaining unprocessed bullets)
        // Process line by line to avoid HTML corruption
        const lines = text.split('\n');
        text = lines.map(line => {
            // Check if this line is a bullet point (not already in a div)
            if (line.match(/^[•\-]\s*/) && !line.includes('policy-detail-item')) {
                // Clean the text from any HTML artifacts
                const cleanText = line.replace(/^[•\-]\s*/, '')
                                     .replace(/<[^>]*>/g, '')
                                     .replace(/detail.*?item["'>]*/gi, '')
                                     .trim();
                if (cleanText) {
                    return `<div class="policy-detail-item">• ${cleanText}</div>`;
                }
            }
            return line;
        }).join('\n');
        
        // Apply blue highlights AFTER structure formatting
        text = this.applyBlueHighlights(text);
        
        // Line breaks (for remaining unprocessed line breaks)
        text = text.replace(/\n/g, '<br>');
        
        return text;
    }
    
    applyBlueHighlights(text) {
        // Protect HTML tags from being corrupted
        const htmlProtected = [];
        let protectedText = text;
        
        // Temporarily replace HTML tags with placeholders
        protectedText = protectedText.replace(/<[^>]+>/g, (match) => {
            const placeholder = `__HTML_${htmlProtected.length}__`;
            htmlProtected.push(match);
            return placeholder;
        });
        
        // REDUCED highlighting for better readability - only highlight KEY information
        const highlightPatterns = [
            // Key money amounts (only with "월" or "최대")
            /(월\s*최대?\s*\d+만\s*원)/g,     // "월 최대 20만원", "월 50만원"
            /(최대\s*\d+(?:억|천만|만)?\s*원)/g,  // "최대 1억원", "최대 5천만원"
            
            // Full age ranges only
            /(만\s*\d+[-~]\d+세)/g,  // "만 19-34세"
            
            // Important durations with "최대" or "간"
            /(최대\s*\d+개월)/g,     // "최대 6개월"
            /(\d+개월간)/g           // "12개월간"
        ];
        
        highlightPatterns.forEach(pattern => {
            protectedText = protectedText.replace(pattern, '<span class="highlight-blue">$1</span>');
        });
        
        // Simple contact info formatting
        protectedText = protectedText.replace(/📞\s*([\d-]+)/g, '<span class="policy-contact">📞 $1</span>');
        
        // Restore HTML tags
        htmlProtected.forEach((html, index) => {
            protectedText = protectedText.replace(`__HTML_${index}__`, html);
        });
        
        return protectedText;
    }

    createScrapButton(messageId, messageText) {
        const button = document.createElement('button');
        button.className = 'scrap-btn';
        button.dataset.messageId = messageId;
        
        const isScraped = this.isMessageScraped(messageId);
        if (isScraped) {
            button.classList.add('scraped');
        }
        
        button.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M3 1H11C11.55 1 12 1.45 12 2V13L7 10.5L2 13V2C2 1.45 2.45 1 3 1Z" 
                      fill="${isScraped ? 'currentColor' : 'none'}" 
                      stroke="currentColor" stroke-width="1.5"/>
            </svg>
            ${isScraped ? '스크랩됨' : '스크랩'}
        `;
        
        button.addEventListener('click', () => {
            this.toggleScrap(messageId, messageText, button);
        });
        
        return button;
    }

    toggleScrap(messageId, messageText, button) {
        const isScraped = this.isMessageScraped(messageId);
        
        if (isScraped) {
            // Remove from scraps
            this.scrapedMessages = this.scrapedMessages.filter(msg => msg.id !== messageId);
            button.classList.remove('scraped');
            button.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M3 1H11C11.55 1 12 1.45 12 2V13L7 10.5L2 13V2C2 1.45 2.45 1 3 1Z" 
                          fill="none" stroke="currentColor" stroke-width="1.5"/>
                </svg>
                스크랩
            `;
        } else {
            // Add to scraps
            this.scrapedMessages.push({
                id: messageId,
                text: messageText,
                time: this.getCurrentTime(),
                date: new Date().toISOString()
            });
            button.classList.add('scraped');
            button.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M3 1H11C11.55 1 12 1.45 12 2V13L7 10.5L2 13V2C2 1.45 2.45 1 3 1Z" 
                          fill="currentColor" stroke="currentColor" stroke-width="1.5"/>
                </svg>
                스크랩됨
            `;
        }
        
        this.saveScrapedMessages();
    }

    isMessageScraped(messageId) {
        return this.scrapedMessages.some(msg => msg.id === messageId);
    }

    loadScrapedMessages() {
        const saved = localStorage.getItem('youthyScrapedMessages');
        return saved ? JSON.parse(saved) : [];
    }

    saveScrapedMessages() {
        localStorage.setItem('youthyScrapedMessages', JSON.stringify(this.scrapedMessages));
    }

    /* Deprecated - using scrap page instead
    showScrapModal() {
        let modal = document.getElementById('scrapModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'scrapModal';
            modal.className = 'scrap-modal';
            document.body.appendChild(modal);
        }
        
        modal.innerHTML = `
            <div class="scrap-content">
                <div class="scrap-header">
                    <h3 class="scrap-title">스크랩한 채팅</h3>
                    <button class="scrap-close" id="scrapCloseBtn">
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                            <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                    </button>
                </div>
                <div class="scrap-body">
                    ${this.generateScrapList()}
                </div>
            </div>
        `;
        
        modal.classList.add('active');
        
        // Add event listeners
        document.getElementById('scrapCloseBtn').addEventListener('click', () => {
            modal.classList.remove('active');
        });
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
        
        // Add delete button listeners
        modal.querySelectorAll('.scrap-item-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const itemId = e.currentTarget.dataset.scrapId;
                this.deleteScrap(itemId);
                // Refresh modal content
                this.showScrapModal();
            });
        });
    }

    generateScrapList() {
        if (this.scrapedMessages.length === 0) {
            return `
                <div class="scrap-empty">
                    <div class="scrap-empty-icon">📌</div>
                    <div class="scrap-empty-text">스크랩한 채팅이 없습니다</div>
                </div>
            `;
        }
        
        return this.scrapedMessages.map(scrap => `
            <div class="scrap-item">
                <div class="scrap-item-header">
                    <div class="scrap-item-time">${scrap.time}</div>
                    <button class="scrap-item-delete" data-scrap-id="${scrap.id}">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                    </button>
                </div>
                <div class="scrap-item-content">${this.formatMessage(scrap.text)}</div>
            </div>
        `).join('');
    }

    deleteScrap(scrapId) {
        this.scrapedMessages = this.scrapedMessages.filter(msg => msg.id !== scrapId);
        this.saveScrapedMessages();
        
        // Update button state if message is still visible
        const messageEl = document.getElementById(scrapId);
        if (messageEl) {
            const scrapBtn = messageEl.querySelector('.scrap-btn');
            if (scrapBtn) {
                scrapBtn.classList.remove('scraped');
                scrapBtn.innerHTML = `
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M3 1H11C11.55 1 12 1.45 12 2V13L7 10.5L2 13V2C2 1.45 2.45 1 3 1Z" 
                              fill="none" stroke="currentColor" stroke-width="1.5"/>
                    </svg>
                    스크랩
                `;
            }
        }
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
            
            document.getElementById('posterCloseBtn').addEventListener('click', () => {
                modal.classList.remove('active');
            });
            
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                }
            });
        }
        
        modal.classList.add('active');
    }
    */

    generatePosterGrid() {
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
        
        // Add YOUTHY sparkle logo for typing indicator
        const avatarDiv = document.createElement('div');
        avatarDiv.className = 'message-avatar youthy-logo';
        avatarDiv.innerHTML = `
            <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="100" height="100" fill="#007AFF" rx="10"/>
                <g transform="translate(50, 50)">
                    <!-- YOUTHY sparkle: two overlapping diamonds -->
                    <path d="M0 -15L11.25 0L0 15L-11.25 0Z" fill="white"/>
                    <path d="M-15 0L0 -11.25L15 0L0 11.25Z" fill="white"/>
                </g>
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
        setTimeout(() => {
            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        }, 100);
    }
}

// Initialize the chat when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new YouthyChat();
});