async function loadMods() {
    const res = await fetch('/data');
    const data = await res.json();

    const params = new URLSearchParams(window.location.search);
    const sortBy = params.get('sortBy') || 'published_at';
    const order = params.get('order') || 'desc';
    const tagFilter = params.get('tag') || '';

    const sortSelect = document.querySelector('select[name="sortBy"]');
    const orderSelect = document.querySelector('select[name="order"]');
    const tagSelect = document.querySelector('select[name="tag"]');
    if (sortSelect) sortSelect.value = sortBy;
    if (orderSelect) orderSelect.value = order;
    if (tagSelect) tagSelect.value = tagFilter;

    var entries = Object.entries(data)
        .map(([key, e]) => ({key, ...e}));

    const allTags = new Set();
    entries.forEach(e => 
    {
        if (Array.isArray(e.tags))
        {
            e.tags.forEach(t => allTags.add(t));
        }
    });

    if (tagSelect)
    {
        Array.from(allTags).sort().forEach(t => 
        {
            const opt = document.createElement('option');
            opt.value = t;
            opt.textContent = t.charAt(0).toUpperCase() + t.slice(1);
            if (t === tagFilter) opt.selected = true;
            tagSelect.appendChild(opt);
        });
    }

    if (tagFilter) entries = entries.filter(e => Array.isArray(e.tags) && e.tags.includes(tagFilter));

    entries.sort((a, b) => {
        let diff;
        if (sortBy === 'favourites')
        {
            diff = b.favourites - a.favourites;
        }
        else
        {
            diff = Date.parse(b.published_at) - Date.parse(a.published_at)
        }

        return order === 'asc' ? -diff : diff;
    });

    const isIndex = window.location.pathname === '/' || window.location.pathname === '/index.html'
    if (isIndex) entries = entries.slice(0, 5);

    const ul = document.getElementById('mod-list');
    entries.forEach(e => {
        // list element
        const li = document.createElement('li');

        // author text
        const authorText = Array.isArray(e.author) ? e.author.join(', ') : String(e.author);

        // date and time variables
        const dt = new Date(e.published_at);
        const formattedDate = dt.toLocaleDateString(undefined,
        {
            year: 'numeric', month: 'long', day: 'numeric'
        });
        const formattedTime = dt.toLocaleTimeString(undefined,
        {
            hour: 'numeric', 'minute': '2-digit'
        });
        const publishedText = `${formattedDate} at ${formattedTime}`;

        // owner / repo variables
        const [repo, owner] = e.key.split('@');

        // favourites
        const favBtn = document.createElement('button');
        favBtn.className = 'favourite-btn';
        favBtn.textContent = `❤ Favourite (${e.favourites ?? 0})`;

        const favs = new Set(JSON.parse(localStorage.getItem('favourited') || '[]'));
        if (favs.has(e.key))
            favBtn.disabled = true;

        favBtn.addEventListener('click', async () =>
        {
            favBtn.disabled = true;
            const res = await fetch(`/favourite/${encodeURIComponent(e.key)}`, 
            {
                method: 'POST'
            });
            const json = await res.json();
            if (json.success)
            {
                favBtn.textContent = `❤ Favourite (${json.newCount})`;
                favs.add(e.key);
                localStorage.setItem('favourited', JSON.stringify(Array.from(favs)));
            }
            else
            {
                console.warn(json.message || json.error);
            }
        });

        li.innerHTML = `
            <strong>${e.name ?? "Unknown"}</strong> by ${authorText ?? "Unknown"}<br>
            Description: ${e.description ?? "None"}<br>
            Published: ${publishedText ?? "Unknown"}<br>
            Type: ${e.type ?? "Unknown"}<br>
            <a href="https://github.com/${owner}/${repo}" target="_blank">
                View Github page
            </a>
            `;

        // tags
        const tagBar = document.createElement('div');
        tagBar.className = 'tag-bar';

        ;(Array.isArray(e.tags) ? e.tags : []).forEach(tag => 
        {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = tag;
            btn.className = 'tag-btn';
            btn.addEventListener('click', () => 
            {
                const params = new URLSearchParams(window.location.search);
                params.set('tag', tag);
                window.location.search = params.toString();
            });
            tagBar.appendChild(btn);
        });

        li.appendChild(tagBar);

        // favourites again
        const strong = li.querySelector('strong');
        strong.insertAdjacentElement('afterend', favBtn);
        favBtn.insertAdjacentElement('afterend', '<br>');

        ul.appendChild(li);
        ul.appendChild(document.createElement('hr'));
    });
}

document.addEventListener('DOMContentLoaded', loadMods);