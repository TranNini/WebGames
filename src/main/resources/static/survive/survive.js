// Survive: Lost Island. Holds the world together: the frame loop, the rules of a day, saving and the end of the game.
import * as THREE from './lib/three.module.min.js';
import {CAVES, PLACES, buildWorld} from './world.js';
import {ITEMS} from './items.js';
import {HOURS_PER_SECOND, add, count, hasAll, heldSlot, newSurvivor, sleepFor, take, takeAll, tick, wearHeld, eat} from './survivor.js';
import {makeArt, shared} from './art.js';
import {Environment, buildTerrain, shadeTerrain} from './ground.js';
import {Space} from './space.js';
import {Flora} from './flora.js';
import {Places, NOTES} from './places.js';
import {Building} from './building.js';
import {Animals} from './animals.js';
import {Drops} from './drops.js';
import {Stalker} from './stalker.js';
import {Player} from './player.js';
import {Hud} from './hud.js';
import {IslandAudio} from './audio.js';
import {CrashScene, Helicopter, WakeScene} from './intro.js';

const SAVE_KEY = 'survive-save';
const QUALITY_KEY = 'survive-quality';
const START_HOUR = 7.5;
const RESCUE_DAY = 31; // after 30 days
const RESCUE_HOUR = 9;
const el = id => document.getElementById(id);
const testing = new URLSearchParams(location.search).has('test');

function chooseQuality() {
    const saved = remembered(QUALITY_KEY).value;
    if (saved && saved !== 'auto') {
        return saved;
    }
    if (navigator.maxTouchPoints === 0) {
        return 'high';
    }
    return navigator.deviceMemory && navigator.deviceMemory < 4 ? 'low' : 'medium';
}

class Effects {
    constructor(G) {
        this.G = G;
        this.max = 64;
        this.positions = new Float32Array(this.max * 3).fill(-1000);
        this.colors = new Float32Array(this.max * 3);
        this.parts = Array.from({length: this.max}, () => ({life: 0, vx: 0, vy: 0, vz: 0}));
        this.next = 0;
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
        this.points = new THREE.Points(geometry, new THREE.PointsMaterial({size: 0.09, vertexColors: true}));
        this.points.frustumCulled = false;
        G.scene.add(this.points);
        this.tint = new THREE.Color();
    }

    chips(x, y, z, hex) {
        this.tint.set(hex);
        for (let i = 0; i < 9; i++) {
            const n = this.next;
            this.next = (n + 1) % this.max;
            this.positions.set([x, y, z], n * 3);
            this.colors.set([this.tint.r, this.tint.g, this.tint.b], n * 3);
            Object.assign(this.parts[n], {life: 0.5 + Math.random() * 0.4, vx: (Math.random() - 0.5) * 5, vy: 1 + Math.random() * 4, vz: (Math.random() - 0.5) * 5});
        }
        this.active = true;
    }

    update(dt) {
        if (!this.active) {
            return;
        }
        let any = false;
        for (let i = 0; i < this.max; i++) {
            const part = this.parts[i];
            if (part.life > 0) {
                any = true;
                part.life -= dt;
                part.vy -= 12 * dt;
                this.positions[i * 3] += part.vx * dt;
                this.positions[i * 3 + 1] = part.life > 0 ? this.positions[i * 3 + 1] + part.vy * dt : -1000;
                this.positions[i * 3 + 2] += part.vz * dt;
            }
        }
        this.points.geometry.attributes.position.needsUpdate = true;
        this.points.geometry.attributes.color.needsUpdate = true;
        this.active = any;
    }
}

