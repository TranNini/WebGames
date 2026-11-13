// Everything on top of the 3D view: bars, buttons, touch and keys, and the bag, crafting, building, journal and map screens.
import {BIOME, GRID, PLACES, WORLD_SIZE} from './world.js';
import {BUILDS, ITEMS, RECIPES, SOS_STONES} from './items.js';
import {NOTES} from './places.js';
import {HOTBAR, SLOTS, count} from './survivor.js';

const STATS = [
    ['health', '❤️', '#ff6a6a', 'Health'],
    ['hunger', '🍖', '#f0a050', 'Hunger'],
    ['thirst', '💧', '#6cc4ff', 'Thirst'],
    ['energy', '⚡', '#f5dc5a', 'Energy'],
    ['rest', '😴', '#b89cf0', 'Rest'],
    ['temp', '🌡️', '#ffffff', 'Body temperature']
];
const el = id => document.getElementById(id);
const esc = text => String(text).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));

export class Hud {
    constructor(G) {
        this.G = G;
        this.tab = null;
        this.chest = null;
        this.selected = null;
        this.moving = null;
        this.optionsKey = '';
        this.statsTimer = 0;
        this.feedList = [];
        el('stats').innerHTML = STATS.map(([id, icon, c, name]) =>
            `<div class="stat" id="stat-${id}" style="color:${c}" aria-label="${name}"><span>${icon}</span><u><i></i></u></div>`).join('');
        el('stat-temp').classList.add('mark');
        el('hotbar').innerHTML = Array.from({length: HOTBAR}, (_, i) => `<button class="slot" data-slot="${i}" aria-label="Slot ${i + 1}"></button>`).join('');
        if (navigator.maxTouchPoints === 0) {
            document.body.classList.add('no-touch');
        }
        this.setUpButtons();
        this.setUpInput();
    }

    setUpButtons() {
        const {G} = this;
        const press = (id, fn) => {
            el(id).addEventListener('pointerdown', event => {
                event.preventDefault();
                event.stopPropagation();
                fn(event);
            });
        };
        document.querySelectorAll('.side [data-tab]').forEach(button => button.addEventListener('pointerdown', event => {
            event.preventDefault();
            event.stopPropagation();
            this.open(button.dataset.tab);
        }));
        el('tabs').addEventListener('click', event => {
            const tab = event.target.dataset.tab;
            if (tab) {
                this.chest = null;
                this.open(tab);
            }
        });
        el('panel-close').addEventListener('click', () => this.close());
        press('run', () => {
            G.player.runOn = !G.player.runOn;
        });
        press('act1', () => G.player.runOption(0));
        press('act2', () => G.player.runOption(1));
        el('hotbar').addEventListener('pointerdown', event => {
            const button = event.target.closest('[data-slot]');
            if (button) {
                event.preventDefault();
                event.stopPropagation();
                this.pickHeld(Number(button.dataset.slot));
            }
        });
        for (const [id, field] of [['jump', 'jumpButton'], ['dive', 'diveButton']]) {
            const button = el(id);
            button.addEventListener('pointerdown', event => {
                event.preventDefault();
                event.stopPropagation();
                G.player[field] = true;
            });
            for (const type of ['pointerup', 'pointercancel', 'pointerleave']) {
                button.addEventListener(type, () => {
                    G.player[field] = false;
                });
            }
        }
        press('place-ok', () => G.building.confirmPlacing());
        press('place-turn', () => G.building.turnPlacing());
        press('place-cancel', () => G.building.cancelPlacing());
    }

    pickHeld(i) {
        const {G} = this;
        G.you.held = i;
        this.markHotbar();
        G.audio.play('pick');
    }

