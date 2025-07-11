document.addEventListener('DOMContentLoaded', async () => {
  const detailElement = document.getElementById('detail');
  if (!detailElement)
  {
    console.error("HTML element with id 'detail' not found. Cannot display messages.");
    alert('An unexpected error occurred: UI element missing.');
    return;
  }

  const params = new URLSearchParams(location.search);
  const modKey = params.get('mod');
  if (!modKey)
  {
    document.getElementById('detail').textContent = 'No mod specified';
    return;
  }
  const [repo, owner] = modKey.split('@');
  console.log('>>> Loading wiki for', repo, owner);

  const wikiDataUrl = `/wiki-data/${modKey}.json`;
  let wikiData = null;
  try
  {
    const wikiDataRes = await fetch(wikiDataUrl);
    if (!wikiDataRes.ok)
    {
      const errorText = await wikiDataRes.text();
      console.error(`Failed to fetch wiki data from ${wikiDataUrl}: ${wikiDataRes.status} - ${errorText}`);
      document.getElementById('detail').textContent = `Error: Could not load wiki data from server.`;
      return;
    }

    wikiData = await wikiDataRes.json();
    console.log('[Client] Received wiki data from server.');
  }
  catch (err)
  {
    console.error('[Client] Network error fetching wiki data:', err);
    document.getElementById('detail').textContent = 'Error: Network issue fetching wiki data from server.';
    return;
  }

  const locMap = wikiData.locMap;
  const atlasDefs = wikiData.atlases;
  const cards = wikiData.cards;

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

  const filtered = cards.filter(c => {
    const ok = comprehensiveValidSuffixes.has(c.key);
    if (!ok)
      console.warn('Dropping card', c.key, 'due to no loc entry');
    return ok;
  });
  console.log('Filtered cards:', filtered);

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

      const imageUrl = at.localPath;
      if (imageUrl)
      {
        sprite.style.display = 'block';
        sprite.style.width      = (at.px * 2) + 'px';
        sprite.style.height     = (at.py * 2) + 'px';
        sprite.style.backgroundImage = `url(${imageUrl})`;
        sprite.style.backgroundPosition = `-${c.pos.x*at.px*2}px -${c.pos.y*at.py*2}px`;
      }
      else
      {
        sprite.style.display = 'none';
      }
    } 
    else
    {
      sprite.style.display = 'none';
    }

    console.log('CARD:', c);
    console.log('  atlas key:', c.atlas);
    console.log('  atlasDef:', atlasDefs[c.atlas]);
  }
});