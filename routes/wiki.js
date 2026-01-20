import express from 'express';
import { getWikiData } from '../wikiService.js';

const router = express.Router();

router.get('/wiki-data/:modKey.json', async (req, res) => {
    const { modKey } = req.params;

    try
    {
        const wikiData = await getWikiData(modKey);
        res.json(wikiData);
    }
    catch (err)
    {
        console.error(`[Server] Fatal error processing wiki data for ${modKey}:`, err);
        res.status(500).json({ error: 'Internal server error while processing mod data. '});
    }
});

export default router;