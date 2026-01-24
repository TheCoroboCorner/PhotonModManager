const CONSENT_KEY = 'cookie_consent';

class CookieConsent
{
    constructor()
    {
        this.hasConsented = this.checkConsent();
    }

    checkConsent()
    {
        try
        {
            return localStorage.getItem(CONSENT_KEY) === 'true';
        }
        catch
        {
            return false;
        }
    }

    giveConsent()
    {
        try
        {
            localStorage.setItem(CONSENT_KEY, 'true');
            this.hasConsented = true;
        }
        catch (err)
        {
            console.error('Failed to save consent:', err);
        }
    }

    show()
    {
        if (this.hasConsented)
            return;

        const banner = this.createBanner();
        document.body.appendChild(banner);

        requestAnimationFrame(() => { banner.classList.add('show') });
    }

    createBanner()
    {
        const banner = document.createElement('div');
        banner.className = 'cookie-consent';
        banner.innerHTML = `
            <div class="cookie-consent-content">
                <div class="cookie-consent-text">
                    <strong>Cookie Notice</strong>
                    <p>
                        We use cookies on this site to remember your favourites and (eventually) preferences.
                        By using this site, you consent to our use of cookies.
                    </p>
                </div>
                <div class="cookie-consent-actions">
                    <button class="cookie-consent-btn" id="cookie-accept">
                        Accept
                    </button>
                </div>
            </div>
        `;

        const acceptBtn = banner.querySelector('#cookie-accept');
        acceptBtn.addEventListener('click', () => {
            this.giveConsent();
            this.hide(banner);
        });

        return banner;
    }

    hide(banner)
    {
        banner.classList.remove('show');
        setTimeout(() => { banner.remove(); }, 300);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const consent = new CookieConsent();
    consent.show();
});

export { CookieConsent };