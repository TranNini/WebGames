// The animals of the island. Harmless ones wander or flee, predators hunt, and some can be tamed with the right food.
import * as THREE from './lib/three.module.min.js';
import {BIOME} from './world.js';
import {ITEMS} from './items.js';
import {REGION, Shape, WHITE, color, keepNormals, v3} from './art.js';

const LIFE_BAR = new THREE.PlaneGeometry(1, 1);
const BLACK = new THREE.Color(0, 0, 0);

const {BEACH, MEADOW, JUNGLE, SWAMP, RIVER, ISLET} = BIOME;

// hp, walking and running speed, damage, how near it notices you, and where it lives. tame: what it takes, and how many.
const SPECIES = {
    boar: {name: 'wild boar', hp: 45, walk: 1.3, run: 5.6, damage: 11, angryOnly: true, max: 4, biomes: [JUNGLE, MEADOW], drops: {meat_raw: 2, hide: 1}, tame: {item: 'coconut', n: 3}, hitRange: 1.7, r: 0.5, sound: 'boar'},
    monkey: {name: 'monkey', hp: 22, walk: 1.5, run: 5.2, damage: 0, flees: 7, max: 4, biomes: [JUNGLE], drops: {meat_raw: 1}, tame: {item: 'banana', n: 2}, r: 0.3, sound: 'monkey'},
    parrot: {name: 'parrot', hp: 8, walk: 5.5, run: 9, damage: 0, flees: 5, flying: true, max: 4, biomes: [JUNGLE, MEADOW, BEACH], drops: {feather: 2, meat_raw: 1}, tame: {item: 'berries', n: 2}, r: 0.2, sound: 'parrot'},
    turtle: {name: 'turtle', hp: 36, walk: 0.4, run: 0.6, damage: 0, max: 3, biomes: [BEACH], drops: {meat_raw: 2}, r: 0.6, sound: null},
    crab: {name: 'crab', hp: 4, walk: 0.8, run: 2.6, damage: 0, flees: 3, max: 6, biomes: [BEACH], catchable: true, drops: {crab_raw: 1}, r: 0.2, sound: null},
    snake: {name: 'snake', hp: 14, walk: 0.8, run: 3.1, damage: 8, poison: 4, notice: 5.5, max: 3, biomes: [JUNGLE, SWAMP], drops: {meat_raw: 1}, hitRange: 1.4, r: 0.25, predator: true, sound: 'snake'},
    croc: {name: 'crocodile', hp: 95, walk: 0.7, run: 5.2, damage: 24, notice: 11, swims: true, max: 3, biomes: [SWAMP, RIVER], drops: {meat_raw: 3, hide: 2}, hitRange: 2.2, r: 0.8, predator: true, sound: 'croc'},
    jaguar: {name: 'jaguar', hp: 75, walk: 1.6, run: 7.4, damage: 18, notice: 15, noticeNight: 30, max: 2, biomes: [JUNGLE], drops: {meat_raw: 2, hide: 2}, tame: {item: 'meat_cooked', n: 3}, hitRange: 1.9, r: 0.55, predator: true, nightly: true, sound: 'jaguar'}
};

function limb(length, radius, region, c = WHITE, foot = 1.25) {
    const s = new Shape();
    s.tube([v3(0, 0.02, 0), v3(0, -length * 0.35, 0.015), v3(0, -length * 0.68, -0.015), v3(0, -length * 0.92, 0.01), v3(0, -length, radius * 0.5)],
        [radius, radius * 0.82, radius * 0.5, radius * 0.48, radius * 0.62 * foot], 7, region, c);
    return s.geometry();
}

// All animals have simple black dots for eyes
function eye(s, x, y, z, r) {
    s.blob(x, y, z, r, r, r, BLACK, REGION.plain, 7, 5);
}

