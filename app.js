// app.js (ESM)
import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { backupDataJson, backupVotesJson, backupMetadata } from './github-backup.js';
import crypto from 'crypto';
import { versions } from 'process';

// Fix for __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;

const DATA_FILE = path.join(__dirname, 'data.json');
const VOTES_FILE = path.join(__dirname, 'votes.json');
const WIKI_LOCAL_DATA_DIR = path.join(__dirname, 'wiki-data');

const GITHUB_HEADERS = process.env.GITHUB_FETCH_TOKEN ? 
{
  'Authorization': `Bearer ${process.env.GITHUB_FETCH_TOKEN}`,
  'Accept': 'application/vnd.github.v3+json',
  'User-Agent': 'photonmodmanager'
} :
{
  'Accept': 'application/vnd.github.v3+json',
  'User-Agent': 'photonmodmanager'
};

app.use('/wiki-data', express.static(WIKI_LOCAL_DATA_DIR, { maxAge: '1d', immutable: true }));

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// --- Helper functions ---

function parseGitHubUrl(repoUrl)
{
  const regex = /^https?:\/\/(?:www\.)?github\.com\/([^\/]+)\/([^\/]+)(?:\/.+)?$/;
  const match = repoUrl.match(regex);
  if (!match) throw new Error('Invalid GitHub URL format');
  return { user: match[1], repo: match[2] };
}

async function fetchJsonFromRepo(user, repo, jsonPath)
{
  const url = `https://raw.githubusercontent.com/${user}/${repo}/main/${jsonPath}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error('Failed to fetch JSON file from GitHub');
  return resp.json();
}

function buildEntry(target)
{
  const entry = {
    id: target.id,
    name: target.name,
    author: target.author,
    description: target.description,
    favourites: 0
  };

  if (target.allow_redistribution)
    entry.allow_redistribution = target.allow_redistribution;
  else throw new Error('allow_redistribution variable in target JSON file is either missing or false! Cannot redistribute without permission!');

  ['id', 'name', 'author', 'description', 'badge_colour', 'dependencies', 'conflicts', 'provides', 'git_owner', 'git_repo',
    'mod_index_id', 'mod_path', 'subpath', 'download_suffix', 'update_mandatory', 'target_version'].forEach(key => {
    if (key in target) entry[key] = target[key];
  });
  return entry;
}

async function fetchReleases(user, repo)
{
  const url = `https://api.github.com/repos/${user}/${repo}/releases`;
  const resp = await fetch(url);
  if (!resp.ok) return [];
  const rels = await resp.json();
  return rels.map(r => ({
    tag: r.tag_name,
    notes: r.body || '',
    size: (r.assets || []).reduce((sum, a) => sum + (a.size || 0), 0),
    published_at: r.published_at
  }));
}

async function fetchReadme(user, repo)
{
  const url = `https://raw.githubusercontent.com/${user}/${repo}/main/README.md`;
  const resp = await fetch(url);
  return resp.ok ? resp.text() : '';
}

async function readData()
{
  try 
  {
    const txt = await fs.readFile(DATA_FILE, 'utf-8');
    
    try
    {
      return JSON.parse(txt);
    }
    catch (err)
    {
      console.error('JSON parse error:', err.message);
      if (typeof err.position === 'number')
      {
        const pos = err.position;
        console.error('...context:', txt.slice(Math.max(0, pos - 20), pos + 20).replace(/\n/g, '\\n'));
      }
      throw err;
    }
  } 
  catch
  {
    return {};
  }
}

async function writeData(data)
{
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
}

async function readVotes()
{
  try
  {
    const txt = await fs.readFile(VOTES_FILE, 'utf8');
    return JSON.parse(txt);
  }
  catch
  {
    return {};
  }
}

async function writeVotes(v)
{
  await fs.writeFile(VOTES_FILE, JSON.stringify(v, null, 2));
}

