// What grows and lies around: trees, plants, stones and branches. All placed the same way every game; what was taken is kept in the save.
import * as THREE from './lib/three.module.min.js';
import {BIOME, CAVES, PLACES, WORLD_SIZE, fbm, riverDistance, rng} from './world.js';
import {REGION, Shape, WHITE, color, v3} from './art.js';

const {SEA, BEACH, MEADOW, JUNGLE, SWAMP, LAGOON, RIVER, ISLET, CAVE} = BIOME;
const SECTORS = 10;
const SECTOR = WORLD_SIZE / SECTORS;

// A curved strip, for banana and other big leaves. The light falls on it as if it arched.
function frond(s, origin, angle, length, width, rise, droop, region, tint = WHITE, segments = 5) {
    const dx = Math.cos(angle);
    const dz = Math.sin(angle);
    const start = s.position.length / 3;
    for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const y = origin.y + rise * t - droop * t * t;
        const x = origin.x + dx * length * t;
        const z = origin.z + dz * length * t;
        const nx = dx * 0.35;
        const nz = dz * 0.35;
        s.vertex(x - dz * width / 2, y, z + dx * width / 2, nx, 0.9, nz, 0, t, region, tint);
        s.vertex(x + dz * width / 2, y, z - dx * width / 2, nx, 0.9, nz, 1, t, region, tint);
    }
    for (let i = 0; i < segments; i++) {
        const a = start + i * 2;
        s.index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
}

// The same, with the two halves hanging from the stem like the leaflets of a palm
function archedFrond(s, origin, angle, length, width, rise, droop, region, tint = WHITE, segments = 5) {
    const dx = Math.cos(angle);
    const dz = Math.sin(angle);
    const start = s.position.length / 3;
    for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const y = origin.y + rise * t - droop * t * t;
        const x = origin.x + dx * length * t;
        const z = origin.z + dz * length * t;
        const hang = width * (0.2 + t * 0.2);
        s.vertex(x - dz * width / 2, y - hang, z + dx * width / 2, dx * 0.2 - dz * 0.55, 0.8, dz * 0.2 + dx * 0.55, 0, t, region, tint);
        s.vertex(x, y, z, dx * 0.2, 0.98, dz * 0.2, 0.5, t, region, tint);
        s.vertex(x + dz * width / 2, y - hang, z - dx * width / 2, dx * 0.2 + dz * 0.55, 0.8, dz * 0.2 - dx * 0.55, 1, t, region, tint);
    }
    for (let i = 0; i < segments; i++) {
        const a = start + i * 3;
        s.index.push(a, a + 1, a + 3, a + 1, a + 4, a + 3, a + 1, a + 2, a + 4, a + 2, a + 5, a + 4);
    }
}

// Cards of leaves around a point. Those low in the crown get less light.
function leafCards(s, random, spot, cards, size, region, tints, center, low, high) {
    const shade = new THREE.Color();
    for (let i = 0; i < cards; i++) {
        const u = random() * Math.PI * 2;
        const w = random() * 1.9 - 0.6;
        const out = v3(Math.cos(u) * Math.cos(w), Math.sin(w), Math.sin(u) * Math.cos(w));
        const p = v3(spot.x + out.x * spot.r * 0.7, spot.y + out.y * spot.r * 0.5, spot.z + out.z * spot.r * 0.7);
        const facing = out.clone().lerp(v3(0, 1, 0), 0.35 + random() * 0.3).normalize();
        const side = new THREE.Vector3().crossVectors(facing, v3(random() - 0.5, 0.2, random() - 0.5)).normalize();
        const up = new THREE.Vector3().crossVectors(side, facing).normalize();
        side.multiplyScalar(size / 2);
        up.multiplyScalar(size / 2);
        const normal = p.clone().sub(center).normalize().lerp(v3(0, 1, 0), 0.4).normalize();
        const light = 0.5 + 0.62 * Math.min(1, Math.max(0, (p.y - low) / Math.max(0.1, high - low)));
        shade.copy(tints[Math.floor(random() * tints.length)]).multiplyScalar(light);
        s.card(p.clone().sub(side).sub(up), p.clone().add(side).sub(up), p.clone().add(side).add(up), p.clone().sub(side).add(up), region, shade, normal);
    }
}

function leafCrown(s, random, center, rx, ry, rz, cards, size, region, tints) {
    leafCards(s, random, {x: center.x, y: center.y, z: center.z, r: Math.max(rx, rz)}, cards, size, region, tints, center, center.y - ry, center.y + ry);
}

