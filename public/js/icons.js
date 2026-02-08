class IconLoader
{
    constructor()
    {
        this.cache = new Map();
        this.basePath = '/icons';
    }

    create(name, options = {})
    {
        const {
            size = 16,
            colour = 'currentColor',
            className = '',
            title = ''
        } = options;

        const wrapper = document.createElement('span');
        wrapper.className = `icon ${className}`;
        wrapper.style.cssText = `
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: ${size}px;
            height: ${size}px;
            color: ${colour};
            flex-shrink: 0;
        `;

        if (title)
            wrapper.title = title;

        this.loadSVG(name).then(svg => {
            if (svg)
            {
                svg.style.width = '100%';
                svg.style.height = '100%';
                wrapper.appendChild(svg);
            }
            else wrapper.textContent = '•';
        });

        return wrapper;
    }

    async loadSVG(name)
    {
        if (this.cache.has(name))
            return this.cache.get(name).cloneNode(true);

        try
        {
            const response = await fetch(`${this.basePath}/${name}.svg`);

            if (!response.ok)
            {
                console.warn(`[Icons] Failed to load icon: ${name}`);
                return null;
            }

            const svgText = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(svgText, 'image/svg+xml');
            const svg = doc.querySelector('svg');

            if (!svg)
            {
                console.warn(`[Icons] Invalid SVG for icon: ${name}`);
                return null;
            }

            if (!svg.hasAttribute('viewBox'))
                svg.setAttribute('viewBox', '0 0 24 24');

            svg.setAttribute('fill', 'none');
            svg.setAttribute('stroke', 'currentColor');
            svg.setAttribute('stroke-width', '2');
            svg.setAttribute('stroke-linecap', 'round');
            svg.setAttribute('stroke-linejoin', 'round');

            this.cache.set(name, svg);

            return svg.cloneNode(true);
        }
        catch (err)
        {
            console.error(`[Icons] Error loading icon ${name}:`, err);
            return null;
        }
    }

    createWithText(name, text, options = {})
    {
        const {
            size = 16,
            colour = 'currentColor',
            gap = '0.375rem',
            className = ''
        } = options;

        const container = document.createElement('span');
        container.className = `icon-with-text ${className}`;
        container.style.cssText = `
            display: inline-flex;
            align-items: center;
            gap: ${gap};
            color: ${colour};
        `;

        const icon = this.create(name, { size, colour });
        const textNode = document.createElement('span');
        textNode.textContent = text;

        container.appendChild(icon);
        container.appendChild(textNode);

        return container;
    }

    createButton(name, options = {})
    {
        const {
            size = 20,
            colour = 'currentColor',
            title = '',
            onClick = null,
            className = ''
        } = options;

        const button = document.createElement('button');
        button.type = 'button';
        button.className = `icon-button ${className}`;
        button.style.cssText = `
            background: none;
            border: none;
            padding: 0.375rem;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            color: ${colour};
            transition: all 0.2s;
            border-radius: 4px;
        `;

        if (title)
            button.title = title;

        const icon = this.create(name, { size, colour });
        button.appendChild(icon);

        if (onClick)
            button.addEventListener('click', onClick);

        button.addEventListener('mouseenter', () => {
            button.style.background = 'rgba(102, 126, 234, 0.1)';
            button.style.transform = 'scale(1.1)';
        });

        button.addEventListener('mouseleave', () => {
            button.style.background = 'none';
            button.style.transform = 'scale(1)';
        });

        return button;
    }

    async preload(iconNames)
    {
        await Promise.all(iconNames.map(name => this.loadSVG(name)));
        console.log(`[Icons] Preloaded ${iconNames.length} icons`);
    }
}

const icons = new IconLoader();

icons.preload([
    'heart',
    'heart-filled',
    'eye',
    'download',
    'tag',
    'book',
    'star',
    'star-filled',
    'github',
    'external-link',
    'message-circle'
]);

export default icons;
if (typeof window !== 'undefined')
    window.icons = icons;