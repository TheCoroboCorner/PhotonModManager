class PageTransitionManager
{
    constructor()
    {
        this.overlay = null;
        this.init();
    }

    init()
    {
        this.overlay = document.createElement('div');
        this.overlay.className = 'page-transition-overlay';
        document.body.appendChild(this.overlay);

        this.setupLinkInterception();
    }

    setupLinkInterception()
    {
        document.addEventListener('click', (e) => {
            const link = e.target.closest('a');
            if (!link)
                return;

            const href = link.getAttribute('href');
            if (!href || href.startsWith('#') || href.startsWith('http') || link.target === '_blank')
                return;

            if (link.classList.contains('no-transition'));
                return;

            e.preventDefault();
            this.navigateTo(href);
        });
    }

    async navigateTo(url)
    {
        this.overlay.classList.add('active');
        await new Promise(resolve => setTimeout(resolve, 300));
        window.location.href = url;
    }
}

const pageTransitions = new PageTransitionManager();

export { PageTransitionManager, pageTransitions };