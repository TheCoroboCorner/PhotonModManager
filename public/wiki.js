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

        // if (!/^[A-Z]/.test(type))
        //     continue;

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

function parseLoc(txt) {
    const map = {};

    const descMatch = txt.match(/descriptions\s*=\s*{([\s\S]*?)},\s*[^}]*$/m);
    if (!descMatch) 
        return map;
    const body = descMatch[1];

    const typeRe = /[A-Za-z0-9_]+\s*=\s*{([\s\S]*?)(?=^[ \t]*[A-Za-z0-9_]+\s*=|\s*$)}/gm;
    let tm;
    while (tm = typeRe.exec(body)) 
    {
        const typeBody = tm[1];

        const keyRe = /([A-Za-z0-9_]+)\s*=\s*{([\s\S]*?)(?=^[ \t]*[A-Za-z0-9_]+\s*=|\s*$)}/gm;
        let km;
        while (km = keyRe.exec(typeBody))
        {
            const cardKey = km[1];
            const entry   = km[2];

            const nameMatch = entry.match(/name\s*=\s*['"]([^'"]+)['"]/);
            const name = nameMatch ? nameMatch[1] : '';

            const textMatch = entry.match(/text\s*=\s*{([\s\S]*?)}/m);
            const lines = [];
            if (textMatch)
            {
                const txtBody = textMatch[1];
                const lineRe  = /['"]([^'"]*)['"]/g;
                let lm;
                while (lm = lineRe.exec(txtBody))
                {
                    lines.push(lm[1]);
                }
            }

            map[cardKey] = { name, text: lines };
        }
    }

    return map;
}

document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(location.search);
  const modKey = params.get('mod');
  if (!modKey)
  {
    document.getElementById('detail').textContent = 'No mod specified';
    return;
  }
  const [repo, owner] = modKey.split('@');
  console.log('>>> Loading wiki for', repo, owner);

  const files = await listFiles(owner, repo);
  console.log('Files found:', files.length);

  const locPath = files.find(p => p.endsWith('en-us.lua')) || '';
  const locTxt  = locPath ? await fetchRaw(owner, repo, locPath) : '';
  const locMap  = parseLoc(locTxt);
  console.log('Localization entries:', Object.keys(locMap));

  const comprehensiveValidSuffixes = new Set();

  Object.keys(locMap).forEach((key) => {
    comprehensiveValidSuffixes.add(key);
  });

  Object.keys(locMap).forEach((fullKey) => {
    const underscoreSegments = fullKey.split("_");
    for (let i = 0; i < underscoreSegments.length; i++)
        comprehensiveValidSuffixes.add(underscoreSegments.slice(i).join("_"));
  });

  const codeFiles = files.filter(p => p.endsWith('.lua') && !p.endsWith('en-us.lua'));
  const atlasDefs = {}, cards = [];
  for (let p of codeFiles)
  {
    const txt = await fetchRaw(owner, repo, p);
    Object.assign(atlasDefs, parseAtlasDefs(txt));
    cards.push(...parseAllEntities(txt));
  }
  console.log('Parsed cards:', cards.map(c => c.key));

  Object.values(atlasDefs).forEach(at => {
    const name = at.path.split('/').pop();
    const match = files.find(f =>
      f.toLowerCase().includes('assets/') &&
      f.toLowerCase().includes('/2x/') &&
      f.toLowerCase().endsWith('/' + name.toLowerCase())
    );
    at.resolvedPath = match || at.path;
  });

  const filtered = cards.filter(c => {
    const ok = locMap.hasOwnProperty(c.key) || comprehensiveValidSuffixes.has(c.key);
    if (!ok)
      console.warn('Dropping card', c.key, 'no loc entry');
    return ok;
  });
  console.log('Filtered cards:', filtered.map(c => c.key));

  const select = document.getElementById('card-select');
  const groups = filtered.reduce((acc, c, i) => {
    (acc[c.type] ||= []).push({ card: c, idx: i });
    return acc;
  }, {});
  for (let [type, items] of Object.entries(groups))
  {
    const og = document.createElement('optgroup');
    og.label = type;
    items.forEach(({card, idx}) => {
      const opt = document.createElement('option');
      opt.value = idx;
      const displayName = locMap[card.key]?.name || Array.from(comprehensiveValidSuffixes).find(suf => fullKey.endsWith(suf) && locMap[suf])?.name || card.key;
      opt.textContent = displayName;
      og.appendChild(opt);
    });
    select.appendChild(og);
  }

  select.addEventListener('change', () => {
    const idx = parseInt(select.value, 10);
    if (!isNaN(idx)) showCard(idx);
  });
  if (filtered.length)
  {
    select.selectedIndex = 1;
    select.dispatchEvent(new Event('change'));
  }

  const listDiv = document.getElementById('card-list'); // unused now
  const sprite  = document.getElementById('sprite');
  const title   = document.getElementById('card-title');
  const locP    = document.getElementById('loc-text');
  const rawPre  = document.getElementById('raw-def');

  function showCard(idx)
  {
    const c = filtered[idx];
    const locEntry = locMap[c.key];

    if (!locEntry)
    {
        const matchingSuffix = Array.from(comprehensiveValidSuffixes).filter(suffix => c.key.endsWith(suffix) && locMap[suffix]).sort((a, b) => b.length - a.length)[0];

        if (matchingSuffix)
            locEntry = locMap[matchingSuffix];
    }

    if (locEntry)
    {
        title.textContent = locEntry.name;
        locP.innerHTML    = locEntry.text.join('<br>');
    }
    else
    {
        title.textContent = c.key;
        locP.innerHTML = <i>Localization entry not found.</i>
    }
    
    rawPre.style.display = 'none';

    if (c.atlas && c.pos && atlasDefs[c.atlas])
    {
      const at = atlasDefs[c.atlas];
      sprite.style.display = 'block';
      sprite.style.width      = at.px + 'px';
      sprite.style.height     = at.py + 'px';
      sprite.style.backgroundImage =
        `url(https://raw.githubusercontent.com/${owner}/${repo}/main/${at.resolvedPath})`;
      sprite.style.backgroundPosition =
        `-${c.pos.x*at.px}px -${c.pos.y*at.py}px`;
    } 
    else
    {
      sprite.style.display = 'none';
    }
  }
});