import express from 'express';
import { readData, writeData } from '../dataService.js';
import { backupDataJson } from '../github-backup.js';
import { read } from 'node:fs';

const router = express.Router();

router.post('/analytics/download/:key', async (req, res) => {
    try
    {
        const { key } = req.params;
        const data = await readData();

        if (!data[key])
            return res.status(404).json({ error: 'Mod not found' });

        if (!data[key].analytics)
        {
            data[key].analytics = {
                views: 0,
                downloads: 0,
                lastDownloaded: null,
                lastViewed: null
            };
        }

        data[key].analytics.downloads = (data[key].analytics.downloads || 0) + 1;
        data[key].analytics.lastDownloaded = new Date().toISOString();

        await writeData(data);
        backupDataJson().catch(console.error);

        res.json({ success: true, downloads: data[key].analytics.downloads });
    }
    catch (err)
    {
        console.error('Download tracking error:', err);
        res.status(500).json({ error: 'Failed to track download' });
    }
});

router.get('/analytics/trending', async (req, res) => {
    try
    {
        const data = await readData();
        const days = parseInt(req.query.days) || 7;
        const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

        const trending = Object.entries(data).map(([key, mod]) => {
            const recentViews = mod.analytics?.lastViewed > cutoff ? mod.analytics.views : 0;
            const recentDownloads = mod.analytics?.lastDownloaded > cutoff ? mod.analytics.downloads : 0;
            const recentFavourites = mod.updated_at > cutoff ? mod.favourites : 0;
            
            const viewScore = 0.3;
            const downloadScore = 0.5;
            const favouriteScore = 0.2;

            const score = (recentViews * viewScore) + (recentDownloads * downloadScore) + (recentFavourites * favouriteScore);
            
            return { key, name: mod.name, score, views: recentViews, downloads: recentDownloads, favourites: recentFavourites };
        }).filter(item => item.score > 0).sort((a, b) => b.score - a.score).slice(0, 10);

        res.json({ trending, period: `${days} days` });
    }
    catch (err)
    {
        console.error('Trending error:', err);
        res.status(500).json({ error: 'Failed to get trending' });
    }
});

export default router;