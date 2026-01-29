import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { config } from '../config.js';
import { readData, writeData } from '../dataService.js';
import { backupDataJson } from '../github-backup.js';

const router = express.Router();

const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const modKey = req.body.modKey;
        const imagesDir = path.join(config.paths.wikiData, modKey, 'images');
        await fs.mkdir(imagesDir, { recursive: true });
        cb(null, imagesDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (extname && mimetype)
            cb(null, true);
        else
            cb(new Error('Only image files are allowed'));
    }
});

router.post('/upload-images', upload.array('images', 10), async (req, res) => {
    try
    {
        const { modKey, thumbnailIndex } = req.body;
        const data = await readData();

        if (!data[modKey])
            return res.status(404).json({ error: 'Mod not found' });

        const imagePaths = req.files.map((file, index) => ({
            path: `/wiki-data/${modKey}/images/${file.filename}`,
            filename: file.filename,
            originalName: file.originalname,
            size: file.size,
            isThumbnail: index === parseInt(thumbnailIndex || '0')
        }));

        data[modKey].images = imagePaths;

        await writeData(data);
        backupDataJson().catch(console.error);

        res.json({ success: true, images: imagePaths });
    }
    catch (err)
    {
        console.error('Image upload error:', err);
        res.status(500).json({ error: err.message });
    }
});

export default router;