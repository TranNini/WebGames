// What the player builds: their base, fires, garden, bridges, boats and the SOS sign.
import * as THREE from './lib/three.module.min.js';
import {BIOME} from './world.js';
import {BUILDS, SOS_STONES} from './items.js';
import {REGION, Shape, WHITE, color, softDot, v3} from './art.js';
import {hutBlocks, woodHut} from './places.js';

const GRID = 3;
const WALL_HEIGHT = 2.7;
const FONT = {S: ['111', '100', '111', '001', '111'], O: ['111', '101', '101', '101', '111']};
const SOS_STEP = 2.3;

// Where the stones of the SOS go, around its centre, across then deep
export function sosSlots() {
    const slots = [];
    ['S', 'O', 'S'].forEach((letter, n) => {
        FONT[letter].forEach((row, j) => {
            [...row].forEach((cell, i) => {
                if (cell === '1') {
                    slots.push({x: (n * 4 + i - 5) * SOS_STEP, z: (j - 2) * SOS_STEP});
                }
            });
        });
    });
    return slots;
}

function rotated(lx, lz, turn) {
    const c = Math.cos(turn);
    const s = Math.sin(turn);
    return {x: lx * c + lz * s, z: -lx * s + lz * c};
}

const SHAPES = {
    campfire() {
        const s = new Shape();
        for (let i = 0; i < 9; i++) {
            const a = i / 9 * 6.28;
            s.blob(Math.cos(a) * 0.72, 0.1, Math.sin(a) * 0.72, 0.2, 0.14, 0.2, WHITE, REGION.rock, 6, 4, 0.2, i + 1);
        }
        for (let i = 0; i < 4; i++) {
            const a = i * 1.57 + 0.4;
            s.tube([v3(Math.cos(a) * 0.5, 0.06, Math.sin(a) * 0.5), v3(0, 0.46, 0)], [0.07, 0.04], 5, REGION.barkTree);
        }
        return s;
    },
    workbench() {
        const s = new Shape();
        s.box(0, 0.9, 0, 1.8, 0.12, 0.9, REGION.wood);
        for (const [x, z] of [[-0.8, -0.35], [0.8, -0.35], [-0.8, 0.35], [0.8, 0.35]]) {
            s.box(x, 0.42, z, 0.12, 0.85, 0.12, REGION.wood, color('#b39878'));
        }
        s.box(0.3, 1, 0.1, 0.5, 0.06, 0.2, REGION.rock);
        s.box(-0.5, 0.99, -0.1, 0.3, 0.06, 0.1, REGION.plain, color('#59524a'));
        return s;
    },
    furnace() {
        const s = new Shape();
        s.blob(0, 0.85, 0, 0.95, 1.05, 0.95, color('#a59e92'), REGION.rock, 12, 8, 0.1, 5);
        s.tube([v3(0, 1.6, 0), v3(0, 2.6, 0)], [0.32, 0.22], 8, REGION.rock, color('#8e887e'));
        s.box(0, 0.6, 0.86, 0.6, 0.55, 0.2, REGION.plain, color('#0f0c0a'));
        return s;
    },
    chest() {
        const s = new Shape();
        s.box(0, 0.32, 0, 1.15, 0.64, 0.7, REGION.wood, color('#a8814f'));
        s.box(0, 0.4, 0.36, 0.12, 0.2, 0.04, REGION.plain, color('#39352e'));
        return s;
    },
    bed() {
        const s = new Shape();
        s.box(0, 0.2, 0, 1.1, 0.25, 2.1, REGION.wood);
        s.box(0, 0.38, 0.1, 1, 0.15, 1.85, REGION.thatch, color('#dbe3b1'));
        s.box(0, 0.5, -0.74, 0.8, 0.14, 0.42, REGION.cloth, color('#d4cdb4'));
        return s;
    },
    garden() {
        const s = new Shape();
        s.box(0, 0.05, 0, 3, 0.12, 2, REGION.plain, color('#3e2e20'));
        for (let i = 0; i < 4; i++) {
            s.box(-1.1 + i * 0.75, 0.13, 0, 0.32, 0.1, 1.85, REGION.plain, color('#4b3829'));
        }
        const edge = [[0, -1.03, 3.1, 0.08], [0, 1.03, 3.1, 0.08], [-1.53, 0, 0.08, 2.1], [1.53, 0, 0.08, 2.1]];
        for (const [x, z, sx, sz] of edge) {
            s.box(x, 0.13, z, sx, 0.26, sz, REGION.barkTree);
        }
        return s;
    },
    collector() {
        const s = new Shape();
        for (const [x, z] of [[-0.8, -0.8], [0.8, -0.8], [0.8, 0.8], [-0.8, 0.8]]) {
            s.tube([v3(x, 0, z), v3(x * 0.8, 1.2, z * 0.8)], [0.05, 0.04], 4, REGION.bamboo);
        }
        s.card(v3(-1, 1.5, -1), v3(1, 1.5, -1), v3(0.1, 0.95, 0.1), v3(-0.1, 0.95, -0.1), REGION.banana, WHITE, v3(0, 1, 0));
        s.card(v3(1, 1.5, 1), v3(-1, 1.5, 1), v3(-0.1, 0.95, 0.1), v3(0.1, 0.95, -0.1), REGION.banana, WHITE, v3(0, 1, 0));
        s.tube([v3(0, 0, 0), v3(0, 0.75, 0)], [0.28, 0.25], 8, REGION.bamboo);
        return s;
    },
    floor() {
        const s = new Shape();
        s.box(0, 0.08, 0, GRID, 0.16, GRID, REGION.wood);
        return s;
    },
    wall() {
        const s = new Shape();
        s.box(0, WALL_HEIGHT / 2, 0, GRID, WALL_HEIGHT, 0.18, REGION.wood);
        return s;
    },
    doorway() {
        const s = new Shape();
        const side = (GRID - 1.2) / 2;
        s.box(-(0.6 + side / 2), WALL_HEIGHT / 2, 0, side, WALL_HEIGHT, 0.18, REGION.wood);
        s.box(0.6 + side / 2, WALL_HEIGHT / 2, 0, side, WALL_HEIGHT, 0.18, REGION.wood);
        s.box(0, WALL_HEIGHT - 0.3, 0, 1.2, 0.6, 0.18, REGION.wood);
        return s;
    },
    window() {
        const s = new Shape();
        const side = (GRID - 1.1) / 2;
        s.box(-(0.55 + side / 2), WALL_HEIGHT / 2, 0, side, WALL_HEIGHT, 0.18, REGION.wood);
        s.box(0.55 + side / 2, WALL_HEIGHT / 2, 0, side, WALL_HEIGHT, 0.18, REGION.wood);
        s.box(0, 0.5, 0, 1.1, 1, 0.18, REGION.wood);
        s.box(0, WALL_HEIGHT - 0.35, 0, 1.1, 0.7, 0.18, REGION.wood);
        return s;
    },
    roof() {
        const s = new Shape();
        const h = GRID / 2 + 0.25;
        s.card(v3(-h, 0, h), v3(h, 0, h), v3(h, 0.55, -h), v3(-h, 0.55, -h), REGION.thatch);
        return s;
    },
    hut() {
        const s = new Shape();
        woodHut(s, 5, 5, 2.7);
        return s;
    },
    house() {
        const s = new Shape();
        woodHut(s, 9, 7, 3);
        s.box(0, 0.1, 5, 6, 0.2, 3, REGION.wood, color('#b3987a'));
        for (const x of [-2.8, 2.8]) {
            s.box(x, 1.3, 6.2, 0.16, 2.6, 0.16, REGION.barkTree);
        }
        s.card(v3(-3.4, 2.6, 6.7), v3(3.4, 2.6, 6.7), v3(3.4, 3.2, 3.4), v3(-3.4, 3.2, 3.4), REGION.thatch);
        for (const x of [-3, 3]) {
            s.box(x, 1.55, 3.6, 1.1, 1, 0.04, REGION.plain, color('#1e2a30'));
            s.box(x, 1.55, 3.63, 1.25, 1.15, 0.02, REGION.wood, color('#5a4630'));
        }
        return s;
    },
    fence() {
        const s = new Shape();
        for (const x of [-1.5, 0, 1.5]) {
            s.tube([v3(x, 0, 0), v3(x, 1.2, 0)], [0.07, 0.06], 5, REGION.barkTree);
        }
        for (const y of [0.45, 0.95]) {
            s.tube([v3(-1.5, y, 0), v3(1.5, y + 0.03, 0)], [0.04, 0.04], 4, REGION.barkTree);
        }
        return s;
    },
    bridge() {
        const s = new Shape();
        s.box(0, -0.1, 0, 2.3, 0.16, 4.1, REGION.wood);
        for (const x of [-1.05, 1.05]) {
            for (const z of [-1.9, 1.9]) {
                s.tube([v3(x, -3, z), v3(x, 1, z)], [0.08, 0.07], 5, REGION.barkTree);
            }
            s.tube([v3(x, 0.95, -2), v3(x, 0.95, 2)], [0.04, 0.04], 4, REGION.barkTree);
        }
        return s;
    },
    boat() {
        const s = new Shape();
        const rows = 9;
        const sides = 6;
        for (let j = 0; j <= rows; j++) {
            const t = j / rows;
            const taper = Math.sin(t * Math.PI) ** 0.6;
            for (let i = 0; i <= sides; i++) {
                const a = Math.PI + i / sides * Math.PI;
                const nx = Math.cos(a);
                const ny = Math.sin(a);
                s.vertex(nx * 0.8 * taper, ny * 0.5 + 0.45 + (1 - taper) * 0.35, (t - 0.5) * 4.6, nx, ny, 0, j % 2, i / sides, REGION.hull, color('#e8d4b4'));
            }
        }
        for (let j = 0; j < rows; j++) {
            for (let i = 0; i < sides; i++) {
                const a = j * (sides + 1) + i;
                const b = a + sides + 1;
                s.index.push(a, b, a + 1, a + 1, b, b + 1);
            }
        }
        s.box(0, 0.26, 0.5, 1.2, 0.05, 0.3, REGION.wood);
        s.box(0, 0.26, -0.9, 1, 0.05, 0.3, REGION.wood);
        return s;
    }
};

