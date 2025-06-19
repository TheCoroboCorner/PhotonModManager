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

/**
 * Parse GitHub URL, return { user, repo }
 * @throws Error if invalid URL
 */
function parseGitHubUrl(repoUrl) {
  const regex = /^https?:\/\/(?:www\.)?github\.com\/([^\/]+)\/([^\/]+)(?:\/.+)?$/;
  const match = repoUrl.match(regex);
  if (!match) throw new Error('Invalid GitHub URL format');
  return { user: match[1], repo: match[2] };
}

/**
 * Fetch JSON file from raw GitHub URL
 */
async function fetchJsonFromRepo(user, repo, jsonPath) {
  const url = `https://raw.githubusercontent.com/${user}/${repo}/main/${jsonPath}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error('Failed to fetch JSON file from GitHub');
  return resp.json();
}

/**
 * Extract required and optional fields from target JSON
 */
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

/**
 * Fetch releases info from GitHub API
 */
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

/**
 * Fetch README.md from the repo
 */
async function fetchReadme(user, repo) {
  const url = `https://raw.githubusercontent.com/${user}/${repo}/main/README.md`;
  const resp = await fetch(url);
  return resp.ok ? resp.text() : '';
}

/**
 * Read or initialize data.json
 */
async function readData() {
  try {
    const txt = await fs.readFile(DATA_FILE, 'utf-8');
    return JSON.parse(txt);
  } catch {
    return {};
  }
}

/**
 * Write data.json back to disk
 */
async function writeData(data) {
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
}

// Set Content Security Policy header
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

// 1) Welcome page
app.get('/', (req, res) => {
  res.send(`
    <h1>Photon Mod Manager</h1>
    <ul>
      <li><a href="/submit">Submit a repo JSON</a></li>
      <li><a href="/browse">Browse data.json</a></li>
    </ul>
  `);
});

// 2) Form page
app.get('/submit', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'submit.html'));
});

// 3) Handle submission
app.post('/submit', async (req, res) => {
  try {
    const { repoUrl, jsonPath } = req.body;
    const { user, repo } = parseGitHubUrl(repoUrl);
    const key = `${repo}@${user}`;

    const data = await readData();
    if (key in data) {
      return res.status(409).json({ error: `Entry for '${key}' already exists` });
    }

    const target = await fetchJsonFromRepo(user, repo, jsonPath);
    const entry = buildEntry(target);
    entry.readme = await fetchReadme(user, repo);
    entry.published_at = new Date().toISOString();

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

// 4) Browse data.json
app.get('/browse', async (req, res) => {
  try {
    const data = await readData();
    const { sortBy, order } = req.query;
    let entries = Object.entries(data).map(([key, entry]) => ({ key, ...entry }));
    if (sortBy === 'published_at' || sortBy === 'favourites') {
      entries = sortEntries(data, sortBy, order === 'asc' ? 'asc' : 'desc');
    }

    // Build HTML
    let html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Browse - Photon</title>
          <!-- The style.css file allows you to change the look of your web pages.
              If you include the next line in all your web pages, they will all share the same look.
              This makes it easier to make new pages for your site. -->
          <link href="/style.css" rel="stylesheet" type="text/css" media="all">
        </head>
        <body>
          <div id="main-container">
            <div id="navbar">
              <ul class="nav">
                <li>
                  <a href="https://photonmodmanager.onrender.com">Home</a>
                </li>
                <li>
                  <a href="https://photonmodmanager.onrender.com/submit">Submit</a>
                </li>
                <li>
                  <a href="https://photonmodmanager.onrender.com/browse">Browse</a>
                </li>
              </ul>
            </div>
          
            <div class="content-wrapper flex alignment">
              <div id="content-container" style="flex-grow: 1;">
                <div class="wrapper">
                  <h1>
                    Browse
                  </h1>
                  <br>
                  <p>
                    Here, you may browse various mods, all of which have been uploaded to this database, as well as download them. As this database is still new, the list may be a bit limited, but have faith that it will grow in time.
                  </p>
                </div>
                <form method="get">
                  <label>
                    <div class="select-box" style="width:200px;">
                      <select name="sortBy">
                        <option value="">--none--</option>
                        <option value="published_at"${sortBy==='published_at'?' selected':''}>Date</option>
                        <option value="favourites"${sortBy==='favourites'?' selected':''}>Favourites</option>
                      </select>
                    </div>
                  </label>
                  <label>Order:
                    <div class="select-box" style="width:200px;">
                      <select name="order">
                        <option value="asc"${order==='asc'?' selected':''}>Ascending</option>
                        <option value="desc"${order==='desc'?' selected':''}>Descending</option>
                      </select>
                    </div>
                  </label>
                  <button class="click-me" type="submit">Apply</button>
                </form>
                <ul>
    `;
    for (const e of entries) {
      const [repo, owner] = e.key.split('@');
      const githubLink = `https://github.com/${owner}/${repo}`

      html += `<li><strong>${e.name}</strong> by ${e.author}<br>` +
              `Published: ${e.published_at}<br>` +
              `Favourites: ${e.favourites}<br>` +
              `<a href="${githubLink}" target="_blank">View Github page</a>` +
              `</li><hr>`;
    }
    html += `
                  </div>
            </div>
            
            <div id="footer">
              <div class="footer-wrapper">
                <p>
                  A website meant to manage mods from Balatro by LocalThunk. We do not claim to own Balatro in any way.
                </p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;
    res.send(html);
  } catch (err) {
    console.error('Browse error:', err);
    res.status(500).send('<p>Server Error</p>');
  }
});


// Serve raw data.json file
app.get('/data', (_req, res) => {
  res.sendFile(DATA_FILE);
});

app.listen(PORT, () => console.log(`Listening on port ${PORT}`));