// The player in the world: moving, swimming, the boat, what is in hand and what can be done right now.
import * as THREE from './lib/three.module.min.js';
import {BIOME, WORLD_SIZE} from './world.js';
import {ITEMS, SOS_STONES} from './items.js';
import {CAVES, atDoor, caveFloor, keepInCave} from './world.js';
import {REGION, Shape, color, softDot, v3} from './art.js';
import {drinkWater, heldSlot, heldTool} from './survivor.js';

const EYE = 1.62;
const SURFACE_FEET = -1.34;
const EDGE = WORLD_SIZE / 2 - 24;

function toolShape(id) {
    const s = new Shape();
    const stick = color('#8a6a44');
    const stone = color('#8d8a84');
    const iron = color('#b8bcc0');
    const head = id.endsWith('iron') ? iron : stone;
    const handle = (length, r = 0.022) => s.tube([v3(0, -0.14, 0), v3(0, length, 0)], [r, r * 0.9], 5, REGION.barkTree, stick);
    if (id.startsWith('axe')) {
        handle(0.56);
        s.box(0.06, 0.5, 0, 0.17, 0.11, 0.035, REGION.rock, head);
        s.box(0.15, 0.5, 0, 0.05, 0.17, 0.02, REGION.rock, head);
    } else if (id.startsWith('pick')) {
        handle(0.56);
        s.tube([v3(-0.22, 0.46, 0), v3(0, 0.55, 0), v3(0.22, 0.46, 0)], [0.008, 0.03, 0.008], 5, REGION.rock, head);
    } else if (id === 'shovel') {
        handle(0.62);
        s.box(0, 0.68, 0, 0.14, 0.19, 0.02, REGION.rock, stone);
    } else if (id.startsWith('knife')) {
        s.tube([v3(0, -0.05, 0), v3(0, 0.08, 0)], [0.02, 0.02], 5, REGION.barkTree, stick);
        s.tube([v3(0, 0.08, 0), v3(0, 0.27, 0)], [0.022, 0.003], 4, REGION.rock, head);
    } else if (id.startsWith('spear')) {
        s.tube([v3(0, -0.5, 0), v3(0, 1.0, 0)], [0.018, 0.016], 5, REGION.barkTree, stick);
        s.tube([v3(0, 1.0, 0), v3(0, 1.23, 0)], [0.035, 0.002], 4, REGION.rock, head);
    } else if (id === 'bow') {
        s.tube([v3(0, -0.36, 0), v3(0, -0.2, 0.09), v3(0, 0, 0.13), v3(0, 0.2, 0.09), v3(0, 0.36, 0)], [0.008, 0.014, 0.018, 0.014, 0.008], 5, REGION.bamboo);
        s.tube([v3(0, -0.36, 0), v3(0, 0.36, 0)], [0.002, 0.002], 3, REGION.plain, color('#e0dac8'));
    } else if (id === 'rod') {
        s.tube([v3(0, -0.14, 0), v3(0, 1.3, 0)], [0.016, 0.004], 5, REGION.bamboo);
    } else if (id === 'torch') {
        s.tube([v3(0, -0.16, 0), v3(0, 0.34, 0)], [0.024, 0.03], 5, REGION.barkTree, stick);
        s.blob(0, 0.37, 0, 0.05, 0.065, 0.05, color('#3d2d1f'), REGION.plain, 6, 4);
    } else {
        return null;
    }
    return s;
}

function armShape() {
    const s = new Shape();
    const skin = color('#c49a78');
    s.tube([v3(0.1, -0.2, 0.6), v3(0.02, -0.08, 0.27), v3(0, 0, 0)], [0.07, 0.056, 0.04], 7, REGION.plain, skin);
    s.blob(0, 0, 0, 0.055, 0.06, 0.05, skin, REGION.plain, 7, 5);
    return s;
}

