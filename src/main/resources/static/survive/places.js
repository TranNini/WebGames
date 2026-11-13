// The places to find: the wreck, huts, camps, caves, shipwrecks and islets, with what is hidden in them and the story they tell.
import * as THREE from './lib/three.module.min.js';
import {CAVES, ISLETS, PLACES, noise, rng} from './world.js';
import {keepNormals} from './art.js';
import {REGION, Shape, WHITE, color, v3} from './art.js';

export const NOTES = {
    flightLog: {title: 'Flight log, LI 418', text: 'MAYDAY sent 14:12, no answer. Severe air currents. A tornado where the forecast showed nothing. The bulletin says storm season closes this sector to all aircraft for 30 days. After that the coast guard searches from the air by helicopter. If anybody reads this: they will not see one person on a beach. Lay a big SOS in stones on open sand.'},
    keller1: {title: 'Keller expedition, page 12', text: 'June 1962. We built the station in the middle of the island. Prof. Keller is certain of it: the storms here do not pass over the island, they start around it. The instruments agree with him. The crew does not like it.'},
    keller2: {title: 'Keller expedition, page 31', text: 'The rain comes without warning and the nights are colder than they should be at this latitude. Marsh hut finished. Two crocodiles under the floor, which we leave in peace. We found old stone markers in the swamp, older than any chart of this place.'},
    keller3: {title: 'Keller expedition, page 47', text: 'Someone was here long before us. In the east cave there are marks on the wall, one spiral for each great storm, hundreds of them. The spirals are a month apart in the good years. The natives called this place something that Keller translates as "the eye".'},
    keller4: {title: 'Keller expedition, page 58', text: 'The supply ship did not come. The Marisol lies on the north beach with her back broken, and the second ship went down off the west shore with most of our gold samples. I locked the instruments and the good tools in the station chest. The key is with the camp at the river.'},
    keller5: {title: 'Keller expedition, last page', text: 'Keller has gone out to the islets to measure the eye from the outside. He took the boat and the last of the medicine. If you read this, do what we could not: stay alive until the season turns. Nobody flies near here until it does. Then make yourself seen.'},
    deserter: {title: 'A torn page', text: 'They are all mad with their storms. I took my share of the gold before the ship went down and buried it where the lagoon runs out to the sea, on the sand on the far side. Nobody will look on a beach. I marked it with an X and I need a shovel, damn it.'},
    keller6: {title: 'Keller, on Rock Islet', text: 'From out here you see it. The whole island sits inside a slow turning of the air, and the storms feed from it. It does not hate us. It simply does not know we are here. There is gold in the rock here, and I have no use for it. I will wait for a boat that will not come.'}
};

const wood = () => REGION.wood;

const place = (s, x, y, z, turn = 0, scale = 1, tiltX = 0, tiltZ = 0) => s.at(x, y, z, turn, scale, tiltX, tiltZ);

// A simple wooden hut in local space, its door towards +z. Used by old huts here and by the hut you can build.
export function woodHut(s, w, d, h, {broken = false, roofTint = WHITE, wallTint = WHITE} = {}) {
    const t = 0.18;
    s.box(0, 0.1, 0, w + 0.3, 0.2, d + 0.3, wood(), wallTint);
    s.box(0, h / 2, -d / 2, w, h, t, wood(), wallTint);
    s.box(-w / 2, h / 2, 0, t, h, d, wood(), wallTint);
    if (broken) {
        s.box(w / 2, h * 0.35, d / 4, t, h * 0.7, d / 2, wood(), wallTint);
    } else {
        s.box(w / 2, h / 2, 0, t, h, d, wood(), wallTint);
    }
    const doorHalf = 0.8;
    const side = (w / 2 - doorHalf);
    s.box(-(doorHalf + side / 2), h / 2, d / 2, side, h, t, wood(), wallTint);
    s.box(doorHalf + side / 2, h / 2, d / 2, side, h, t, wood(), wallTint);
    s.box(0, h - 0.25, d / 2, doorHalf * 2, 0.5, t, wood(), wallTint);
    const peak = h + w * 0.34;
    const over = 0.5;
    const hw = w / 2 + over;
    const hd = d / 2 + over;
    s.card(v3(-hw, h - 0.14, hd), v3(0, peak, hd), v3(0, peak, -hd), v3(-hw, h - 0.14, -hd), REGION.thatch, roofTint);
    if (!broken) {
        s.card(v3(hw, h - 0.14, -hd), v3(0, peak, -hd), v3(0, peak, hd), v3(hw, h - 0.14, hd), REGION.thatch, roofTint);
    }
    // The triangles under the roof
    const g = s.position.length / 3;
    s.vertex(-w / 2, h, d / 2, 0, 0, 1, 0, 0, wood(), wallTint);
    s.vertex(w / 2, h, d / 2, 0, 0, 1, 1, 0, wood(), wallTint);
    s.vertex(0, peak, d / 2, 0, 0, 1, 0.5, 1, wood(), wallTint);
    s.vertex(-w / 2, h, -d / 2, 0, 0, -1, 0, 0, wood(), wallTint);
    s.vertex(w / 2, h, -d / 2, 0, 0, -1, 1, 0, wood(), wallTint);
    s.vertex(0, peak, -d / 2, 0, 0, -1, 0.5, 1, wood(), wallTint);
    s.index.push(g, g + 1, g + 2, g + 3, g + 5, g + 4);
}

export function hutBlocks(x, z, turn, w, d, h, y = 0, keepBroken = false) {
    const t = 0.13;
    const doorHalf = 0.8;
    const side = w / 2 - doorHalf;
    const local = [
        [0, -d / 2, w / 2, t],
        [-w / 2, 0, t, d / 2],
        [-(doorHalf + side / 2), d / 2, side / 2, t],
        [doorHalf + side / 2, d / 2, side / 2, t]
    ];
    if (keepBroken) {
        local.push([w / 2, d / 4, t, d / 4]);
    } else {
        local.push([w / 2, 0, t, d / 2]);
    }
    const c = Math.cos(turn);
    const a = Math.sin(turn);
    return local.map(([lx, lz, hx, hz]) => ({x: x + lx * c + lz * a, z: z - lx * a + lz * c, hx, hz, turn, top: y + h + 2}));
}