const G = {
    ready: false,
    now: 0,
    clock: START_HOUR,
    cutscene: null,
    audio: new IslandAudio(),
    you: newSurvivor(),
    saved: {opened: {}, mined: {}, notes: [], places: [], explored: []},
    aspect: 1,
    shadowEvery: 6,

    get day() {
        return Math.floor(this.clock / 24) + 1;
    },

    notify(text, kind = '') {
        this.hud.feed(text, kind);
        if (kind === 'good') {
            this.audio.play('good');
        }
    },

    // Into the bag, telling what happened
    give(id, n = 1) {
        const left = add(this.you, id, n);
        const item = ITEMS[id];
        if (left < n) {
            this.hud.feed('+' + (n - left) + ' ' + item.name + ' ' + item.icon);
        }
        if (left > 0) {
            this.hud.feed('Your bag is full.', 'bad');
        }
        return left;
    },

    giveQuiet(id, n = 1) {
        return add(this.you, id, n);
    },

    has(id) {
        return count(this.you, id) > 0;
    },

    count(id) {
        return count(this.you, id);
    },

    hasAll(needs) {
        return hasAll(this.you, needs);
    },

    takeAll(needs) {
        return takeAll(this.you, needs);
    },

    takeItem(id, n = 1) {
        return take(this.you, id, n);
    },

    findTool(type, power = 1) {
        return this.you.slots.find(slot => slot && ITEMS[slot.id].tool && ITEMS[slot.id].tool.type === type && ITEMS[slot.id].tool.power >= power) || null;
    },

    // Puts the best tool of these types in the hand, from the bag if needed
    holdTool(types) {
        const {you} = this;
        const usable = slot => slot && ITEMS[slot.id].tool && types.includes(ITEMS[slot.id].tool.type);
        let best = -1;
        you.slots.forEach((slot, i) => {
            if (usable(slot) && (best < 0 || ITEMS[slot.id].tool.power > ITEMS[you.slots[best].id].tool.power)) {
                best = i;
            }
        });
        if (best < 0 || best === you.held) {
            return;
        }
        if (usable(you.slots[you.held]) && ITEMS[you.slots[you.held].id].tool.power >= ITEMS[you.slots[best].id].tool.power) {
            return;
        }
        if (best < 6) {
            you.held = best;
        } else {
            const old = you.slots[you.held];
            you.slots[you.held] = you.slots[best];
            you.slots[best] = old;
        }
    },

    heldPower() {
        const slot = heldSlot(this.you);
        return slot && ITEMS[slot.id].tool ? ITEMS[slot.id].tool.power : 1;
    },

    wearHeld(amount = 1) {
        const slot = heldSlot(this.you);
        const name = slot ? ITEMS[slot.id].name : '';
        if (wearHeld(this.you, amount)) {
            this.notify('Your ' + name.toLowerCase() + ' broke.', 'bad');
        }
    },

    useSlot(i) {
        const slot = this.you.slots[i];
        if (!slot) {
            return;
        }
        const item = ITEMS[slot.id];
        if (!item.food && !item.heal) {
            return;
        }
        const id = slot.id;
        const message = eat(this.you, id);
        take(this.you, id, 1);
        if (item.food && item.food.leaves) {
            add(this.you, item.food.leaves, 1);
        }
        if (item.food && item.food.thirst > item.food.hunger) {
            this.audio.play('drink');
        } else {
            this.audio.play('eat');
        }
        if (message) {
            this.notify(message, 'bad');
        }
    },

    craft(recipe) {
        if (!takeAll(this.you, recipe.needs)) {
            return;
        }
        const left = this.give(recipe.out, recipe.count || 1);
        if (left > 0) {
            for (const [id, n] of Object.entries(recipe.needs)) {
                add(this.you, id, n);
            }
            take(this.you, recipe.out, (recipe.count || 1) - left);
            return;
        }
        this.audio.play('craft');
    },

    readNote(id) {
        if (!this.saved.notes.includes(id)) {
            this.saved.notes.push(id);
            this.notify('A page for your journal: ' + NOTES[id].title, 'good');
        }
        this.hud.showNote(id);
    },

    discovered(name) {
        this.notify('Discovered: ' + name, 'good');
        this.audio.play('discover');
        this.saveSoon();
    },

    hurt(damage, cause, from = null) {
        if (this.cutscene || state !== 'playing') {
            return;
        }
        this.you.health = Math.max(0, this.you.health - damage);
        this.hud.flashHurt();
        this.audio.play('hurt');
        this.player.shake = Math.min(1.5, this.player.shake + damage / 12);
        this.player.stopFishing();
        if (this.you.health <= 0) {
            this.die(cause);
        }
    },

    die(cause) {
        clearSave();
        el('hud').hidden = true;
        score = computeScore(false);
        finishGame('You ' + cause + ' on day ' + this.day + '.');
    },

    sleep(quality) {
        const {you, env, animals, player} = this;
        if (player.swimming || player.boat) {
            this.notify('You can\'t sleep here.');
            return;
        }
        const danger = animals.list.find(a => a.spec.predator && !a.tame && !a.dead && Math.hypot(a.x - player.position.x, a.z - player.position.z) < 20);
        if (danger) {
            this.notify('Not with a ' + danger.spec.name + ' this close.', 'bad');
            return;
        }
        if (this.stalker.isAround() && !this.building.nearFire(player.position.x, player.position.z, 8)) {
            this.notify('You can\'t sleep. Something is watching you.', 'bad');
            return;
        }
        if (you.rest > 88 && !env.isNight) {
            this.notify('You aren\'t tired yet.');
            return;
        }
        const hour = env.hour;
        const toMorning = hour >= 17 ? 24 - hour + 6.5 : hour < 6 ? 6.5 - hour : 3;
        const hours = Math.min(toMorning, (100 - you.rest) / (13 * quality) + 1 > 3 ? toMorning : 3);
        this.cutscene = {update() {}};
        const fade = el('fade');
        fade.style.opacity = 1;
        setTimeout(() => {
            sleepFor(you, hours, quality);
            this.clock += hours;
            this.building.advance(hours);
            this.flora.refresh();
            this.env.pickWeather();
            this.env.settle();
            const warm = this.space.underRoof(player.position.x, player.position.z) || this.building.nearFire(player.position.x, player.position.z, 6);
            if (!warm) {
                you.temp = Math.max(35.6, you.temp - 0.5);
            }
            el('fade-text').textContent = hours > 4 ? 'You sleep through the night.' : 'You rest a while.';
            setTimeout(() => {
                el('fade-text').textContent = '';
                fade.style.opacity = 0;
                this.cutscene = null;
                this.lastTime = 0;
                this.save();
                // Sleeping in the open at night isn't safe
                if (quality < 0.7 && hours > 4 && Math.random() < 0.22) {
                    const a = Math.random() * 6.3;
                    this.animals.create('jaguar', player.position.x + Math.cos(a) * 17, player.position.z + Math.sin(a) * 17).angry = true;
                    this.notify('Something woke you. You are not alone.', 'bad');
                }
            }, 1300);
        }, 800);
    },

    saveSoon() {
        this.saveDue = true;
    },

    save() {
        if (!this.ready || this.over) {
            return;
        }
        const {player} = this;
        remember(SAVE_KEY, {
            v: 1,
            clock: this.clock,
            you: this.you,
            weather: this.env.weather,
            gone: this.flora.gone,
            drops: this.drops.toSave(),
            saved: this.saved,
            built: this.building.toSave(),
            tamed: this.animals.saveTamed(),
            pos: {x: player.position.x, y: player.position.y, z: player.position.z, yaw: player.yaw, pitch: player.pitch, boat: player.boat ? player.boat.id : null, cave: player.underground ? player.underground.id : null},
            rescueTry: this.rescueTry || 0
        });
    }
};

