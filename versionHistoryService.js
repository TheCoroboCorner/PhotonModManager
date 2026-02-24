import { readData, writeData } from './dataService.js';
import { backupDataJson } from './github-backup.js';
import { config } from './config.js';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const inFlightRequests = new Map();

let backupTimeout = null;
function scheduleBackup()
{
    if (backupTimeout)
        clearTimeout(backupTimeout);

    backupTimeout = setTimeout(() => {
        backupDataJson().catch(err => console.error('[VersionHistory] Backup failed (non-critical):', err.message));
        backupTimeout = null;
    }, 5000);
}

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
        .replace(/\x08/g, '\\b')
        .slice(0, 5000);
}

export async function getVersionHistory(modKey, forceRefresh = false)
{
    if (inFlightRequests.has(modKey)) 
    {
        console.log(`[VersionHistory] Returning in-flight request for ${modKey}`);
        return inFlightRequests.get(modKey);
    }

    const fetchPromise = (async () => {
        try 
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
                    console.error(`[VersionHistory] GitHub API error: ${response.status} for ${modKey}`);
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

                const freshData = await readData();
                
                if (!freshData[modKey]) 
                {
                    console.warn(`[VersionHistory] Mod ${modKey} disappeared during fetch`);
                    return mod.versionHistory || [];
                }

                freshData[modKey].versionHistory = versionHistory;
                freshData[modKey].versionHistoryLastCheck = new Date().toISOString();

                await writeData(freshData);
                
                scheduleBackup();

                console.log(`[VersionHistory] Cached ${versionHistory.length} releases for ${modKey}`);

                return versionHistory;
            } 
            catch (fetchErr) 
            {
                console.error(`[VersionHistory] Error fetching releases for ${modKey}:`, fetchErr.message);
                return mod.versionHistory || [];
            }
        } 
        finally 
        {
            inFlightRequests.delete(modKey);
        }
    })();

    inFlightRequests.set(modKey, fetchPromise);

    return fetchPromise;
}

export async function getVersionHistoryBatch(modKeys, forceRefresh = false) 
{
    const results = await Promise.allSettled(modKeys.map(key => getVersionHistory(key, forceRefresh)));
    
    return results.map((result, index) => ({
        modKey: modKeys[index],
        success: result.status === 'fulfilled',
        versionHistory: result.status === 'fulfilled' ? result.value : [],
        error: result.status === 'rejected' ? result.reason.message : null
    }));
}