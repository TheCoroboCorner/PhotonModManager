import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const config = {
    port: process.env.PORT || 10000,
    paths: {
        data: path.join(__dirname, 'data.json'),
        votes: path.join(__dirname, 'votes.json'),
        wikiData: path.join(__dirname, 'wiki-data'),
        public: path.join(__dirname, 'public')
    },
    github: {
        headers: process.env.GITHUB_FETCH_TOKEN ? {
            'Authorization': `Bearer ${process.env.GITHUB_FETCH_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'photonmodmanager'
        } : {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'photonmodmanager'
        }
    },
    concurrency: {
        wikiDataFetch: 8
    }
};