export class Player {
    constructor(G) {
        this.G = G;
        this.position = new THREE.Vector3();
        this.velocity = new THREE.Vector3();
        this.yaw = 0;
        this.pitch = 0;
        this.lookDir = new THREE.Vector3(0, 0, -1);
        this.swimming = false;
        this.grounded = true;
        this.boat = null;
        this.move = {x: 0, y: 0};
        this.keys = {};
        this.jumpHeld = false;
        this.runOn = false;
        this.underground = null;
        this.diveHeld = false;
        this.running = false;
        this.stepPhase = 0;
        this.shake = 0;
        this.swingTime = 1;
        this.swingKind = 'swing';
        this.swingDone = null;
        this.heldId = null;
        this.fishing = null;
        this.arrows = [];
        this.options = [];
        this.lookedAt = 0;
        this.controlled = true;
        this.buildHand();
    }

    get feet() {
        return this.position.y;
    }

    get underwater() {
        return !this.underground && this.G.camera.position.y < -0.02;
    }

    // Going through the door of a cave, in or out
    checkDoors() {
        const {G, position: p} = this;
        if (this.underground) {
            const {out, side} = atDoor(this.underground, p.x, p.z);
            if (out > 0.4 && Math.abs(side) < 5) {
                this.underground = null;
            }
            return;
        }
        for (const cave of CAVES) {
            const {out, side} = atDoor(cave, p.x, p.z);
            if (out < 0.1 && out > -2.5 && Math.abs(side) < 2.7 && Math.abs(p.y - cave.door.y) < 2.6) {
                this.underground = cave;
                G.notify('It goes deep down here. A torch would help.');
                return;
            }
        }
    }

    buildHand() {
        const {G} = this;
        this.hand = new THREE.Group();
        this.hand.position.set(0.34, -0.33, -0.56);
        this.hand.visible = false;
        G.camera.add(this.hand);
        G.scene.add(G.camera);
        this.arm = new THREE.Mesh(armShape().geometry(), G.art.solid);
        this.hand.add(this.arm);
        this.toolHolder = new THREE.Group();
        this.toolHolder.rotation.x = -0.28;
        this.hand.add(this.toolHolder);
        this.torchLight = new THREE.PointLight(0xffa860, 0, 26, 1.6);
        this.torchLight.position.set(0.3, 0.5, -1.3);
        G.camera.add(this.torchLight);
        const flame = new THREE.Sprite(new THREE.SpriteMaterial({map: softDot('rgba(255,230,170,1)', 'rgba(255,120,30,0.8)'), blending: THREE.AdditiveBlending, depthWrite: false, fog: false}));
        flame.scale.setScalar(0.09);
        flame.position.set(0, 0.42, 0);
        flame.visible = false;
        this.flame = flame;
        this.toolHolder.add(flame);
    }

    placeAtStart(x, z, yaw) {
        const h = this.G.world.heightAt(x, z);
        this.position.set(x, h, z);
        this.yaw = yaw;
        this.pitch = 0;
        this.velocity.set(0, 0, 0);
    }

    updateHeld() {
        const {G} = this;
        const slot = heldSlot(G.you);
        const id = slot ? slot.id : null;
        if (id === this.heldId) {
            return;
        }
        this.heldId = id;
        if (this.toolMesh) {
            this.toolHolder.remove(this.toolMesh);
            this.toolMesh = null;
        }
        const shape = id ? toolShape(id) : null;
        if (shape) {
            this.toolMesh = new THREE.Mesh(shape.geometry(), G.art.solid);
            this.toolMesh.scale.setScalar(0.85);
            this.toolHolder.add(this.toolMesh);
        }
        this.flame.visible = id === 'torch';
        if (id !== 'rod') {
            this.stopFishing();
        }
        G.hud.markHotbar();
    }

    swing(done) {
        if (this.swingTime < 1) {
            return;
        }
        this.swingKind = 'swing';
        this.swingTime = 0;
        this.swingDone = done;
        this.swingDoneAt = 0.42;
        this.G.audio.play('swing');
    }

    reachOut(done) {
        if (this.swingTime < 1) {
            return;
        }
        this.swingKind = 'reach';
        this.swingTime = 0;
        this.swingDone = done;
        this.swingDoneAt = 0.4;
    }

