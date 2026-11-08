// Mahjong's rules, without drawing: the layouts, which tiles are free, dealing and shuffling. Runs in Node for the tests.
// Positions are in half tiles (x across, y down) and layers (z), so a tile can sit half over the ones below it.
const Board = (() => {
    // Each level has a few layouts (assemblies) of the same number of tiles, so its leaderboard stays fair; a deal takes one
    // of them at random. A layout is a height map per shape, one digit per tile place (how many tiles are stacked there),
    // plus caps: tiles that sit across four below them, as [x, y, z]. Upright and sideways have the same number of tiles.
    // The first of each level is the one from before there were several, so games kept on a device still fit.
    const LAYOUTS = {
        easy: [
            {
                name: 'Garden',
                upright: ['1111111', '1112111', '1122211', '1123211', '1123211', '1122211', '1112111', '1111111'],
                sideways: ['..1111111..', '.112333211.', '11233433211', '.112333211.', '..1111111..']
            },
            {
                name: 'Butterfly',
                upright: ['11....11', '122..221', '123..321', '.112211.', '...22...', '.112211.', '123..321', '122..221', '11....11'],
                sideways: ['111.....111', '12221.12221', '12343234321', '12221.12221', '111.....111']
            },
            {
                name: 'Pyramid',
                upright: ['...11...', '..1111..', '.123321.', '12333321', '12333321', '.123321.', '..1111..', '...11...'],
                sideways: ['111111111', '122222221', '123343321', '122222221', '111111111']
            },
            {
                name: 'Bridge',
                upright: ['1111111', '12.1.21', '1222221', '12.4.21', '12.4.21', '1222221', '12.1.21', '1111111'],
                sideways: ['11111111111', '12.2.2.2.21', '12333233321', '12.2.2.2.21', '11111111111']
            }
        ],
        medium: [
            {
                name: 'Lotus',
                upright: ['.111111.', '11222211', '12233221', '12344321', '12344321', '12233221', '11222211', '.111111.'],
                sideways: ['111111111111', '122223322221', '123444444321', '122223322221', '111111111111']
            },
            {
                name: 'Twin Towers',
                upright: ['.111111.', '12211221', '13311331', '14411441', '14411441', '13311331', '12211221', '.111111.'],
                sideways: ['111111111111', '123321123321', '125532235521', '123321123321', '111111111111']
            },
            {
                name: 'Courtyard',
                upright: ['11111111', '13333331', '13.11.31', '13.44.31', '13.44.31', '13.11.31', '13333331', '11111111'],
                sideways: ['111111111111', '133333333331', '13..2442..31', '133333333331', '111111111111']
            },
            {
                name: 'Hourglass',
                upright: ['11111111', '12333321', '.134431.', '..1331..', '...44...', '..1331..', '.134431.', '12333321', '11111111'],
                sideways: ['11111..11111', '123321123321', '123455554321', '123321123321', '11111..11111']
            }
        ],
        hard: [
            {
                name: 'Temple',
                upright: ['21111112', '12222221', '12333321', '12344321', '12344321', '12344321', '12333321', '12222221', '21111112'],
                sideways: ['11111111111111', '12333333333321', '12334455443321', '12333333333321', '11111111111111']
            },
            {
                name: 'Mountains',
                upright: ['11111111', '12355321', '12344321', '11222211', '12344321', '11222211', '12344321', '12355321', '11111111'],
                sideways: ['12221122112221', '12321244212321', '13631244213631', '12321244212321', '12221122112221']
            },
            {
                name: 'Castle',
                upright: ['33.11.33', '33222233', '11222211', '12233221', '12344321', '12233221', '11222211', '33222233', '33.11.33'],
                sideways: ['331111..111133', '33222222222233', '12333444433321', '33222222222233', '331111..111133']
            },
            {
                name: 'Terraces',
                upright: ['12222221', '22222222', '12222221', '33333333', '11111111', '33333333', '12222221', '22222222', '12222221'],
                sideways: ['11222222222211', '33333333333333', '111111..111111', '33333333333333', '11222222222211']
            }
        ]
    };
    const TILE_COUNTS = {easy: 72, medium: 108, hard: 144};

    // The layout of a level with this name (the first one when it isn't known)
    function layoutOf(level, name) {
        return LAYOUTS[level].find(layout => layout.name === name) || LAYOUTS[level][0];
    }

    // Faces: 0-8 dots, 9-17 bamboo, 18-26 characters (each 1 to 9), 27-30 winds (east, south, west, north),
    // 31-33 dragons (red, green, white), 34-37 flowers, 38-41 seasons. Four of each, but one of each flower and season.
    // Any two flowers match, and any two seasons.
    const FLOWERS = 34;
    const SEASONS = 38;
    const GROUPS = 36;
    const groupOf = face => (face < FLOWERS ? face : face < SEASONS ? FLOWERS : FLOWERS + 1);
    const matches = (a, b) => groupOf(a) === groupOf(b);

    // The tiles of a height map (and its caps, if any)
    function positions(map, caps = []) {
        const list = [];
        map.forEach((row, r) => [...row].forEach((cell, c) => {
            for (let z = 0; z < (Number(cell) || 0); z++) {
                list.push({x: c * 2, y: r * 2, z});
            }
        }));
        list.push(...caps.map(([x, y, z]) => ({x, y, z})));
        return list;
    }

    // For each tile: the tiles lying on it, and those touching it on the left and on the right in its own layer
    function neighbours(tiles) {
        const near = (a, b, coord) => Math.abs(a[coord] - b[coord]) < 2;
        return tiles.map(t => ({
            above: tiles.flatMap((u, i) => (u.z === t.z + 1 && near(u, t, 'x') && near(u, t, 'y') ? [i] : [])),
            left: tiles.flatMap((u, i) => (u.z === t.z && u.x === t.x - 2 && near(u, t, 'y') ? [i] : [])),
            right: tiles.flatMap((u, i) => (u.z === t.z && u.x === t.x + 2 && near(u, t, 'y') ? [i] : []))
        }));
    }

    // Free: nothing on it, and nothing on its left or nothing on its right
    function isFree(i, near, gone) {
        const open = list => list.every(k => gone[k]);
        return !gone[i] && open(near[i].above) && (open(near[i].left) || open(near[i].right));
    }

    function freeTiles(near, gone) {
        return near.flatMap((_, i) => (isFree(i, near, gone) ? [i] : []));
    }

    // Two free tiles that match, or null
    function freePair(faces, near, gone) {
        const free = freeTiles(near, gone);
        for (let a = 0; a < free.length; a++) {
            for (let b = a + 1; b < free.length; b++) {
                if (matches(faces[free[a]], faces[free[b]])) {
                    return [free[a], free[b]];
                }
            }
        }
        return null;
    }

    const pick = (list, random) => list.splice(Math.floor(random() * list.length), 1)[0];

    function shuffled(list, random) {
        const copy = [...list];
        for (let i = copy.length - 1; i > 0; i--) {
            const j = Math.floor(random() * (i + 1));
            [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy;
    }

    // An order to take the given tiles away in, two free ones at a time, or null when it got stuck
    function clearingOrder(near, gone, random) {
        const left = gone.map(g => !g);
        const taken = [...gone];
        const order = [];
        let count = left.filter(Boolean).length;
        while (count > 0) {
            const free = freeTiles(near, taken);
            if (free.length < 2) {
                return null;
            }
            const pair = [pick(free, random), pick(free, random)];
            pair.forEach(i => {
                taken[i] = true;
            });
            order.push(pair);
            count -= 2;
        }
        return order;
    }

    // Gives the pairs of faces to the tiles in an order they can all be taken away in, so the game can always be won.
    // Returns the faces of all tiles, or null.
    function placePairs(pairs, near, gone, faces, random) {
        for (let attempt = 0; attempt < 300; attempt++) {
            const order = clearingOrder(near, gone, random);
            if (order) {
                const result = [...faces];
                shuffled(pairs, random).forEach((pair, k) => {
                    const [a, b] = shuffled(pair, random);
                    result[order[k][0]] = a;
                    result[order[k][1]] = b;
                });
                return result;
            }
        }
        return null;
    }

    // Pairs of faces for a deal of so many tiles: groups chosen at random, four tiles of each
    function pairsFor(count, random) {
        const groups = shuffled([...Array(GROUPS).keys()], random);
        const pairs = [];
        for (const group of groups) {
            const faces = group < FLOWERS ? [group, group, group, group]
                : shuffled([0, 1, 2, 3].map(k => (group === FLOWERS ? FLOWERS : SEASONS) + k), random);
            pairs.push(faces.slice(0, 2));
            if (pairs.length * 2 < count) {
                pairs.push(faces.slice(2));
            }
            if (pairs.length * 2 >= count) {
                break;
            }
        }
        return pairs;
    }

    function deal(tiles, near, random = Math.random) {
        const gone = tiles.map(() => false);
        return placePairs(pairsFor(tiles.length, random), near, gone, gone.map(() => -1), random);
    }

    // The tiles still there get their faces mixed again, again so that they can all be taken away. Null if that can't be.
    function shuffle(faces, near, gone, random = Math.random) {
        const byGroup = {};
        faces.forEach((face, i) => {
            if (!gone[i]) {
                (byGroup[groupOf(face)] ||= []).push(face);
            }
        });
        const pairs = Object.values(byGroup).flatMap(list => list.flatMap((face, k) => (k % 2 ? [] : [[face, list[k + 1]]])));
        return placePairs(pairs, near, gone, faces, random);
    }

    return {LAYOUTS, TILE_COUNTS, layoutOf, FLOWERS, SEASONS, groupOf, matches, positions, neighbours, isFree, freeTiles, freePair, deal, shuffle};
})();

if (typeof module !== 'undefined') {
    module.exports = Board;
}
