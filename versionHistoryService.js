import { readData, writeData } from './dataService.js';
import { backupDataJson } from './github-backup.js';
import { config } from './config.js';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function sanitizeForJSON(text)
{
    if (!text) return '';
    
    return text
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t')
        .replace(/\f/g, '\\f')
        .replace(/\b/g, '\\b')
        .slice(0, 5000);
}

export async function getVersionHistory(modKey, forceRefresh = false)
{
    const data = await readData();
    const mod = data[modKey];
    if (!mod)
        throw new Error('Mod not found');

    const [repo, owner] = modKey.split('@');

    const now = Date.now();
    const lastCheck = mod.versionHistoryLastCheck ? new Date(mod.versionHistoryLastCheck).getTime() : 0;
    const needsRefresh = !mod.versionHistory || (now - lastCheck > ONE_DAY_MS) || forceRefresh;

    if (!needsRefresh)
    {
        console.log(`[VersionHistory] Using cached data for ${modKey}`);
        return mod.versionHistory || [];
    }

    console.log(`[VersionHistory] Fetching fresh data for ${modKey}`);

    try
    {
        const url = `https://api.github.com/repos/${owner}/${repo}/releases`;
        const response = await fetch(url, { headers: config.github.headers });

        if (!response.ok)
        {
            console.error(`[VersionHistory] GitHub API error: ${response.status}`);
            return mod.versionHistory || [];
        }

        const releases = await response.json();

        const versionHistory = releases.map(release => ({
            tag: release.tag_name,
            name: sanitizeForJSON(release.name || release.tag_name),
            body: sanitizeForJSON(release.body || ''),
            publishedAt: release.published_at,
            htmlUrl: release.html_url,
            assets: release.assets.map(asset => ({
                name: sanitizeForJSON(asset.name),
                size: asset.size,
                downloadUrl: asset.browser_download_url
            })),
            prerelease: release.prerelease,
            draft: release.draft
        }));

        mod.versionHistory = versionHistory;
        mod.versionHistoryLastCheck = new Date().toISOString();

        try
        {
            const testJson = JSON.stringify(data);
            JSON.parse(testJson);
        }
        catch (validateErr)
        {
            console.error('[VersionHistory] Generated invalid JSON, not saving:', validateErr);
            return mod.versionHistory || [];
        }

        await writeData(data);
        
        backupDataJson().catch(err => console.error('[VersionHistory] Backup failed (non-critical):', err.message));

        console.log(`[VersionHistory] Cached ${versionHistory.length} releases for ${modKey}`);

        return versionHistory;
    }
    catch (err)
    {
        console.error('[VersionHistory] Error fetching releases:', err);
        return mod.versionHistory || [];
    }
}