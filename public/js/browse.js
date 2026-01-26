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
            rootMargin: '200px 0px 0px 0px',
            threshold: 0
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
            author: '',
            search: '',
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
        this.setupSearchListener();
        this.setupClearFilters();
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
        this.params.author = params.get('author') || '';
        this.params.search = params.get('search') || '';

        const isIndex = window.location.pathname === '/' || window.location.pathname === '/index.html';
        this.params.limit = isIndex ? 5 : null;
    }

    updateActiveFilters()
    {
        const container = document.getElementById('active-filters');
        const tagsContainer = document.getElementById('filter-tags');

        if (!container || !tagsContainer)
            return;

        const filters = [];

        if (this.params.tag)
            filters.push({ type: 'Tag', value: this.params.tag, param: 'tag' });
        if (this.params.author)
            filters.push({ type: 'Author', value: this.params.author, param: 'author' });
        if (this.params.search)
            filters.push({ type: 'Search', value: this.params.search, param: 'search' });

        if (filters.length === 0)
        {
            container.style.display = 'none';
            return;
        }

        container.style.display = 'block';
        tagsContainer.innerHTML = '';

        filters.forEach(filter => {
            const tag = document.createElement('span');
            tag.style.cssText = 'display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.375rem 0.75rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 50px; font-size: 0.875rem; color: white; font-weight: 600;';
            tag.innerHTML = `
                ${filter.type}: ${filter.value}
                <button type="button" style="background: none; border: none; color: white; cursor: pointer; font-size: 1.1rem; padding: 0; margin: 0; line-height: 1;">&times;</button>
            `;

            tag.querySelector('button').addEventListener('click', () => {
                const params = getUrlParams();
                params.delete(filter.param);
                window.location.search = params.toString();
            });

            tagsContainer.appendChild(tag);
        });
    }

    updateUIControls()
    {
        const sortSelect = document.querySelector('select[name="sortBy"]');
        const orderSelect = document.querySelector('select[name="order"]');
        const tagSelect = document.querySelector('select[name="tag"]');
        const authorInput = document.getElementById('author-filter');
        const searchInput = document.getElementById('search-input');

        if (sortSelect)
            sortSelect.value = this.params.sortBy;
        if (orderSelect)
            orderSelect.value = this.params.order;
        if (tagSelect)
            tagSelect.value = this.params.tag;
        if (authorInput)
            authorInput.value = this.params.author;
        if (searchInput)
            searchInput.value = this.params.search;

        this.updateActiveFilters();
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

        // Filter by author
        if (this.params.author)
        {
            entries = entries.filter(mod => {
                const authors = Array.isArray(mod.author) ? mod.author : [mod.author];
                return authors.some(a => String(a).toLowerCase() === this.params.author.toLowerCase());
            });
        }

        // Filter by search
        if (this.params.search)
        {
            const searchLower = this.params.search.toLowerCase();

            entries = entries.filter(mod => {
                const nameMatch = (mod.name || '').toLowerCase().includes(searchLower);
                const descMatch = (mod.description || '').toLowerCase().includes(searchLower);

                const authors = Array.isArray(mod.author) ? mod.author : [mod.author];
                const authorMatch = authors.some(a => String(a).toLowerCase().includes(searchLower));

                return nameMatch || descMatch || authorMatch;
            });
        }

        // Sort
        entries.sort((a, b) => {
            let diff;
            if (this.params.sortBy === 'favourites')
                diff = b.favourites - a.favourites;
            else if (this.params.sortBy === 'updated_at')
                diff = Date.parse(b.updated_at) - Date.parse(a.updated_at);
            else
                diff = Date.parse(b.published_at) - Date.parse(a.published_at)

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
        author.style.cursor = 'pointer';
        author.style.transition = 'color 0.2s';
        author.innerHTML = `by <span class="author-link" data-author="${formatAuthor(mod.author) ?? 'Unknown'}">${formatAuthor(mod.author) ?? 'Unknown'}</span>`;
        
        const authorLink = author.querySelector('.author-link');
        if (authorLink)
        {
            authorLink.style.color = 'var(--accent-blue)';
            authorLink.style.textDecoration = 'underline';
            authorLink.style.cursor = 'pointer';

            authorLink.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();

                const authorName = authorLink.dataset.author;
                const params = getUrlParams();
                params.set('author', authorName);

                window.location.search = params.toString();
            });

            authorLink.addEventListener('mouseenter', () => {
                authorLink.style.opacity = '0.8';
            });

            authorLink.addEventListener('mouseleave', () => {
                authorLink.style.opacity = '1';
            });
        }

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

        favBtn.addEventListener('mouseenter', () => li.classList.add('force-hover'));
        favBtn.addEventListener('mouseleave', () => li.classList.remove('force-hover'));

        // Card tags
        const tagBar = this.createTagBar(mod.tags || []);
        li.appendChild(tagBar);

        // Links
        const linksContainer = document.createElement('div');
        linksContainer.style.cssText = 'display: flex; gap: 0.5rem; margin-top: 1rem; flex-wrap: wrap;';

        // Details link
        const detailsLink = document.createElement('a');
        detailsLink.href = `mod.html?key=${encodeURIComponent(mod.key)}`;
        detailsLink.className = 'mod-card-link';
        detailsLink.innerHTML = 'Details';
        detailsLink.style.cssText = 'flex: 1; min-width: 100px; text-align: center; padding: 0.5rem 1rem; background: rgba(102, 126, 234, 0.2); border: 1px solid rgba(102, 126, 234, 0.5); border-radius: 8px; font-size: 0.875rem; font-weight: 600; color: var(--text-primary); transition: all 0.2s;';
        linksContainer.appendChild(detailsLink);

        // GitHub link
        const githubLink = document.createElement('a');
        githubLink.href = `https://github.com/${owner}/${repo}`;
        githubLink.target = '_blank';
        githubLink.className = 'mod-card-link';
        githubLink.innerHTML = 'GitHub';
        githubLink.style.cssText = 'flex: 1; min-width: 100px; text-align: center; padding: 0.5rem 1rem; background: rgba(102, 126, 234, 0.2); border: 1px solid rgba(102, 126, 234, 0.5); border-radius: 8px; font-size: 0.875rem; font-weight: 600; color: var(--text-primary); transition: all 0.2s;';
        linksContainer.appendChild(githubLink);

        // Wiki link
        const wikiLink = document.createElement('a');
        wikiLink.href = `/wiki?mod=${mod.key}`;
        wikiLink.className = 'mod-card-link';
        wikiLink.innerHTML = 'Wiki';
        wikiLink.style.cssText = 'flex: 1; min-width: 100px; text-align: center; padding: 0.5rem 1rem; background: rgba(102, 126, 234, 0.2); border: 1px solid rgba(102, 126, 234, 0.5); border-radius: 8px; font-size: 0.875rem; font-weight: 600; color: var(--text-primary); transition: all 0.2s;';
        linksContainer.appendChild(wikiLink);

        li.appendChild(linksContainer);

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

        const cards = ul.querySelectorAll('.mod-card');
        if (cards.length > 0)
            cards[0].classList.add('visible');

        initScrollAnimations();
    }

    setupSearchListener()
    {
        const searchInput = document.getElementById('search-input');
        if (!searchInput)
            return;

        let timeout;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                const params = getUrlParams();
                if (e.target.value && searchInput !== document.activeElement)
                    params.set('search', e.target.value);
                else
                    params.delete('search');

                window.location.search = params.toString();
            }, 500);
        });
    }

    setupClearFilters()
    {
        const clearBtn = document.getElementById('clear-filters');
        if (!clearBtn)
            return;

        clearBtn.addEventListener('click', () => {
            const params = getUrlParams();
            params.delete('tag');
            params.delete('author');
            params.delete('search');

            window.location.search = params.toString();
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const browser = new ModBrowser();
    browser.init();
});