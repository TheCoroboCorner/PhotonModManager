import crypto from 'crypto';

export function parseGitHubUrl(repoUrl)
{
    const regex = /^https?:\/\/(?:www\.)?github\.com\/([^\/]+)\/([^\/]+)(?:\/.+)?$/;
    const match = repoUrl.match(regex);
    if (!match)
        throw new Error('Invalid GitHub URL format');

    return { user: match[1], repo: match[2] };
}

export async function pLimit(concurrency, iterable, mapper)
{
    const executing = [];
    const results = [];

    for (const item of iterable)
    {
        const p = Promise.resolve().then(() => mapper(item));
        results.push(p);

        const e = p.then(() => executing.splice(executing.indexOf(e), 1));
        executing.push(e);

        if (executing.length >= concurrency)
            await Promise.race(executing);
    }

    return Promise.all(results);
}

export function generateVoteId()
{
    return crypto.randomBytes(16).toString('hex');
}

export function sortEntries(entries, field, order = 'desc')
{
    const arr = Object.entries(entries).map(([key, entry]) => ({ key, ...entry }));

    arr.sort((a, b) => {
        let av = a[field];
        let bv = b[field];

        if (field === 'published_at')
        {
            av = Date.parse(av);
            bv = Date.parse(bv);
        }

        if (av < bv)
            return order === 'asc' ? -1 : 1;
        if (av > bv)
            return order === 'asc' ? 1 : -1;
        return 0;
    });

    return arr;
}

export function unescapeLuaString(str)
{
    return str.replace(/\\(["'\\bfnrt])/g, (_, ch) => {
        const escapeMap = { n: '\n', r: '\r', t: '\t', '"': '"', "'": "'", '\\': '\\' };
        return escapeMap[ch] || ch;
    });
}

export function extractBlockContent(str, startIndex)
{
    let braceCount = 0;
    let contentStart = -1;

    for (let i = startIndex; i < str.length; i++)
    {
        if (str[i] === '{')
        {
            if (contentStart === -1)
                contentStart = i + 1;
            braceCount++;
        }
        else if (str[i] === '}')
        {
            braceCount--;
            if (braceCount === 0)
            {
                return { content: str.substring(contentStart, i), endIndex: i };
            }
        }
    }

    return null;
}