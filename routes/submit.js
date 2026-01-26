import express from 'express';
import { readData, writeData } from '../dataService.js';
import { getRepoInfo, getFileContents, fetchReadme, listGitHubFiles } from '../githubService.js';
import { buildEntry, parseGitHubUrlComponents } from '../modEntryBuilder.js';
import { backupDataJson } from '../github-backup.js';

const router = express.Router();

async function findMetadataFile(user, repo, branch)
{
    const commonPaths = [
        'manifest.json',
        'info.json',
        'data/info.json',
        `${repo}.json`,
        'metadata.json',
        'data/metadata.json',
    ];

    async function isValidMetadata(path)
    {
        try
        {
            const fileData = await getFileContents(user, repo, path, branch);
            const raw = Buffer.from(fileData.content, fileData.encoding).toString('utf8');

            let data;
            try
            {
                data = JSON.parse(raw);
            }
            catch
            {
                console.log(`[Auto-detect] ${path} is not a valid JSON file`);
                return false;
            }

            const hasId = 'id' in data;
            const hasName = 'name' in data;
            const hasAuthor = 'author' in data;

            if (hasId && hasName && hasAuthor)
            {
                console.log(`[Auto-detect] ${path} contains valid metadata (id: ${data.id}, name: ${data.name}, author: ${data.author})`);
                return true;
            }

            console.log(`[Auto-detect] ${path} missing required fields (has id: ${hasId}, has name: ${hasName}, has author: ${hasAuthor})`);
            return false;
        }
        catch
        {
            return false;
        }
    }

    for (const path of commonPaths)
    {
        if (await isValidMetadata(path))
        {
            console.log(`[Auto-detect] Found metadata at common path: ${path}`);
            return path;
        }
    }

    try
    {
        const allFiles = await listGitHubFiles(user, repo, '', branch);
        const jsonFiles = allFiles.filter(f => f.endsWith('.json'));

        console.log(`[Auto-detect] Found ${jsonFiles.length} JSON files to check`);

        for (const path of jsonFiles)
        {
            if (await isValidMetadata(path))
            {
                console.log(`[Auto-detect] Found valid metadata at: ${path}`);
                return path;
            }
        }
    }
    catch (err)
    {
        console.error('Error searching for metadata:', err);
    }

    console.log('[Auto-detect] No valid metadata file found');
    return null;
}

async function getLatestCommitDate(user, repo)
{
    try
    {
        const url = `https://api.github.com/repos/${user}/${repo}/commits?per_page=1`;
        const response = await fetch(url, { headers: config.github.headers });

        if (!response.ok)
            return null;

        const commits = await response.json();
        if (commits.length > 0)
            return commits[0].commit.committer.date;
    }
    catch (err)
    {
        console.error('Error fetching commit date:', err);
    }

    return null;
}

router.post('/submit', async (req, res) => {
    try
    {
        const { repoUrl, jsonPath, tags } = req.body;
        const tagArray = Array.isArray(tags) ? tags : (tags ? [tags] : []);

        // Parse the URL
        const { user, repo, filePath } = parseGitHubUrlComponents(repoUrl, jsonPath);
        const key = `${repo}@${user}`;

        // Check if the entry exists
        const data = await readData();
        if (key in data)
            return res.status(409).json({ error: `Entry for '${key}' already exists` });

        // Fetch the repository info and contents
        const repoInfo = await getRepoInfo(user, repo);
        const { default_branch } = repoInfo;

        if (!jsonPath || jsonPath.trim() === '')
        {
            console.log('No jsonPath provided, auto-searching...');

            jsonPath = await findMetadataFile(user, repo, branch);
            if (!jsonPath)
                return res.status(400).json({ error: 'Could not find metadata file. Please specify the path manually.' });

            console.log(`Auto-found metadata at: ${jsonPath}`);
        }

        const fileData = await getFileContents(user, repo, filePath, default_branch);
        const raw = Buffer.from(fileData.content, fileData.encoding).toString('utf8');
        const jsonData = JSON.parse(raw);

        // Build and save the entry
        const entry = buildEntry(jsonData);
        entry.published_at = new Date().toISOString();
        entry.type = "Mod";
        entry.tags = tagArray;
        
        const latestCommit = await getLatestCommitDate(user, repo);
        entry.updated_at = latestCommit || entry.published_at;

        data[key] = entry;
        await writeData(data);
        res.json({ success: true, key });

        fetchReadmeInBackground(repoUrl, user, repo, key);
    }
    catch (err)
    {
        console.error(err);
        res.status(400).json({ error: err.message });
    }
});

async function fetchReadmeInBackground(repoUrl, user, repo, key)
{
    try
    {
        // Only if the URL is standard
        if (!repoUrl.includes('raw.githubusercontent.com') && !repoUrl.includes('/blob/'))
        {
            const readme = await fetchReadme(user, repo);
            const data = await readData();

            data[key].readme = readme;

            await writeData(data);
        }

        await backupDataJson();
    }
    catch (err)
    {
        console.error('Background job failed:', err);
    }
}

export default router;