const MODELS = {
    boar() {
        const s = new Shape();
        const fur = REGION.furBoar;
        s.loft([[-0.74, 0.52, 0.03, 0.03], [-0.68, 0.52, 0.17, 0.2], [-0.48, 0.56, 0.28, 0.32], [-0.12, 0.58, 0.31, 0.35], [0.2, 0.62, 0.31, 0.37], [0.42, 0.65, 0.27, 0.32],
            [0.58, 0.61, 0.21, 0.25], [0.72, 0.56, 0.17, 0.2, 0.95], [0.88, 0.51, 0.115, 0.13, 0.95], [1.0, 0.465, 0.072, 0.08, 1.1], [1.12, 0.44, 0.064, 0.06, 1.2], [1.14, 0.44, 0.01, 0.01, 1.2]], 11, fur);
        // Stiff hair along the back, snout, tusks, ears, eyes
        s.tube([v3(0, 0.84, -0.4), v3(0, 0.93, 0.02), v3(0, 0.98, 0.35), v3(0, 0.84, 0.66)], [0.01, 0.045, 0.05, 0.012], 5, fur, color('#807870'));
        s.blob(0, 0.44, 1.14, 0.066, 0.058, 0.014, color('#4d3a32'), REGION.plain, 8, 4);
        s.tube([v3(-0.24, 0.5, -0.66), v3(-0.02, 0.52, -0.74), v3(0.02, 0.42, -0.8)], [0.012, 0.012, 0.006], 3, fur);
        for (const x of [-1, 1]) {
            s.card(v3(x * 0.1, 0.68, 0.66), v3(x * 0.2, 0.68, 0.62), v3(x * 0.24, 0.84, 0.6), v3(x * 0.13, 0.82, 0.63), fur, color('#c0b0a0'), v3(x * 0.3, 0.5, 0.8));
            s.tube([v3(x * 0.07, 0.43, 0.97), v3(x * 0.13, 0.47, 1.02), v3(x * 0.14, 0.56, 1.03)], [0.022, 0.017, 0.004], 5, REGION.plain, color('#e6dcc4'));
            eye(s, x * 0.112, 0.6, 0.83, 0.026);
        }
        return {body: s.geometry(), limb: limb(0.38, 0.075, fur, color('#a89888')), limbs: [[-0.19, 0.38, 0.4], [0.19, 0.38, 0.4], [-0.2, 0.38, -0.42], [0.2, 0.38, -0.42]]};
    },
    monkey() {
        const s = new Shape();
        const fur = REGION.furMonkey;
        const face = color('#b08a6c');
        s.at(0, 0.42, -0.08, 0, 1, -1.25);
        s.loft([[-0.02, 0, 0.05, 0.05], [0.04, 0, 0.14, 0.13], [0.18, 0, 0.17, 0.15], [0.33, 0, 0.15, 0.13], [0.45, 0, 0.13, 0.11], [0.5, 0, 0.05, 0.05]], 9, fur);
        s.at();
        s.blob(0, 0.86, 0.1, 0.125, 0.13, 0.125, WHITE, fur, 10, 8);
        s.blob(0, 0.84, 0.195, 0.085, 0.08, 0.05, face, REGION.plain, 8, 6);
        s.blob(0, 0.8, 0.235, 0.05, 0.035, 0.035, color('#9a7658'), REGION.plain, 6, 4);
        for (const x of [-1, 1]) {
            s.blob(x * 0.125, 0.88, 0.09, 0.04, 0.05, 0.02, face, REGION.plain, 6, 4);
            eye(s, x * 0.036, 0.87, 0.238, 0.019);
        }
        s.tube([v3(0, 0.46, -0.14), v3(0, 0.34, -0.44), v3(0, 0.5, -0.72), v3(0, 0.82, -0.72), v3(0.05, 0.92, -0.6)], [0.03, 0.028, 0.025, 0.02, 0.012], 5, fur);
        return {body: s.geometry(), limb: limb(0.45, 0.04, fur), limbs: [[-0.13, 0.44, 0.02], [0.13, 0.44, 0.02], [-0.18, 0.72, 0.1], [0.18, 0.72, 0.1]]};
    },
    parrot() {
        const s = new Shape();
        const red = color('#c9161f');
        s.loft([[-0.2, -0.03, 0.01, 0.01], [-0.14, -0.02, 0.06, 0.05], [-0.02, 0, 0.09, 0.09], [0.1, 0.02, 0.085, 0.09], [0.17, 0.06, 0.07, 0.075], [0.23, 0.08, 0.065, 0.065], [0.27, 0.08, 0.03, 0.03]], 8, REGION.plain, red);
        s.tube([v3(0, 0.1, 0.27), v3(0, 0.08, 0.32), v3(0, 0.03, 0.33)], [0.03, 0.022, 0.004], 5, REGION.plain, color('#2c2a26'));
        for (const x of [-1, 1]) {
            eye(s, x * 0.058, 0.102, 0.25, 0.013);
        }
        const tails = [color('#1c60c8'), color('#c9161f'), color('#1c60c8')];
        tails.forEach((tint, i) => {
            const x = (i - 1) * 0.035;
            s.card(v3(x - 0.02, -0.02, -0.16), v3(x + 0.02, -0.02, -0.16), v3(x + 0.022 + x * 0.3, -0.07, -0.56 + Math.abs(i - 1) * 0.08), v3(x - 0.022 + x * 0.3, -0.07, -0.56 + Math.abs(i - 1) * 0.08), REGION.plain, tint, v3(0, 1, 0));
        });
        const wing = new Shape();
        wing.card(v3(0, 0, -0.1), v3(0, 0, 0.11), v3(0.13, 0, 0.1), v3(0.13, 0, -0.12), REGION.plain, color('#c9161f'), v3(0, 1, 0));
        wing.card(v3(0.13, 0, -0.12), v3(0.13, 0, 0.1), v3(0.22, 0, 0.08), v3(0.22, 0, -0.15), REGION.plain, color('#e7c22a'), v3(0, 1, 0));
        wing.card(v3(0.22, 0, -0.15), v3(0.22, 0, 0.08), v3(0.38, 0, 0.03), v3(0.38, 0, -0.17), REGION.plain, color('#1c60c8'), v3(0, 1, 0));
        return {body: s.geometry(), wing: wing.geometry()};
    },
    turtle() {
        const s = new Shape();
        const skin = color('#93a07a');
        // The shell: a dome, with the pattern seen from above
        const rx = 0.52;
        const rz = 0.66;
        const start = s.position.length / 3;
        const rings = 8;
        const around = 16;
        for (let j = 0; j <= rings; j++) {
            const phi = j / rings * Math.PI / 2;
            for (let i = 0; i <= around; i++) {
                const a = i / around * Math.PI * 2;
                const x = Math.sin(phi) * Math.cos(a);
                const z = Math.sin(phi) * Math.sin(a);
                const y = Math.cos(phi);
                s.vertex(x * rx, 0.16 + y * 0.3, z * rz, x, y, z, 0.5 + x * 0.46, 0.5 + z * 0.46, REGION.shell, WHITE);
            }
        }
        for (let j = 0; j < rings; j++) {
            for (let i = 0; i < around; i++) {
                const a = start + j * (around + 1) + i;
                const b = a + around + 1;
                s.index.push(a, a + 1, b, a + 1, b + 1, b);
            }
        }
        s.blob(0, 0.15, 0, rx * 1.02, 0.07, rz * 1.02, color('#a89e78'), REGION.plain, 12, 4);
        s.loft([[0.56, 0.2, 0.09, 0.08], [0.72, 0.24, 0.1, 0.09], [0.84, 0.25, 0.11, 0.09], [0.94, 0.23, 0.075, 0.065], [0.98, 0.22, 0.01, 0.01]], 8, REGION.scales, skin);
        s.blob(0, 0.16, -0.68, 0.045, 0.04, 0.09, skin, REGION.scales, 6, 4);
        for (const x of [-1, 1]) {
            eye(s, x * 0.095, 0.28, 0.85, 0.023);
        }
        const fin = new Shape();
        fin.blob(0, -0.04, 0, 0.21, 0.04, 0.1, skin, REGION.scales, 8, 4);
        return {body: s.geometry(), limb: fin.geometry(), limbs: [[-0.5, 0.17, 0.36], [0.5, 0.17, 0.36], [-0.42, 0.17, -0.4], [0.42, 0.17, -0.4]], swing: 0.5};
    },
    crab() {
        const s = new Shape();
        const shell = color('#b8472a');
        s.blob(0, 0.1, 0, 0.15, 0.07, 0.11, shell, REGION.scales, 8, 6);
        for (const x of [-1, 1]) {
            s.tube([v3(x * 0.12, 0.09, 0.07), v3(x * 0.2, 0.1, 0.12)], [0.02, 0.018], 4, REGION.plain, shell);
            s.blob(x * 0.24, 0.1, 0.14, 0.065, 0.04, 0.05, shell, REGION.scales, 6, 4);
            s.tube([v3(x * 0.05, 0.13, 0.08), v3(x * 0.05, 0.19, 0.09)], [0.006, 0.005], 3, REGION.plain, shell);
            eye(s, x * 0.05, 0.195, 0.09, 0.015);
            for (let i = 0; i < 4; i++) {
                s.tube([v3(x * 0.12, 0.08, -0.07 + i * 0.04), v3(x * 0.25, 0.09, -0.1 + i * 0.05), v3(x * 0.31, 0, -0.13 + i * 0.06)], [0.012, 0.01, 0.004], 3, REGION.plain, shell);
            }
        }
        return {body: s.geometry()};
    },
    snake() {
        const frames = [0, 1].map(phase => {
            const s = new Shape();
            const path = [];
            const radii = [];
            for (let i = 0; i <= 22; i++) {
                const t = i / 22;
                path.push(v3(Math.sin(t * 8 + phase * 1.8) * 0.22 * (t + 0.3), 0.05, -0.75 + t * 1.3));
                radii.push(0.048 * Math.sin(Math.min(1, (1 - t) * 1.1 + 0.15) * Math.PI) ** 0.5 + 0.005);
            }
            s.tube(path, radii, 6, REGION.scales, color('#a3a252'), 5);
            const head = path[22];
            s.at(head.x, 0, 0);
            s.loft([[0.53, 0.055, 0.03, 0.028], [0.58, 0.06, 0.06, 0.035], [0.65, 0.058, 0.052, 0.03], [0.71, 0.05, 0.022, 0.017], [0.72, 0.05, 0.004, 0.004]], 7, REGION.scales, color('#8a8a44'));
            for (const x of [-1, 1]) {
                eye(s, x * 0.045, 0.08, 0.63, 0.012);
            }
            s.at();
            return s.geometry();
        });
        return {frames};
    },
    croc() {
        const s = new Shape();
        const skin = color('#6c7a52');
        const dark = color('#46523a');
        const belly = color('#a8a884');
        s.loft([[-3, 0.1, 0.01, 0.015], [-2.6, 0.12, 0.05, 0.08], [-2, 0.15, 0.11, 0.15], [-1.4, 0.18, 0.18, 0.19], [-0.9, 0.22, 0.29, 0.2], [-0.4, 0.25, 0.38, 0.22], [0.2, 0.26, 0.42, 0.22], [0.7, 0.25, 0.38, 0.2],
            [1.05, 0.24, 0.28, 0.16], [1.3, 0.25, 0.26, 0.135], [1.55, 0.22, 0.19, 0.09], [1.9, 0.195, 0.13, 0.055], [2.2, 0.185, 0.11, 0.04], [2.32, 0.18, 0.08, 0.03], [2.36, 0.18, 0.01, 0.01]], 12, REGION.scales, skin, 6);
        // The lower jaw, a little open, with teeth
        s.loft([[1.15, 0.12, 0.2, 0.05], [1.5, 0.1, 0.17, 0.04], [1.9, 0.11, 0.12, 0.03], [2.25, 0.125, 0.09, 0.022], [2.32, 0.125, 0.01, 0.01]], 8, REGION.scales, belly, 2);
        const white = color('#e4dcc2');
        for (let i = 0; i < 16; i++) {
            const t = i / 16;
            const z = 1.45 + t * 0.82;
            const half = (0.17 - t * 0.09);
            for (const x of [-1, 1]) {
                s.tube([v3(x * half, 0.155, z), v3(x * half, 0.11, z + 0.005)], [0.011, 0.002], 3, REGION.plain, white);
            }
        }
        for (const x of [-1, 1]) {
            s.blob(x * 0.14, 0.345, 1.34, 0.055, 0.045, 0.07, skin, REGION.scales, 6, 4);
            eye(s, x * 0.16, 0.37, 1.37, 0.028);
            s.blob(x * 0.045, 0.22, 2.3, 0.018, 0.012, 0.022, dark, REGION.plain, 4, 3);
        }
        // Plates along the back and the tail
        for (let i = 0; i < 26; i++) {
            const z = 1 - i * 0.145;
            const top = z > -0.9 ? 0.46 : 0.42 - (-0.9 - z) * 0.14;
            const wide = z > -0.9 ? 0.15 : Math.max(0, 0.08 - (-0.9 - z) * 0.05);
            for (const x of wide > 0.01 ? [-1, 1] : [0]) {
                s.blob(x * wide, top - (z > -0.9 ? 0 : 0.02), z, 0.03, 0.04, 0.055, dark, REGION.plain, 4, 3);
            }
        }
        return {body: s.geometry(), limb: limb(0.24, 0.085, REGION.scales, skin, 1.7), limbs: [[-0.4, 0.22, 0.65], [0.4, 0.22, 0.65], [-0.4, 0.22, -0.55], [0.4, 0.22, -0.55]]};
    },
    jaguar() {
        const s = new Shape();
        const fur = REGION.furJaguar;
        s.loft([[-0.74, 0.68, 0.03, 0.03], [-0.68, 0.69, 0.16, 0.19], [-0.5, 0.71, 0.235, 0.26], [-0.24, 0.7, 0.245, 0.265], [0, 0.68, 0.225, 0.24], [0.24, 0.7, 0.24, 0.27], [0.44, 0.75, 0.235, 0.27],
            [0.6, 0.81, 0.17, 0.19], [0.72, 0.87, 0.135, 0.145], [0.82, 0.91, 0.155, 0.145], [0.94, 0.905, 0.15, 0.125], [1.04, 0.86, 0.1, 0.09, 1.08], [1.12, 0.83, 0.075, 0.065, 1.16], [1.16, 0.825, 0.012, 0.012, 1.16]], 12, fur, WHITE, 2);
        s.tube([v3(0, 0.76, -0.68), v3(0, 0.62, -1.1), v3(0.05, 0.52, -1.45), v3(-0.02, 0.62, -1.8), v3(0, 0.72, -1.9)], [0.055, 0.05, 0.045, 0.04, 0.03], 7, fur);
        s.blob(0, 0.83, 1.155, 0.03, 0.022, 0.012, color('#3d2a22'), REGION.plain, 6, 4);
        s.blob(0, 0.785, 1.08, 0.055, 0.02, 0.045, color('#dcc8a0'), REGION.plain, 6, 4);
        for (const x of [-1, 1]) {
            s.blob(x * 0.115, 1.03, 0.82, 0.05, 0.055, 0.016, color('#6a5030'), REGION.plain, 6, 4);
            eye(s, x * 0.085, 0.945, 1.0, 0.024);
            s.blob(x * 0.045, 0.825, 1.11, 0.03, 0.022, 0.02, color('#e8d8b4'), REGION.plain, 5, 4);
        }
        return {body: s.geometry(), limb: limb(0.64, 0.105, fur), limbs: [[-0.17, 0.64, 0.46], [0.17, 0.64, 0.46], [-0.18, 0.64, -0.5], [0.18, 0.64, -0.5]]};
    }
};

