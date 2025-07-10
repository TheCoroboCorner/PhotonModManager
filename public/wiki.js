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

  function extractBlockContent(str, startIndex) {
    let braceCount = 0;
    let contentStart = -1;
    for (let i = startIndex; i < str.length; i++) {
      if (str[i] === '{') {
        if (contentStart === -1) contentStart = i + 1;
        braceCount++;
      } else if (str[i] === '}') {
        braceCount--;
        if (braceCount === 0) {
          const content = str.substring(contentStart, i);
          return { content: content, endIndex: i };
        }
      }
    }
    return null;
  }

  const keyOpenBraceRe = /(\w+)\s*=\s*{/g;

  let currentPos = 0;

  while (true) {
    keyOpenBraceRe.lastIndex = currentPos;
    let topLevelMatch = keyOpenBraceRe.exec(txt);

    if (!topLevelMatch) break;

    const sectionName = topLevelMatch[1];
    const blockStartIdx = topLevelMatch.index + topLevelMatch[0].length - 1;

    const blockResult = extractBlockContent(txt, blockStartIdx);
    if (!blockResult) {
      console.warn(`parseLoc: Mismatched braces for section ${sectionName} starting at ${blockStartIdx}`);
      currentPos = topLevelMatch.index + topLevelMatch[0].length;
      continue;
    }
    const sectionBody = blockResult.content;
    currentPos = blockResult.endIndex + 1;


    if (sectionName === "descriptions") {
      let categoryPos = 0;
      while (true) {
        keyOpenBraceRe.lastIndex = categoryPos;
        let categoryMatch = keyOpenBraceRe.exec(sectionBody);

        if (!categoryMatch) break;

        const categoryKey = categoryMatch[1];
        const catBlockStartIdx = categoryMatch.index + categoryMatch[0].length - 1;

        const catBlockResult = extractBlockContent(sectionBody, catBlockStartIdx);
        if (!catBlockResult) {
          console.warn(`parseLoc: Mismatched braces for category ${categoryKey} in descriptions`);
          categoryPos = categoryMatch.index + categoryMatch[0].length;
          continue;
        }
        const categoryBodyContent = catBlockResult.content;
        categoryPos = catBlockResult.endIndex + 1;


        let itemPos = 0;
        while (true) {
          keyOpenBraceRe.lastIndex = itemPos;
          let itemMatch = keyOpenBraceRe.exec(categoryBodyContent);

          if (!itemMatch) break;

          const cardKey = itemMatch[1];
          const itemBlockStartIdx = itemMatch.index + itemMatch[0].length - 1;

          const itemBlockResult = extractBlockContent(categoryBodyContent, itemBlockStartIdx);
          if (!itemBlockResult) {
            console.warn(`parseLoc: Mismatched braces for item ${cardKey} in category ${categoryKey}`);
            itemPos = itemMatch.index + itemMatch[0].length;
            continue;
          }
          const entryBody = itemBlockResult.content;
          itemPos = itemBlockResult.endIndex + 1;

          const nameMatch = entryBody.match(/name\s*=\s*['"]([^'"]+)['"]/);
          const name = nameMatch ? nameMatch[1] : '';

          const lines = [];
          const textMatch = entryBody.match(/text\s*=\s*{([\s\S]*?)}/m);
          if (textMatch) {
            const txtBody = textMatch[1];
            const lineRe = /['"]([^'"]*)['"](?:,\s*)?/g;
            lineRe.lastIndex = 0;
            let lineMatch;
            while ((lineMatch = lineRe.exec(txtBody))) {
              lines.push(lineMatch[1]);
            }
          }

          map[cardKey] = { name, text: lines, type: categoryKey };
        }
      }
    } else if (sectionName === "misc") {
      let miscSubSectionPos = 0;
      while (true) {
        keyOpenBraceRe.lastIndex = miscSubSectionPos;
        let subSectionMatch = keyOpenBraceRe.exec(sectionBody);

        if (!subSectionMatch) break;

        const subSectionName = subSectionMatch[1];
        const miscSubBlockStartIdx = subSectionMatch.index + subSectionMatch[0].length - 1;

        const miscSubBlockResult = extractBlockContent(sectionBody, miscSubBlockStartIdx);
        if (!miscSubBlockResult) {
          console.warn(`parseLoc: Mismatched braces for sub-section ${subSectionName} in misc`);
          miscSubSectionPos = subSectionMatch.index + subSectionMatch[0].length;
          continue;
        }
        const subSectionContent = miscSubBlockResult.content;
        miscSubSectionPos = miscSubBlockResult.endIndex + 1;

        const itemPairRe = /(\w+)\s*=\s*(?:['"]([^'"]*)['"]|([^,{}\s]+))(?:\s*,\s*)?/g;
        itemPairRe.lastIndex = 0;
        let itemPairMatch;
        while ((itemPairMatch = itemPairRe.exec(subSectionContent))) {
          const itemKey = itemPairMatch[1];
          const itemValue = itemPairMatch[2] || itemPairMatch[3] || '';

          if (!map.hasOwnProperty(itemKey)) {
            map[itemKey] = { name: itemValue, text: [], type: subSectionName };
          }
        }
      }
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

  const locPath = files.find(p => p.endsWith('en-us.lua'));

  if (!locPath)
  {
    console.error("Localization file 'en-us.lua' not found in the repository!");
    console.log("All files found:", files);
    document.getElementById("detail").textContent = "Error: Localization file (en-us.lua) not found in the repository.";
    return;
  }

  console.log("Found localization file at path:", locPath);

  const locTxt  = await fetchRaw(owner, repo, locPath);

  if (!locTxt)
  {
    console.error(`Failed to fetch raw content for ${locPath} or file is empty.`);
    document.getElementById("detail").textContent = `Error: Failed to load content from localization file (${locPath}). It might be empty or a network issue occurred.`;
    return;
  }

  console.log(`Successfully fetched ${locTxt.length} characters from ${locPath}.`);

  const locMap  = parseLoc(locTxt);
  console.log('Localization entries:', Object.keys(locMap));

  const comprehensiveValidSuffixes = new Set();
  const suffixToFullKeyMap = new Map();

  Object.keys(locMap).forEach((key) => {
    comprehensiveValidSuffixes.add(key);
    suffixToFullKeyMap.set(key, key);

    const underscoreSegments = key.split("_");
    for (let i = 0; i < underscoreSegments.length; i++)
    {
      const suffix = underscoreSegments.slice(i).join("_");
      comprehensiveValidSuffixes.add(suffix);

      if (!suffixToFullKeyMap.has(suffix))
        suffixToFullKeyMap.set(suffix, key);
    }
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
    const ok = comprehensiveValidSuffixes.has(c.key);
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

      let displayName = locMap[card.key]?.name
      if (!displayName)
      {
        const fullKeyFromSuffix = suffixToFullKeyMap.get(card.key);
        if (fullKeyFromSuffix && locMap[fullKeyFromSuffix])
            displayName = locMap[fullKeyFromSuffix].name;
      }

      opt.textContent = displayName || card.key;
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
    select.selectedIndex = 0;
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
    let locEntry = locMap[c.key];

    if (!locEntry)
    {
        const fullKeyFromSuffix = suffixToFullKeyMap.get(c.key);
        if (fullKeyFromSuffix)
            locEntry = locMap[fullKeyFromSuffix];
    }

    if (locEntry)
    {
        title.textContent = locEntry.name;
        locP.innerHTML    = locEntry.text.join('<br>');
    }
    else
    {
        title.textContent = c.key;
        locP.innerHTML = "<i>Localization entry not found.</i>";
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