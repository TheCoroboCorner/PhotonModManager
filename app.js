import express from 'express';
import fetch from 'node-fetch';
import FormData from 'form-data';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 10000;
const API_KEY = process.env.NEOCITIES_API_KEY;
const SITE = process.env.NEOCITIES_SITE;  // e.g., "myusername"

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Set CSP headers at runtime
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

// Handle form submissions
app.post('/append', async (req, res) => {
  try {
    const { repoUrl, jsonPath } = req.body;
    const m = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)(?:\/|$)/);
    if (!m) return res.status(400).json({ error: 'Invalid GitHub URL' });
    const [, user, repo] = m;
    const rawUrl = `https://raw.githubusercontent.com/${user}/${repo}/main/${jsonPath}`;

    const ghRes = await fetch(rawUrl);
    if (!ghRes.ok) return res.status(400).json({ error: 'GitHub file not found' });
    const remoteJson = await ghRes.json();

    const FILENAME = 'data.json';
    const neocRes = await fetch(`https://${SITE}.neocities.org/${FILENAME}`);
    let existing = {};
    if (neocRes.ok) {
      existing = await neocRes.json().catch(() => ({}));
    }

    existing[`${repo}@${user}`] = remoteJson;

    const form = new FormData();
    form.append('file', Buffer.from(JSON.stringify(existing, null, 2)), { filename: FILENAME });

    const uploadRes = await fetch('https://neocities.org/api/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${API_KEY}` },
      body: form
    });
    const result = await uploadRes.json();

    return res.json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

app.listen(PORT, () => console.log(`App listening on port ${PORT}`));