function crate(s, x, y, z, size = 0.7, tint = WHITE, turn = 0.3) {
    place(s, x, y, z, turn);
    s.box(0, size / 2, 0, size * 1.1, size, size, wood(), tint);
    s.at();
}

function fuselage(s, length, radius, tint = WHITE) {
    // A long tube with jagged ends, seen from the outside as painted metal
    const sides = 14;
    const rows = 8;
    const random = rng(length * 13);
    const start = s.position.length / 3;
    for (let j = 0; j <= rows; j++) {
        for (let i = 0; i <= sides; i++) {
            const a = i / sides * Math.PI * 2;
            const jag = j === 0 || j === rows ? (random() - 0.5) * 1.5 : 0;
            const z = (j / rows - 0.5) * length + jag;
            const nx = Math.cos(a);
            const ny = Math.sin(a);
            s.vertex(nx * radius, ny * radius, z, nx, ny, 0, j % 2, Math.max(0, Math.min(1, 0.42 + 0.55 * ny)), REGION.metal, tint);
        }
    }
    for (let j = 0; j < rows; j++) {
        for (let i = 0; i < sides; i++) {
            const a = start + j * (sides + 1) + i;
            const b = a + sides + 1;
            s.index.push(a, b, a + 1, a + 1, b, b + 1);
        }
    }
}

function wingPiece(s, length, chord) {
    const start = s.position.length / 3;
    const grey = color('#c5c7c4');
    // The part of the skin without windows
    s.vertex(0, 0, -chord / 2, 0, 1, 0, 0, 0.03, REGION.metal, grey);
    s.vertex(0, 0, chord / 2, 0, 1, 0, 1, 0.03, REGION.metal, grey);
    s.vertex(length, 0.3, chord / 2 - 0.6, 0, 1, 0, 1, 0.32, REGION.metal, grey);
    s.vertex(length, 0.3, -chord / 2 + 1.1, 0, 1, 0, 0, 0.32, REGION.metal, grey);
    s.index.push(start, start + 1, start + 2, start, start + 2, start + 3);
    s.at(length * 0.35, -0.55, 0, 0);
}

export class Places {
    constructor(G) {
        this.G = G;
        this.known = new Set();
        this.containers = new Map();
        this.ores = new Map();
        this.build();
    }

    groundAt(x, z) {
        return this.G.world.heightAt(x, z);
    }

    addMesh(shape, material = this.G.art.solid, cast = true) {
        const mesh = new THREE.Mesh(shape.geometry(), material);
        mesh.castShadow = cast && this.G.quality !== 'low';
        mesh.receiveShadow = true;
        this.G.scene.add(mesh);
        return mesh;
    }

    // Opens once. kind: suitcase, crate or chest. items: what is inside. note: a page to read. needsKey: locked. buried: needs a shovel.
    container(id, x, z, {y, kind = 'chest', label, items = {}, note = null, needsKey = false, buried = false, turn = 0, reach = 2.6, deep = false}) {
        const G = this.G;
        const base = y !== undefined ? y : this.groundAt(x, z);
        const box = new Shape();
        const lid = new Shape();
        const dark = color('#7a5c3c');
        if (kind === 'suitcase') {
            box.box(0, 0.16, 0, 0.75, 0.32, 0.5, REGION.cloth, color('#47608a'));
            box.box(0, 0.36, 0, 0.26, 0.05, 0.05, REGION.plain, color('#22282e'));
        } else if (kind === 'crate') {
            box.box(0, 0.32, 0, 0.9, 0.64, 0.7, wood(), WHITE);
        } else if (kind === 'aid') {
            box.box(0, 0.16, 0, 0.6, 0.32, 0.42, REGION.plain, color('#d33a2c'));
            box.box(0, 0.33, 0, 0.3, 0.02, 0.09, REGION.plain, WHITE);
            box.box(0, 0.33, 0, 0.09, 0.02, 0.3, REGION.plain, WHITE);
        } else if (kind === 'paper') {
            box.box(0, 0.02, 0, 0.3, 0.03, 0.4, REGION.plain, color('#dcd4b8'));
        } else {
            box.box(0, 0.26, 0, 1.05, 0.52, 0.65, wood(), dark);
            box.box(0, 0.26, 0, 1.09, 0.08, 0.69, REGION.plain, color('#433e36'));
            lid.box(0, 0.09, 0.32, 1.05, 0.18, 0.65, wood(), dark);
        }
        const group = new THREE.Group();
        group.position.set(x, base, z);
        group.rotation.y = turn;
        const body = new THREE.Mesh(box.geometry(), G.art.solid);
        body.castShadow = true;
        group.add(body);
        let lidMesh = null;
        if (lid.position.length) {
            lidMesh = new THREE.Mesh(lid.geometry(), G.art.solid);
            lidMesh.position.set(0, 0.52, -0.32);
            group.add(lidMesh);
        }
        if (buried) {
            group.visible = false;
        }
        group.userData.below = deep;
        G.scene.add(group);
        const open = () => {
            this.opened(id);
            for (const [item, n] of Object.entries(items)) {
                G.give(item, n);
            }
            if (note) {
                G.readNote(note);
            }
            G.audio.play('chest');
        };
        const thing = {
            id, x, y: base + 0.3, z, reach, deep,
            menu: () => {
                if (G.saved.opened[id]) {
                    return [];
                }
                if (buried && !G.findTool('shovel')) {
                    return [{label: 'Something is buried here (needs a shovel)', disabled: true}];
                }
                if (needsKey && !G.has('key')) {
                    return [{label: label + ' (locked)', disabled: true}];
                }
                return [{
                    label,
                    run: () => {
                        if (buried) {
                            G.holdTool(['shovel']);
                            G.player.swing(() => {
                                G.audio.play('dig');
                                open();
                            });
                        } else {
                            if (needsKey) {
                                G.takeItem('key');
                            }
                            G.player.reachOut(open);
                        }
                    }
                }];
            }
        };
        G.space.addThing(thing);
        this.containers.set(id, {group, lidMesh, thing, kind, buried});
        return thing;
    }