    setUpInput() {
        const {G} = this;
        const layer = el('touch');
        const fingers = new Map();
        const stickSize = 52;

        layer.addEventListener('pointerdown', event => {
            event.preventDefault();
            if (event.pointerType === 'mouse') {
                this.lockMouse();
                return;
            }
            const box = layer.getBoundingClientRect();
            const left = event.clientX - box.left < box.width * 0.45;
            if (left && ![...fingers.values()].some(f => f.stick)) {
                fingers.set(event.pointerId, {stick: true, x: event.clientX, y: event.clientY});
                const joystick = el('joystick');
                joystick.hidden = false;
                joystick.style.left = event.clientX - box.left + 'px';
                joystick.style.top = event.clientY - box.top + 'px';
                el('stick').style.transform = '';
                G.player.touchMove = {x: 0, y: 0};
            } else {
                fingers.set(event.pointerId, {stick: false, x: event.clientX, y: event.clientY});
            }
            try {
                layer.setPointerCapture(event.pointerId);
            } catch (e) {
                // Works without it, as long as the finger stays on the layer
            }
        });
        layer.addEventListener('pointermove', event => {
            const finger = fingers.get(event.pointerId);
            if (!finger) {
                return;
            }
            event.preventDefault();
            if (finger.stick) {
                let dx = event.clientX - finger.x;
                let dy = event.clientY - finger.y;
                const length = Math.hypot(dx, dy);
                if (length > stickSize) {
                    dx *= stickSize / length;
                    dy *= stickSize / length;
                }
                el('stick').style.transform = `translate(${dx}px, ${dy}px)`;
                G.player.touchMove = {x: dx / stickSize, y: -dy / stickSize};
            } else {
                const sensitivity = 0.0052;
                G.player.look((event.clientX - finger.x) * sensitivity, (event.clientY - finger.y) * sensitivity);
                finger.x = event.clientX;
                finger.y = event.clientY;
            }
        });
        const end = event => {
            const finger = fingers.get(event.pointerId);
            if (finger && finger.stick) {
                el('joystick').hidden = true;
                G.player.touchMove = null;
            }
            fingers.delete(event.pointerId);
        };
        layer.addEventListener('pointerup', end);
        layer.addEventListener('pointercancel', end);

        // Mouse: looks around while locked to the window
        document.addEventListener('mousemove', event => {
            if (document.pointerLockElement === layer && state === 'playing' && !this.tab && !G.cutscene) {
                G.player.look(event.movementX * 0.0023, event.movementY * 0.0023);
            }
        });
        document.addEventListener('mousedown', event => {
            if (document.pointerLockElement !== layer || this.tab || G.cutscene) {
                return;
            }
            if (G.building.placing) {
                if (event.button === 0) {
                    G.building.confirmPlacing();
                } else {
                    G.building.cancelPlacing();
                }
                return;
            }
            G.player.runOption(event.button === 2 ? 1 : 0);
        });
        document.addEventListener('pointerlockchange', () => {
            // Esc leaves the lock: that opens the menu, unless a screen of ours asked for it
            if (document.pointerLockElement !== layer && !this.lockReleased && state === 'playing' && !G.cutscene && $('menu').hidden && !this.tab) {
                openMenu();
            }
            this.lockReleased = false;
        });
        document.addEventListener('keydown', event => {
            if (!G.ready || state !== 'playing') {
                return;
            }
            const code = event.code;
            if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code)) {
                event.preventDefault();
            }
            if (event.repeat) {
                return;
            }
            G.player.keys[code] = true;
            if (G.cutscene) {
                return;
            }
            if (this.tab) {
                if (code === 'Escape' || code === 'Tab' || code === 'KeyI') {
                    this.close();
                }
                return;
            }
            if (code === 'KeyE') {
                G.player.runOption(0);
            } else if (code === 'KeyF') {
                G.player.runOption(1);
            } else if (code === 'Tab' || code === 'KeyI') {
                this.open('bag');
            } else if (code === 'KeyK') {
                this.open('craft');
            } else if (code === 'KeyB') {
                this.open('build');
            } else if (code === 'KeyJ') {
                this.open('journal');
            } else if (code === 'KeyM') {
                this.open('map');
            } else if (code === 'KeyR') {
                G.building.turnPlacing();
            } else if (code === 'Escape') {
                if (G.building.placing) {
                    G.building.cancelPlacing();
                } else if (G.building.removing) {
                    G.building.removing = false;
                } else if (!document.pointerLockElement) {
                    openMenu();
                }
            } else if (/^Digit[1-6]$/.test(code)) {
                this.pickHeld(Number(code[5]) - 1);
            }
        });
        document.addEventListener('keyup', event => {
            G.player.keys[event.code] = false;
        });
        window.addEventListener('blur', () => {
            G.player.keys = {};
        });
    }

    lockMouse() {
        const layer = el('touch');
        if (navigator.maxTouchPoints === 0 && layer.requestPointerLock && document.pointerLockElement !== layer) {
            Promise.resolve(layer.requestPointerLock()).catch(() => {});
        }
    }

    releaseMouse() {
        if (document.pointerLockElement) {
            this.lockReleased = true;
            document.exitPointerLock();
        }
    }

    setHudVisible(visible) {
        el('hud').hidden = !visible;
    }

    feed(text, kind = '') {
        const line = document.createElement('div');
        line.textContent = text;
        if (kind) {
            line.className = kind;
        }
        el('feed').append(line);
        const lines = el('feed').children;
        while (lines.length > 5) {
            lines[0].remove();
        }
        setTimeout(() => line.remove(), kind ? 7000 : 3600);
    }

    showOptions(options) {
        const key = options.map(option => option.label + (option.disabled ? '!' : '') + (option.urgent ? '*' : '')).join('|');
        if (key === this.optionsKey) {
            return;
        }
        this.optionsKey = key;
        [el('act1'), el('act2')].forEach((button, i) => {
            const option = options[i];
            button.hidden = !option;
            if (option) {
                button.textContent = option.label;
                button.disabled = Boolean(option.disabled);
                button.classList.toggle('urgent', Boolean(option.urgent));
            }
        });
    }

    markHotbar() {
        const {G} = this;
        const buttons = el('hotbar').children;
        for (let i = 0; i < HOTBAR; i++) {
            const slot = G.you.slots[i];
            const key = (slot ? slot.id + slot.n + Math.ceil((slot.dur || 0) / 8) : '') + (i === G.you.held ? '*' : '');
            if (buttons[i].dataset.key !== key) {
                buttons[i].dataset.key = key;
                buttons[i].innerHTML = this.slotInner(slot);
                buttons[i].classList.toggle('on', i === G.you.held);
            }
        }
    }

    slotInner(slot) {
        if (!slot) {
            return '';
        }
        const item = ITEMS[slot.id];
        let extra = '';
        if (slot.n > 1) {
            extra = `<em>${slot.n}</em>`;
        } else if (item.tool && slot.dur !== undefined) {
            extra = `<s style="right:${5 + 32 * (1 - slot.dur / item.tool.durability)}px"></s>`;
        }
        return `<span>${item.icon}</span>${extra}`;
    }

    update(dt) {
        const {G} = this;
        el('run').classList.toggle('on', G.player.runOn);
        this.statsTimer -= dt;
        if (this.statsTimer > 0) {
            return;
        }
        this.statsTimer = 0.2;
        const you = G.you;
        for (const [id] of STATS) {
            const box = el('stat-' + id);
            const value = id === 'temp' ? (you.temp - 34) / 6 * 100 : you[id];
            const fill = box.querySelector('i');
            if (id === 'temp') {
                fill.style.left = Math.max(0, Math.min(100, value)) + '%';
            } else {
                fill.style.width = Math.max(0, Math.min(100, value)) + '%';
            }
            const low = id === 'temp' ? you.temp < 35.4 || you.temp > 38.9 : value < 20;
            box.classList.toggle('low', low);
        }
        const hour = G.env.hour;
        el('clock-day').textContent = 'Day ' + G.day + (G.day <= 30 ? ' of 30' : '');
        el('clock-time').textContent = String(Math.floor(hour)).padStart(2, '0') + ':' + String(Math.floor(hour % 1 * 60)).padStart(2, '0') + ' ' + G.env.kind.icon;
        const degrees = ((-G.player.yaw * 180 / Math.PI) % 360 + 360) % 360;
        el('compass').textContent = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(degrees / 45) % 8];
        const status = [];
        if (G.you.oxygen < 99) status.push('Air ' + Math.round(you.oxygen) + '%');
        if (you.poison > 0) status.push('Poisoned');
        if (you.sick > 0) status.push('Sick');
        if (you.wet > 60) status.push('Soaked');
        if (G.building.removing) status.push('Remove mode');
        const text = status.map(s => `<span>${esc(s)}</span>`).join('');
        if (this.statusKey !== text) {
            this.statusKey = text;
            el('status').innerHTML = text;
        }
        el('dive').hidden = !G.player.swimming;
        this.markHotbar();
    }

    flashHurt() {
        const box = el('hurt');
        box.getAnimations().forEach(a => a.cancel());
        box.animate([{opacity: 0.95}, {opacity: 0}], {duration: 600});
    }

    showPlacing(on) {
        el('placing').hidden = !on;
        el('place-ok').hidden = false;
        this.optionsKey = null;
        if (on) {
            this.showOptions([]);
        }
    }

    open(tab) {
        const {G} = this;
        if (state !== 'playing' || G.cutscene) {
            return;
        }
        this.releaseMouse();
        G.building.cancelPlacing();
        this.tab = tab;
        this.moving = null;
        el('panel').hidden = false;
        document.body.classList.add('panel-open');
        this.render();
    }

    close() {
        this.tab = null;
        this.chest = null;
        el('panel').hidden = true;
        document.body.classList.remove('panel-open');
        this.G.player.keys = {};
        this.lockMouse();
        this.G.saveSoon();
    }

    render() {
        document.querySelectorAll('#tabs button').forEach(button => button.classList.toggle('on', button.dataset.tab === this.tab));
        const body = el('panel-body');
        const scroll = body.scrollTop;
        this['render_' + this.tab]();
        body.scrollTop = scroll;
    }

    slotGrid(slots, from, to, tag) {
        const buttons = [];
        for (let i = from; i < to; i++) {
            const classes = ['slot'];
            if (tag === 'bag' && this.selected === i) classes.push('on');
            if (tag === 'bag' && this.moving === i) classes.push('moving');
            buttons.push(`<button class="${classes.join(' ')}" data-${tag}="${i}">${this.slotInner(slots[i])}</button>`);
        }
        return `<div class="grid">${buttons.join('')}</div>`;
    }

    render_bag() {
        const {G} = this;
        const you = G.you;
        const body = el('panel-body');
        if (this.chest) {
            this.renderChest();
            return;
        }
        const wearing = you.wearing ? ITEMS[you.wearing] : null;
        const slot = this.selected !== null ? you.slots[this.selected] : null;
        let detail = '<div class="detail"><p>Tap something to use it. The first row is what you can hold in your hand.</p></div>';
        if (this.moving !== null) {
            detail = '<div class="detail"><p>Tap the place to move it to.</p></div>';
        } else if (slot) {
            const item = ITEMS[slot.id];
            const uses = [];
            if (item.food) uses.push(['eat', item.food.thirst > item.food.hunger ? 'Drink' : 'Eat', true]);
            if (item.heal) uses.push(['eat', 'Use', true]);
            if (item.wear) uses.push(['wear', 'Wear', true]);
            if (this.selected < HOTBAR) uses.push(['hold', 'Hold', !item.food]);
            uses.push(['move', 'Move', false]);
            uses.push(['drop', 'Throw away', false]);
            const facts = [];
            if (item.food) facts.push(`Food ${item.food.hunger}, water ${item.food.thirst}` + (item.food.sick ? '. May make you sick' : ''));
            if (item.tool && slot.dur !== undefined) facts.push(`Damage ${item.tool.damage}, ${Math.ceil(slot.dur / item.tool.durability * 100)}% left`);
            if (item.wear) facts.push(`Warmth ${item.wear.warmth}, sheds ${Math.round(item.wear.rain * 100)}% of the rain`);
            if (item.heal) facts.push('Heals ' + item.heal.health);
            detail = `<div class="detail"><b>${item.icon} ${esc(item.name)}${slot.n > 1 ? ' × ' + slot.n : ''}</b>
                ${item.about ? `<p>${esc(item.about)}</p>` : ''}${facts.length ? `<p>${esc(facts.join('. '))}.</p>` : ''}
                <div class="row-buttons">${uses.map(([id, label, main]) => `<button class="small${main ? ' main' : ''}" data-use="${id}">${label}</button>`).join('')}</div></div>`;
        }
        body.innerHTML = `<h3>In your hand</h3>${this.slotGrid(you.slots, 0, HOTBAR, 'bag')}
            <h3>Bag</h3>${this.slotGrid(you.slots, HOTBAR, SLOTS, 'bag')}
            ${detail}
            <div class="detail"><b>Wearing:</b> ${wearing ? esc(wearing.name) : 'Your torn travel clothes'}
                <div class="row-buttons">
                    ${wearing ? '<button class="small" data-use="undress">Take off</button>' : ''}
                    <button class="small" data-use="rest">Rest here</button>
                </div>
            </div>`;
        body.querySelectorAll('[data-bag]').forEach(button => button.addEventListener('click', () => {
            const i = Number(button.dataset.bag);
            if (this.moving !== null) {
                const a = you.slots[this.moving];
                you.slots[this.moving] = you.slots[i];
                you.slots[i] = a;
                this.moving = null;
                this.selected = i;
            } else {
                this.selected = this.selected === i ? null : i;
            }
            this.render();
        }));
        body.querySelectorAll('[data-use]').forEach(button => button.addEventListener('click', () => this.useFromBag(button.dataset.use)));
    }

    useFromBag(use) {
        const {G} = this;
        const you = G.you;
        const i = this.selected;
        if (use === 'undress') {
            G.giveQuiet(you.wearing, 1);
            you.wearing = null;
        } else if (use === 'rest') {
            this.close();
            G.sleep(0.55);
            return;
        } else if (use === 'eat') {
            G.useSlot(i);
        } else if (use === 'wear') {
            const id = you.slots[i].id;
            you.slots[i] = null;
            if (you.wearing) {
                G.giveQuiet(you.wearing, 1);
            }
            you.wearing = id;
            this.selected = null;
            G.audio.play('pick');
        } else if (use === 'hold') {
            you.held = i;
            this.close();
            return;
        } else if (use === 'move') {
            this.moving = i;
        } else if (use === 'drop') {
            const slot = you.slots[i];
            slot.n -= 1;
            if (slot.n <= 0) {
                you.slots[i] = null;
                this.selected = null;
            }
        }
        this.markHotbar();
        this.render();
    }

    render_craft() {
        const {G} = this;
        const you = G.you;
        const near = {bench: G.building.nearStation('bench'), fire: G.building.nearStation('fire'), furnace: G.building.nearStation('furnace')};
        const rows = RECIPES.map((recipe, index) => {
            const has = Object.entries(recipe.needs).every(([id, n]) => count(you, id) >= n);
            const place = !recipe.at || near[recipe.at];
            return {recipe, index, can: has && place, has, place};
        });
        const group = {
            hand: rows.filter(r => !r.recipe.at),
            fire: rows.filter(r => r.recipe.at === 'fire'),
            bench: rows.filter(r => r.recipe.at === 'bench'),
            furnace: rows.filter(r => r.recipe.at === 'furnace')
        };
        const row = ({recipe, index, can}) => {
            const item = ITEMS[recipe.out];
            const needs = Object.entries(recipe.needs).map(([id, n]) => {
                const have = count(you, id);
                return `<span class="${have < n ? 'short' : ''}">${ITEMS[id].icon} ${esc(ITEMS[id].name)} ${have}/${n}</span>`;
            }).join(' · ');
            return `<div class="recipe"><i>${item.icon}</i><div class="info"><b>${esc(item.name)}${recipe.count ? ' × ' + recipe.count : ''}</b><div class="needs">${needs}</div></div>
                <button class="small${can ? ' main' : ''}" data-craft="${index}" ${can ? '' : 'disabled'}>Make</button></div>`;
        };
        const section = (title, list, ready, hint) => `<h3>${title}</h3>${ready ? '' : `<p>${hint}</p>`}${list.map(row).join('')}`;
        const body = el('panel-body');
        const sections = [
            section('By hand', group.hand, true),
            section('At a campfire', group.fire, near.fire, 'Stand next to a burning campfire.'),
            section('At a workbench', group.bench, near.bench, 'Stand next to a workbench (Build tab).'),
            section('At a furnace', group.furnace, near.furnace, 'Stand next to a furnace (Build tab).')
        ];
        if (near.fire) {
            [sections[0], sections[1]] = [sections[1], sections[0]];
        }
        body.innerHTML = sections.join('');
        body.querySelectorAll('[data-craft]').forEach(button => button.addEventListener('click', () => {
            G.craft(RECIPES[Number(button.dataset.craft)]);
            this.render();
        }));
    }

    render_build() {
        const {G} = this;
        const you = G.you;
        const body = el('panel-body');
        const rows = Object.entries(BUILDS).map(([id, spec]) => {
            const entries = Object.entries(spec.cost);
            const can = entries.every(([item, n]) => count(you, item) >= n) && !(spec.needsTool && !G.findTool(spec.needsTool)) && !(id === 'sos' && G.building.sos);
            const needs = entries.map(([item, n]) => {
                const have = count(you, item);
                return `<span class="${have < n ? 'short' : ''}">${ITEMS[item].icon} ${esc(ITEMS[item].name)} ${have}/${n}</span>`;
            }).join(' · ');
            const tool = spec.needsTool ? ` · needs a ${spec.needsTool}` : '';
            return `<div class="recipe"><i>${spec.icon}</i><div class="info"><b>${esc(spec.name)}</b><div class="needs">${esc(spec.about)}</div><div class="needs">${needs}${tool}</div></div>
                <button class="small${can ? ' main' : ''}" data-build="${id}" ${can ? '' : 'disabled'}>Build</button></div>`;
        }).join('');
        const removing = G.building.removing;
        body.innerHTML = `<div class="row-buttons"><button class="small" id="toggle-remove">${removing ? 'Stop removing' : 'Remove what you built (half comes back)'}</button></div><h3>Your base</h3>${rows}`;
        body.querySelector('#toggle-remove').addEventListener('click', () => {
            G.building.removing = !removing;
            this.close();
        });
        body.querySelectorAll('[data-build]').forEach(button => button.addEventListener('click', () => {
            const id = button.dataset.build;
            this.close();
            G.building.startPlacing(id);
        }));
    }

    render_journal() {
        const {G} = this;
        const body = el('panel-body');
        const sign = G.building.sos;
        const places = (G.saved.places || []).map(key => PLACES[key]).filter(Boolean);
        const notes = G.saved.notes;
        const tamed = G.animals.saveTamed();
        const left = Math.max(0, 31 - G.day);
        const goal = left > 0 ? `${left} more ${left === 1 ? 'day' : 'days'} until the rescue helicopter starts its search.` : 'The helicopter is searching for you every morning at 9.';
        const sosText = !sign ? 'No SOS sign yet: Build tab, on open sand.' : sign.laid < SOS_STONES ? `SOS sign: ${sign.laid} of ${SOS_STONES} stones.` : 'The SOS sign is finished.';
        body.innerHTML = `<h3>The goal</h3><p>${esc(goal)} ${esc(sosText)}</p>
            <h3>Found places (${places.length} of ${Object.keys(PLACES).length - 1})</h3><p>${places.length ? places.map(p => esc(p.name)).join(', ') : 'Nothing yet. Go exploring.'}</p>
            ${tamed.length ? `<h3>With you</h3><p>${tamed.map(esc).join(', ')}</p>` : ''}
            <h3>Pages found (${notes.length} of ${Object.keys(NOTES).length})</h3>
            ${notes.map(id => `<button class="small note-link" data-note="${id}">📜 ${esc(NOTES[id].title)}</button>`).join('') || '<p>None yet.</p>'}
            <div id="note-open"></div>
            <h3>How to play</h3>
            <p>${navigator.maxTouchPoints === 0
                ? 'WASD to walk, mouse to look, Shift to run, Space to jump or swim up, C to dive. E or left click does what the yellow button says, F or right click the other one. 1 to 6 picks what is in your hand. I bag, K craft, B build, J journal, M map. R turns what you are placing.'
                : 'Left thumb to walk, right thumb to look. The running figure switches running on and off: walking costs no energy, running does. The yellow button does what it says; it changes with what you look at. In deep water, look down and walk to dive, and use the arrows.'}</p>
            <p>The first row of the bag is your hand. Eat, drink and rest before a bar turns red. Nights are cold, rain makes you wet, and a fire or a roof helps with both. Animals may attack. Some, fed the right food, will follow you: bananas for monkeys, berries for parrots, coconuts for boars, grilled meat for a jaguar.</p>`;
        body.querySelectorAll('[data-note]').forEach(button => button.addEventListener('click', () => this.showNote(button.dataset.note)));
    }

    showNote(id) {
        this.G.audio.play('note');
        if (this.tab !== 'journal') {
            this.open('journal');
        }
        const note = NOTES[id];
        el('note-open').innerHTML = `<div class="page"><h4>${esc(note.title)}</h4>${esc(note.text)}</div>`;
        el('note-open').scrollIntoView({block: 'center'});
    }

    render_map() {
        const {G} = this;
        el('panel-body').innerHTML = '<canvas id="map-canvas" width="640" height="640"></canvas>';
        const canvas = el('map-canvas');
        const c = canvas.getContext('2d');
        const size = canvas.width;
        const toMap = v => (v / WORLD_SIZE + 0.5) * size;
        if (!this.mapBase) {
            this.mapBase = document.createElement('canvas');
            this.mapBase.width = this.mapBase.height = GRID + 1;
            const m = this.mapBase.getContext('2d');
            const image = m.createImageData(GRID + 1, GRID + 1);
            const colors = {
                [BIOME.BEACH]: [226, 208, 158], [BIOME.MEADOW]: [134, 170, 84], [BIOME.JUNGLE]: [62, 108, 58],
                [BIOME.SWAMP]: [86, 96, 54], [BIOME.ISLET]: [134, 170, 84], [BIOME.CAVE]: [92, 88, 80]
            };
            for (let i = 0; i < G.world.heights.length; i++) {
                const h = G.world.heights[i];
                const biome = G.world.biomes[i];
                let color = colors[biome];
                if (!color || h < 0) {
                    const depth = Math.min(1, -h / 12);
                    color = G.world.murk[i] ? [70, 110, 100] : [60 - 40 * depth, 180 - 110 * depth, 190 - 60 * depth];
                }
                image.data.set([color[0], color[1], color[2], 255], i * 4);
            }
            m.putImageData(image, 0, 0);
        }
        c.imageSmoothingEnabled = true;
        c.drawImage(this.mapBase, 0, 0, size, size);
        // What hasn't been seen stays dark
        const fog = document.createElement('canvas');
        fog.width = fog.height = size;
        const f = fog.getContext('2d');
        f.fillStyle = '#20282a';
        f.fillRect(0, 0, size, size);
        f.globalCompositeOperation = 'destination-out';
        const cells = 64;
        const step = size / cells;
        for (const k of G.saved.explored) {
            const x = (k % cells + 0.5) * step;
            const y = (Math.floor(k / cells) + 0.5) * step;
            const gradient = f.createRadialGradient(x, y, 0, x, y, step * 3.2);
            gradient.addColorStop(0, 'rgba(0,0,0,1)');
            gradient.addColorStop(0.75, 'rgba(0,0,0,1)');
            gradient.addColorStop(1, 'rgba(0,0,0,0)');
            f.fillStyle = gradient;
            f.fillRect(x - step * 3.2, y - step * 3.2, step * 6.4, step * 6.4);
        }
        c.drawImage(fog, 0, 0);
        c.font = '600 15px Fredoka, sans-serif';
        c.textAlign = 'center';
        for (const key of G.saved.places) {
            const p = PLACES[key];
            if (p) {
                c.fillStyle = '#17161c';
                c.beginPath();
                c.arc(toMap(p.x), toMap(p.z), 5, 0, 7);
                c.fill();
                c.fillStyle = '#ffd24a';
                c.beginPath();
                c.arc(toMap(p.x), toMap(p.z), 3.5, 0, 7);
                c.fill();
                c.fillStyle = '#fff';
                c.fillText(p.name, toMap(p.x), toMap(p.z) - 8);
            }
        }
        for (const item of G.building.items) {
            c.fillStyle = item.type === 'sos' ? '#ff5a5a' : '#ffffff';
            c.fillRect(toMap(item.x) - 2, toMap(item.z) - 2, 4, 4);
        }
        const p = G.player.position;
        c.save();
        c.translate(toMap(p.x), toMap(p.z));
        c.rotate(-G.player.yaw);
        c.fillStyle = '#ff4a3a';
        c.strokeStyle = '#fff';
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(0, -11);
        c.lineTo(7, 8);
        c.lineTo(-7, 8);
        c.closePath();
        c.fill();
        c.stroke();
        c.restore();
    }

    openChest(item) {
        this.chest = item;
        this.open('bag');
    }

    renderChest() {
        const {G} = this;
        const body = el('panel-body');
        const chest = this.chest;
        body.innerHTML = `<div class="two-grids"><div><h3>Bag: tap to store</h3>${this.slotGrid(G.you.slots, 0, SLOTS, 'carry')}</div>
            <div><h3>Chest: tap to take</h3>${this.slotGrid(chest.slots, 0, chest.slots.length, 'stored')}</div></div>`;
        body.querySelectorAll('[data-carry]').forEach(button => button.addEventListener('click', () => {
            const i = Number(button.dataset.carry);
            const slot = G.you.slots[i];
            const free = chest.slots.indexOf(null);
            if (slot && free >= 0) {
                chest.slots[free] = slot;
                G.you.slots[i] = null;
                G.audio.play('pick');
                this.render();
                this.markHotbar();
            }
        }));
        body.querySelectorAll('[data-stored]').forEach(button => button.addEventListener('click', () => {
            const i = Number(button.dataset.stored);
            const slot = chest.slots[i];
            const free = G.you.slots.indexOf(null);
            if (slot && free >= 0) {
                G.you.slots[free] = slot;
                chest.slots[i] = null;
                G.audio.play('pick');
                this.render();
                this.markHotbar();
            }
        }));
    }
}
