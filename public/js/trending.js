import { fetchJson } from './utils.js';
import { toast } from './toast.js';

class TrendingPage
{
    constructor()
    {
        this.trending = [];
        this.period = 7;
    }

    async init()
    {
        this.setupEventListeners();
        await this.loadTrending();
    }

    async loadTrending()
    {
        const listEl = document.getElementById('trending-list');
        if (!listEl)
            return;

        listEl.innerHTML = '<div class="loading-container"><div class="loading-spinner"></div><p>Loading trending mods...</p></div>';

        try
        {
            const data = await fetchJson(`/analytics/trending?days=${this.period}`);
            this.trending = data.trending;
            this.renderTrending();
        }
        catch (err)
        {
            console.error('Failed to load trending:', err);
            toast.error('Failed to load trending mods');
            listEl.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">Failed to load trending data</p>';
        }
    }

    renderTrending()
    {
        const listEl = document.getElementById('trending-list');
        if (!listEl)
            return;

        if (this.trending.length === 0)
        {
            listEl.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">No trending mods in this period</p>';
            return;
        }

        listEl.innerHTML = '';

        this.trending.forEach((item, index) => {
            const card = document.createElement('div');
            card.style.cssText = 'background: rgba(30, 18, 82, 0.4); padding: 1.5rem; margin-bottom: 1rem; border-radius: 12px; border-left: 4px solid var(--accent-blue); display: flex; align-items: center; gap: 1.5rem; transition: all 0.2s;';
            
            const rank = document.createElement('div');
            rank.style.cssText = 'font-size: 2rem; font-weight: 700; color: var(--accent-blue); min-width: 50px; text-align: center;';
            rank.textContent = `#${index + 1}`;
            card.appendChild(rank);

            const info = document.createElement('div');
            info.style.flex = '1';
            info.innerHTML = `
                <h3 style="margin: 0 0 0.5rem 0; color: var(--text-white);">
                    <a href="/mod.html?key=${encodeURIComponent(item.key)}" style="color: inherit; text-decoration: none;">${item.name}</a>
                </h3>
                <div style="display: flex; gap: 1.5rem; font-size: 0.875rem; color: var(--text-secondary);">
                    <span>${item.views} views</span>
                    <span>${item.downloads} downloads</span>
                    <span>${item.favourites} favorites</span>
                </div>
            `;
            card.appendChild(info);

            const score = document.createElement('div');
            score.style.cssText = 'text-align: right;';
            score.innerHTML = `
                <div style="font-size: 1.5rem;">🔥</div>
                <div style="font-size: 0.75rem; color: var(--text-secondary);">Score: ${item.score.toFixed(1)}</div>
            `;
            card.appendChild(score);

            card.addEventListener('mouseenter', () => {
                card.style.transform = 'translateY(-4px)';
                card.style.boxShadow = '0 8px 20px rgba(102, 126, 234, 0.3)';
            });

            card.addEventListener('mouseleave', () => {
                card.style.transform = 'translateY(0)';
                card.style.boxShadow = 'none';
            });

            listEl.appendChild(card);
        });
    }

    setupEventListeners()
    {
        const periodSelect = document.getElementById('period-select');
        if (periodSelect)
        {
            periodSelect.value = this.period;
            periodSelect.addEventListener('change', (e) => {
                this.period = parseInt(e.target.value);
                this.loadTrending();
            });
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const page = new TrendingPage();
    page.init();
});