    opened(id) {
        this.G.saved.opened[id] = true;
        this.showOpened(id);
    }

    showOpened(id) {
        const c = this.containers.get(id);
        if (!c) {
            return;
        }
        if (c.lidMesh) {
            c.lidMesh.rotation.x = -1.9;
        }
        if (c.kind === 'paper') {
            c.group.visible = false;
        }
        if (c.buried) {
            c.group.visible = true;
        }
        this.G.space.removeThing(c.thing);
    }

    // A rock to break for ore, in a cave or on an islet
    oreRock(id, x, z, kind = 'iron', y, deep = false) {
        const G = this.G;
        const base = y !== undefined ? y : this.groundAt(x, z);
        const s = new Shape();
        const random = rng(id.length * 91 + x * 3);
        if (kind === 'crystal') {
            for (let i = 0; i < 6; i++) {
                const a = random() * 6.3;
                s.at(Math.cos(a) * 0.32, 0, Math.sin(a) * 0.32, a, 1, (random() - 0.5) * 0.7, (random() - 0.5) * 0.7);
                s.tube([v3(0, 0, 0), v3(0, 0.5 + random() * 0.7, 0), v3(0, 0.9 + random() * 0.9, 0)], [0.12, 0.11, 0.005], 5, REGION.plain, color('#9ff0ff'));
            }
            s.at();
        } else {
            s.rock(0, 0.45, 0, 1, 0.82, 0.95, REGION.ore, id.length + 3, 16, 10, kind === 'gold' ? color('#ffe680') : WHITE);
        }
        // Ore glows in the dark
        const material = kind === 'crystal' ? this.glowMat() : G.art.oreGlow;
        const mesh = new THREE.Mesh(s.geometry(), material);
        mesh.position.set(x, base, z);
        mesh.castShadow = true;
        mesh.userData.below = deep;
        G.scene.add(mesh);
        const block = G.space.addBlock({x, z, r: 0.8, deep});
        const thing = {
            id, x, y: base + 0.6, z, reach: 2.8, deep, left: kind === 'gold' ? 6 : kind === 'crystal' ? 3 : 5,
            menu: () => {
                if (!G.findTool('pick')) {
                    return [{label: 'Needs a pickaxe', disabled: true}];
                }
                if (kind === 'gold' && !G.findTool('pick', 2)) {
                    return [{label: 'Gold ore (needs an iron pickaxe)', disabled: true}];
                }
                return [{
                    label: 'Mine ' + (kind === 'gold' ? 'gold ore' : kind === 'crystal' ? 'crystal' : 'iron ore'),
                    run: () => {
                        G.holdTool(['pick']);
                        const power = G.heldPower();
                        G.player.swing(() => {
                            thing.left -= power;
                            G.wearHeld(1);
                            G.audio.play('mine');
                            G.effects.chips(x, base + 0.8, z, kind === 'crystal' ? '#c8f8ff' : '#8c8880');
                            G.you.energy = Math.max(0, G.you.energy - 2);
                            if (thing.left <= 0) {
                                // It falls on the ground, toward you
                                const p = G.player.position;
                                const away = Math.max(0.1, Math.hypot(p.x - x, p.z - z));
                                const what = kind === 'iron' ? ['iron_ore', 4] : kind === 'gold' ? ['gold_ore', 3] : ['crystal', 3];
                                G.drops.add(what[0], what[1], x + (p.x - x) / away * 1.5, z + (p.z - z) / away * 1.5, {deep, y: deep ? base : undefined});
                                this.mined(id);
                            }
                        });
                    }
                }];
            }
        };
        G.space.addThing(thing);
        this.ores.set(id, {mesh, block, thing});
    }

    mined(id) {
        this.G.saved.mined[id] = true;
        this.hideOre(id);
    }

    hideOre(id) {
        const ore = this.ores.get(id);
        if (ore) {
            ore.mesh.visible = false;
            if (ore.onGone) {
                ore.onGone();
            }
            this.G.space.removeThing(ore.thing);
            this.G.space.removeBlock(ore.block);
        }
    }

    glowMat() {
        this.glow = this.glow || new THREE.MeshBasicMaterial({vertexColors: true, toneMapped: false});
        return this.glow;
    }

    applySaved() {
        for (const id of Object.keys(this.G.saved.opened)) {
            this.showOpened(id);
        }
        for (const id of Object.keys(this.G.saved.mined)) {
            this.hideOre(id);
        }
        this.known = new Set(this.G.saved.places);
    }

    build() {
        this.buildCrashSite();
        this.buildWreck();
        this.buildTail();
        this.buildHuts();
        this.buildCamps();
        this.buildStation();
        this.buildShips();
        this.buildCaves();
        this.buildIslets();
        const buried = PLACES.buried;
        this.container('buried', buried.x, buried.z, {kind: 'chest', label: 'Dig here', buried: true, items: {gold_coins: 25, spear_iron: 1}, reach: 3});
        const x = new Shape();
        const y = this.groundAt(buried.x, buried.z) + 0.03;
        x.card(v3(-1, 0, -0.2), v3(1, 0, -0.2), v3(1, 0, 0.2), v3(-1, 0, 0.2), REGION.plain, color('#6c4a2c'), v3(0, 1, 0));
        x.card(v3(-0.2, 0.01, -1), v3(0.2, 0.01, -1), v3(0.2, 0.01, 1), v3(-0.2, 0.01, 1), REGION.plain, color('#6c4a2c'), v3(0, 1, 0));
        const mark = this.addMesh(x, this.G.art.solid, false);
        mark.position.set(buried.x, y, buried.z);
        mark.rotation.y = 0.6;
    }

