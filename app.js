// app.js (ESM)
import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { backupDataJson } from './github-backup.js';

// Fix for __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;
const DATA_FILE = path.join(__dirname, 'data.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- Helper functions ---

function parseGitHubUrl(repoUrl) {
  const regex = /^https?:\/\/(?:www\.)?github\.com\/([^\/]+)\/([^\/]+)(?:\/.+)?$/;
  const match = repoUrl.match(regex);
  if (!match) throw new Error('Invalid GitHub URL format');
  return { user: match[1], repo: match[2] };
}

async function fetchJsonFromRepo(user, repo, jsonPath) {
  const url = `https://raw.githubusercontent.com/${user}/${repo}/main/${jsonPath}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error('Failed to fetch JSON file from GitHub');
  return resp.json();
}

function buildEntry(target) {
  const entry = {
    id: target.id,
    name: target.name,
    author: target.author,
    description: target.description,
    favourites: 0
  };
  ['id', 'name', 'author', 'description', 'badge_colour', 'dependencies', 'conflicts', 'provides', 'git_owner', 'git_repo',
    'mod_index_id', 'mod_path', 'subpath', 'download_suffix', 'update_mandatory', 'target_version'].forEach(key => {
    if (key in target) entry[key] = target[key];
  });
  return entry;
}

async function fetchReleases(user, repo) {
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

async function fetchReadme(user, repo) {
  const url = `https://raw.githubusercontent.com/${user}/${repo}/main/README.md`;
  const resp = await fetch(url);
  return resp.ok ? resp.text() : '';
}

async function readData() {
  try {
    const txt = await fs.readFile(DATA_FILE, 'utf-8');
    return JSON.parse(txt);
  } catch {
    return {};
  }
}

async function writeData(data) {
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
}

app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "connect-src 'self'; " +
    "script-src 'self'; " +
    "style-src 'self';"
  );
  next();
});

app.get('/', (req, res) => {
  res.send(`
    <h1>Photon Mod Manager</h1>
    <ul>
      <li><a href="/submit">Submit a repo JSON</a></li>
      <li><a href="/browse">Browse data.json</a></li>
    </ul>
  `);
});

app.get('/submit', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'submit.html'));
});

app.post('/submit', async (req, res) => {
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

    const repoInfoRes = await fetch(`https://api.github.com/repos/${user}/${repo}`,
    {
      headers:
      {
        'User-Agent': 'photonmodmanager',
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `Bearer ${process.env.GITHUB_FETCH_TOKEN}`
      }
    });
    if (!repoInfoRes.ok)
    {
      const err = await repoInfoRes.json();
      throw new Error(`GitHub API (repo) error: ${repoInfoRes.status} ${err.message || repoInfoRes.statusText}`);
    }

    const { default_branch } = await repoInfoRes.json();

    const apiUrl = `https://api.github.com/repos/${user}/${repo}/contents/${filepath}?ref=${default_branch}`;
    const apiRes = await fetch(apiUrl, 
    {
      headers:
      {
        'User-Agent': 'photonmodmanager',
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `Bearer ${process.env.GITHUB_FETCH_TOKEN}`
      }
    });
    if (!apiRes.ok)
    {
      const err = await apiRes.json();
      throw new Error(`GitHub API error: ${apiRes.status} ${err.message || apiRes.statusText}`);
    }

    const { content, encoding } = await apiRes.json();
    const raw = Buffer.from(content, encoding).toString('utf8');
    jsonData = JSON.parse(raw);

    const entry = buildEntry(jsonData);
    if (!repoUrl.includes('raw.githubusercontent.com') && !repoUrl.includes('/blob/'))
      entry.readme = await fetchReadme(user, repo);
    entry.published_at = new Date().toISOString();
    entry.type = "Mod";
    entry.tags = tagArray;

    data[key] = entry;
    await writeData(data);
    backupDataJson().catch(console.error);

    res.json({ success: true, key });
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
function sortEntries(entries, field, order = 'desc') {
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

app.get('/browse', (_req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'browse.html'))
);

app.get('/about', (_req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'about.html'))
);

app.get('/data', (_req, res) => {
  res.sendFile(DATA_FILE);
});

app.listen(PORT, () => console.log(`Listening on port ${PORT}`));