function fishGeometry() {
    const s = new Shape();
    s.blob(0, 0, 0, 0.05, 0.1, 0.22, color('#ffffff'), REGION.plain, 7, 5);
    for (const x of [-1, 1]) {
        eye(s, x * 0.04, 0.025, 0.13, 0.016);
    }
    s.card(v3(0, 0, -0.2), v3(0, 0.1, -0.36), v3(0, -0.1, -0.36), v3(0, 0, -0.2), REGION.plain, color('#ffffff'), v3(1, 0, 0));
    s.card(v3(0, 0.08, 0.05), v3(0, 0.08, -0.1), v3(0, 0.17, -0.1), v3(0, 0.13, 0.02), REGION.plain, color('#ffffff'), v3(1, 0, 0));
    return s.geometry();
}

export class Animals {
    constructor(G) {
        this.G = G;
        this.list = [];
        this.models = {};
        this.material = keepNormals(new THREE.MeshLambertMaterial({map: G.art.sheet, vertexColors: true, side: THREE.DoubleSide}));
        this.spawnTimer = 2;
        this.max = G.quality === 'low' ? 9 : 16;
        this.warnTimer = 0;
        this.setUpFish();
    }

    model(name) {
        if (!this.models[name]) {
            this.models[name] = MODELS[name]();
        }
        return this.models[name];
    }

