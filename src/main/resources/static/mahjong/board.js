// Mahjong's rules, without drawing: the layouts, which tiles are free, dealing and shuffling. Runs in Node for the tests.
// Positions are in half tiles (x across, y down) and layers (z), so a tile can sit half over the ones below it.
const Board = (() => {
    // One layout per level: a height map, one digit per tile place (how many tiles are stacked there), plus caps: tiles
    // that sit across four below them, as [x, y, z]. Upright and sideways each have their own, with the same number of tiles.
    const LAYOUTS = {
        easy: {
            upright: {
                map: [
                    '1111111',
                    '1112111',
                    '1122211',
                    '1123211',
                    '1123211',
                    '1122211',
                    '1112111',
                    '1111111'
                ],
                caps: []
            },
            sideways: {
                map: [
                    '..1111111..',
                    '.112333211.',
                    '11233433211',
                    '.112333211.',
                    '..1111111..'
                ],
                caps: []
            }
        },
        medium: {
            upright: {
                map: [
                    '.111111.',
                    '11222211',
                    '12233221',
                    '12344321',
                    '12344321',
                    '12233221',
                    '11222211',
                    '.111111.'
                ],
                caps: []
            },
            sideways: {
                map: [
                    '111111111111',
                    '122223322221',
                    '123444444321',
                    '122223322221',
                    '111111111111'
                ],
                caps: []
            }
        },
        hard: {
            upright: {
                map: [
                    '21111112',
                    '12222221',
                    '12333321',
                    '12344321',
                    '12344321',
                    '12344321',
                    '12333321',
                    '12222221',
                    '21111112'
                ],
                caps: []
            },
            sideways: {
                map: [
                    '11111111111111',
                    '12333333333321',
                    '12334455443321',
                    '12333333333321',
                    '11111111111111'
                ],
                caps: []
            }
        }
    };

    // Faces: 0-8 dots, 9-17 bamboo, 18-26 characters (each 1 to 9), 27-30 winds (east, south, west, north),
    // 31-33 dragons (red, green, white), 34-37 flowers, 38-41 seasons. Four of each, but one of each flower and season.
    // Any two flowers match, and any two seasons.
    const FLOWERS = 34;
    const SEASONS = 38;
    const GROUPS = 36;
    const groupOf = face => (face < FLOWERS ? face : face < SEASONS ? FLOWERS : FLOWERS + 1);
    const matches = (a, b) => groupOf(a) === groupOf(b);

    function positions(layout) {
        const list = [];
        layout.map.forEach((row, r) => [...row].forEach((cell, c) => {
            for (let z = 0; z < (Number(cell) || 0); z++) {
                list.push({x: c * 2, y: r * 2, z});
            }
        }));
        list.push(...layout.caps.map(([x, y, z]) => ({x, y, z})));
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

    return {LAYOUTS, FLOWERS, SEASONS, groupOf, matches, positions, neighbours, isFree, freeTiles, freePair, deal, shuffle};
})();

if (typeof module !== 'undefined') {
    module.exports = Board;
}
