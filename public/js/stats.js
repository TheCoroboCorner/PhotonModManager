import { fetchJson } from './utils.js';
import { toast } from './toast.js';

class StatsPage
{
    constructor()
    {
        this.data = null;
    }

    async init()
    {
        await this.loadData();
        this.renderOverview();
        this.renderTopAuthors();
        this.renderPopularTags();
        this.renderMostDownloaded();
    }

    async loadData()
    {
        try
        {
            this.data = await fetchJson('/data');
        }
        catch (err)
        {
            console.error('Failed to load data:', err);
            toast.error('Failed to load statistics');
        }
    }

    renderOverview()
    {
        const container = document.getElementById('overview-stats');
        if (!container || !this.data)
            return;

        const mods = Object.values(this.data).filter(m => m.type === 'Mod');
        const modpacks = Object.values(this.data).filter(m => m.type === 'Modpack');

        const totalViews = Object.values(this.data).reduce((sum, mod) => sum + (mod.analytics?.views || 0), 0);
        const totalDownloads = Object.values(this.data).reduce((sum, mod) => sum + (mod.analytics?.downloads || 0), 0);
        const totalFavourites = Object.values(this.data).reduce((sum, mod) => sum + (mod.favourites || 0), 0);

        const stats = [
            { label: 'Total Mods', value: mods.length, icon: '📦' },
            { label: 'Modpacks', value: modpacks.length, icon: '🎁' },
            { label: 'Total Views', value: totalViews.toLocaleString(), icon: '👁️' },
            { label: 'Total Downloads', value: totalDownloads.toLocaleString(), icon: '📥' },
            { label: 'Total Favourites', value: totalFavourites.toLocaleString(), icon: '❤️' }
        ];

        stats.forEach(stat => {
            const card = document.createElement('div');
            card.className = 'stat-card';
            card.innerHTML = `
                <div class="stat-card-icon">${stat.icon}</div>
                <div class="stat-card-value">${stat.value}</div>
                <div class="stat-card-label">${stat.label}</div>
            `;
            container.appendChild(card);
        });
    }

    renderTopAuthors()
    {
        const container = document.getElementById('top-authors');
        if (!container || !this.data)
            return;

        const authorStats = {};

        Object.values(this.data).forEach(mod => {
            const authors = Array.isArray(mod.author) ? mod.author : [mod.author];
            authors.forEach(author => {
                if (!authorStats[author])
                {
                    authorStats[author] = {
                        mods: 0,
                        downloads: 0,
                        favourites: 0,
                        views: 0,
                    }
                }

                authorStats[author].mods++;
                authorStats[author].downloads += mod.analytics?.downloads || 0;
                authorStats[author].favourites += mod.favourites || 0;
                authorStats[author].views += mod.analytics?.views || 0;
            });
        });

        const topAuthors = Object.entries(authorStats).sort((a, b) => {
            const viewScore = 0.25;
            const downloadScore = 0.75;
            const favouriteScore = 0.55;
            const modScore = 0.65;

            const aScoreFromViews = viewScore * a[1].views / a[1].mods;
            const aScoreFromDownloads = downloadScore * a[1].downloads / a[1].mods;
            const aScoreFromFavourites = favouriteScore * a[1].favourites / a[1].mods;
            const aScoreFromMods = modScore * a[1].mods;

            const bScoreFromViews = viewScore * b[1].views / b[1].mods;
            const bScoreFromDownloads = downloadScore * b[1].downloads / b[1].mods;
            const bScoreFromFavourites = favouriteScore * b[1].favourites / b[1].mods;
            const bScoreFromMods = modScore * b[1].mods;

            const viewDiff = bScoreFromViews - aScoreFromViews;
            const downloadDiff = bScoreFromDownloads - aScoreFromDownloads;
            const favouriteDiff = bScoreFromFavourites - aScoreFromFavourites;
            const modDiff = bScoreFromMods - aScoreFromMods;

            const totalDiff = viewDiff + downloadDiff + favouriteDiff + modDiff;
            
            return totalDiff;
        }).slice(0, 10);

        container.innerHTML = topAuthors.map(([author, stats], index) => `
            <div style="background: rgba(30, 18, 82, 0.4); padding: 1rem; margin-bottom: 0.5rem; border-radius: 8px; display: flex; align-items: center; gap: 1rem;">
                <div style="font-size: 1.5rem; font-weight: 700; color: var(--accent-blue); min-width: 40px;">#${index + 1}</div>
                <div style="flex: 1;">
                    <strong>${author}</strong><br>
                    <small style="color: var(--text-secondary);">${stats.mods} mods · ${stats.downloads} downloads · ${stats.favourites} favourites · ${stats.views} views</small>
                </div>
            </div>
        `).join('');
    }

    renderPopularTags()
    {
        const container = document.getElementById('popular-tags');
        if (!container || !this.data)
            return;

        const tagCounts = {};

        Object.values(this.data).forEach(mod => {
            if (Array.isArray(mod.tags))
            {
                mod.tags.forEach(tag => {
                    tagCounts[tag] = (tagCounts[tag] || 0) + 1;
                });
            }
        });

        const sortedTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 15);

        const maxCount = sortedTags[0]?.[1] || 1;

        container.innerHTML = `
            <div style="display: flex; flex-wrap: wrap; gap: 0.75rem;">
                ${sortedTags.map(([tag, count]) => {
                    const size = 0.8 + (count / maxCount) * 1.2; // 0.8rem to 2rem
                    return `
                        <a href="/browse?tag=${encodeURIComponent(tag)}" 
                           style="padding: 0.5rem 1rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 50px; font-size: ${size}rem; font-weight: 600; color: white; text-decoration: none; transition: all 0.2s;"
                           onmouseenter="this.style.transform='translateY(-2px) scale(1.1)'"
                           onmouseleave="this.style.transform='translateY(0) scale(1)'">
                            ${tag} <span style="opacity: 0.8;">(${count})</span>
                        </a>
                    `;
                }).join('')}
            </div>
        `;
    }

    renderMostDownloaded()
    {
        const container = document.getElementById('most-downloaded');
        if (!container || !this.data)
            return;

        const topMods = Object.entries(this.data).map(([key, mod]) => ({ key, ...mod })).sort((a, b) => (b.analytics?.downloads || 0) - (a.analytics?.downloads || 0)).slice(0, 10);

        container.innerHTML = topMods.map((mod, index) => `
            <div style="background: rgba(30, 18, 82, 0.4); padding: 1rem; margin-bottom: 0.5rem; border-radius: 8px; display: flex; align-items: center; gap: 1rem;">
                <div style="font-size: 1.5rem; font-weight: 700; color: var(--accent-blue); min-width: 40px;">#${index + 1}</div>
                <div style="flex: 1;">
                    <a href="/mod.html?key=${encodeURIComponent(mod.key)}" style="color: var(--text-white); text-decoration: none; font-weight: 600;">${mod.name}</a><br>
                    <small style="color: var(--text-secondary);">${mod.analytics?.downloads || 0} downloads · ${mod.analytics?.views || 0} views · ${mod.favourites || 0} favourites</small>
                </div>
            </div>
        `).join('');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const page = new StatsPage();
    page.init();
});