const CROPS = {
    berries: {name: 'Berries', hours: 34, gives: {berries: 5}, seed: 'seed_berry', tint: '#b01438'},
    banana: {name: 'Bananas', hours: 52, gives: {banana: 6}, seed: 'seed_banana', tint: '#e8cf4c'},
    herb: {name: 'Herbs', hours: 28, gives: {herb: 3}, seed: 'seed_herb', tint: '#f0f4e0'}
};

export class Building {
    constructor(G) {
        this.G = G;
        this.geometries = {};
        this.items = [];
        this.nextId = 1;
        this.placing = null;
        this.removing = false;
        this.fireLight = new THREE.PointLight(0xff9a50, 0, 22, 1.7);
        G.scene.add(this.fireLight);
        this.flameTexture = softDot('rgba(255,230,160,1)', 'rgba(255,120,30,0.8)');
        this.tmpVector = new THREE.Vector3();
    }

    geometry(type) {
        if (!this.geometries[type]) {
            this.geometries[type] = SHAPES[type]().geometry();
        }
        return this.geometries[type];
    }

    // Restores from a save
    load(list) {
        for (const item of list) {
            this.spawn(item);
            this.nextId = Math.max(this.nextId, item.id + 1);
        }
    }

    toSave() {
        return this.items.map(({mesh, parts, ...data}) => data);
    }

