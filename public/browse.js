async function loadMods() {
    const res = await fetch('/data');
    const data = await res.json();
    const entries = Object.entries(data)
        .map(([key, e]) => ({ key, ...e }))
        .sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at)); // or your sort logic

    const ul = document.getElementById('mod-list');
    entries.forEach(e => {
        const li = document.createElement('li');
        li.innerHTML = `
            <strong>${e.name}</strong> by ${e.author}<br>
            Published: ${e.published_at}<br>
            Favourites: ${e.favourites}<br>
            <a href="https://github.com/${e.git_owner}/${e.git_repo}" target="_blank">
                View Github page
            </a>
            `;
        ul.appendChild(li);
        ul.appendChild(document.createElement('hr'));
    });
}

document.addEventListener('DOMContentLoaded', loadMods);