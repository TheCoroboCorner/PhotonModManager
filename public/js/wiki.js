import { fetchJson, getUrlParams } from './utils.js';
import { formatMarkup, replaceVariables } from './formatter.js';
import { toast } from './toast.js';

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
        this.extractModKey();
        if (!this.modKey)
        {
            this.showError('No mod specified');
            toast.error('No mod specified in URL');
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
        else
            this.showEmptyState();
    }

    updateTitle(text)
    {
        const photonEl = document.getElementById('photon');
        if (photonEl)
            photonEl.textContent = text;
    }

    showError(message)
    {
        const detailEl = document.getElementById('detail');
        if (detailEl)
        {
            detailEl.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">❌</div>
                    <h2 style="color: var(--text-primary); margin-bottom: 0.5rem;">Error</h2>
                    <p>${message}</p>
                </div>
            `;
        }
    }

    showEmptyState()
    {
        const detailEl = document.getElementById('detail');
        if (detailEl)
        {
            detailEl.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📭</div>
                    <h2 style="color: var(--text-primary); margin-bottom: 0.5rem;">No Cards Found</h2>
                    <p>This mod doesn't have any documented cards yet.</p>
                </div>
            `;
        }
    }

    extractModKey()
    {
        const params = getUrlParams();
        this.modKey = params.get('mod');

        if (this.modKey)
        {
            const modNameEl = document.getElementById('mod-name');
            if (modNameEl)
            {
                const [repo] = this.modKey.split('@');
                modNameEl.textContent = repo;
            }
        }
    }

    async loadWikiData()
    {
        const detailEl = document.getElementById('detail');
        if (!detailEl)
        {
            console.error('Detail element not found');
            toast.error('UI element missing');
            return;
        }

        this.updateTitle('Loading...');
        detailEl.innerHTML = `
            <div class="loading-container">
                <div class="loading-spinner"></div>
                <p class="loading-text">Loading wiki data...</p>
            </div>
        `;

        const url = `/wiki-data/${this.modKey}.json`;
        console.log('>>> Loading wiki for', this.modKey);

        try
        {
            this.wikiData = await fetchJson(url);
            console.log('[Wiki] Received wiki data:', this.wikiData);
        }
        catch (err)
        {
            console.error('[Wiki] Error fetching wiki data:', err);
            this.showError('Could not load wiki data from server');
            toast.error('Failed to load wiki data');
        }
    }

    processWikiData()
    {
        this.locMap = this.wikiData.locMap || {};
        this.atlases = this.wikiData.atlases || {};
        this.cards = this.wikiData.cards || [];

        console.log('[Wiki] Processed data:');
        console.log('   - Loc entries:', Object.keys(this.locMap).length);
        console.log('   - Atlases:', Object.keys(this.atlases).length);
        console.log('   - Cards:', this.cards.length);
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
                console.warn('[Wiki] Dropping card', card.key, '- no loc entry');

            return hasLoc;
        });

        console.log('[Wiki] Filtered cards:', this.filteredCards.length, 'of', this.cards.length);
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
        const selectEl = document.getElementById('card-select');
        if (!selectEl)
        {
            console.error('[Wiki] Card select element not found!');
            return;
        }

        selectEl.innerHTML = '<option value="" disabled selected>-- Choose a Card --</option>';

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

            selectEl.appendChild(optgroup);
        }

        console.log('[Wiki] Populated selector with', Object.keys(groups).length, 'groups');
    }

    async getAtlasDimensions(atlasPath)
    {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
            img.onerror = () => resolve({ width: 1024, height: 1024 });
            img.src = atlasPath;
        });
    }

    showCard(idx)
    {
        const card = this.filteredCards[idx];
        if (!card)
        {
            console.warn('[Wiki] Card not found at index', idx);
            return;
        }

        console.log('[Wiki] Showing card:', card.key);

        const detailEl = document.getElementById('detail');
        if (!detailEl)
        {
            console.error('[Wiki] Detail element not found!');
            return;
        }

        let locEntry = this.locMap[card.key];
        if (!locEntry)
        {
            const fullKey = this.suffixToKeyMap.get(card.key);
            if (fullKey)
                locEntry = this.locMap[fullKey];
        }

        let cardName = card.key;
        let cardText = '<em style="color: var(--text-secondary);">Localization entry not found.</em>';

        if (locEntry)
        {
            cardName = formatMarkup(locEntry.name);

            const processedLines = locEntry.text.map(line => replaceVariables(line, card.vars || []));
            cardText = processedLines.map(line => formatMarkup(line)).join('<br>');
        }

        let html = '<div class="card-display">';

        html += '<div class="card-header" style="display: flex; align-items: center; gap: 1rem; margin-bottom: 2rem; padding-bottom: 1rem; border-bottom: 2px solid rgba(102, 126, 234, 0.2);">';
        
        if (card.atlas && card.pos && this.atlases[card.atlas])
        {
            const atlas = this.atlases[card.atlas];
            console.log('[Wiki] Atlas for', card.key, ':', atlas);
            
            if (atlas.localPath)
            {
                const spriteWidth = card.w * 2;
                const spriteHeight = card.h * 2;

                const { width, height } = await this.getAtlasDimensions(atlas.localPath);

                const sheetWidth = width;
                const sheetHeight = height;

                const posX = card.pos.x;
                const posY = card.pos.y;

                const offsetX = posX * spriteWidth;
                const offsetY = posY * spriteHeight;

                console.log('[Wiki] Sprite details:', {
                    card: card.key,
                    spriteSize: `${spriteWidth}x${spriteHeight}`,
                    sheetSize: `${sheetWidth}x${sheetHeight}`,
                    position: `${posX},${posY}`,
                    offset: `${offsetX},${offsetY}`
                });
                
                html += `
                    <div style="
                        width: ${spriteWidth}px;
                        height: ${spriteHeight}px;
                        min-height: ${spriteHeight}px;
                        max-height: ${spriteHeight}px;
                        flex-shrink: 0;
                        display: block;
                        background-image: url(${atlas.localPath});
                        background-size: ${sheetWidth}px ${sheetHeight}px;
                        background-position: -${offsetX}px -${offsetY}px;
                        background-repeat: no-repeat;
                        border-radius: 8px;
                        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                        border: 2px solid rgba(102, 126, 234, 0.3);
                        image-rendering: pixelated;
                        overflow: hidden;
                    "></div>
                `;
            }
            else console.warn('[Wiki] No localPath for atlas:', card.atlas);
        }
        else console.warn('[Wiki] No sprite data for card:', card.key);

        html += `<h1 style="margin: 0; font-size: 2rem; font-weight: 700; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">${cardName}</h1>`;
        html += '</div>';

        html += `<div style="background: rgba(30, 18, 82, 0.4); padding: 1.5rem; border-radius: 8px; border-left: 4px solid var(--accent-blue); line-height: 1.8; white-space: pre-wrap;">${cardText}</div>`;
        
        html += '</div>';

        detailEl.innerHTML = html;
        console.log('[Wiki] Card rendered successfully');
    }

    setupEventListeners()
    {
        const selectEl = document.getElementById('card-select');
        if (!selectEl)
        {
            console.error('[Wiki] Card select not found for event listener');
            return;
        }

        selectEl.addEventListener('change', (e) => {
            const idx = parseInt(e.target.value, 10);
            console.log('[Wiki] Select changed to index:', idx);

            if (!isNaN(idx) && idx >= 0)
                this.showCard(idx);
        });

        console.log('[Wiki] Event listeners set up');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('[Wiki] Initializing...');
    const wikiPage = new WikiPage();
    wikiPage.init();
});