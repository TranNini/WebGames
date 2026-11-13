// The island as plain numbers: height, biome and places. No drawing here, so it can be tested on its own.
// x runs east, z south, y up, in metres. The sea surface is y = 0.
export const WORLD_SIZE = 1100;
export const GRID = 320;
export const CELL = WORLD_SIZE / GRID;
export const BIOME = {SEA: 0, BEACH: 1, MEADOW: 2, JUNGLE: 3, SWAMP: 4, LAGOON: 5, RIVER: 6, ISLET: 7, CAVE: 8};
export const SEA_LEVEL = 0;

export function rng(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const table = new Float32Array(65536);
{
    const random = rng(4182);
    for (let i = 0; i < table.length; i++) {
        table[i] = random();
    }
}
const lattice = (x, z) => table[((x & 255) + ((z & 255) << 8)) & 65535];
const fade = t => t * t * (3 - 2 * t);
const mix = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
};

export function noise(x, z) {
    const ix = Math.floor(x);
    const iz = Math.floor(z);
    const fx = fade(x - ix);
    const fz = fade(z - iz);
    return mix(mix(lattice(ix, iz), lattice(ix + 1, iz), fx), mix(lattice(ix, iz + 1), lattice(ix + 1, iz + 1), fx), fz);
}

export function fbm(x, z, octaves = 4) {
    let sum = 0;
    let amp = 0.5;
    let total = 0;
    for (let i = 0; i < octaves; i++) {
        sum += noise(x, z) * amp;
        total += amp;
        x = x * 2.03 + 17.1;
        z = z * 2.03 + 9.2;
        amp *= 0.5;
    }
    return sum / total;
}

// The distance from the centre to the shore, for each direction
export function coast(angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return 292 + 96 * (fbm(c * 1.5 + 11, s * 1.5 + 23, 3) - 0.5) + 34 * (fbm(c * 5 + 41, s * 5 + 7, 2) - 0.5);
}

export function polar(degrees, fraction, add = 0) {
    const a = degrees * Math.PI / 180;
    const r = coast(a) * fraction + add;
    return {x: Math.cos(a) * r, z: Math.sin(a) * r};
}

function meander(from, to, steps, amplitude, salt) {
    const points = [];
    const nx = -(to.z - from.z);
    const nz = to.x - from.x;
    const length = Math.hypot(nx, nz);
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const off = amplitude * Math.sin(t * Math.PI) * (fbm(t * 3.4 + salt, salt * 0.7, 3) - 0.5) * 2;
        points.push({x: mix(from.x, to.x, t) + nx / length * off, z: mix(from.z, to.z, t) + nz / length * off});
    }
    return points;
}

export const POND = {...polar(250, 0.12), r: 19};
export const LAGOON = {...polar(62, 0.97), r: 64};
export const SWAMP = {...polar(205, 0.62), r: 98};
export const MEADOW = {...polar(300, 0.42), r: 72};
export const RIVERS = [
    {width: 6.5, points: meander(POND, polar(340, 1.06), 44, 58, 3.3)},
    {width: 5.5, points: meander(POND, LAGOON, 40, 46, 8.1)}
];
const CAVE_RADIUS = 11;
// Below the door: a winding tunnel, and a room far under the ground
const TUNNEL_WIDTH = 3.1;
const ROOM_RADIUS = 18;
const ROOM_FLOOR = -19;
export const CAVES = [
    {id: 'cave-north', ...polar(268, 0.66), dir: 0.9},
    {id: 'cave-east', ...polar(14, 0.6), dir: 2.2},
    {id: 'cave-west', ...polar(160, 0.68), dir: -1.0}
].map(cave => {
    const made = {...cave, r: CAVE_RADIUS, top: 6.6, floor: 3.2};
    const inward = cave.dir + Math.PI;
    made.door = {x: cave.x + Math.cos(cave.dir) * made.r, z: cave.z + Math.sin(cave.dir) * made.r, y: made.floor};
    // Each piece of the tunnel turns a little and goes further down
    const bends = [[0, 8, 3.2 - 1.2], [0.55, 18, -3.2], [-0.5, 20, -9.5], [0.35, 20, -15], [0, 18, ROOM_FLOOR]];
    let {x, z} = made.door;
    made.path = [{x, z, y: made.floor}];
    for (const [turn, length, y] of bends) {
        x += Math.cos(inward + turn) * length;
        z += Math.sin(inward + turn) * length;
        made.path.push({x, z, y});
    }
    made.width = TUNNEL_WIDTH;
    // The tunnel ends in the wall of the room
    made.room = {x: x + Math.cos(inward) * (ROOM_RADIUS + 0.2), z: z + Math.sin(inward) * (ROOM_RADIUS + 0.2), y: ROOM_FLOOR, r: ROOM_RADIUS};
    return made;
});

