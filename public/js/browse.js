import { fetchJson, formatDate, formatAuthor, parseModKey, getUrlParams } from './utils.js';
import { favouritesManager } from './favourites.js';

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
        if (!tagSelect)
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
        const { repo, owner } = parseModKey(mod.key);

        // Basic information
        li.innerHTML = `
            <a href="mod.html?key=${encodeURIComponent(mod.key)}">
                <strong>${mod.name ?? 'Unknown'}</strong>
            </a> by ${formatAuthor(mod.author) ?? 'Unknown'} <br>
            <div class="favourite-container"></div>
            Description: ${mod.description ?? 'None'} <br>
            Published: ${formatDate(mod.published_at) ?? 'Unknown'} <br>
            Type: ${mod.type ?? 'Unknown'} <br>
            <a href="https://github.com/${owner}/${repo}" target="_blank">
                View GitHub page
            </a>
        `;

        // Favourites
        const favContainer = li.querySelector('.favourite-container');
        const favBtn = favouritesManager.createFavouriteButton(mod.key, mod.favourites);
        favContainer.appendChild(favBtn);
        favContainer.appendChild(document.createElement('br'));

        // Tags
        const tagBar = this.createTagBar(mod.tags || []);
        li.appendChild(tagBar);

        return li;
    }

    renderMods()
    {
        const ul = document.getElementById('mod-list');
        if (!ul)
            return;

        ul.innerHTML = '';
        const entries = this.getFilteredAndSortedMods();

        entries.forEach(mod => {
            const li = this.createModListItem(mod);
            ul.appendChild(li);
            ul.appendChild(document.createElement('hr'));
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const browser = new ModBrowser();
    browser.init();
});