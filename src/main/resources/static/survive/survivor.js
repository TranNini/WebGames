// The player's body and bag, as plain numbers and rules, so it can be tested without a screen.
import {ITEMS} from './items.js';

export const SLOTS = 24;
export const HOTBAR = 6;
export const HOURS_PER_SECOND = 24 / 480; // a day takes 8 minutes

export function newSurvivor() {
    return {
        health: 100, hunger: 80, thirst: 70, energy: 100, rest: 85, temp: 37,
        wet: 0, oxygen: 100,
        poison: 0, sick: 0,
        slots: new Array(SLOTS).fill(null),
        held: 0,
        wearing: null
    };
}

export function count(you, id) {
    return you.slots.reduce((sum, slot) => sum + (slot && slot.id === id ? slot.n : 0), 0);
}

export function hasAll(you, needs) {
    return Object.entries(needs).every(([id, n]) => count(you, id) >= n);
}

// What didn't fit
export function add(you, id, n = 1) {
    const item = ITEMS[id];
    const stack = item.stack || 1;
    let left = n;
    for (const slot of you.slots) {
        if (left > 0 && slot && slot.id === id && slot.n < stack) {
            const moved = Math.min(left, stack - slot.n);
            slot.n += moved;
            left -= moved;
        }
    }
    for (let i = 0; i < SLOTS && left > 0; i++) {
        if (!you.slots[i]) {
            const moved = Math.min(left, stack);
            you.slots[i] = {id, n: moved};
            if (item.tool) {
                you.slots[i].dur = item.tool.durability;
            }
            left -= moved;
        }
    }
    return left;
}

export function take(you, id, n = 1) {
    let left = n;
    for (let i = SLOTS - 1; i >= 0 && left > 0; i--) {
        const slot = you.slots[i];
        if (slot && slot.id === id) {
            const moved = Math.min(left, slot.n);
            slot.n -= moved;
            left -= moved;
            if (slot.n === 0) {
                you.slots[i] = null;
            }
        }
    }
    return left === 0;
}

export function takeAll(you, needs) {
    if (!hasAll(you, needs)) {
        return false;
    }
    for (const [id, n] of Object.entries(needs)) {
        take(you, id, n);
    }
    return true;
}

export function heldSlot(you) {
    return you.slots[you.held] || null;
}

export function heldTool(you) {
    const slot = heldSlot(you);
    return slot && ITEMS[slot.id].tool ? ITEMS[slot.id].tool : null;
}

// True when the tool broke
export function wearHeld(you, amount = 1) {
    const slot = heldSlot(you);
    if (!slot || slot.dur === undefined) {
        return false;
    }
    slot.dur -= amount;
    if (slot.dur <= 0) {
        you.slots[you.held] = null;
        return true;
    }
    return false;
}

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

// random: passed in, so that tests can decide. Returns a message when something notable happens.
export function eat(you, id, random = Math.random) {
    const item = ITEMS[id];
    const f = item.food;
    if (f) {
        you.hunger = clamp(you.hunger + f.hunger, 0, 100);
        you.thirst = clamp(you.thirst + f.thirst, 0, 100);
        you.health = clamp(you.health + (f.health || 0), 0, 100);
        if (f.sick && random() < f.sick) {
            you.sick = Math.max(you.sick, 4);
            return 'Your stomach turns. That made you sick.';
        }
        return null;
    }
    if (item.heal) {
        you.health = clamp(you.health + (item.heal.health || 0), 0, 100);
        for (const cure of item.heal.cures || []) {
            you[cure] = 0;
        }
    }
    return null;
}

export function drinkWater(you, kind, random = Math.random) {
    if (kind === 'sea') {
        you.thirst = clamp(you.thirst - 8, 0, 100);
        you.hunger = clamp(you.hunger - 1, 0, 100);
        return 'Salt water. It only makes you thirstier.';
    }
    you.thirst = clamp(you.thirst + 16, 0, 100);
    if (random() < (kind === 'swamp' ? 0.5 : 0.08)) {
        you.sick = Math.max(you.sick, 3);
        return 'Something in that water makes you feel sick.';
    }
    return null;
}

// The air: warm days, significantly colder nights. weather: the temperature it adds, and how hard it rains (0 to 1).
export function airTemperature(hour, weatherDelta) {
    const daily = Math.sin((hour - 9) / 24 * Math.PI * 2); // warmest at 15:00, coldest at 03:00
    return 24 + 8.5 * daily + weatherDelta;
}

