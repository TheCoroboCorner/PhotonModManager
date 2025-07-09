async function loadMods() {
    const res = await fetch('/data');
    const data = await res.json();

    const params = new URLSearchParams(window.location.search);
    const sortBy = params.get('sortBy') || 'published_at';
    const order = params.get('order') || 'desc';
    const tagFilter = params.getAll('tags');
    const exclude = params.get('exclude') === '1';

    let entries = Object.entries(data).map(([key, e]) => ({key, ...e}));

    const allTags = new Set();
    entries.forEach(e => {
        if (Array.isArray(e.tags))
            e.tags.forEach(t => allTags.add(t));
    });

    const tagSelect = document.querySelector('select[name="tags"');
    if (tagSelect)
    {
        tagSelect.innerHTML = '';

        tagSelect.appendChild(new Option('All', ''));
        Array.from(allTags).sort().forEach(tag => {
            const opt = new Option(tag, tag);
            if (tagFilter.includes(tag))
                opt.selected = true;

            tagSelect.appendChild(opt);
        });
    }

    if (rawTags.length)
    {
        entries = entries.filter(e => {
            const t = Array.isArray(e.tags) ? e.tags : [];
            const has = rawTags.some(tag => t.includes(tag));
            return exclude ? !has : has;
        });
    }

    console.log(`Mods before filter: ${Object.keys(data).length}, after filter: ${entries.length}`);

    entries.sort((a, b) => {
        const diff = sortBy === 'favourites'
                    ? b.favourites - a.favourites
                    : Date.parse(b.published_at) - Date.parse(a.published_at);

        return order === 'asc' ? -diff : diff;
    });

    /*

    const sortSelect = document.querySelector('select[name="sortBy"]');
    const orderSelect = document.querySelector('select[name="order"]');
    const tagSelect = document.querySelector('select[name="tags"]');
    if (sortSelect) sortSelect.value = sortBy;
    if (orderSelect) orderSelect.value = order;
    if (tagSelect) 
    {
        tagSelect.innerHTML = '';
        Array.from(allTags).sort().forEach(tag => {
            const opt = document.createElement('option');
            opt.value = tag;
            opt.textContent = tag.charAt(0).toUpperCase() + tag.slice(1);

            if (tagFilter.includes(tag)) opt.selected = true;
            tagSelect.appendChild(opt);
        });
    }    

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
        tagSelect.innerHTML = '';
        const defaultOpt = document.createElement('option');
        defaultOpt.value = '';
        defaultOpt.textContent = 'All';
        if (!tagFilter) defaultOpt.selected = true;
        tagSelect.appendChild(defaultOpt);
        
        Array.from(allTags).sort().forEach(t => 
        {
            const opt = document.createElement('option');
            opt.value = t;
            opt.textContent = t.charAt(0).toUpperCase() + t.slice(1);
            if (t === tagFilter) opt.selected = true;
            tagSelect.appendChild(opt);
        });
    }

    const opts = document.getElementById('tag-filter-options');
    opts.innerHTML = '';

    Array.from(allTags).sort().forEach(tag => {
        const id = `filter-tag-${tag}`;
        const label = document.createElement('label');
        label.htmlFor = id;
        label.style.display = 'block';
        label.style.margin = '0.25em 0';

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.name = 'tags';
        cb.value = tag;
        cb.id = id;

        if (tagFilter.includes(tag))
            cb.checked = true;

        label.appendChild(cb);
        label.appendChild(document.createTextNode(' ' + tag.charAt(0).toUpperCase() + tag.slice(1)));
        opts.appendChild(label);
    });

    console.log(`Before filter: ${entries.length} mods`);
    if (tagFilter.length)
    {
        entries = entries.filter(e => {
            const tags = Array.isArray(e.tags) ? e.tags : [];
            const has = rawTags.some(tag => tags.includes(tag));
            return exclude ? !has : has;
        });
    }
    console.log(`After filter: ${entries.length} mods`);

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

    */
    
    // tag limit when it's in the index page
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

        li.innerHTML = `
            <a href="mod.html?key=${encodeURIComponent(e.key)}"><strong>${e.name ?? "Unknown"}</strong></a> by ${authorText ?? "Unknown"}<br>
            <button class="favourite-btn click-me">❤ Favourite (${e.favourites})</button><br>
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

        (Array.isArray(e.tags) ? e.tags : []).forEach(tag => 
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

        // favourites
        const favBtn = li.querySelector('.favourite-btn');
        favBtn.style.width = '160px';
        favBtn.style.height = '30px';

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

        ul.appendChild(li);
        ul.appendChild(document.createElement('hr'));
    });
}

document.addEventListener('DOMContentLoaded', loadMods);