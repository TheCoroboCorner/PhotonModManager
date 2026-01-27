import { fetchJson, formatDate, formatAuthor, parseModKey, getUrlParams } from './utils.js';
import { favouritesManager } from './favourites.js';
import { collectVersionRanges } from './version.js';
import { ModpackParser } from './modpackParser.js';

class ModDetailPage
{
    constructor()
    {
        this.modKey = null;
        this.mod = null;
        this.allMods = null;
    }

    async init()
    {
        this.extractModKey();
        if (!this.modKey)
        {
            this.showError('No mod key provided');
            return;
        }

        await this.loadData();
        if (!this.mod)
        {
            this.showError(`No entry for ${this.modKey}`);
            return;
        }

        this.trackView();
        this.renderModDetails();
        this.renderDependencies();
        this.renderConflicts();
        this.updateStatCards();
        this.renderRelatedMods();
    }

    showError(message)
    {
        const hero = document.querySelector('.mod-hero h1');
        if (hero)
            hero.textContent = `Error: ${message}`;
    }

    setElementText(id, text)
    {
        const element = document.getElementById(id);
        if (element)
            element.textContent = text;
    }

    setElementHTML(id, html)
    {
        const element = document.getElementById(id);
        if (element)
            element.innerHTML = html;
    }

    async trackView()
    {
        try
        {
            await fetch(`/analytics/view/${encodeURIComponent(this.modKey)}`, { method: 'POST' });
        }
        catch (err)
        {
            console.error('Failed to track view:', err);
        }
    }

    renderFavouriteButton()
    {
        const container = document.getElementById('mod-favourites-container');
        if (!container)
            return;

        container.innerHTML = '';
        const favBtn = favouritesManager.createFavouriteButton(this.modKey, this.mod.favourites);
        
        favBtn.style.cssText = 'width: auto; height: 64px; padding: 1rem 2rem; font-size: 1rem;';

        const icon = document.createElement('span');
        icon.textContent = '❤️';
        favBtn.insertBefore(icon, favBtn.firstChild);
        
        container.appendChild(favBtn);
    }

    renderTags()
    {
        const container = document.getElementById('mod-tags');
        if (!container)
            return;

        container.innerHTML = '';
        const tagBar = document.createElement('div');
        tagBar.className = 'tag-bar';

        const tags = Array.isArray(this.mod.tags) ? this.mod.tags : [];
        tags.forEach(tag => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = tag;
            btn.className = 'tag-btn';
            btn.addEventListener('click', () => {
                window.location.href = `/browse?tag=${encodeURIComponent(tag)}`;
            });

            tagBar.appendChild(btn);
        });

