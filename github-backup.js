import fetch from 'node‑fetch';
import fs from 'fs/promises';
import path from 'path';

const OWNER = process.env.GITHUB_OWNER;
const REPO  = process.env.GITHUB_REPO;
const TOKEN = process.env.GITHUB_TOKEN;
const DATA_FILE = path.join(__dirname, 'data.json');
const API_BASE = 'https://api.github.com';

async function getFileSha() {
  const url = `${API_BASE}/repos/${OWNER}/${REPO}/contents/data.json`;
  const resp = await fetch(url, {
    headers: { Authorization: `token ${TOKEN}`, Accept: 'application/vnd.github.v3+json' }
  });
  if (resp.status === 404) return null;
  if (!resp.ok) throw new Error(`GitHub GET contents failed: ${resp.status}`);
  const body = await resp.json();
  return body.sha;
}

export async function backupDataJson() {
  const content = await fs.readFile(DATA_FILE, 'utf‑8');
  const base64  = Buffer.from(content, 'utf‑8').toString('base64');
  const sha     = await getFileSha();

  const url = `${API_BASE}/repos/${OWNER}/${REPO}/contents/data.json`;
  const resp = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `token ${TOKEN}`,
      Accept: 'application/vnd.github.v3+json'
    },
    body: JSON.stringify({
      message: `Automated backup of data.json @ ${new Date().toISOString()}`,
      content: base64,
      sha: sha || undefined
    })
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`GitHub PUT contents failed (${resp.status}): ${err}`);
  }
}