// A leafy tree. The same plan at each level of detail: level 0 up close, 1 further away, 2 far off.
function broadleaf(random, level, o) {
    const s = new Shape();
    const {height, girth, reach, depth, limbs} = o;
    const bendX = (random() - 0.5) * height * 0.12;
    const bendZ = (random() - 0.5) * height * 0.12;
    const ringCount = [8, 3, 1][level];
    const path = [];
    const radii = [];
    for (let i = 0; i <= ringCount; i++) {
        const t = i / ringCount;
        path.push(v3(bendX * t * t, height * t, bendZ * t * t));
        radii.push(girth * (0.32 + 0.68 * (1 - t) * (1 - t) ** 0.3) * (i === 0 ? 1.3 : 1));
    }
    s.tube(path, radii, [9, 5, 3][level], o.bark, WHITE, Math.max(1, height / 3.2));
    const topAt = t => v3(bendX * t * t, height * t, bendZ * t * t);
    if (o.roots && level < 2) {
        const count = level === 0 ? 6 : 3;
        for (let i = 0; i < count; i++) {
            const a = i / count * 6.28 + random() * 0.4;
            const out = girth * (2.2 + random() * 1.4);
            s.tube([v3(Math.cos(a) * girth * 0.4, girth * 2.6, Math.sin(a) * girth * 0.4), v3(Math.cos(a) * out * 0.55, girth * 0.7, Math.sin(a) * out * 0.55), v3(Math.cos(a) * out, -0.15, Math.sin(a) * out)],
                [girth * 0.42, girth * 0.3, girth * 0.08], level === 0 ? 6 : 3, o.bark);
        }
    }
    const center = v3(bendX, height - depth * 0.15, bendZ);
    const low = height - depth;
    const high = height + depth * 0.7;
    const spots = [];
    const ends = [];
    for (let i = 0; i < limbs; i++) {
        const a = i * 2.4 + random() * 0.8;
        const t = 0.62 + 0.36 * (i / limbs) + (random() - 0.5) * 0.05;
        const from = topAt(Math.min(0.98, t));
        const length = reach * (0.62 + random() * 0.45) * (1.12 - (i / limbs) * 0.4);
        const middle = v3(from.x + Math.cos(a) * length * 0.55, from.y + length * 0.2 + random(), from.z + Math.sin(a) * length * 0.55);
        const end = v3(from.x + Math.cos(a) * length, from.y + length * (0.3 + random() * 0.25), from.z + Math.sin(a) * length);
        const thick = girth * (0.34 - 0.1 * (i / limbs));
        if (level === 0) {
            s.tube([from, middle, end], [thick, thick * 0.62, thick * 0.2], 5, o.bark);
            for (const side of [-1, 1]) {
                const b = a + side * (0.6 + random() * 0.5);
                const tip = v3(middle.x + Math.cos(b) * length * 0.5, middle.y + length * 0.22, middle.z + Math.sin(b) * length * 0.5);
                s.tube([middle, tip], [thick * 0.42, thick * 0.1], 4, o.bark);
                spots.push({x: tip.x, y: tip.y, z: tip.z, r: reach * 0.36});
            }
        } else {
            if (level === 1 && i % 2 === 0) {
                s.tube([from, end], [thick, thick * 0.3], 3, o.bark);
            }
            const b = a + 0.8;
            spots.push({x: middle.x + Math.cos(b) * length * 0.4, y: middle.y + length * 0.2, z: middle.z + Math.sin(b) * length * 0.4, r: reach * 0.36});
        }
        spots.push({x: end.x, y: end.y, z: end.z, r: reach * 0.42});
        ends.push(end);
    }
    spots.push({x: center.x, y: height + depth * 0.25, z: center.z, r: reach * 0.5});
    const cardSize = reach * 0.62;
    if (level === 0) {
        for (const spot of spots) {
            leafCards(s, random, spot, 6, cardSize, o.leaf, o.tints, center, low, high);
        }
        for (let i = 0; i < (o.vines || 0); i++) {
            const e = ends[i % ends.length];
            const rope = [];
            const down = Math.max(1, e.y * (0.4 + random() * 0.45));
            for (let k = 0; k <= 5; k++) {
                const t = k / 5;
                rope.push(v3(e.x + Math.sin(t * 5 + i) * 0.14, e.y - down * t, e.z + Math.cos(t * 4 + i) * 0.14));
            }
            s.tube(rope, rope.map(() => 0.028), 3, REGION.barkDark);
        }
    } else if (level === 1) {
        for (const spot of spots) {
            leafCards(s, random, spot, 2, cardSize * 1.55, o.leaf, o.tints, center, low, high);
        }
    } else {
        leafCards(s, random, {x: center.x, y: height + depth * 0.1, z: center.z, r: reach * 0.8}, 7, reach * 1.35, o.leaf, o.tints, center, low, high);
    }
    return s;
}

const TREE_KINDS = [
    {height: 25, girth: 0.82, reach: 9, depth: 5, limbs: 8, roots: true, vines: 4, bark: REGION.barkDark, leaf: REGION.leaves, tints: [color('#d8e6c0'), color('#c2d6a8'), color('#e4e6b8')]},
    {height: 20, girth: 0.66, reach: 7.5, depth: 5, limbs: 7, roots: true, vines: 3, bark: REGION.barkTree, leaf: REGION.leavesB, tints: [color('#ffffff'), color('#e8f2d4'), color('#f4f0c8')]},
    {height: 15, girth: 0.46, reach: 5.4, depth: 4, limbs: 6, vines: 1, bark: REGION.barkTree, leaf: REGION.leaves, tints: [color('#c8dcae'), color('#b6cc9c'), color('#d4dcaa')]},
    {height: 12, girth: 0.38, reach: 4.6, depth: 3.4, limbs: 6, bark: REGION.barkDark, leaf: REGION.leavesB, tints: [color('#ffffff'), color('#eaf0d0')]},
    {height: 8, girth: 0.22, reach: 2.9, depth: 2.4, limbs: 5, bark: REGION.barkTree, leaf: REGION.leaves, tints: [color('#d4e2b4'), color('#c0d4a4')]},
    {height: 6, girth: 0.16, reach: 2.4, depth: 2, limbs: 4, bark: REGION.barkDark, leaf: REGION.leavesB, tints: [color('#ffffff'), color('#e0ecc8')]}
];
// How far a trunk blocks the way, and how far its shade falls, for each kind
const TREE_SOLID = [1.05, 0.85, 0.55, 0.46, 0.28, 0.22];