// Where on a cave's tunnel a point is nearest: how far from it, how high the floor is, and that place
function onTunnel(cave, x, z) {
    let best = {d: 1e9, y: cave.floor, x, z};
    for (let i = 0; i < cave.path.length - 1; i++) {
        const a = cave.path[i];
        const b = cave.path[i + 1];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz)));
        const px = a.x + dx * t;
        const pz = a.z + dz * t;
        const d = Math.hypot(x - px, z - pz);
        if (d < best.d) {
            best = {d, y: a.y + (b.y - a.y) * t, x: px, z: pz};
        }
    }
    return best;
}

// The floor under a point of the cave
export function caveFloor(cave, x, z) {
    return Math.hypot(x - cave.room.x, z - cave.room.z) < cave.room.r ? cave.room.y : onTunnel(cave, x, z).y;
}

// Keeps a point inside the cave's tunnel and room
export function keepInCave(cave, p, margin = 0.5) {
    const {room, width} = cave;
    const dx = p.x - room.x;
    const dz = p.z - room.z;
    const fromRoom = Math.hypot(dx, dz);
    const roomLimit = room.r - margin - 0.7;
    if (fromRoom <= roomLimit) {
        return;
    }
    const near = onTunnel(cave, p.x, p.z);
    const limit = width - margin;
    if (near.d <= limit) {
        return;
    }
    const toTunnel = near.d - limit;
    if (fromRoom - roomLimit < toTunnel) {
        p.x = room.x + dx / fromRoom * roomLimit;
        p.z = room.z + dz / fromRoom * roomLimit;
    } else {
        p.x = near.x + (p.x - near.x) / near.d * limit;
        p.z = near.z + (p.z - near.z) / near.d * limit;
    }
}

// Local to a cave's door: how far out from it, and how far to the side
export function atDoor(cave, x, z) {
    const dx = x - cave.door.x;
    const dz = z - cave.door.z;
    return {out: dx * Math.cos(cave.dir) + dz * Math.sin(cave.dir), side: -dx * Math.sin(cave.dir) + dz * Math.cos(cave.dir)};
}
export const ISLETS = [
    {id: 'islet-sun', ...polar(22, 0, 452), r: 50},
    {id: 'islet-palm', ...polar(190, 0, 462), r: 58},
    {id: 'islet-rock', ...polar(283, 0, 446), r: 42}
];

// Places to find. Their meshes and what is in them are in places.js.
export const PLACES = {
    spawn: {...polar(115, 1, -11), name: 'Crash beach'},
    wreck: {...polar(122, 0.74), name: 'Airplane wreckage', r: 26},
    tail: {...polar(137, 1, 62), name: 'Sunken tail section', r: 22},
    hutMeadow: {...polar(300, 0.42), name: 'Abandoned hut', r: 16},
    hutSwamp: {...polar(212, 0.74), name: 'Abandoned swamp hut', r: 16},
    campNorth: {...polar(330, 0.5), name: 'Hidden camp', r: 15},
    campWest: {...polar(240, 0.78), name: 'Hidden camp', r: 15},
    station: {...polar(40, 0.34), name: 'Old weather station', r: 18},
    wreckBeach: {...polar(352, 1, -6), name: 'Beached shipwreck', r: 22},
    wreckSunk: {...polar(240, 1, 70), name: 'Sunken shipwreck', r: 22},
    buried: {...polar(88, 1, -8), name: 'Marked spot on the beach', r: 6},
    caveNorth: {x: CAVES[0].x, z: CAVES[0].z, name: 'North cave', r: 14},
    caveEast: {x: CAVES[1].x, z: CAVES[1].z, name: 'East cave', r: 14},
    caveWest: {x: CAVES[2].x, z: CAVES[2].z, name: 'West cave', r: 14},
    isletSun: {x: ISLETS[0].x, z: ISLETS[0].z, name: 'Sun Islet', r: 40},
    isletPalm: {x: ISLETS[1].x, z: ISLETS[1].z, name: 'Palm Islet', r: 46},
    isletRock: {x: ISLETS[2].x, z: ISLETS[2].z, name: 'Rock Islet', r: 34}
};

