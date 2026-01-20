import { unescapeLuaString, extractBlockContent } from './utils.js';

export function parseAtlasDefs(txt)
{
    if (!txt)
        return {};

    const out = {};

    txt.replace(/SMODS\.Atlas\s*{([\s\S]*?)}/g, (_, body) => {
        const key = /key\s*=\s*['"]([^'"]+)['"]/.exec(body)?.[1];
        const path = /path\s*=\s*['"]([^'"]+)['"]/.exec(body)?.[1];
        const px = +(/px\s*=\s*(d\+)/.exec(body)?.[1] || 0);
        const py = +(/py\s*=\s*(d\+)/.exec(body)?.[1] || 0);

        if (key && path)
            out[key] = { path, px, py };
    });

    return out;
}

export function parseAllEntities(txt)
{
    const out = [];
    let cursor = 0;

    while (true)
    {
        const dotIdx = txt.indexOf("SMODS", cursor);
        if (dotIdx === -1)
            break;

        const rest = txt.slice(dotIdx + 6);
        const typeMatch = /^[A-Z][A-Za-z0-9_]*/.exec(rest);

        if (!typeMatch)
        {
            cursor = dotIdx + 6;
            continue;
        }

        const type = typeMatch[0];
        const braceIdx = txt.indexOf('{', dotIdx + 6 + type.length);

        if (braceIdx === -1)
            break;

        const block = extractBlockContent(txt, braceIdx);
        if (!block)
        {
            cursor = braceIdx + 1;
            continue;
        }

        const body = block.content;
        cursor = block.endIndex + 1;

        const keyM = /key\s*=\s*(['"])((?:\\.|(?!\1).)*?)\1/.exec(body);
        if (!keyM)
            continue;

        const key = unescapeLuaString(keyM[2]);
        const atlasM = /atlas\s*=\s*(['"])((?:\\.|(?!\1).)*?)\1/.exec(body);
        const atlas = atlasM ? unescapeLuaString(atlasM[2]) : null;

        const posM = /pos\s*=\s*{[^}]*x\s*=\s*(\d+)[^}]*y\s*=\s*(\d+)/.exec(body);
        const pos = posM ? { x: +posM[1], y: +posM[2] } : null;

        out.push({ type, key, atlas, pos, raw: body.trim() });
    }

    return out;
}

function extractTextLines(entryBody, stringRe)
{
    const lines = [];
    const textBlockRe = /text\s*=\s*{/g;
    const textBlockMatch = textBlockRe.exec(entryBody);

    if (textBlockMatch)
    {
        const textContentStartIdx = textBlockMatch.index + textBlockMatch[0].length - 1;
        const textBlockResult = extractBlockContent(entryBody, textContentStartIdx);

        if (textBlockResult)
        {
            const txtBody = textBlockResult.content;
            stringRe.lastIndex = 0;

            let lineMatch;
            while ((lineMatch = stringRe.exec(txtBody)))
                lines.push(unescapeLuaString(lineMatch[2]));
        }
    }

    return lines;
}

function parseDescriptionItems(categoryBody, categoryKey, map, stringRe)
{
    const keyOpenBraceRe = /(\w+)\s*=\s*{/g;
    let itemPos = 0;

    while (true)
    {
        keyOpenBraceRe.lastIndex = itemPos;
        const itemMatch = keyOpenBraceRe.exec(categoryBody);

        if (!itemMatch)
            break;

        const cardKey = itemMatch[1];
        const itemBlockStartIdx = itemMatch.index + itemMatch[0].length - 1;
        const itemBlockResult = extractBlockContent(categoryBody, itemBlockStartIdx);

        if (!itemBlockResult)
        {
            itemPos = itemMatch.index + itemMatch[0].length;
            continue;
        }

        const entryBody = itemBlockResult.content;
        itemPos = itemBlockResult.endIndex + 1;

        const nameRe = /name\s*=\s*(['"])((?:\\.|(?!\1).)*?)\1/;
        const nm = nameRe.exec(entryBody);
        const name = nm ? unescapeLuaString(nm[2]) : '';

        const lines = extractTextLines(entryBody, stringRe);
        map[cardKey] = { name, text: lines, type: categoryKey };
    }
}

function parseDescriptionsSection(sectionBody, map)
{
    const keyOpenBraceRe = /(\w+)\s*=\s*{/g;
    const stringRe = /(['"])((?:\\.|(?!\1).)*?)\1/g;
    let categoryPos = 0;

    while (true)
    {
        keyOpenBraceRe.lastIndex = categoryPos;
        const categoryMatch = keyOpenBraceRe.exec(sectionBody);

        if (!categoryMatch)
            break;

        const categoryKey = categoryMatch[1];
        const catBlockStartIdx = categoryMatch.index + categoryMatch[0].length - 1;
        const catBlockResult = extractBlockContent(sectionBody, catBlockStartIdx);

        if (!catBlockResult)
        {
            categoryPos = categoryMatch.index + categoryMatch[0].length;
            continue;
        }

        const categoryBodyContent = catBlockResult.content;
        categoryPos = catBlockResult.endIndex + 1;

        parseDescriptionItems(categoryBodyContent, categoryKey, map, stringRe);
    }
}

function parseMiscSection(sectionBody, map)
{
    const keyOpenBraceRe = /(\w+)\s*=\s*{/g;
    let miscSubSectionPos = 0;

    while (true)
    {
        keyOpenBraceRe.lastIndex = miscSubSectionPos;
        const subSectionMatch = keyOpenBraceRe.exec(sectionBody);

        if (!subSectionMatch)
            break;

        const subSectionName = subSectionMatch[1];
        const miscSubBlockStartIdx = subSectionMatch.index + subSectionMatch[0].length - 1;
        const miscSubBlockResult = extractBlockContent(sectionBody, miscSubBlockStartIdx);

        if (!miscSubBlockResult)
        {
            miscSubSectionPos = subSectionMatch.index + subSectionMatch[0].length;
            continue;
        }

        const subSectionContent = miscSubBlockResult.content;
        miscSubSectionPos = miscSubBlockResult.endIndex + 1;

        const pairRe = /(\w+)\s*=\s*([^\s,{][^,{}]*|(['"])((?:\\.|(?!\3).)*?)\3)/g;
        let pm;

        while ((pm = pairRe.exec(subSectionContent)))
        {
            const itemKey = pm[1];
            let itemValue = pm[2];

            if (pm[3])
                itemValue = unescapeLuaString(pm[4]);

            if (!map.hasOwnProperty(itemKey))
                map[itemKey] = { name: itemValue, text: [], type: subSectionName };
        }
    }
}

export function parseLoc(txt)
{
    const map = {};
    const keyOpenBraceRe = /(\w+)\s*=\s*{/g;
    const stringRe = /(['"])((?:\\.|(?!\1).)*?)\1/g;

    let currentPos = 0;

    while (true)
    {
        keyOpenBraceRe.lastIndex = currentPos;
        const topLevelMatch = keyOpenBraceRe.exec(txt);

        if (!topLevelMatch)
            break;

        const sectionName = topLevelMatch[1];
        const blockStartIdx = topLevelMatch.index + topLevelMatch[0].length - 1;
        const blockResult = extractBlockContent(txt, blockStartIdx);

        if (!blockResult)
        {
            console.warn(`parseLoc: Mismatched braces for section ${sectionName}`);
            currentPos = topLevelMatch.index + topLevelMatch[0].length;
            continue;
        }

        const sectionBody = blockResult.content;
        currentPos = blockResult.endIndex + 1;

        if (sectionName === "descriptions")
            parseDescriptionsSection(sectionBody, map);
        else if (sectionName === "misc")
            parseMiscSection(sectionBody, map);
    }

    return map;
}