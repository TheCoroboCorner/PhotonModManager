import fs from 'fs/promises';
import path from 'path';
import { config } from './config.js';
import { pLimit, extractBlockContent } from './utils.js';
import { fetchRaw, fetchRawBinary, listGitHubFiles, getLatestRelease, fetchDefaultBranch } from './githubService.js';
import { parseAtlasDefs, parseAllEntities, parseLoc } from './luaParser.js';
import { parseLocVars } from './locVarsEvaluator.js';
import { backupMetadata } from './github-backup.js';

async function getLatestVersionTag(user, repo, modKey)
{
    console.log(`[Server] Fetching latest tag for ${modKey}`);arguments
    
    try
    {
        const tag = await getLatestRelease(user, repo);
        const latestTag = tag || 'no-tag';

        console.log(`[Server] Latest tag for ${modKey}: ${latestTag}`);

        return latestTag;
    }
    catch (err)
    {
        console.error(`[Server] Error fetching latest tag for ${modKey}:`, err);
        return 'no-tag';
    }
}

async function tryLoadCache(metadataFile, modKey, latestTag)
{
    console.log(`[Server] Attempting to read cache from: ${metadataFile}`);

    try
    {
        const fileContent = await fs.readFile(metadataFile, 'utf8');
        const cachedData = JSON.parse(fileContent);

        console.log(`[Server] Serving cached data for ${modKey} (version ${latestTag}).`);

        return cachedData;
    }
    catch (readError)
    {
        console.warn(`[Server] Cache read failed for ${modKey}:`, readError.message);

        return null;
    }
}

async function downloadLuaFiles(user, repo, branch, luaFilesToDownload, versionCacheDir)
{
    const luaFileContents = {};

    await pLimit(config.concurrency.wikiDataFetch, luaFilesToDownload, async (luaPath) => {
        try
        {
            const txt = await fetchRaw(user, repo, luaPath, branch);
            if (txt)
            {
                const localLuaPath = path.join(versionCacheDir, path.basename(luaPath));
                await fs.writeFile(localLuaPath, txt);

                luaFileContents[luaPath] = txt;
            }
            else console.warn(`[Server] Empty content for Lua file ${luaPath}, skipping cache.`);
        }
        catch (err)
        {
            console.error(`[Server] Error downloading Lua file ${luaPath}:`, err);
        }
    });

    return luaFileContents;
}

function findLocalizationFile(luaFilesToDownload)
{
    return luaFilesToDownload.find(p => p.endsWith('en-us.lua')) || luaFilesToDownload.find(p => p.endsWith('default.lua'));
}

function resolveAtlasPaths(atlasDefs, allGitHubFiles)
{
    for (const key of Object.keys(atlasDefs))
    {
        const at = atlasDefs[key];
        const fileName = at.path.split('/').pop().toLowerCase();

        let match = allGitHubFiles.find(p => p.toLowerCase().includes('/assets/2x/') && p.toLowerCase().endsWith('/' + fileName));
        if (!match)
            match = allGitHubFiles.find(p => p.toLowerCase().endsWith('/' + fileName));
        if (!match)
        {
            console.warn(`[Server] Could not resolve atlas path for ${key}, keeping raw path ${at.path}`);
            at.resolvedGitHubPath = at.path;
        }
        else at.resolvedGitHubPath = match;
    }
}

async function downloadAndLinkImages(user, repo, branch, imgFiles, versionCacheDir, modKey, latestTag, atlasDefs, allGitHubFiles)
{
    await pLimit(config.concurrency.wikiDataFetch, imgFiles, async (repoPath) => {
        try
        {
            const buf = await fetchRawBinary(user, repo, repoPath, branch);
            if (!buf)
            {
                console.warn(`[Server] Empty buffer for ${repoPath}`);
                return;
            }

            const fileName = path.basename(repoPath);
            const localFile = path.join(versionCacheDir, fileName);
            await fs.writeFile(localFile, Buffer.from(buf));

            console.log(`[Server] Wrote image file ${localFile}`);

            for (const key of Object.keys(atlasDefs))
            {
                const atlasFileName = atlasDefs[key].path.split('/').pop().toLowerCase();
                if (atlasFileName === fileName.toLowerCase())
                {
                    atlasDefs[key].localPath = `/wiki-data/${modKey}/${latestTag}/${encodeURIComponent(fileName)}`;
                    atlasDefs[key].resolvedGitHubPath = repoPath;

                    console.log(`[Server] Hooked atlas ${key} -> ${atlasDefs[key].localPath}`);
                }
            }
        }
        catch (err)
        {
            console.error(`[Server] Error caching ${repoPath}:`, err);
        }
    });

    resolveAtlasPaths(atlasDefs, allGitHubFiles);
}