    spawn(item) {
        const {G} = this;
        const group = new THREE.Group();
        group.position.set(item.x, item.y, item.z);
        group.rotation.y = item.turn;
        item.parts = {blocks: [], floors: [], roofs: [], things: []};
        if (item.type === 'sos') {
            this.spawnSos(item, group);
        } else {
            const mesh = new THREE.Mesh(this.geometry(item.type), G.art.solid);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            group.add(mesh);
        }
        G.scene.add(group);
        item.mesh = group;
        this.addParts(item);
        this.items.push(item);
        if (item.type === 'campfire') {
            this.addFlame(item);
        }
        if (item.type === 'garden') {
            this.showCrop(item);
        }
    }

    addFlame(item) {
        const flame = new THREE.Group();
        flame.position.y = 0.55;
        for (let i = 0; i < 3; i++) {
            const sprite = new THREE.Sprite(new THREE.SpriteMaterial({map: this.flameTexture, blending: THREE.AdditiveBlending, depthWrite: false, fog: false}));
            sprite.scale.setScalar(0.9 - i * 0.2);
            sprite.position.y = i * 0.28;
            flame.add(sprite);
        }
        item.mesh.add(flame);
        item.mesh.userData.flame = flame;
    }

    addParts(item) {
        const {G} = this;
        const {space} = G;
        const {x, y, z, turn, type} = item;
        const parts = item.parts;
        const block = b => parts.blocks.push(space.addBlock(b));
        const thing = (options, at = {x, z}) => parts.things.push(space.addThing({x: at.x, y: y + 0.7, z: at.z, rec: item, reach: 2.8, ...options}));
        const wallBlock = (lx, hx, top = y + WALL_HEIGHT + 1) => {
            const p = rotated(lx, 0, turn);
            block({x: x + p.x, z: z + p.z, hx, hz: 0.14, turn, top});
        };
        switch (type) {
            case 'campfire':
                block({x, z, r: 0.75});
                thing({menu: () => this.fireMenu(item)});
                break;
            case 'workbench':
                block({x, z, hx: 0.9, hz: 0.45, turn, top: y + 1});
                thing({menu: () => [{label: 'Use workbench', run: () => G.hud.open('craft')}]});
                break;
            case 'furnace':
                block({x, z, r: 1});
                thing({menu: () => [{label: 'Use furnace', run: () => G.hud.open('craft')}], reach: 3.2});
                break;
            case 'chest':
                block({x, z, hx: 0.58, hz: 0.35, turn, top: y + 0.7});
                item.slots = item.slots || new Array(24).fill(null);
                thing({menu: () => [{label: 'Open chest', run: () => G.hud.openChest(item)}]});
                break;
            case 'bed':
                block({x, z, hx: 0.55, hz: 1.05, turn, top: y + 0.5});
                thing({menu: () => [{label: 'Sleep', run: () => G.sleep(1)}], reach: 2.6});
                break;
            case 'garden':
                thing({menu: () => this.gardenMenu(item), reach: 3});
                break;
            case 'collector':
                block({x, z, r: 0.6});
                item.water = item.water || 0;
                thing({menu: () => this.collectorMenu(item)});
                break;
            case 'floor':
                parts.floors.push(space.addFloor({x, z, hx: GRID / 2, hz: GRID / 2, turn, y: y + 0.16}));
                break;
            case 'wall':
                wallBlock(0, GRID / 2);
                break;
            case 'window':
                wallBlock(0, GRID / 2);
                break;
            case 'doorway': {
                const side = (GRID - 1.2) / 4;
                wallBlock(-(0.6 + side), side);
                wallBlock(0.6 + side, side);
                break;
            }
            case 'fence':
                wallBlock(0, GRID / 2, y + 1.3);
                break;
            case 'roof':
                parts.roofs.push(space.addRoof({x, z, hx: GRID / 2 + 0.2, hz: GRID / 2 + 0.2, turn}));
                break;
            case 'hut':
                hutBlocks(x, z, turn, 5, 5, 2.7, y).forEach(block);
                parts.floors.push(space.addFloor({x, z, hx: 2.5, hz: 2.5, turn, y: y + 0.2}));
                parts.roofs.push(space.addRoof({x, z, hx: 2.6, hz: 2.6, turn}));
                break;
            case 'house':
                hutBlocks(x, z, turn, 9, 7, 3, y).forEach(block);
                parts.floors.push(space.addFloor({x, z, hx: 4.5, hz: 3.5, turn, y: y + 0.2}));
                parts.roofs.push(space.addRoof({x, z, hx: 4.7, hz: 3.7, turn}));
                {
                    const p = rotated(0, 5, turn);
                    parts.floors.push(space.addFloor({x: x + p.x, z: z + p.z, hx: 3, hz: 1.5, turn, y: y + 0.2}));
                    parts.roofs.push(space.addRoof({x: x + p.x, z: z + p.z, hx: 3.2, hz: 1.6, turn}));
                }
                break;
            case 'bridge':
                parts.floors.push(space.addFloor({x, z, hx: 1.15, hz: 2.05, turn, y: y - 0.02}));
                break;
            case 'boat':
                thing({menu: () => this.boatMenu(item), reach: 4});
                break;
            case 'sos':
                thing({menu: () => this.sosMenu(item), reach: 17});
                break;
        }
        // Anything built can be found in remove mode, also what has no use of its own
        if (!parts.things.length) {
            thing({menu: () => [], reach: 3.2});
        }
    }

