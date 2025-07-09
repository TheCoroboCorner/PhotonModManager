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
    /**
     * @param {{ver:string, inclusive:boolean, isLower:boolean}} lb
     * @param {{ver:string, inclusive:boolean, isLower:boolean}} ub 
     */

    constructor(lb = null, ub = null)
    {
        this.min = lb;
        this.max = ub;
    }

    static parse(str)
    {
        const m = String(str).trim().match(/^(>=|<=|>|<|=)?\s*(.+)$/);
        const op = m[1] || '>=';
        const ver = m[2] || '';

        switch (op)
        {
            case '>=': return new VersionRange({ver, inclusive: true, isLower: true}, null);
            case '>': return new VersionRange({ver, inclusive: false, isLower: true}, null);
            case '<=': return new VersionRange(null, {ver, inclusive: true, isLower: false});
            case '<': return new VersionRange(null, {ver, inclusive: false, isLower: false});
            case '=': return new VersionRange({ver, inclusive: true, isLower: true}, {ver, inclusive: true, isLower: false});
            default: return new VersionRange();
        }
    }

    intersect(other)
    {
        let newMin = this.min, newMax = this.max;
        if (other.min)
        {
            if (!newMin || compareVersions(other.min.ver, newMin.ver) > 0 || compareVersions(other.min.ver, newMin.ver) === 0 && other.min.inclusive === false)
                newMin = other.min;
        }
        if (other.max)
        {
            if (!newMax || compareVersions(other.max.ver, newMax.ver) < 0 || compareVersions(other.max.ver, newMax.ver) === 0 && other.max.inclusive === false)
                newMax = other.max;
        }

        return new VersionRange(newMin, newMax);
    }

    toString()
    {
        if (!this.min && !this.max)
            return "Any";

        if (this.min && this.max)
        {
            const cmp = compareVersions(this.min.ver, this.max.ver);

            if (cmp > 0 || (cmp === 0 && (!this.min.inclusive || !this.max.inclusive)))
                return `[Version requirement conflict detected; version ${this.max.ver} recommended]`;

            if (cmp === 0 && this.min.inclusive && this.max.inclusive)
                return this.min.ver;
        }

        const left = this.min
            ? (this.min.inclusive ? '[' : '(') + this.min.ver
            : '( ...';
        
        const right = this.max
            ? this.max.ver + (this.max.inclusive ? ']' : ')')
            : '... )';
        
        
        return `${left}, ${right}`;
    }
}

/**
 * 
 * @param {string} fieldName  either "dependencies" or "conflicts"
 * @param {*} startKey        the mod key to start from
 * @param {*} data            your full data object
 * @returns Map<rawStr, VersionRange>
 */
function collectRanges(fieldName, startKey, data)
{
    const seen = new Set();
    const rangeMap = new Map();

    function recurse(key)
    {
        if (seen.has(key))
            return;
        
        seen.add(key);
        const entry = data[key];
        if (!entry || !Array.isArray(entry[fieldName]))
            return;

        for (const raw of entry[fieldName])
        {
            const rawStr = (typeof raw === 'string')
                            ? raw
                            : `${raw.key} (${raw.version})`;

            const versionPart = rawStr.match(/\((.*)\)$/)?.[1] || '';
            const newRange = VersionRange.parse(versionPart);

            if (rangeMap.has(rawStr))
            {
                const merged = rangeMap.get(rawStr).intersect(newRange);
                rangeMap.set(rawStr, merged);
            }
            else rangeMap.set(rawStr, newRange);

            const modName = rawStr.split(/\s*\(/)[0];
            const foundKey = Object.keys(data).find(k => data[k].id === modName);
            if (foundKey) 
                recurse(foundKey);
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

    const li = document.createElement('li');

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

    const [repo, owner] = key.split('@');
    document.getElementById('mod-github').href = `https://github.com/${owner}/${repo}`;

    const depRanges = collectRanges('dependencies', key, data);
    const confRanges = collectRanges('conflicts', key, data);

    function renderRangeList(rangeMap, ulID)
    {
        const ul = document.getElementById(ulID);
        ul.innerHTML = '';

        if (rangeMap.size === 0)
        {
            ul.innerHTML = '<li><em>None</em></li>';
            return;
        }
        
        for (const [rawStr, vRange] of rangeMap)
        {
            const li = document.createElement('li');
            const modName = rawStr.split(/\s*\(/)[0];
            const foundKey = Object.keys(data).find(k => data[k].id === modName || data[k].name === modName);

            let titleNode;
            if (foundKey)
            {
                titleNode = document.createElement('a');
                titleNode.href = `/mod.html?key=${encodeURIComponent(foundKey)}`;
                titleNode.textContent = modName;
            }
            else titleNode = document.createTextNode(modName);

            li.appendChild(titleNode);

            const rangeText = document.createTextNode(` - versions: ${vRange.toString()}`);
            li.appendChild(rangeText);

            ul.appendChild(li);
        }
    }

    renderRangeList(depRanges, 'dep-list');
    renderRangeList(confRanges, 'conf-list');
}

document.addEventListener('DOMContentLoaded', loadModDetail);