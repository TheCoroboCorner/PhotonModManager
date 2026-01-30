import fs from 'fs/promises';
import { config } from './config.js';
import path from 'path';

let dataRestored = false;

export async function restoreDataOnStartup()
{
    if (dataRestored)
    {
        console.log('[DataRestore] Data already restored, skipping');
        return;
    }

    console.log('[DataRestore] Server starting up - checking for latest backup...');

    try
    {
        const owner = process.env.GITHUB_OWNER;
        const repo = process.env.GITHUB_REPO;
        const branch = 'main';

        const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/data.json`;

        console.log('[DataRestore] Fetching from:', url);

        const response = await fetch(url, { headers: config.github.headers });
        if (!response.ok)
        {
            console.error(`[DataRestore] Failed to fetch backup: ${response.status} ${response.statusText}`);

            const localExists = await fs.access(config.paths.data).then(() => true).catch(() => false);

            if (localExists)
            {
                console.log('[DataRestore] Using existing local data.json');
                dataRestored = true;
                return;
            }
            else
            {
                console.error('[DataRestore] No backup available and no local file - creating empty data');
                await fs.writeFile(config.paths.data, '{}', 'utf-8');
                dataRestored = true;
                return;
            }
        }

        const backupData = await response.text();

        try
        {
            JSON.parse(backupData);
        }
        catch (err)
        {
            console.error('[DataRestore] Backup is not valid JSON:', err);
            return;
        }

        await fs.writeFile(config.paths.data, backupData, 'utf8');

        const data = JSON.parse(backupData);
        const modCount = Object.keys(data).length;

        console.log('[DataRestore] Successfully restored data from GitHub backup');
        console.log(`[DataRestore] Loaded ${modCount} mods`);

        dataRestored = true;
    }
    catch (err_1)
    {
        console.error('[DataRestore] Error restoring data:', err_1);

        try
        {
            await fs.access(config.paths.data);
            console.log('[DataRestore] Using existing local data.json as fallback');
            dataRestored = true;
        }
        catch (err_2)
        {
            console.error('[DataRestore] No local file available either - creating empty data');
            await fs.writeFile(config.paths.data, '{}', 'utf8');
            dataRestored = true;
        }
    }
}

export function isDataRestored()
{
    return dataRestored;
}

export function resetDataRestoredFlag()
{
    dataRestored = false;
}