        container.appendChild(tagBar);
    }

    downloadModpackFile()
    {
        if (!this.mod.mods || this.mod.mods.length === 0)
        {
            toast.error('There aren\'t any mods in this modpack!');
            return;
        }

        const metadata = {
            name: this.mod.name,
            author: Array.isArray(this.mod.author) ? this.mod.author.join(', ') : this.mod.author,
            description: this.mod.description || '',
            tags: this.mod.tags || []
        };

        const fileContent = ModpackParser.createModpackFile(metadata, this.mod.mods);

        const blob = new Blob([fileContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.mod.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.modpack`;
        a.click();
        URL.revokeObjectURL(url);

        toast.success('Modpack file downloaded!');
    }

    renderOverview()
    {
        const overviewTab = document.getElementById('tab-overview');
        if (!overviewTab)
            return;

        let overviewContent = overviewTab.querySelector('.overview-content');
        if (!overviewContent)
        {
            overviewContent = document.createElement('div');
            overviewContent.className = 'overview-content';
            overviewTab.appendChild(overviewContent);
        }

        let html = '';

        if (this.mod.type === 'Modpack' && Array.isArray(this.mod.mods))
        {
            html += '<div class="overview-section" style="margin-bottom: 2rem;">';
            html += '<h3 style="color: var(--text-white); margin-bottom: 1rem;">Modpack Contents</h3>';
            html += '<div style="background: rgba(30, 18, 82, 0.4); padding: 1rem; border-radius: 8px; border-left: 3px solid var(--accent-blue);">';
            html += `<p><strong>Total Mods:</strong> ${this.mod.mods.length}</p>`;
            html += '<ul style="margin: 0.5rem 0; padding-left: 1.5rem;">';
            
            this.mod.mods.forEach(mod => {
                const modData = this.allMods[mod.key];
                const name = modData?.name || mod.key;
                html += `<li>${name} <small style="color: var(--text-secondary);">(${mod.version})</small></li>`;
            });
            
            html += '</ul>';
            
            html += `<button id="download-modpack-btn" class="click-me" style="margin-top: 1rem; padding: 0.75rem 1.5rem; height: auto; width: 100%;">Download Modpack File</button>`;
            
            html += '</div></div>';
        }

        if (this.mod.version || this.mod.target_version)
        {
            html += '<div class="overview-section" style="margin-bottom: 2rem;">';
            html += '<h3 style="color: var(--text-white); margin-bottom: 1rem;">Version Information</h3>';
            html += '<div style="background: rgba(30, 18, 82, 0.4); padding: 1rem; border-radius: 8px; border-left: 3px solid var(--accent-blue);">';
            
            if (this.mod.version)
                html += `<p><strong>Current Version:</strong> ${this.mod.version}</p>`;
            
            if (this.mod.target_version)
                html += `<p><strong>Target Game Version:</strong> ${this.mod.target_version}</p>`;
            
            html += '</div></div>';
        }

        if (this.mod.readme)
        {
            html += '<div class="overview-section">';
            html += '<h3 style="color: var(--text-white); margin-bottom: 1rem;">README</h3>';
            html += '<div style="background: rgba(30, 18, 82, 0.4); padding: 1.5rem; border-radius: 8px; line-height: 1.8; max-height: 500px; overflow-y: auto;">';
            
            let readmeHtml = this.mod.readme
                .replace(/\n\n/g, '</p><p>')
                .replace(/\n/g, '<br>')
                .replace(/^/, '<p>')
                .replace(/$/, '</p>');
            
            html += readmeHtml;
            html += '</div></div>';
        }

        overviewContent.innerHTML = html;

        if (this.mod.type === 'Modpack')
        {
            const downloadBtn = document.getElementById('download-modpack-btn');
            if (downloadBtn)
                downloadBtn.addEventListener('click', () => this.downloadModpackFile());
        }
    }

    createVersionRangeItem(rawStr, vRange)
    {
        const li = document.createElement('li');
        li.style.cssText = 'padding: 1rem; margin-bottom: 0.5rem; background: rgba(30, 18, 82, 0.4); border-radius: 8px; border-left: 3px solid var(--accent-blue);';

        const modName = rawStr.split(/\s*\(/)[0];

        // Get the mod key
        const foundKey = Object.keys(this.allMods).find(k => this.allMods[k].id === modName || this.allMods[k].name === modName);

        const titleContainer = document.createElement('div');
        titleContainer.style.cssText = 'display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;';

        // Create title
        let titleNode;
        if (foundKey)
        {
            titleNode = document.createElement('a');
            titleNode.href = `/mod.html?key=${encodeURIComponent(foundKey)}`;
            titleNode.textContent = modName;
            titleNode.style.cssText = 'color: var(--accent-blue); font-weight: 600;';
        }
        else 
        {
            titleNode = document.createElement('strong');
            titleNode.textContent = modName;
            titleNode.style.color = 'var(--text-primary)';
        }

        titleContainer.appendChild(titleNode);
        li.appendChild(titleContainer);

        // Version range
        const rangeDiv = document.createElement('div');
        rangeDiv.style.cssText = 'color: var(--text-secondary); font-size: 0.875rem; margin-left: 1.5rem;';
        rangeDiv.textContent = `Version: ${vRange.toString()}`;
        li.appendChild(rangeDiv);

        return li;
    }

    renderVersionRangeList(rangeMap, listId)
    {
        const ul = document.getElementById(listId);
        if (!ul)
            return;

        ul.innerHTML = '';

        if (rangeMap.size === 0)
        {
            const emptyLi = document.createElement('li');
            emptyLi.style.cssText = 'padding: 1rem; text-align: center; color: var(--text-secondary);';
            emptyLi.innerHTML = '<em>None</em>';
            ul.appendChild(emptyLi);
            return;
        }

        for (const [rawStr, vRange] of rangeMap)
        {
            const li = this.createVersionRangeItem(rawStr, vRange);
            ul.appendChild(li);
        }
    }

    renderDependencies()
    {
        const depRanges = collectVersionRanges('dependencies', this.modKey, this.allMods);
        this.renderVersionRangeList(depRanges, 'dep-list');
    }

    renderConflicts()
    {
        const confRanges = collectVersionRanges('conflicts', this.modKey, this.allMods);
        this.renderVersionRangeList(confRanges, 'conf-list');
    }

    updateStatCards()
    {
        this.setElementText('stat-favourites', this.mod.favourites || 0);

        const date = new Date(this.mod.published_at);
        const shortDate = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
        this.setElementText('stat-published', shortDate);

        const depCount = Array.isArray(this.mod.dependencies) ? this.mod.dependencies.length : 0;
        this.setElementText('stat-deps', depCount);

        const confCount = Array.isArray(this.mod.conflicts) ? this.mod.conflicts.length : 0;
        this.setElementText('stat-conflicts', confCount);

        const views = this.mod.analytics?.views || 0;
        this.setElementText('stat-views', views);
    }

    findRelatedMods(limit = 5)
    {
        const currentTags = this.mod.tags || [];
        const currentAuthor = Array.isArray(this.mod.author) ? this.mod.author : [this.mod.author];

        const scored = Object.entries(this.allMods).filter(([key]) => key !== this.modKey).map(([key, mod]) => {
            let score = 0;

            const sameAuthorBonus = 10;
            const sameTagBonus = 3;
            const dependencyBonus = 5;

            const modAuthor = Array.isArray(mod.author) ? mod.author : [mod.author];
            if (currentAuthor.some(a => modAuthor.includes(a)))
                score += sameAuthorBonus;

            const modTags = mod.tags || [];
            const sharedTags = currentTags.filter(tag => modTags.includes(tag));
            score += sharedTags.length * sameTagBonus;

            if (Array.isArray(this.mod.dependencies))
            {
                const depIds = this.mod.dependencies.map(d => {
                    if (typeof d === 'string')
                        return d.split(/\s*\(/)[0];

                    return d.key;
                });

                if (depIds.includes(mod.id))
                    score += dependencyBonus;
            }

            return { key, mod, score };
        }).filter(item => item.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);

        return scored.map(item => ({ ...item.mod, key: item.key }));
    }

    createRelatedModCard(mod)
    {
        const card = document.createElement('div');
        card.style.cssText = 'background: rgba(30, 18, 82, 0.4); padding: 1rem; border-radius: 8px; border: 1px solid rgba(102, 126, 234, 0.2); transition: all 0.2s; cursor: pointer;';

        card.addEventListener('mouseenter', () => {
            card.style.transform = 'translateY(-4px)';
            card.style.borderColor = 'rgba(102, 126, 234, 0.5)';
            card.style.boxShadow = '0 8px 20px rgba(102, 126, 234, 0.3)';
        });

        card.addEventListener('mouseenter', () => {
            card.style.transform = 'translateY(0)';
            card.style.borderColor = 'rgba(102, 126, 234, 0.2)';
            card.style.boxShadow = 'none';
        });

        card.addEventListener('click', () => {
            window.location.href = `/mod.html?key=${encodeURIComponent(mod.key)}`;
        });

        card.innerHTML = `
            <h4 style="margin: 0 0 0.5rem 0; color: var(--text-white); font-size: 1rem;">${mod.name}</h4>
            <p style="margin: 0 0 0.5rem 0; font-size: 0.875rem; color: var(--text-secondary); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
                ${mod.description || 'No description'}
            </p>
            <div style="display: flex; gap: 0.5rem; align-items: center; font-size: 0.75rem; color: var(--text-secondary);">
                <span>❤️ ${mod.favourites || 0}</span>
                ${mod.tags ? `<span>•</span><span>🏷️ ${mod.tags.length}</span>` : ''}
            </div>
        `;

        return card;
    }

    renderRelatedMods()
    {
        const container = document.getElementById('related-mods-grid');
        if (!container)
            return;

        container.innerHTML = '';

        const related = this.findRelatedMods(5);
        if (related.length === 0)
        {
            container.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; color: var(--text-secondary);">No related mods found.</p>';
            return;
        }

        related.forEach(mod => {
            const card = this.createRelatedModCard(mod);
            container.appendChild(card);
        });
    }

    renderModDetails()
    {
        // Basic information
        this.setElementText('mod-name', this.mod.name);
        this.setElementText('mod-author', formatAuthor(this.mod.author));
        this.setElementText('mod-description', this.mod.description);

        // Favourites
        this.renderFavouriteButton();

        // Tags
        this.renderTags();

        // README
        this.renderOverview();

        // Links
        const { repo, owner } = parseModKey(this.modKey);
        const githubLink = document.getElementById('mod-github');
        const wikiLink = document.getElementById('mod-wiki');

        if (githubLink)
            githubLink.href = `https://github.com/${owner}/${repo}`;

        if (wikiLink)
            wikiLink.href = `/wiki?mod=${this.modKey}`;
    }

    extractModKey()
    {
        const params = getUrlParams();
        this.modKey = params.get('key');
    }    

    async loadData()
    {
        try
        {
            this.allMods = await fetchJson('/data');
            this.mod = this.allMods[this.modKey];
        }
        catch (err)
        {
            console.error('Failed to load mod data', err);
            this.showError('Failed to load mod data');
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const detailPage = new ModDetailPage();
    detailPage.init();
});