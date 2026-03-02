import fs from 'fs/promises';
import path from 'path';
import { config } from './config.js';

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

        const dataUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/data.json`;
        console.log('[DataRestore] Fetching data.json from:', dataUrl);

        const dataResponse = await fetch(dataUrl, { headers: config.github.headers });
        if (!dataResponse.ok)
        {
            console.error(`[DataRestore] Failed to fetch data.json: ${dataResponse.status} ${dataResponse.statusText}`);

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

        const backupData = await dataResponse.text();

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

        console.log('[DataRestore] Successfully restored data.json from GitHub');
        console.log(`[DataRestore] Loaded ${modCount} mods`);

        await restoreModImages(owner, repo, branch);

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

async function restoreModImages(owner, repo, branch)
{
    console.log('[DataRestore] Restoring user-uploaded images...');

    try
    {
        const cacheUrl = `https://api.github.com/repos/${owner}/${repo}/contents/wiki-data-cache`;
        const cacheResponse = await fetch(cacheUrl, { headers: config.github.headers });

        if (!cacheResponse.ok)
        {
            console.log('[DataRestore] No wiki-data-cache found on GitHub');
            return;
        }

        const cacheDirs = await cacheResponse.json();
        
        if (!Array.isArray(cacheDirs))
        {
            console.log('[DataRestore] Unexpected response format from GitHub');
            return;
        }

        const modKeys = cacheDirs
            .filter(item => item.type === 'dir')
            .map(item => item.name);

        console.log(`[DataRestore] Found ${modKeys.length} mods with potential images`);

        let restoredCount = 0;

        for (const modKey of modKeys)
        {
            const restored = await restoreModKeyImages(owner, repo, branch, modKey);
            if (restored > 0)
                restoredCount += restored;
        }

        console.log(`[DataRestore] Restored ${restoredCount} images total`);
    }
    catch (err)
    {
        console.error('[DataRestore] Error restoring images:', err.message);
    }
}

async function restoreModKeyImages(owner, repo, branch, modKey)
{
    try
    {
        const imagesUrl = `https://api.github.com/repos/${owner}/${repo}/contents/wiki-data-cache/${modKey}/images`;
        const imagesResponse = await fetch(imagesUrl, { headers: config.github.headers });

        if (!imagesResponse.ok)
            return 0;

        const images = await imagesResponse.json();
        
        if (!Array.isArray(images))
            return 0;

        const imageFiles = images.filter(item => item.type === 'file');

        if (imageFiles.length === 0)
            return 0;

        console.log(`[DataRestore] Restoring ${imageFiles.length} images for ${modKey}...`);

        const localImagesDir = path.join(config.paths.wikiData, modKey, 'images');
        await fs.mkdir(localImagesDir, { recursive: true });

        let restoredCount = 0;

        for (const imageFile of imageFiles)
        {
            try
            {
                const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/wiki-data-cache/${modKey}/images/${imageFile.name}`;
                const imageResponse = await fetch(rawUrl, { headers: config.github.headers });

                if (!imageResponse.ok)
                {
                    console.error(`[DataRestore] Failed to download ${imageFile.name}: ${imageResponse.status}`);
                    continue;
                }

                const buffer = await imageResponse.arrayBuffer();
                const localPath = path.join(localImagesDir, imageFile.name);
                
                await fs.writeFile(localPath, Buffer.from(buffer));
                
                console.log(`[DataRestore] Restored ${imageFile.name} for ${modKey}`);
                restoredCount++;
            }
            catch (err)
            {
                console.error(`[DataRestore] Failed to restore ${imageFile.name}:`, err.message);
            }
        }

        return restoredCount;
    }
    catch (err)
    {
        console.error(`[DataRestore] Error restoring images for ${modKey}:`, err.message);
        return 0;
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