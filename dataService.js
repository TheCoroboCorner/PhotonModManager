import fs from 'fs/promises';
import { config } from './config.js';

export async function readData()
{
    try
    {
        const txt = await fs.readFile(config.paths.data, 'utf8');

        try
        {
            return JSON.parse(txt);
        }
        catch (err)
        {
            console.error('JSON parse error:', err.message);

            if (typeof err.position === 'number')
            {
                const pos = err.position;
                console.error('...context:', txt.slice(Math.max(0, pos-20), pos+20).replace(/\n/g, '\\n'));
            }

            throw err;
        }
    }
    catch
    {
        return {};
    }
}

export async function writeData(data)
{
    await fs.writeFile(config.paths.data, JSON.stringify(data, null, 2));
}

export async function readVotes()
{
    try
    {
        const txt = await fs.readFile(config.paths.votes, 'utf8');
        return JSON.parse(txt);
    }
    catch
    {
        return {};
    }
}

export async function writeVotes()
{
    await fs.writeFile(config.paths.votes, JSON.stringify(votes, null, 2));
}