app.use((req, res, next) =>
{
  const raw = req.headers.cookie || '';
  const cookies = Object.fromEntries(raw.split(';').map(s => s.trim().split('=').map(decodeURIComponent)));

  let vid = cookies.voteId;
  if (!vid)
  {
    vid = crypto.randomBytes(16).toString('hex');
    res.setHeader('Set-Cookie', `voteId=${vid}; Path=/; HttpOnly; SameSite=Lax`);
  }
  req.voteId = vid;
  
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "connect-src 'self' https://api.github.com https://raw.githubusercontent.com; " +
    "script-src 'self' 'unsafe-inline'; " +
    "style-src 'self' 'unsafe-inline';" +
    "img-src 'self' https://raw.githubusercontent.com"
  );
  next();
});

app.get('/', (req, res) =>
{
  res.send(`
    <h1>Photon Mod Manager</h1>
    <ul>
      <li><a href="/submit">Submit a repo JSON</a></li>
      <li><a href="/browse">Browse data.json</a></li>
    </ul>
  `);
});

app.get('/submit', (req, res) =>
{
  res.sendFile(path.join(__dirname, 'public', 'submit.html'));
});

app.post('/favourite/:key', async (req, res) =>
{
  const { key } = req.params;
  const userId = req.voteId;

  const votes = await readVotes();
  votes[key] = votes[key] || [];

  if (votes[key].includes(userId)) 
    return res.status(200).json({ success: false, message: 'Already favourited' });

  const data = await readData();
  if (!data[key]) 
    return res.status(404).json({ error: 'Mod not found' });

  votes[key].push(userId);
  await writeVotes(votes);
  backupVotesJson().catch(console.error);

  data[key].favourites = votes[key].length;
  await writeData(data);
  backupDataJson().catch(console.error);

  res.json({ success: true, newCount: data[key].favourites });
});

