import express from 'express';
import { readData, writeData } from '../dataService.js';
import { backupDataJson } from '../github-backup.js';

const router = express.Router();

router.post('/modpack/upload', async (req, res) => {
    try
    {
        const { name, author, description, tags, mods } = req.body;

        if (!name || !mods || mods.length === 0)
            return res.status(400).json({ error: 'Name and mods are required' });

        const baseKey = `${name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_modpack`;
        let key = baseKey;
        let counter = 1;

        const data = await readData();

        while (key in data)
        {
            key = `${baseKey}_${counter}`;
            counter++;
        }

        const entry = {
            id: key,
            name,
            author: author || 'Unknown',
            description: description || '',
            type: 'Modpack',
            tags: Array.isArray(tags) ? tags : [],
            published_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            favourites: 0,
            mods: mods,
            modCount: mods.length
        };

        data[key] = entry;
        await writeData(data);

        backupDataJson().catch(console.error);

        res.json({ success: true, key });
    }
    catch (err)
    {
        console.error('Modpack upload error:', err);
        res.status(500).json({ error: 'Failed to upload modpack' });
    }
});

export default router;