    attack(animal) {
        const {G} = this;
        const tool = heldTool(G.you);
        const damage = tool ? tool.damage : 5;
        const range = tool && tool.type === 'spear' ? 3.4 : 2.5;
        this.swing(() => {
            G.you.energy = Math.max(0, G.you.energy - 3);
            const near = Math.hypot(animal.x - this.position.x, animal.z - this.position.z) < range + animal.spec.r + 0.6;
            if (near && !animal.dead) {
                G.animals.hit(animal, damage);
                G.audio.play('chop');
                G.effects.chips(animal.x, animal.y + 0.6, animal.z, '#7a1f1a');
                G.wearHeld(1);
            }
        });
    }

    shoot() {
        const {G} = this;
        if (!G.has('arrow')) {
            G.notify('You are out of arrows.');
            return;
        }
        if (this.swingTime < 1) {
            return;
        }
        this.swingKind = 'reach';
        this.swingTime = 0.2;
        this.swingDone = null;
        G.takeItem('arrow');
        G.audio.play('bow');
        G.wearHeld(1);
        const s = new Shape();
        s.tube([v3(0, 0, -0.35), v3(0, 0, 0.35)], [0.012, 0.012], 4, REGION.barkTree);
        const mesh = new THREE.Mesh(s.geometry(), G.art.solid);
        mesh.position.copy(G.camera.position).addScaledVector(this.lookDir, 0.6);
        mesh.lookAt(mesh.position.clone().add(this.lookDir));
        G.scene.add(mesh);
        this.arrows.push({mesh, velocity: this.lookDir.clone().multiplyScalar(46), life: 2.5});
    }

    updateArrows(dt) {
        const {G} = this;
        for (let i = this.arrows.length - 1; i >= 0; i--) {
            const arrow = this.arrows[i];
            arrow.life -= dt;
            arrow.velocity.y -= 6 * dt;
            arrow.mesh.position.addScaledVector(arrow.velocity, dt);
            arrow.mesh.lookAt(arrow.mesh.position.clone().add(arrow.velocity));
            const p = arrow.mesh.position;
            let stop = arrow.life <= 0 || p.y < (this.underground ? caveFloor(this.underground, p.x, p.z) : G.world.heightAt(p.x, p.z));
            for (const a of G.animals.list) {
                if (!a.dead && !a.tame && Math.hypot(a.x - p.x, a.y + a.spec.r - p.y, a.z - p.z) < a.spec.r + 0.55) {
                    const tool = ITEMS.bow.tool;
                    G.animals.hit(a, tool.damage);
                    G.effects.chips(p.x, p.y, p.z, '#7a1f1a');
                    stop = true;
                    break;
                }
            }
            if (stop) {
                G.scene.remove(arrow.mesh);
                this.arrows.splice(i, 1);
            }
        }
    }

    startFishing(x, z) {
        const {G} = this;
        const s = new Shape();
        s.blob(0, 0, 0, 0.05, 0.05, 0.05, color('#e04a3a'), REGION.plain, 6, 4);
        const bobber = new THREE.Mesh(s.geometry(), G.art.solid);
        bobber.position.set(x, 0.02, z);
        G.scene.add(bobber);
        G.audio.play('splash');
        this.fishing = {bobber, biteAt: G.now + 3 + Math.random() * 7, biting: false};
    }

    stopFishing() {
        if (this.fishing) {
            this.G.scene.remove(this.fishing.bobber);
            this.fishing = null;
        }
    }

    updateFishing() {
        const {G, fishing} = this;
        if (!fishing) {
            return;
        }
        const {bobber} = fishing;
        const distance = Math.hypot(bobber.position.x - this.position.x, bobber.position.z - this.position.z);
        if (distance > 13) {
            this.stopFishing();
            return;
        }
        fishing.biting = G.now >= fishing.biteAt && G.now < fishing.biteAt + 1.9;
        bobber.position.y = fishing.biting ? -0.1 + Math.sin(G.now * 22) * 0.05 : Math.sin(G.now * 2.4) * 0.018;
        if (fishing.biting && !fishing.alerted) {
            fishing.alerted = true;
            G.audio.play('bite');
        }
        if (G.now > fishing.biteAt + 1.9) {
            fishing.biteAt = G.now + 3 + Math.random() * 7;
            fishing.alerted = false;
        }
    }

