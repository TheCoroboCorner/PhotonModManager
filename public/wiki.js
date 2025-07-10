async function listFiles(owner, repo, dir='')
{
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${dir}`);
    if (!res.ok)
        return [];

    const items = await res.json();

    let out = [];
    for (let i of items)
    {
        if (i.type === 'file')
            out.push(i.path);
        else if (i.type === 'dir')
            out.push(...await listFiles(owner, repo, i.path));
    }

    return out;
}

function parseAtlasDefs(txt)
{
    const out = {};
    txt.replace(/SMODS\.Atlas\s*{([\s\S]*?)}/g, (_, body) => {
        const key  = /key\s*=\s*['"]([^'"]+)['"]/.exec(body)?.[1];
        const path = /path\s*=\s*['"]([^'"]+)['"]/.exec(body)?.[1];

        const px   = +(/px\s*=\s*(\d+)/.exec(body)?.[1]||0);
        const py   = +(/py\s*=\s*(\d+)/.exec(body)?.[1]||0);

        if (key && path)
            out[key] = { path, px, py };
    });
    return out;
}

function parseAllEntities(txt) {
    const out = [];
    const re  = /SMODS\.([A-Za-z0-9_]+)\s*{([\s\S]*?)}/g;
    let m;
    while (m = re.exec(txt))
    {
        const type = m[1];
        if (type === 'Atlas')
            continue;

        const body = m[2];
        const key  = /key\s*=\s*['"]([^'"]+)['"]/.exec(body)?.[1];
        if (!key)
            continue;

        const atlas = /atlas\s*=\s*['"]([^'"]+)['"]/.exec(body)?.[1] || null;
        const pm    = /pos\s*=\s*{[^}]*x\s*=\s*(\d+)[^}]*y\s*=\s*(\d+)/.exec(body);
        const pos   = pm ? { x:+pm[1], y:+pm[2] } : null;

        out.push({ type, key, atlas, pos, raw: body.trim() });
    }
    return out;
}

async function fetchRaw(owner, repo, p)
{
    const r = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/main/${p}`);
    return r.ok ? r.text() : '';
}

function parseLoc(txt)
{
    const map = {};
    const re = /SMODS\.([A-Za-z0-9_]+)\.([A-Za-z0-9_]+)\s*=\s*['"]([^'"]*)['"]/g;
    let m;
    while (m = re.exec(txt))
    {
        const type = m[1];
        const key = m[2];
        const val = m[3];
        map[`${type}.${key}`] = val;
    }

    return map;
}

;(async function() {
    const params = new URLSearchParams(location.search);
    const modKey = params.get('mod');
    if (!modKey)
        return document.getElementById('detail').textcontent = 'No mod specified';

    const [repo, owner] = modKey.split('@');

    const files = await listFiles(owner, repo);

    const locPath = files.find(p => p.endsWith('en-us.lua')) || '';
    const locTxt = await fetchRaw(owner, repo, locPath);
    const locMap = parseLoc(locTxt);

    const codeFiles = files.filter(p => p.endsWith('.lua') && !p.endsWith('en-us.lua'));

    const atlasDefs = {};
    const cards =[];
    for (let p of codeFiles)
    {
        const txt = await fetchRaw(owner, repo, p);
        Object.assign(atlasDefs, parseAtlasDefs(txt));
        cards.push(...parseAllEntities(txt));
    }
    
    for (let key in atlasDefs)
    {
        const at = atlasDefs[key];
        const url = `https://raw.githubusercontent.com/${owner}/${repo}/main/${at.path}`;
        try
        {
            const buf = await fetch(url).then(r => r.arrayBuffer());
            const dir = `images/${repo}`;
            await fetch(`/save-image?repo=${repo}&name=${encodeURIComponent(at.path)}`, { method: 'POST', body: buf });
        }
        catch {}
    }

    const listDiv = document.getElementById('card-list');
    cards.forEach((c, i) => {
        const div = document.createElement('div');
        div.textContent = `${c.type}.${c.key}`;
        div.className = 'card-link';
        div.onclick = () => showCard(i);
        listDiv.appendChild(div);
    });


    const sprite = document.getElementById('sprite');
    const title = document.getElementById('card-title');
    const locP = document.getElementById('loc-text');
    const rawPre = document.getElementById('raw-def');

    function showCard(idx)
    {
        listDiv.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
        listDiv.children[idx].classList.add('selected');

        const c = cards[idx];
        title.textContent = `${c.type}.${c.key}`;
        locP.textContent = locMap[`${c.type}.${c.key}`] || '-no text-';
        rawPre.textContent = c.raw;

        if (c.atlas && c.pos && atlasDefs[c.atlas])
        {
            const at = atlasDefs[c.atlas];
            sprite.style.display = 'block';
            sprite.style.width = at.px + 'px';
            sprite.style.height = at.py + 'px';
            sprite.style.backgroundImage = `url(https://raw.githubusercontent.com/${owner}/${repo}/main/${at.path})`;
            sprite.style.backgroundPosition = `-${c.pos.x * at.px}px -${c.pos.y * at.py}px`;
        }
        else
        {
            sprite.style.display = 'none';
        }
    }

    if (cards.length)
        showCard(0);
})();