    create(name, x, z, tame = false) {
        const {G} = this;
        const spec = SPECIES[name];
        const model = this.model(name);
        const group = new THREE.Group();
        let frames = null;
        if (model.frames) {
            frames = model.frames.map(geometry => {
                const mesh = new THREE.Mesh(geometry, this.material);
                mesh.castShadow = true;
                group.add(mesh);
                return mesh;
            });
            frames[1].visible = false;
        } else {
            const body = new THREE.Mesh(model.body, this.material);
            body.castShadow = true;
            group.add(body);
        }
        const limbs = (model.limbs || []).map(([lx, ly, lz]) => {
            const mesh = new THREE.Mesh(model.limb, this.material);
            mesh.position.set(lx, ly, lz);
            group.add(mesh);
            return mesh;
        });
        let wings = null;
        if (model.wing) {
            wings = [-1, 1].map(side => {
                const mesh = new THREE.Mesh(model.wing, this.material);
                mesh.scale.x = side;
                mesh.position.set(side * 0.05, 0.03, 0);
                group.add(mesh);
                return mesh;
            });
        }
        G.scene.add(group);
        const y = G.world.heightAt(x, z);
        const animal = {
            name, spec, group, limbs, wings, frames, x, y, z, heading: Math.random() * 6.28, hp: spec.hp, mode: 'wander',
            timer: Math.random() * 3, walking: false, phase: Math.random() * 6, angry: false, tame, gifts: 0, attackIn: 0,
            altitude: 9 + Math.random() * 7, orbit: Math.random() * 6.3, dead: false, bringIn: 40 + Math.random() * 60
        };
        group.position.set(x, Math.max(y, spec.swims ? -0.2 : y), z);
        this.list.push(animal);
        return animal;
    }