const BUILDERS = {
    palm(random, level = 0) {
        const s = new Shape();
        const height = 8.5 + random() * 4;
        const leanX = (random() - 0.5) * 4;
        const leanZ = (random() - 0.5) * 4;
        const path = [];
        const radii = [];
        const rings = [9, 3, 1][level];
        for (let i = 0; i <= rings; i++) {
            const t = i / rings;
            path.push(v3(leanX * t * t, height * t, leanZ * t * t));
            radii.push(0.17 + 0.1 * (1 - t) ** 2 + (i === 0 ? 0.1 : 0));
        }
        s.tube(path, radii, [8, 5, 3][level], REGION.barkPalm, WHITE, height / 2.4);
        const top = path[rings];
        const greens = [color('#ffffff'), color('#eef2c8'), color('#f6efb4')];
        const count = [18, 11, 7][level];
        for (let i = 0; i < count; i++) {
            const angle = i * 2.4 + random() * 0.5;
            const upper = i % 3 === 0;
            const length = 3.6 + random() * 1.8;
            const rise = upper ? 2.2 + random() * 0.8 : 0.9 + random() * 0.6;
            const droop = upper ? 2.8 + random() : 3 + random() * 1.3;
            const tint = greens[i % 3];
            if (level === 0) {
                archedFrond(s, top, angle, length, 1.7, rise, droop, REGION.frond, tint, 6);
            } else {
                frond(s, top, angle, length, 1.9, rise, droop, REGION.frond, tint, level === 1 ? 3 : 2);
            }
        }
        if (level === 0) {
            const old = color('#b09a68');
            for (let i = 0; i < 4; i++) {
                archedFrond(s, top, i * 1.7 + random(), 2.8, 1.3, -0.2, 3.2, REGION.frond, old, 4);
            }
        }
        if (level < 2) {
            const brown = color('#4a3a22');
            for (let i = 0; i < (level === 0 ? 6 : 3); i++) {
                s.blob(top.x + Math.cos(i * 2.1) * 0.28, top.y - 0.28 - (i % 2) * 0.12, top.z + Math.sin(i * 2.1) * 0.28, 0.16, 0.19, 0.16, brown, REGION.plain, 6, 4);
            }
        }
        return s;
    },
    tree(random, level = 0, variant = 0) {
        return broadleaf(random, level, TREE_KINDS[variant % TREE_KINDS.length]);
    },
    mango(random, level = 0) {
        const s = broadleaf(random, level, {height: 7, girth: 0.3, reach: 4.2, depth: 2.6, limbs: 6, bark: REGION.barkTree, leaf: REGION.leavesB, tints: [color('#f0f4d8'), color('#ffffff')]});
        if (level < 2) {
            const fruit = color('#ef9a2c');
            const fruits = level === 0 ? 16 : 6;
            for (let i = 0; i < fruits; i++) {
                const a = random() * 6.3;
                const r = 1.2 + random() * 2.2;
                s.blob(Math.cos(a) * r, 4.9 + random() * 1.6, Math.sin(a) * r, 0.11, 0.15, 0.11, fruit, REGION.plain, 6, 4);
            }
        }
        return s;
    },
    mangrove(random, level = 0) {
        const s = broadleaf(random, level, {height: 6 + random() * 2.5, girth: 0.24, reach: 3.4, depth: 2.2, limbs: 5, bark: REGION.barkDark, leaf: REGION.leaves, tints: [color('#b4c698'), color('#a6bc8c')]});
        if (level < 2) {
            const legs = level === 0 ? 8 : 4;
            for (let i = 0; i < legs; i++) {
                const a = i / legs * 6.28 + random() * 0.4;
                s.tube([v3(Math.cos(a) * 1.7, -0.7, Math.sin(a) * 1.7), v3(Math.cos(a) * 0.9, 0.9, Math.sin(a) * 0.9), v3(0, 1.9, 0)], [0.08, 0.07, 0.11], level === 0 ? 5 : 3, REGION.barkDark);
            }
        }
        return s;
    },
    bush(random) {
        const s = new Shape();
        const tints = [color('#ffffff'), color('#eaf2d0'), color('#d6e4bc')];
        leafCrown(s, random, v3(0, 0.75, 0), 1, 0.7, 1, 11, 1.4, random() < 0.5 ? REGION.leaves : REGION.leavesB, tints);
        return s;
    },
    berry(random) {
        const s = new Shape();
        leafCrown(s, random, v3(0, 0.7, 0), 0.9, 0.62, 0.9, 10, 1.3, REGION.berry, [WHITE]);
        return s;
    },
    fern(random) {
        const s = new Shape();
        const tints = [color('#f4f8dc'), color('#ffffff'), color('#dce8c0')];
        for (let i = 0; i < 11; i++) {
            frond(s, v3(0, 0.03, 0), i * 2.4 + random() * 0.4, 0.9 + random() * 0.8, 0.5 + random() * 0.2, 0.75 + random() * 0.5, 0.75 + random() * 0.5, REGION.fern, tints[i % 3], 4);
        }
        return s;
    },
    bigleaf(random) {
        const s = new Shape();
        const tints = [color('#ffffff'), color('#e4eed2'), color('#f0f0d0')];
        const stem = color('#7a8c50');
        for (let i = 0; i < 8; i++) {
            const a = i * 2.4 + random() * 0.5;
            const reach = 0.45 + random() * 0.6;
            const tip = v3(Math.cos(a) * reach, 0.8 + random() * 0.8, Math.sin(a) * reach);
            s.tube([v3(0, 0, 0), v3(Math.cos(a) * reach * 0.4, tip.y * 0.7, Math.sin(a) * reach * 0.4), tip], [0.02, 0.016, 0.012], 3, REGION.plain, stem);
            frond(s, tip, a, 0.85 + random() * 0.35, 0.72 + random() * 0.25, 0.14, 0.42, REGION.bigleaf, tints[i % 3], 3);
        }
        return s;
    },
    fiber() {
        const s = new Shape();
        s.cross(1.5, 1.2, REGION.grass, color('#f2eeb0'));
        s.cross(1.2, 1, REGION.grass, color('#e6e8a8'), 0.7);
        return s;
    },
    banana(random) {
        const s = new Shape();
        const height = 2.4 + random();
        s.tube([v3(0, 0, 0), v3(0, height, 0)], [0.19, 0.11], 7, REGION.bamboo, color('#c9d09a'));
        const top = v3(0, height, 0);
        for (let i = 0; i < 9; i++) {
            frond(s, top, i * 2.4 + random() * 0.4, 2.3 + random() * 0.7, 0.95, 0.9 + random() * 0.5, 1.5, REGION.banana, WHITE, 5);
        }
        const yellow = color('#d9c544');
        for (let i = 0; i < 12; i++) {
            const a = i * 0.9;
            s.blob(Math.cos(a) * 0.2, height - 0.5 - i * 0.05, Math.sin(a) * 0.2, 0.05, 0.16, 0.05, yellow, REGION.plain, 5, 4);
        }
        return s;
    },
    bamboo(random, level = 0) {
        const s = new Shape();
        const stalks = [13, 7, 4][level];
        const leaves = [color('#ffffff'), color('#eef4c8')];
        for (let i = 0; i < stalks; i++) {
            const a = random() * 6.3;
            const r = random() * 1.2;
            const x = Math.cos(a) * r;
            const z = Math.sin(a) * r;
            const height = 7 + random() * 6;
            const leanX = (random() - 0.5) * 2.4;
            const leanZ = (random() - 0.5) * 2.4;
            s.tube([v3(x, 0, z), v3(x + leanX * 0.3, height * 0.5, z + leanZ * 0.3), v3(x + leanX, height, z + leanZ)], [0.065, 0.055, 0.03], [5, 4, 3][level], REGION.bamboo, WHITE, height / 1.8);
            const center = v3(x + leanX * 0.8, height * 0.82, z + leanZ * 0.8);
            leafCrown(s, random, center, 1.1, height * 0.2, 1.1, [5, 2, 1][level], [1.9, 2.8, 4.2][level], REGION.bambooLeaf, leaves);
        }
        return s;
    },
    boulder(random, level, variant = 0) {
        const s = new Shape();
        s.rock(0, 0.4, 0, 1.15 + random() * 0.6, 0.8 + random() * 0.5, 1.05 + random() * 0.6, variant === 2 ? REGION.rockMoss : REGION.rock, random() * 1000);
        return s;
    },
    ore(random) {
        const s = new Shape();
        s.rock(0, 0.45, 0, 1, 0.85, 0.95, REGION.ore, random() * 1000);
        return s;
    },
    gold(random) {
        const s = new Shape();
        s.rock(0, 0.4, 0, 0.8, 0.7, 0.8, REGION.ore, random() * 1000, 12, 8, color('#fff0a0'));
        return s;
    },
    crystal(random) {
        const s = new Shape();
        const glow = color('#b8f4ff');
        for (let i = 0; i < 5; i++) {
            const a = random() * 6.3;
            s.at(Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3, a, 1, (random() - 0.5) * 0.6, (random() - 0.5) * 0.6);
            s.tube([v3(0, 0, 0), v3(0, 0.6 + random() * 0.8, 0), v3(0, 1 + random() * 0.8, 0)], [0.1, 0.1, 0.005], 5, REGION.plain, glow);
        }
        s.at();
        return s;
    },
    stone(random) {
        const s = new Shape();
        s.rock(0, 0.07, 0, 0.21, 0.13, 0.17, REGION.rock, random() * 1000, 8, 5);
        return s;
    },
    branch(random) {
        const s = new Shape();
        const a = random() * 6.3;
        const dx = Math.cos(a);
        const dz = Math.sin(a);
        s.tube([v3(-dx * 0.7, 0.06, -dz * 0.7), v3(0, 0.09, 0), v3(dx * 0.75, 0.05, dz * 0.75)], [0.05, 0.04, 0.02], 5, REGION.barkTree);
        s.tube([v3(dx * 0.1, 0.09, dz * 0.1), v3(dx * 0.45 - dz * 0.35, 0.12, dz * 0.45 + dx * 0.35)], [0.03, 0.012], 4, REGION.barkTree);
        return s;
    },
    coconut() {
        const s = new Shape();
        s.blob(0, 0.15, 0, 0.17, 0.15, 0.2, color('#e0b483'), REGION.barkPalm, 10, 8);
        return s;
    },
    mushroom(random) {
        const s = new Shape();
        for (let i = 0; i < 3; i++) {
            const x = (random() - 0.5) * 0.5;
            const z = (random() - 0.5) * 0.5;
            s.tube([v3(x, 0, z), v3(x, 0.2, z)], [0.035, 0.03], 5, REGION.plain, color('#ece4cc'));
            s.blob(x, 0.22, z, 0.13, 0.07, 0.13, color('#b5432c'), REGION.plain, 7, 4);
        }
        return s;
    },
    herb() {
        const s = new Shape();
        s.cross(0.7, 0.8, REGION.flower, color('#e8f4c8'));
        return s;
    },
    flowers() {
        const s = new Shape();
        s.cross(0.65, 0.9, REGION.flower);
        return s;
    },
    coral(random) {
        const s = new Shape();
        const tints = [color('#ff8b73'), color('#ffb15e'), color('#e070d0'), color('#ff6f91'), color('#7fd6c0')];
        s.cross(1.1, 1.3, REGION.coral, tints[Math.floor(random() * 5)]);
        s.rock((random() - 0.5) * 0.8, 0.18, (random() - 0.5) * 0.8, 0.5, 0.34, 0.45, REGION.rock, random() * 1000, 9, 6, tints[Math.floor(random() * 5)]);
        return s;
    },
    kelp() {
        const s = new Shape();
        s.cross(3.2, 1.2, REGION.kelp);
        return s;
    },
    stump() {
        const s = new Shape();
        s.tube([v3(0, 0, 0), v3(0, 0.55, 0)], [0.46, 0.36], 9, REGION.barkTree);
        s.blob(0, 0.55, 0, 0.36, 0.02, 0.36, color('#caa778'), REGION.plain, 9, 2);
        return s;
    }
};

