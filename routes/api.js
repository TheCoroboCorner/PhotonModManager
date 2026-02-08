import express from 'express';
import { readData, writeData } from '../dataService.js';
import { backupDataJson } from '../githubBackup.js';

const router = express.Router();

router.get('/api', (req, res) => {
    res.json({
        version: '1.0.0',
        endpoints: {
            '/api/mods': 'Get all mods',
            '/api/mods/:key': 'Get specific mod',
            '/api/search?q=...': 'Search mods',
            '/api/tags': 'Get all tags',
            '/api/authors': 'Get all authors',
            '/api/stats': 'Get overall statistics',
            '/api/trending?days=7': 'Get trending mods'
        },
        rateLimit: 'No rate limit currently',
        docs: 'https://photonmodmanager.onrender.com/api.html'
    });
});

router.get('/api/mods', async (req, res) => {
    try
    {
        const data = await readData();
        const type = req.query.type; // e.g. mods / modpacks / all / whatever else I end up implementing

        let filtered = Object.entries(data).map(([key, mod]) => ({ key, ...mod }));

        if (type === 'mods')
            filtered = filtered.filter(m => m.type === 'Mod');
        else if (type === 'modpacks')
            filtered = filtered.filter(m => m.type === 'Modpack');

        res.json({ success: true, count: filtered.length, mods: filtered });
    }
    catch (err)
    {
        console.error('API error:', err);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
})

router.get('/api/mods/:key', async (req, res) => {
    try
    {
        const { key } = req.params;
        const data = await readData();

        if (!data[key])
            return res.status(404).json({ success: false, error: 'Mod not found' });

        res.json({ success: true, mod: { key, ...data[key] }});
    }
    catch (err)
    {
        console.error('API error:', err);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

router.get('/api/search', async (req, res) => {
    try
    {
        const { q } = req.query;

        if (!q)
            return res.status(400).json({ success: false, error: 'Query parameter "q" is required' });
        
        const data = await readData();
        const searchLower = q.toLowerCase();

        const results = Object.entries(data).map(([key, mod]) => ({ key, ...mod })).filter(mod => {
            const nameMatch = (mod.name || '').toLowerCase().includes(searchLower);
            const descMatch = (mod.description || '').toLowerCase().includes(searchLower);
            
            const authors = Array.isArray(mod.author) ? mod.author : [mod.author];
            
            const authorMatch = authors.some(a => String(a).toLowerCase().includes(searchLower));
            
            return nameMatch || descMatch || authorMatch;
        });

        res.json({ success: true, query: q, count: results.length, results });
    }
    catch (err)
    {
        console.error('API error:', err);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

router.get('/api/tags', async (req, res) => {
    try
    {
        const data = await readData();
        const tagCounts = {};

        Object.values(data).forEach(mod => {
            if (Array.isArray(mod.tags))
                mod.tags.forEach(tag => tagCounts[tag] = (tagCounts[tag] || 0) + 1);
        });

        res.json({ success: true, tags: Object.entries(tagCounts).map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count) });
    }
    catch (err)
    {
        console.error('API error:', err);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

router.get('/api/authors', async (req, res) => {
    try
    {
        const data = await readData();
        const authorCounts = {};

        Object.values(data).forEach(mod => {
            const authors = Array.isArray(mod.author) ? mod.author : [mod.author];
            authors.forEach(author => authorCounts[author] = (authorCounts[author] || 0) + 1);
        });

        res.json({ success: true, authors: Object.entries(authorCounts).map(([author, modCount]) => ({ author, modCount })).sort((a, b) => b.modCount - a.modCount) });
    }
    catch (err)
    {
        console.error('API error:', err);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

router.post('/api/favourite/:key', async (req, res) => {
    try
    {
        const { key } = req.params;
        const data = await readData();

        if (!data[key])
            return res.status(404).json({ error: 'Mod not found' });

        data[key].favourites = (data[key].favourites || 0) + 1;

        await writeData(data);
        await backupDataJson().catch(err => console.error('Backup failed:', err));
        
        res.json({ success: true, favourites: data[key].favourites, action: 'favorited' });
    }
    catch (err)
    {
        console.error('Failed to toggle favourite:', err);
        res.status(500).json({ success: false, error: 'Failed to update favourite' });
    }
});

router.get('/api/stats', async (req, res) => {
    try
    {
        const data = await readData();
        const entries = Object.values(data);
        
        const stats = {
            totalMods: entries.filter(m => m.type === 'Mod').length,
            totalModpacks: entries.filter(m => m.type === 'Modpack').length,
            totalFavorites: entries.reduce((sum, m) => sum + (m.favourites || 0), 0),
            totalViews: entries.reduce((sum, m) => sum + (m.analytics?.views || 0), 0),
            totalDownloads: entries.reduce((sum, m) => sum + (m.analytics?.downloads || 0), 0),
            tags: [...new Set(entries.flatMap(m => m.tags || []))].sort()
        };
        
        res.json({ success: true, stats });
    }
    catch (err)
    {
        res.status(500).json({ success: false, error: 'Failed to get stats' });
    }
});

export default router;