if (testing) {
    window.G = G;
    // Runs the game faster than the screen, for tests on a slow renderer
    G.advance = seconds => {
        for (let t = 0; t < seconds && state === 'playing'; t += 0.05) {
            if (G.cutscene) {
                G.cutscene.update(0.2);
                t += 0.15;
            } else {
                tickWorld(0.05);
            }
        }
    };
}

function computeScore(rescued) {
    const days = Math.max(0, Math.floor((G.clock - START_HOUR) / 24));
    const coins = count(G.you, 'gold_coins') + G.building.items.reduce((sum, item) => sum + (item.slots || []).reduce((n, s) => n + (s && s.id === 'gold_coins' ? s.n : 0), 0), 0);
    return Math.max(1, days * 100 + G.saved.places.length * 15 + G.saved.notes.length * 10 + coins * 2 + (rescued ? 2000 : 0));
}

function clearSave() {
    G.over = true;
    try {
        localStorage.removeItem(SAVE_KEY);
    } catch (e) {
        // Nothing to clear
    }
}

function loadSave() {
    const save = remembered(SAVE_KEY);
    return save && save.v === 1 ? save : null;
}

async function buildEverything() {
    const quality = chooseQuality();
    G.quality = quality;
    const canvas = el('view');
    const renderer = new THREE.WebGLRenderer({canvas, antialias: quality !== 'low', powerPreference: 'high-performance'});
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = quality !== 'low';
    renderer.shadowMap.type = THREE.PCFShadowMap;
    G.pixelRatio = Math.min(window.devicePixelRatio || 1, {low: 1, medium: 1.5, high: 2}[quality]);
    renderer.setPixelRatio(G.pixelRatio);
    G.renderer = renderer;
    G.scene = new THREE.Scene();
    G.camera = new THREE.PerspectiveCamera(72, 1, 0.08, 2400);
    G.camera.rotation.order = 'YXZ';
    G.world = buildWorld();
    G.art = await makeArt(quality);
    G.space = new Space();
    G.hud = new Hud(G);
    G.effects = new Effects(G);
    G.terrain = buildTerrain(G);
    G.env = new Environment(G);
    G.player = new Player(G);
    G.flora = new Flora(G);
    shadeTerrain(G.terrain, G.world, G.flora.forest.crowns());
    G.places = new Places(G);
    G.building = new Building(G);
    G.animals = new Animals(G);
    G.drops = new Drops(G);
    G.stalker = new Stalker(G);
    // These are also there below the ground
    for (const thing of [G.env.sun, G.env.sun.target, G.env.hemi, G.env.sky.mesh, G.camera, G.effects.points]) {
        thing.userData.deep = true;
    }
    G.ready = true;
    addGraphicsSetting();
    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', resize);
}

