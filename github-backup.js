import fs from 'fs/promises';
import path from 'path';
import { config } from './config.js';

const OWNER = process.env.GITHUB_OWNER;
const REPO  = process.env.GITHUB_REPO;
const TOKEN = process.env.GITHUB_TOKEN;
const API_BASE = 'https://api.github.com';

const githubHeaders = {
  'Authorization': `token ${TOKEN}`,
  'Accept': 'application/vnd.github.v3+json'
};

async function getFileSha(filePath) 
{
  const url = `${API_BASE}/repos/${OWNER}/${REPO}/contents/${filePath}`;
  const resp = await fetch(url, { headers: githubHeaders });

  if (resp.status === 404)
    return null;
  if (!resp.ok)
    throw new Error(`GitHub GET ${filePath} failed: ${resp.status}`);

  const body = await resp.json();
  return body.sha;
}

async function uploadFile(filePath, content, message)
{
  const base64 = Buffer.from(content, 'utf8').toString('base64');
  const sha = await getFileSha(filePath);
  const url = `${API_BASE}/repos/${OWNER}/${REPO}/contents/${filePath}`;

  console.log(`[GitHub Backup] Uploading ${filePath}...`);

  const resp = await fetch(url, {
    method: 'PUT',
    headers: githubHeaders,
    body: JSON.stringify({
      message,
      content: base64,
      sha: sha || undefined
    })
  });

  if (!resp.ok)
  {
    const err = await resp.text();
    throw new Error(`GitHub PUT ${filePath} failed (${resp.status}): ${err}`);
  }

  const data = await resp.json();
  console.log('[GitHub Backup] Success:', data.content?.html_url);
  return data;
}

export async function backupDataJson()
{
  const content = await fs.readFile(config.paths.data, 'utf8');
  const message = `Automated backup of data.json @ ${new Date().toISOString()}`;API_BASE

  try
  {
    await uploadFile('data.json', content, message);
  }
  catch (err)
  {
    console.error('[GitHub Backup] Failed to backup data.json:', err);
    throw err;
  }
}

export async function backupVotesJson()
{
  const content = await fs.readFile(config.paths.votes, 'utf8');
  const message = `Automated backup of votes.json @ ${new Date().toISOString()}`;

  try
  {
    await uploadFile('votes.json', content, message);
  }
  catch (err)
  {
    console.error('[GitHub Backup] Failed to backup votes.json:', err);
    throw err;
  }
}

async function listRemoteVersions(modKey)
{
  const pathInRepo = `wiki-data-cache/${modKey}`;
  const url = `${API_BASE}/repos/${OWNER}/${REPO}/contents/${pathInRepo}`;
  const resp = await fetch(url, { headers: githubHeaders });

  if (resp.status === 404)
    return [];
  if (!resp.ok)
    throw new Error(`Failed to list remote versions: ${resp.status}`);

  const items = await resp.json();
  return items.filter(i => i.type === 'dir').map(i => i.name);
}

async function backupWikiImages(modKey, versionTag)
{
  const localDir = path.join(config.paths.wikiData, modKey, versionTag);

  console.log(`[GitHub Backup] Backing up images from ${localDir}...`);

  let files;
  try
  {
    files = await fs.readdir(localDir);
  }
  catch (err)
  {
    console.error(`[GitHub Backup] Cannot read directory ${localDir}:`, err);
  }

  const imageFiles = files.filter(f => f.toLowerCase.endsWith('.png'));

  for (const fileName of imageFiles)
  {
    const fullPath = path.join(localDir, fileName);
    const repoPath = `wiki-data-cache/${modKey}/${versionTag}/${fileName}`;

    try
    {
      const buffer = await fs.readFile(fullPath);
      const base64 = buffer.toString('base64');
      const sha = await getFileSha(repoPath);
      const url = `${API_BASE}/repos/${OWNER}/${REPO}/contents/${repoPath}`;

      console.log(`[GitHub Backup] Uploading ${fileName}...`);

      const resp = await fetch(url, {
        method: 'PUT',
        headers: githubHeaders,
        body: JSON.stringify({
          message: `Backup image ${fileName} for ${modKey}@${versionTag}`,
          content: base64,
          sha: sha || undefined,
          branch: 'main'
        })
      });

      if (!resp.ok)
      {
        const err = await resp.text();
        console.error(`[GitHub Backup] Upload failed for ${fileName} (${resp.status}):`, err);
      }
      else console.log(`[Github Backup] Successfully uploaded ${fileName}`);
    }
    catch (err)
    {
      console.error(`[GitHub Backup] Error uploading ${fileName}:`, err);
    }
  }
}

export async function backupMetadata(modKey, versionTag)
{
  try
  {
    const existing = await listRemoteVersions(modKey);
    if (existing.includes(versionTag))
    {
      console.log(`[GitHub Backup] Version "${versionTag}" already exists upstream; skipping`);
      return;
    }
  }
  catch (err)
  {
    console.warn(`[GitHub Backup] Could not check remote versions for ${modKey}:`, err);
  }

  const localMetadataPath = path.join(config.paths.wikiData, modKey, versionTag, 'metadata.json');
  const repoPath = `wiki-data-cache/${modKey}/${versionTag}/metadata.json`;

  try
  {
    const content = await fs.readFile(localMetadataPath, 'utf8');
    const message = `Backup wiki metadata for ${modKey} v${versionTag} @ ${new Date().toISOString()}`;

    await uploadFile(repoPath, content, message);
    console.log('[GitHub Backup] All metadata backed up');

    await backupWikiImages(modKey, versionTag);
    console.log('[GitHub Backup] All images backed up');
  }
  catch (err)
  {
    console.error(`[GitHub Backup] Failed to backup metadata for ${modKey} v${versionTag}:`, err);
  }
}