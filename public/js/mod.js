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
    }

    showError(message)
    {
        document.body.textContent = `Error: ${message}`;
    }

    setElementText(id, text)
    {
        const element = document.getElementById(id);
        if (element)
            element.textContent = text;
    }

    renderFavouriteButton()
    {
        const container = document.getElementById('mod-favourites-container');
        if (!container)
            return;

        container.innerHTML = '';
        const favBtn = favouritesManager.createFavouriteButton(this.modKey, this.mod.favourites);
        
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

    createVersionRangeItem(rawStr, vRange)
    {
        const li = document.createElement('li');
        const modName = rawStr.split(/\s*\(/)[0];

        // Get the mod key
        const foundKey = Object.keys(this.allMods).find(k => this.allMods[k].id === modName || this.allMods[k].name === modName);

        // Create title
        let titleNode;
        if (foundKey)
        {
            titleNode = document.createElement('a');
            titleNode.href = `/mod.html?key=${encodeURIComponent(foundKey)}`;
            titleNode.textContent = modName;
        }
        else titleNode = document.createTextNode(modName);

        li.appendChild(titleNode);

        // Version range
        const rangeText = document.createTextNode(` - versions: ${vRange.toString()}`);
        li.appendChild(rangeText);

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
            ul.innerHTML = '<li><em>None</em></li>';
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

    renderModDetails()
    {
        // Basic information
        this.setElementText('mod-name', this.mod.name);
        this.setElementText('mod-author', formatAuthor(this.mod.author));
        this.setElementText('mod-published', formatDate(this.mod.published_at));
        this.setElementText('mod-description', this.mod.description);

        // Favourites
        this.renderFavouriteButton();

        // Tags
        this.renderTags();

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