function addGraphicsSetting() {
    if (el('graphics')) {
        return;
    }
    const current = remembered(QUALITY_KEY).value || 'auto';
    el('resume').insertAdjacentHTML('beforebegin', `<label class="setting row"><span>Graphics</span>
        <select id="graphics" class="graphics-select">
            ${['auto', 'low', 'medium', 'high'].map(q => `<option value="${q}" ${q === current ? 'selected' : ''}>${q[0].toUpperCase() + q.slice(1)}</option>`).join('')}
        </select></label>`);
    el('graphics').addEventListener('change', event => {
        remember(QUALITY_KEY, {value: event.target.value});
        G.save();
        location.reload();
    });
}

function resize() {
    if (!G.renderer) {
        return;
    }
    const box = el('world').getBoundingClientRect();
    const width = box.width || window.innerWidth;
    const height = box.height || window.innerHeight;
    G.renderer.setSize(width, height, false);
    G.aspect = width / height;
    G.camera.aspect = G.aspect;
    G.camera.updateProjectionMatrix();
}

function showWorld() {
    showScreen('world');
    state = 'playing';
    G.lastTime = 0;
    resize();
    Sound.startMusic();
}

function applySave(save) {
    G.clock = save.clock;
    G.you = save.you;
    G.saved = {...G.saved, ...save.saved};
    G.exploredSet = new Set(G.saved.explored);
    G.flora.apply(save.gone || {});
    G.drops.load(save.drops || []);
    G.places.applySaved();
    G.building.load(save.built || []);
    G.env.weather = save.weather;
    G.env.settle();
    G.rescueTry = save.rescueTry || 0;
    const {pos} = save;
    G.player.position.set(pos.x, pos.y, pos.z);
    G.player.yaw = pos.yaw;
    G.player.pitch = pos.pitch || 0;
    G.player.underground = CAVES.find(cave => cave.id === pos.cave) || null;
    if (pos.boat) {
        const boat = G.building.items.find(item => item.id === pos.boat);
        if (boat) {
            G.player.board(boat);
        }
    }
    G.animals.loadTamed(save.tamed || []);
    G.lastDay = G.day;
}