    reel() {
        const {G, fishing} = this;
        if (!fishing) {
            return;
        }
        const caught = fishing.biting;
        this.stopFishing();
        G.audio.play('splash');
        if (caught) {
            const roll = Math.random();
            G.give(roll < 0.12 ? 'crab_raw' : 'fish_raw', 1);
            G.wearHeld(1);
        } else {
            G.notify('Nothing on the line.');
        }
    }

    board(item) {
        this.stopFishing();
        this.boat = item;
        this.boatSpeed = 0;
        this.yaw = item.turn;
        this.G.audio.play('splash');
    }

    leaveBoat() {
        const {G, boat} = this;
        if (!boat) {
            return;
        }
        let best = null;
        for (let i = 0; i < 16; i++) {
            const a = i / 16 * Math.PI * 2;
            for (const r of [2.4, 4, 6, 8]) {
                const x = boat.x + Math.cos(a) * r;
                const z = boat.z + Math.sin(a) * r;
                const h = G.world.heightAt(x, z);
                if (h > 0.05 && (!best || r < best.r)) {
                    best = {x, z, h, r};
                }
            }
        }
        if (!best) {
            for (let i = 0; i < 16; i++) {
                const a = i / 16 * Math.PI * 2;
                const x = boat.x + Math.cos(a) * 3;
                const z = boat.z + Math.sin(a) * 3;
                const h = G.world.heightAt(x, z);
                if (h > -1.1) {
                    best = {x, z, h, r: 3};
                    break;
                }
            }
        }
        if (!best) {
            G.notify('Too deep here. Sail to the shore first.');
            return;
        }
        this.boat = null;
        boat.mesh.position.set(boat.x, 0, boat.z);
        boat.mesh.rotation.set(0, boat.turn, 0);
        this.position.set(best.x, best.h + 0.1, best.z);
        this.velocity.set(0, 0, 0);
        G.saveSoon();
    }

    updateBoat(dt) {
        const {G, boat} = this;
        const throttle = this.move.y;
        const target = throttle * (throttle < 0 ? 2 : 6.5);
        this.boatSpeed += (target - this.boatSpeed) * Math.min(1, dt * 0.9);
        boat.turn -= this.move.x * dt * 0.75 * Math.min(1, 0.3 + Math.abs(this.boatSpeed) / 3);
        const nx = boat.x - Math.sin(boat.turn) * this.boatSpeed * dt;
        const nz = boat.z - Math.cos(boat.turn) * this.boatSpeed * dt;
        const h = G.world.heightAt(nx, nz);
        if (h < -0.32 && Math.abs(nx) < EDGE && Math.abs(nz) < EDGE) {
            boat.x = nx;
            boat.z = nz;
        } else {
            this.boatSpeed *= -0.2;
        }
        const roll = Math.sin(G.now * 1.2) * 0.04 * (1 + G.env.state.chop);
        const pitch = Math.sin(G.now * 0.9) * 0.025 * (1 + G.env.state.chop);
        const bob = Math.sin(G.now * 1.4) * 0.05 * (1 + G.env.state.chop);
        boat.mesh.position.set(boat.x, bob, boat.z);
        boat.mesh.rotation.set(pitch, boat.turn, roll);
        this.position.set(boat.x, bob + 0.2, boat.z);
        this.velocity.set(0, 0, 0);
    }

    readInput() {
        const k = this.keys;
        let x = this.touchMove ? this.touchMove.x : 0;
        let y = this.touchMove ? this.touchMove.y : 0;
        if (k.KeyA || k.ArrowLeft) x -= 1;
        if (k.KeyD || k.ArrowRight) x += 1;
        if (k.KeyW || k.ArrowUp) y += 1;
        if (k.KeyS || k.ArrowDown) y -= 1;
        const length = Math.hypot(x, y);
        if (length > 1) {
            x /= length;
            y /= length;
        }
        this.move.x = x;
        this.move.y = y;
        // A run lasts as long as the energy does; walking doesn't cost any
        if (this.runOn && this.G.you.energy <= 1) {
            this.runOn = false;
        }
        this.running = Boolean(k.ShiftLeft || k.ShiftRight || this.runOn);
        this.jumpHeld = Boolean(k.Space || this.jumpButton);
        this.diveHeld = Boolean(k.KeyC || k.ControlLeft || this.diveButton);
    }