app.post('/submit', async (req, res) =>
{
  try {
    const { repoUrl, jsonPath, tags } = req.body;
    let user, repo, branch, filepath, jsonData, key;

    const tagArray = Array.isArray(tags) ? tags : (tags ? [tags] : []);

    const url = new URL(repoUrl);

    // direct raw url?
    if (url.hostname === 'raw.githubusercontent.com')
    {
      [ , user, repo, branch, ...rest ] = url.split('/');
      filepath = rest.join('/');
    } // standard github blob url?
    else if (url.hostname === 'github.com' && url.pathname.split('/').includes('blob'))
    {
      [ , user, repo, , branch, ...rest] = url.pathname.split('/');
      filepath = rest.join('/');
    }
    else if (url.hostname === 'github.com' && jsonPath)
    {
      [ , user, repo ] = url.pathname.split('/');
      filepath = jsonPath;
    }
    else
    {
      ({user, repo} = parseGitHubUrl(repoUrl));
      filepath = jsonPath
    }

    key = `${repo}@${user}`;

    const data = await readData();
    if (key in data) {
      return res.status(409).json({ error: `Entry for '${key}' already exists` });
    }

    const headers = {
      'User-Agent': 'photonmodmanager',
      'Accept': 'application/vnd.github.v3+json',
      'Authorization': `Bearer ${process.env.GITHUB_FETCH_TOKEN}`
    };
    const repoInfoP = fetch(`https://api.github.com/repos/${user}/${repo}`, { headers }).then(r =>
    {
      if (!r.ok)
        throw new Error(`Github repo info ${r.status}`);
      return r.json();
    });

    const contentsP = repoInfoP.then(({ default_branch }) =>
    {
      const url = `https://api.github.com/repos/${user}/${repo}/contents/${filepath}?ref=${default_branch}`;
      return fetch(url, { headers }).then(r => 
      {
        if (!r.ok)
          throw new Error(`Contents API ${r.status}`);
        return r.json().then(j => ({ j, default_branch }));
      });
    });

    const [{ default_branch }, { j: {content, encoding } }] = await Promise.all([repoInfoP, contentsP]);
    const raw = Buffer.from(content, encoding).toString('utf8');
    jsonData = JSON.parse(raw);
    
    const entry = buildEntry(jsonData);
    entry.published_at = new Date().toISOString();
    entry.type = "Mod";
    entry.tags = tagArray;

    data[key] = entry;
    await writeData(data);
    res.json({ success: true, key });

    (async () =>
    {
      try
      {
        if (!repoUrl.includes('raw.githubusercontent.com') && !repoUrl.includes('/blob/'))
        {
          const readme = await fetchReadme(user, repo);
          const d2 = await readData();
          d2[key].readme = readme;
          await writeData(d2);
        }
        await backupDataJson();
      }
      catch (err) { console.error('Background job failed:', err); }
    })();

  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
});

/**
 * Sort entries object by key
 * @param {{[key: string]: object}} entries
 * @param {string} field - 'published_at' or 'favourites'
 * @param {string} order - 'asc' or 'desc'
 * @returns {Array<object>} sorted array of entries with key included
 */
function sortEntries(entries, field, order = 'desc')
{
  const arr = Object.entries(entries).map(([key, entry]) => ({ key, ...entry }));
  arr.sort((a, b) => {
    let av = a[field];
    let bv = b[field];
    if (field === 'published_at') {
      av = Date.parse(av);
      bv = Date.parse(bv);
    }
    if (av < bv) return order === 'asc' ? -1 : 1;
    if (av > bv) return order === 'asc' ? 1 : -1;
    return 0;
  });
  return arr;
}

async function pLimit(concurrency, iterable, mapper)
{
  const executing = [];
  const results = [];

  for (const item of iterable)
  {
    const p = Promise.resolve().then(() => mapper(item));
    results.push(p);

    const e = p.then(() => executing.splice(executing.indexOf(e), 1));
    executing.push(e);

    if (executing.length >= concurrency)
      await Promise.race(executing);
  }

  return Promise.all(results);
}

app.get('/wiki-data/:modKey.json', async(req, res) => {
  const CONCURRENCY_LIMIT = 8;

  const modKey = req.params.modKey;
  const [repo, owner] = modKey.split('@');

  const modLocalCacheDir = path.join(WIKI_LOCAL_DATA_DIR, modKey);
  let latestTag = 'no-tag';

  try
  {
    console.log(`[Server] Fetching latest tag for ${modKey}`);
    const tagRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/latest`, { headers: GITHUB_HEADERS });
    if (tagRes.ok)
    {
      const tagJson = await tagRes.json();
      latestTag = tagJson.tag_name || 'no-tag';
      console.log(`[Server] Latest tag for ${modKey}: ${latestTag}`);
    }
    else
    {
      console.warn(`[Server] Could not get latest release tag for ${modKey}. Status: ${tagRes.status}`);
    }
  } 
  catch(e)
  {
    console.error(`[Server] Critical error fetching latest tag for ${modKey}:`, e);
    return res.status(500).json({ error: 'Failed to determine latest mod version.' });
  }

  const versionSpecificCacheDir = path.join(modLocalCacheDir, latestTag || 'no-tag');
  const metadataFile = path.join(versionSpecificCacheDir, 'metadata.json');

  let cachedData = null;
  console.log(`[Server] Attempting to read cache from: ${metadataFile}`);
  try 
  {
    await fs.mkdir(versionSpecificCacheDir, { recursive: true });

    const fileContent = await fs.readFile(metadataFile, 'utf8');
    cachedData = JSON.parse(fileContent);
    console.log(`[Server] Serving cached data for ${modKey} (version: ${latestTag || 'no-tag'}).`);
    return res.json(cachedData);
  } 
  catch (readError) 
  {
    console.warn(`[Server] Cache read failed for ${modKey} (${metadataFile}):`, readError.message);
    console.log(`[Server] Cache miss for ${modKey} (version: ${latestTag || 'no-tag'}). Fetching from GitHub...`);
  }

  try 
  {
    await fs.mkdir(versionSpecificCacheDir, { recursive: true });

    async function listGitHubFiles(ghOwner, ghRepo, dirPath = '') 
    {
        const res = await fetch(`https://api.github.com/repos/${ghOwner}/${ghRepo}/contents/${dirPath}`, { headers: GITHUB_HEADERS });
        if (!res.ok) return [];
        const items = await res.json();
        let out = [];
        for (let i of items) 
        {
            const fullPath = i.path;
            if (i.type === 'file')
                out.push(fullPath);
            else if (i.type === 'dir')
                out.push(...await listGitHubFiles(ghOwner, ghRepo, fullPath));
        }
        return out;
    }
    const allGitHubFiles = await listGitHubFiles(owner, repo);

    const luaFilesToDownload = allGitHubFiles.filter(p => p.endsWith('.lua'));
    let luaFileContents = {};

    await pLimit(CONCURRENCY_LIMIT, luaFilesToDownload, async (luaPath) => {
      try
      {
        const txt = await fetchRaw(owner, repo, luaPath);
        if (txt)
        {
          const localLuaPath = path.join(versionSpecificCacheDir, path.basename(luaPath));
          await fs.writeFile(localLuaPath, txt);
          luaFileContents[luaPath] = txt;
        }
        else console.warn(`[Server] Empty content for Lua file ${luaPath}, skipping cache.`);
      }
      catch (err)
      {
        console.error(`[Server] Error downloading/caching Lua file ${luaPath}:`, err);
      }
    });

    const imgFiles = allGitHubFiles.filter(p => p.toLowerCase().includes('assets/2x/') && p.toLowerCase().endsWith('.png'));

    const locPathInRepo = luaFilesToDownload.find(p => p.endsWith('en-us.lua')) || luaFilesToDownload.find(p => p.endsWith('default.lua'));
    const locTxt = locPathInRepo ? luaFileContents[locPathInRepo] : '';
    const locMap = parseLoc(locTxt);

    const atlasDefs = {};
    const cards = [];

    const codeLuaPaths = luaFilesToDownload.filter(p => p !== locPathInRepo);
    for (const luaPath of codeLuaPaths) 
    {
      const txt = luaFileContents[luaPath];

      if (!txt)
        continue;

      Object.assign(atlasDefs, parseAtlasDefs(txt));
      cards.push(...parseAllEntities(txt));
    }

    await pLimit(CONCURRENCY_LIMIT, imgFiles, async (repoPath) => {
      try 
      {
        const buf = await fetchRawBinary(owner, repo, repoPath);
        if (!buf)
        {
          console.warn(`[Server] Empty buffer for ${repoPath}`);
          return;
        }

        const fileName = path.basename(repoPath);
        const localFile = path.join(versionSpecificCacheDir, fileName);
        await fs.writeFile(localFile, Buffer.from(buf));
        console.log(`[Server] Wrote image file ${localFile}`);

        for (const key of Object.keys(atlasDefs))
        {
          if (atlasDefs[key].path.toLowerCase() === fileName.toLowerCase())
          {
            atlasDefs[key].localPath = `/wiki-data/${modKey}/${latestTag}/${encodeURIComponent(fileName)}`;
            atlasDefs[key].resolvedGitHubPath = repoPath;
            console.log(`[Server] Hooked atlas ${key} → ${atlasDefs[key].localPath}`);
          }
        }
      }
      catch (err)
      {
        console.error(`[Server] Error caching ${repoPath}:`, err);
      }
    });

    let diskFiles = await fs.readdir(versionSpecificCacheDir);
    console.log(`[Server] Final cache dir contents for ${modKey}@${latestTag}:`, diskFiles);
    diskFiles = null;

    for (const key of Object.keys(atlasDefs))
    {
      const at = atlasDefs[key];
      const fileName = at.path.split('/').pop().toLowerCase();

      let match = allGitHubFiles.find(p => p.toLowerCase().includes('/assets/2x/') && p.toLowerCase().endsWith('/' + fileName));
      if (!match)
        match = allGitHubFiles.find(p => p.toLowerCase().endsWith('/' + fileName));

      if (!match)
      {
        console.warn(`[Server] Could not resolve atlas path for ${key}, keeping raw path ${at.path}`);
        at.resolvedGitHubPath = at.path; 
      }
      else at.resolvedGitHubPath = match;
    }

    luaFileContents = null;

    for (let card of cards)
    {
      console.log(`[DEBUG CONFIG] card.raw for ${card.key}:\n`, card.raw);

      // Config first

      card.config = {};
      const idx = card.raw.indexOf('config');
      if (idx !== -1)
      {
        const eq = card.raw.indexOf('=', idx);
        const brace = card.raw.indexOf('{', eq);
        const block = extractBlockContent(card.raw, brace);
        if (block)
        {
          const fullLuaTable = card.raw.slice(brace, block.endIndex + 1);
          console.log(`[DEBUG CONFIG] fullLuaTable for ${card.key}:\n`, fullLuaTable);
          try
          {
            const jsonLike = fullLuaTable.replace(/(\w+)\s*=/g, `"$1":`);
            console.log(`[DEBUG CONFIG] jsonLike for ${card.key}:\n`, jsonLike);
            card.config = new Function(`return ${jsonLike}`)();
          }
          catch (err)
          {
            console.warn(`Failed to parse full config for ${card.key}:`, err);
          }
          console.log(`[DEBUG CONFIG] card.config for ${card.key}:`, card.config);
        }
      }

      card.ability = card.config;

      // Then loc_vars
      card.vars = [];
      card.infoQueue = [];

      const lvIdx = card.raw.indexOf('loc_vars');
      if (lvIdx !== -1)
      {
        const fnKeywordIdx = card.raw.indexOf('function', lvIdx);
        const braceIdx = card.raw.indexOf('{', fnKeywordIdx);
        const fnBlock = extractBlockContent(card.raw, braceIdx);
        if (fnBlock)
        {
          const fnBody = fnBlock.content;
          const locVarsFn = new Function('self', 'info_queue', 'card', fnBody);

          try
          {
            const result = locVarsFn({}, card.infoQueue, card);
            if (result && Array.isArray(result.vars))
              card.vars = result.vars;
          }
          catch (err)
          {
            console.warn(`loc_vars execution failed for ${card.key}:`, e);
          }
        }
        else console.warn(`Could not extract loc_vars body for ${card.key}`);
      }
      else console.warn(`No loc_vars found in raw for ${card.key}`);
    }

    const finalDataForCache = { locMap, atlases: atlasDefs, cards, version: latestTag || 'no-tag' };
    await fs.writeFile(metadataFile, JSON.stringify(finalDataForCache, null, 2), 'utf8');
    
    backupMetadata(modKey, latestTag || 'no-tag').catch(console.error);

    console.log(`[Server] Successfully fetched, parsed, and cached data for ${modKey} (version: ${latestTag || 'no-tag'}).`);
    res.json(finalDataForCache);

  } 
  catch (fetchError) 
  {
    console.error(`[Server] Fatal error processing wiki data for ${modKey}:`, fetchError);
    res.status(500).json({ error: 'Internal server error while processing mod data.' });
  }
});