    remove(item) {
        const {G} = this;
        for (const b of item.parts.blocks) G.space.removeBlock(b);
        for (const f of item.parts.floors) G.space.removeFloor(f);
        for (const r of item.parts.roofs) G.space.removeRoof(r);
        for (const t of item.parts.things) G.space.removeThing(t);
        G.scene.remove(item.mesh);
        this.items.splice(this.items.indexOf(item), 1);
        const cost = BUILDS[item.type].cost;
        for (const [id, n] of Object.entries(cost)) {
            const back = Math.floor(n / 2);
            if (back) {
                G.give(id, back);
            }
        }
        for (const slot of item.slots || []) {
            if (slot) {
                G.give(slot.id, slot.n);
            }
        }
        G.audio.play('build');
    }

    fireMenu(item) {
        const {G} = this;
        const lit = this.isLit(item);
        const menu = [];
        if (lit) {
            menu.push({label: 'Cook at fire', run: () => G.hud.open('craft')});
        }
        const fuel = G.has('log') ? 'log' : G.has('branch') ? 'branch' : null;
        if (fuel) {
            menu.push({
                label: lit ? 'Add ' + (fuel === 'log' ? 'a log' : 'a branch') : 'Light fire',
                run: () => {
                    G.takeItem(fuel);
                    item.fuel = Math.max(item.fuel || 0, G.clock) + (fuel === 'log' ? 3.5 : 1.4);
                    G.audio.play('fire');
                }
            });
        } else if (!lit) {
            menu.push({label: 'Light fire (needs a branch)', disabled: true});
        }
        return menu;
    }