async function start(fromSave) {
    Sound.unlock();
    el('start').hidden = true;
    el('continue').hidden = true;
    el('loading').hidden = false;
    await new Promise(resolve => setTimeout(resolve, 40));
    try {
        await buildEverything();
    } catch (error) {
        el('loading').textContent = 'This device could not start the 3D view. ' + (error.message || '');
        return;
    }
    const save = fromSave ? loadSave() : null;
    G.exploredSet = new Set();
    if (save) {
        applySave(save);
        el('fade').style.opacity = 0;
        showWorld();
        G.hud.setHudVisible(true);
        G.hud.lockMouse();
        G.player.update(0.001);
        G.notify('Day ' + G.day + '. You are still here.');
    } else {
        clearAndStartNew();
    }
    if (!G.loopStarted) {
        G.loopStarted = true;
        requestAnimationFrame(frame);
    }
}

function clearAndStartNew() {
    G.over = false;
    const {spawn} = PLACES;
    // Looking inland from the beach. The wreck lies a walk away.
    const yaw = Math.atan2(-(PLACES.wreck.x - spawn.x), -(PLACES.wreck.z - spawn.z)) + 1;
    G.player.placeAtStart(spawn.x, spawn.z, yaw);
    G.lastDay = 1;
    showWorld();
    if (new URLSearchParams(location.search).has('nofilm')) {
        beginPlay();
        return;
    }
    Sound.stopMusic();
    G.cutscene = new CrashScene(G, () => {
        G.cutscene = new WakeScene(G, beginPlay);
    });
}

function beginPlay() {
    G.cutscene = null;
    G.hud.setHudVisible(true);
    G.hud.lockMouse();
    Sound.startMusic();
    G.player.update(0.001);
    el('fade').style.opacity = 0;
    G.notify('You are alive. Nobody else is here.');
    setTimeout(() => {
        if (state === 'playing') {
            G.notify('Find water and food. Look around the wreckage.');
        }
    }, 3500);
    G.save();
}

// What moves also during the waking-up film
G.tickView = function (dt) {
    G.now += dt;
    shared.uTime.value = G.now;
    G.env.update(dt, dt);
    G.flora.update(dt);
    const p = G.player.position;
    G.audio.updateAmbience({
        shore: shoreDistance(p.x, p.z),
        wind: G.env.state.wind,
        rain: G.env.state.rain,
        night: G.env.isNight,
        indoor: G.env.indoor > 0.5,
        sheltered: G.space.underRoof(p.x, p.z),
        underwater: G.env.underwater,
        silent: G.audio.quiet
    }, dt);
};

// The world above and the caves below are never seen together
const hiddenNow = [];

G.renderWorld = function () {
    const below = G.player && G.player.underground;
    if (below) {
        // Daylight can only be seen from the first part of the tunnel
        const p = G.player.position;
        G.env.sky.mesh.userData.deep = Math.hypot(p.x - below.door.x, p.z - below.door.z) < 34;
    }
    hiddenNow.length = 0;
    for (const thing of G.scene.children) {
        const show = below ? thing.userData.deep || thing.userData.below : !thing.userData.below;
        if (!show && thing.visible) {
            thing.visible = false;
            hiddenNow.push(thing);
        }
    }
    G.renderer.render(G.scene, G.camera);
    for (const thing of hiddenNow) {
        thing.visible = true;
    }
};

function shoreDistance(x, z) {
    const h = G.world.heightAt(x, z);
    if (h < 0.3) {
        return 0;
    }
    // Rough: the height of the land says how far inland this is
    return Math.min(110, h * 16);
}

function markExplored(x, z) {
    const cells = 64;
    const size = 1100 / cells;
    const k = Math.floor((x + 550) / size) + Math.floor((z + 550) / size) * cells;
    if (!G.exploredSet.has(k)) {
        G.exploredSet.add(k);
        G.saved.explored.push(k);
    }
}

