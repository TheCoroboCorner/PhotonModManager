export function getUrlParams()
{
    return new URLSearchParams(window.location.search);
}

export function updateUrlParams(params)
{
    const newParams = new URLSearchParams(window.location.search);

    Object.entries(params).forEach(([key, value]) => {
        if (value === null || value === undefined)
            newParams.delete(key);
        else
            newParams.set(key, value);
    });

    return newParams;
}

export function navigateWithParams(path, params)
{
    const searchParams = new URLSearchParams(params);

    window.location.href = `${path}?${searchParams.toString()}`;
}

export function formatDate(isoString)
{
    const dt = new Date(isoString);

    const date = dt.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    const time = dt.toLocaleTimeString(undefined, {
        hour: 'numeric', 
        minute: '2-digit'
    });

    return `${date} at ${time}`;
}

export function formatAuthor(author)
{
    return Array.isArray(author) ? author.join(', ') : String(author);
}

export function parseModKey(key)
{
    const [repo, owner] = key.split('@');
    return { repo, owner };
}

export function buildGitHubUrl(key)
{
    const { repo, owner } = parseModKey(key);
    return `https://github.com/${owner}/${repo}`;
}

export async function fetchJson(url)
{
    const response = await fetch(url);

    if (!response.ok)
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);

    return response.json();
}

export async function postJson(url, data)
{
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });

    const json = await response.json();

    if (!response.ok)
        throw new Error(json.error || `HTTP ${response.status}`);

    return json;
}

export function createElement(tag, attributes = {}, children = [])
{
    const element = document.createElement(tag);

    Object.entries(attributes).forEach(([key, value]) => {
        if (key === 'class')
            element.className = value;
        else if (key === 'style' && typeof value === 'object')
            Object.assign(element.style, value);
        else if (key.startsWith('on') && typeof value === 'function')
            element.addEventListener(key.slice(2).toLowerCase(), value);
        else
            element.setAttribute(key, value);
    });

    children.forEach(child => {
        if (typeof child === 'string')
            element.appendChild(document.createTextNode(child));
        else if (child instanceof Node)
            element.appendChild(child);
    });

    return element;
}