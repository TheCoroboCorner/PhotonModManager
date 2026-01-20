import express from 'express';
import { readData, writeData, readVotes, writeVotes } from '../dataService.js';
import { backupDataJson, backupVotesJson } from '../github-backup.js';

const router = express.Router();

router.post('/favourite/:key', async (req, res) => {
    const { key } = req.params;
    const userId = req.voteId;

    const votes = await readVotes();
    votes[key] = votes[key] || [];

    if (votes[key].includes(userId))
        return res.status(200).json({ success: false, message: 'Already favourited' });

    const data = await readData();
    if (!data[key])
        return res.status(404).json({ error: 'Mod not found' });

    votes[key].push(userId);
    await writeVotes(votes);
    backupVotesJson().catch(console.error);

    data[key].favourites = votes[key].length;
    await writeData(data);
    backupDataJson().catch(console.error);

    res.json({ success: true, newCount: data[key].favourites });
});

export default router;