import fs from 'fs/promises';
import { config } from './config.js';

class DataQueue
{
    constructor()
    {
        this.queue = [];
        this.processing = false;
    }

    async add(operation)
    {
        return new Promise((resolve, reject) => {
            this.queue.push({ operation, resolve, reject });
            this.process();
        });
    }

    async process()
    {
        if (this.processing || this.queue.length === 0)
            return;

        this.processing = true;
        const { operation, resolve, reject } = this.queue.shift();

        try
        {
            const result = await operation();
            resolve(result);
        }
        catch (err)
        {
            reject(err);
        }
        finally
        {
            this.processing = false;
            this.process();
        }
    }
}

const dataQueue = new DataQueue();

let cachedData = null;
let lastReadTime = 0;
const CACHE_TTL = 5000;

export async function readData()
{
    return dataQueue.add(async () => {
        const now = Date.now();
        if (cachedData && (now - lastReadTime) < CACHE_TTL)
            return cachedData;

        try
        {
            const raw = await fs.readFile(config.paths.data, 'utf8');
            const data = JSON.parse(raw);

            cachedData = data;
            lastReadTime = now;

            return data;
        }
        catch (err)
        {
            if (err.code === 'ENOENT')
            {
                console.warn('[DataService] data.json not found, creating empty file');
                
                const emptyData = {};
                await fs.writeFile(config.paths.data, JSON.stringify(emptyData, null, 2));

                cachedData = emptyData;
                lastReadTime = now;

                return emptyData;
            }

            console.error('[DataService] Failed to read data.json:', err.message);
            throw err;
        }
    });
}

export async function writeData(data)
{
    return dataQueue.add(async () => {
        try
        {
            const jsonString = JSON.stringify(data, null, 2);
            JSON.parse(jsonString);

            await fs.writeFile(config.paths.data, jsonString, 'utf8');

            cachedData = data;
            lastReadTime = Date.now();

            console.log('[DataService] Successfully wrote data.json');
        }
        catch (err)
        {
            console.error('[DataService] Failed to write data.json:', err.message);
            throw err;
        }
    });
}

export function clearCache() 
{
    cachedData = null;
    lastReadTime = 0;
}

export async function readVotes()
{
    try
    {
        const txt = await fs.readFile(config.paths.votes, 'utf8');
        return JSON.parse(txt);
    }
    catch (err)
    {
        if (err.code === 'ENOENT')
        {
            console.warn('[DataService] votes.json not found, creating empty file');
            await writeVotes({});
            return {};
        }

        throw err;
    }
}

export async function writeVotes(votes)
{
    await fs.writeFile(config.paths.votes, JSON.stringify(votes, null, 2));
}