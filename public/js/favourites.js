const STORAGE_KEY = 'favourited';

export class FavouritesManager
{
    constructor()
    {
        this.favourites = this.loadFavourites();
    }

    loadFavourites()
    {
        try
        {
            const stored = localStorage.getItem(STORAGE_KEY);
            return new Set(JSON.parse(stored || '[]'));
        }
        catch (err)
        {
            console.error('Error loading favourites:', err);
        }
    }

    saveFavourites()
    {
        try
        {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(this.favourites)));
        }
        catch (err)
        {
            console.error('Error saving favourites:', err);
        }
    }

    isFavourited(modKey)
    {
        return this.favourites.has(modKey);
    }

    add(modKey)
    {
        this.favourites.add(modKey);
        this.saveFavourites();
    }

    async toggleFavourite(modKey)
    {
        const response = await fetch(`/favourite/${encodeURIComponent(modKey)}`, {
            method: 'POST'
        });

        const json = await response.json();

        if (json.success)
        {
            this.add(modKey);
            return json.newCount;
        }
        else throw new Error(json.message || json.error || 'Failed to favourite');
    }

    createFavouriteButton(modKey, currentCount)
    {
        const button = document.createElement('button');
        button.className = 'favourite-btn click-me';
        button.textContent = `❤ Favourite (${currentCount})`;
        button.style.width = '160px';
        button.style.height = '30px';

        if (this.isFavourited(modKey))
            button.disabled = true;

        button.addEventListener('click', async () => {
            button.disabled = true;
            
            try 
            {
                const newCount = await this.toggleFavourite(modKey);
                button.textContent = `❤ Favourite (${newCount})`;
            }
            catch (err)
            {
                console.error('Favourite error:', err);
                button.disabled = false;
                alert(`Error: ${err.message}`);
            }
        });

        return button;
    }
}

export const favouritesManager = new FavouritesManager();