    buildCrashSite() {
        const spawn = PLACES.spawn;
        const random = rng(55);
        const s = new Shape();
        // Bits of metal, seats and bags along the sand
        for (let i = 0; i < 16; i++) {
            const a = random() * 6.3;
            const r = 5 + random() * 22;
            const x = spawn.x + Math.cos(a) * r;
            const z = spawn.z + Math.sin(a) * r;
            const y = this.groundAt(x, z);
            place(s, x, y + 0.06, z, random() * 6.3, 1, (random() - 0.5) * 0.5, (random() - 0.5) * 0.5);
            const w = 0.8 + random() * 1.6;
            const d = 0.4 + random();
            s.card(v3(-w, 0, -d), v3(w, 0.1, -d), v3(w, 0.25, d), v3(-w, 0, d), REGION.metal);
        }
        const seat = color('#4a6ea8');
        for (const [dx, dz, tilt] of [[6, 3, 1.3], [-8, 5, -1.2], [12, -2, 0.5]]) {
            const x = spawn.x + dx;
            const z = spawn.z + dz;
            place(s, x, this.groundAt(x, z) + 0.3, z, dx, 1, 0, tilt);
            s.box(0, 0.25, 0, 0.5, 0.14, 0.5, REGION.cloth, seat);
            s.box(0, 0.65, -0.24, 0.5, 0.75, 0.13, REGION.cloth, seat);
        }
        s.at();
        this.addMesh(s);
        const around = (dx, dz) => ({x: spawn.x + dx, z: spawn.z + dz});
        let p = around(3, -3);
        this.container('case1', p.x, p.z, {kind: 'suitcase', label: 'Open suitcase', items: {biscuits: 2, water_bottle: 1}, turn: 0.4});
        p = around(-7, -4);
        this.container('case2', p.x, p.z, {kind: 'suitcase', label: 'Open suitcase', items: {bandage: 1, fiber: 3, water_bottle: 1}, turn: 2});
        p = around(-14, 6);
        this.container('case3', p.x, p.z, {kind: 'suitcase', label: 'Open suitcase', items: {biscuits: 1, rope: 1}, turn: 1});
    }

    buildWreck() {
        const {x, z} = PLACES.wreck;
        const y = this.groundAt(x, z);
        const turn = 0.8;
        const G = this.G;
        const s = new Shape();
        place(s, x, y + 1.75, z, turn, 1, 0.05, 0.09);
        fuselage(s, 15, 2.1, color('#e4e2dc'));
        place(s, x, y + 0.55, z, turn);
        s.box(0, 0, 0, 3.6, 0.1, 14.6, REGION.wood, color('#7c7c80'));
        const seat = color('#4a6ea8');
        const c = Math.cos(turn);
        const a = Math.sin(turn);
        for (let row = -3; row <= 2; row += 1) {
            for (const sideX of [-1.2, 1.2]) {
                const lz = row * 1.6;
                place(s, x + sideX * c + lz * a, y + 0.6, z - sideX * a + lz * c, turn + (row === 2 ? 0.4 : 0));
                s.box(0, 0.22, 0, 1, 0.14, 0.5, REGION.cloth, seat);
                s.box(0, 0.65, 0.24, 1, 0.75, 0.13, REGION.cloth, seat);
            }
        }
        // A wing and an engine lie further on
        const wx = x + 12;
        const wz = z - 8;
        place(s, wx, this.groundAt(wx, wz) + 0.6, wz, 2.2, 1, 0.1, 0.15);
        wingPiece(s, 11, 3.8);
        s.tube([v3(0, 0, -1.2), v3(0, 0, 1.2)], [0.75, 0.6], 10, REGION.plain, color('#8b8c8d'));
        s.at();
        const mesh = this.addMesh(s);
        mesh.renderOrder = 1;

        // The walls of the tube, open at both torn ends, with a floor to walk on
        const wall = (lx, lz, hx, hz) => G.space.addBlock({x: x + lx * c + lz * a, z: z - lx * a + lz * c, hx, hz, turn, top: y + 5});
        wall(-2.05, 0, 0.14, 7.5);
        wall(2.05, 0, 0.14, 7.5);
        G.space.addFloor({x, z, hx: 1.95, hz: 7.4, turn, y: y + 0.6});
        G.space.addRoof({x, z, hx: 2, hz: 7.4, turn});
        G.space.addBlock({x: wx, z: wz, r: 1.1});
        const at = lz => ({x: x + lz * a, z: z + lz * c});
        let p = at(5.8);
        this.container('wreck-aid', p.x, p.z, {y: y + 0.6, kind: 'aid', label: 'Open first aid kit', items: {medicine: 2, bandage: 3}, turn});
        p = at(-1);
        this.container('wreck-kit', p.x, p.z, {y: y + 0.6, kind: 'crate', label: 'Open emergency kit', items: {knife_stone: 1, torch: 2, rope: 3, flask: 1}, turn});
        p = at(-6);
        this.container('wreck-log', p.x, p.z, {y: y + 0.6, kind: 'suitcase', label: 'Take flight bag', items: {pilot_jacket: 1, biscuits: 2}, note: 'flightLog', turn});
    }

    buildTail() {
        const {x, z} = PLACES.tail;
        const y = this.groundAt(x, z);
        const s = new Shape();
        place(s, x, y + 1.3, z, 0.4, 1, -0.2, 0.25);
        fuselage(s, 7, 1.5, color('#b7c2bc'));
        s.card(v3(0, 1.4, 1), v3(0, 1.4, 3.4), v3(0, 5.2, 4.6), v3(0, 5.2, 3.1), REGION.plain, color('#1e5a8a'));
        s.at();
        this.addMesh(s);
        this.G.space.addBlock({x, z, r: 1.7});
        this.container('tail-box', x + 2.6, z + 1, {kind: 'crate', label: 'Open cargo crate', items: {ingot: 3, medicine: 1, rope: 3}, reach: 3.4});
    }

