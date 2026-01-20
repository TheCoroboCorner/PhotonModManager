const CONSTANTS = {
    G: {
        GAME: {
            probabilities: { normal: 1 },
            health: 100
        }
    }
}; // Obviously incomplete while I figure out how I'm supposed to do SMODS stuff

const SMODS_STUB = {
    get_probability_vars(card, numerator, denominator, identifier)
    {
        return [numerator, denominator];
    }
};

function splitTopLevel(expr, op)
{
    let depth = 0;
    for (let i = 0; i <= expr.length - op.length; i++)
    {
        const ch = expr[i];
        if (ch === '(')
            depth++;
        else if (ch === ')')
            depth--;
        else if (depth === 0 && expr.slice(i, i + op.length) === op)
            return [expr.slice(0, i).trim(), expr.slice(i + op.length).trim()];
    }

    return null;
}

function evalExpr(expr, card)
{
    expr = String(expr).trim();
    if (!expr)
        return undefined;

    // Remove outer parentheses
    const parentheses = expr.match(/^\(\s*([\s\S]+?)\s*\)$/);
    if (parentheses)
        expr = parentheses[1];

    // Convert the bracket notation to dot notation
    expr = expr.replace(/\[\s*(['"]?)([^\]'"]+)\1\s*\]/g, '.$2');

    // Handle the 'or' operator
    let parts = splitTopLevel(expr, ' or ');
    if (parts)
    {
        const [left, right] = parts;
        const L = evalExpr(left, card);
        const R = evalExpr(right, card);

        return (L !== undefined && L !== null && L !== false) ? L : R;
    }

    // Handle the 'and' operator
    parts = splitTopLevel(expr, ' and ');
    if (parts)
    {
        const [cond, rest] = parts;
        const thenFalse = splitTopLevel(rest, ' or ');
        if (thenFalse)
        {
            const [Y, N] = thenFalse;
            
            return evalExpr(cond, card) ? evalExpr(Y, card) : evalExpr(N, card);
        }

        return evalExpr(rest, card);
    }

    for (const op of ['*', '/', '+', '-'])
    {
        parts = splitTopLevel(expr, op);
        if (parts)
        {
            const [A, B] = parts;
            const a = evalExpr(A, card);
            const b = evalExpr(B, card);

            if (typeof a === 'number' && typeof b === 'number')
            {
                switch (op)
                {
                    case '+':
                        return a + b;
                    case '-':
                        return a - b;
                    case '*':
                        return a * b;
                    case '/':
                        return a / b;
                }
            }

            return undefined;
        }
    }

    if (!isNaN(expr))
        return Number(expr);

    const pathParts = expr.split('.');
    const tail = pathParts.slice(1);

    const pathSearch = (domain) => tail.reduce((o, p) => o?.[p], domain);

    switch (pathParts[0])
    {
        case 'stg': // Maximus compatibility while I work through how I'm supposed to do local variables
            if (tail.length === 0)
                return card.ability?.extra && typeof card.ability.extra === 'object' ? pathSearch(card.ability.extra) : pathSearch(card.ability);

            return card.ability?.extra && typeof card.ability.extra === 'object' && tail[0] in card.ability.extra ? pathSearch(card.ability.extra) : pathSearch(card.ability);
        case 'card':
            return pathSearch(card);
        case 'G':
            return pathSearch(CONSTANTS.G);
        default:
            return undefined;
    }
}

function splitTopLevelArgs(callExpr)
{
    const open = callExpr.indexOf('(');
    if (open < 0)
        return null;

    let depth = 1;
    let i = open + 1;

    for (; i < callExpr.length; i++)
    {
        if (callExpr[i] === '(')
            depth++;
        else if (callExpr[i] === ')')
        {
            depth--;
            if (depth === 0)
                break;
        }
    }

    if (depth !== 0)
        return null;

    const body = callExpr.slice(open + 1, i);
    return body.split(/\s*,\s*/);
}

export function parseLocVars(card, locMap)
{
    card.vars = [];
    card.infoQueue = [];

    const retMatch = card.raw.match(/return\s*\{[\s\S]*?vars\s*=\s*\{([^}]*)\}/);
    if (!retMatch)
    {
        console.log(`[loc_vars] (no loc_vars) for ${card.key}`);
        return;
    }

    const inside = retMatch[1];
    const parts = inside.split(/\s*,\s*/).map(s => s.trim()).filter(s => !!s);

    for (const rawExpr of parts)
    {
        // Handle localize() calls
        const locMatch = rawExpr.match(/^localize\s*\(\s*['"]([^'"]+)['"](?:\s*,[\s\S]*)?\)$/);
        if (locMatch)
        {
            const key = locMatch[1];
            const localized = locMap[key]?.name || locMap[key]?.text?.[0] || key;

            card.vars.push(localized);

            continue;
        }

        // Handle SMODS.get_probability_vars
        if (rawExpr.startsWith('SMODS.get_probability_vars'))
        {
            const args = splitTopLevelArgs(rawExpr);
            if (args && args.length > 3)
            {
                const num = args[1];
                const den = args[2];

                const n = evalExpr(num, card) ?? 0;
                const d = evalExpr(den, card) ?? 1;

                console.log(`[loc_vars] ${card.key}: ${num} -> ${n}, ${den} -> ${d}`);

                card.vars.push(n, d);
            }
            else console.warn('[loc_vars] Bad get_probability_vars call, skipping:', rawExpr);
        }
        else card.vars.push(evalExpr(rawExpr, card));
    }

    console.log(`[loc_vars] -> parsed card.vars for ${card.key}:`, card.vars);
}