// env: {hour, rain, tempDelta, nearFire, sheltered, inCave, swimming, underwater, inWater, sprinting, working, moving, inSun}
// Returns what killed the player, or null.
export function tick(you, dt, env) {
    const hours = dt * HOURS_PER_SECOND;

    you.hunger = clamp(you.hunger - hours * (env.sprinting ? 5.2 : 3.2), 0, 100);
    you.thirst = clamp(you.thirst - hours * (env.sprinting ? 7.4 : 4.6) * (you.temp > 38 ? 1.5 : 1), 0, 100);
    you.rest = clamp(you.rest - hours * (env.sprinting || env.working ? 5.2 : 3.4), 0, 100);

    if (env.sprinting || env.swimming && env.moving) {
        you.energy = clamp(you.energy - dt * (env.sprinting ? 9 : 3.5), 0, 100);
    } else if (!env.working) {
        const tiredness = you.rest < 15 ? 0.4 : you.hunger < 10 ? 0.5 : 1;
        you.energy = clamp(you.energy + dt * (env.moving ? 5 : 11) * tiredness, 0, 100);
    }

    // Getting wet and drying out
    const clothes = you.wearing ? ITEMS[you.wearing].wear : {warmth: 0, rain: 0};
    if (env.swimming || env.underwater) {
        you.wet = 100;
    } else if (env.rain > 0.05 && !env.sheltered && !env.inCave) {
        you.wet = clamp(you.wet + dt * 8 * env.rain * (1 - clothes.rain), 0, 100);
    } else {
        you.wet = clamp(you.wet - dt * (env.nearFire ? 6 : 1.2), 0, 100);
    }

    // Body temperature moves towards what the surroundings allow
    let feels = airTemperature(env.hour, env.tempDelta);
    feels += clothes.warmth * 2.2;
    feels -= you.wet * 0.09;
    if (env.nearFire) {
        feels = Math.max(feels, 27) + 4;
    }
    if (env.sheltered || env.inCave) {
        feels += 3.5;
    }
    if (env.inSun) {
        feels += 3;
    }
    const target = 37 + (feels - 24) * 0.11;
    you.temp += (target - you.temp) * Math.min(1, dt * 0.012);
    // Water cools you quickly; a fire, running and hard work warm you up
    if (env.swimming || env.underwater || env.inWater) {
        you.temp = you.temp > 35.8 ? Math.max(35.8, you.temp - dt * 0.07) : you.temp;
    }
    if (env.nearFire && you.temp < 38.2) {
        you.temp = Math.min(38.2, you.temp + dt * 0.06);
    }
    if ((env.sprinting || env.working) && you.temp < 38.6) {
        you.temp = Math.min(38.6, you.temp + dt * (env.working ? 0.05 : 0.035));
    }

    if (env.underwater) {
        you.oxygen = clamp(you.oxygen - dt * 6, 0, 100);
    } else {
        you.oxygen = clamp(you.oxygen + dt * 30, 0, 100);
    }

    // What hurts, in points per second
    const causes = [];
    if (you.hunger <= 0) causes.push(['starved', 0.5]);
    if (you.thirst <= 0) causes.push(['died of thirst', 0.8]);
    if (you.rest <= 0) causes.push(['collapsed from exhaustion', 0.35]);
    if (you.temp < 35) causes.push(['froze to death', (35 - you.temp) * 0.7 + 0.2]);
    if (you.temp > 39.3) causes.push(['died of heatstroke', (you.temp - 39.3) * 0.7 + 0.2]);
    if (you.oxygen <= 0) causes.push(['drowned', 7]);
    if (you.poison > 0) {
        you.poison = Math.max(0, you.poison - hours);
        causes.push(['died of a snake bite', 0.55]);
    }
    if (you.sick > 0) {
        you.sick = Math.max(0, you.sick - hours);
        you.hunger = clamp(you.hunger - hours * 2.5, 0, 100);
        you.thirst = clamp(you.thirst - hours * 3, 0, 100);
        causes.push(['died of sickness', 0.12]);
    }
    let worst = null;
    let worstRate = 0;
    for (const [cause, rate] of causes) {
        you.health -= rate * dt;
        if (rate > worstRate) {
            worst = cause;
            worstRate = rate;
        }
    }
    if (!causes.length && you.hunger > 35 && you.thirst > 35 && you.rest > 15) {
        you.health = clamp(you.health + dt * 0.28, 0, 100);
    }
    if (you.health <= 0) {
        you.health = 0;
        return worst || 'died';
    }
    return null;
}

// A night's sleep or a nap. quality: 1 in a bed, less on the ground.
export function sleepFor(you, hours, quality) {
    you.rest = clamp(you.rest + hours * 13 * quality, 0, 100);
    you.energy = 100;
    you.hunger = clamp(you.hunger - hours * 1.6, 0, 100);
    you.thirst = clamp(you.thirst - hours * 2.2, 0, 100);
    you.health = clamp(you.health + hours * 2.5 * quality, 0, 100);
    you.poison = Math.max(0, you.poison - hours);
    you.sick = Math.max(0, you.sick - hours);
    you.wet = clamp(you.wet - hours * 14, 0, 100);
}
