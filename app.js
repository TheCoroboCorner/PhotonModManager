// app.js (ESM)
import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { backupDataJson, backupVotesJson } from './github-backup.js';
import crypto from 'crypto';

// Fix for __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;
const DATA_FILE = path.join(__dirname, 'data.json');
const VOTES_FILE = path.join(__dirname, 'votes.json');
const CACHE_DIR = path.join(__dirname, 'wiki-cache');

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
    "connect-src 'self'; " +
    "script-src 'self'; " +
    "style-src 'self';"
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

app.get('/wiki-data/:modKey.json', async(req, res) => {
  const modKey = req.params.modKey;
  const [repo, owner] = modKey.split('@');
  const cacheFile = path.join(CACHE_DIR, `${modKey}.json`);

  let cache = null;
  try
  {
    cache = JSON.parse(await fs.readFile(cacheFile, 'utf8'));
  }
  catch {}

  let latestTag = '';
  try
  {
    const tagRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/latest`);
    if (tagRes.ok)
    {
      const tagJson = await tagRes.json();
      latestTag = tagJson.tag_name || '';
    }
  }
  catch(e)
  {
    console.error('GitHub tag lookup failed', e);
  }

  if (cache && cache.version === latestTag)
    return res.json(cache);

  async function listFiles(dir = '')
  {
    const resp = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${dir}`);
    if (!resp.ok)
      return [];

    const items = await resp.json();
    
    let out = [];
    for (let i of items)
    {
      if (i.type === 'file')
        out.push(i.path);
      else if(i.type === 'dir')
        out.push(...await listFiles(i.path));
    }

    return out;
  }
  const files = await listFiles();

  const locPath = files.find(f => f.endsWith('en-us.lua')) || '';
  const locTxt = locPath ? await fetchRaw(owner, repo, locPath) : '';
  const locMap = parseLoc(locTxt);

  const codePaths = files.filter(f => f.endsWith('.lua') && !f.endsWith('en-us.lua'));

  const atlasDefs = {};
  const cards = [];

  for (let relPath of codePaths)
  {
    const txt = await fetchRaw(owner, repo, relPath);

    Object.assign(atlasDefs, parseAtlasDefs(txt));
    cards.push(...parseAllEntities(txt));
  }

  for (let key in atlasDefs)
  {
    const at = atlasDefs[key];
    const imgUrl = `https://raw.githubusercontent.com/${owner}/${repo}/main/${at.path}`;
    try
    {
      const buf = await fetch(imgUrl).then(r => r.arrayBuffer());
      const dir = path.join(__dirname, 'public', 'images', repo);
      
      await fs.mkdir(dir, { recursive: true });
      const name = path.basename(at.path);
      
      await fs.writeFile(path.join(dir, name), Buffer.from(buf));
      at.localPath = `/images/${repo}/${name}`;
    }
    catch {}
  }

  const newCache = { version: latestTag, locMap, atlases: atlasDefs, cards };
  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.writeFile(cacheFile, JSON.stringify(newCache, null, 2), 'utf8');

  res.json(newCache);
});

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

app.listen(PORT, () => console.log(`Listening on port ${PORT}`));