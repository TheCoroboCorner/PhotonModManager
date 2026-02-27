import { fetchJson, formatDate, formatAuthor, parseModKey, getUrlParams } from './utils.js';
import { favouritesManager } from './favourites.js';
import { collectVersionRanges } from './version.js';
import { ModpackParser } from './modpackParser.js';
import icons from './icons.js';

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

        await this.loadReleases();
        this.trackView();
        this.renderModDetails();
        this.renderDependencies();
        this.renderConflicts();
        this.renderVersionHistory();
        this.updateStatCards();
        this.renderRelatedMods();
        this.updateMetaTags();
        this.setupImageTab();
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

    async loadReleases()
    {
        try
        {
            const response = await fetch(`/api/version-history/${encodeURIComponent(this.modKey)}`);
        
            if (response.ok)
            {
                const data = await response.json();
                this.releases = data.versionHistory || [];
                console.log(`[ModDetail] Loaded ${this.releases.length} releases from cache`);
            }
        }
        catch (err)
        {
            console.error('Failed to load releases:', err);
            this.releases = [];
        }
    }

    renderImageGallery()
    {
        const container = document.getElementById('image-gallery-container');
        if (!container)
            return;

        console.log('[ModDetail] Rendering images:', this.mod.images);

        const images = this.mod.images || [];

        if (images.length === 0)
        {
            container.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 2rem;">No images have been uploaded for this mod.</p>';
            return;
        }

        const grid = document.createElement('div');
        grid.style.cssText = `
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
            gap: 1.5rem;
        `;

        this.mod.images.forEach((image, index) => {
            const card = this.createImageCard(image, index);
            grid.appendChild(card);
        });

        container.innerHTML = '';
        container.appendChild(grid);
        console.log('[ModDetail] Rendered', this.mod.images.length, 'images');
    }

    openLightbox(imagePath)
    {
        const lightbox = document.createElement('div');
        lightbox.className = 'lightbox';
        lightbox.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.95); display: flex; align-items: center; justify-content: center; z-index: 2000; animation: fadeIn 0.2s;';

        lightbox.innerHTML = `
            <img src="${imagePath}" style="max-width: 90%; max-height: 90%; object-fit: contain; border-radius: 8px;">
            <button style="position: absolute; top: 2rem; right: 2rem; background: rgba(255, 255, 255, 0.2); border: none; color: white; font-size: 2rem; width: 50px; height: 50px; border-radius: 50%; cursor: pointer; transition: background 0.2s; line-height: 1;">&times;</button>
        `;

        const closeBtn = lightbox.querySelector('button');
        closeBtn.addEventListener('mouseenter', () => closeBtn.style.background = 'rgba(255, 255, 255, 0.3)');

        closeBtn.addEventListener('mouseleave', () => closeBtn.style.background = 'rgba(255, 255, 255, 0.2)');

        closeBtn.addEventListener('click', () => {
            lightbox.style.animation = 'fadeOut 0.2s';
            setTimeout(() => lightbox.remove(), 200);
        });

        lightbox.addEventListener('click', (e) => {
            if (e.target === lightbox)
            {
                lightbox.style.animation = 'fadeOut 0.2s';
                setTimeout(() => lightbox.remove(), 200);
            }
        });

        document.body.appendChild(lightbox);
    }

    renderVersionHistory()
    {
        const container = document.getElementById('version-history-list');
        if (!container)
            return;

        if (this.releases.length === 0)
        {
            container.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 2rem;">No release history available</p>';
            return;
        }

        container.innerHTML = '';

        this.releases.forEach((release, index) => {
            const item = document.createElement('div');
            item.style.cssText = 'background: rgba(30, 18, 82, 0.4); padding: 1.5rem; margin-bottom: 1rem; border-radius: 8px; border-left: 4px solid var(--accent-blue);';
            
            const isLatest = index === 0;
            const badge = isLatest ? '<span style="background: linear-gradient(135deg, #4BC292 0%, #56A887 100%); padding: 0.25rem 0.75rem; border-radius: 50px; font-size: 0.75rem; color: white; margin-left: 0.5rem; font-weight: 700;">LATEST</span>' : '';
            
            const releaseBody = release.body || '';
            const normalized = releaseBody.replace(/\\n/g, '\n').replace(/\\r/g, '');
            const lines = normalized.split('\n');
            const needsCollapse = lines.length > 5;
            
            const releaseId = `release-${index}`;
            
            item.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem;">
                    <h4 style="margin: 0; color: var(--text-white);">${release.tag}${badge}</h4>
                    <span style="color: var(--text-secondary); font-size: 0.875rem;">${formatDate(release.publishedAt)}</span>
                </div>
                ${release.name && release.name !== release.tag ? `<p style="margin: 0.5rem 0; color: var(--text-light); font-weight: 600;">${release.name}</p>` : ''}
                ${releaseBody ? `
                    <div id="${releaseId}" class="release-body collapsed" style="margin-top: 0.75rem; color: var(--text-secondary); font-size: 0.875rem; line-height: 1.6;">
                        ${this.renderMarkdown(releaseBody)}
                    </div>
                    ${needsCollapse ? `
                        <button class="read-more-btn" data-target="${releaseId}">
                            Read more
                        </button>
                    ` : ''}
                ` : ''}
                <div style="margin-top: 1rem; display: flex; gap: 1rem; flex-wrap: wrap; align-items: center;">
                    <a href="${release.htmlUrl}" target="_blank" class="click-me mod-download" style="padding: 0.5rem 1rem; height: auto; font-size: 0.875rem; text-decoration: none;">
                        View on GitHub
                    </a>
                    ${release.assets && release.assets.length > 0 ? `<span style="font-size: 0.875rem; color: var(--text-secondary);"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg> ${release.assets.length} asset${release.assets.length > 1 ? 's' : ''}</span>` : ''}
                    ${release.prerelease ? '<span style="color: var(--accent-purple); font-size: 0.875rem;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path></svg> Pre-release</span>' : ''}
                </div>
            `;

            const download = item.querySelector('.mod-download');
            download.addEventListener('click', async (e) => fetch(`/analytics/download/${encodeURIComponent(this.modKey)}`, { method: 'POST', keepalive: true }));

            container.appendChild(item);

            if (needsCollapse)
            {
                const btn = item.querySelector('.read-more-btn');
                const bodyDiv = document.getElementById(releaseId);
                let isExpanded = false;

                btn.addEventListener('click', () => {
                    isExpanded = !isExpanded;
                    
                    const collapsedHeight = 8 * 1.6 * 16; // 8rem

                    if (isExpanded)
                    {
                        bodyDiv.style.maxHeight = bodyDiv.scrollHeight + 'px';
                        btn.textContent = 'Read less';
                    }
                    else
                    {
                        bodyDiv.style.maxHeight = collapsedHeight + 'px';
                        btn.textContent = 'Read more';
                    }
                });
            }
        });
    }

    renderMarkdown(markdown)
    {
        if (!markdown)
            return;

        return markdown
            // Just in case because I can't figure out what's wrong
            .replace(/\\n/g, '\n')
            .replace(/\\r/g, '')
            .replace(/\\t/g, '    ')
            .replace(/\\"/g, '"')
            .replace(/\\\\/g, '\\')
            // Headers
            .replace(/^### (.*$)/gim, '<h4 style="margin: 0.5rem 0;">$1</h4>')
            .replace(/^## (.*$)/gim, '<h3 style="margin: 0.5rem 0;">$1</h3>')
            .replace(/^# (.*$)/gim, '<h2 style="margin: 0.5rem 0;">$1</h2>')
            // Bold
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            // Italic
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            // Code
            .replace(/`(.*?)`/g, '<code style="background: rgba(0,0,0,0.3); padding: 0.2rem 0.4rem; border-radius: 4px;">$1</code>')
            // Links
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" style="color: var(--accent-blue);">$1</a>')
            // Line breaks
            .replace(/\n/g, '<br>');
    }

    renderFavouriteButton()
    {
        const container = document.getElementById('mod-favourites-container');
        if (!container)
            return;

        container.innerHTML = '';
        const favBtn = favouritesManager.createFavouriteButton(this.modKey, this.mod.favourites);
        
        favBtn.style.cssText = 'width: auto; height: 64px; padding: 1rem 2rem; font-size: 1rem;';

        const heartIcon = icons.create('heart-filled', { size: 20, color: 'white' });
        favBtn.insertBefore(heartIcon, favBtn.firstChild);
        
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
        tagBar.style.marginBottom = "2rem";

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
        a.addEventListener('click', async (e) => fetch(`/analytics/download/${encodeURIComponent(this.modKey)}`, { method: 'POST', keepalive: true }));
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
            
            html += this.renderMarkdown(this.mod.readme);
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

        const downloads = this.mod.analytics?.downloads || 0;
        this.setElementText('stat-downloads', downloads);
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

    createImageCard(image, index)
    {
        const card = document.createElement('div');
        card.style.cssText = `
            position: relative;
            border-radius: 12px;
            overflow: hidden;
            border: 2px solid ${image.isThumbnail ? 'var(--accent-blue)' : 'rgba(102, 126, 234, 0.2)'};
            transition: all 0.3s;
            cursor: pointer;
            animation: fadeIn 0.3s ease;
        `;

        const img = document.createElement('img');
        img.src = image.path;
        img.alt = image.originalName || `Screenshot ${index + 1}`;
        img.style.cssText = 'width: 100%; aspect-ratio: 16/9; object-fit: cover; display: block;';
        
        img.onload = () => console.log('[ModDetail] ✅ Image loaded:', image.path);
        
        img.onerror = () => {
            console.error('[ModDetail] Failed to load image:', image.path);
            card.innerHTML = `
                <div style="aspect-ratio: 16/9; display: flex; align-items: center; justify-content: center; background: rgba(255, 59, 48, 0.1); color: var(--text-secondary);">
                    <div style="text-align: center;">
                        <div style="font-size: 2rem;">❌</div>
                        <div style="font-size: 0.875rem; margin-top: 0.5rem;">Failed to load</div>
                    </div>
                </div>
            `;
        };

        card.appendChild(img);

        if (image.isThumbnail)
        {
            const badge = document.createElement('div');
            badge.innerHTML = '';
            const starIcon = icons.create('star-filled', { size: 14, color: 'white' });
            badge.appendChild(starIcon);
            badge.appendChild(document.createTextNode('Thumbnail'));
            badge.style.display = 'inline-flex';
            badge.style.alignItems = 'center';
            badge.style.gap = '0.25rem';
            badge.style.cssText = `
                position: absolute;
                top: 0.5rem;
                right: 0.5rem;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 0.25rem 0.75rem;
                border-radius: 50px;
                font-size: 0.75rem;
                font-weight: 600;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
            `;
            card.appendChild(badge);
        }

        card.addEventListener('click', () => this.openLightbox(image.path));

        card.addEventListener('mouseenter', () => {
            card.style.transform = 'scale(1.05)';
            card.style.boxShadow = '0 8px 20px rgba(102, 126, 234, 0.3)';
        });

        card.addEventListener('mouseleave', () => {
            card.style.transform = 'scale(1)';
            card.style.boxShadow = 'none';
        });

        return card;
    }

    setupImageTab()
    {
        const imagesTab = document.querySelector('[data-tab="images"]');
        if (imagesTab)
            imagesTab.addEventListener('click', () => this.renderImageGallery());
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

        card.addEventListener('mouseleave', () => {
            card.style.transform = 'translateY(0)';
            card.style.borderColor = 'rgba(102, 126, 234, 0.2)';
            card.style.boxShadow = 'none';
        });

        card.addEventListener('click', () => window.location.href = `/mod.html?key=${encodeURIComponent(mod.key)}`);

        const statsContainer = document.createElement('div');
        statsContainer.style.cssText = 'display: flex; gap: 0.5rem; align-items: center; font-size: 0.75rem; color: var(--text-secondary);';
        
        const heartIcon = icons.create('heart-filled', { size: 12, color: 'rgba(255, 59, 118, 0.8)' });
        const favSpan = document.createElement('span');
        favSpan.style.cssText = 'display: inline-flex; align-items: center; gap: 0.25rem;';
        favSpan.appendChild(heartIcon);
        favSpan.appendChild(document.createTextNode(mod.favourites || 0));
        
        statsContainer.appendChild(favSpan);
        
        if (mod.tags && mod.tags.length > 0) 
        {
            const separator = document.createElement('span');
            separator.textContent = '•';
            statsContainer.appendChild(separator);
            
            const tagIcon = icons.create('tags', { size: 12, color: 'rgba(102, 126, 234, 0.8)' });
            const tagSpan = document.createElement('span');
            tagSpan.style.cssText = 'display: inline-flex; align-items: center; gap: 0.25rem;';
            tagSpan.appendChild(tagIcon);
            tagSpan.appendChild(document.createTextNode(mod.tags.length));
            
            statsContainer.appendChild(tagSpan);
        }
        
        card.innerHTML = `
            <h4 style="margin: 0 0 0.5rem 0; color: var(--text-white); font-size: 1rem;">${mod.name}</h4>
            <p style="margin: 0 0 0.5rem 0; font-size: 0.875rem; color: var(--text-secondary); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
                ${mod.description || 'No description'}
            </p>
        `;
        
        card.appendChild(statsContainer);

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
        githubLink.addEventListener('click', async (e) => fetch(`/analytics/download/${encodeURIComponent(this.modKey)}`, { method: 'POST', keepalive: true }));

        const wikiLink = document.getElementById('mod-wiki');

        if (githubLink)
            githubLink.href = `https://github.com/${owner}/${repo}`;

        if (wikiLink)
            wikiLink.href = `/wiki?mod=${this.modKey}`;

        const externalWikiLink = document.getElementById('mod-external-wiki');
        if (externalWikiLink && this.mod.externalWiki)
        {
            externalWikiLink.href = this.mod.externalWiki;
            externalWikiLink.style.display = 'inline-block';

            try
            {
                const url = new URL(this.mod.externalWiki);
                const domain = url.hostname.replace('www.', '');
                externalWikiLink.innerHTML = domain;
            }
            catch
            {
                externalWikiLink.textContent = 'Official Wiki';
            }
        }
        else if (externalWikiLink)
            externalWikiLink.style.display = 'none';
    }

    setMeta(name, content)
    {
        let meta = document.querySelector(`meta[name="${name}"]`) || document.querySelector(`meta[property="${name}"]`);
        if (!meta)
        {
            meta = document.createElement('meta');
            if (name.startsWith('og:') || name.startsWith('twitter:'))
                meta.setAttribute('property', name);
            else
                meta.setAttribute('name', name);

            document.head.appendChild(meta);
        }

        meta.setAttribute('content', content);
    }

    updateMetaTags()
    {
        if (!this.mod)
            return;

        document.title = `${this.mod.name} - Photon`;

        this.setMeta('description', this.mod.description || 'An unnamed yet typical Balatro mod');
        this.setMeta('og:title', `${this.mod.name} - Photon Mod Manager`);
        this.setMeta('og:description', this.mod.description || 'An undescribed yet typical Balatro mod description.');
        this.setMeta('og:url', window.location.href);
        this.setMeta('twitter:title', `${this.mod.name} - Photon`);
        this.setMeta('twitter:description', this.mod.description || 'An undescribed yet typical Balatro mod description.');
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