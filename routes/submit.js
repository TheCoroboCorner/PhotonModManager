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

    for (const path of commonPaths)
    {
        try
        {
            await getFileContents(user, repo, path, branch);
            console.log(`Found metadata at ${path}`);
            return path;
        }
        catch {}
    }

    try
    {
        const allFiles = await listGitHubFiles(user, repo, '', branch);
        const jsonFiles = allFiles.filter(f => f.endsWith('.json'));

        if (jsonFiles.length > 0)
        {
            console.log(`Found JSON file: ${jsonFiles[0]}`);
            return jsonFiles[0];
        }
    }
    catch (err)
    {
        console.error('Error searching for metadata:', err);
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