function updateRescue(dt) {
    const hour = G.env.hour;
    if (!G.heli && G.day >= RESCUE_DAY && hour >= RESCUE_HOUR && hour < RESCUE_HOUR + 3 && G.rescueTry !== G.day) {
        G.rescueTry = G.day;
        G.heli = new Helicopter(G);
        const sign = G.building.sos;
        G.heli.position.set(Math.cos(G.clock) * 560, 80, Math.sin(G.clock) * 560);
        G.heliStage = 'search';
        G.heliPoints = [];
        // It flies over the island, and to the sign if that is big enough to see
        const p = G.player.position;
        if (G.building.sosDone()) {
            G.heliPoints.push(new THREE.Vector3(sign.x, 60, sign.z));
        } else {
            G.heliPoints.push(new THREE.Vector3(p.x * 0.5, 70, p.z * 0.5), new THREE.Vector3(-G.heli.position.x, 80, -G.heli.position.z));
        }
        G.notify('Do you hear that? A helicopter!', 'good');
    }
    if (!G.heli) {
        return;
    }
    G.heli.update(dt);
    if (G.heliStage === 'search') {
        if (G.heli.flyTo(G.heliPoints[0], 26, dt)) {
            G.heliPoints.shift();
            if (!G.heliPoints.length) {
                if (G.building.sosDone()) {
                    beginRescue();
                } else {
                    G.heli.remove();
                    G.heli = null;
                    G.notify('The helicopter flew on: it couldn\'t see you. Finish the SOS sign. They will search again tomorrow.', 'bad');
                }
            }
        }
    }
}

function beginRescue() {
    const {building: {sos: sign}, heli} = G;
    let t = 0;
    const camera = G.camera;
    const start = camera.position.clone();
    el('hud').hidden = true;
    const target = new THREE.Vector3(sign.x, G.world.heightAt(sign.x, sign.z) + 22, sign.z);
    G.notify('They have seen the SOS!');
    G.audio.play('fanfare');
    G.cutscene = {
        update(dt) {
            t += dt;
            G.tickView(dt);
            heli.update(dt);
            heli.flyTo(target, 8, dt);
            const look = new THREE.Vector3().copy(heli.position);
            camera.position.copy(start);
            camera.up.set(0, 1, 0);
            const before = camera.rotation.order;
            camera.lookAt(look);
            camera.rotation.order = before;
            if (t > 9) {
                el('fade').style.transition = 'opacity 2s';
                el('fade').style.background = '#fff';
                el('fade').style.opacity = 1;
            }
            G.renderWorld();
            if (t > 11.5) {
                G.cutscene = null;
                score = computeScore(true);
                clearSave();
                const days = Math.floor((G.clock - START_HOUR) / 24);
                const gameOverSound = Sound.gameOver;
                Sound.gameOver = () => {};
                finishGame('You were rescued after ' + days + ' days. You survived!').then(() => {
                    Sound.gameOver = gameOverSound;
                    document.querySelector('.over-title h1').textContent = 'Rescued! 🚁';
                    el('fade').style.background = '#000';
                });
            }
        }
    };
}

let saveTimer = 0;
let hourlyTimer = 0;