function parseCardConfig(rawText, cardKey)
{
    const config = {};
    const idx = rawText.indexOf('config');

    if (idx === -1)
        return config;

    const eq = rawText.indexOf('=', idx);
    const brace = rawText.indexOf('{', eq);
    const block = extractBlockContent(rawText, brace);
    if (!block)
        return config;

    const fullLuaTable = rawText.slice(brace, block.endIndex + 1);

    console.log(`[DEBUG CONFIG] fullLuaTable for ${cardKey}:\n`, fullLuaTable);

    try
    {
        const jsonLike = fullLuaTable.replace(/(\w+)\s*=/g, `"$1":`);

        console.log(`[DEBUG CONFIG] jsonLike for ${cardKey}:\n`, jsonLike);

        return new Function(`return ${jsonLike}`)();
    }
    catch (err)
    {
        console.warn(`Failed to parse full config for ${cardKey}:`, err);

        return config;
    }
}

function processCardData(cards, locMap)
{
    for (const card of cards)
    {
        card.config = parseCardConfig(card.raw, card.key);
        card.ability = card.config;

        parseLocVars(card, locMap);
    }
}

async function fetchAndCacheWikiData(user, repo, modKey, latestTag, versionCacheDir, metadataFile)
{
    await fs.mkdir(versionCacheDir, { recursive: true });

    // Fetch the default branch
    const branch = await fetchDefaultBranch(user, repo);
    console.log(`[Server] Using branch '${branch}' for ${user}/${repo}`);

    // Fetch all files from repository
    const allGitHubFiles = await listGitHubFiles(user, repo, '', branch);
    console.log(`[Server] Found ${allGitHubFiles.length} total files in repository`);

    if (allGitHubFiles.length === 0)
    {
        console.error(`[Server] No files found in repository! Check branch name and permissions.`);
        throw new Error(`No files found in ${user}/${repo} on branch ${branch}`);
    }

    // Download and cache Lua files
    const luaFilesToDownload = allGitHubFiles.filter(p => p.endsWith('.lua'));
    console.log(`[Server] Found ${luaFilesToDownload.length} Lua files`);

    const luaFileContents = await downloadLuaFiles(user, repo, branch, luaFilesToDownload, versionCacheDir);

    // Parse localization
    const locPathInRepo = findLocalizationFile(luaFilesToDownload);
    const locTxt = locPathInRepo ? luaFileContents[locPathInRepo] : '';

    if (!locTxt)
        console.warn(`[Server] No localization file found or it's empty!`);

    const locMap = parseLoc(locTxt);
    console.log(`[Server] Parsed ${Object.keys(locMap).length} localization entries`);

    // Parse atlases and cards
    const atlasDefs = {};
    const cards = [];
    const codeLuaPaths = luaFilesToDownload.filter(p => p !== locPathInRepo);

    for (const luaPath of codeLuaPaths)
    {
        const txt = luaFileContents[luaPath];
        if (!txt)
            continue;

        Object.assign(atlasDefs, parseAtlasDefs(txt));
        cards.push(...parseAllEntities(txt));
    }

    // Download and cache images
    const imgFiles = allGitHubFiles.filter(p => p.toLowerCase().includes('assets/2x/') && p.toLowerCase().endsWith('.png'));
    await downloadAndLinkImages(user, repo, branch, imgFiles, versionCacheDir, modKey, latestTag, atlasDefs, allGitHubFiles);

    processCardData(cards, locMap);

    const finalData = { locMap, atlases: atlasDefs, cards, version: latestTag };

    await fs.writeFile(metadataFile, JSON.stringify(finalData, null, 2), 'utf8');
    backupMetadata(modKey, latestTag).catch(console.error);

    console.log(`[Server] Successfully cached data for ${modKey} (version: ${latestTag}).`);
    return finalData;
}

export async function getWikiData(modKey)
{
    const [repo, user] = modKey.split('@');
    const modLocalCacheDir = path.join(config.paths.wikiData, modKey);

    // Latest version tag
    const latestTag = await getLatestVersionTag(user, repo, modKey);
    const versionCacheDir = path.join(modLocalCacheDir, latestTag);
    const metadataFile = path.join(versionCacheDir, 'metadata.json');

    // Attempt to serve from cache
    const cachedData = await tryLoadCache(metadataFile, modKey, latestTag);
    if (cachedData)
        return cachedData;

    // If no cache, fetch from GitHub
    console.log(`[Server] Cache miss for ${modKey} (version: ${latestTag}). Fetching from GitHub...`);
    return await fetchAndCacheWikiData(user, repo, modKey, latestTag, versionCacheDir, metadataFile);
}