    isLit(item) {
        return (item.fuel || 0) > this.G.clock;
    }

    gardenMenu(item) {
        const {G} = this;
        if (item.crop) {
            const crop = CROPS[item.crop];
            const done = Math.min(1, (item.grown || 0) / crop.hours);
            if (done >= 1) {
                return [{
                    label: 'Harvest ' + crop.name.toLowerCase(),
                    run: () => {
                        for (const [id, n] of Object.entries(crop.gives)) {
                            G.give(id, n);
                        }
                        if (Math.random() < 0.8) {
                            G.give(crop.seed, 1);
                        }
                        item.crop = null;
                        item.grown = 0;
                        this.showCrop(item);
                        G.audio.play('pick');
                    }
                }];
            }
            return [{label: crop.name + ' growing, ' + Math.round(done * 100) + '%', disabled: true}];
        }
        const seeds = Object.values(CROPS).filter(crop => G.has(crop.seed));
        if (!seeds.length) {
            return [{label: 'Garden plot (needs seeds)', disabled: true}];
        }
        return seeds.slice(0, 2).map(crop => ({
            label: 'Plant ' + crop.name.toLowerCase(),
            run: () => {
                G.takeItem(crop.seed);
                item.crop = Object.keys(CROPS).find(key => CROPS[key] === crop);
                item.grown = 0;
                this.showCrop(item);
                G.audio.play('dig');
            }
        }));
    }

    showCrop(item) {
        if (item.mesh.userData.crop) {
            item.mesh.remove(item.mesh.userData.crop);
            item.mesh.userData.crop = null;
        }
        if (!item.crop) {
            return;
        }
        const crop = CROPS[item.crop];
        const done = Math.min(1, (item.grown || 0) / crop.hours);
        item.shownAt = Math.floor(done * 10);
        const s = new Shape();
        for (let i = 0; i < 12; i++) {
            const x = -1.1 + (i % 4) * 0.75;
            const z = -0.65 + Math.floor(i / 4) * 0.65;
            s.at(x, 0.15, z, i * 0.9, 0.35 + done * 0.85);
            s.cross(0.9, 0.9, REGION.fern, color('#c8e090'));
            if (done >= 1) {
                s.blob(0.1, 0.55, 0.1, 0.1, 0.1, 0.1, color(crop.tint), REGION.plain, 6, 4);
                s.blob(-0.15, 0.4, 0, 0.1, 0.1, 0.1, color(crop.tint), REGION.plain, 6, 4);
            }
        }
        const mesh = new THREE.Mesh(s.geometry(), this.G.art.flora);
        item.mesh.add(mesh);
        item.mesh.userData.crop = mesh;
    }

    collectorMenu(item) {
        const {G} = this;
        if ((item.water || 0) < 0.15) {
            return [{label: 'Rain collector (waits for rain)', disabled: true}];
        }
        const menu = [{
            label: 'Drink rain water',
            run: () => {
                G.you.thirst = Math.min(100, G.you.thirst + 50 * item.water);
                item.water = 0;
                G.audio.play('drink');
            }
        }];
        if (G.has('flask')) {
            menu.push({
                label: 'Fill flask',
                run: () => {
                    G.takeItem('flask');
                    G.give('flask_clean', 1);
                    item.water = Math.max(0, item.water - 0.4);
                    G.audio.play('drink');
                }
            });
        }
        return menu;
    }

    boatMenu(item) {
        const {G} = this;
        if (G.player.boat) {
            return [];
        }
        return [{label: 'Board boat', run: () => G.player.board(item)}];
    }