function segmentDistance(x, z, a, b) {
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz)));
    return Math.hypot(x - a.x - dx * t, z - a.z - dz * t);
}

export function riverDistance(x, z) {
    let best = {d: 1e9, width: 6};
    for (const river of RIVERS) {
        for (let i = 1; i < river.points.length; i++) {
            const d = segmentDistance(x, z, river.points[i - 1], river.points[i]);
            if (d < best.d) {
                best = {d, width: river.width};
            }
        }
    }
    return best;
}

function sample(x, z) {
    const r = Math.hypot(x, z);
    const angle = Math.atan2(z, x);
    const inland = coast(angle) - r;
    let h;
    let biome = BIOME.JUNGLE;
    if (inland < 0) {
        h = Math.max(-26, inland * 0.075 - 0.1) + (fbm(x * 0.03 + 3, z * 0.03, 3) - 0.5) * Math.min(2.4, -inland * 0.05);
    } else {
        const hills = fbm(x * 0.0085 + 7, z * 0.0085 + 3, 4);
        h = Math.min(1.75, inland * 0.075) + smoothstep(18, 130, inland) * (1 + 9.5 * hills * hills * 1.7)
            + 0.5 * (fbm(x * 0.05, z * 0.05, 2) - 0.5) * smoothstep(5, 40, inland);
    }
    const nearBeach = inland < 27 || h < 1.9;

    let isIslet = false;
    for (const islet of ISLETS) {
        const distance = Math.hypot(x - islet.x, z - islet.z);
        const rim = islet.r * (0.82 + 0.36 * noise(x * 0.03 + islet.r, z * 0.03)) - distance;
        const high = rim < 0 ? Math.max(-26, rim * 0.09 - 0.1) : Math.min(1.3, rim * 0.09) + smoothstep(9, 38, rim) * 2.4;
        if (high > h) {
            h = high;
            isIslet = rim > 0;
        }
    }

    // The lagoon: shallow, closed off from the sea by a sand bar with one gap
    const toLagoon = Math.hypot(x - LAGOON.x, z - LAGOON.z);
    const lagoonMask = smoothstep(LAGOON.r + 2, LAGOON.r * 0.62, toLagoon + 8 * (noise(x * 0.04, z * 0.04) - 0.5));
    h = mix(h, -1.7 + 0.8 * noise(x * 0.06 + 8, z * 0.06), lagoonMask);
    const barAngle = Math.atan2(z - LAGOON.z, x - LAGOON.x);
    if (toLagoon > LAGOON.r * 0.88 && toLagoon < LAGOON.r * 1.3 && inland < 6 && Math.abs(barAngle - 0.2) > 0.2) {
        const across = 1 - Math.abs(toLagoon - LAGOON.r * 1.08) / (LAGOON.r * 0.2);
        h = Math.max(h, -1.2 + 1.9 * smoothstep(0, 0.8, across));
    }

    // The swamp: flat, with pools and mud
    const toSwamp = Math.hypot(x - SWAMP.x, z - SWAMP.z) + 22 * (noise(x * 0.02 + 5, z * 0.02) - 0.5);
    const swampMask = smoothstep(SWAMP.r, SWAMP.r * 0.55, toSwamp);
    h = mix(h, -0.62 + 1.55 * fbm(x * 0.042 + 2, z * 0.042 + 9, 3), swampMask);

    // Rivers run in valleys, and start from a pond
    const river = riverDistance(x, z);
    const toPond = Math.hypot(x - POND.x, z - POND.z);
    const inlandEnough = inland > -3;
    if (inlandEnough) {
        h = mix(Math.min(h, 1.25), h, smoothstep(river.width, river.width + 44, river.d));
        h = mix(-1.25, h, smoothstep(river.width * 0.72, river.width * 1.5, river.d));
        h = mix(Math.min(h, 1.2), h, smoothstep(POND.r, POND.r + 30, toPond));
        h = mix(-1.5, h, smoothstep(POND.r * 0.8, POND.r * 1.2, toPond));
    }
    const fresh = inlandEnough && (river.d < river.width * 1.5 || toPond < POND.r * 1.25);

    // A cave's door is in a small rise, with a ramp down to it. The cave itself lies under the ground.
    let inCave = false;
    for (const cave of CAVES) {
        const dx = x - cave.x;
        const dz = z - cave.z;
        const distance = Math.hypot(dx, dz);
        if (distance > cave.r + 50) {
            continue;
        }
        h = mix(h, Math.max(h, cave.top), smoothstep(cave.r + 42, cave.r + 7, distance));
        const along = dx * Math.cos(cave.dir) + dz * Math.sin(cave.dir);
        const side = Math.abs(-dx * Math.sin(cave.dir) + dz * Math.cos(cave.dir));
        if (along > cave.r - 7 && along < cave.r + 20) {
            const ramp = mix(cave.floor, cave.top, smoothstep(cave.r + 2, cave.r + 18, along));
            h = mix(h, ramp, smoothstep(6.5, 3.2, side) * smoothstep(cave.r - 4, cave.r - 1, along));
        }
        inCave = inCave || along > cave.r - 2 && along < cave.r + 8 && side < 6;
    }

    if (inCave) {
        biome = BIOME.CAVE;
    } else if (fresh && h < 0.6) {
        biome = BIOME.RIVER;
    } else if (swampMask > 0.45) {
        biome = BIOME.SWAMP;
    } else if (lagoonMask > 0.5) {
        biome = BIOME.LAGOON;
    } else if (h < 0) {
        biome = BIOME.SEA;
    } else if (isIslet) {
        biome = h < 1.4 ? BIOME.BEACH : BIOME.ISLET;
    } else if (nearBeach && h < 2.4) {
        biome = BIOME.BEACH;
    } else if (fbm(x * 0.0075 + 50, z * 0.0075 + 31, 3) > 0.6 || Math.hypot(x - MEADOW.x, z - MEADOW.z) < MEADOW.r) {
        biome = BIOME.MEADOW;
    }
    return {h, biome, fresh: fresh && h < 0.6, swamp: swampMask};
}