    update(dt) {
        const {G, position: p, velocity: v} = this;
        this.readInput();
        const you = G.you;
        const fwd = {x: -Math.sin(this.yaw), z: -Math.cos(this.yaw)};
        const right = {x: Math.cos(this.yaw), z: -Math.sin(this.yaw)};
        const moving = Math.hypot(this.move.x, this.move.y) > 0.05;
        let sprinting = false;

        if (this.boat) {
            this.updateBoat(dt);
            this.swimming = false;
            this.grounded = true;
        } else {
            this.checkDoors();
            const below = this.underground;
            const terrain = below ? caveFloor(below, p.x, p.z) : G.world.heightAt(p.x, p.z);
            const depthHere = below ? 0 : -terrain;
            if (!this.swimming && depthHere > 1.2 && p.y <= SURFACE_FEET + 0.15) {
                this.swimming = true;
                G.audio.play('splash');
            } else if (this.swimming && (depthHere < 1.12)) {
                this.swimming = false;
            }

            if (this.swimming) {
                const speed = (this.running && you.energy > 2 ? 3.6 : 2.5);
                sprinting = false;
                const look = this.lookDir;
                const diving = p.y < SURFACE_FEET - 0.25 || this.pitch < -0.32;
                const wanted = new THREE.Vector3(
                    fwd.x * this.move.y + right.x * this.move.x, 0, fwd.z * this.move.y + right.z * this.move.x);
                wanted.multiplyScalar(speed * (diving ? Math.cos(this.pitch) : 1));
                if (diving) {
                    wanted.y = look.y * this.move.y * speed;
                }
                if (this.diveHeld) {
                    wanted.y -= 2.8;
                }
                if (this.jumpHeld) {
                    wanted.y += 3;
                }
                // Floats back up slowly when nothing is pressed
                if (!this.diveHeld && !this.jumpHeld && !moving) {
                    wanted.y += 0.9;
                }
                v.lerp(wanted, Math.min(1, dt * 3.4));
                p.addScaledVector(v, dt);
                const bottom = G.world.heightAt(p.x, p.z) + 0.25;
                if (p.y < bottom) {
                    p.y = bottom;
                    v.y = Math.max(0, v.y);
                }
                if (p.y > SURFACE_FEET) {
                    p.y = Math.max(SURFACE_FEET, p.y - dt * 6);
                    if (p.y < SURFACE_FEET + 0.01) {
                        p.y = SURFACE_FEET;
                    }
                    v.y = Math.min(v.y, 0);
                }
            } else {
                let speed = 4.3;
                if (this.running && you.energy > 3 && this.move.y > 0.2) {
                    speed = 7.3;
                    sprinting = moving;
                }
                const biome = below ? BIOME.CAVE : G.world.biomeAt(p.x, p.z);
                if (biome === BIOME.SWAMP) speed *= 0.72;
                if (!below && terrain < 0 && p.y < 0.1) speed *= 1 - Math.min(0.5, -terrain * 0.4);
                speed *= 1 - Math.min(0.2, G.env.state.wind * 0.08);
                if (you.energy < 1) speed *= 0.8;
                const wx = (fwd.x * this.move.y + right.x * this.move.x) * speed;
                const wz = (fwd.z * this.move.y + right.z * this.move.x) * speed;
                const grip = this.grounded ? 12 : 2.5;
                v.x += (wx - v.x) * Math.min(1, dt * grip);
                v.z += (wz - v.z) * Math.min(1, dt * grip);
                p.x += v.x * dt;
                p.z += v.z * dt;
                G.space.pushOut(p, 0.35, p.y, p.y + 1.7, Boolean(below));
                if (below) {
                    keepInCave(below, p);
                }
                const ground = below ? caveFloor(below, p.x, p.z) : Math.max(G.world.heightAt(p.x, p.z), G.space.floorAt(p.x, p.z, p.y));
                v.y -= 18 * dt;
                p.y += v.y * dt;
                if (p.y <= ground) {
                    // Falling a long way hurts a little
                    if (v.y < -11) {
                        G.hurt((-v.y - 11) * 4, 'fell to death');
                    }
                    p.y = ground;
                    v.y = 0;
                    this.grounded = true;
                } else if (p.y > ground + 0.28) {
                    this.grounded = false;
                } else if (v.y < 0) {
                    p.y = ground;
                    v.y = 0;
                    this.grounded = true;
                }
                if (this.jumpHeld && this.grounded && you.energy > 4) {
                    v.y = 5.6;
                    this.grounded = false;
                    you.energy -= 4;
                }
                if (moving && this.grounded) {
                    const before = this.stepPhase;
                    this.stepPhase += dt * speed * 1.62;
                    if (Math.floor(before / Math.PI) !== Math.floor(this.stepPhase / Math.PI)) {
                        const ground2 = below ? 1 : G.world.heightAt(p.x, p.z);
                        G.audio.play(ground2 < 0.05 ? 'stepWater' : biome === BIOME.BEACH ? 'stepSand' : 'step');
                    }
                }
            }
            if (this.swimming) {
                G.space.pushOut(p, 0.35, p.y, p.y + 1.7);
            }
            // The currents keep you near the island
            if (Math.abs(p.x) > EDGE || Math.abs(p.z) > EDGE) {
                p.x = Math.max(-EDGE, Math.min(EDGE, p.x));
                p.z = Math.max(-EDGE, Math.min(EDGE, p.z));
                if (!this.edgeWarned) {
                    this.edgeWarned = true;
                    G.notify('The current is too strong out here.');
                }
            } else {
                this.edgeWarned = false;
            }
        }

        const camera = G.camera;
        const bob = !this.swimming && !this.boat && moving && this.grounded ? Math.sin(this.stepPhase * 2) * 0.03 : 0;
        const float = this.swimming && p.y >= SURFACE_FEET - 0.05 ? Math.sin(G.now * 1.7) * 0.04 : 0;
        const eye = this.boat ? 1.0 : EYE;
        camera.position.set(p.x, p.y + eye + bob + float, p.z);
        // In a boat you sit towards the back
        if (this.boat) {
            camera.position.x += Math.sin(this.boat.turn) * 1.2;
            camera.position.z += Math.cos(this.boat.turn) * 1.2;
        }
        const shakeNow = this.shake;
        this.shake = Math.max(0, this.shake - dt * 2);
        camera.rotation.order = 'YXZ';
        camera.rotation.set(
            this.pitch + (shakeNow ? (Math.random() - 0.5) * shakeNow * 0.05 : 0),
            this.yaw + (shakeNow ? (Math.random() - 0.5) * shakeNow * 0.05 : 0),
            this.boat ? this.boat.mesh.rotation.z * 0.6 : 0);
        this.lookDir.set(0, 0, -1).applyEuler(camera.rotation);

        this.updateHeld();
        this.animateHand(dt, moving);
        this.updateFishing();
        this.updateArrows(dt);
        this.lookedAt -= dt;
        if (this.lookedAt <= 0) {
            this.lookedAt = 0.09;
            this.options = this.findOptions();
            G.hud.showOptions(this.options);
        }
        const inWater = !this.underground && !this.boat && G.world.heightAt(p.x, p.z) < -0.15 && p.y < 0.2;
        return {sprinting, moving, inWater};
    }

