export function compareVersions(a, b)
{
    const re = /\d+|[A-Za-z]+/g;
    const ta = String(a).match(re) || [];
    const tb = String(b).match(re) || [];

    const len = Math.max(ta.length, tb.length);

    for (let i = 0; i < len; i++)
    {
        const xa = ta[i] || '';
        const xb = tb[i] || '';

        const na = /^\d+$/.test(xa) ? +xa : xa;
        const nb = /^\d+$/.test(xb) ? +xb : xb;

        if (na < nb)
            return -1;
        if (na > nb)
            return 1;
    }
    
    return 0;
}

export class VersionRange
{
    constructor(min = null, max = null)
    {
        this.min = min;
        this.max = max;
    }

    static parse(str)
    {
        const m = String(str).trim().match(/^(>=|<=|>|<|=)?\s*(.+)$/);

        if (!m)
        {
            console.warn(`VersionRange.parse: couldn't parse "${str}", defaulting to any`);
            return new VersionRange();
        }

        const op = m[1] || '>=';
        const ver = m[2] || '';

        switch (op)
        {
            case '>=':
                return new VersionRange({ ver, inclusive: true, isLower: true }, null);
            case '>':
                return new VersionRange({ ver, inclusive: false, isLower: true }, null);
            case '<=':
                return new VersionRange(null, { ver, inclusive: true, isLower: false });
            case '<':
                return new VersionRange(null, { ver, inclusive: false, isLower: false});
            case '=':
                return new VersionRange(
                    { ver, inclusive: true, isLower: true },
                    { ver, inclusive: true, isLower: false }
                );
            default:
                return new VersionRange();
        }
    }

    intersect(other)
    {
        let newMin = this.min;
        let newMax = this.max;

        if (other.min)
        {
            const cmp = newMin ? compareVersions(other.min.ver, newMin.ver) : 1;

            if (!newMin || cmp > 0 || (cmp === 0 && !other.max.inclusive))
                newMin = other.min;
        }

        if (other.max)
        {
            const cmp = newMax ? compareVersions(other.max.ver, newMax.ver) : -1;

            if (!newMax || cmp < 0 || (cmp === 0 && !other.max.inclusive))
                newMax = other.max;
        }

        return new VersionRange(newMin, newMax);
    }

    toString()
    {
        if (!this.min && !this.max)
            return 'Any';

        if (this.min && this.max)
        {
            const cmp = compareVersions(this.min.ver, this.max.ver);

            if (cmp > 0 || (cmp === 0 && (!this.min.inclusive && !this.max.inclusive)))
                return `[Version conflict: ${this.max.ver} recommended]`;

            if (cmp === 0 && this.min.inclusive && this.max.inclusive)
                return this.min.ver;
        }

        const left = this.min ? (this.min.inclusive ? '[' : '(') + this.min.ver : '(...';
        const right = this.max ? this.max.ver + (this.max.inclusive ? ']' : ')') : '...)';

        return `${left}, ${right}`;
    }
}

export function collectVersionRanges(fieldName, startKey, modsData)
{
    const seen = new Set();
    const rangeMap = new Map();

    function recurse(key)
    {
        if (seen.has(key))
            return;

        seen.add(key);
        const entry = modsData[key];

        if (!entry || !Array.isArray(entry[fieldName]))
            return;

        for (const raw of entry[fieldName])
        {
            const rawStr = typeof raw === 'string' ? raw : `${raw.key} (${raw.version})`;

            const versionPart = rawStr.match(/\((.*)\)$/)?.[1] || '';
            const newRange = VersionRange.parse(versionPart);

            if (rangeMap.has(rawStr))
            {
                const merged = rangeMap.get(rawStr).intersect(newRange);
                rangeMap.set(rawStr, merged);
            }
            else rangeMap.set(rawStr, newRange);

            const modName = rawStr.split(/\s*\(/)[0];
            const foundKey = Object.keys(modsData).find(k => modsData[k].id === modName);

            if (foundKey)
                recurse(foundKey);
        }
    }

    recurse(startKey);
    return rangeMap;
}