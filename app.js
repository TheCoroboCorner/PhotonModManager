import express from 'express';
import fetch from 'node-fetch';
import FormData from 'form-data';

const app = express();
app.use(express.json());

const API_KEY = process.env.NEOCITIES_API_KEY;
const SITE = "PhotonModManager";
const FILENAME = 'data.json';

app.post('/append', async (req, res) => {
  try {
    const { repoUrl, jsonPath } = req.body;
    // parse out user & repo
    const m = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)(?:\/|$)/);
    if (!m) return res.status(400).json({ error: 'Invalid GitHub URL' });
    const [, user, repo] = m;
    // build raw URL (assumes "main" branch)
    const rawUrl = `https://raw.githubusercontent.com/${user}/${repo}/main/${jsonPath}`;

    // fetch JSON from GitHub
    const ghRes = await fetch(rawUrl);
    if (!ghRes.ok) return res.status(400).json({ error: 'Cannot fetch JSON from GitHub' });
    const remoteJson = await ghRes.json();

    // fetch existing data.json from your site
    const neocRes = await fetch(`https://${SITE}.neocities.org/${FILENAME}`);
    let existing = {};
    if (neocRes.ok) {
      try { existing = await neocRes.json(); }
      catch { existing = {}; }
    }

    // insert/overwrite under key "repo@user"
    const key = `${repo}@${user}`;
    existing[key] = remoteJson;

    // re‑upload the full JSON
    const form = new FormData();
    form.append('file',
      Buffer.from(JSON.stringify(existing, null, 2)),
      { filename: FILENAME }
    );

    const uploadRes = await fetch('https://neocities.org/api/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${API_KEY}` },
      body: form
    });
    const result = await uploadRes.json();
    return res.json(result);

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Append failed', details: err.message });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Listening on ${PORT}`));