    remove(animal) {
        this.dropLife(animal);
        this.G.scene.remove(animal.group);
        if (animal.thing) {
            this.G.space.removeThing(animal.thing);
        }
        this.list.splice(this.list.indexOf(animal), 1);
    }

    spawnSome() {
        const {G, list} = this;
        const wild = list.filter(a => !a.tame && !a.dead).length;
        if (wild >= this.max) {
            return;
        }
        const p = G.player.position;
        const night = G.env.isNight;
        const names = Object.keys(SPECIES);
        for (let tries = 0; tries < 18; tries++) {
            const name = names[Math.floor(Math.random() * names.length)];
            const spec = SPECIES[name];
            const already = list.filter(a => a.name === name && !a.tame).length;
            if (already >= spec.max + (night && spec.nightly ? 1 : 0) || (spec.nightly && !night && Math.random() < 0.5)) {
                continue;
            }
            const angle = Math.random() * 6.28;
            const distance = 48 + Math.random() * 55;
            const x = p.x + Math.cos(angle) * distance;
            const z = p.z + Math.sin(angle) * distance;
            const biome = G.world.biomeAt(x, z);
            const h = G.world.heightAt(x, z);
            if (!spec.biomes.includes(biome) && !(biome === ISLET && spec.biomes.includes(JUNGLE) && name !== 'jaguar')) {
                continue;
            }
            if (h < (spec.swims ? -1.5 : 0.3) || G.world.caveAt(x, z)) {
                continue;
            }
            if (spec.predator && G.building.nearFire(x, z, 16)) {
                continue;
            }
            this.create(name, x, z);
            return;
        }
    }

    // Moves if it can; a land animal doesn't walk into the sea
    step(a, dt, speed) {
        const {G} = this;
        const nx = a.x + Math.sin(a.heading) * speed * dt;
        const nz = a.z + Math.cos(a.heading) * speed * dt;
        const h = G.world.heightAt(nx, nz);
        const lowest = a.spec.swims ? -1.3 : a.name === 'turtle' ? -0.2 : 0.14;
        if (a.spec.flying || h > lowest) {
            a.x = nx;
            a.z = nz;
            if (!a.spec.flying) {
                G.space.pushOut(a, a.spec.r, h, h + 1);
            }
            return true;
        }
        a.heading += 1.4 + Math.random();
        a.timer = Math.min(a.timer, 0.5);
        return false;
    }

    turnTo(a, target, dt, rate = 4) {
        let diff = target - a.heading;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        a.heading += Math.max(-rate * dt, Math.min(rate * dt, diff));
    }

