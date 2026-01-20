import { generateVoteId } from './utils.js';

export function cookieMiddleware(req, res, next)
{
    const raw = req.headers.cookie || '';
    const cookies = Object.fromEntries(raw.split(';').map(s => s.trim().split('=').map(decodeURIComponent)));

    let vid = cookies.voteId;
    if (!vid)
    {
        vid = generateVoteId();
        res.setHeader('Set-Cookie', `voteId=${vid}; Path=/; HttpOnly; SameSite=Lax`);
    }

    req.voteId = vid;
    next();
}

export function securityHeadersMiddleware(req, res, next)
{
    res.setHeader('Content-Security-Policy', "default-src 'self'; " +
                                            "connect-src 'self' https://api.github.com https://raw.githubusercontent.com; " + 
                                            "script-src 'self' 'unsafe-inline'; " + 
                                            "style-src 'self' 'unsafe-inline'; " +
                                            "img-src 'self' https://raw.githubusercontent.com");

    next();
}