export function buildWorld() {
    const size = GRID + 1;
    const heights = new Float32Array(size * size);
    const biomes = new Uint8Array(size * size);
    const murk = new Uint8Array(size * size); // 0: sea, 128: river or pond, 255: swamp
    for (let j = 0; j < size; j++) {
        for (let i = 0; i < size; i++) {
            const k = i + j * size;
            const point = sample((i - GRID / 2) * CELL, (j - GRID / 2) * CELL);
            heights[k] = point.h;
            biomes[k] = point.biome;
            murk[k] = point.swamp > 0.4 ? 255 : point.fresh ? 128 : 0;
        }
    }

    function heightAt(x, z) {
        const fx = Math.max(0, Math.min(GRID - 0.001, x / CELL + GRID / 2));
        const fz = Math.max(0, Math.min(GRID - 0.001, z / CELL + GRID / 2));
        const ix = Math.floor(fx);
        const iz = Math.floor(fz);
        const tx = fx - ix;
        const tz = fz - iz;
        const a = heights[ix + iz * size];
        const b = heights[ix + 1 + iz * size];
        const c = heights[ix + (iz + 1) * size];
        const d = heights[ix + 1 + (iz + 1) * size];
        // The same split of the square as the mesh
        return tx + tz < 1 ? a + (b - a) * tx + (c - a) * tz : d + (c - d) * (1 - tx) + (b - d) * (1 - tz);
    }

    function cellOf(x, z) {
        const ix = Math.round(x / CELL + GRID / 2);
        const iz = Math.round(z / CELL + GRID / 2);
        if (ix < 0 || iz < 0 || ix > GRID || iz > GRID) {
            return -1;
        }
        return ix + iz * size;
    }

    return {
        heights,
        biomes,
        murk,
        heightAt,
        biomeAt(x, z) {
            const k = cellOf(x, z);
            return k < 0 ? BIOME.SEA : biomes[k];
        },
        // 'sea', 'fresh' or 'swamp': what is in the water here
        waterAt(x, z) {
            const k = cellOf(x, z);
            const kind = k < 0 ? 0 : murk[k];
            return kind === 255 ? 'swamp' : kind === 128 ? 'fresh' : 'sea';
        },
        slopeAt(x, z) {
            const dx = heightAt(x + 1, z) - heightAt(x - 1, z);
            const dz = heightAt(x, z + 1) - heightAt(x, z - 1);
            return Math.hypot(dx, dz) / 2;
        },
        caveAt(x, z) {
            return CAVES.find(cave => Math.hypot(x - cave.door.x, z - cave.door.z) < 12) || null;
        }
    };
}
