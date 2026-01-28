class KeyboardShortcuts
{
    constructor()
    {
        this.shortcuts = new Map();
        this.init();
    }

    init()
    {
        document.addEventListener('keydown', (e) => this.handleKeyPress(e));
        this.registerDefaultShortcuts();
    }

    register(key, handler, options = {})
    {
        const combo = {
            key: key.toLowerCase(),
            ctrl: options.ctrl || false,
            shift: options.shift || false,
            alt: options.alt || false,
            handler
        };

        const comboKey = this.comboKey(combo);
        this.shortcuts.set(comboKey, combo);
    }

    getComboKey(combo)
    {
        const parts = [];

        if (combo.ctrl)
            parts.push('ctrl');
        if (combo.shift)
            parts.push('shift');
        if (combo.alt)
            parts.push('alt');

        parts.push(combo.key);
        return parts.join('+');
    }

    handleKeyPress(e)
    {
        if (e.target.matches('input, textarea, select'))
            if (e.key !== 'Escape')
                return;

        const combo = {
            key: e.key.toLowerCase(),
            ctrl: e.ctrlKey,
            shift: e.shiftKey,
            alt: e.altKey
        };

        const comboKey = this.getComboKey(combo);
        const shortcut = this.shortcuts.get(comboKey);

        if (shortcut)
        {
            e.preventDefault();
            shortcut.handler(e);
        }
    }

    registerDefaultShortcuts()
    {
        // Focus search
        this.register('/', () => {
            const searchInput = document.getElementById('search-input');
            if (searchInput)
            {
                searchInput.focus();
                searchInput.select();
            }
        });

        // Clear search
        this.register('escape', () => {
            const searchInput = document.getElementById('search-input');
            if (searchInput && searchInput === document.activeElement)
            {
                searchInput.value = '';
                searchInput.blur();

                const params = new URLSearchParams(window.location.search);
                if (params.has('search'))
                {
                    params.delete('search');
                    window.location.search = params.toString();
                }
            }
        });

        let lastKey = null;
        let lastKeyTime = 0;

        this.register('g', () => {
            lastKey = 'g';
            lastKeyTime = Date.now();
        });

        // Scroll to top
        this.register('t', () => {
            if (lastKey === 'g' && Date.now() - lastKeyTime < 1000)
            {
                window.scrollTo({ top: 0, behavior: 'smooth' });
                lastKey = null;
            }
        });

        // Scroll to bottom
        this.register('b', () => {
            if (lastKey === 'g' && Date.now() - lastKeyTime < 1000)
            {
                window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                lastKey = null;
            }
        });

        if (window.location.pathname.includes('browse'))
        {
            let selectedCard = -1;

            this.register('arrowdown', () => {
                const cards = document.querySelectorAll('.mod-card');
                if (cards.length === 0)
                    return;

                selectedCard = Math.min(selectedCard + 1, cards.length - 1);
                cards[selectedCard].scrollIntoView({ behavior: 'smooth', block: 'center' });
                cards[selectedCard].style.outline = '2px solid var(--accent-blue)';

                cards.forEach((card, i) => {
                    if (i !== selectedCard)
                        card.style.outline = 'none';
                });
            });

            this.register('arrowup', () => {
                const cards = document.querySelectorAll('.mod-card');
                if (cards.length === 0) return;

                selectedCard = Math.max(selectedCard - 1, 0);
                cards[selectedCard].scrollIntoView({ behavior: 'smooth', block: 'center' });
                cards[selectedCard].style.outline = '2px solid var(--accent-blue)';
                
                cards.forEach((card, i) => {
                    if (i !== selectedCard) 
                        card.style.outline = 'none';
                });
            });

            this.register('enter', () => {
                const cards = document.querySelectorAll('.mod-card');
                if (selectedCard >= 0 && selectedCard < cards.length) 
                {
                    const detailsLink = cards[selectedCard].querySelector('a[href*="mod.html"]');
                    if (detailsLink) 
                        detailsLink.click();
                }
            });
        }

        this.register('?', () => this.showHelp(), { shift: true });
    }

    showHelp() 
    {
        const helpText = `
            <div style="max-width: 500px;">
                <h3 style="margin-top: 0;">⌨️ Keyboard Shortcuts</h3>
                <table style="width: 100%; border-collapse: collapse;">
                    <tr><td style="padding: 0.5rem;"><code>/</code></td><td>Focus search</td></tr>
                    <tr><td style="padding: 0.5rem;"><code>Esc</code></td><td>Clear search / unfocus</td></tr>
                    <tr><td style="padding: 0.5rem;"><code>g</code> then <code>t</code></td><td>Scroll to top</td></tr>
                    <tr><td style="padding: 0.5rem;"><code>g</code> then <code>b</code></td><td>Scroll to bottom</td></tr>
                    <tr><td style="padding: 0.5rem;"><code>↑</code> / <code>↓</code></td><td>Navigate cards (browse page)</td></tr>
                    <tr><td style="padding: 0.5rem;"><code>Enter</code></td><td>Open selected card</td></tr>
                    <tr><td style="padding: 0.5rem;"><code>?</code></td><td>Show this help</td></tr>
                </table>
            </div>
        `;

        // Use toast for help
        if (window.toast) 
        {
            const toastEl = window.toast.show(helpText, 'info', 10000);
            toastEl.querySelector('.toast-message').innerHTML = helpText;
        } 
        else alert('Keyboard shortcuts:\n/ - Focus search\nEsc - Clear search\ng+t - Top\ng+b - Bottom\n↑/↓ - Navigate\nEnter - Open');
    }
}

const keyboard = new KeyboardShortcuts();

export { KeyboardShortcuts, keyboard };