// The large plants are redrawn around the player: close ones in detail, far ones with few cards. Only what can be seen is drawn.
const REACH = {low: [22, 90, 420], medium: [42, 150, 640], high: [64, 220, 900]};

class Forest {
    constructor(G) {
        this.G = G;
        this.kinds = [];
        this.at = new THREE.Vector3(1e9, 0, 0);
        this.facing = new THREE.Vector3(1, 0, 0);
        this.now = new THREE.Vector3();
        this.dirty = true;
        this.detail = 1;
    }

    // Too slow: draws fewer trees in detail. False when that can't go lower.
    lessDetail() {
        if (this.detail <= 0.5) {
            return false;
        }
        this.detail -= 0.17;
        this.dirty = true;
        return true;
    }

    addKind(name, geometries) {
        const kind = {name, geometries, items: [], meshes: [], spec: SPECIES[name]};
        this.kinds.push(kind);
        return kind;
    }

    finish() {
        const {G} = this;
        for (const kind of this.kinds) {
            if (!kind.items.length) {
                continue;
            }
            kind.meshes = kind.geometries.map((geometry, level) => {
                const mesh = new THREE.InstancedMesh(geometry, G.art.flora, kind.items.length);
                mesh.setColorAt(0, new THREE.Color(1, 1, 1));
                mesh.frustumCulled = false;
                mesh.castShadow = level === 0 && G.quality !== 'low';
                mesh.count = 0;
                G.scene.add(mesh);
                return mesh;
            });
        }
    }

    crowns() {
        const out = [];
        for (const kind of this.kinds) {
            for (const item of kind.items) {
                out.push({x: item.x, z: item.z, r: kind.crown * item.scale});
            }
        }
        return out;
    }

