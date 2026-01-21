import { config } from './config.js';

export async function fetchJsonFromRepo(user, repo, jsonPath)
{
    const url = `https://raw.githubusercontent.com/${user}/${repo}/main/${jsonPath}`;
    const resp = await fetch(url);
    if (!resp.ok)
        throw new Error('Failed to fetch JSON file from GitHub');

    return resp.json();
}

export async function fetchReleases(user, repo)
{
    const url = `https://api.github.com/repos/${user}/${repo}/releases`;
    const resp = await fetch(url);
    if (!resp.ok)
        return [];

    const rels = await resp.json();
    return rels.map(r => ({
        tag: r.tag_name,
        notes: r.body || '',
        size: (r.assets || []).reduce((sum, a) => sum + (a.size || 0), 0),
        published_at: r.published_at
    }));
}

export async function fetchDefaultBranch(user, repo)
{
    const url = `https://raw.githubusercontent.com/${user}/${repo}`;
    const resp = await fetch(url, { headers: config.github.headers });

    if (!resp.ok)
        return "main";

    const data = await resp.json();
    return data.default_branch;
}

export async function fetchReadme(user, repo)
{
    const url = `https://raw.githubusercontent.com/${user}/${repo}/main/README.md`;
    const resp = await fetch(url, { headers: config.github.headers });

    return resp.ok ? resp.text() : '';
}

export async function fetchRaw(user, repo, path, branch)
{
    const url = `https://raw.githubusercontent.com/${user}/${repo}/${branch}/${path}`;
    const resp = await fetch(url, { headers: config.github.headers });
    
    return resp.ok ? resp.text() : '';
}

export async function fetchRawBinary(user, repo, path, branch)
{
    const url = `https://raw.githubusercontent.com/${user}/${repo}/${branch}/${path}`;
    const resp = await fetch(url, { headers: config.github.headers });

    return resp.ok ? resp.arrayBuffer() : null;
}

export async function listGitHubFiles(user, repo, dirPath = '')
{
    const url = `https://api.github.com/repos/${user}/${repo}/contents/${dirPath}`;
    const resp = await fetch(url, { headers: config.github.headers });
    if (!resp.ok)
        return [];

    const items = await resp.json();
    const files = [];

    for (const item of items)
    {
        if (item.type === 'file')
            files.push(item.path);
        else if (item.type === 'dir')
        {
            const subFiles = await listGitHubFiles(user, repo, item.path);
            files.push(...subFiles);
        }
    }

    return files;
}

export async function getLatestRelease(user, repo)
{
    const url = `https://api.github.com/repos/${user}/${repo}/releases/latest`;
    const resp = await fetch(url, { headers: config.github.headers });
    if (!resp.ok)
        return null;

    const data = await resp.json();
    return data.tag_name || null;
}

export async function getRepoInfo(user, repo)
{
    const url = `https://api.github.com/repos/${user}/${repo}`;
    const resp = await fetch(url, { headers: config.github.headers });
    if (!resp.ok)
        throw new Error(`GitHub repo info ${resp.status}`);

    return resp.json();
}

export async function getFileContents(user, repo, filePath, branch)
{
    const url = `https://api.github.com/repos/${user}/${repo}/contents/${filePath}?ref=${branch}`;
    const resp = await fetch(url, { headers: config.github.headers });
    if (!resp.ok)
        throw new Error(`Contents API ${resp.status}`);

    return resp.json();
}