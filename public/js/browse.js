import { fetchJson, formatDate, formatAuthor, parseModKey, getUrlParams } from './utils.js';
import { favouritesManager } from './favourites.js';
import { CustomDropdown } from './customDropdown.js';
import icons from './icons.js';

class BrowsePreferences
{
    constructor()
    {
        this.storageKey = 'photon-browse-preferences';
        this.defaults = {
            sortBy: 'trending',
            order: 'desc',
            type: 'all',
            tags: [],
            searchQuery: ''
        };
    }

    save(preferences)
    {
        try
        {
            const toSave = {
                ...this.defaults,
                ...preferences,
                lastUpdated: new Date().toISOString()
            };

            localStorage.setItem(this.storageKey, JSON.stringify(toSave));
            console.log('[BrowsePrefs] Saved:', toSave);
        }
        catch (err)
        {
            console.error('[BrowsePrefs] Failed to save:', err);
        }
    }

    load()
    {
        try
        {
            const stored = localStorage.getItem(this.storageKey);
            if (!stored)
            {
                console.log('[BrowsePrefs] No saved preferences, using defaults');
                return this.defaults;
            }

            const parsed = JSON.parse(stored);
            const preferences = {
                ...this.defaults,
                ...parsed
            };

            console.log('[BrowsePrefs] Loaded:', preferences);
            return preferences;
        }
        catch (err)
        {
            console.error('[BrowsePrefs] Failed to load:', err);
            return this.defaults;
        }
    }

    clear()
    {
        try
        {
            localStorage.removeItem(this.storageKey);
            console.log('[BrowsePrefs] Cleared preferences');
        }
        catch (err)
        {
            console.error('[BrowsePrefs] Failed to clear:', err);
        }
    }
}

