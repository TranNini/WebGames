// What walks at night: it watches, it follows, and when it reaches you, it is over.
import * as THREE from './lib/three.module.min.js';
import {caveFloor, keepInCave} from './world.js';
import {REGION, Shape, v3} from './art.js';

const SPEED = 5;
const REACHES_YOU = 1.5;
const SEES_YOU = 75;
const STAYS_OUT_OF_FIRE = 8;

function bone(length, top, bottom) {
    const s = new Shape();
    s.tube([v3(0, 0, 0), v3(0, -length * 0.5, 0), v3(0, -length, 0)], [top, (top + bottom) / 2, bottom], 5, REGION.plain);
    return s.geometry();
}

function build() {
    const dark = new THREE.MeshLambertMaterial({color: 0x24242c, emissive: 0x0c0c10});
    const white = new THREE.MeshBasicMaterial({color: 0xe9e8e2, fog: false});
    const group = new THREE.Group();
    const part = (geometry, material, parent, x, y, z) => {
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(x, y, z);
        parent.add(mesh);
        return mesh;
    };
    const body = new Shape();
    body.tube([v3(0, 3, 0), v3(0, 3.5, 0.02), v3(0, 4.25, 0.08), v3(0, 4.6, 0.14), v3(0, 4.95, 0.16)], [0.13, 0.11, 0.17, 0.06, 0.05], 6, REGION.plain);
    body.tube([v3(-0.28, 4.3, 0.08), v3(0.28, 4.3, 0.08)], [0.07, 0.07], 5, REGION.plain);
    part(body.geometry(), dark, group, 0, 0, 0);
    // A smooth head without a face
    const head = new Shape();
    head.blob(0, 0, 0, 0.2, 0.29, 0.23, undefined, REGION.plain, 12, 10);
    part(head.geometry(), white, group, 0, 5.2, 0.18);
    const upper = bone(1.55, 0.075, 0.05);
    const lower = bone(1.55, 0.05, 0.035);
    const armUpper = bone(1.5, 0.05, 0.035);
    const armLower = bone(1.75, 0.035, 0.022);
    const finger = bone(0.42, 0.014, 0.003);
    const limb = (first, second, x, y) => {
        const top = new THREE.Group();
        top.position.set(x, y, 0.06);
        part(first.geo, dark, top, 0, 0, 0);
        const joint = new THREE.Group();
        joint.position.y = -first.length;
        top.add(joint);
        part(second.geo, dark, joint, 0, 0, 0);
        group.add(top);
        return {top, joint};
    };
    const legs = [-0.13, 0.13].map(x => limb({geo: upper, length: 1.55}, {geo: lower}, x, 3.05));
    const arms = [-0.3, 0.3].map(x => {
        const arm = limb({geo: armUpper, length: 1.5}, {geo: armLower}, x, 4.3);
        for (let i = 0; i < 4; i++) {
            const f = part(finger, dark, arm.joint, 0, -1.72, 0);
            f.rotation.set((i - 1.5) * 0.14, 0, (i - 1.5) * 0.2);
        }
        return arm;
    });
    group.userData.deep = true;
    group.visible = false;
    return {group, legs, arms};
}

export class Stalker {
    constructor(G) {
        this.G = G;
        Object.assign(this, build());
        G.scene.add(this.group);
        this.state = 'gone';
        this.wait = 25 + Math.random() * 30;
        this.position = new THREE.Vector3(1e6, 0, 1e6);
        this.stride = 0;
        this.cave = null;
        this.warned = false;
    }

    get hunting() {
        return this.state !== 'gone';
    }

    // Stays near you at night: is it close enough to stop you sleeping?
    isAround() {
        const p = this.G.player.position;
        return this.hunting && Math.hypot(this.position.x - p.x, this.position.z - p.z) < SEES_YOU;
    }

    placeOutOfSight(near = 48, far = 62) {
        const {G} = this;
        const {player} = G;
        const p = player.position;
        const look = player.lookDir;
        for (let tries = 0; tries < 30; tries++) {
            const a = Math.random() * 6.28;
            const d = near + Math.random() * (far - near);
            const x = p.x + Math.cos(a) * d;
            const z = p.z + Math.sin(a) * d;
            const ahead = (Math.cos(a) * look.x + Math.sin(a) * look.z) / Math.max(0.2, Math.hypot(look.x, look.z));
            if (G.world.heightAt(x, z) > 0.25 && ahead < 0.35 && !G.building.nearFire(x, z, STAYS_OUT_OF_FIRE)) {
                this.position.set(x, G.world.heightAt(x, z), z);
                return true;
            }
        }
        return false;
    }

    appear() {
        const {G} = this;
        const cave = G.player.underground;
        if (cave) {
            this.enterCave(cave);
        } else if (!this.placeOutOfSight()) {
            this.wait = 6;
            return;
        }
        this.state = 'watching';
        this.watchFor = 2.5 + Math.random() * 3;
        this.group.visible = true;
    }

