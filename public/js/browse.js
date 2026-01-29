import { fetchJson, formatDate, formatAuthor, parseModKey, getUrlParams } from './utils.js';
import { favouritesManager } from './favourites.js';

class ScrollAnimationObserver {
    constructor() {
        this.observer = null;
        this.init();
    }

    init() {
        const options = {
            root: null,
            rootMargin: '200px 0px 0px 0px',
            threshold: 0
        };

        this.observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    this.observer.unobserve(entry.target);
                }
            });
        }, options);
    }

    observe(elements) {
        elements.forEach(element => {
            this.observer.observe(element);
        });
    }

    disconnect() {
        if (this.observer) {
            this.observer.disconnect();
        }
    }
}

let animationObserver = null;

export function initScrollAnimations() {
    if (!animationObserver) {
        animationObserver = new ScrollAnimationObserver();
    }
    
    const modCards = document.querySelectorAll('.mod-card');
    if (modCards.length > 0) {
        animationObserver.observe(modCards);
    }
}

class ModBrowser
{
    constructor()
    {
        this.mods = [];
        this.allTags = new Set();
        this.filteredMods = [];
        this.params = {
            sortBy: 'views',
            order: 'desc',
            tag: '',
            author: '',
            search: '',
            type: 'mods',
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
        this.applyFilters();
        this.setupEventListeners();
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
        this.params.sortBy = params.get('sortBy') || 'views';
        this.params.order = params.get('order') || 'desc';
        this.params.tag = params.get('tag') || '';
        this.params.author = params.get('author') || '';
        this.params.search = params.get('search') || '';
        this.params.type = params.get('type') || 'mods';

        const isIndex = window.location.pathname === '/' || window.location.pathname === '/index.html';
        this.params.limit = isIndex ? 5 : null;
    }

    updateURLParams()
    {
        const params = new URLSearchParams();
        
        if (this.params.sortBy !== 'views') 
            params.set('sortBy', this.params.sortBy);
        if (this.params.order !== 'desc') 
            params.set('order', this.params.order);
        if (this.params.tag) 
            params.set('tag', this.params.tag);
        if (this.params.author) 
            params.set('author', this.params.author);
        if (this.params.search) 
            params.set('search', this.params.search);
        if (this.params.type !== 'mods') 
            params.set('type', this.params.type);

        const newURL = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
        window.history.replaceState({}, '', newURL);
    }

    updateUIControls()
    {
        const sortSelect = document.querySelector('select[name="sortBy"]');
        const orderSelect = document.querySelector('select[name="order"]');
        const tagSelect = document.querySelector('select[name="tag"]');
        const typeSelect = document.querySelector('select[name="type"]');
        const authorInput = document.getElementById('author-filter');
        const searchInput = document.getElementById('search-input');

        if (sortSelect) 
            sortSelect.value = this.params.sortBy;
        if (orderSelect) 
            orderSelect.value = this.params.order;
        if (tagSelect) 
            tagSelect.value = this.params.tag;
        if (typeSelect) 
            typeSelect.value = this.params.type;
        if (authorInput) 
            authorInput.value = this.params.author;
        if (searchInput) 
            searchInput.value = this.params.search;
        
        this.updateActiveFilters();
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
        if (this.params.type !== 'mods') 
            filters.push({ type: 'Type', value: this.params.type, param: 'type' });
        
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
                this.params[filter.param] = filter.param === 'type' ? 'mods' : '';

                this.applyFilters();
            });
            