    buildHuts() {
        const G = this.G;
        const meadow = PLACES.hutMeadow;
        const swamp = PLACES.hutSwamp;
        for (const [hut, turn, w, d, broken, id] of [[meadow, 2.4, 5, 5, true, 'hut1'], [swamp, 0.7, 4.4, 4.4, false, 'hut2']]) {
            const y = Math.max(this.groundAt(hut.x, hut.z), 0.3) + (id === 'hut2' ? 0.25 : 0);
            const s = new Shape();
            const grey = color('#a59c8c');
            place(s, hut.x, y, hut.z, turn);
            woodHut(s, w, d, 2.6, {broken, roofTint: color('#9a9478'), wallTint: grey});
            // Bed and table inside
            place(s, hut.x, y + 0.2, hut.z, turn);
            s.box(-w / 2 + 0.75, 0.25, -d / 2 + 1.2, 1, 0.3, 2, REGION.cloth, color('#7d7460'));
            s.box(w / 2 - 0.8, 0.45, -d / 2 + 0.8, 1, 0.08, 0.8, wood(), grey);
            s.at();
            this.addMesh(s);
            for (const block of hutBlocks(hut.x, hut.z, turn, w, d, 2.6, y, broken)) {
                G.space.addBlock(block);
            }
            G.space.addFloor({x: hut.x, z: hut.z, hx: w / 2, hz: d / 2, turn, y: y + 0.2});
            if (!broken) {
                G.space.addRoof({x: hut.x, z: hut.z, hx: w / 2, hz: d / 2, turn});
            }
            const c = Math.cos(turn);
            const a = Math.sin(turn);
            const lx = -w / 2 + 0.75;
            const lz = -d / 2 + 1.2;
            G.space.addThing({
                x: hut.x + lx * c + lz * a, y: y + 0.6, z: hut.z - lx * a + lz * c, reach: 2.4,
                menu: () => [{label: 'Sleep in old bed', run: () => G.sleep(0.75)}]
            });
            const lx2 = w / 2 - 0.8;
            const lz2 = -d / 2 + 0.8;
            const px = hut.x + lx2 * c + lz2 * a;
            const pz = hut.z - lx2 * a + lz2 * c;
            if (id === 'hut1') {
                this.container('hut1-page', px, pz, {y: y + 0.72, kind: 'paper', label: 'Read journal page', note: 'keller1', items: {rope: 2, stone: 2}, turn});
            } else {
                this.container('hut2-page', px, pz, {y: y + 0.72, kind: 'paper', label: 'Read journal page', note: 'keller2', items: {medicine: 1, herb: 2}, turn});
            }
        }
    }

    tent(s, x, z, turn) {
        const y = this.groundAt(x, z);
        place(s, x, y, z, turn);
        const fabric = color('#6f6f4e');
        s.card(v3(-1.6, 0, 1.4), v3(0, 1.8, 1.4), v3(0, 1.8, -1.4), v3(-1.6, 0, -1.4), REGION.cloth, fabric);
        s.card(v3(1.6, 0, -1.4), v3(0, 1.8, -1.4), v3(0, 1.8, 1.4), v3(1.6, 0, 1.4), REGION.cloth, fabric);
        s.at();
    }

    ring(s, x, z) {
        const y = this.groundAt(x, z);
        for (let i = 0; i < 7; i++) {
            const a = i / 7 * 6.3;
            place(s, x + Math.cos(a) * 0.65, y, z + Math.sin(a) * 0.65);
            s.blob(0, 0.08, 0, 0.17, 0.12, 0.17, WHITE, REGION.rock, 6, 4, 0.2, i);
        }
        place(s, x, y + 0.08, z, 0.7);
        s.tube([v3(-0.5, 0, 0), v3(0.5, 0.1, 0)], [0.06, 0.05], 4, REGION.plain, color('#231d18'));
        s.at();
    }

    buildCamps() {
        const G = this.G;
        for (const [camp, id, tentTurn, items, note] of [
            [PLACES.campNorth, 'camp1', 0.5, {key: 1, arrow: 6, flask: 1}, 'keller4'],
            [PLACES.campWest, 'camp2', 2.1, {spear: 1, rope: 4, medicine: 1}, 'deserter']
        ]) {
            const s = new Shape();
            this.tent(s, camp.x - 3, camp.z - 2, tentTurn);
            this.ring(s, camp.x + 1, camp.z + 1.5);
            const y = this.groundAt(camp.x + 3.5, camp.z - 1);
            crate(s, camp.x + 3.5, y, camp.z - 1);
            crate(s, camp.x + 4.4, this.groundAt(camp.x + 4.4, camp.z - 0.2), camp.z - 0.2, 0.55, color('#c0b090'), 1);
            this.addMesh(s);
            G.space.addBlock({x: camp.x - 3, z: camp.z - 2, r: 1.5});
            G.space.addBlock({x: camp.x + 3.8, z: camp.z - 0.6, r: 0.8});
            this.container(id + '-box', camp.x - 0.6, camp.z - 1.2, {kind: 'chest', label: 'Open chest', items, note, turn: 0.8});
        }
    }

    buildStation() {
        const G = this.G;
        const {x, z} = PLACES.station;
        const y = this.groundAt(x, z);
        const s = new Shape();
        const concrete = color('#a3a095');
        place(s, x, y, z, 1.1);
        woodHut(s, 6, 5, 2.7, {wallTint: concrete, roofTint: color('#8d8970')});
        place(s, x + 7, y, z + 3);
        s.tube([v3(0, 0, 0), v3(0, 12, 0)], [0.12, 0.05], 5, REGION.plain, color('#6f6a62'));
        s.tube([v3(-1.3, 11.2, 0), v3(1.3, 11.2, 0)], [0.05, 0.05], 4, REGION.plain, color('#6f6a62'));
        for (const dx of [-1.3, 1.3]) {
            s.blob(dx, 11.2, 0, 0.3, 0.3, 0.3, color('#5e6a70'), REGION.plain, 6, 4);
        }
        s.box(0, 0.25, -0.6, 1, 0.5, 0.5, REGION.plain, color('#3f4c48'));
        s.at();
        this.addMesh(s);
        for (const block of hutBlocks(x, z, 1.1, 6, 5, 2.7, y)) {
            G.space.addBlock(block);
        }
        G.space.addRoof({x, z, hx: 3, hz: 2.5, turn: 1.1});
        G.space.addFloor({x, z, hx: 3, hz: 2.5, turn: 1.1, y: y + 0.2});
        G.space.addBlock({x: x + 7, z: z + 3, r: 0.6});
        const c = Math.cos(1.1);
        const a = Math.sin(1.1);
        this.container('station-chest', x - 1.8 * a * -1 + 0.8 * c, z - 0.8 * a - 1.8 * c, {
            y: y + 0.2, kind: 'chest', label: 'Open station chest', needsKey: true,
            items: {axe_iron: 1, pick_iron: 1, gold_coins: 15, medicine: 2, ingot: 2}, note: 'keller5', turn: 1.1
        });
    }