    update() {
        const {G} = this;
        const camera = G.camera.position;
        G.camera.getWorldDirection(this.now);
        const moved = Math.hypot(camera.x - this.at.x, camera.z - this.at.z);
        if (!this.dirty && moved < 7 && this.now.x * this.facing.x + this.now.z * this.facing.z > 0.92) {
            return;
        }
        this.dirty = false;
        this.at.copy(camera);
        this.facing.copy(this.now);
        const length = Math.max(0.001, Math.hypot(this.now.x, this.now.z));
        const fx = this.now.x / length;
        const fz = this.now.z / length;
        const [nearest, middlest, far] = REACH[G.quality];
        const near = nearest * this.detail;
        const middle = middlest * this.detail;
        for (const kind of this.kinds) {
            if (!kind.meshes.length) {
                continue;
            }
            const counts = [0, 0, 0];
            const [m0, m1, m2] = kind.meshes;
            const meshes = [m0, m1, m2];
            for (const item of kind.items) {
                if (item.thing.hidden && !kind.spec.keepsStanding) {
                    continue;
                }
                const dx = item.x - camera.x;
                const dz = item.z - camera.z;
                const d = Math.hypot(dx, dz);
                if (d > far || d > 34 && (dx * fx + dz * fz) / d < -0.1) {
                    continue;
                }
                const level = d < near ? 0 : d < middle ? 1 : 2;
                const n = counts[level]++;
                meshes[level].instanceMatrix.array.set(item.matrix, n * 16);
                meshes[level].instanceColor.array.set(item.color, n * 3);
            }
            meshes.forEach((mesh, level) => {
                mesh.count = counts[level];
                mesh.instanceMatrix.needsUpdate = true;
                mesh.instanceColor.needsUpdate = true;
            });
        }
    }
}

const land = (...biomes) => (b, h) => biomes.includes(b) && h > 0.25;
const under = (a, b) => (biome, h) => h < a && h > b && (biome === SEA || biome === LAGOON);

// n: how many. gap: at least so far from other large things. far: drawn up to this distance. keep: stops other large things.
// gives: what taking it brings. tool: what it takes. hits: how many strokes. back: days until it is back.
const SPECIES = {
    palm: {n: 1100, gap: 6, far: 900, big: true, forest: true, shadow: true, solid: 0.34, reach: 2.6, variants: 4, crown: 4, verb: 'Chop', label: 'palm tree', tool: 'axe', hits: 5, gives: {log: 3, leaf: 4, coconut: 2}, back: 9, falls: true,
        where: (b, h, x, z, r) => (b === BEACH && h > 0.8 && r < 0.55) || (b === ISLET) || (b === MEADOW && r < 0.03) || (b === JUNGLE && r < 0.06)},
    tree: {n: 6500, gap: 3.5, far: 900, big: true, forest: true, shadow: true, solid: 0.55, reach: 2.8, variants: TREE_KINDS.length, crown: 7, verb: 'Chop', label: 'tree', tool: 'axe', hits: 8, gives: {log: 6, branch: 3, leaf: 4}, back: 12, falls: true,
        where: (b, h, x, z, r) => b === JUNGLE || b === MEADOW && r < 0.045 || b === ISLET && r < 0.25},
    mango: {n: 50, gap: 8, far: 700, big: true, forest: true, shadow: true, solid: 0.4, reach: 3, variants: 2, crown: 5, verb: 'Pick', label: 'mangoes', gives: {mango: 2}, back: 2, keepsStanding: true,
        where: land(JUNGLE, MEADOW)},
    mangrove: {n: 300, gap: 5, far: 700, big: true, forest: true, shadow: true, solid: 0.9, reach: 2.8, variants: 3, crown: 4, verb: 'Chop', label: 'mangrove', tool: 'axe', hits: 5, gives: {log: 3, branch: 2}, back: 10,  falls: true,
        where: (b, h) => b === SWAMP && h > -0.3},
    bamboo: {n: 130, gap: 5, far: 600, big: true, forest: true, shadow: true, solid: 0.9, reach: 3, variants: 3, crown: 3, verb: 'Cut', label: 'bamboo', tool: 'knife|axe', hits: 2, gives: {bamboo: 4, leaf: 1}, back: 6,
        where: (b, h, x, z) => (b === JUNGLE || b === MEADOW) && fbm(x * 0.02 + 90, z * 0.02) > 0.5},
    banana: {n: 280, gap: 4, far: 240, reach: 2.2, variants: 3, verb: 'Pick', label: 'bananas', gives: {banana: 3}, seed: ['seed_banana', 0.4], back: 3, keepsStanding: true,
        where: land(JUNGLE, MEADOW)},
    bush: {n: 1900, far: 170, reach: 2, variants: 4, verb: 'Pick', label: 'leaves', gives: {leaf: 3}, back: 2, keepsStanding: true, where: land(JUNGLE, MEADOW, ISLET, SWAMP)},
    berry: {n: 110, far: 170, reach: 2, variants: 2, verb: 'Pick', label: 'berries', gives: {berries: 3}, seed: ['seed_berry', 0.3], back: 3, emptyVariant: 'bush', where: land(JUNGLE, MEADOW, ISLET)},
    fern: {n: 3400, far: 120, variants: 3, decor: true, where: land(JUNGLE, SWAMP)},
    bigleaf: {n: 2600, far: 120, variants: 3, decor: true, where: land(JUNGLE, SWAMP)},
    flowers: {n: 320, far: 90, variants: 1, decor: true, where: land(MEADOW, ISLET)},
    fiber: {n: 340, far: 130, reach: 1.9, variants: 1, verb: 'Gather', label: 'plant fiber', gives: {fiber: 3}, back: 2, where: land(MEADOW, JUNGLE, SWAMP, ISLET)},
    boulder: {n: 190, gap: 3.5, far: 340, big: true, shadow: true, solid: 1, reach: 2.8, variants: 3, verb: 'Break', label: 'boulder', tool: 'pick', hits: 4, gives: {stone: 6}, back: 8,
        where: (b, h) => b !== SEA && b !== RIVER && b !== LAGOON && b !== CAVE && h > 0.3},
    ore: {n: 30, gap: 5, far: 260, glow: true, big: true, shadow: true, solid: 1, reach: 2.8, variants: 2, verb: 'Mine', label: 'rusty rock', tool: 'pick', hits: 5, gives: {iron_ore: 3, stone: 2}, back: 10,
        where: (b, h) => b === JUNGLE && h > 5},
    stone: {n: 420, far: 95, reach: 1.9, variants: 3, verb: 'Pick up', label: 'stone', gives: {stone: 1}, back: 4, where: (b, h) => b !== SEA && b !== LAGOON && b !== RIVER && b !== CAVE && h > 0.2},
    branch: {n: 440, far: 95, reach: 1.9, variants: 3, verb: 'Pick up', label: 'branch', gives: {branch: 1}, back: 3, where: land(JUNGLE, MEADOW, BEACH, ISLET, SWAMP)},
    coconut: {n: 190, far: 95, reach: 1.8, variants: 1, verb: 'Pick up', label: 'coconut', gives: {coconut: 1}, back: 5, where: (b, h, x, z, r) => (b === BEACH && h > 0.7 || b === ISLET)},
    mushroom: {n: 70, far: 80, reach: 1.7, variants: 2, verb: 'Pick', label: 'mushrooms', gives: {mushroom: 2}, back: 4, where: land(JUNGLE, SWAMP)},
    herb: {n: 60, far: 90, reach: 1.7, variants: 1, verb: 'Pick', label: 'healing herb', gives: {herb: 1}, seed: ['seed_herb', 0.3], back: 5, where: land(MEADOW, JUNGLE, SWAMP)},
    coral: {n: 520, far: 90, variants: 4, decor: true, where: (b, h, x, z) => under(-3.2, -18)(b, h) && fbm(x * 0.03, z * 0.03 + 40) > 0.46},
    kelp: {n: 340, far: 80, variants: 1, decor: true, where: under(-4.6, -18)}
};