            tagsContainer.appendChild(tag);
        });
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
        if (!tagSelect) 
            return;

        if (tagSelect.options.length <= 1) 
        {
            tagSelect.innerHTML = '<option value="">All Tags</option>';
            
            Array.from(this.allTags).sort().forEach(tag => {
                const opt = document.createElement('option');
                opt.value = tag;
                opt.textContent = tag;
                tagSelect.appendChild(opt);
            });
        }
        
        tagSelect.value = this.params.tag;
    }

    applyFilters()
    {
        this.updateUIControls();
        this.updateURLParams();
        
        let entries = Object.entries(this.mods).map(([key, mod]) => ({ key, ...mod }));

        if (this.params.type === 'mods')
            entries = entries.filter(mod => mod.type === 'Mod');
        else if (this.params.type === 'modpacks')
            entries = entries.filter(mod => mod.type === 'Modpack');

        if (this.params.tag)
            entries = entries.filter(mod => Array.isArray(mod.tags) && mod.tags.includes(this.params.tag));
        
        if (this.params.author) 
        {
            entries = entries.filter(mod => {
                const authors = Array.isArray(mod.author) ? mod.author : [mod.author];
                return authors.some(a => String(a).toLowerCase() === this.params.author.toLowerCase());
            });
        }
        
        if (this.params.search) 
        {
            const searchLower = this.params.search.toLowerCase();
            entries = entries.filter(mod => {
                const nameMatch = (mod.name || '').toLowerCase().includes(searchLower);
                const descMatch = (mod.description || '').toLowerCase().includes(searchLower);
                const authorMatch = Array.isArray(mod.author) 
                    ? mod.author.some(a => String(a).toLowerCase().includes(searchLower))
                    : String(mod.author || '').toLowerCase().includes(searchLower);
                
                return nameMatch || descMatch || authorMatch;
            });
        }

        entries.sort((a, b) => {
            let diff;
            if (this.params.sortBy === 'favourites')
                diff = (b.favourites || 0) - (a.favourites || 0);
            else if (this.params.sortBy === 'views')
                diff = (b.analytics?.views || 0) - (a.analytics?.views || 0);
            else if (this.params.sortBy === 'downloads')
                diff = (b.analytics?.downloads || 0) - (a.analytics?.downloads || 0);
            else if (this.params.sortBy === 'updated_at')
                diff = Date.parse(b.updated_at || b.published_at) - Date.parse(a.updated_at || a.published_at);
            else
                diff = Date.parse(b.published_at) - Date.parse(a.published_at);

            return this.params.order === 'asc' ? -diff : diff;
        });

        if (this.params.limit)
            entries = entries.slice(0, this.params.limit);

        this.filteredMods = entries;
        this.renderMods();
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
                this.params.tag = tag;

                this.applyFilters();
            });

            tagBar.appendChild(btn);
        });

        return tagBar;
    }

    createModListItem(mod)
    {
        const li = document.createElement('li');
        li.className = 'mod-card';
        li.dataset.key = mod.key;

        let baseStyle = `
            position: relative;
            background: rgba(30, 18, 82, 0.6);
            padding: 1.5rem;
            border-radius: 12px;
            border: 2px solid rgba(102, 126, 234, 0.2);
            transition: all 0.3s;
            margin-bottom: 1rem;
            overflow: hidden;
        `;

        if (mod.images && mod.images.length > 0)
        {
            const thumbnail = mod.images.find(img => img.isThumbnail);
            if (thumbnail)
            {
                baseStyle += `
                    background: linear-gradient(90deg, rgba(30, 18, 82, 1) 0%, rgba(30, 18, 82, 0.7) 50%, rgba(30, 18, 82, 0) 100%), 
                                url('${thumbnail.path}') right center / cover no-repeat;
                `;
            }
        }

        li.style.cssText = baseStyle;

        const { repo, owner } = parseModKey(mod.key);

        const header = document.createElement('div');
        header.className = 'mod-card-header';

        const titleLink = document.createElement('a');
        titleLink.href = `mod.html?key=${encodeURIComponent(mod.key)}`;
        
        const badge = mod.type === 'Modpack' ? '<span style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem; margin-left: 0.5rem;">MODPACK</span>' : '';
        
        titleLink.innerHTML = `<h3 class="mod-card-title">${mod.name ?? 'Unknown'}${badge}</h3>`;

        header.appendChild(titleLink);
        li.appendChild(header);

        const author = document.createElement('div');
        author.className = 'mod-card-author';
        author.style.cursor = 'pointer';
        author.innerHTML = `by <span class="author-link" data-author="${formatAuthor(mod.author) ?? 'Unknown'}">${formatAuthor(mod.author) ?? 'Unknown'}</span>`;

        const authorLink = author.querySelector('.author-link');
        if (authorLink) 
        {
            authorLink.style.cssText = 'color: var(--accent-blue); text-decoration: underline; cursor: pointer;';
            
            authorLink.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.params.author = authorLink.dataset.author;

                this.applyFilters();
            });
        }

        li.appendChild(author);

        const description = document.createElement('p');
        description.className = 'mod-card-description';
        description.textContent = mod.description ?? 'No description';
        li.appendChild(description);

        const meta = document.createElement('div');
        meta.className = 'mod-card-meta';
        
        if (mod.type === 'Modpack') 
        {
            meta.innerHTML = `
                <span class="mod-card-meta-item">📦 ${mod.modCount || mod.mods?.length || 0} mods</span>
                <span class="mod-card-meta-item">📅 ${formatDate(mod.published_at) ?? 'Unknown'}</span>
            `;
        } 
        else 
        {
            meta.innerHTML = `
                <span class="mod-card-meta-item">📅 ${formatDate(mod.published_at) ?? 'Unknown'}</span>
                <span class="mod-card-meta-item">👁️ ${mod.analytics?.views || 0} views</span>
                <span class="mod-card-meta-item">📥 ${mod.analytics?.downloads || 0} downloads</span>
            `;
        }
        
        li.appendChild(meta);

        const favBtn = favouritesManager.createFavouriteButton(mod.key, mod.favourites);
        favBtn.style.width = '100%';
        favBtn.style.marginBottom = '1rem';
        
        favBtn.addEventListener('mouseenter', () => li.classList.add('force-hover'));
        favBtn.addEventListener('mouseleave', () => li.classList.remove('force-hover'));
        
        li.appendChild(favBtn);

        const tagBar = this.createTagBar(mod.tags || []);
        li.appendChild(tagBar);

        const linksContainer = document.createElement('div');
        linksContainer.style.cssText = 'display: flex; gap: 0.5rem; margin-top: 1rem; flex-wrap: wrap;';

        const detailsLink = document.createElement('a');
        detailsLink.href = `mod.html?key=${encodeURIComponent(mod.key)}`;
        detailsLink.className = 'mod-card-link';
        detailsLink.innerHTML = 'Details';
        detailsLink.style.cssText = 'flex: 1; min-width: 100px; text-align: center; padding: 0.5rem 1rem; background: rgba(102, 126, 234, 0.2); border: 1px solid rgba(102, 126, 234, 0.5); border-radius: 8px; font-size: 0.875rem; font-weight: 600; color: var(--text-primary); transition: all 0.2s; position: relative; overflow: hidden;';
        linksContainer.appendChild(detailsLink);

        if (mod.type !== 'Modpack') 
        {
            const githubLink = document.createElement('a');
            githubLink.href = `https://github.com/${owner}/${repo}`;
            githubLink.target = '_blank';

            githubLink.addEventListener('click', async () => {
                try
                {
                    await fetch(`/analytics/download/${encodeURIComponent(mod.key)}`, { method: 'POST' });
                }
                catch (err)
                {
                    console.error('Failed to track download:', err);
                }
            });

            githubLink.className = 'mod-card-link';
            githubLink.innerHTML = 'GitHub';
            githubLink.style.cssText = 'flex: 1; min-width: 100px; text-align: center; padding: 0.5rem 1rem; background: rgba(102, 126, 234, 0.2); border: 1px solid rgba(102, 126, 234, 0.5); border-radius: 8px; font-size: 0.875rem; font-weight: 600; color: var(--text-primary); transition: all 0.2s; position: relative; overflow: hidden;';
            linksContainer.appendChild(githubLink);

            const wikiLink = document.createElement('a');
            wikiLink.href = `/wiki?mod=${mod.key}`;
            wikiLink.className = 'mod-card-link';
            wikiLink.innerHTML = 'Wiki';
            wikiLink.style.cssText = 'flex: 1; min-width: 100px; text-align: center; padding: 0.5rem 1rem; background: rgba(102, 126, 234, 0.2); border: 1px solid rgba(102, 126, 234, 0.5); border-radius: 8px; font-size: 0.875rem; font-weight: 600; color: var(--text-primary); transition: all 0.2s; position: relative; overflow: hidden;';
            linksContainer.appendChild(wikiLink);
        }

        li.appendChild(linksContainer);

        return li;
    }

    renderMods()
    {
        const ul = document.getElementById('mod-list');
        if (!ul) return;

        ul.className = 'mod-grid';
        ul.innerHTML = '';

        if (this.filteredMods.length === 0) 
        {
            const emptyMessage = document.createElement('p');
            emptyMessage.textContent = 'No items found matching your filters.';
            emptyMessage.className = 'fade-in';
            emptyMessage.style.gridColumn = '1 / -1';
            emptyMessage.style.textAlign = 'center';
            emptyMessage.style.padding = '2rem';
            emptyMessage.style.color = 'var(--text-secondary)';
            
            ul.appendChild(emptyMessage);
            return;
        }

        this.filteredMods.forEach(mod => {
            const li = this.createModListItem(mod);
            ul.appendChild(li);
        });

        const cards = ul.querySelectorAll('.mod-card');
        if (cards.length > 0)
            cards[0].classList.add('visible');

        initScrollAnimations();
    }

    setupEventListeners()
    {
        const searchInput = document.getElementById('search-input');
        if (searchInput) 
        {
            let timeout;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(timeout);
                timeout = setTimeout(() => {
                    this.params.search = e.target.value;

                    this.applyFilters();
                }, 500);
            });
        }

        const sortSelect = document.querySelector('select[name="sortBy"]');
        const orderSelect = document.querySelector('select[name="order"]');
        const tagSelect = document.querySelector('select[name="tag"]');
        const typeSelect = document.querySelector('select[name="type"]');

        if (sortSelect)
        {
            sortSelect.addEventListener('change', (e) => {
                this.params.sortBy = e.target.value;

                this.applyFilters();
            });
        }

        if (orderSelect) 
        {
            orderSelect.addEventListener('change', (e) => {
                this.params.order = e.target.value;

                this.applyFilters();
            });
        }

        if (tagSelect) 
        {
            tagSelect.addEventListener('change', (e) => {
                this.params.tag = e.target.value;

                this.applyFilters();
            });
        }

        if (typeSelect) 
        {
            typeSelect.addEventListener('change', (e) => {
                this.params.type = e.target.value;

                this.applyFilters();
            });
        }

        const clearBtn = document.getElementById('clear-filters');
        if (clearBtn) 
        {
            clearBtn.addEventListener('click', () => 
            {
                this.params.tag = '';
                this.params.author = '';
                this.params.search = '';
                this.params.type = 'mods';
                
                if (searchInput) 
                    searchInput.value = '';
                
                this.applyFilters();
            });
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const browser = new ModBrowser();
    browser.init();
});