    animateHand(dt, moving) {
        const {G, hand} = this;
        const slot = heldSlot(G.you);
        const id = slot ? slot.id : null;
        // An empty hand only shows when it does something
        hand.visible = !G.building.placing && (Boolean(this.toolMesh) || this.swingTime < 1);
        if (this.swingTime < 1) {
            const length = this.swingKind === 'swing' ? 0.42 : 0.3;
            const before = this.swingTime;
            this.swingTime = Math.min(1, this.swingTime + dt / length);
            if (this.swingDone && before < this.swingDoneAt && this.swingTime >= this.swingDoneAt) {
                const done = this.swingDone;
                this.swingDone = null;
                done();
            }
        }
        const t = this.swingTime;
        const arc = t < 1 ? Math.sin(t * Math.PI) : 0;
        const walk = moving ? Math.sin(this.stepPhase) : 0;
        const breathe = Math.sin(G.now * 1.5) * 0.005;
        hand.position.set(0.34 + walk * 0.012, -0.33 + Math.abs(walk) * 0.012 + breathe, -0.56);
        hand.rotation.set(0, 0, 0);
        if (this.swingKind === 'swing') {
            const wind = t < 0.3 ? t / 0.3 : Math.max(0, 1 - (t - 0.3) / 0.25);
            const strike = t < 0.3 ? 0 : Math.sin(Math.min(1, (t - 0.3) / 0.7) * Math.PI);
            hand.rotation.x = wind * 0.7 - strike * 1.25;
            hand.position.z -= strike * 0.2;
            hand.position.x -= strike * 0.12;
            hand.position.y += wind * 0.08;
        } else {
            hand.position.z -= arc * 0.32;
            hand.position.y += arc * 0.08;
            hand.position.x -= arc * 0.12;
        }
        if (id === 'torch') {
            const under = G.camera.position.y < 0;
            this.torchLight.intensity = under ? 0 : 19 + Math.sin(G.now * 13) * 2.2;
            this.flame.visible = !under;
            this.flame.scale.setScalar(0.09 + Math.sin(G.now * 17) * 0.012);
        } else {
            this.torchLight.intensity = 0;
        }
    }