    spawnSos(item, group) {
        const {G} = this;
        const slots = sosSlots();
        item.laid = item.laid || 0;
        const marker = new Shape();
        marker.card(v3(-0.5, 0, -0.5), v3(0.5, 0, -0.5), v3(0.5, 0, 0.5), v3(-0.5, 0, 0.5), REGION.plain, color('#8f6f45'), v3(0, 1, 0));
        const stone = new Shape();
        stone.blob(0, 0.2, 0, 0.82, 0.42, 0.76, WHITE, REGION.rock, 8, 5, 0.25, 3);
        const markers = new THREE.InstancedMesh(marker.geometry(), G.art.solid, slots.length);
        const stones = new THREE.InstancedMesh(stone.geometry(), G.art.solid, slots.length);
        stones.castShadow = true;
        const dummy = new THREE.Object3D();
        slots.forEach((slot, i) => {
            const p = rotated(slot.x, slot.z, item.turn);
            const y = G.world.heightAt(item.x + p.x, item.z + p.z) - item.y;
            dummy.position.set(slot.x, y + 0.05, slot.z);
            dummy.rotation.y = i * 1.3;
            dummy.scale.setScalar(1);
            dummy.updateMatrix();
            markers.setMatrixAt(i, dummy.matrix);
            dummy.position.y = y;
            dummy.scale.setScalar(0.95 + (i % 3) * 0.1);
            dummy.updateMatrix();
            stones.setMatrixAt(i, dummy.matrix);
        });
        stones.count = item.laid;
        markers.frustumCulled = stones.frustumCulled = false;
        group.add(markers, stones);
        group.userData.stones = stones;
    }

    get sos() {
        return this.items.find(item => item.type === 'sos') || null;
    }

    sosDone() {
        const sign = this.sos;
        return Boolean(sign && sign.laid >= SOS_STONES);
    }

    sosMenu(item) {
        const {G} = this;
        if (item.laid >= SOS_STONES) {
            return [{label: 'SOS sign is finished', disabled: true}];
        }
        const stones = G.count('stone');
        if (!stones) {
            return [{label: 'SOS sign: ' + item.laid + ' of ' + SOS_STONES + ' stones (bring stones)', disabled: true}];
        }
        return [{
            label: 'Lay stones (' + item.laid + ' of ' + SOS_STONES + ')',
            run: () => {
                const n = Math.min(stones, SOS_STONES - item.laid);
                G.takeItem('stone', n);
                item.laid += n;
                item.mesh.userData.stones.count = item.laid;
                G.audio.play('mine');
                if (item.laid >= SOS_STONES) {
                    G.notify('The SOS is finished. It can be seen from the air.', 'good');
                }
                G.saveSoon();
            }
        }];
    }

    // Placing: a solid-colour copy shows where it would go
    startPlacing(type) {
        const {G} = this;
        const spec = BUILDS[type];
        if (G.player.underground) {
            G.notify('There is no building down here.');
            return;
        }
        if (type === 'sos' && this.sos) {
            G.notify('There is already an SOS sign.');
            return;
        }
        if (spec.needsTool && !G.findTool(spec.needsTool)) {
            G.notify('You need a ' + spec.needsTool + ' for that.');
            return;
        }
        this.cancelPlacing();
        this.removing = false;
        const good = new THREE.MeshLambertMaterial({color: 0x54d28a, side: THREE.DoubleSide});
        const bad = new THREE.MeshLambertMaterial({color: 0xe05a4a, side: THREE.DoubleSide});
        const group = new THREE.Group();
        if (type === 'sos') {
            const s = new Shape();
            for (const slot of sosSlots()) {
                s.at(slot.x, 0.1, slot.z);
                s.box(0, 0, 0, 1.6, 0.16, 1.6);
            }
            group.add(new THREE.Mesh(s.geometry(), good));
        } else {
            group.add(new THREE.Mesh(this.geometry(type), good));
        }
        G.scene.add(group);
        this.placing = {type, spec, group, good, bad, turn: 0, valid: false, x: 0, y: 0, z: 0};
        G.hud.showPlacing(true);
    }

    cancelPlacing() {
        if (this.placing) {
            this.G.scene.remove(this.placing.group);
            this.placing = null;
            this.G.hud.showPlacing(false);
        }
    }

    turnPlacing() {
        if (this.placing) {
            this.placing.turn += this.placing.spec.snap ? Math.PI / 2 : Math.PI / 4;
        }
    }

