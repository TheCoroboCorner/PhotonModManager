import { fetchJson, formatDate, formatAuthor, parseModKey, getUrlParams } from './utils.js';
import { favouritesManager } from './favourites.js';

class ScrollAnimationObserver
{
    constructor()
    {
        this.observer = null;
        this.init();
    }

    init()
    {
        const options = {
            root: null,
            rootMargin: '0px 0px -100px 0px',
            threshold: 0.05
        };

        this.observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting)
                {
                    entry.target.classList.add('visible');
                    this.observer.unobserve(entry.target);
                }
            });
        }, options);
    }

    observe(elements)
    {
        elements.forEach(element => {
            this.observer.observe(element);
        });
    }

    disconnect()
    {
        if (this.observer)
            this.observer.disconnect();
    }
}

let animationObserver = null;

export function initScrollAnimations()
{
    if (!animationObserver)
        animationObserver = new ScrollAnimationObserver();

    const modCards = document.querySelectorAll('.mod-card');
    if (modCards.length > 0)
        animationObserver.observe(modCards);
}

class ModBrowser
{
    constructor()
    {
        this.mods = [];
        this.allTags = new Set();
        this.params = {
            sortBy: 'published_at',
            order: 'desc',
            tag: '',
            limit: null
        };
    }

    async init()
    {
        await this.loadMods();
        this.extractUrlParams();
        this.updateUIControls();
        this.extractAllTags();
        this.populateTagFilter();
        this.renderMods();
    }

    async loadMods()
    {
        try
        {
            this.mods = await fetchJson('/data');
        }
        catch (err)
        {
            console.error('Failed to load mods:', err);
            alert('Failed to load mod data');
        }
    }

    extractUrlParams()
    {
        const params = getUrlParams();
        this.params.sortBy = params.get('sortBy') || 'published_at';
        this.params.order = params.get('order') || 'desc';
        this.params.tag = params.get('tag') || '';

        const isIndex = window.location.pathname === '/' || window.location.pathname === '/index.html';
        this.params.limit = isIndex ? 5 : null;
    }

    updateUIControls()
    {
        const sortSelect = document.querySelector('select[name="sortBy"]');
        const orderSelect = document.querySelector('select[name="order"]');
        const tagSelect = document.querySelector('select[name="tag"]');

        if (sortSelect)
            sortSelect.value = this.params.sortBy;
        if (orderSelect)
            orderSelect.value = this.params.order;
        if (tagSelect)
            tagSelect.value = this.params.tag;
    }

    extractAllTags()
    {
        Object.values(this.mods).forEach(mod => {
            if (Array.isArray(mod.tags))
                mod.tags.forEach(tag => this.allTags.add(tag));
        });
    }

    populateTagFilter()
    {
        const tagSelect = document.querySelector('select[name="tag"]');
        if (!tagSelect || tagSelect.options.length > 1)
            return;

        tagSelect.innerHTML = '';

        // Add 'All' option
        const defaultOpt = document.createElement('option');
        defaultOpt.value = '';
        defaultOpt.textContent = 'All';
        if (!this.params.tag)
            defaultOpt.selected = true;
        
        tagSelect.appendChild(defaultOpt);

        // Add tag options
        Array.from(this.allTags).sort().forEach(tag => {
            const opt = document.createElement('option');
            opt.value = tag;
            opt.textContent = tag.charAt(0).toUpperCase() + tag.slice(1);

            if (tag === this.params.tag)
                opt.selected = true;

            tagSelect.appendChild(opt);
        });
    }

    getFilteredAndSortedMods()
    {
        let entries = Object.entries(this.mods).map(([key, mod]) => ({ key, ...mod }));

        // Filter by tag
        if (this.params.tag)
            entries = entries.filter(mod => Array.isArray(mod.tags) && mod.tags.includes(this.params.tag));

        // Sort
        entries.sort((a, b) => {
            let diff;
            if (this.params.sortBy === 'favourites')
                diff = b.favourites - a.favourites;
            else
                diff = Date.parse(b.published_at) - Date.parse(a.published_at);

            return this.params.order === 'asc' ? -diff : diff;
        });

        // Apply the mod display limit
        if (this.params.limit)
            entries = entries.slice(0, this.params.limit);

        return entries;
    }

    createTagBar(tags)
    {
        const tagBar = document.createElement('div');
        tagBar.className = 'tag-bar';

        tags.forEach(tag => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = tag;
            btn.className = 'tag-btn';
            btn.addEventListener('click', () => {
                const params = getUrlParams();
                params.set('tag', tag);
                window.location.search = params.toString();
            });

            tagBar.appendChild(btn);
        });

        return tagBar;
    }

    createModListItem(mod)
    {
        const li = document.createElement('li');
        li.className = 'mod-card';
        const { repo, owner } = parseModKey(mod.key);

        // Card header
        const header = document.createElement('div');
        header.className = 'mod-card-header';

        const titleLink = document.createElement('a');
        titleLink.href = `mod.html?key=${encodeURIComponent(mod.key)}`;
        titleLink.innerHTML = `<h3 class="mod-card-title">${mod.name ?? 'Unknown'}</h3>`;

        header.appendChild(titleLink);
        li.appendChild(header);

        // Card author
        const author = document.createElement('div');
        author.className = 'mod-card-author';
        author.textContent = `by ${formatAuthor(mod.author) ?? 'Unknown'}`;
        li.appendChild(author);

        // Card description
        const description = document.createElement('p');
        description.className = 'mod-card-description';
        description.textContent = mod.description ?? 'No description';
        li.appendChild(description);

        // Card metadata (published, type)
        const meta = document.createElement('div');
        meta.className = 'mod-card-meta';
        meta.innerHTML = `
            <span class="mod-card-meta-item">
                Date: ${formatDate(mod.published_at) ?? 'Unknown'}
            </span>
            <span class="mod-card-meta-item">
                Type: ${mod.type ?? 'Unknown'}
            </span>
        `;
        li.appendChild(meta);

        // Card favourite button
        const favBtn = favouritesManager.createFavouriteButton(mod.key, mod.favourites);
        favBtn.style.width = '100%';
        favBtn.style.marginBottom = '1rem';
        li.appendChild(favBtn);

        // Card tags
        const tagBar = this.createTagBar(mod.tags || []);
        li.appendChild(tagBar);

        // GitHub link
        const githubLink = document.createElement('a');
        githubLink.href = `https://github.com/${owner}/${repo}`;
        githubLink.target = '_blank';
        githubLink.textContent = 'View on GitHub';
        githubLink.style.display = 'block';
        githubLink.style.marginTop = '1rem';
        githubLink.style.fontSize = '0.875rem';
        li.appendChild(githubLink);

        return li;
    }

    renderMods()
    {
        const ul = document.getElementById('mod-list');
        if (!ul)
            return;

        ul.className = 'mod-grid';
        ul.innerHTML = '';

        const entries = this.getFilteredAndSortedMods();

        if (entries.length === 0)
        {
            const emptyMessage = document.createElement('p');
            emptyMessage.textContent = 'No mods found matching your filters.';
            emptyMessage.className = 'fade-in';
            emptyMessage.style.gridColumn = '1 / -1';
            emptyMessage.style.textAlign = 'center';
            emptyMessage.style.padding = '2rem';
            emptyMessage.style.color = 'var(--text-secondary)';
            
            ul.appendChild(emptyMessage);
            return;
        }

        entries.forEach(mod => {
            const li = this.createModListItem(mod);
            ul.appendChild(li);
        });

        initScrollAnimations();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const browser = new ModBrowser();
    browser.init();
});