export class Flora {
    constructor(G) {
        this.G = G;
        this.meshes = [];
        this.byId = new Map();
        this.gone = {}; // id -> the clock when it is back
        this.grassAt = {x: 1e9, z: 1e9};
        this.fallers = [];
        this.bigGrid = new Map();
        this.forest = new Forest(G);
        this.place();
    }

    isClear(x, z, margin) {
        for (const place of Object.values(PLACES)) {
            if (place.r && Math.hypot(x - place.x, z - place.z) < place.r + margin) {
                return false;
            }
        }
        const spawn = PLACES.spawn;
        if (Math.hypot(x - spawn.x, z - spawn.z) < 7) {
            return false;
        }
        for (const cave of CAVES) {
            const dx = x - cave.x;
            const dz = z - cave.z;
            const distance = Math.hypot(dx, dz);
            if (distance < cave.r + 6 + margin) {
                return false;
            }
            const along = dx * Math.cos(cave.dir) + dz * Math.sin(cave.dir);
            const side = Math.abs(-dx * Math.sin(cave.dir) + dz * Math.cos(cave.dir));
            if (along > 0 && along < cave.r + 26 && side < 7) {
                return false;
            }
        }
        return true;
    }

    bigFree(x, z, gap) {
        const ix = Math.floor(x / 12);
        const iz = Math.floor(z / 12);
        for (let a = ix - 1; a <= ix + 1; a++) {
            for (let b = iz - 1; b <= iz + 1; b++) {
                for (const other of this.bigGrid.get(a * 4096 + b) || []) {
                    if (Math.hypot(x - other.x, z - other.z) < gap) {
                        return false;
                    }
                }
            }
        }
        return true;
    }

    place() {
        const {world, art, space, scene} = this.G;
        for (const [name, spec] of Object.entries(SPECIES)) {
            // Each its own numbers: adding one kind doesn't move the others
            const random = rng(20261 + name.charCodeAt(0) * 131 + name.charCodeAt(1) * 17 + name.length);
            const shapes = [];
            const kinds = [];
            for (let v = 0; v < spec.variants; v++) {
                const seed = name.length * 977 + v * 31;
                if (spec.forest) {
                    const kind = this.forest.addKind(name, [0, 1, 2].map(level => BUILDERS[name](rng(seed), level, v).geometry()));
                    kind.crown = name === 'tree' ? TREE_KINDS[v].reach : spec.crown;
                    kinds.push(kind);
                } else {
                    shapes.push(BUILDERS[name](rng(seed), 0, v).geometry());
                }
            }
            const groups = new Map();
            let placed = 0;
            const attempts = spec.n * 26;
            const fullCount = this.G.quality === 'low' && spec.decor ? Math.floor(spec.n * 0.35) : spec.n;
            for (let a = 0; a < attempts && placed < fullCount; a++) {
                const x = (random() - 0.5) * WORLD_SIZE;
                const z = (random() - 0.5) * WORLD_SIZE;
                const roll = random();
                const h = world.heightAt(x, z);
                const biome = world.biomeAt(x, z);
                if (!spec.where(biome, h, x, z, roll)) {
                    continue;
                }
                if (h > 0 && riverDistance(x, z).d < 8 && name !== 'bush' && name !== 'fern') {
                    continue;
                }
                if (!this.isClear(x, z, spec.big ? 3 : 0)) {
                    continue;
                }
                if (spec.big && !this.bigFree(x, z, spec.gap)) {
                    continue;
                }
                if (spec.big) {
                    const key = Math.floor(x / 12) * 4096 + Math.floor(z / 12);
                    if (!this.bigGrid.has(key)) {
                        this.bigGrid.set(key, []);
                    }
                    this.bigGrid.get(key).push({x, z});
                }
                const id = name + placed;
                const variant = Math.floor(random() * spec.variants);
                const sector = Math.floor((x + WORLD_SIZE / 2) / SECTOR) + Math.floor((z + WORLD_SIZE / 2) / SECTOR) * SECTORS;
                const key = variant + ':' + sector;
                if (!spec.forest && !groups.has(key)) {
                    groups.set(key, {variant, items: []});
                }
                const scale = spec.big || spec.variants === 1 ? 0.8 + random() * 0.45 : 0.8 + random() * 0.6;
                const item = {id, name, x, y: h, z, scale, turn: random() * Math.PI * 2, tint: 0.84 + random() * 0.26};
                if (!spec.forest) {
                    groups.get(key).items.push(item);
                }
                placed++;
                if (!spec.decor) {
                    const thing = {id, species: name, x, y: h, z, turn: item.turn, reach: spec.reach, scale, left: spec.hits || 1, menu: plantMenu};
                    item.thing = thing;
                    space.addThing(thing);
                    this.byId.set(id, thing);
                    if (spec.solid) {
                        const solid = name === 'tree' ? TREE_SOLID[variant] : spec.solid;
                        thing.block = space.addBlock({x, z, r: solid * scale});
                        thing.reach += solid * scale;
                    }
                }
                if (spec.forest) {
                    const kind = kinds[variant];
                    forestDummy.position.set(x, h - 0.05, z);
                    forestDummy.rotation.set(0, item.turn, 0);
                    forestDummy.scale.setScalar(scale);
                    forestDummy.updateMatrix();
                    const warm = (random() - 0.5) * 0.1;
                    kind.items.push({
                        x, z, scale, thing: item.thing, matrix: Float32Array.from(forestDummy.matrix.elements),
                        color: [item.tint + warm, item.tint, item.tint * (0.92 + (item.tint - 0.84) * 0.3) - warm]
                    });
                    item.thing.fallGeometry = kind.geometries[0];
                    item.thing.inForest = true;
                }
            }
            const dummy = new THREE.Object3D();
            const tint = new THREE.Color();
            for (const {variant, items} of groups.values()) {
                const mesh = new THREE.InstancedMesh(shapes[variant], spec.glow ? art.oreGlow : art.flora, items.length);
                let cx = 0;
                let cz = 0;
                items.forEach((item, i) => {
                    dummy.position.set(item.x, item.y - (spec.big ? 0.05 : 0), item.z);
                    dummy.rotation.set(0, item.turn, 0);
                    dummy.scale.setScalar(item.scale);
                    dummy.updateMatrix();
                    mesh.setMatrixAt(i, dummy.matrix);
                    tint.setRGB(item.tint, item.tint, item.tint * (0.92 + (item.tint - 0.84) * 0.3));
                    mesh.setColorAt(i, tint);
                    cx += item.x;
                    cz += item.z;
                    if (item.thing) {
                        item.thing.mesh = mesh;
                        item.thing.index = i;
                        item.thing.matrix = dummy.matrix.clone();
                    }
                });
                mesh.instanceMatrix.needsUpdate = true;
                mesh.computeBoundingSphere();
                mesh.castShadow = Boolean(spec.shadow) && this.G.quality !== 'low';
                mesh.receiveShadow = false;
                mesh.userData = {far: spec.far, x: cx / items.length, z: cz / items.length};
                scene.add(mesh);
                this.meshes.push(mesh);
            }
        }

        this.forest.finish();
        const stump = BUILDERS.stump().geometry();
        this.stumps = new THREE.InstancedMesh(stump, art.solid, 260);
        this.stumps.count = 0;
        this.stumps.frustumCulled = false;
        this.stumpIndex = new Map();
        scene.add(this.stumps);

        // The grass near the player is made as they walk
        this.grassCount = {low: 0, medium: 2400, high: 5000}[this.G.quality];
        if (this.grassCount) {
            const s = new Shape();
            s.cross(0.62, 1.05, REGION.grass, color('#c8cca0'));
            const tints = s.color;
            const heights = s.position;
            for (let i = 0; i < heights.length / 3; i++) {
                const f = heights[i * 3 + 1] < 0.1 ? 0.62 : 1;
                tints[i * 3] *= f;
                tints[i * 3 + 1] *= f;
                tints[i * 3 + 2] *= f;
            }
            this.grass = new THREE.InstancedMesh(s.geometry(), art.flora, this.grassCount);
            this.grass.frustumCulled = false;
            scene.add(this.grass);
        }
    }

