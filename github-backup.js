import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OWNER = process.env.GITHUB_OWNER;
const REPO  = process.env.GITHUB_REPO;
const TOKEN = process.env.GITHUB_TOKEN;

const DATA_FILE = path.join(__dirname, 'data.json');
const VOTES_FILE = path.join(__dirname, 'votes.json');
const WIKI_LOCAL_DATA_DIR = path.join(__dirname, 'wiki-data');

const API_BASE = 'https://api.github.com';



async function getFileSha() {
  const url = `${API_BASE}/repos/${OWNER}/${REPO}/contents/data.json`;
  const resp = await fetch(url, { headers: { Authorization: `token ${TOKEN}`, Accept: 'application/vnd.github.v3+json' }});
  if (resp.status === 404) 
    return null;
  if (!resp.ok) 
    throw new Error(`GitHub GET contents failed: ${resp.status}`);
  const body = await resp.json();
  console.log(body.sha);
  return body.sha;
}

async function getVotesSha() {
  const url = `${API_BASE}/repos/${OWNER}/${REPO}/contents/votes.json`;
  const resp = await fetch(url, {
    headers: { Authorization: `token ${TOKEN}`, Accept: 'application/vnd.github.v3+json' }
  });
  if (resp.status === 404) return null;
  if (!resp.ok) throw new Error(`GitHub GET votes failed: ${resp.status}`);
  const body = await resp.json();
  return body.sha;
}

export async function backupDataJson() {
  const content = await fs.readFile(DATA_FILE, 'utf8');
  const base64  = Buffer.from(content, 'utf8').toString('base64');
  const sha     = await getFileSha();

  const url = `${API_BASE}/repos/${OWNER}/${REPO}/contents/data.json`;
  console.log("Fetching data.json...");
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
  console.log("Finishing fetching data.json...")
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`GitHub PUT contents failed (${resp.status}): ${err}`);
  }
  const data = await resp.json();
  console.log("Backup commit URL:", data.content && data.content.html_url);
}

export async function backupVotesJson() {
  const content = await fs.readFile(VOTES_FILE, 'utf8');
  const base64 = Buffer.from(content, 'utf8').toString('base64');
  const sha = await getVotesSha();

  const url = `${API_BASE}/repos/${OWNER}/${REPO}/contents/votes.json`;
  console.log("Fetching votes.json...");
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
  console.log("Finishing fetching votes.json...");
  if (!resp.ok)
  {
    const err = await resp.text();
    throw new Error(`GitHub PUT contents failed (${resp.status}): ${err}`);
  }
  const votes = await resp.json();
  console.log("Backup commit URL:", votes.content && votes.content.html_url);
}

async function getShaFor(pathInRepo) {
  const url = `${API_BASE}/repos/${OWNER}/${REPO}/contents/${pathInRepo}`;
  const resp = await fetch(url, { headers: { Authorization: `token ${TOKEN}`, Accept: 'application/vnd.github.v3+json' }});
  if (resp.status === 404)
    return null;
  if (!resp.ok)
    throw new Error(`GitHub GET ${pathInRepo} failed: ${resp.status} - ${await resp.text()}`);

  const body = await resp.json();
  return body.sha;
}

export async function backupMetadata(modKey, versionTag) {
  const localMetadataPath = path.join(WIKI_LOCAL_DATA_DIR, modKey, versionTag, 'metadata.json');
  const repoPath = `wiki-data-cache/${modKey}/${versionTag}/metadata.json`;

  try
  {
    const content = await fs.readFile(localMetadataPath, 'utf8');
    const base64 = Buffer.from(content, 'utf8').toString('base64');
    const existingSha = await getShaFor(repoPath);

    const url = `${API_BASE}/repos/${OWNER}/${REPO}/contents/${repoPath}`;
    console.log(`[GitHub Backup] Backing up ${repoPath}...`);
    const resp = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `token ${TOKEN}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: `Backup wiki metadata for ${modKey} v${versionTag} @ ${new Date().toISOString()}`,
        content: base64,
        sha: existingSha || undefined,
        branch: 'main'
      })
    });

    if (!resp.ok)
    {
      const err = await resp.text();
      throw new Error(`GitHub PUT ${repoPath} failed (${resp.status}): ${err}`);
    }

    const data = await resp.json();
    console.log(`[GitHub Backup] Backed up ${repoPath} to commit`, data.content && data.content.html_url);
  }
  catch (error)
  {
    console.error(`[Github Backup] Failed to backup metadata for ${modKey} v${versionTag}:`, error);
  }

  const url = `${API_BASE}/repos/${OWNER}/${REPO}/contents/${repoPath}`;
  const resp = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `token ${TOKEN}`,
      Accept: 'application/vnd.github.v3+json'
    },
    body: JSON.stringify({
      message: `Backup wiki cache for ${modKey} @ ${new Date().toISOString()}`,
      content: 'base64',
      sha: existingSha || undefined
    })
  });

  if (!resp.ok)
  {
    const err = await resp.text();
    throw new Error(`GitHub PUT ${repoPath} failed (${resp.status}): ${err}`);
  }
  const data = await resp.json();
  console.log(`Backed up ${repoPath} to commit`, data.content.html_url);
}