    // What can be done right now, most likely first
    findOptions() {
        const {G, position: p} = this;
        const {building} = G;
        if (G.cutscene || building.placing) {
            return [];
        }
        const options = [];
        if (this.boat) {
            options.push({label: 'Leave boat', run: () => this.leaveBoat()});
        }
        const look = this.lookDir;
        const flatLength = Math.max(0.01, Math.hypot(look.x, look.z));
        let target = null;
        let targetScore = 1e9;
        const deep = Boolean(this.underground);
        for (const thing of G.space.things.near(p.x, p.z, 0.5)) {
            if (Boolean(thing.deep) !== deep) {
                continue;
            }
            const dx = thing.x - p.x;
            const dz = thing.z - p.z;
            const dy = (thing.y === undefined ? p.y : thing.y) - (p.y + 1);
            const flat = Math.hypot(dx, dz);
            const reach = thing.reach || 3;
            if (flat > reach || Math.abs(dy) > Math.max(3, reach)) {
                continue;
            }
            let score = flat;
            if (reach < 8 && flat > 1.1) {
                const dot = (dx * look.x + dz * look.z) / flat / flatLength;
                if (dot < 0.55) {
                    continue;
                }
                score = flat * 0.5 + (1 - dot) * 9;
            } else if (reach >= 8) {
                score = 2.5;
            }
            if (building.removing ? !thing.rec : false) {
                continue;
            }
            if (score < targetScore) {
                const list = building.removing ? this.removeOption(thing) : thing.menu(G, thing);
                if (list.length) {
                    target = list;
                    targetScore = score;
                }
            }
        }
        const tool = heldTool(G.you);
        const animal = deep ? null : G.animals.ahead(tool && tool.type === 'spear' ? 3.8 : 2.8);
        if (animal && (!target || targetScore > 1.2) && !building.removing) {
            options.push(...G.animals.menuFor(animal));
        }
        if (target) {
            options.push(...target);
        }
        // With stones in the bag, laying them is always on offer near the SOS, also among palms
        const sign = building.sos;
        if (sign && !deep && !building.removing && sign.laid < SOS_STONES && G.count('stone') && Math.hypot(sign.x - p.x, sign.z - p.z) <= 17) {
            const lay = building.sosMenu(sign)[0];
            if (!options.some(option => option.label === lay.label)) {
                options.splice(Math.min(1, options.length), 0, lay);
            }
        }
        if (options.length < 2 && !deep) {
            options.push(...this.waterOptions(tool));
        }
        if (!options.length || (options.length < 2 && !building.removing)) {
            const own = this.heldOption(tool);
            if (own) {
                options.push(own);
            }
        }
        return options.filter(Boolean).slice(0, 2);
    }

