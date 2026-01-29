import { readData, writeData } from './dataService.js';
import { backupDataJson } from './github-backup.js';
import { config } from './config.js';
import { version } from 'react';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

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
            name: release.name || release.tag_name,
            body: release.body || '',
            publishedAt: release.published_at,
            htmlUrl: release.htmlUrl,
            assets: release.assets.map(asset => ({
                name: asset.name,
                size: asset.size,
                downloadUrl: asset.browser_download_url
            })),
            prerelease: release.prerelease,
            draft: release.draft
        }));

        mod.versionHistory = versionHistory;
        mod.versionHistoryLastCheck = new Date().toISOString();

        await writeData(data);
        backupDataJson().catch(console.error);

        console.log(`[VersionHistory] Cached ${versionHistory.length} releases for ${modKey}`);

        return versionHistory;
    }
    catch (err)
    {
        console.error('[VersionHistory] Error fetching releases:', err);
        return mod.versionHistory || [];
    }
}