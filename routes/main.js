import express from 'express';
import path from 'path';
import { config } from '../config.js';
import { readData, writeData, readVotes, writeVotes } from '../dataService.js';
import { backupDataJson, backupVotesJson } from '../github-backup.js';

const router = express.Router();

router.post('/analytics/view/:key', async (req, res) => {
    try
    {
        const { key } = req.params;
        const data = await readData();

        if (!data[key])
            return res.status(404).json({ error: 'Mod not found' });

        if (!data[key].analytics)
            data[key].analytics = { views: 0, lastViewed: null };

        data[key].analytics.views++;
        data[key].analytics.lastViewed = new Date().toISOString();

        await writeData(data);

        backupDataJson().catch(console.error);

        res.json({ success: true, views: data[key].analytics.views });
    }
    catch (err)
    {
        console.error('Analytics error:', err);
        res.status(500).json({ error: 'Failed to track view' });
    }
});

router.get('/', (req, res) => {
    res.send(`
        <h1>Photon Mod Manager</h1>
        <ul>
            <li><a href="/submit">Submit a repo JSON</a></li>
            <li><a href="/browse">Browse data.json</a></li>
        </ul>
    `);
});

router.get('/submit', (req, res) => {
    res.sendFile(path.join(config.paths.public, 'submit.html'));
})

router.get('/browse', (req, res) => {
    res.sendFile(path.join(config.paths.public, 'browse.html'));
});

router.get('/modpack', (req, res) => {
    res.sendFile(path.join(config.paths.public, 'modpack.html'));
});

router.get('/about', (req, res) => {
    res.sendFile(path.join(config.paths.public, 'about.html'));
});

router.get('/wiki', (req, res) => {
    res.sendFile(path.join(config.paths.public, 'wiki.html'));
});

router.get('/trending', (req, res) => {
    res.sendFile(path.join(config.paths.public, 'trending.html'));
});

router.get('/stats', (req, res) => {
    res.sendFile(path.join(config.paths.public, 'stats.html'));
});

router.get('/data', (req, res) => {
    res.sendFile(config.paths.data);
});

export default router;