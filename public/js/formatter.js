const COLOURS = {
    mult: '#FE5F55',
    chips: '#009DFF',
    money: '#F3B958',
    xmult: '#FE5F55',
    attention: '#FF9A00',
    blue: '#009DFF',
    red: '#FE5F55',
    green: '#4BC292',
    pale_green: '#56A887',
    orange: '#FDA200',
    important: '#FF9A00',
    gold: '#EAC058',
    yellow: '#FFFF00',
    clear: '#00000002',
    white: '#FFFFFF',
    purple: '#8867A5',
    black: '#374244',
    l_black: '#4F6367',
    grey: '#5F7377',
    coral: '#F4795C',
    bold_red: '#FF0000',
    bold_cyan: '#00FFFF',
    sblue: '#2E76FD',
    cryepic: '#EF0098',
    cryexotic: '#4795A6',
    crycandy: '#E275E6',
    crycursed: '#474931',
    pokesafari: '#F2C74E',
    pokemega: '#E8578E',
    jenwondrous: '#FF0000',
    bufspecial: '#EE8F8D',
    glop: '#11FF11',
    svrdtemper: '#D4E04C',
    svrdprotocol: '#303030',
    entrlegendary: '#FF0081',
    entrentropic: '#83B380',
    entrzenith: '#4CD72A',
    bldstnpower: '#DF00FF',
    myhm_mythic: '#FF9A00',
    myhm_mystery: '#374244',
    myhm_hyperascendant: '#FBFF00',
    myhm_interdimensional: '#34EB9B',
    myhm_surreal: '#D1C436',
    myhm_ethereal: '#6F00FF',
    chance: '#4BC292',
    joker_grey: '#BFC7D5',
    voucher: '#CB724C',
    booster: '#646EB7',
    edition: 'linear-gradient(90deg,#FF9A00FF,#FFFFFF)',
    dark_edition: '#000000',
    eternal: '#C75985',
    perishable: '#4F5DA1',
    rental: '#B18F43',
    main: '#374244',
    dark: '#374244',
    boss_main: '#374244',
    boss_dark: '#374244',
    boss_pale: '#374244',
    hearts: '#F03464',
    diamonds: '#F06B3F',
    spades: '#403995',
    clubs: '#235955',
    text_light: '#FFFFFF',
    text_dark: '#4F6367',
    inactive: '#88888899',
    background_light: '#B8D8D8',
    background_white: '#FFFFFF',
    background_dark: '#7A9E9F',
    background_inactive: '#666666FF',
    outline_light: '#D8D8D8',
    outline_light_trans: '#D8D8D866',
    outline_dark: '#7A9E9F',
    transparent_light: '#EEEEEE22',
    transparent_dark: '#22222222',
    hover: '#00000055',
    default: '#9BB6BDFF',
    enhanced: '#8389DDFF',
    joker: '#708B91',
    tarot: '#A782D1',
    planet: '#13AFCE',
    spectral: '#4584FA',
    small: '#50846E',
    big: '#50846E',
    boss: '#B44430',
    won: '#4F6367'
};

function escapeHtml(text)
{
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function parseFormatCode(code)
{
    const styles = [];
    const attrs = [];

    code.split(',').forEach(part => {
        const [k, v] = part.split(':');

        switch(k)
        {
            case 'C': // Colour
                if (COLOURS[v])
                    styles.push(`color:${COLOURS[v]}`);
                break;
            case 'X': // Background colour
                if (COLOURS[v])
                    styles.push(`background-color:${COLOURS[v]}`);
                break;
            case 'E': // Text motion
                if (v === '1')
                    attrs.push('class="motion-popin"');
                else if (v === '2')
                    attrs.push('class="motion-bump"');
                break;
            case 'T': // Hovering tooltip
                attrs.push(`data-tooltip="${escapeHtml(v)}"`);
                break;
            case 's': // Text scale
                const scale = parseFloat(v) * 100;
                if (!isNaN(scale))
                    styles.push(`font-size:${scale}%`);
                break;
            
            case 'V': // Variable/custom text colour
            case 'B': // Variable/custom background colour
                break; // Not implemented
        }
    });

    return { styles, attrs };
}

export function formatMarkup(str)
{
    let out = '';
    const stack = [];
    let i = 0;

    const closeSpan = () => {
        while (stack.length)
        {
            stack.pop();
            out += '</span>';
        }
    };

    while (i < str.length)
    {
        if (str[i] === '{')
        {
            const end = str.indexOf('}', i);
            if (end < 0)
                break;

            const code = str.slice(i + 1, end);
            i = end + 1;

            closeSpan();

            if (code === '')
                continue;

            const { styles, attrs } = parseFormatCode(code);

            if (styles.length || attrs.length)
            {
                stack.push(code);

                out += `<span style="${styles.join(';')}" ${attrs.join(' ')}>`;
            }
        }
        else
        {
            const next = str.indexOf('{', i);
            const chunk = str.slice(i, next < 0 ? str.length : next);

            out += escapeHtml(chunk);
            i += chunk.length;
        }
    }

    closeSpan();
    return out;
}

export function replaceVariables(text, vars)
{
    return text.replace(/#(\d+)#/g, (_, num) => {
        const index = parseInt(num, 10) - 1;
        return vars[index] != null? vars[index] : '';
    });
}