    shipHull(s, length, width, height) {
        const rows = 10;
        const start = s.position.length / 3;
        const sides = 8;
        for (let j = 0; j <= rows; j++) {
            const t = j / rows;
            const taper = Math.sin(t * Math.PI) ** 0.55;
            for (let i = 0; i <= sides; i++) {
                const a = Math.PI + i / sides * Math.PI;
                const nx = Math.cos(a);
                const ny = Math.sin(a);
                s.vertex(nx * width * taper, height + ny * height * (0.5 + 0.5 * taper), (t - 0.5) * length, nx, ny, 0, j % 2, i / sides, REGION.hull, WHITE);
            }
        }
        for (let j = 0; j < rows; j++) {
            for (let i = 0; i < sides; i++) {
                const a = start + j * (sides + 1) + i;
                const b = a + sides + 1;
                s.index.push(a, b, a + 1, a + 1, b, b + 1);
            }
        }
        s.tube([v3(0, 1, 2), v3(0.1, height + 8, 2)], [0.16, 0.08], 6, REGION.barkTree);
        s.tube([v3(-2.4, height + 5.4, 2), v3(2.6, height + 5.6, 2)], [0.07, 0.05], 5, REGION.barkTree);
    }

    buildShips() {
        const G = this.G;
        const beach = PLACES.wreckBeach;
        let y = this.groundAt(beach.x, beach.z);
        const s = new Shape();
        place(s, beach.x, y - 0.3, beach.z, 1.0, 1, 0.08, 0.32);
        this.shipHull(s, 22, 4.2, 3);
        s.at();
        this.addMesh(s);
        const c = Math.cos(1);
        const a = Math.sin(1);
        for (const [lx, hz] of [[-3.4, 9], [3.4, 9]]) {
            G.space.addBlock({x: beach.x + lx * c, z: beach.z - lx * a, hx: 0.3, hz, turn: 1, top: y + 6});
        }
        this.container('ship1-chest', beach.x + 0.8 * a, beach.z + 0.8 * c, {kind: 'chest', label: 'Open sea chest', items: {rope: 5, ingot: 2, bandage: 2, gold_coins: 5}, turn: 1});

        const sunk = PLACES.wreckSunk;
        y = this.groundAt(sunk.x, sunk.z);
        const t = new Shape();
        place(t, sunk.x, y + 0.2, sunk.z, 2.5, 1, 0.1, -0.45);
        this.shipHull(t, 24, 4.6, 3.2);
        t.at();
        this.addMesh(t);
        this.container('ship2-chest', sunk.x + 2, sunk.z + 1.6, {kind: 'chest', label: 'Open sunken chest', items: {gold_coins: 40, gold_ore: 2, coat: 1}, reach: 3.4, turn: 2.5});
    }