    confirmPlacing() {
        const {G, placing} = this;
        if (!placing) {
            return;
        }
        if (!placing.valid) {
            G.notify(placing.why || 'It can\'t go here.');
            return;
        }
        if (!G.takeAll(placing.spec.cost)) {
            G.notify('You don\'t have the materials for that anymore.');
            this.cancelPlacing();
            return;
        }
        const item = {id: this.nextId++, type: placing.type, x: placing.x, y: placing.y, z: placing.z, turn: placing.placedTurn};
        if (item.type === 'campfire') {
            item.fuel = G.clock + 2;
        }
        this.spawn(item);
        G.audio.play('build');
        G.effects.chips(item.x, item.y + 0.6, item.z, '#b89468');
        if (placing.type === 'sos') {
            G.notify('Now bring 34 stones here and lay them out.', 'good');
        }
        G.saveSoon();
        const left = placing.type;
        this.cancelPlacing();
        // Pieces of a base often come in a row
        if (BUILDS[left].snap && G.hasAll(BUILDS[left].cost)) {
            this.startPlacing(left);
            this.placing.turn = item.turn;
        }
    }

    updatePlacing() {
        const {G, placing} = this;
        if (!placing) {
            return;
        }
        const {world, space} = G;
        const p = G.player.position;
        const yaw = G.player.yaw;
        const reach = placing.type === 'sos' ? 17 : placing.type === 'house' ? 9 : placing.type === 'hut' ? 6 : placing.type === 'bridge' ? 2.9 : 3.4;
        let x = p.x - Math.sin(yaw) * reach;
        let z = p.z - Math.cos(yaw) * reach;
        let turn = placing.turn;
        const {spec, type} = placing;
        if (spec.snap) {
            const quarter = Math.round(turn / (Math.PI / 2)) & 1;
            if (spec.edge) {
                if (quarter) {
                    x = Math.round(x / GRID) * GRID;
                    z = Math.floor(z / GRID) * GRID + GRID / 2;
                } else {
                    x = Math.floor(x / GRID) * GRID + GRID / 2;
                    z = Math.round(z / GRID) * GRID;
                }
            } else {
                x = Math.floor(x / GRID) * GRID + GRID / 2;
                z = Math.floor(z / GRID) * GRID + GRID / 2;
            }
        }
        if (type === 'bridge' || type === 'boat') {
            turn = placing.turn + Math.round(yaw / (Math.PI / 8)) * (Math.PI / 8);
        }
        // The SOS lies lengthwise in front of you, exactly as you look along the beach
        if (type === 'sos') {
            turn = placing.turn + yaw + Math.PI / 2;
        }
        const ground = world.heightAt(x, z);
        let y = ground;
        const floor = space.floorAt(x, z, ground + 3.6, 0);
        if (floor > y) {
            y = floor;
        }
        let valid = true;
        let why = '';
        const biome = world.biomeAt(x, z);
        if (type === 'floor') {
            y = Math.max(ground, 0.2) + 0.02;
        }
        if (type === 'roof') {
            y += WALL_HEIGHT + 0.05;
        }
        if (type === 'bridge') {
            y = Math.max(G.player.feet, 0.5);
            if (ground > 1.1) {
                valid = false;
                why = 'A bridge goes over water.';
            }
        } else if (type === 'boat') {
            y = 0;
            if (ground > -0.25 || ground < -5) {
                valid = false;
                why = 'A boat needs shallow water.';
            }
        } else if (type === 'sos') {
            y = ground;
            let offSand = 0;
            for (const slot of sosSlots()) {
                const r = rotated(slot.x, slot.z, turn);
                const h = world.heightAt(x + r.x, z + r.z);
                if (h < 0.05) {
                    offSand = 99;
                } else if (world.biomeAt(x + r.x, z + r.z) !== BIOME.BEACH) {
                    offSand++;
                }
            }
            let inTheWay = false;
            for (const slot of sosSlots()) {
                const r = rotated(slot.x, slot.z, turn);
                const px = x + r.x;
                const pz = z + r.z;
                if (G.space.blocks.near(px, pz, 1).some(block => Math.hypot(block.x - px, block.z - pz) < block.reachOut + 0.5)) {
                    inTheWay = true;
                    break;
                }
            }
            if (inTheWay && offSand <= 3) {
                valid = false;
                why = 'Something stands where the stones go. Chop it down, or find more open sand.';
            } else if (offSand > 3) {
                valid = false;
                why = 'The SOS must lie on open sand. Look along the beach.';
            }
        } else {
            if (ground < 0.05 && type !== 'floor') {
                valid = false;
                why = 'That needs dry ground.';
            }
            if (ground < -0.6) {
                valid = false;
                why = 'Too deep.';
            }
        }
        if (type === 'garden' && (biome === BIOME.CAVE)) {
            valid = false;
            why = 'Nothing grows in here.';
        }
        const clash = this.items.some(other => other.type === type && Math.hypot(other.x - x, other.z - z) < 0.3
            && Math.abs(other.y - y) < 1 && Math.abs(Math.sin(other.turn - turn)) < 0.1);
        if (clash) {
            valid = false;
            why = 'There is already one here.';
        }
        if (!G.hasAll(spec.cost)) {
            valid = false;
            why = 'You don\'t have the materials.';
        }
        placing.valid = valid;
        placing.why = why;
        placing.x = x;
        placing.y = y;
        placing.z = z;
        placing.group.position.set(x, y, z);
        placing.group.rotation.y = turn;
        placing.placedTurn = turn;
        placing.group.children.forEach(child => {
            child.material = valid ? placing.good : placing.bad;
        });
    }

