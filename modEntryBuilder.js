export function buildEntry(target)
{
    const entry = {
        id: target.id,
        name: target.name,
        author: target.author,
        description: target.description,
        favourites: 0
    };

    if (!target.allow_redistribution)
        throw new Error('allow_redistribution variable in target JSON file is either missing or false! Cannot redistribute without permission!');

    entry.allow_redistribution = target.allow_redistribution;

    const optionalFields = [
        'id',
        'name',
        'author',
        'description',
        'badge_colour', 
        'dependencies',
        'conflicts',
        'provides',
        'git_owner', 
        'git_repo',
        'mod_index_id',
        'mod_path',
        'subpath', 
        'download_suffix',
        'update_mandatory',
        'target_version'
    ];

    for (const key of optionalFields)
    {
        if (key in target)
            entry[key] = target[key];
    }

    return entry;
}

export function parseGitHubUrlComponents(repoUrl, jsonPath)
{
    let user, repo, branch, filePath;
    const url = new URL(repoUrl);

    if (url.hostname === 'raw.githubusercontent.com') // Direct raw URL
    {
        [, user, repo, , branch, ...rest] = url.pathname.split('/');
        filePath = rest.join('/');
    }
    else if (url.hostname === 'github.com' && url.pathname.includes('/blob/')) // Standard GitHub blob URL
    {
        [, user, repo, , branch, ...rest] = url.pathname.split('/');
        filePath = rest.join('/');
    }
    else if (url.hostname === 'github.com' && jsonPath) // GitHub repo URL with separate jsonPath
    {
        [, user, repo] = url.pathname.split('/');
        filePath = jsonPath;
    }
    else // Fallback
    {
        const parts = url.pathname.split('/').filter(Boolean);
        user = parts[0];
        repo = parts[1];
        filePath = jsonPath;
    }

    return { user, repo, branch, filePath };
}