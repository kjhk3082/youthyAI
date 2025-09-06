// Scrap Page JavaScript
class ScrapPage {
    constructor() {
        this.scrapContainer = document.getElementById('scrapContainer');
        this.clearAllBtn = document.getElementById('clearAllBtn');
        this.scrapedMessages = this.loadScrapedMessages();
        
        this.init();
    }

    init() {
        this.renderScraps();
        
        // Clear all button
        this.clearAllBtn?.addEventListener('click', () => {
            if (confirm('모든 스크랩을 삭제하시겠습니까?')) {
                this.clearAllScraps();
            }
        });
    }

    loadScrapedMessages() {
        const saved = localStorage.getItem('youthyScrapedMessages');
        return saved ? JSON.parse(saved) : [];
    }

    saveScrapedMessages() {
        localStorage.setItem('youthyScrapedMessages', JSON.stringify(this.scrapedMessages));
    }

    renderScraps() {
        if (this.scrapedMessages.length === 0) {
            this.scrapContainer.innerHTML = `
                <div class="scrap-empty-state">
                    <div class="scrap-empty-icon">📌</div>
                    <h2 class="scrap-empty-title">스크랩한 채팅이 없습니다</h2>
                    <p class="scrap-empty-desc">중요한 정보를 스크랩하면 여기에서 확인할 수 있습니다</p>
                    <a href="/" class="back-to-chat-btn">
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                            <path d="M7 10L3 6L7 2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                            <path d="M3 6H14C16 6 18 8 18 10V18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                        채팅으로 돌아가기
                    </a>
                </div>
            `;
            return;
        }

        // Sort by date (newest first)
        const sortedScraps = [...this.scrapedMessages].sort((a, b) => {
            return new Date(b.date) - new Date(a.date);
        });

        const html = sortedScraps.map(scrap => {
            const date = new Date(scrap.date);
            const dateStr = this.formatDate(date);
            const timeStr = scrap.time || this.formatTime(date);

            return `
                <div class="scrap-card" data-scrap-id="${scrap.id}">
                    <div class="scrap-card-header">
                        <div class="scrap-date-time">
                            <div class="scrap-date">${dateStr}</div>
                            <div class="scrap-time">${timeStr}</div>
                        </div>
                        <button class="scrap-delete-btn" data-scrap-id="${scrap.id}">
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                                <path d="M6 2L14 2M2 5H18M16 5L15.3 17C15.2 17.6 14.6 18 14 18H6C5.4 18 4.8 17.6 4.7 17L4 5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                                <path d="M8 9V14M12 9V14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                            </svg>
                        </button>
                    </div>
                    <div class="scrap-card-content">
                        ${this.formatMessage(scrap.text)}
                    </div>
                </div>
            `;
        }).join('');

        this.scrapContainer.innerHTML = html;

        // Add delete button listeners
        document.querySelectorAll('.scrap-delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const scrapId = btn.dataset.scrapId;
                this.deleteScrap(scrapId);
            });
        });
    }

    formatDate(date) {
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const weekday = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
        
        return `${year}년 ${month}월 ${day}일 (${weekday})`;
    }

    formatTime(date) {
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
    }

    formatMessage(text) {
        // Enhanced formatting for better readability
        
        // Headers
        text = text.replace(/^### (.+)$/gm, '<h3>$1</h3>');
        text = text.replace(/^## (.+)$/gm, '<h3>$1</h3>');
        text = text.replace(/^# (.+)$/gm, '<h3>$1</h3>');
        
        // Policy cards
        text = text.replace(/📍\s*\*\*(.+?)\*\*/g, '<div class="policy-card"><div class="policy-title">📍 $1</div><div class="policy-description">');
        
        // Bold text
        text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        
        // Phone numbers with icon
        text = text.replace(/📞\s*([\d-]+)/g, '<span class="policy-contact">📞 $1</span>');
        
        // Bullet points
        text = text.replace(/^•\s*(.+)$/gm, '<div class="policy-detail-item"><span class="policy-detail-icon">•</span><span>$1</span></div>');
        text = text.replace(/^-\s*(.+)$/gm, '<div class="policy-detail-item"><span class="policy-detail-icon">•</span><span>$1</span></div>');
        
        // Line breaks
        text = text.replace(/\n/g, '<br>');
        
        return text;
    }

    deleteScrap(scrapId) {
        this.scrapedMessages = this.scrapedMessages.filter(msg => msg.id !== scrapId);
        this.saveScrapedMessages();
        
        // Animate removal
        const card = document.querySelector(`[data-scrap-id="${scrapId}"]`);
        if (card) {
            card.style.opacity = '0';
            card.style.transform = 'translateX(-20px)';
            setTimeout(() => {
                this.renderScraps();
            }, 300);
        }
    }

    clearAllScraps() {
        this.scrapedMessages = [];
        this.saveScrapedMessages();
        this.renderScraps();
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new ScrapPage();
});