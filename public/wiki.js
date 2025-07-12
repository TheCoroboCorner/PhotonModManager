const COLOURS = {
  mult: '#FE5F55',
  chips: '#009DFF',
  money: '#F3B958',
  xmult: '#FE5F55',
  filter: '#FF9A00',
  blue: '#009DFF',
  red: '#FE5F55',
  green: '#4BC292',
  pale_green: '#56A887',
  orange: '#FDA200',
  important: '#FF9A00',
  gold: '#EAC058',
  yellow: '#FFFF00',
  clear: '#00000002', 
  white: '#FFFFFF',
  purple: '#8867A5',
  black: '#374244',
  l_black: '#4F6367',
  grey: '#5F7377',
  coral: '#F4795C',
	bold_red: '#FF0000',
	bold_cyan: '#00FFFF',
	sblue: '#2E76FD',
	cryepic: '#EF0098',
	cryexotic: '#4795A6',
	crycandy: '#E275E6',
	crycursed: '#474931',
	pokesafari: '#F2C74E',
	pokemega: '#E8578E',
	jenwondrous: '#FF0000',
	bufspecial: '#EE8F8D',
	glop: '#11FF11',
	svrdtemper: '#D4E04C',
	svrdprotocol: '#303030',
	entrlegendary: '#FF0081',
	entrentropic: '#83B380',
	entrzenith: '#4CD72A',
	bldstnpower: '#DF00FF',
	myhm_mythic: '#FF9A00',
	myhm_mystery: '#374244',
	myhm_hyperascendant: '#FBFF00',
	myhm_interdimensional: '#34EB9B',
	myhm_surreal: '#D1C436',
	myhm_ethereal: '#6F00FF',
  chance: '#4BC292',
  joker_grey: '#BFC7D5',
  voucher: '#CB724C',
  booster: '#646EB7',
  edition: 'linear-gradient(90deg,#FF9A00FF,#FFFFFF)',
  dark_edition: '#000000',
  eternal: '#C75985',
  perishable: '#4F5DA1',
  rental: '#B18F43',
  main: '#374244',
  dark: '#374244',
  boss_main: '#374244',
  boss_dark: '#374244',
  boss_pale: '#374244',
  hearts: '#F03464',
  diamonds: '#F06B3F',
  spades: '#403995',
  clubs: '#235955',
  text_light: "#FFFFFF",
  text_dark: '#4F6367',
  text_inactive: '#88888899',
  background_light: '#B8D8D8',
  background_white: "#FFFFFF",
  background_dark: '#7A9E9F',
  background_inactive: '#666666FF',
  outline_light: '#D8D8D8',
  outline_light_trans: '#D8D8D866',
  outline_dark: '#7A9E9F',
  transparent_light: '#EEEEEE22',
  transparent_dark: '#22222222',
  hover: '#00000055',
  default: '#CDD9DC',
  enhanced: '#CDD9DC',
  joker: '#424E54',
  tarot: '#424E54',
  planet: '#424E54',
  spectral: '#424E54',
  voucher: '#424E54',
  default: '#9BB6BDFF',
  enhanced: '#8389DDFF',
  joker: '#708B91',
  tarot: '#A782D1',
  planet: '#13AFCE',
  spectral: '#4584FA',
  voucher: '#FD682B',
  edition: '#4CA893',
  small: '#50846E',
  big: '#50846E',
  boss: '#B44430',
  won: '#4F6367'
}

function formatMarkup(str)
{
  let out = '';
  const stack = [];
  let i = 0;

  const closeSpan = () => {
    if (stack.length)
    {
      stack.pop();
      out += '</span>';
    }
  }

  while (i < str.length)
  {
    if (str[i] === '{')
    {
      const end = str.indexOf('}', i);
      if (end < 0)
        break;

      const code = str.slice(i + 1, end);
      i = end + 1;

      if (code === '')
      {
        closeSpan();
        continue;
      }

      let styles = [];
      let attrs = [];

      code.split(',').forEach(part => {
        const [k, v] = part.split(':');
        switch (k)
        {
          case 'C':
            if (COLOURS[v])
              styles.push('color:', COLOURS[v]);
            break;
          case 'X':
            if (COLOURS[v])
              styles.push('background-color:', COLOURS[v]);
            break;
          case 'V':
            // Not implemented because I'm lazy
            break;
          case 'B':
            // Not implemented because I'm lazy
            break;
          case 'E':
            if (v === '1')
              attrs.push(`class="motion-popin"`);
            else if (v === '2')
              attrs.push(`class="motion-bump"`);
            break;
          case 'T':
            attrs.push(`data-tooltip="${v}"`);
            break;
          case 's':
            styles.push(`font-size: ${(parseFloat(v) * 100)}%`);
            break;
        }
      });

      stack.push(code);
      out += `<span style="${styles.join(';')}" ${attrs.join(' ')}>`;
    }
    else
    {
      const next = str.indexOf('{', i);
      const chunk = str.slice(i, (next < 0) ? (str.length) : (next));
      out += chunk.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      i += chunk.length;
    }
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const modTitle = document.getElementById('mod-name');
  const detailElement = document.getElementById('detail');
  const photonElement = document.getElementById('photon');
  if (!detailElement)
  {
    console.error("HTML element with id 'detail' not found. Cannot display messages.");
    alert('An unexpected error occurred: UI element missing.');
    return;
  }
  if (photonElement)
    photonElement.textContent = "Photon Wiki -- Loading cards..."

  const params = new URLSearchParams(location.search);
  const modKey = params.get('mod');
  if (!modKey)
  {
    detailElement.textContent = 'No mod specified';
    return;
  }
  const [repo, owner] = modKey.split('@');

  modTitle.textContent = repo;
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
      detailElement.textContent = `Error: Could not load wiki data from server.`;
      return;
    }

    wikiData = await wikiDataRes.json();
    console.log('[Client] Received wiki data from server.');
  }
  catch (err)
  {
    console.error('[Client] Network error fetching wiki data:', err);
    detailElement.textContent = 'Error: Network issue fetching wiki data from server.';
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

  if (photonElement)
    photonElement.textContent = "Photon Wiki"

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
        locP.innerHTML    = locEntry.text.map(line => formatMarkup(line)).join('<br>');
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