    update(dt) {
        const {G, list} = this;
        // Below the ground nothing up here can reach you
        if (G.player.underground) {
            this.fish.visible = false;
            return;
        }
        for (const a of list) {
            if (a.life) {
                this.updateLife(a);
            }
        }
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
            this.spawnTimer = 2.2;
            this.spawnSome();
        }
        const p = G.player.position;
        const night = G.env.isNight;
        let predatorNear = null;
        for (let i = list.length - 1; i >= 0; i--) {
            const a = list[i];
            const dx = p.x - a.x;
            const dz = p.z - a.z;
            const distance = Math.hypot(dx, dz);
            if (a.dead) {
                a.timer -= dt;
                if (a.timer <= 0 || distance > 170) {
                    this.remove(a);
                }
                continue;
            }
            if (!a.tame && distance > 165) {
                this.remove(a);
                continue;
            }
            if (a.spec.predator && !a.tame && distance < 28) {
                predatorNear = a;
            }
            const toPlayer = Math.atan2(dx, dz);
            if (a.tame) {
                this.updateTame(a, dt, distance, toPlayer);
            } else if (a.spec.flying) {
                this.updateFlyer(a, dt, distance);
            } else {
                this.updateWild(a, dt, distance, toPlayer, night);
            }
            this.pose(a, dt);
        }
        this.updateFish(dt);
        if (predatorNear && this.list.some(a => a.tame && a.name === 'parrot')) {
            this.warnTimer -= dt;
            if (this.warnTimer <= 0) {
                this.warnTimer = 40;
                G.notify('Your parrot squawks: a ' + predatorNear.spec.name + ' is close.');
                G.audio.play('parrot');
            }
        }
    }

    updateWild(a, dt, distance, toPlayer, night) {
        const {G} = this;
        const {spec} = a;
        a.timer -= dt;
        let speed = 0;
        const underFire = spec.predator && G.building.nearFire(a.x, a.z, 11);
        const notice = night && spec.noticeNight ? spec.noticeNight : spec.notice || 0;
        const playerInWater = G.player.swimming || G.player.boat;
        const calm = a.calmUntil > G.now;
        const seesYou = !calm && distance < notice && (spec.swims || !playerInWater);
        const wantsFood = spec.tame && G.has(spec.tame.item) && distance < 16;
        if (underFire) {
            this.turnTo(a, toPlayer + Math.PI, dt);
            speed = spec.run * 0.8;
            a.angry = false;
        } else if (!calm && (a.angry || seesYou)) {
            if (spec.damage > 0) {
                this.turnTo(a, toPlayer, dt, 5);
                const reach = spec.hitRange || 1.5;
                speed = distance > reach ? spec.run : 0;
                a.attackIn -= dt;
                if (distance <= reach + 0.25 && a.attackIn <= 0) {
                    a.attackIn = 1.25;
                    G.hurt(spec.damage, 'was killed by a ' + spec.name, a);
                    if (spec.poison) {
                        G.you.poison = Math.max(G.you.poison, spec.poison);
                        G.notify('Poison! Herbs or medicine would help.', 'bad');
                    }
                }
                if (distance > 55) {
                    a.angry = false;
                }
                if (!a.growled && spec.sound) {
                    a.growled = true;
                    G.audio.play(spec.sound);
                }
            }
        } else if (spec.flees && wantsFood) {
            // Comes closer when you carry what it likes
            this.turnTo(a, toPlayer, dt, 5);
            speed = distance > 1.8 ? spec.walk * 1.3 : 0;
        } else if (spec.flees && distance < spec.flees) {
            this.turnTo(a, toPlayer + Math.PI, dt, 6);
            speed = spec.run;
        } else {
            a.growled = false;
            if (a.timer <= 0) {
                a.timer = 2 + Math.random() * 5;
                a.walking = Math.random() < 0.55;
                a.heading += (Math.random() - 0.5) * 2.4;
            }
            speed = a.walking ? spec.walk : 0;
        }
        if (speed > 0) {
            this.step(a, dt, speed);
        }
        a.speed = speed;
        const h = G.world.heightAt(a.x, a.z);
        a.y = spec.swims && h < -0.15 ? -0.15 : h;
    }

    updateFlyer(a, dt, distance) {
        const {G} = this;
        // A parrot comes down when you carry what it likes
        if (a.spec.tame && G.has(a.spec.tame.item) && distance < 26) {
            const p = G.player.position;
            const look = G.player.lookDir;
            const gx = p.x + look.x * 2;
            const gz = p.z + look.z * 2;
            a.x += (gx - a.x) * Math.min(1, dt * 0.9);
            a.z += (gz - a.z) * Math.min(1, dt * 0.9);
            a.y += (G.player.feet + 2 - a.y) * Math.min(1, dt * 1.2);
            a.heading = Math.atan2(gx - a.x, gz - a.z);
            a.speed = a.spec.walk;
            return;
        }
        a.orbit += dt * 0.32;
        a.heading = a.orbit + Math.PI / 2;
        a.x += Math.sin(a.heading) * a.spec.walk * dt;
        a.z += Math.cos(a.heading) * a.spec.walk * dt;
        const h = Math.max(0, G.world.heightAt(a.x, a.z));
        const target = h + a.altitude + Math.sin(a.orbit * 2) * 1.5;
        a.y += (target - a.y) * Math.min(1, dt);
        a.speed = a.spec.walk;
        if (distance < 22 && Math.random() < dt * 0.05) {
            G.audio.play('parrot');
        }
    }

    updateTame(a, dt, distance, toPlayer) {
        const {G} = this;
        const {spec} = a;
        const p = G.player.position;
        if (distance > 45) {
            a.x = p.x - Math.sin(toPlayer) * 6;
            a.z = p.z - Math.cos(toPlayer) * 6;
        }
        if (spec.flying) {
            a.orbit += dt * 0.7;
            const gx = p.x + Math.cos(a.orbit) * 5;
            const gz = p.z + Math.sin(a.orbit) * 5;
            a.x += (gx - a.x) * Math.min(1, dt * 1.5);
            a.z += (gz - a.z) * Math.min(1, dt * 1.5);
            const gy = G.player.feet + 3.2 + Math.sin(a.orbit * 2) * 0.4;
            a.y += (gy - a.y) * Math.min(1, dt * 2);
            a.heading = a.orbit + Math.PI / 2;
            a.speed = 5;
        } else {
            let speed = 0;
            const prey = spec.damage > 0 ? this.list.find(o => o.spec.predator && !o.tame && !o.dead && Math.hypot(o.x - a.x, o.z - a.z) < 18) : null;
            if (prey) {
                const away = Math.hypot(prey.x - a.x, prey.z - a.z);
                this.turnTo(a, Math.atan2(prey.x - a.x, prey.z - a.z), dt, 6);
                speed = away > 2 ? spec.run : 0;
                a.attackIn -= dt;
                if (away < 2.3 && a.attackIn <= 0) {
                    a.attackIn = 1;
                    this.hit(prey, spec.damage, true);
                }
            } else if (distance > 3.2) {
                this.turnTo(a, toPlayer, dt, 5);
                speed = distance > 9 ? spec.run : spec.walk * 1.8;
            }
            if (speed > 0) {
                this.step(a, dt, speed);
            }
            a.speed = speed;
            a.y = Math.max(G.world.heightAt(a.x, a.z), -0.1);
        }
        // Companions bring things now and then
        a.bringIn -= dt;
        if (a.bringIn <= 0) {
            a.bringIn = 110 + Math.random() * 90;
            if (a.name === 'monkey') {
                G.give(Math.random() < 0.5 ? 'banana' : 'mango', 1);
                G.notify('Your monkey found you some fruit.', 'good');
            } else if (a.name === 'boar') {
                G.give('mushroom', 1);
                G.notify('Your boar dug up a mushroom.', 'good');
            }
        }
    }

    pose(a, dt) {
        const {group, limbs, wings, frames} = a;
        group.position.set(a.x, a.y, a.z);
        group.rotation.y = a.heading;
        const moving = (a.speed || 0) > 0.05;
        a.phase += dt * (moving ? 3 + a.speed * 1.6 : 0);
        if (limbs.length) {
            const swing = moving ? (a.spec.swing || 0.8) * Math.sin(a.phase) : 0;
            limbs.forEach((leg, i) => {
                leg.rotation.x = (i === 0 || i === 3 ? 1 : -1) * swing;
            });
        }
        if (wings) {
            const flap = Math.sin(this.G.now * 14 + a.phase) * 0.85;
            wings[0].rotation.z = -flap;
            wings[1].rotation.z = flap;
        }
        if (frames) {
            const second = moving && Math.floor(this.G.now * 5 + a.phase) % 2 === 1;
            frames[0].visible = !second;
            frames[1].visible = second;
        }
    }

    hit(a, damage, byCompanion = false) {
        const {G} = this;
        a.hp -= damage;
        if (a.hp <= 0) {
            this.kill(a);
            return;
        }
        if (!byCompanion) {
            a.angry = a.spec.damage > 0;
            this.showLife(a);
        }
        if (a.spec.sound) {
            G.audio.play(a.spec.sound);
        }
    }

    // The life bar over an animal you have hit
    showLife(a) {
        if (!a.life) {
            const top = new THREE.Box3().setFromObject(a.group).max.y;
            const width = 1.1;
            const flat = hex => new THREE.MeshBasicMaterial({color: hex, depthTest: false, transparent: true, fog: false, toneMapped: false});
            const edge = new THREE.Mesh(LIFE_BAR, flat(0x111311));
            edge.scale.set(width + 0.07, 0.21, 1);
            edge.renderOrder = 6;
            const fill = new THREE.Mesh(LIFE_BAR, flat(0x5fd35a));
            fill.scale.set(width, 0.15, 1);
            fill.renderOrder = 7;
            const group = new THREE.Group();
            group.add(edge, fill);
            this.G.scene.add(group);
            a.life = {group, fill, width, above: top - a.group.position.y + 0.45};
        }
        a.life.until = this.G.now + 6;
    }

    updateLife(a) {
        const {G} = this;
        const {life} = a;
        const camera = G.camera.position;
        const fighting = a.angry && Math.hypot(a.x - camera.x, a.z - camera.z) < 40;
        life.group.visible = fighting || G.now < life.until;
        if (!life.group.visible) {
            return;
        }
        const share = Math.max(0, a.hp / a.spec.hp);
        life.fill.scale.x = life.width * share;
        life.fill.position.x = -life.width * (1 - share) / 2;
        life.fill.material.color.setHex(share > 0.55 ? 0x5fd35a : share > 0.25 ? 0xf0c232 : 0xe5402e);
        const {position} = a.group;
        life.group.position.set(position.x, position.y + life.above, position.z);
        life.group.quaternion.copy(G.camera.quaternion);
        // The same size on the screen, near or far
        life.group.scale.setScalar(Math.max(0.5, life.group.position.distanceTo(camera)) * 0.22);
    }

    dropLife(a) {
        if (a.life) {
            this.G.scene.remove(a.life.group);
            a.life.group.children.forEach(mesh => mesh.material.dispose());
            a.life = null;
        }
    }

    kill(a) {
        const {G} = this;
        this.dropLife(a);
        a.dead = true;
        a.timer = 90;
        a.group.rotation.z = 0;
        a.group.children[0].rotation.z = 0;
        const {x, z} = a;
        a.group.rotation.set(0, a.heading, Math.PI / 2 * 0.95);
        a.group.position.y = Math.max(0, G.world.heightAt(x, z)) + a.spec.r * 0.75;
        if (a.spec.flying) {
            a.y = Math.max(0.1, G.world.heightAt(x, z));
            a.group.position.y = a.y + 0.1;
        }
        a.thing = {
            x, y: a.group.position.y, z, reach: 3, animal: a,
            menu: () => [{
                label: (a.name === 'crab' ? 'Take ' : 'Butcher ') + a.spec.name,
                run: () => {
                    const knife = G.findTool('knife');
                    if (knife) {
                        G.holdTool(['knife']);
                    }
                    const finish = () => {
                        for (const [id, n] of Object.entries(a.spec.drops)) {
                            G.give(id, n + (knife && ITEMS[id] && n > 1 ? 1 : 0));
                        }
                        G.audio.play('pick');
                        this.remove(a);
                    };
                    if (knife) {
                        G.player.swing(finish);
                    } else {
                        G.player.reachOut(finish);
                    }
                }
            }]
        };
        G.space.addThing(a.thing);
    }

    // The nearest animal in front of the player
    ahead(range) {
        const {G} = this;
        const p = G.player.position;
        const forward = G.player.lookDir;
        let best = null;
        let bestScore = 1e9;
        for (const a of this.list) {
            if (a.dead) {
                continue;
            }
            const dx = a.x - p.x;
            const dz = a.z - p.z;
            const dy = a.y - G.player.feet;
            const distance = Math.hypot(dx, dz);
            if (distance > range + a.spec.r || Math.abs(dy) > 6 && !a.spec.flying) {
                continue;
            }
            const dot = (dx * forward.x + dz * forward.z) / Math.max(0.2, distance) / Math.max(0.2, Math.hypot(forward.x, forward.z));
            if (dot < 0.62 && distance > 1.2) {
                continue;
            }
            const score = distance - dot * 2;
            if (score < bestScore) {
                best = a;
                bestScore = score;
            }
        }
        return best;
    }

    menuFor(a) {
        const {G} = this;
        const {spec} = a;
        const menu = [];
        if (a.tame) {
            menu.push({label: 'Pet your ' + spec.name, run: () => {
                G.notify('Your ' + spec.name + ' stays close to you.');
                if (spec.sound) {
                    G.audio.play(spec.sound);
                }
            }});
            return menu;
        }
        if (spec.catchable) {
            menu.push({label: 'Catch crab', run: () => G.player.reachOut(() => {
                G.give('crab_raw', 1);
                G.audio.play('pick');
                this.remove(a);
            })});
            return menu;
        }
        if (spec.tame && G.has(spec.tame.item)) {
            menu.push({
                label: 'Feed ' + ITEMS[spec.tame.item].name.toLowerCase() + ' to ' + spec.name + ' (' + a.gifts + '/' + spec.tame.n + ')',
                run: () => G.player.reachOut(() => {
                    G.takeItem(spec.tame.item);
                    a.gifts++;
                    a.angry = false;
                    a.calmUntil = G.now + 12;
                    if (a.gifts >= spec.tame.n) {
                        a.tame = true;
                        G.notify('The ' + spec.name + ' trusts you now, and follows you.', 'good');
                        G.saveSoon();
                    } else {
                        G.notify('The ' + spec.name + ' takes it. It wants more.');
                    }
                    if (spec.sound) {
                        G.audio.play(spec.sound);
                    }
                })
            });
        }
        menu.push({label: 'Attack ' + spec.name, run: () => G.player.attack(a)});
        return menu;
    }

    saveTamed() {
        return this.list.filter(a => a.tame && !a.dead).map(a => a.name);
    }

    loadTamed(names) {
        const p = this.G.player.position;
        names.forEach((name, i) => {
            this.create(name, p.x + 2 + i, p.z + 2, true).gifts = 99;
        });
    }

    // The fish are only for looks and for the spear, and swim near where the player is
    setUpFish() {
        const {G} = this;
        const count = G.quality === 'low' ? 30 : 70;
        this.fish = new THREE.InstancedMesh(fishGeometry(), this.material, count);
        this.fish.frustumCulled = false;
        const tints = ['#ffb340', '#ffe24d', '#4db8ff', '#ff6f91', '#c8e8f0', '#7fe0a8'].map(hex => new THREE.Color(hex));
        const school = [];
        for (let i = 0; i < count; i++) {
            const group = Math.floor(i / 10);
            this.fish.setColorAt(i, tints[group % tints.length]);
            school.push({group, offset: Math.random() * 6.3, radius: 1.5 + Math.random() * 3, height: Math.random() * 1.5, speed: 0.5 + Math.random() * 0.5, caught: 0});
        }
        this.school = school;
        this.schoolCenters = [];
        this.fishDummy = new THREE.Object3D();
        G.scene.add(this.fish);
    }

    updateFish(dt) {
        const {G} = this;
        const p = G.player.position;
        const groups = Math.ceil(this.school.length / 10);
        const nearWater = G.world.heightAt(p.x, p.z) < 3;
        this.fish.visible = nearWater;
        if (!nearWater) {
            return;
        }
        for (let g = 0; g < groups; g++) {
            let center = this.schoolCenters[g];
            if (!center || Math.hypot(center.x - p.x, center.z - p.z) > 70) {
                // A new place in the water, not too close
                for (let tries = 0; tries < 12; tries++) {
                    const a = Math.random() * 6.3;
                    const d = 12 + Math.random() * 45;
                    const x = p.x + Math.cos(a) * d;
                    const z = p.z + Math.sin(a) * d;
                    const h = G.world.heightAt(x, z);
                    if (h < -1.6) {
                        center = {x, z, y: Math.max(h + 0.8, -3 - Math.random() * 3)};
                        break;
                    }
                }
                this.schoolCenters[g] = center || {x: 1e5, z: 1e5, y: -3};
                center = this.schoolCenters[g];
            }
        }
        const dummy = this.fishDummy;
        const now = G.now;
        this.school.forEach((f, i) => {
            const center = this.schoolCenters[f.group];
            if (f.caught > now) {
                dummy.scale.setScalar(0);
            } else {
                const a = f.offset + now * f.speed;
                const x = center.x + Math.cos(a) * f.radius;
                const z = center.z + Math.sin(a) * f.radius;
                const y = this.fishDepth(x, z, center.y + Math.sin(a * 1.7) * 0.5 + f.height);
                // Always under the surface; where it is too shallow, none swims
                dummy.position.set(x, y === null ? 0 : y, z);
                dummy.rotation.set(0, -a, Math.sin(now * 9 + i) * 0.12);
                dummy.scale.setScalar(y === null ? 0 : 1);
            }
            dummy.updateMatrix();
            this.fish.setMatrixAt(i, dummy.matrix);
        });
        this.fish.instanceMatrix.needsUpdate = true;
    }

    // How high a fish swims here, always under water
    fishDepth(x, z, wanted) {
        const bottom = this.G.world.heightAt(x, z) + 0.25;
        if (bottom > -0.45) {
            return null;
        }
        return Math.max(bottom, Math.min(-0.45, wanted));
    }

    // A fish near the point, to spear. Returns true when one was caught.
    catchFish(x, y, z, range) {
        const now = this.G.now;
        for (let i = 0; i < this.school.length; i++) {
            const f = this.school[i];
            if (f.caught > now) {
                continue;
            }
            const center = this.schoolCenters[f.group];
            if (!center) {
                continue;
            }
            const a = f.offset + now * f.speed;
            const fx = center.x + Math.cos(a) * f.radius;
            const fy = this.fishDepth(fx, fz, center.y + f.height);
            if (fy === null) {
                continue;
            }
            const fz = center.z + Math.sin(a) * f.radius;
            if (Math.hypot(fx - x, fy - y, fz - z) < range) {
                f.caught = now + 60;
                return true;
            }
        }
        return false;
    }
}
