export class ModpackParser
{
    static toBase64(str)
    {
        return btoa(unescape(encodeURIComponent(str)));
    }

    static fromBase64(str)
    {
        return decodeURIComponent(escape(atob(str)));
    }
    
    static parse(text)
    {
        const lines = text.split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('#'));

        return lines.map(line => {
            const parts = line.split(/\s+/);
            
            try
            {
                const key = this.fromBase64(parts[0]);
                const version = parts[1] ? this.fromBase64(parts[1]) : 'latest';

                return { key, version };
            }
            catch (err)
            {
                console.error('Failed to parse line:', line, err);
                return null;
            }
        }).filter(Boolean);
    }

    static stringify(mods)
    {
        return mods.map(mod => {
            const encodedKey = this.toBase64(mod.key);
            const encodedVersion = this.toBase64(mod.version);

            return `${encodedKey} ${encodedVersion}`;
        }).join('\n');
    }

    static createModpackFile(metadata, mods)
    {
        const lines = [
            `# ${metadata.name}`,
            `# Author: ${metadata.author || 'Unknown'}`,
            `# Description: ${metadata.description || 'No description'}`,
            `# Tags: ${(metadata.tags || []).join(', ')}`,
            `# Created: ${new Date().toISOString()}`,
            `#`,
            `# Format: Each line is "base64(modKey) base64(version)"`,
            `# This ensures special characters and spaces are handled correctly`,
            '',
            ...mods.map(mod => {
                const encodedKey = this.toBase64(mod.key);
                const encodedVersion = this.toBase64(mod.version);
                return `${encodedKey} ${encodedVersion}`;
            })
        ];

        return lines.join('\n');
    }

    static parseModpackFile(text)
    {
        const lines = text.split('\n');
        const metadata = {
            name: '',
            author: '',
            description: '',
            tags: [],
            created: ''
        };
        const mods = [];

        for (const line of lines)
        {
            const trimmed = line.trim();

            if (trimmed.startsWith('#'))
            {
                const content = trimmed.substring(2);

                if (!metadata.name && !content.includes(':') && !content.startsWith('Format:'))
                    metadata.name = content;
                else if (content.startsWith('Author: '))
                    metadata.author = content.substring(8);
                else if (content.startsWith('Description: '))
                    metadata.description = content.substring(13);
                else if (content.startsWith('Tags: '))
                    metadata.tags = content.substring(6).split(',').map(t => t.trim()).filter(Boolean);
                else if (content.startsWith('Created: '))
                    metadata.created = content.substring(9);
            }
            else if (trimmed)
            {
                const parts = trimmed.split(/\s+/);

                try
                {
                    const key = this.fromBase64(parts[0]);
                    const version = parts[1] ? this.fromBase64(parts[1]) : 'latest';

                    mods.push({ key, version });
                }
                catch (err)
                {
                    console.error('Failed to parse modpack line:', trimmed, err);
                }
            }
        }

        return { metadata, mods };
    }

    static validate(text)
    {
        try
        {
            const { metadata, mods } = this.parseModpackFile(text);

            if (!metadata.name)
                return { valid: false, error: 'Missing modpack name' };

            if (mods.length === 0)
                return { valid: false, error: 'No mods found in modpack' };

            return { valid: true, metadata, mods };
        }
        catch (err)
        {
            return { valid: false, error: err.message };
        }
    }

    static getPreview(text, allMods = {})
    {
        const { metadata, mods } = this.parseModpackFile(text);

        const modList = mods.map(mod => {
            const modData = allMods[mod.key];
            const name = modData?.name || mod.key;

            return`  • ${name} (${mod.version})`;
        }).join('\n');

        return `
            ${metadata.name}
            by ${metadata.author}

            ${metadata.description}

            Mods (${mods.length}):
            ${modList}

            Tags: ${metadata.tags.join(', ') || 'None'}
        `.trim();
    }
}