function parseAtlasDefs(txt)
{
  if (!txt)
    return {};

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

function unescapeLuaString(str) 
{
  return str.replace(/\\(["'\\bfnrt])/g, (_, ch) => ({ n: '\n', r: '\r', t: '\t', '"': '"', "'": "'", '\\': '\\' })[ch] || ch);
}

function parseAllEntities(txt) {
  const out = [];
  let cursor = 0;

  while (true)
  {
    const dotIdx = txt.indexOf("SMODS", cursor);
    if (dotIdx === -1)
      break;

    const rest = txt.slice(dotIdx + 6);
    const typeMatch = /^[A-Z][A-Za-z0-9_]*/.exec(rest);
    if (!typeMatch)
    {
      cursor = dotIdx + 6;
      continue;
    }
    const type = typeMatch[0];

    const braceIdx = txt.indexOf("{", dotIdx + 6 + type.length);
    if (braceIdx === -1)
      break;

    const block = extractBlockContent(txt, braceIdx);
    if (!block)
    {
      cursor = braceIdx + 1;
      continue;
    }

    const body = block.content;
    cursor = block.endIndex + 1;

    const keyM = /key\s*=\s*(['"])((?:\\.|(?!\1).)*?)\1/.exec(body);
    if (!keyM)
      continue;
    const key = unescapeLuaString(keyM[2]);

    const atlasM = /atlas\s*=\s*(['"])((?:\\.|(?!\1).)*?)\1/.exec(body);
    const atlas = atlasM ? unescapeLuaString(atlasM[2]) : null;

    const posM = /pos\s*=\s*{[^}]*x\s*=\s*(\d+)[^}]*y\s*=\s*(\d+)/.exec(body);
    const pos = posM ? { x: +posM[1], y: +posM[2] } : null;

    out.push({ type, key, atlas, pos, raw: body.trim() });
  }

  return out;
}

async function fetchRaw(owner, repo, p)
{
  const r = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/main/${p}`, { headers: GITHUB_HEADERS });
  return r.ok ? r.text() : '';
}

async function fetchRawBinary(owner, repo, p)
{
  const r = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/main/${p}`, { headers: GITHUB_HEADERS });
  return r.ok ? r.arrayBuffer() : null;
}

function parseLoc(txt)
{
  const map = {};

  const keyOpenBraceRe = /(\w+)\s*=\s*{/g;
  // const lineRe = /(['"])(.*?)\1(?:,\s*)?/g;
  // const itemPairRe = /(\w+)\s*=\s*(?:['"]([^'"]*)['"]|([^,{}\s]+))(?:\s*,\s*)?/g;

  const stringRe = /(['"])((?:\\.|(?!\1).)*?)\1/g;

  let currentPos = 0;
  while (true)
  {
    keyOpenBraceRe.lastIndex = currentPos;
    let topLevelMatch = keyOpenBraceRe.exec(txt);

    if (!topLevelMatch)
      break;

    const sectionName = topLevelMatch[1];
    const blockStartIdx = topLevelMatch.index + topLevelMatch[0].length - 1;

    const blockResult = extractBlockContent(txt, blockStartIdx);
    if (!blockResult)
    {
      console.warn(`parseLoc: Mismatched braces for section ${sectionName} starting at ${blockStartIdx}`);
      currentPos = topLevelMatch.index + topLevelMatch[0].length;
      continue;
    }
    const sectionBody = blockResult.content;
    currentPos = blockResult.endIndex + 1;

    if (sectionName === "descriptions")
    {
      let categoryPos = 0;
      while (true)
      {
        keyOpenBraceRe.lastIndex = categoryPos;
        let categoryMatch = keyOpenBraceRe.exec(sectionBody);

        if (!categoryMatch)
          break;

        const categoryKey = categoryMatch[1];
        const catBlockStartIdx = categoryMatch.index + categoryMatch[0].length - 1;

        const catBlockResult = extractBlockContent(sectionBody, catBlockStartIdx);
        if (!catBlockResult)
        {
          console.warn(`parseLoc: Mismatched braces for category ${categoryKey} in descriptions`);
          categoryPos = categoryMatch.index + categoryMatch[0].length;
          continue;
        }

        const categoryBodyContent = catBlockResult.content;
        categoryPos = catBlockResult.endIndex + 1;

        let itemPos = 0;
        while (true)
        {
          keyOpenBraceRe.lastIndex = itemPos;
          let itemMatch = keyOpenBraceRe.exec(categoryBodyContent);

          if (!itemMatch)
            break;

          const cardKey = itemMatch[1];
          const itemBlockStartIdx = itemMatch.index + itemMatch[0].length - 1;

          const itemBlockResult = extractBlockContent(categoryBodyContent, itemBlockStartIdx);
          if (!itemBlockResult)
          {
            console.warn(`parseLoc: Mismatched braces for item ${cardKey} in category ${categoryKey}`);
            itemPos = itemMatch.index + itemMatch[0].length;
            continue;
          }

          const entryBody = itemBlockResult.content;
          itemPos = itemBlockResult.endIndex + 1;

          // const nameMatch = entryBody.match(/name\s*=\s*(['"])(.*?)\1/);
          // const name = nameMatch ? nameMatch[2] : '';

          const nameRe = /name\s*=\s*(['"])((?:\\.|(?!\1).)*?)\1/;
          const nm = nameRe.exec(entryBody);
          const name = nm ? nm[2].replace(/\\(["'\\bfnrt])/g, (_, ch) => ({ n: '\n', r: '\r', t: '\t', '"': '"', "'": "'", '\\': '\\' }[ch] || ch)) : '';

          const lines = [];
          const textBlockRe = /text\s*=\s*{/g;
          textBlockRe.lastIndex = 0;
          const textBlockMatch = textBlockRe.exec(entryBody);

          if (textBlockMatch)
          {
            const textContentStartIdx = textBlockMatch.index + textBlockMatch[0].length - 1;
            const textBlockResult = extractBlockContent(entryBody, textContentStartIdx);

            if (textBlockResult)
            {
              const txtBody = textBlockResult.content;
              stringRe.lastIndex = 0;

              let lineMatch;
              while ((lineMatch = stringRe.exec(txtBody)))
                lines.push(lineMatch[2].replace(/\\(["'\\bnfrt])/g, (_, ch) => {
                  return { n: '\n', r: '\r', t: '\t', '"': '"', "'": "'", '\\': '\\' }[ch] || ch;
                }));
            }
            else console.warn(`parseLoc: Mismatched braces for text field in item ${cardKey}`);
          }

          map[cardKey] = { name, text: lines, type: categoryKey };
        }
      }
    }
    else if (sectionName === "misc")
    {
      let miscSubSectionPos = 0;
      while (true)
      {
        keyOpenBraceRe.lastIndex = miscSubSectionPos;
        let subSectionMatch = keyOpenBraceRe.exec(sectionBody);

        if (!subSectionMatch)
          break;

        const subSectionName = subSectionMatch[1];
        const miscSubBlockStartIdx = subSectionMatch.index + subSectionMatch[0].length - 1;

        const miscSubBlockResult = extractBlockContent(sectionBody, miscSubBlockStartIdx);
        if (!miscSubBlockResult)
        {
          console.warn(`parseLoc: Mismatched braces for sub-section ${subSectionName} in misc`);
          miscSubSectionPos = subSectionMatch.index + subSectionMatch[0].length;
          continue;
        }

        const subSectionContent = miscSubBlockResult.content;
        miscSubSectionPos = miscSubBlockResult.endIndex + 1;

        /*
        itemPairRe.lastIndex = 0;
        let itemPairMatch;
        while ((itemPairMatch = itemPairRe.exec(subSectionContent)))
        {
          const itemKey = itemPairMatch[1];
          const itemValue = itemPairMatch[2] || itemPairMatch[3] || '';

          if (!map.hasOwnProperty(itemKey))
            map[itemKey] = { name: itemValue, text: [], type: subSectionName };
        }
        */

        const pairRe = /(\w+)\s*=\s*([^\s,{][^,{}]*|(['"])((?:\\.|(?!\3).)*?)\3)/g;
        let pm;
        while ((pm = pairRe.exec(subSectionContent)))
        {
          const itemKey = pm[1];
          let itemValue = pm[2];

          if (pm[3])
          {
            itemValue = pm[4].replace(/\\(["'\\bfnrt])/g, (_, ch) => ({ n: '\n', r: '\r', t: '\t', '"': '"', "'": "'", '\\': '\\' }[ch] || ch));
          }

          if (!map.hasOwnProperty(itemKey))
            map[itemKey] = { name: itemValue, text: [], type: subSectionName };
        }
      }
    }
  }

  return map;
}

function extractBlockContent(str, startIndex)
{
  let braceCount = 0;
  let contentStart = -1;
  for (let i = startIndex; i < str.length; i++)
  {
    if (str[i] === '{')
    {
      if (contentStart === -1)
        contentStart = i + 1;
      braceCount++;
    }
    else if (str[i] === '}')
    {
      braceCount--;
      if (braceCount === 0)
      {
        const content = str.substring(contentStart, i);
        return { content: content, endIndex: i };
      }
    }
  }
  return null;
}

app.get('/browse', (_req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'browse.html'))
);

app.get('/about', (_req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'about.html'))
);

app.get('/data', (_req, res) =>
{
  res.sendFile(DATA_FILE);
});

app.get('/wiki', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'wiki.html'));
});

app.listen(PORT, () => console.log(`Listening on port ${PORT}`));