    removeOption(thing) {
        const rec = thing.rec;
        return [{label: 'Remove ' + rec.type, run: () => {
            this.G.building.remove(rec);
            this.G.saveSoon();
        }}];
    }

    waterOptions(tool) {
        const {G, position: p} = this;
        const options = [];
        const ahead = 2.4;
        const fx = p.x + this.lookDir.x * ahead;
        const fz = p.z + this.lookDir.z * ahead;
        const here = G.world.heightAt(p.x, p.z);
        const there = G.world.heightAt(fx, fz);
        const inReach = !this.boat && (here < 0.02 || there < -0.03) && this.pitch < 0.45;
        if (this.fishing) {
            return [{label: this.fishing.biting ? 'Reel in!' : 'Reel in', urgent: this.fishing.biting, run: () => this.reel()}];
        }
        if (tool && tool.type === 'rod' && !this.swimming) {
            const far = 7;
            const tx = p.x + this.lookDir.x / Math.max(0.2, Math.hypot(this.lookDir.x, this.lookDir.z)) * far;
            const tz = p.z + this.lookDir.z / Math.max(0.2, Math.hypot(this.lookDir.x, this.lookDir.z)) * far;
            if (G.world.heightAt(tx, tz) < -0.7) {
                options.push({label: 'Cast line', run: () => this.startFishing(tx, tz)});
            }
        }
        if (tool && tool.type === 'spear' && (this.swimming || here < -0.3)) {
            options.push({
                label: 'Spear fish',
                run: () => this.swing(() => {
                    const c = G.camera.position;
                    const l = this.lookDir;
                    if (G.animals.catchFish(c.x + l.x * 1.8, c.y + l.y * 1.8, c.z + l.z * 1.8, 1.9)) {
                        G.give('fish_raw', 1);
                        G.wearHeld(1);
                        G.audio.play('splash');
                    } else {
                        G.audio.play('swing');
                    }
                })
            });
        }
        if (inReach && !this.underwater) {
            const kind = G.world.waterAt(here < 0.02 ? p.x : fx, here < 0.02 ? p.z : fz);
            options.push({
                label: kind === 'sea' ? 'Drink sea water' : kind === 'swamp' ? 'Drink swamp water' : 'Drink river water',
                run: () => this.reachOut(() => {
                    G.audio.play('drink');
                    const message = drinkWater(G.you, kind);
                    if (message) {
                        G.notify(message, 'bad');
                    }
                })
            });
            if (kind !== 'sea' && G.has('flask')) {
                options.unshift({
                    label: 'Fill flask',
                    run: () => {
                        G.takeItem('flask');
                        G.give('flask_dirty', 1);
                        G.audio.play('drink');
                    }
                });
            }
        }
        return options;
    }

    heldOption(tool) {
        const {G} = this;
        const slot = heldSlot(G.you);
        if (!slot) {
            return null;
        }
        const item = ITEMS[slot.id];
        if (item.food || item.heal) {
            const drink = item.food && item.food.thirst > item.food.hunger;
            return {label: (drink ? 'Drink ' : item.heal ? 'Use ' : 'Eat ') + item.name.toLowerCase(), run: () => G.useSlot(G.you.held)};
        }
        if (tool && tool.type === 'bow') {
            return {label: 'Shoot (' + G.count('arrow') + ')', run: () => this.shoot()};
        }
        return null;
    }

    runOption(index) {
        const option = this.options[index];
        if (option && !option.disabled && option.run) {
            option.run();
            this.lookedAt = 0.12;
        }
    }

    look(dx, dy) {
        this.yaw -= dx;
        this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch - dy));
    }
}
