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

        li.style.cssText = `
            position: relative;
            background: rgba(30, 18, 82, 0.6);
            padding: 1.5rem;
            border-radius: 12px;
            border: 2px solid rgba(102, 126, 234, 0.2);
            transition: all 0.3s;
            margin-bottom: 1rem;
            overflow: hidden;
        `;

        if (entry.images && entry.images.length > 0) 
        {
            const thumbnail = entry.images.find(img => img.isThumbnail);
            if (thumbnail) 
            {
                const thumbnailDiv = document.createElement('div');
                thumbnailDiv.className = 'mod-card-thumbnail';
                thumbnailDiv.style.cssText = `
                    position: absolute;
                    top: 0;
                    right: 0;
                    height: 100%;
                    width: 40%;
                    pointer-events: none;
                    z-index: 0;
                `;
                
                const thumbnailInner = document.createElement('div');
                thumbnailInner.style.cssText = `
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background-image: url('${thumbnail.path}');
                    background-size: cover;
                    background-position: center right;
                    background-repeat: no-repeat;
                    mask-image: 
                        linear-gradient(to left, rgba(0,0,0,1) 0%, rgba(0,0,0,0.7) 30%, rgba(0,0,0,0.3) 70%, rgba(0,0,0,0) 100%),
                        linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.7) 40%, rgba(0,0,0,0.3) 80%, rgba(0,0,0,0) 100%);
                    mask-composite: multiply;
                    -webkit-mask-image: 
                        linear-gradient(to left, rgba(0,0,0,1) 0%, rgba(0,0,0,0.7) 30%, rgba(0,0,0,0.3) 70%, rgba(0,0,0,0) 100%),
                        linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.7) 40%, rgba(0,0,0,0.3) 80%, rgba(0,0,0,0) 100%);
                    -webkit-mask-composite: source-in;
                `;
                
                thumbnailDiv.appendChild(thumbnailInner);
                li.appendChild(thumbnailDiv);
                
                console.log('[Browse] Added thumbnail for', entry.key, ':', thumbnail.path);
            }
        }

        const content = document.createElement('div');
        content.style.cssText = 'position: relative; z-index: 1;';

        // Title
        const title = document.createElement('h3');
        title.textContent = entry.name;
        title.style.cssText = 'margin: 0 0 0.5rem 0; font-size: 1.25rem; color: var(--text-white);';
        content.appendChild(title);

        // Author
        const author = document.createElement('div');
        author.textContent = `by ${Array.isArray(entry.author) ? entry.author.join(', ') : entry.author}`;
        author.style.cssText = 'color: var(--text-secondary); font-size: 0.875rem; margin-bottom: 0.75rem;';
        content.appendChild(author);

        // Description
        const desc = document.createElement('p');
        desc.textContent = entry.description || 'No description provided';
        desc.style.cssText = 'color: var(--text-light); margin-bottom: 1rem; line-height: 1.6;';
        content.appendChild(desc);

        // Meta info (tags, stats, etc.)
        const meta = document.createElement('div');
        meta.style.cssText = 'display: flex; gap: 1rem; flex-wrap: wrap; align-items: center; font-size: 0.875rem; color: var(--text-secondary);';
        
        // Favorites
        if (entry.favourites) 
        {
            const favSpan = document.createElement('span');
            favSpan.textContent = `❤️ ${entry.favourites}`;
            meta.appendChild(favSpan);
        }

        // Downloads
        if (entry.analytics && entry.analytics.downloads) 
        {
            const dlSpan = document.createElement('span');
            dlSpan.textContent = `⬇️ ${entry.analytics.downloads}`;
            meta.appendChild(dlSpan);
        }

        // Tags
        if (entry.tags && entry.tags.length > 0) 
        {
            const tagsSpan = document.createElement('span');
            tagsSpan.textContent = `🏷️ ${entry.tags.length}`;
            meta.appendChild(tagsSpan);
        }

        content.appendChild(meta);
        li.appendChild(content);

        // Click to view mod
        li.style.cursor = 'pointer';
        li.addEventListener('click', () => window.location.href = `/mod.html?key=${encodeURIComponent(entry.key)}`);

        // Hover effect
        li.addEventListener('mouseenter', () => {
            li.style.transform = 'translateY(-4px)';
            li.style.borderColor = 'rgba(102, 126, 234, 0.5)';
            li.style.boxShadow = '0 8px 20px rgba(102, 126, 234, 0.3)';
        });

        li.addEventListener('mouseleave', () => {
            li.style.transform = 'translateY(0)';
            li.style.borderColor = 'rgba(102, 126, 234, 0.2)';
            li.style.boxShadow = 'none';
        });

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