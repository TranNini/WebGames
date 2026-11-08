// The pictures on the tiles, drawn once as SVG symbols (30 x 40) that every tile uses. Our own drawings of the usual
// mahjong faces: dots, bamboo and characters from 1 to 9, the four winds, three dragons, four flowers and four seasons.
// Characters and winds carry a small number or letter in the corner, for those who don't read the Chinese signs.
const Faces = (() => {
    const BLUE = '#2b62b0';
    const GREEN = '#1f8a4c';
    const RED = '#cc2f3a';
    const INK = '#1d1b24';
    const IVORY = '#fbf7ec';
    const SHINE = {[BLUE]: '#86a7d8', [GREEN]: '#79c296', [RED]: '#e88c93'}; // a solid lighter line along each stick
    const CJK = 'font-family="PingFang SC, Hiragino Sans GB, Noto Sans CJK SC, Noto Sans SC, Microsoft YaHei, sans-serif" font-weight="600" text-anchor="middle"';
    const NUMBERS = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
    const WINDS = [['東', 'E', 'East'], ['南', 'S', 'South'], ['西', 'W', 'West'], ['北', 'N', 'North']];
    const FLOWER_COLORS = [['#e0679a', 'Plum'], ['#8a5cc7', 'Orchid'], ['#e98a2b', 'Chrysanthemum'], [RED, 'Peony']];
    const SEASON_NAMES = ['Spring', 'Summer', 'Autumn', 'Winter'];

    // Where the dots (and most bamboo sticks) go, for 1 to 9
    const SPOTS = [
        [[15, 20]],
        [[15, 11], [15, 29]],
        [[8, 9], [15, 20], [22, 31]],
        [[9, 11], [21, 11], [9, 29], [21, 29]],
        [[8, 9], [22, 9], [15, 20], [8, 31], [22, 31]],
        [[9, 9], [21, 9], [9, 20], [21, 20], [9, 31], [21, 31]],
        [[7, 6], [15, 10], [23, 14], [9, 24], [21, 24], [9, 33], [21, 33]],
        [[9, 6], [21, 6], [9, 15], [21, 15], [9, 25], [21, 25], [9, 34], [21, 34]],
        [[7, 9], [15, 9], [23, 9], [7, 20], [15, 20], [23, 20], [7, 31], [15, 31], [23, 31]]
    ];
    const DOT_COLORS = [
        [BLUE],
        [GREEN, GREEN],
        [BLUE, RED, GREEN],
        [BLUE, GREEN, GREEN, BLUE],
        [BLUE, GREEN, RED, GREEN, BLUE],
        [GREEN, GREEN, RED, RED, RED, RED],
        [GREEN, GREEN, GREEN, RED, RED, RED, RED],
        [BLUE, BLUE, BLUE, BLUE, BLUE, BLUE, BLUE, BLUE],
        [BLUE, BLUE, BLUE, RED, RED, RED, GREEN, GREEN, GREEN]
    ];
    const DOT_SIZES = [10, 6, 5, 5, 4.6, 4.6, 3.9, 3.7, 4.1];

    function dots(n) {
        if (n === 1) {
            return `<circle cx="15" cy="20" r="10" fill="${BLUE}"/><circle cx="15" cy="20" r="6.6" fill="${IVORY}"/>`
                + `<circle cx="15" cy="20" r="4.2" fill="${RED}"/>`;
        }
        const r = DOT_SIZES[n - 1];
        return SPOTS[n - 1].map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${DOT_COLORS[n - 1][i]}"/>`
            + `<circle cx="${x}" cy="${y}" r="${(r * 0.42).toFixed(2)}" fill="${IVORY}"/>`).join('');
    }

    function stick(x, y, height, color, width = 3.6) {
        const top = y - height / 2;
        return `<rect x="${x - width / 2}" y="${top}" width="${width}" height="${height}" rx="${width / 2}" fill="${color}"/>`
            + `<rect x="${x - width * 0.7}" y="${y - 0.6}" width="${width * 1.4}" height="1.2" rx="0.6" fill="${color}"/>`
            + `<rect x="${x - 0.5}" y="${top + 1.6}" width="1" height="${height - 3.2}" rx="0.5" fill="${SHINE[color]}"/>`;
    }

    function bamboo(n) {
        if (n === 1) {
            return stick(15, 22, 28, GREEN, 6) + `<circle cx="15" cy="7.5" r="3.4" fill="${RED}"/>`;
        }
        const layouts = {
            2: [[15, 12, GREEN], [15, 28, GREEN]],
            3: [[15, 12, GREEN], [9, 28, GREEN], [21, 28, GREEN]],
            4: [[9, 12, GREEN], [21, 12, GREEN], [9, 28, BLUE], [21, 28, BLUE]],
            5: [[7, 12, GREEN], [23, 12, GREEN], [15, 20, RED], [7, 28, BLUE], [23, 28, BLUE]],
            6: [[7, 12, GREEN], [15, 12, GREEN], [23, 12, GREEN], [7, 28, BLUE], [15, 28, BLUE], [23, 28, BLUE]],
            7: [[15, 8, RED], [7, 21, GREEN], [15, 21, GREEN], [23, 21, GREEN], [7, 33, GREEN], [15, 33, GREEN], [23, 33, GREEN]],
            8: [[6, 12, GREEN], [12, 12, GREEN], [18, 12, GREEN], [24, 12, GREEN], [6, 28, BLUE], [12, 28, BLUE], [18, 28, BLUE], [24, 28, BLUE]],
            9: [[7, 8, GREEN], [15, 8, RED], [23, 8, BLUE], [7, 20, GREEN], [15, 20, RED], [23, 20, BLUE], [7, 32, GREEN], [15, 32, RED], [23, 32, BLUE]]
        };
        const height = n === 7 || n === 9 ? 10 : 13;
        return layouts[n].map(([x, y, color]) => stick(x, y, n === 7 && y === 8 ? 10 : height, color)).join('');
    }

    function corner(text) {
        return `<text x="3.4" y="7.4" font-size="6.4" font-weight="700" fill="#8a7d62" font-family="system-ui, sans-serif">${text}</text>`;
    }

    function character(n) {
        return corner(n) + `<text x="16" y="18" font-size="13.5" fill="${INK}" ${CJK}>${NUMBERS[n - 1]}</text>`
            + `<text x="15" y="35" font-size="14" fill="${RED}" ${CJK}>萬</text>`;
    }

    function wind(k) {
        return corner(WINDS[k][1]) + `<text x="15.5" y="28" font-size="19" fill="${INK}" ${CJK}>${WINDS[k][0]}</text>`;
    }

    function dragon(k) {
        if (k === 2) {
            return `<rect x="6" y="7" width="18" height="26" rx="2.4" fill="none" stroke="${BLUE}" stroke-width="2.2"/>`
                + `<rect x="9.6" y="10.6" width="10.8" height="18.8" rx="1.2" fill="none" stroke="${BLUE}" stroke-width="0.9"/>`;
        }
        return `<text x="15" y="28" font-size="20" fill="${k === 0 ? RED : GREEN}" ${CJK}>${k === 0 ? '中' : '發'}</text>`;
    }

    function flower(k) {
        const color = FLOWER_COLORS[k][0];
        const petals = [0, 1, 2, 3, 4].map(i => {
            const angle = (i * 72 - 90 + k * 18) * Math.PI / 180;
            return `<circle cx="${(15 + Math.cos(angle) * 4.6).toFixed(2)}" cy="${(15 + Math.sin(angle) * 4.6).toFixed(2)}" r="3.9" fill="${color}"/>`;
        }).join('');
        return `<path d="M15 19 C15 26 14 30 15 35" fill="none" stroke="${GREEN}" stroke-width="1.6" stroke-linecap="round"/>`
            + `<path d="M15 29 C19 26 22 27 23 28 C21 31 18 31 15 29z" fill="${GREEN}"/>`
            + petals + `<circle cx="15" cy="15" r="2.6" fill="#f2c230"/>`;
    }

    // In a thin gold frame, so the four read as one set
    function season(k) {
        const frame = '<rect x="4" y="5" width="22" height="30" rx="3" fill="none" stroke="#c9a54a" stroke-width="1.1"/>';
        const pictures = [
            // Spring: a sprout
            `<path d="M15 31 V19" stroke="${GREEN}" stroke-width="1.8" stroke-linecap="round"/>`
            + `<path d="M15 21 C9 21 7 16 8 13 C12 13 15 16 15 21z" fill="${GREEN}"/>`
            + `<path d="M15 19 C20 19 23 14 22 11 C18 11 15 14 15 19z" fill="#5fb548"/>`,
            // Summer: the sun
            `<circle cx="15" cy="20" r="5" fill="#f2a516"/>` + [...Array(8).keys()].map(i => {
                const a = i * 45 * Math.PI / 180;
                const p = r => [(15 + Math.cos(a) * r).toFixed(2), (20 + Math.sin(a) * r).toFixed(2)];
                return `<line x1="${p(7)[0]}" y1="${p(7)[1]}" x2="${p(9.6)[0]}" y2="${p(9.6)[1]}" stroke="#f2a516" stroke-width="1.8" stroke-linecap="round"/>`;
            }).join(''),
            // Autumn: a falling leaf
            `<path d="M15 10 C21 13 23 20 15 30 C7 20 9 13 15 10z" fill="#d9682a"/>`
            + `<path d="M15 13 V32" stroke="#8a3d17" stroke-width="1" stroke-linecap="round"/>`,
            // Winter: a snowflake
            [0, 60, 120].map(d => `<g transform="rotate(${d} 15 20)"><line x1="15" y1="11" x2="15" y2="29" stroke="${BLUE}" stroke-width="1.6" stroke-linecap="round"/>`
                + `<path d="M12.6 13 L15 15 L17.4 13 M12.6 27 L15 25 L17.4 27" fill="none" stroke="${BLUE}" stroke-width="1.2" stroke-linecap="round"/></g>`).join('')
        ];
        return frame + pictures[k];
    }

    function drawing(face) {
        if (face < 9) {
            return dots(face + 1);
        }
        if (face < 18) {
            return bamboo(face - 8);
        }
        if (face < 27) {
            return character(face - 17);
        }
        if (face < 31) {
            return wind(face - 27);
        }
        if (face < 34) {
            return dragon(face - 31);
        }
        return face < 38 ? flower(face - 34) : season(face - 38);
    }

    function name(face) {
        if (face < 27) {
            return (face % 9 + 1) + ' of ' + ['dots', 'bamboo', 'characters'][Math.floor(face / 9)];
        }
        if (face < 31) {
            return WINDS[face - 27][2] + ' wind';
        }
        if (face < 34) {
            return ['Red', 'Green', 'White'][face - 31] + ' dragon';
        }
        return face < 38 ? FLOWER_COLORS[face - 34][1] + ' flower' : SEASON_NAMES[face - 38] + ' season';
    }

    // The symbols, once per page
    const symbols = [...Array(42).keys()].map(face => `<symbol id="face-${face}" viewBox="0 0 30 40">${drawing(face)}</symbol>`).join('');
    document.body.insertAdjacentHTML('afterbegin',
        `<svg width="0" height="0" style="position: absolute" aria-hidden="true">${symbols}</svg>`);

    return {name};
})();
