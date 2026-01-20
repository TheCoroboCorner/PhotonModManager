import { fetchJson, getUrlParams } from './utils.js';
import { formatMarkup, replaceVariables } from './formatter.js';

class WikiPage
{
    constructor()
    {
        this.modKey = null;
        this.wikiData = null;
        this.locMap = {};
        this.atlases = {};
        this.cards = [];
        this.filteredCards = [];
        this.validSuffixes = new Set();
        this.suffixToKeyMap = new Map();
    }

    async init()
    {
        this.setupElements();
        this.extractModKey();

        if (!this.modKey)
        {
            this.showError('No mod specified');
            return;
        }

        await this.loadWikiData();
        if (!this.wikiData)
            return;

        this.processWikiData();
        this.buildLocalizationMaps();
        this.filterCards();
        this.populateCardSelector();
        this.setupEventListeners();
        this.updateTitle('Photon Wiki');

        if (this.filteredCards.length > 0)
            this.showCard(0);
    }

    updateTitle(text)
    {
        if (this.elements.photon)
            this.elements.photon.textContent = text;
    }

    showError(message)
    {
        if (this.elements.detail)
            this.elements.detail.textContent = message;
    }

    setupElements()
    {
        this.elements = {
            modTitle: document.getElementById('mod-name'),
            detail: document.getElementById('detail'),
            photon: document.getElementById('photon'),
            select: document.getElementById('card-select'),
            sprite: document.getElementById('sprite'),
            title: document.getElementById('card-title'),
            locText: document.getElementById('loc-text'),
            rawDef: document.getElementById('raw-def')
        };
    }

    extractModKey()
    {
        const params = getUrlParams();
        this.modKey = params.get('mod');

        if (this.modKey && this.elements.modTitle)
        {
            const [repo] = this.modKey.split('@');
            this.elements.modTitle.textContent = repo;
        }
    }

    async loadWikiData()
    {
        if (!this.elements.detail)
        {
            console.error('Detail element not found');
            alert('UI element missing');
            return;
        }

        this.updateTitle('Loading cards...');

        const url = `/wiki-data-cache/${this.modKey}.json`;
        console.log('>>> Loading wiki for', this.modKey);

        try
        {
            this.wikiData = await fetchJson(url);
            console.log('[Client] Received wiki data from server');
        }
        catch (err)
        {
            console.error('[Client] Error fetching wiki data:', err);
            this.showError('Could not load wiki data from server');
        }
    }

    processWikiData()
    {
        this.locMap = this.wikiData.locMap || {};
        this.atlases = this.wikiData.atlases || {};
        this.cards = this.wikiData.cards || [];
    }

    buildLocalizationMaps()
    {
        Object.keys(this.locMap).forEach(key => {
            this.validSuffixes.add(key);
            this.suffixToKeyMap.set(key, key);

            const segments = key.split('_');
            for (let i = 0; i < segments.length; i++)
            {
                const suffix = segments.slice(i).join('_');
                this.validSuffixes.add(suffix);

                if (!this.suffixToKeyMap.has(suffix))
                    this.suffixToKeyMap.set(suffix, key);
            }
        });
    }

    filterCards()
    {
        this.filteredCards = this.cards.filter(card => {
            const hasLoc = this.validSuffixes.has(card.key);
            if (!hasLoc)
                console.warn('Dropping card', card.key, 'due to no loc entry');

            return hasLoc;
        });

        console.log('Filtered cards:', this.filteredCards);
    }

    getCardDisplayName(card)
    {
        let displayName = this.locMap[card.key]?.name;

        if (!displayName)
        {
            const fullKey = this.suffixToKeyMap.get(card.key);
            if (fullKey && this.locMap[fullKey])
                displayName = this.locMap[fullKey].name;
        }

        return displayName || card.key;
    }

    groupCardsByType()
    {
        return this.filteredCards.reduce((acc, card, idx) => {
            (acc[card.type] ||= []).push({ card, idx });
            return acc;
        }, {});
    }

    populateCardSelector()
    {
        if (!this.elements.select)
            return;

        this.elements.select.innerHTML = '';

        const groups = this.groupCardsByType();

        for (const [type, items] of Object.entries(groups))
        {
            const optgroup = document.createElement('optgroup');
            optgroup.label = type;

            items.forEach(({ card, idx }) => {
                const option = document.createElement('option');
                option.value = idx;
                option.textContent = this.getCardDisplayName(card);
                
                optgroup.appendChild(option);
            });

            this.elements.select.appendChild(optgroup);
        }
    }

    renderCardLocalization(card)
    {
        let locEntry = this.locMap[card.key];
        if (!locEntry)
        {
            const fullKey = this.suffixToKeyMap.get(card.key);
            if (fullKey)
                locEntry = this.locMap[fullKey];
        }

        if (locEntry && this.elements.title && this.elements.locText)
        {
            this.elements.title.innerHTML = formatMarkup(locEntry.name);

            const processedLines = locEntry.text.map(line => replaceVariables(line, card.vars || []));

            this.elements.locText.innerHTML = processedLines.map(line => formatMarkup(line)).join('<br>');
        }
        else
        {
            if (this.elements.title)
                this.elements.title.textContent = card.key;
            if (this.elements.locText)
                this.elements.locText.innerHTML = '<i>Localization entry not found.</i>';
        }
    }

    renderCardSprite(card)
    {
        if (!this.elements.sprite)
            return;

        if (!card.atlas || !card.pos || !this.atlases[card.atlas])
        {
            this.elements.sprite.style.display = 'none';
            return;
        }

        const atlas = this.atlases[card.atlas];
        console.log('   atlas key:', card.atlas);
        console.log('   atlasDef:', atlas);

        if (!atlas.localPath)
        {
            this.elements.sprite.style.display = 'none';
            return;
        }

        this.elements.sprite.style.display = 'block';
        this.elements.sprite.style.width = `${atlas.px * 2}px`;
        this.elements.sprite.style.height = `${atlas.py * 2}px`;
        this.elements.sprite.style.backgroundImage = `url(${atlas.localPath})`;
        this.elements.sprite.style.backgroundPosition = `-${card.pos.x * atlas.px * 2}px -${card.pos.y * atlas.py * 2}px`;
    }

    showCard(idx)
    {
        const card = this.filteredCards[idx];
        if (!card)
            return;

        console.log('CARD:', card);

        this.renderCardLocalization(card);
        this.renderCardSprite(card);

        if (this.elements.rawDef)
            this.elements.rawDef.style.display = 'none';
    }

    setupEventListeners()
    {
        if (!this.elements.select)
            return;

        this.elements.select.addEventListener('change', () => {
            const idx = parseInt(this.elements.select.value, 10);

            if (!isNaN(idx))
                this.showCard(idx);
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const wikiPage = new WikiPage();
    wikiPage.init();
});