const browsePrefs = new BrowsePreferences();

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
            sortBy: 'trending',
            order: 'desc',
            tag: '',
            author: '',
            search: '',
            type: 'mods',
            limit: null
        };
        this.preferences = browsePrefs;
    }

    async init()
    {
        const savedPrefs = this.preferences.load();
        this.applySavedPreferences(savedPrefs);

        await this.loadMods();
        this.extractUrlParams();
        this.setupCustomDropdowns();
        this.updateUIControls();
        this.extractAllTags();
        this.populateTagFilter();
        this.applyFilters();
        this.setupEventListeners();
    }

    applySavedPreferences(prefs)
    {
        console.log('[Browse] Applying saved preferences:', prefs);

        const sortSelect = document.getElementById('sort-by');
        if (sortSelect && prefs.sortBy)
            sortSelect.value = prefs.sortBy;

        const orderSelect = document.getElementById('sort-order');
        if (orderSelect && prefs.order)
            orderSelect.value = prefs.order;

        const typeSelect = document.getElementById('type-filter');
        if (typeSelect && prefs.type)
            typeSelect.value = prefs.type;

        if (prefs.tags && prefs.tags.length > 0)
        {
            prefs.tags.forEach(tag => {
                const checkbox = document.querySelector(`[name="tags"][value="${tag}"]`);
                if (checkbox)
                    checkbox.checked = true;
            });
        }

        const searchInput = document.getElementById('search-input');
        if (searchInput && prefs.searchQuery)
            searchInput.value = prefs.searchQuery;
    }

    getCurrentPreferences()
    {
        const sortSelect = document.getElementById('sort-by');
        const orderSelect = document.getElementById('sort-order');
        const typeSelect = document.getElementById('type-filter');
        const searchInput = document.getElementById('search-input');
        const selectedTags = Array.from(document.querySelectorAll('[name="tags"]:checked')).map(cb => cb.value);

        return {
            sortBy: sortSelect?.value || 'trending',
            order: orderSelect?.value || 'desc',
            type: typeSelect?.value || 'all',
            tags: selectedTags,
            searchQuery: searchInput?.value || ''
        };
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

    setupCustomDropdowns()
    {
        const container = document.getElementById('filter-dropdowns');
        if (!container)
            return;

        const sortDropdown = new CustomDropdown({
            label: 'Sort By',
            options: [
                { value: 'trending', label: 'Trending' },
                { value: 'views', label: 'Most Views' },
                { value: 'downloads', label: 'Most Downloads' },
                { value: 'published_at', label: 'Date Published' },
                { value: 'updated_at', label: 'Recently Updated' },
                { value: 'favourites', label: 'Most Favourited' }
            ],
            selected: this.params.sortBy,
            onChange: (value) => this.params.sortBy = value
        });

        const orderDropdown = new CustomDropdown({
            label: 'Order',
            options: [
                { value: 'desc', label: 'Descending' },
                { value: 'asc', label: 'Ascending' }
            ],
            selected: this.params.order,
            onChange: (value) => this.params.order = value
        });

        const tagDropdown = new CustomDropdown({
            label: 'Filter by Tag',
            options: [
                { value: '', label: 'All Tags' },
                { value: 'Textures', label: 'Textures' },
                { value: 'SFX', label: 'SFX / Music' },
                { value: 'Vanilla Plus', label: 'Vanilla Plus' },
                { value: 'Jokers', label: 'Jokers' },
                { value: 'Consumables', label: 'Consumables' },
                { value: 'Cards', label: 'Cards' },
                { value: 'Blinds', label: 'Blinds' },
                { value: 'Modifiers', label: 'Modifiers' },
                { value: 'Mechanics', label: 'Mechanics' },
                { value: 'Quality of Life', label: 'Quality of Life' },
                { value: 'Misc', label: 'Miscellaneous' }
            ],
            selected: this.params.tag,
            onChange: (value) => this.params.tag = value
        });

        const typeDropdown = new CustomDropdown({
            label: 'Type',
            options: [
                { value: 'mods', label: 'Mods Only' },
                { value: 'modpacks', label: 'Modpacks Only' },
                { value: 'all', label: 'All' }
            ],
            selected: this.params.type,
            onChange: (value) => this.params.type = value
        });

        container.appendChild(sortDropdown.getElement());
        container.appendChild(orderDropdown.getElement());
        container.appendChild(tagDropdown.getElement());
        container.appendChild(typeDropdown.getElement());

        const applyBtn = document.getElementById('apply-filters-btn');
        if (applyBtn)
            applyBtn.addEventListener('click', () => this.applyFilters());
    }

    calculateTrendingScore(mod)
    {
        const days = 7;
        const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

        const recentViews = mod.analytics?.lastViewed > cutoff ? mod.analytics.views : 0;
        const recentDownloads = mod.analytics?.lastDownloaded > cutoff ? mod.analytics.downloads : 0;
        const recentFavourites = mod.updated_at > cutoff ? mod.favourites : 0;
            
        const viewScore = 0.3;
        const downloadScore = 0.5;
        const favouriteScore = 0.2;

        const score = (recentViews * viewScore) + (recentDownloads * downloadScore) + (recentFavourites * favouriteScore);

        return score;
    }

    sortMods(mods)
    {
        const { sortBy, order } = this.params;

        const sorted = [...mods].sort((a, b) => {
            let aVal, bVal;

            switch (sortBy)
            {
                case 'trending':
                    const aScore = this.calculateTrendingScore(a);
                    const bScore = this.calculateTrendingScore(b);

                    aVal = aScore;
                    bVal = bScore;

                    break;
                case 'name':
                    aVal = (a.name || '').toLowerCase();
                    bVal = (b.name || '').toLowerCase();

                    break;
                case 'author':
                    const aAuthor = Array.isArray(a.author) ? a.author[0] : a.author;
                    const bAuthor = Array.isArray(b.author) ? b.author[0] : b.author;

                    aVal = (aAuthor || '').toLowerCase();
                    bVal = (bAuthor || '').toLowerCase();

                    break;
                case 'updated_at':
                    aVal = new Date(a.updated_at || a.published_at || 0).getTime();
                    bVal = new Date(b.updated_at || b.published_at || 0).getTime();

                    break;
                case 'published_at':
                    aVal = new Date(a.published_at || 0).getTime();
                    bVal = new Date(b.published_at || 0).getTime();

                    break;
                case 'favourites':
                    aVal = a.favourites || 0;
                    bVal = b.favourites || 0;

                    break;
                case 'views':
                    aVal = a.analytics?.views || 0;
                    bVal = b.analytics?.views || 0;

                    break;
                case 'downloads':
                    aVal = a.analytics?.downloads || 0;
                    bVal = b.analytics?.downloads || 0;

                    break;
                default:
                    return 0;
            }

            if (typeof aVal === 'string')
                return order === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);

            return order === 'asc' ? aVal - bVal : bVal - aVal;
        });

        return sorted;
    }

    applyFilters()
    {
        const currentPrefs = this.getCurrentPreferences();
        this.preferences.save(currentPrefs);

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

        entries = this.sortMods(entries);

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

    createClickableTag(tag)
    {
        const tagSpan = document.createElement('button');
        tagSpan.type = 'button';
        tagSpan.className = 'tag-badge clickable';
        tagSpan.style.cssText = `
            padding: 0.25rem 0.75rem;
            background: linear-gradient(135deg, rgba(102, 126, 234, 0.2) 0%, rgba(118, 75, 162, 0.2) 100%);
            border: 1px solid rgba(102, 126, 234, 0.3);
            border-radius: 50px;
            font-size: 0.75rem;
            color: rgba(255, 255, 255, 0.9);
            display: inline-flex;
            align-items: center;
            gap: 0.25rem;
            cursor: pointer;
            transition: all 0.2s;
        `;
        
        const tagIcon = icons.create('tags', { size: 12, color: 'rgba(255, 255, 255, 0.8)' });
        tagSpan.appendChild(tagIcon);
        tagSpan.appendChild(document.createTextNode(tag));
        
        tagSpan.addEventListener('click', (e) => {
            e.stopPropagation();
            this.filterByTag(tag);
        });
        
        tagSpan.addEventListener('mouseenter', () => {
            tagSpan.style.background = 'linear-gradient(135deg, rgba(102, 126, 234, 0.4) 0%, rgba(118, 75, 162, 0.4) 100%)';
            tagSpan.style.borderColor = 'rgba(102, 126, 234, 0.6)';
            tagSpan.style.transform = 'scale(1.05)';
            tagSpan.style.boxShadow = '0 0 12px rgba(102, 126, 234, 0.5)';
        });
        
        tagSpan.addEventListener('mouseleave', () => {
            tagSpan.style.background = 'linear-gradient(135deg, rgba(102, 126, 234, 0.2) 0%, rgba(118, 75, 162, 0.2) 100%)';
            tagSpan.style.borderColor = 'rgba(102, 126, 234, 0.3)';
            tagSpan.style.transform = 'scale(1)';
            tagSpan.style.boxShadow = 'none';
        });
        
        return tagSpan;
    }

    filterByTag(tag)
    {
        this.params.tag = tag;
        this.applyFilters();
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    filterByAuthor(author)
    {
        this.params.author = author;
        this.applyFilters();
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    createFavouriteButton(modKey)
    {
        const btn = document.createElement('button');
        btn.className = 'click-me favourite-btn';
        btn.style.cssText = `
            padding: 0.5rem 1rem;
            font-size: 0.875rem;
            background: linear-gradient(135deg, rgba(255, 59, 118, 0.8) 0%, rgba(189, 42, 122, 0.8) 100%);
            display: inline-flex;
            align-items: center;
            gap: 0.375rem;
        `;
        
        const heartIcon = icons.create('heart-filled', { size: 16, color: 'white' });
        btn.appendChild(heartIcon);
        btn.appendChild(document.createTextNode('Favourite'));
        
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await favouritesManager.toggleFavourite(modKey);
        });
        
        return btn;
    }

    createDetailsButton(modKey)
    {
        const btn = document.createElement('button');
        btn.className = 'click-me';
        btn.textContent = 'Details';
        btn.style.cssText = 'padding: 0.5rem 1rem; font-size: 0.875rem;';
        
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            window.location.href = `/mod.html?key=${encodeURIComponent(modKey)}`;
        });
        
        return btn;
    }

    createWikiButton(modKey)
    {
        const btn = document.createElement('a');
        btn.href = `/wiki?mod=${encodeURIComponent(modKey)}`;
        btn.className = 'click-me';
        btn.style.cssText = `
            padding: 0.5rem 1rem;
            font-size: 0.875rem;
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            gap: 0.375rem;
        `;
        
        const bookIcon = icons.create('book', { size: 16, color: 'white' });
        btn.appendChild(bookIcon);
        btn.appendChild(document.createTextNode('Wiki'));
        
        btn.addEventListener('click', (e) => e.stopPropagation());
        
        return btn;
    }

    createOfficialWikiButton(externalWiki)
    {
        const btn = document.createElement('a');
        btn.href = externalWiki;
        btn.target = '_blank';
        btn.className = 'click-me';
        btn.style.cssText = `
            padding: 0.5rem 1rem;
            font-size: 0.875rem;
            text-decoration: none;
            background: linear-gradient(135deg, rgba(67, 160, 234, 0.8) 0%, rgba(118, 75, 162, 0.8) 100%);
            display: inline-flex;
            align-items: center;
            gap: 0.375rem;
        `;
        
        const extLinkIcon = icons.create('external-link', { size: 16, color: 'white' });
        btn.appendChild(extLinkIcon);
        btn.appendChild(document.createTextNode('Official Wiki'));
        
        btn.addEventListener('click', (e) => e.stopPropagation());
        
        return btn;
    }

    createGitHubButton(owner, repo, modKey)
    {
        const btn = document.createElement('a');
        btn.href = `https://github.com/${owner}/${repo}`;
        btn.target = '_blank';
        btn.className = 'click-me';
        btn.style.cssText = `
            padding: 0.5rem 1rem;
            font-size: 0.875rem;
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            gap: 0.375rem;
        `;
        
        const githubIcon = icons.create('github', { size: 16, color: 'white' });
        btn.appendChild(githubIcon);
        btn.appendChild(document.createTextNode('GitHub'));
        
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            try 
            {
                await fetch(`/analytics/download/${encodeURIComponent(modKey)}`, { 
                    method: 'POST', 
                    keepalive: true 
                });
            } 
            catch (err) 
            {
                console.error('Failed to track download:', err);
            }
        });
        
        return btn;
    }

    createCommunityButton(owner, repo)
    {
        const btn = document.createElement('a');
        btn.href = `https://github.com/${owner}/${repo}/discussions`;
        btn.target = '_blank';
        btn.className = 'click-me community-btn';
        btn.style.cssText = `
            padding: 0.5rem 1rem;
            font-size: 0.875rem;
            text-decoration: none;
            background: linear-gradient(135deg, rgba(147, 51, 234, 0.8) 0%, rgba(126, 34, 206, 0.8) 100%);
            display: inline-flex;
            align-items: center;
            gap: 0.375rem;
        `;
        
        const messageIcon = icons.create('message-circle', { size: 16, color: 'white' });
        btn.appendChild(messageIcon);
        btn.appendChild(document.createTextNode('Community'));
        
        btn.addEventListener('click', (e) => e.stopPropagation());
        
        return btn;
    }

    sortByMetric(metric)
    {
        this.params.sortBy = metric;
        this.params.order = 'desc';
        
        const sortSelect = document.getElementById('sort-by');
        if (sortSelect)
            sortSelect.value = metric;
        
        const orderSelect = document.getElementById('sort-order');
        if (orderSelect)
            orderSelect.value = 'desc';
        
        this.applyFilters();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
        const metricNames = {
            'favourites': 'Favourites',
            'views': 'Views',
            'downloads': 'Downloads'
        };
        
        console.log(`[Browse] Sorted by ${metricNames[metric]}`);
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

        if (mod.images && mod.images.length > 0) 
        {
            const thumbnail = mod.images.find(img => img.isThumbnail);
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
                
                console.log('[Browse] Added thumbnail for', mod.key, ':', thumbnail.path);
            }
        }

        const content = document.createElement('div');
        content.style.cssText = 'position: relative; z-index: 1;';

        // Title
        const title = document.createElement('h3');
        title.style.cssText = `
            margin: 0 0 0.5rem 0;
            font-size: 1.25rem;
            color: var(--text-white);
            cursor: pointer;
            transition: color 0.2s;
        `;

        const titleLink = document.createElement('a');
        titleLink.textContent = mod.name;
        titleLink.href = `/mod.html?key=${encodeURIComponent(mod.key)}`;
        titleLink.style.cssText = `
            color: var(--text-white);
            text-decoration: none;
            transition: color 0.2s;
        `;
        titleLink.addEventListener('mouseenter', () => titleLink.style.color = 'var(--accent-blue)');
        titleLink.addEventListener('mouseleave', () => titleLink.style.color = 'var(--text-white)');

        title.appendChild(titleLink);
        content.appendChild(title);

        // Author
        const authorDiv = document.createElement('div');
        authorDiv.style.cssText = 'color: var(--text-secondary); font-size: 0.875rem; margin-bottom: 0.75rem;';
        
        const authors = Array.isArray(mod.author) ? mod.author : [mod.author];
        authorDiv.appendChild(document.createTextNode('by '));
        
        authors.forEach((author, index) => {
            const authorLink = document.createElement('a');
            authorLink.textContent = author;
            authorLink.href = '#';
            authorLink.style.cssText = `
                color: var(--text-secondary);
                text-decoration: none;
                transition: color 0.2s;
                cursor: pointer;
            `;
            
            authorLink.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.filterByAuthor(author);
            });
            
            authorLink.addEventListener('mouseenter', () => {
                authorLink.style.color = 'var(--accent-blue)';
                authorLink.style.textDecoration = 'underline';
            });
            
            authorLink.addEventListener('mouseleave', () => {
                authorLink.style.color = 'var(--text-secondary)';
                authorLink.style.textDecoration = 'none';
            });
            
            authorDiv.appendChild(authorLink);
            
            if (index < authors.length - 1)
                authorDiv.appendChild(document.createTextNode(', '));
        });
        
        content.appendChild(authorDiv);

        // Description
        const desc = document.createElement('p');
        desc.textContent = mod.description || 'No description provided';
        desc.style.cssText = 'color: var(--text-light); margin-bottom: 1rem; line-height: 1.6;';
        content.appendChild(desc);

        // Tags
        if (mod.tags && mod.tags.length > 0) 
        {
            const tagsContainer = document.createElement('div');
            tagsContainer.style.cssText = 'display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1rem;';
            tagsContainer.className = 'tags-container';
            
            const visibleTags = mod.tags.slice(0, 5);
            const hiddenTags = mod.tags.slice(5);
            
            visibleTags.forEach(tag => {
                const tagSpan = this.createClickableTag(tag);
                tagsContainer.appendChild(tagSpan);
            });
            
            if (hiddenTags.length > 0) 
            {
                const hiddenContainer = document.createElement('div');
                hiddenContainer.className = 'hidden-tags';
                hiddenContainer.style.cssText = `
                    display: none;
                    flex-wrap: wrap;
                    gap: 0.5rem;
                    width: 100%;
                `;
                
                hiddenTags.forEach(tag => {
                    const tagSpan = this.createClickableTag(tag);
                    hiddenContainer.appendChild(tagSpan);
                });
                
                const moreBtn = document.createElement('button');
                moreBtn.type = 'button';
                moreBtn.className = 'tag-expand-btn';
                moreBtn.textContent = `+${hiddenTags.length}`;
                moreBtn.style.cssText = `
                    padding: 0.25rem 0.75rem;
                    background: rgba(102, 126, 234, 0.1);
                    border: 1px solid rgba(102, 126, 234, 0.2);
                    border-radius: 50px;
                    font-size: 0.75rem;
                    color: var(--text-secondary);
                    cursor: pointer;
                    transition: all 0.2s;
                `;
                
                let expanded = false;
                
                moreBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    expanded = !expanded;
                    
                    if (expanded)
                    {
                        hiddenContainer.style.display = 'flex';
                        moreBtn.textContent = 'Show less';
                        moreBtn.style.background = 'rgba(102, 126, 234, 0.2)';
                    }
                    else
                    {
                        hiddenContainer.style.display = 'none';
                        moreBtn.textContent = `+${hiddenTags.length}`;
                        moreBtn.style.background = 'rgba(102, 126, 234, 0.1)';
                    }
                });
                
                moreBtn.addEventListener('mouseenter', () => {
                    moreBtn.style.background = 'rgba(102, 126, 234, 0.3)';
                    moreBtn.style.borderColor = 'rgba(102, 126, 234, 0.5)';
                    moreBtn.style.transform = 'scale(1.05)';
                });
                
                moreBtn.addEventListener('mouseleave', () => {
                    if (!expanded)
                    {
                        moreBtn.style.background = 'rgba(102, 126, 234, 0.1)';
                        moreBtn.style.borderColor = 'rgba(102, 126, 234, 0.2)';
                    }
                    else
                    {
                        moreBtn.style.background = 'rgba(102, 126, 234, 0.2)';
                    }
                    moreBtn.style.transform = 'scale(1)';
                });
                
                tagsContainer.appendChild(moreBtn);
                tagsContainer.appendChild(hiddenContainer);
            }
            
            content.appendChild(tagsContainer);
        }

        const footer = document.createElement('div');
        footer.style.cssText = 'display: flex; flex-direction: column; gap: 0.75rem; align-items: left; flex-wrap: wrap; margin-top: 1rem;';

        // Stats section
        const statsDiv = document.createElement('div');
        statsDiv.style.cssText = 'display: flex; gap: 1rem; align-items: center; flex: 1;';

        // Favourites count
        const favStat = document.createElement('button');
        favStat.className = 'stat-button';
        favStat.style.cssText = `
            background: none;
            border: none;
            padding: 0.25rem 0.5rem;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 0.25rem;
            border-radius: 4px;
            transition: all 0.2s;
        `;
        favStat.title = 'Sort by favourites';

        const favIcon = icons.createWithText('heart', `${mod.favourites || 0}`, { size: 14, color: 'white', filled: true });
        favStat.appendChild(favIcon);

        favStat.addEventListener('click', (e) => {
            e.stopPropagation();
            this.sortByMetric('favourites');
        });

        favStat.addEventListener('mouseenter', () => {
            favStat.style.background = 'rgba(255, 59, 118, 0.2)';
            favStat.style.transform = 'scale(1.05)';
        });

        favStat.addEventListener('mouseleave', () => {
            favStat.style.background = 'none';
            favStat.style.transform = 'scale(1)';
        });

        statsDiv.appendChild(favStat);

        // View count
        if (mod.analytics && mod.analytics.views) 
        {
            const viewStat = document.createElement('button');
            viewStat.type = 'button';
            viewStat.className = 'stat-button';
            viewStat.style.cssText = `
                background: none;
                border: none;
                padding: 0.25rem 0.5rem;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                gap: 0.25rem;
                border-radius: 4px;
                transition: all 0.2s;
            `;
            viewStat.title = 'Sort by views';
            
            const viewIcon = icons.createWithText('eye', `${mod.analytics.views}`, { size: 14, color: 'white', filled: true });
            viewStat.appendChild(viewIcon);
            
            viewStat.addEventListener('click', (e) => {
                e.stopPropagation();
                this.sortByMetric('views');
            });
            
            viewStat.addEventListener('mouseenter', () => {
                viewStat.style.background = 'rgba(102, 126, 234, 0.2)';
                viewStat.style.transform = 'scale(1.05)';
            });
            
            viewStat.addEventListener('mouseleave', () => {
                viewStat.style.background = 'none';
                viewStat.style.transform = 'scale(1)';
            });
            
            statsDiv.appendChild(viewStat);
        }

        // Download count
        if (mod.analytics && mod.analytics.downloads) 
        {
            const dlStat = document.createElement('button');
            dlStat.type = 'button';
            dlStat.className = 'stat-button';
            dlStat.style.cssText = `
                background: none;
                border: none;
                padding: 0.25rem 0.5rem;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                gap: 0.25rem;
                border-radius: 4px;
                transition: all 0.2s;
            `;
            dlStat.title = 'Sort by downloads';
            
            const dlIcon = icons.createWithText('download', `${mod.analytics.downloads}`, { size: 14, color: 'white', filled: true });
            dlStat.appendChild(dlIcon);
            
            dlStat.addEventListener('click', (e) => {
                e.stopPropagation();
                this.sortByMetric('downloads');
            });
            
            dlStat.addEventListener('mouseenter', () => {
                dlStat.style.background = 'rgba(102, 126, 234, 0.2)';
                dlStat.style.transform = 'scale(1.05)';
            });
            
            dlStat.addEventListener('mouseleave', () => {
                dlStat.style.background = 'none';
                dlStat.style.transform = 'scale(1)';
            });
            
            statsDiv.appendChild(dlStat);
        }

        footer.appendChild(statsDiv);

        // Buttons container
        const buttonsDiv = document.createElement('div');
        buttonsDiv.style.cssText = 'display: flex; gap: 0.5rem; flex-wrap: wrap;';

        const { owner, repo } = parseModKey(mod.key);

        buttonsDiv.appendChild(this.createFavouriteButton(mod.key));
        buttonsDiv.appendChild(this.createDetailsButton(mod.key));
        buttonsDiv.appendChild(this.createWikiButton(mod.key));

        if (mod.externalWiki)
            buttonsDiv.appendChild(this.createOfficialWikiButton(mod.externalWiki));

        buttonsDiv.appendChild(this.createGitHubButton(owner, repo, mod.key));
        buttonsDiv.appendChild(this.createCommunityButton(owner, repo));

        footer.appendChild(buttonsDiv);
        content.appendChild(footer);
        li.appendChild(content);

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

        const elements = [
            document.getElementById('sort-by'),
            document.getElementById('sort-order'),
            document.getElementById('type-filter'),
            document.getElementById('search-input'),
            ...document.querySelectorAll('[name="tags"]')
        ].filter(Boolean);

        elements.forEach(element => {
            const eventType = element.type === 'checkbox' ? 'change' : 
                              element.tagName === 'INPUT' ? 'input' : 'change';

            element.addEventListener(eventType, () => {
                const currentPrefs = this.getCurrentPreferences();
                this.preferences.save(currentPrefs);
                this.applyFilters();
            });
        });

        const searchBtn = document.getElementById('search-btn');
        if (searchBtn)
        {
            searchBtn.addEventListener('click', () => {
                const currentPrefs = this.getCurrentPreferences();
                this.preferences.save(currentPrefs);
            });
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const browser = new ModBrowser();
    browser.init();
});