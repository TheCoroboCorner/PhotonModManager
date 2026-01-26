import { fetchJson, formatDate, formatAuthor, parseModKey, getUrlParams } from './utils.js';
import { favouritesManager } from './favourites.js';
import { collectVersionRanges } from './version.js';

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

        this.renderModDetails();
        this.renderDependencies();
        this.renderConflicts();
        this.updateStatCards();
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