    // The inside of a cave: the tunnel down and the room, in one repeating picture of rock. Lit only a little, by what glows.
    caveInside(cave) {
        const s = new Shape();
        const random = rng(cave.door.x * 11 + 3);
        const light = color('#d4cfc2');
        const dim = color('#aca89c');
        const TILE = {u0: 0, v0: 0, u1: 1, v1: 1};
        const SCALE = 1 / 6; // one picture on 6 m of rock
        const sides = 16;
        const outward = {x: Math.cos(cave.dir), z: Math.sin(cave.dir)};
        // Rings along the tunnel, a little past the door so the day can be seen from inside
        const points = [{x: cave.door.x + outward.x * 3, z: cave.door.z + outward.z * 3, y: cave.floor + 0.05, at: -3}];
        let walked = 0;
        for (let i = 0; i < cave.path.length - 1; i++) {
            const a = cave.path[i];
            const b = cave.path[i + 1];
            const length = Math.hypot(b.x - a.x, b.z - a.z);
            const steps = Math.max(2, Math.round(length / 2.2));
            for (let k = 0; k <= steps; k++) {
                const t = k / steps;
                points.push({x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, y: a.y + (b.y - a.y) * t, at: walked + length * t});
            }
            walked += length;
        }
        points.forEach((point, j) => {
            const next = points[Math.min(points.length - 1, j + 1)];
            const before = points[Math.max(0, j - 1)];
            const dx = next.x - before.x;
            const dz = next.z - before.z;
            const length = Math.max(0.01, Math.hypot(dx, dz));
            const sideX = -dz / length;
            const sideZ = dx / length;
            for (let i = 0; i <= sides; i++) {
                const a = i / sides * Math.PI * 2;
                const bump = 1 + (noise(j * 0.31 + cave.door.x, (i % sides) * 0.7) - 0.5) * 0.42;
                const across = Math.cos(a) * (cave.width + 0.9) * bump;
                const up = Math.max(0, 1.5 + Math.sin(a) * 2.5 * bump);
                const inwardX = -Math.cos(a);
                const inwardY = up === 0 ? 1 : -Math.sin(a);
                s.vertex(point.x + sideX * across, point.y + up, point.z + sideZ * across,
                    inwardX * sideX, inwardY, inwardX * sideZ, point.at * SCALE, i / sides * 3, TILE, random() < 0.5 ? light : dim);
            }
        });
        for (let j = 0; j < points.length - 1; j++) {
            for (let i = 0; i < sides; i++) {
                const p = j * (sides + 1) + i;
                const q = p + sides + 1;
                s.index.push(p, q, p + 1, p + 1, q, q + 1);
            }
        }

        // The room: a dome, with a gap where the tunnel comes in
        const {room} = cave;
        const wide = 44;
        const high = 12;
        const start = s.position.length / 3;
        const last = cave.path[cave.path.length - 1];
        const entry = Math.atan2(last.z - room.z, last.x - room.x);
        for (let j = 0; j <= high; j++) {
            const phi = j / high * Math.PI / 2;
            for (let i = 0; i <= wide; i++) {
                const a = i / wide * Math.PI * 2;
                const bump = 1 + (noise(Math.cos(a) * 2.4 + room.x * 0.1, Math.sin(a) * 2.4 + j * 0.45) - 0.5) * 0.34;
                const nx = Math.cos(a) * Math.cos(phi);
                const ny = Math.sin(phi);
                const nz = Math.sin(a) * Math.cos(phi);
                s.vertex(room.x + nx * (room.r + 1) * bump, room.y + ny * 11 * bump, room.z + nz * (room.r + 1) * bump, -nx, -ny, -nz,
                    a * (room.r + 1) * SCALE, phi * 14 * SCALE, TILE, random() < 0.5 ? light : dim);
            }
        }
        for (let j = 0; j < high; j++) {
            for (let i = 0; i < wide; i++) {
                const a = i / wide * Math.PI * 2;
                const off = Math.abs(((a - entry + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
                if (off < 0.2 && j < 4) {
                    continue;
                }
                const p = start + j * (wide + 1) + i;
                const q = p + wide + 1;
                s.index.push(p, q, p + 1, p + 1, q, q + 1);
            }
        }
        // Its floor
        const center = s.position.length / 3;
        s.vertex(room.x, room.y, room.z, 0, 1, 0, room.x * SCALE, room.z * SCALE, TILE, dim);
        for (let i = 0; i <= wide; i++) {
            const a = i / wide * Math.PI * 2;
            const x = room.x + Math.cos(a) * (room.r + 1.5);
            const z = room.z + Math.sin(a) * (room.r + 1.5);
            s.vertex(x, room.y, z, 0, 1, 0, x * SCALE, z * SCALE, TILE, dim);
        }
        for (let i = 0; i < wide; i++) {
            s.index.push(center, center + i + 2, center + i + 1);
        }
        // Stone hanging from the roof and growing from the floor
        for (let i = 0; i < 26; i++) {
            const a = random() * 6.3;
            const r = 3 + random() * (room.r - 5);
            const x = room.x + Math.cos(a) * r;
            const z = room.z + Math.sin(a) * r;
            const roof = room.y + 11 * Math.sin(Math.acos(Math.min(1, r / (room.r + 1)))) - 0.2;
            const length = 0.8 + random() * 2.4;
            s.tube([v3(x, roof, z), v3(x, roof - length * 0.5, z), v3(x, roof - length, z)], [0.32, 0.17, 0.01], 6, TILE, dim);
        }
        // A few boulders to walk around
        [[0.5, 9], [-0.6, 7], [2.8, 6]].forEach(([a, r], i) => {
            const x = room.x + Math.cos(cave.dir + a) * r;
            const z = room.z + Math.sin(cave.dir + a) * r;
            s.rock(x, room.y + 0.5, z, 1.3, 1, 1.2, TILE, i + 11, 16, 10, light);
            this.G.space.addBlock({x, z, r: 1.1, deep: true});
        });
        return s;
    }

    // What shows above the ground: rocks around a dark opening at the end of the ramp
    caveDoor(cave) {
        const G = this.G;
        const {door, dir} = cave;
        const s = new Shape();
        const along = {x: Math.cos(dir), z: Math.sin(dir)};
        const across = {x: -Math.sin(dir), z: Math.cos(dir)};
        const at = (side, out, up) => [door.x + across.x * side + along.x * out, door.y + up, door.z + across.z * side + along.z * out];
        const rocks = [[-4.3, 0, 1.1, 2.1, 2.4, 2], [4.3, 0, 1.1, 2.1, 2.5, 2], [0, -0.6, 5, 5.4, 1.6, 2.2], [-7, -1.5, 2, 3, 3, 3], [7, -1.5, 2, 3, 3, 3], [-2.4, -1, 4.2, 2.2, 1.2, 1.8], [2.6, -1, 4.2, 2.2, 1.2, 1.8]];
        rocks.forEach(([side, out, up, rx, ry, rz], i) => {
            const [x, y, z] = at(side, out, up);
            s.rock(x, y, z, rx, ry, rz, i % 2 ? REGION.rockMoss : REGION.rock, i + door.x);
        });
        this.addMesh(s);
        for (const side of [-3.9, 3.9, -6.5, 6.5]) {
            const [x, , z] = at(side, 0, 0);
            G.space.addBlock({x, z, r: 1.3});
        }
        const hole = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 5.2), new THREE.MeshBasicMaterial({color: 0x020202, fog: false}));
        const [hx, hy, hz] = at(0, -0.3, 2.3);
        hole.position.set(hx, hy, hz);
        hole.rotation.y = Math.atan2(along.x, along.z);
        G.scene.add(hole);
    }

    // The rock of a cave gets light from what glows in it
    caveMaterial(glows) {
        const material = keepNormals(new THREE.MeshLambertMaterial({map: this.G.art.ground.stone, vertexColors: true, side: THREE.DoubleSide}));
        const base = material.onBeforeCompile;
        const places = glows.map(g => new THREE.Vector4(g.x, g.y, g.z, g.power));
        const colors = glows.map(g => g.color);
        material.onBeforeCompile = shader => {
            base(shader);
            shader.uniforms.uGlowAt = {value: places};
            shader.uniforms.uGlowColor = {value: colors};
            shader.vertexShader = 'varying vec3 vRock;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvRock = position;');
            shader.fragmentShader = `varying vec3 vRock; uniform vec4 uGlowAt[${glows.length}]; uniform vec3 uGlowColor[${glows.length}];\n` +
                shader.fragmentShader.replace('#include <emissivemap_fragment>', `
                    for (int i = 0; i < ${glows.length}; i++) {
                        vec3 toGlow = vRock - uGlowAt[i].xyz;
                        totalEmissiveRadiance += diffuseColor.rgb * uGlowColor[i] * uGlowAt[i].w / (1.0 + dot(toGlow, toGlow) * 0.085);
                    }`);
        };
        material.customProgramCacheKey = () => 'caveGlow' + glows.length;
        return {material, places};
    }

