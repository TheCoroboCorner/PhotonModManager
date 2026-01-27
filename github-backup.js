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

async function uploadFile(filePath, base64Content, message, maxRetries = 3)
{
  const url = `${API_BASE}/repos/${OWNER}/${REPO}/contents/${filePath}`;

  for (let attempt = 0; attempt <= maxRetries; attempt++)
  {
    const sha = await getFileSha(filePath);

    const resp = await fetch(url, {
      method: 'PUT',
      headers: githubHeaders,
      body: JSON.stringify({
        message,
        content: base64Content,
        sha: sha || undefined
      })
    });

    if (resp.ok)
      return await resp.json();

    if (resp.status !== 409 || attempt === maxRetries)
    {
      const err = await resp.text();
      throw new Error(`GitHub PUT ${filePath} failed (${resp.status}): ${err}`);
    }
  }
}

export async function backupDataJson()
{
  const content = await fs.readFile(config.paths.data, 'utf8');
  const base64 = Buffer.from(content, 'utf8').toString('base64');
  const message = `Automated backup of data.json @ ${new Date().toISOString()}`;

  await uploadFile('data.json', base64, message);
}

export async function backupVotesJson()
{
  const content = await fs.readFile(config.paths.votes, 'utf8');
  const base64 = Buffer.from(content, 'utf8').toString('base64');
  const message = `Automated backup of votes.json @ ${new Date().toISOString()}`;

  await uploadFile('votes.json', base64, message);
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

  let files;
  try
  {
    files = await fs.readdir(localDir);
  }
  catch
  {
    return;
  }

  const imageFiles = files.filter(f => f.toLowerCase().endsWith('.png'));

  for (const fileName of imageFiles)
  {
    const fullPath = path.join(localDir, fileName);
    const repoPath = `wiki-data-cache/${modKey}/${versionTag}/${fileName}`;
    const buffer = await fs.readFile(fullPath);
    const base64 = buffer.toString('base64');

    await uploadFile(
      repoPath,
      base64,
      `Backup image ${fileName} for ${modKey}@${versionTag}`
    );
  }
}

export async function backupMetadata(modKey, versionTag)
{
  try
  {
    const existing = await listRemoteVersions(modKey);
    if (existing.includes(versionTag))
      return;
  }
  catch
  {
    // proceed optimistically
  }

  const localMetadataPath =
    path.join(config.paths.wikiData, modKey, versionTag, 'metadata.json');
  const repoPath =
    `wiki-data-cache/${modKey}/${versionTag}/metadata.json`;

  const content = await fs.readFile(localMetadataPath, 'utf8');
  const base64 = Buffer.from(content, 'utf8').toString('base64');
  const message =
    `Backup wiki metadata for ${modKey} v${versionTag} @ ${new Date().toISOString()}`;

  await uploadFile(repoPath, base64, message);
  await backupWikiImages(modKey, versionTag);
}