    // Puts back what has grown again, and hides what is gone. Also after loading a game.
    refresh() {
        const clock = this.G.clock;
        for (const [id, until] of Object.entries(this.gone)) {
            if (until <= clock) {
                delete this.gone[id];
                this.show(id);
            }
        }
    }

    apply(gone) {
        this.gone = {...gone};
        for (const id of Object.keys(this.gone)) {
            this.hide(id);
        }
        this.refresh();
    }

    hide(id) {
        const thing = this.byId.get(id);
        if (!thing || thing.hidden) {
            return;
        }
        const spec = SPECIES[thing.species];
        thing.hidden = true;
        thing.left = spec.hits || 1;
        if (!spec.keepsStanding && !spec.emptyVariant) {
            this.setVisible(thing, false);
            if (thing.block) {
                this.G.space.removeBlock(thing.block);
            }
            if (spec.falls) {
                this.addStump(thing);
            }
        }
        if (!spec.keepsStanding) {
            this.G.space.removeThing(thing);
        }
        if (spec.emptyVariant) {
            this.G.space.removeThing(thing);
            this.setVisible(thing, false);
        }
    }

    setVisible(thing, visible) {
        if (thing.inForest) {
            this.forest.dirty = true;
            return;
        }
        thing.mesh.setMatrixAt(thing.index, visible ? thing.matrix : ZERO);
        thing.mesh.instanceMatrix.needsUpdate = true;
    }

    show(id) {
        const thing = this.byId.get(id);
        if (!thing || !thing.hidden) {
            return;
        }
        const spec = SPECIES[thing.species];
        thing.hidden = false;
        thing.left = spec.hits || 1;
        if (!spec.keepsStanding) {
            this.setVisible(thing, true);
            if (thing.block) {
                this.G.space.addBlock(thing.block);
            }
            this.G.space.addThing(thing);
            if (spec.falls) {
                this.removeStump(thing);
            }
        }
    }

    addStump(thing) {
        if (this.stumps.count >= 260) {
            return;
        }
        const i = this.stumps.count++;
        const dummy = new THREE.Object3D();
        dummy.position.set(thing.x, thing.y, thing.z);
        dummy.scale.setScalar(thing.scale);
        dummy.updateMatrix();
        this.stumps.setMatrixAt(i, dummy.matrix);
        this.stumps.instanceMatrix.needsUpdate = true;
        this.stumpIndex.set(thing.id, i);
    }

    removeStump(thing) {
        const i = this.stumpIndex.get(thing.id);
        if (i !== undefined) {
            this.stumps.setMatrixAt(i, ZERO);
            this.stumps.instanceMatrix.needsUpdate = true;
            this.stumpIndex.delete(thing.id);
        }
    }

    // Taking it: returns true when something came of it
    harvest(thing) {
        const {G} = this;
        const spec = SPECIES[thing.species];
        if (spec.tool) {
            this.dropOnGround(thing, spec);
        } else {
            for (const [id, n] of Object.entries(spec.gives)) {
                G.give(id, n);
            }
        }
        if (spec.seed && Math.random() < spec.seed[1]) {
            G.give(spec.seed[0], 1);
        }
        if (spec.falls) {
            this.fell(thing);
        }
        this.gone[thing.id] = G.clock + spec.back * 24;
        this.hide(thing.id);
        G.audio.play(spec.tool ? 'crash' : 'pick');
    }

