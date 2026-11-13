// What a felled tree or a broken rock leaves on the ground, until it is picked up.
import * as THREE from './lib/three.module.min.js';
import {ITEMS} from './items.js';
import {REGION, Shape, WHITE, color, v3} from './art.js';
import {rng} from './world.js';

const KEEP_HOURS = 72;
const NAMES = {log: 'logs', branch: 'branches', leaf: 'leaves', stone: 'stones', coconut: 'coconuts', bamboo: 'bamboo', iron_ore: 'iron ore', gold_ore: 'gold ore', crystal: 'crystals'};

function pile(id, n, random) {
    const s = new Shape();
    const shown = Math.min(n, id === 'leaf' ? 5 : 7);
    for (let i = 0; i < shown; i++) {
        const a = random() * 6.3;
        const x = (random() - 0.5) * 0.9;
        const z = (random() - 0.5) * 0.9;
        const dx = Math.cos(a);
        const dz = Math.sin(a);
        if (id === 'log' || id === 'bamboo') {
            // Side by side, with some on top
            const row = i % 3;
            const up = Math.floor(i / 3);
            const r = id === 'log' ? 0.15 : 0.06;
            const across = (row - 1) * r * 2.1 + up * r;
            const height = r + up * r * 1.7;
            const length = id === 'log' ? 0.85 : 1.1;
            s.tube([v3(-length, height, across), v3(length, height, across)], [r, r * 0.92], 7, id === 'log' ? REGION.barkTree : REGION.bamboo, WHITE, 1);
            if (id === 'log') {
                s.blob(length, height, across, 0.01, r * 0.9, r * 0.9, color('#c7a678'), REGION.plain, 7, 3);
                s.blob(-length, height, across, 0.01, r * 0.9, r * 0.9, color('#c7a678'), REGION.plain, 7, 3);
            }
        } else if (id === 'branch') {
            s.tube([v3(x - dx * 0.65, 0.05, z - dz * 0.65), v3(x, 0.08 + i * 0.015, z), v3(x + dx * 0.65, 0.05, z + dz * 0.65)], [0.045, 0.035, 0.018], 5, REGION.barkTree);
        } else if (id === 'leaf') {
            const size = 0.42;
            const y = 0.03 + i * 0.012;
            s.card(v3(x - size * dx + size * dz, y, z - size * dz - size * dx), v3(x + size * dx + size * dz, y, z + size * dz - size * dx),
                v3(x + size * dx - size * dz, y, z + size * dz + size * dx), v3(x - size * dx - size * dz, y, z - size * dz + size * dx), REGION.leaves, WHITE, v3(0, 1, 0));
        } else if (id === 'coconut') {
            s.blob(x, 0.15, z, 0.17, 0.15, 0.2, color('#e0b483'), REGION.barkPalm, 10, 8);
        } else if (id === 'stone') {
            s.rock(x, 0.1, z, 0.24, 0.16, 0.2, REGION.rock, random() * 1000, 8, 5);
        } else if (id === 'crystal') {
            s.at(x, 0, z, a, 1, (random() - 0.5) * 0.5, (random() - 0.5) * 0.5);
            s.tube([v3(0, 0, 0), v3(0, 0.2, 0), v3(0, 0.42, 0)], [0.07, 0.07, 0.004], 5, REGION.plain, color('#9ff0ff'));
            s.at();
        } else {
            s.rock(x, 0.12, z, 0.26, 0.18, 0.22, REGION.ore, random() * 1000, 8, 5, id === 'gold_ore' ? color('#ffe680') : WHITE);
        }
    }
    return s;
}

export class Drops {
    constructor(G) {
        this.G = G;
        this.list = [];
    }

    // deep: lies in a cave, at height y. delay: seconds until it is there, while the tree comes down.
    add(id, n, x, z, {deep = false, y, delay = 0, until} = {}) {
        const {G} = this;
        const ground = y !== undefined ? y : G.world.heightAt(x, z);
        const random = rng(Math.floor(x * 7 + z * 13) + id.length);
        const material = id === 'leaf' ? G.art.flora : id === 'crystal' ? G.places.glowMat() : id === 'iron_ore' || id === 'gold_ore' ? G.art.oreGlow : G.art.solid;
        const mesh = new THREE.Mesh(pile(id, n, random).geometry(), material);
        mesh.position.set(x, ground, z);
        mesh.rotation.y = random() * 6.3;
        mesh.castShadow = true;
        mesh.userData.below = deep;
        const drop = {id, n, x, y: ground, z, deep, mesh, appearIn: delay, until: until !== undefined ? until : G.clock + KEEP_HOURS};
        drop.thing = {
            x, y: ground + 0.3, z, reach: 2.7, deep,
            menu: () => [{label: this.label(drop), run: () => G.player.reachOut(() => this.pickUp(drop))}]
        };
        this.list.push(drop);
        if (delay <= 0) {
            this.show(drop);
        }
        return drop;
    }

    label(drop) {
        return 'Pick up ' + drop.n + ' ' + (NAMES[drop.id] || ITEMS[drop.id].name);
    }

    show(drop) {
        this.G.scene.add(drop.mesh);
        this.G.space.addThing(drop.thing);
        drop.shown = true;
    }

    pickUp(drop) {
        const {G} = this;
        if (!this.list.includes(drop)) {
            return;
        }
        const left = G.give(drop.id, drop.n);
        if (left < drop.n) {
            G.audio.play('pick');
        }
        drop.n = left;
        if (left <= 0) {
            this.remove(drop);
        }
        G.saveSoon();
    }

    remove(drop) {
        const {G} = this;
        if (drop.shown) {
            G.scene.remove(drop.mesh);
            G.space.removeThing(drop.thing);
        }
        drop.mesh.geometry.dispose();
        this.list.splice(this.list.indexOf(drop), 1);
    }

    update(dt) {
        const {G} = this;
        for (let i = this.list.length - 1; i >= 0; i--) {
            const drop = this.list[i];
            if (!drop.shown) {
                drop.appearIn -= dt;
                if (drop.appearIn <= 0) {
                    this.show(drop);
                }
            }
            if (G.clock > drop.until) {
                this.remove(drop);
            }
        }
    }

    toSave() {
        return this.list.map(({id, n, x, y, z, deep, until}) => ({id, n, x, y, z, deep, until}));
    }

    load(saved) {
        for (const {id, n, x, y, z, deep, until} of saved) {
            if (ITEMS[id]) {
                this.add(id, n, x, z, {deep, y, until});
            }
        }
    }
}
