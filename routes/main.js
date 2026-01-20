import express from 'express';
import path from 'path';
import { config } from '../config.js';

const router = express.Router();

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

router.get('/about', (req, res) => {
    res.sendFile(path.join(config.paths.public, 'about.html'));
});

router.get('/wiki', (req, res) => {
    res.sendFile(path.join(config.paths.public, 'wiki.html'));
});

router.get('/data', (req, res) => {
    res.sendFile(config.paths.data);
});

export default router;