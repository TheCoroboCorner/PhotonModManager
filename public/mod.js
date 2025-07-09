function compareVersions(a, b)
{
    const re = /\d+|[A-Za-z]+/g;
    
    const ta = String(a).match(re) || [];
    const tb = String(b).match(re) || [];
    
    const len = Math.max(ta.length, tb.length);
    for (let i = 0; i < len; i++)
    {
        const xa = ta[i] || '';
        const xb = tb[i] || '';
        
        const na = /^\d+$/.test(xa) ? +xa : xa;
        const nb = /^\d+$/.test(xb) ? +xb : xb;

        if (na < nb) return -1;
        if (na > nb) return 1;
    }
    return 0;
}

class Constraint
{
    constructor(op, ver)
    {
        this.op = op;
        this.ver = ver;
    }

    test(version)
    {
        const cmp = compareVersions(version, this.ver);
        switch (this.op)
        {
            case '>': return cmp > 0;
            case '>=': return cmp >= 0;
            case '<': return cmp < 0;
            case '<=': return cmp <= 0;
            case '=': return cmp === 0;
            default: return true;
        }
    }

    toString()
    {
        return `${this.op}${this.ver}`;
    }
}

class VersionRange {
    constructor(constraints = [])
    {
        this.constraints = constraints;
    }

    static parse(rangeStr)
    {
        const m = String(rangeStr).trim().match(/^(>=|<=|>|<|=)?\s*(.+)$/);
        const op = m[1] || '>=';
        const ver = m[2] || '';
        return new VersionRange([new Constraint(op, ver)]);
    }

    intersect(other)
    {
        return new VersionRange([
            ...this.constraints,
            ...other.constraints
        ]);
    }

    test(version)
    {
        return this.constraints.every(c => c.test(version));
    }

    toString()
    {
        return this.constraints.map(c => c.toString()).join(' and ');
    }
}

function collectDependenciesWithRanges(startKey, data)
{
    const seen = new Set();
    const rangeMap = new Map();

    function recurse(key)
    {
        if (seen.has(key))
            return;
        
        seen.add(key);
        const entry = data[key];
        if (!entry || !Array.isArray(entry.dependencies))
            return;

        for (const raw of entry.dependencies)
        {
            let depKey, verStr;
            if (typeof raw === 'string')
            {
                depKey = raw;
                verStr = '';
            }
            else
            {
                depKey = raw.key;
                verStr = raw.version || '';
            }

            const newRange = VersionRange.parse(verStr);
            if (rangeMap.has(depKey))
            {
                const merged = rangeMap.get(depKey).intersect(newRange);
                rangeMap.set(depKey, merged);
            }
            else rangeMap.set(depKey, newRange);

            recurse(depKey);
        }
    }

    recurse(startKey);
    return rangeMap;
}

async function loadModDetail()
{
    const params = new URLSearchParams(window.location.search);
    const key = params.get('key');
    if (!key)
    {
        document.body.textContent = 'Error: no mod key provided.';
        return;
    }

    const res = await fetch('/data');
    const data = await res.json();
    const e = data[key];
    if (!e)
    {
        document.body.textContent = `Error: new entry for ${key}`;
        return;
    }

    document.getElementById('mod-name').textContent = e.name;
    document.getElementById('mod-author').textContent = Array.isArray(e.author) ? e.author.join(', ') : e.author;
    document.getElementById('mod-published').textContent = new Date(e.published_at).toLocaleString();
    document.getElementById('mod-description').textContent = e.description;

    const favContainer = document.getElementById('mod-favourites-container');
    favContainer.innerHTML = '';
    
    const favBtn = document.createElement('button');
    favBtn.className = 'favourite-btn click-me';
    favBtn.textContent = `❤ Favourite (${e.favourites})`;

    favBtn.style.width = '160px';
    favBtn.style.height = '30px';

    const favs = new Set(JSON.parse(localStorage.getItem('favourited') || '[]'));
    if (favs.has(key))
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

    favContainer.appendChild(favBtn);

    const [repo, owner] = key.split('@');
    document.getElementById('mod-github').href = `https://github.com/${owner}/${repo}`;

    const rangeMap = collectDependenciesWithRanges(key, data);
    const ul = document.getElementById('dep-list');
    ul.innerHTML = '';
    if (rangeMap.size === 0)
    {
        ul.innerHTML = '<li><em>None</em></li>';
    }
    else
    {
        for (const [depKey, vRange] of rangeMap)
        {
            const li = document.createElement('li');
            li.textContent = `${depKey} - versions ${vRange.toString()}`;
            ul.appendChild(li);
        }
    }
}

document.addEventListener('DOMContentLoaded', loadModDetail);