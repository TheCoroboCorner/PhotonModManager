import { VersionRange, compareVersions } from './version.js';

export class DependencyResolver 
{
    constructor(allMods) 
    {
        this.allMods = allMods;
    }

    resolve(selectedMods) 
    {
        const resolved = new Map();
        const conflicts = [];
        const queue = [...selectedMods];
        const processed = new Set();

        selectedMods.forEach(mod => resolved.set(mod.key, { version: mod.version, requiredBy: new Set(['USER_SELECTED']) }));

        while (queue.length > 0) 
        {
            const current = queue.shift();
            
            if (processed.has(current.key)) 
                continue;
            processed.add(current.key);

            const mod = this.allMods[current.key];
            if (!mod) 
            {
                console.warn(`Mod not found: ${current.key}`);
                continue;
            }

            const dependencies = mod.dependencies || [];

            for (const dep of dependencies) 
            {
                const depKey = typeof dep === 'string' ? dep.split(/\s*\(/)[0] : dep.key;
                const depVersionRange = typeof dep === 'string' ? this.extractVersionRange(dep) : (dep.version || '>=0.0.0');

                const depModKey = this.findModKey(depKey);

                if (!depModKey) 
                {
                    conflicts.push({
                        type: 'missing',
                        mod: current.key,
                        modName: mod.name,
                        dependency: depKey,
                        requiredVersion: depVersionRange
                    });
                    continue;
                }

                const depMod = this.allMods[depModKey];

                if (resolved.has(depModKey)) 
                {
                    const existing = resolved.get(depModKey);
                    
                    existing.requiredBy.add(current.key);

                    const compatible = this.findCompatibleVersion(existing.version, depVersionRange, depMod);

                    if (compatible.isCompatible) 
                    {
                        if (compatible.suggestedVersion && compatible.suggestedVersion !== existing.version) 
                        {
                            console.log(`Updating ${depModKey} from ${existing.version} to ${compatible.suggestedVersion} for compatibility`);
                            existing.version = compatible.suggestedVersion;
                        }
                    } 
                    else 
                    {
                        conflicts.push({
                            type: 'version_conflict',
                            mod: current.key,
                            modName: mod.name,
                            dependency: depModKey,
                            dependencyName: depMod.name,
                            existing: existing.version,
                            required: depVersionRange,
                            requiredBy: Array.from(existing.requiredBy)
                        });
                    }
                } 
                else 
                {
                    const bestVersion = this.selectBestVersion(depMod, depVersionRange);

                    resolved.set(depModKey, { version: bestVersion, requiredBy: new Set([current.key]) });

                    queue.push({ key: depModKey, version: bestVersion });
                }
            }
        }

        return {
            resolved: Array.from(resolved.entries()).map(([key, data]) => ({
                key,
                version: data.version,
                requiredBy: Array.from(data.requiredBy)
            })),
            conflicts
        };
    }

    findModKey(depKey) 
    {
        if (this.allMods[depKey]) 
            return depKey;

        return Object.keys(this.allMods).find(k => this.allMods[k].id === depKey || this.allMods[k].name === depKey);
    }

    extractVersionRange(depString) 
    {
        const match = depString.match(/\((.*)\)$/);
        return match ? match[1] : '>=0.0.0';
    }

    selectBestVersion(mod, versionRange) 
    {
        if (mod.version && mod.version !== 'latest') 
        {
            if (this.versionSatisfiesRange(mod.version, versionRange))
                return mod.version;
        }

        const range = this.parseVersionRange(versionRange);
        
        if (range.exact)
            return range.exact;
        else if (range.min)
            return range.min;

        return mod.version || 'latest';
    }

    versionSatisfiesRange(version, rangeString) {
        if (version === 'latest') 
            return true;
        if (rangeString === 'latest' || rangeString === '>=0.0.0') 
            return true;

        try 
        {
            const range = VersionRange.parse(rangeString);
            const versionNum = this.normalizeVersion(version);

            if (range.min) 
                {
                const minVersion = this.normalizeVersion(range.min.ver);
                const cmp = compareVersions(versionNum, minVersion);
                
                if (range.min.inclusive) 
                {
                    if (cmp < 0) 
                        return false;
                } 
                else 
                {
                    if (cmp <= 0) 
                        return false;
                }
            }

            if (range.max) 
            {
                const maxVersion = this.normalizeVersion(range.max.ver);
                const cmp = compareVersions(versionNum, maxVersion);
                
                if (range.max.inclusive) 
                {
                    if (cmp > 0) 
                        return false;
                } 
                else 
                {
                    if (cmp >= 0) 
                        return false;
                }
            }

            return true;
        } 
        catch (e) 
        {
            console.warn('Version comparison failed:', e);
            return true;
        }
    }

    parseVersionRange(rangeString) 
    {
        const result = { min: null, max: null, exact: null };

        if (rangeString.startsWith('=')) 
        {
            result.exact = rangeString.substring(1).trim();
            return result;
        }

        if (rangeString.startsWith('>='))
            result.min = rangeString.substring(2).trim();
        else if (rangeString.startsWith('>'))
            result.min = rangeString.substring(1).trim();

        if (rangeString.startsWith('<='))
            result.max = rangeString.substring(2).trim();
        else if (rangeString.startsWith('<'))
            result.max = rangeString.substring(1).trim();

        if (!result.min && !result.max && !result.exact)
            result.min = rangeString.trim();

        return result;
    }

    findCompatibleVersion(existingVersion, requiredRange, mod) {
        if (existingVersion === 'latest') 
        {
            const bestVersion = this.selectBestVersion(mod, requiredRange);
            return {
                isCompatible: true,
                suggestedVersion: bestVersion !== 'latest' ? bestVersion : existingVersion
            };
        }

        if (this.versionSatisfiesRange(existingVersion, requiredRange))
            return { isCompatible: true, suggestedVersion: null };

        const bestVersion = this.selectBestVersion(mod, requiredRange);
        
        if (bestVersion === existingVersion)
            return { isCompatible: true, suggestedVersion: null };

        if (this.versionSatisfiesRange(bestVersion, `>=${existingVersion}`))
            return { isCompatible: true, suggestedVersion: bestVersion };

        return { isCompatible: false, suggestedVersion: null };
    }

    normalizeVersion(version) {
        if (version === 'latest') 
            return version;
        
        let normalized = version.replace(/^v/i, '');
        
        normalized = normalized.split(/[-\s]/)[0];
        
        return normalized;
    }

    getDependencyTree(modKey, depth = 0, visited = new Set()) 
    {
        if (visited.has(modKey))
            return { key: modKey, circular: true, depth };

        visited.add(modKey);
        const mod = this.allMods[modKey];
        
        if (!mod)
            return { key: modKey, missing: true, depth };

        const dependencies = mod.dependencies || [];
        const children = [];

        for (const dep of dependencies) 
        {
            const depKey = typeof dep === 'string' ? dep.split(/\s*\(/)[0] : dep.key;
            const depModKey = this.findModKey(depKey);
            
            if (depModKey)
                children.push(this.getDependencyTree(depModKey, depth + 1, new Set(visited)));
        }

        return {
            key: modKey,
            name: mod.name,
            version: mod.version,
            depth,
            children
        };
    }
}