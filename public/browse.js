async function loadMods() {
    const res = await fetch('/data');
    const data = await res.json();

    const params = new URLSearchParams(window.location.search);
    const sortBy = params.get('sortBy') || 'published_at';
    const order = params.get('order') || 'desc';

    const sortSelect = document.querySelector('select[name="sortBy"]');
    const orderSelect = document.querySelector('select[name="order"]');
    if (sortSelect) sortSelect.value = sortBy;
    if (orderSelect) orderSelect.value = order;

    const entries = Object.entries(data)
        .map(([key, e]) => ({key, ...e}));

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

    console.log("Pathname:", window.location.pathname);
    const path = window.location.pathname;
    const isIndex = path === '/' || path === '';
    if (isIndex) entries = entries.slice(0, 5);

    const ul = document.getElementById('mod-list');
    entries.forEach(e => {
        const li = document.createElement('li');
        const authorText = Array.isArray(e.author) ? e.author.join(', ') : String(e.author);

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

        li.innerHTML = `
            <strong>${e.name}</strong> by ${authorText}<br>
            Published: ${publishedText}<br>
            Favourites: ${e.favourites}<br>
            Type: ${e.type}<br>
            <a href="https://github.com/${e.git_owner}/${e.git_repo}" target="_blank">
                View Github page
            </a>
            `;
        ul.appendChild(li);
        ul.appendChild(document.createElement('hr'));
    });
}

document.addEventListener('DOMContentLoaded', loadMods);