    // Every frame, with game hours passed
    update(hours, realDt) {
        const {G} = this;
        const p = G.player.position;
        const raining = G.env.rain;
        let nearest = null;
        let nearestDistance = 44;
        this.warmth = false;
        this.deterrent = [];
        for (const item of this.items) {
            if (item.type === 'campfire') {
                const lit = this.isLit(item);
                const flame = item.mesh.userData.flame;
                flame.visible = lit;
                if (lit) {
                    if (raining > 0.3 && !G.space.underRoof(item.x, item.z)) {
                        item.fuel -= hours * 4 * raining;
                    }
                    const t = G.now * 7 + item.id;
                    flame.children.forEach((sprite, i) => {
                        const pulse = 1 + Math.sin(t * (1 + i * 0.5)) * 0.15;
                        sprite.scale.setScalar((0.95 - i * 0.22) * pulse);
                        sprite.position.y = i * 0.28 + Math.sin(t + i) * 0.03;
                    });
                    const d = Math.hypot(item.x - p.x, item.z - p.z);
                    if (d < nearestDistance) {
                        nearest = item;
                        nearestDistance = d;
                    }
                    if (d < 6) {
                        this.warmth = true;
                    }
                    this.deterrent.push(item);
                }
            } else if (item.type === 'collector') {
                if (raining > 0.1) {
                    item.water = Math.min(1, (item.water || 0) + hours * raining * 0.5);
                }
            } else if (item.type === 'garden' && item.crop) {
                item.grown = (item.grown || 0) + hours * (raining > 0.2 ? 1.6 : 1);
                const crop = CROPS[item.crop];
                const shown = Math.floor(Math.min(1, item.grown / crop.hours) * 10);
                if (shown !== item.shownAt) {
                    this.showCrop(item);
                }
            } else if (item.type === 'boat' && G.player.boat !== item) {
                item.mesh.position.y = Math.sin(G.now * 1.1 + item.id) * 0.05;
                item.mesh.rotation.z = Math.sin(G.now * 0.9 + item.id) * 0.03;
            }
        }
        if (nearest) {
            this.fireLight.position.set(nearest.x, nearest.y + 1.1, nearest.z);
            this.fireLight.intensity = 26 + Math.sin(G.now * 11) * 4;
        } else {
            this.fireLight.intensity = 0;
        }
        this.updatePlacing(realDt);
    }

    nearStation(kind) {
        const {G} = this;
        const p = G.player.position;
        const near = type => this.items.some(item => item.type === type && Math.hypot(item.x - p.x, item.z - p.z) < 5 && (type !== 'campfire' || this.isLit(item)));
        if (kind === 'bench') return near('workbench');
        if (kind === 'fire') return near('campfire');
        if (kind === 'furnace') return near('furnace');
        return true;
    }

    nearFire(x, z, distance) {
        return this.items.some(item => item.type === 'campfire' && this.isLit(item) && Math.hypot(item.x - x, item.z - z) < distance);
    }

    // After sleeping many hours in one go
    advance(hours) {
        for (const item of this.items) {
            if (item.type === 'garden' && item.crop) {
                item.grown = (item.grown || 0) + hours * 1.2;
                this.showCrop(item);
            }
        }
    }
}