    buildCaves() {
        const G = this.G;
        const IRON = new THREE.Color(1, 0.48, 0.16);
        const GOLD = new THREE.Color(1, 0.8, 0.28);
        const CRYSTAL = new THREE.Color(0.35, 0.85, 1);
        for (const cave of CAVES) {
            this.caveDoor(cave);
            const {room, dir} = cave;
            const spot = (a, r) => ({x: room.x + Math.cos(dir + a) * r, z: room.z + Math.sin(dir + a) * r});
            const y = room.y;
            const ores = [
                {id: cave.id + '-ore1', kind: 'iron', at: spot(2.2, 11)},
                {id: cave.id + '-ore2', kind: 'iron', at: spot(-2.2, 11)},
                {id: cave.id + '-crystal', kind: 'crystal', at: spot(1.2, 12)},
                {id: cave.id + '-ore3', kind: cave.id === 'cave-east' ? 'gold' : 'iron', at: spot(-1.1, 12)}
            ];
            const tint = {iron: IRON, gold: GOLD, crystal: CRYSTAL};
            const glows = ores.map(ore => ({x: ore.at.x, y: y + 1.2, z: ore.at.z, power: 2.1, color: tint[ore.kind]}));
            // Veins of ore in the tunnel's walls, so that it isn't all dark on the way down
            const veins = new Shape();
            for (let i = 1; i < cave.path.length - 1; i++) {
                const point = cave.path[i];
                const next = cave.path[i + 1];
                const length = Math.hypot(next.x - point.x, next.z - point.z);
                const side = i % 2 ? 1 : -1;
                const x = point.x + (next.x - point.x) * 0.5 - (next.z - point.z) / length * side * (cave.width + 0.3);
                const z = point.z + (next.z - point.z) * 0.5 + (next.x - point.x) / length * side * (cave.width + 0.3);
                const vy = (point.y + next.y) / 2 + 1.1;
                veins.rock(x, vy, z, 0.8, 0.65, 0.8, REGION.ore, i * 7 + 1, 10, 6, i % 2 ? WHITE : color('#ffe680'));
                glows.push({x, y: vy, z, power: 1.5, color: i % 2 ? IRON : GOLD});
            }
            const veinMesh = new THREE.Mesh(veins.geometry(), G.art.oreGlow);
            veinMesh.userData.below = true;
            G.scene.add(veinMesh);
            const {material, places} = this.caveMaterial(glows);
            const inside = new THREE.Mesh(this.caveInside(cave).geometry(), material);
            inside.userData.below = true;
            G.scene.add(inside);
            for (const ore of ores) {
                this.oreRock(ore.id, ore.at.x, ore.at.z, ore.kind, y, true);
                const glow = places[ores.indexOf(ore)];
                this.ores.get(ore.id).onGone = () => {
                    glow.w = 0;
                };
            }
            const p = spot(Math.PI, 12);
            if (cave.id === 'cave-east') {
                this.container('cave1-chest', p.x, p.z, {y, deep: true, kind: 'chest', label: 'Open old chest', items: {gold_coins: 20, crystal: 1, medicine: 1}, note: 'keller3', turn: dir});
            } else if (cave.id === 'cave-north') {
                this.container('cave2-chest', p.x, p.z, {y, deep: true, kind: 'chest', label: 'Open old chest', items: {ingot: 2, arrow: 8, torch: 2}, turn: dir});
            } else {
                this.container('cave3-chest', p.x, p.z, {y, deep: true, kind: 'chest', label: 'Open old chest', items: {gold_coins: 12, coat: 1, bandage: 2}, turn: dir});
            }
        }
    }

    buildIslets() {
        const sun = ISLETS[0];
        this.container('islet1', sun.x + 3, sun.z - 2, {kind: 'chest', label: 'Open treasure chest', items: {gold_coins: 35, medicine: 2, seed_banana: 2, seed_herb: 2}, turn: 0.4});
        const palm = ISLETS[1];
        const s = new Shape();
        const y = this.groundAt(palm.x + 8, palm.z + 3);
        place(s, palm.x + 8, y + 0.2, palm.z + 3, 0.9);
        for (let i = -2; i <= 2; i++) {
            s.tube([v3(i * 0.32, 0, -1.7), v3(i * 0.32, 0, 1.7)], [0.14, 0.14], 5, REGION.barkTree);
        }
        s.at();
        this.addMesh(s);
        this.container('islet2', palm.x + 5, palm.z + 1, {kind: 'suitcase', label: 'Open sailor\'s bag', items: {rod: 1, coat: 1, seed_berry: 3, flask: 1}, turn: 1.3});
        const rock = ISLETS[2];
        this.container('islet3', rock.x - 2, rock.z + 2, {kind: 'paper', label: 'Read Keller\'s last note', note: 'keller6', items: {gold_coins: 30}, turn: 0.3});
        this.oreRock('islet3-gold1', rock.x + 6, rock.z - 3, 'gold');
        this.oreRock('islet3-gold2', rock.x - 7, rock.z - 5, 'gold');
        this.oreRock('islet3-crystal', rock.x + 2, rock.z + 8, 'crystal');
    }

    update() {
        const {G} = this;
        const p = G.player.position;
        for (const [key, place_] of Object.entries(PLACES)) {
            if (key !== 'spawn' && !this.known.has(key) && Math.hypot(p.x - place_.x, p.z - place_.z) < (place_.r || 6) + 6) {
                if (key === 'buried' && !G.saved.notes.includes('deserter') && !G.findTool('shovel')) {
                    continue;
                }
                this.known.add(key);
                G.saved.places = [...this.known];
                G.discovered(place_.name);
            }
        }
    }
}