    enterCave(cave) {
        this.cave = cave;
        this.nextPoint = 1;
        const {x, y, z} = cave.path[0];
        this.position.set(x, y, z);
    }

    vanish() {
        this.state = 'gone';
        this.group.visible = false;
        this.cave = null;
        this.wait = 25 + Math.random() * 30;
    }

    // One step toward the player, or as far as it may go
    walk(dt, p) {
        const {G, position} = this;
        const step = SPEED * dt;
        if (this.cave) {
            const point = this.nextPoint < this.cave.path.length ? this.cave.path[this.nextPoint] : null;
            const tx = point ? point.x : p.x;
            const tz = point ? point.z : p.z;
            const d = Math.hypot(tx - position.x, tz - position.z);
            if (point && d < 1.5) {
                this.nextPoint++;
            }
            if (d > 0.01) {
                position.x += (tx - position.x) / d * step;
                position.z += (tz - position.z) / d * step;
            }
            keepInCave(this.cave, position, 0.8);
            position.y += (caveFloor(this.cave, position.x, position.z) - position.y) * Math.min(1, dt * 6);
            return true;
        }
        const d = Math.hypot(p.x - position.x, p.z - position.z);
        const nx = position.x + (p.x - position.x) / d * step;
        const nz = position.z + (p.z - position.z) / d * step;
        const h = G.world.heightAt(nx, nz);
        // It doesn't come into deep water, or into the light of a fire
        if (h < -0.7 || G.building.nearFire(nx, nz, STAYS_OUT_OF_FIRE)) {
            return false;
        }
        position.x = nx;
        position.z = nz;
        position.y += (Math.max(h, -0.7) - position.y) * Math.min(1, dt * 8);
        return true;
    }

    pose(dt, moving) {
        const {group, legs, arms, position} = this;
        const p = this.G.player.position;
        group.position.copy(position);
        group.rotation.y = Math.atan2(p.x - position.x, p.z - position.z);
        if (moving) {
            this.stride += dt * 3.1;
        }
        const swing = moving ? Math.sin(this.stride) : 0;
        legs[0].top.rotation.x = -swing * 0.55;
        legs[1].top.rotation.x = swing * 0.55;
        legs[0].joint.rotation.x = moving ? Math.max(0, swing) * 0.9 : 0.04;
        legs[1].joint.rotation.x = moving ? Math.max(0, -swing) * 0.9 : 0.04;
        const hang = Math.sin(this.G.now * 0.9) * 0.03;
        arms[0].top.rotation.set(swing * 0.35 - 0.05 + hang, 0, -0.08);
        arms[1].top.rotation.set(-swing * 0.35 - 0.05 - hang, 0, 0.08);
        arms[0].joint.rotation.x = -0.14;
        arms[1].joint.rotation.x = -0.14;
    }

    update(dt) {
        const {G} = this;
        const {env, player} = G;
        if (!env.isNight) {
            if (this.hunting) {
                this.vanish();
            }
            return;
        }
        if (!this.warned) {
            this.warned = true;
            if (!G.saved.warnedOfNight) {
                G.saved.warnedOfNight = true;
                G.notify('It is dark now. Stay close to a fire.', 'bad');
            }
        }
        if (!this.hunting) {
            this.wait -= dt;
            if (this.wait <= 0) {
                this.appear();
            }
            return;
        }
        // The cave and the world above are two places: it comes after you
        const under = player.underground;
        if (under && this.cave !== under) {
            this.enterCave(under);
            this.state = 'watching';
            this.watchFor = 3;
        } else if (!under && this.cave) {
            this.cave = null;
            this.placeOutOfSight(30, 42);
            this.state = 'watching';
            this.watchFor = 2;
        }
        const p = player.position;
        const distance = Math.hypot(p.x - this.position.x, p.z - this.position.z);
        if (!this.cave && distance > 105) {
            // Never far behind
            this.placeOutOfSight(55, 70);
            this.state = 'watching';
            this.watchFor = 1.5;
        }
        let moving = false;
        if (this.state === 'watching') {
            this.watchFor -= dt;
            if (this.watchFor <= 0 && (this.cave || distance < SEES_YOU)) {
                this.state = 'following';
                G.audio.play('seen');
            }
        } else {
            moving = this.walk(dt, p);
            if (!moving && !this.cave) {
                // Held back: it stands and waits
                this.state = 'waiting';
            } else if (this.state === 'waiting') {
                this.state = 'following';
                G.audio.play('seen');
            }
        }
        this.pose(dt, moving);
        if (this.state !== 'watching' && Math.hypot(p.x - this.position.x, p.z - this.position.z) < REACHES_YOU) {
            this.catch();
        }
    }

    catch() {
        const {G} = this;
        if (G.cutscene) {
            return;
        }
        G.audio.play('taken');
        G.hud.flashHurt();
        G.you.health = 0;
        G.die('were taken by what walks at night');
    }
}