    // What was cut lies on the ground, to be picked up: along a fallen tree, or around a broken rock
    dropOnGround(thing, spec) {
        const {G} = this;
        const from = G.player.position;
        const away = Math.atan2(thing.z - from.z, thing.x - from.x);
        Object.entries(spec.gives).forEach(([id, n], i) => {
            const distance = spec.falls ? 2.6 + i * 2.1 : 1.5;
            const angle = spec.falls ? away + (i % 2 ? 0.35 : -0.2) : away + Math.PI + (i - 0.5) * 1.1;
            let x = thing.x + Math.cos(angle) * distance;
            let z = thing.z + Math.sin(angle) * distance;
            if (G.world.heightAt(x, z) < 0.1) {
                x = thing.x + Math.cos(away + Math.PI) * (1 + i * 0.6);
                z = thing.z + Math.sin(away + Math.PI) * (1 + i * 0.6);
            }
            G.drops.add(id, n, x, z, {delay: spec.falls ? 1.3 : 0});
        });
    }

    // A tree falls over before it is gone
    fell(thing) {
        const mesh = new THREE.Mesh(thing.fallGeometry || thing.mesh.geometry, this.G.art.flora);
        mesh.position.set(thing.x, thing.y, thing.z);
        mesh.scale.setScalar(thing.scale);
        mesh.rotation.y = thing.turn;
        const from = this.G.player.position;
        const away = Math.atan2(thing.x - from.x, thing.z - from.z);
        const holder = new THREE.Group();
        holder.position.set(thing.x, thing.y, thing.z);
        holder.rotation.order = 'YXZ';
        holder.rotation.y = away;
        mesh.position.set(0, 0, 0);
        holder.add(mesh);
        this.G.scene.add(holder);
        this.fallers.push({holder, t: 0});
    }

    update(dt) {
        const {G} = this;
        const camera = G.camera.position;
        // Nothing of this can be seen from below the ground
        if (!G.player.underground) {
            this.forest.update();
        }
        this.tick = (this.tick || 0) + dt;
        if (this.tick > 0.4) {
            this.tick = 0;
            for (const mesh of this.meshes) {
                const u = mesh.userData;
                mesh.visible = Math.hypot(camera.x - u.x, camera.z - u.z) < u.far + SECTOR * 0.72;
            }
        }
        if (this.grass && Math.hypot(camera.x - this.grassAt.x, camera.z - this.grassAt.z) > 7) {
            this.sowGrass(camera);
        }
        for (let i = this.fallers.length - 1; i >= 0; i--) {
            const f = this.fallers[i];
            f.t += dt;
            f.holder.rotation.x = Math.min(1.5, f.t * f.t * 1.4);
            if (f.t > 1.5) {
                f.holder.position.y -= dt * 2.5;
            }
            if (f.t > 3) {
                G.scene.remove(f.holder);
                this.fallers.splice(i, 1);
            }
        }
    }

    sowGrass(camera) {
        const {world} = this.G;
        this.grassAt = {x: camera.x, z: camera.z};
        const step = this.G.quality === 'high' ? 1.5 : 2;
        const dummy = new THREE.Object3D();
        const reach = 40;
        let n = 0;
        const cx = Math.round(camera.x / step);
        const cz = Math.round(camera.z / step);
        const cells = Math.ceil(reach / step);
        for (let j = -cells; j <= cells; j++) {
            for (let i = -cells; i <= cells; i++) {
                if (i * i + j * j > cells * cells || n >= this.grassCount) {
                    continue;
                }
                const gx = cx + i;
                const gz = cz + j;
                // The same tuft in the same place each time
                const r1 = fract(Math.sin(gx * 12.98 + gz * 78.23) * 43758.5);
                const r2 = fract(Math.sin(gx * 39.34 + gz * 11.13) * 24634.6);
                const x = (gx + r1 - 0.5) * step;
                const z = (gz + r2 - 0.5) * step;
                const biome = world.biomeAt(x, z);
                const dense = biome === MEADOW || biome === ISLET ? 0.9 : biome === JUNGLE ? 0.16 : biome === SWAMP ? 0.2 : 0;
                if (r1 * 0.7 + r2 * 0.3 > dense) {
                    continue;
                }
                const h = world.heightAt(x, z);
                if (h < 0.15) {
                    continue;
                }
                dummy.position.set(x, h, z);
                dummy.rotation.y = r2 * 6.3;
                dummy.scale.setScalar(0.65 + r1 * 0.75);
                dummy.updateMatrix();
                this.grass.setMatrixAt(n++, dummy.matrix);
            }
        }
        this.grass.count = n;
        this.grass.instanceMatrix.needsUpdate = true;
    }
}

const forestDummy = new THREE.Object3D();
const fract = x => x - Math.floor(x);
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

const ARTICLES = {branch: 'Pick up branch', stone: 'Pick up stone', coconut: 'Pick up coconut'};

function plantMenu(G, thing) {
    const spec = SPECIES[thing.species];
    if (thing.hidden && spec.keepsStanding) {
        return [];
    }
    const label = ARTICLES[thing.species] || spec.verb + ' ' + spec.label;
    if (!spec.tool) {
        return [{label, run: () => G.player.reachOut(() => G.flora.harvest(thing))}];
    }
    const types = spec.tool.split('|');
    const has = types.some(type => G.findTool(type));
    if (!has) {
        return [{label: label + ' (needs ' + (spec.tool === 'pick' ? 'a pickaxe' : spec.tool === 'knife|axe' ? 'a knife or axe' : 'an axe') + ')', disabled: true}];
    }
    return [{
        label: thing.left < spec.hits ? label + ' (' + thing.left + ' left)' : label,
        run: () => {
            G.holdTool(types);
            const power = G.heldPower();
            G.player.swing(() => {
                thing.left -= power;
                G.wearHeld(1);
                G.audio.play(spec.tool === 'pick' ? 'mine' : 'chop');
                G.effects.chips(thing.x, thing.y + 1.2, thing.z, spec.tool === 'pick' ? '#8c8880' : '#b89468');
                G.you.energy = Math.max(0, G.you.energy - 2);
                if (thing.left <= 0) {
                    G.flora.harvest(thing);
                }
            });
        }
    }];
}