function tickWorld(dt) {
    const {you, player, env, building} = G;
    G.clock += dt * HOURS_PER_SECOND;
    const {sprinting, moving, inWater} = player.update(dt);
    G.tickView(dt);
    building.update(dt * HOURS_PER_SECOND, dt);
    G.animals.update(dt);
    G.drops.update(dt);
    G.stalker.update(dt);
    if (state !== 'playing') {
        return;
    }
    G.effects.update(dt);

    hourlyTimer -= dt;
    if (hourlyTimer <= 0) {
        hourlyTimer = 1;
        G.places.update();
        G.flora.refresh();
        markExplored(player.position.x, player.position.z);
        if (G.day !== G.lastDay) {
            G.lastDay = G.day;
            if (G.day <= 30) {
                G.notify('Day ' + G.day + ' of 30 begins.', 'good');
            }
            if (G.day === 26 && !building.sosDone()) {
                G.notify('Days are running out. The SOS sign must be ready by day 31.', 'bad');
            }
            if (G.day === 31) {
                G.notify('30 days have passed. The helicopter will search this morning.', 'good');
            }
            G.save();
        }
    }

    const slot = heldSlot(you);
    if (slot && slot.id === 'torch' && !player.underwater) {
        G.wearHeld(dt);
    }

    const p = player.position;
    const cause = tick(you, dt, {
        hour: env.hour,
        rain: env.rain,
        tempDelta: env.tempDelta,
        nearFire: building.warmth,
        sheltered: G.space.underRoof(p.x, p.z),
        inCave: env.indoor > 0.5,
        swimming: player.swimming,
        underwater: player.underwater,
        inWater,
        sprinting,
        moving,
        working: player.swingTime < 1,
        inSun: env.state.over < 0.3 && env.hour > 9 && env.hour < 17 && env.indoor < 0.5
    });
    if (cause) {
        G.die(cause);
        return;
    }
    updateRescue(dt);
    G.hud.update(dt);

    saveTimer -= dt;
    if (saveTimer <= 0 || (G.saveDue && saveTimer < 25)) {
        saveTimer = 30;
        G.saveDue = false;
        G.save();
    }
}

let frames = 0;
let slowTime = 0;

function adaptQuality(dt) {
    frames++;
    slowTime += dt;
    if (frames < 90) {
        return;
    }
    const average = slowTime / frames;
    frames = 0;
    slowTime = 0;
    if (average > 0.034) {
        // First fewer detailed trees, then a coarser picture
        if (G.flora.forest.lessDetail()) {
            return;
        }
        if (G.pixelRatio > 0.75) {
            G.pixelRatio = Math.max(0.75, G.pixelRatio * 0.85);
            G.renderer.setPixelRatio(G.pixelRatio);
            resize();
        } else if (G.shadowEvery < 30) {
            G.shadowEvery = 30;
        }
    }
}

function frame(time) {
    requestAnimationFrame(frame);
    if (state !== 'playing') {
        G.lastTime = 0;
        return;
    }
    const dt = G.lastTime ? Math.min(0.05, (time - G.lastTime) / 1000) : 0.016;
    const raw = G.lastTime ? (time - G.lastTime) / 1000 : 0.016;
    G.lastTime = time;
    if (G.cutscene) {
        G.cutscene.update(dt);
        return;
    }
    if (G.hud.tab) {
        return;
    }
    tickWorld(dt);
    if (state === 'playing') {
        G.renderWorld();
        adaptQuality(raw);
    }
}

function newGame() {
    // A finished world isn't undone: the page starts clean
    if (G.ready) {
        location.reload();
        return;
    }
    state = 'title';
    const save = loadSave();
    el('continue').hidden = !save;
    if (save) {
        el('continue').textContent = 'Continue, day ' + (Math.floor(save.clock / 24) + 1);
        el('start').classList.remove('primary');
    }
    showScreen('title');
    resetMenuButton();
}

function setUp() {
    el('continue').addEventListener('click', () => start(true));
    el('start').addEventListener('click', () => {
        if (loadSave() && !G.confirmNew) {
            G.confirmNew = true;
            el('start').textContent = 'Really start over? Tap again';
            return;
        }
        try {
            localStorage.removeItem(SAVE_KEY);
        } catch (e) {
            // Nothing to clear
        }
        start(false);
    });
    window.addEventListener('pagehide', () => {
        if (G.ready && !G.over && !G.cutscene) {
            G.save();
        }
    });
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && G.ready && !G.over && !G.cutscene) {
            G.save();
        }
    });
    setUpGame({
        screens: ['title', 'world'],
        newGame,
        resume() {
            G.lastTime = 0;
            if (G.ready) {
                G.hud.lockMouse();
            }
        },
        leaderboardUrl: () => '/api/leaderboard/survive',
        leaderboardTitle: () => 'Leaderboard'
    });
}

setUp();
