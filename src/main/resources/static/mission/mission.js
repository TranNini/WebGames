// She flies through the lab saving kittens, for as far as she can get: the distance is the score. All in units: the world is 100 high.
// Moving things follow how far she has come (camera), not the clock, so what can be passed once can always be passed.
const PACE = 44; // units per second. It stays the same; only a boost is faster.
const UNITS_PER_METER = 10;
const GROUND = 84;
const GIRL_X = 42;
const CEILING = 20; // the highest her middle gets
const WALK_HEIGHT = 8.5; // from her middle to the floor when she walks
const FLY_RISE = 62;
const FLY_SINK = 50;
const FLY_TURN = 520; // how quickly she changes between the two
const GRAVITY = 280;
const JUMP_SPEED = 150;
const SHORT_JUMP_SPEED = 55; // letting go early cuts a jump to this
const MOST_FALL = 115;
// What can hurt her is her head, body and legs in her pose, not her hair, wing or shoes (POSES in frames.js).
const FEET = {left: -4, right: 5}; // what lands on a platform
// What collects stars and frees kittens: a little wider than her body, not the tips of her hair.
const STAR_REACH = {left: -7.5, right: 9.5, top: -13, bottom: 9};
const RAIL_HEIGHT = 8.2; // between the beams of a fence
const HOLDER_HALF_WIDTH = 2.4; // of what a laser comes out of
const JUMP_MEMORY_MS = 110; // a press just before landing still jumps
const AFTER_EDGE_MS = 80; // and one just after running off a platform

const ENERGY_PER_SECOND = 8.5; // flying
const ENERGY_PER_STAR = 3.5;
const ENERGY_PER_STAR_WALKING = 7; // so that a walk doesn't last long: she mainly flies
const ENERGY_PER_BIG_STAR = 30;
const LOW_ENERGY = 25;
const KITTEN_EVERY = 190; // a kitten about every 5 seconds
const BIG_STAR_EVERY = 5; // kittens in a row
const BOOST_EVERY = 10;
const HEART_EVERY = 25;
const TUBE_HALF_WIDTH = 6.5; // what she has to touch, a bit smaller than the tube looks
const TUBE_HEIGHT = 20;
// Missed kittens: each brings a security alert, worse up to the third, and five in a row forgive them. The first also breaks her wings.
const ALERT_MS = 10000;
const LAST_ALERT = 3;
const SIREN_MS = 2500;
const MISSES_FORGIVEN_AFTER = 5; // kittens in a row
const SCREEN_FRAMES = 6;
const SCREEN_FRAME_MS = 140;
const BANNER_FRAMES = 6;
const BANNER_FRAME_MS = 110;
const DRONE_DRIFT = 0.25; // how much faster than the rest they come at her
// From the second alert on there is more of everything: an obstacle in the middle of each gap, and lasers above to catch her flying
const ALERT_GAPS = [null, null, {shortest: 104, longest: 118}, {shortest: 104, longest: 112}];
const BOOST_SPEED = 1.9;
const BOOST_MS = 4500;
const BOOST_WARNING_MS = 1400; // the bubble blinks for this long before it goes
const AFTER_BOOST_MS = 500; // safe, without blinking, for what she was in the middle of
const AFTER_HIT_MS = 1400;
const NOTICE_MS = 2200;
const GAP = {shortest: 56, longest: 84};
const VIEW_AHEAD = 40;

const canvas = $('canvas');
const paint = canvas.getContext('2d');
const held = new Set();
let camera = 0;
let time = 0;
let step = 0;
let energy = 100;
let kittens = 0;
let streak = 0;
let misses = 0;
let alertLevel = 0;
let alertLeft = 0;
let brokenWingsLeft = 0;
let sirenLeft = 0;
let girl = newGirl();
let things = [];
let platforms = [];
let tubes = [];
let stars = [];
let sparkles = [];
let nextX = 0;
let nextKittenAt = 0;
let boostLeft = 0;
let safeLeft = 0;
let hurtLeft = 0;
let noticeLeft = 0;
let warnedLow = false;
let lastChunk = null;
let starNote = 0;
let lastFrame = 0;
let shownEnergy = -1;
let showTouchAreas = Boolean(remembered('mission-settings').touchAreas);
let unlimitedHearts = Boolean(remembered('mission-settings').unlimitedHearts);
let testRun = false; // unlimited hearts were on at some point: its distance doesn't go on the leaderboard

function newGirl() {
    return {y: 50, vy: 0, onGround: false, flying: true, walking: false, rising: false, pressedAgo: Infinity, leftEdgeAgo: Infinity};
}

function newGame() {
    state = 'intro';
    score = 0;
    strikes = 0;
    kittens = 0;
    streak = 0;
    showScore();
    showKittens();
    showScreen('intro');
}

function startGame() {
    Sound.unlock();
    Sound.start();
    Sound.setMusicSpeed(0);
    Sound.startMusic();
    camera = 0;
    time = 0;
    step = 0;
    energy = 100;
    kittens = 0;
    streak = 0;
    misses = 0;
    alertLevel = 0;
    alertLeft = 0;
    brokenWingsLeft = 0;
    girl = newGirl();
    things = [];
    platforms = [];
    tubes = [];
    stars = [];
    sparkles = [];
    nextX = 150;
    nextKittenAt = 80;
    boostLeft = 0;
    safeLeft = 0;
    hurtLeft = 0;
    noticeLeft = 0;
    warnedLow = false;
    lastChunk = null;
    testRun = unlimitedHearts;
    held.clear();
    state = 'playing';
    showKittens();
    showNotice('');
    showScreen('stage');
    goOn();
}

function goOn() {
    held.clear();
    fitCanvas();
    lastFrame = performance.now();
    requestAnimationFrame(frame);
}

function line(x, height, count, gap = 7.5) {
    for (let i = 0; i < count; i++) {
        stars.push({x: x + i * gap, y: GROUND - height});
    }
}

function wave(x, height, count, size = 9, gap = 7.5) {
    for (let i = 0; i < count; i++) {
        stars.push({x: x + i * gap, y: GROUND - height - Math.sin(i / 2.2) * size});
    }
}

// Over something, the way a jump goes
function arc(x, count, top = 40, gap = 8) {
    for (let i = 0; i < count; i++) {
        const along = i / (count - 1) * 2 - 1;
        stars.push({x: x + i * gap, y: GROUND - 12 - (top - 12) * (1 - along * along)});
    }
}

// While she walks, or soon will, stars come where she can reach them on foot
function starHeight() {
    return girl.walking || energy < 35 ? 12 + Math.random() * 14 : 16 + Math.random() * 40;
}

function spikes(x, count, base = GROUND) {
    things.push({kind: 'spikes', x, width: Scene.spikeWidth(count), height: 10, base});
}

function post(x, height = 21, base = GROUND) {
    things.push({kind: 'post', x, width: 2, height, base});
}

// A platform in the air, itself in the way too, with something on it
function ledge(x, top) {
    things.push({kind: 'ledge', x, width: 34, top});
}

function hanging(x, bottom = GROUND - 37) {
    things.push({kind: 'hanging', x, width: 2, bottom});
}

function mover(x, phase, place = {middle: 26, reach: 19}) {
    things.push({kind: 'mover', x, width: 2, length: 15, wavelength: 120, phase, ...place});
}

// Security drones: they come flying at her, and stay above her head when she is on foot
function drone(x, phase, alarm) {
    things.push({kind: 'drone', x, width: 9, middle: 48, reach: 13, wavelength: 150, phase, alarm});
}

function beam(x, phase) {
    things.push({kind: 'beam', x, width: 10, length: 2, middle: 24, reach: 18, wavelength: 170, phase});
}

// from: from how many kittens on. flyingOnly: not to be got past on foot, so it only comes when her wings are sure to last.
const CHUNKS = [
    {from: 0, name: 'small spikes', make: x => { spikes(x + 12, 2); arc(x, 6); return 36; }},
    {from: 0, name: 'wide spikes', make: x => { spikes(x + 14, 3); arc(x, 7, 44); return 44; }},
    {from: 0, name: 'stars in a line', onlyStars: true, make: x => { line(x, starHeight(), 8); return 58; }},
    {from: 0, name: 'stars in a wave', onlyStars: true, make: x => { wave(x, starHeight(), 9, 8); return 66; }},
    {from: 1, name: 'laser from the floor', make: x => { post(x + 16); arc(x, 6, 42); return 36; }},
    {from: 2, name: 'laser from the ceiling', make: x => { hanging(x + 24); line(x, 12, 7); spikes(x + 74, 2); return 96; }},
    {from: 3, name: 'a high gap', flyingOnly: true, make: x => { post(x + 18, 34); hanging(x + 18, GROUND - 74); wave(x, 54, 6, 3); return 56; }},
    {from: 4, name: 'a platform with stars', make: x => { platforms.push({x: x + 16, width: 68, top: GROUND - 25}); spikes(x + 40, 3); line(x + 24, 38, 7); return 86; }},
    {from: 5, name: 'a moving laser', make: x => { mover(x + 10, 0.75); line(x + 38, starHeight(), 4); return 66; }},
    {from: 6, name: 'a low gap', flyingOnly: true, make: x => { post(x + 18, 8); hanging(x + 18, GROUND - 50); line(x, 22, 5); return 42; }},
    {from: 7, name: 'a gate', make: x => { post(x + 12, 9); hanging(x + 12, GROUND - 60); line(x + 2, 22, 3); return 28; }},
    {from: 9, name: 'a moving beam', make: x => { beam(x + 8, 0.75); wave(x + 40, 16, 4, 4); return 72; }},
    {from: 11, name: 'a fence under a platform', make: x => {
        platforms.push({x: x + 14, width: 68, top: GROUND - 29});
        things.push({kind: 'fence', x: x + 34, width: 38, height: 24});
        line(x + 38, 42, 5);
        return 92;
    }},
    {from: 2, name: 'spikes on a platform in the middle', make: x => { ledge(x + 10, GROUND - 46); spikes(x + 13, 3, GROUND - 46); spikes(x + 84, 2); wave(x + 56, 22, 4, 4); return 104; }},
    {from: 4, name: 'a laser on a platform at the top', make: x => { ledge(x + 10, GROUND - 58); post(x + 26, 18, GROUND - 58); post(x + 86); line(x + 50, 32, 4); return 96; }},
    {from: 6, name: 'a laser on a platform in the middle', make: x => { ledge(x + 10, GROUND - 46); post(x + 26, 18, GROUND - 46); spikes(x + 84, 2); return 104; }},
    {from: 13, name: 'two lasers', make: x => { post(x + 8); post(x + 66); return 76; }},
    {from: 15, name: 'a laser and spikes', make: x => { hanging(x + 8); spikes(x + 62, 3); arc(x + 52, 6); return 92; }},
    {from: 18, name: 'two moving lasers', make: x => { mover(x + 10, 0.75); mover(x + 76, 0.75); return 96; }}
];

function between(lowest, highest) {
    return lowest + Math.random() * (highest - lowest);
}

function addNext() {
    if (nextX >= nextKittenAt) {
        tubes.push({x: nextX + 11, look: Math.floor(Math.random() * 100), opened: 0, saved: false});
        nextX += 28;
        nextKittenAt = nextX + KITTEN_EVERY * 0.75;
    }
    const level = alertLeft > 0 ? alertLevel : 0;
    const wingsLast = !girl.walking && energy >= 55 && brokenWingsLeft === 0;
    // From the second alert on, all there is, and only what is in her way
    const seen = level >= 2 ? Infinity : kittens;
    const possible = CHUNKS.filter(chunk => seen >= chunk.from && chunk !== lastChunk && (wingsLast || !chunk.flyingOnly) && (level < 2 || !chunk.onlyStars));
    lastChunk = possible[Math.floor(Math.random() * possible.length)];
    const before = things.length;
    nextX += lastChunk.make(nextX);
    if (lastChunk.flyingOnly) {
        things.slice(before).forEach(thing => {
            thing.flyingOnly = true;
        });
    }
    if (girl.walking || energy < LOW_ENERGY || brokenWingsLeft > 0) {
        line(nextX + 8, 10, 5); // something to refill on, so that a walk doesn't last
    }
    const gap = between((ALERT_GAPS[level] || GAP).shortest, (ALERT_GAPS[level] || GAP).longest);
    if (level >= 2) {
        addExtras(level, gap);
    }
    nextX += gap;
}

// What an alert adds to a gap: one more on the floor to jump, and above her head lasers that leave her alone on foot
function addExtras(level, gap) {
    if (Math.random() < 0.5) {
        post(nextX + gap / 2 - 1);
    } else {
        spikes(nextX + gap / 2 - Scene.spikeWidth(1), 2);
    }
    hanging(nextX + gap * 0.2);
    drone(nextX + gap * 0.74, 0, level >= LAST_ALERT); // not above the one on the floor: she has to be able to jump that
    if (level >= LAST_ALERT) {
        hanging(nextX + gap * 0.88);
        drone(nextX + gap * 0.3, 0.5, true);
    }
}

// Where something that can hurt her is
function hitBoxOf(thing, at) {
    if (thing.kind === 'ledge') {
        return {left: thing.x, right: thing.x + thing.width, top: thing.top, bottom: thing.top + 7};
    }
    if (thing.kind === 'spikes' || thing.kind === 'post' || thing.kind === 'fence') {
        const base = thing.base || GROUND;
        return {left: thing.x, right: thing.x + thing.width, top: base - thing.height, bottom: base};
    }
    if (thing.kind === 'hanging') {
        return {left: thing.x, right: thing.x + thing.width, top: 0, bottom: thing.bottom};
    }
    const reached = at + GIRL_X - thing.x;
    if (thing.kind === 'drone') {
        const middleX = thing.x - reached * DRONE_DRIFT;
        const middleY = GROUND - thing.middle - thing.reach * Math.sin((reached / thing.wavelength + thing.phase) * Math.PI * 2);
        return {left: middleX - 4, right: middleX + 4, top: middleY - 3.5, bottom: middleY + 3.5};
    }
    const height = thing.middle + thing.reach * Math.sin((reached / thing.wavelength + thing.phase) * Math.PI * 2);
    const y = GROUND - height;
    return {left: thing.x, right: thing.x + thing.width, top: y - thing.length / 2, bottom: y + thing.length / 2};
}

function circleTouchesBox(circle, left, right, top, bottom) {
    const nearX = Math.max(left, Math.min(right, circle.x));
    const nearY = Math.max(top, Math.min(bottom, circle.y));
    return Math.hypot(circle.x - nearX, circle.y - nearY) < circle.size;
}

// A spike is a triangle: along its sides, and inside
function circleTouchesSpike(circle, left, width, height, base) {
    const middle = left + width / 2;
    const top = base - height;
    if (circle.y >= top && circle.y <= base && Math.abs(circle.x - middle) < width / 2 * (circle.y - top) / height) {
        return true;
    }
    for (let along = 0; along <= 1; along += 0.1) {
        const y = top + height * along;
        if (Math.hypot(circle.x - (middle - width / 2 * along), circle.y - y) < circle.size || Math.hypot(circle.x - (middle + width / 2 * along), circle.y - y) < circle.size) {
            return true;
        }
    }
    return false;
}

// What hurts: a little less than can be seen of the beams, the holders they come out of, the spikes and platforms, so that she can get past
function shapesOf(thing, box) {
    if (thing.kind === 'spikes') {
        const each = Scene.spikeWidth(1);
        const spikeShapes = [];
        for (let at = 0; at < thing.width - 0.1; at += each) {
            spikeShapes.push({spike: true, left: thing.x + at + each * 0.15, width: each * 0.7, height: thing.height * 0.85, base: box.bottom});
        }
        return spikeShapes;
    }
    if (thing.kind === 'drone') {
        return [box];
    }
    if (thing.kind === 'ledge') {
        return [{left: box.left + 1.5, right: box.right - 1.5, top: box.top + 1, bottom: box.bottom - 1}];
    }
    if (thing.kind === 'post' || thing.kind === 'mover') {
        const middle = thing.x + 1;
        return [
            {left: thing.x + 0.4, right: thing.x + 1.6, top: box.top, bottom: box.bottom},
            {left: middle - HOLDER_HALF_WIDTH, right: middle + HOLDER_HALF_WIDTH, top: box.top + 0.8, bottom: box.top + 4.6},
            {left: middle - HOLDER_HALF_WIDTH, right: middle + HOLDER_HALF_WIDTH, top: box.bottom - 4, bottom: box.bottom}
        ];
    }
    if (thing.kind === 'hanging') {
        const middle = thing.x + 1;
        return [
            {left: thing.x + 0.4, right: thing.x + 1.6, top: 0, bottom: thing.bottom},
            {left: middle - HOLDER_HALF_WIDTH, right: middle + HOLDER_HALF_WIDTH, top: thing.bottom - 4, bottom: thing.bottom - 0.5}
        ];
    }
    const rows = thing.kind === 'fence' ? [0, 1, 2].map(row => GROUND - RAIL_HEIGHT * (row + 0.5)) : [(box.top + box.bottom) / 2];
    return rows.flatMap(y => [
        {left: box.left, right: box.right, top: y - 0.6, bottom: y + 0.6},
        {left: box.left - 3.5, right: box.left, top: y - 2.6, bottom: y + 2.6},
        {left: box.right, right: box.right + 3.5, top: y - 2.6, bottom: y + 2.6}
    ]);
}

function circleTouchesThing(circle, thing, box) {
    return shapesOf(thing, box).some(shape => (shape.spike
        ? circleTouchesSpike(circle, shape.left, shape.width, shape.height, shape.base)
        : circleTouchesBox(circle, shape.left, shape.right, shape.top, shape.bottom)));
}

function touches(thing, body, at) {
    const box = hitBoxOf(thing, at);
    const x = at + GIRL_X;
    if (box.left > x + 20 || box.right + 6 < x - 20) {
        return false;
    }
    return POSES[poseOf(body)].circles.some(part => circleTouchesThing({x: x + part.x, y: body.y + part.y, size: part.size}, thing, box));
}

function poseOf(body) {
    if (!body.flying) {
        return body.onGround ? 'walk' : body.vy < 0 ? 'ascend' : 'descend';
    }
    if (body.y >= GROUND - WALK_HEIGHT - 1) {
        return 'hover';
    }
    return body.vy < -30 ? 'ascend' : body.vy > 60 ? 'descend' : 'fly';
}

// Moves her a moment on. Also used to try out what can be passed.
function moveGirl(body, seconds, holding, canFly, at, floors) {
    const milliseconds = seconds * 1000;
    body.pressedAgo += milliseconds;
    body.leftEdgeAgo += milliseconds;
    if (canFly) {
        const wanted = holding ? -FLY_RISE : FLY_SINK;
        const turn = FLY_TURN * seconds;
        body.vy += Math.max(-turn, Math.min(turn, wanted - body.vy));
        body.y = Math.max(CEILING, Math.min(GROUND - WALK_HEIGHT, body.y + body.vy * seconds));
        body.flying = true;
        body.onGround = false;
        body.rising = false;
        return;
    }
    body.flying = false;
    if (body.pressedAgo <= JUMP_MEMORY_MS && (body.onGround || body.leftEdgeAgo <= AFTER_EDGE_MS)) {
        body.vy = -JUMP_SPEED;
        body.onGround = false;
        body.rising = true;
        body.pressedAgo = Infinity;
        body.leftEdgeAgo = Infinity;
    }
    if (body.rising && !holding && body.vy < -SHORT_JUMP_SPEED) {
        body.vy = -SHORT_JUMP_SPEED;
    }
    body.vy = Math.min(body.vy + GRAVITY * seconds, MOST_FALL);
    if (body.vy >= 0) {
        body.rising = false;
    }
    const before = body.y;
    body.y += body.vy * seconds;
    const x = at + GIRL_X;
    const landing = body.vy >= 0 && floors.find(floor => x + FEET.right > floor.x && x + FEET.left < floor.x + floor.width
        && before <= floor.top - WALK_HEIGHT + 0.5 && body.y >= floor.top - WALK_HEIGHT);
    const wasOnGround = body.onGround;
    if (landing) {
        body.y = landing.top - WALK_HEIGHT;
        body.vy = 0;
        body.onGround = true;
    } else if (body.y >= GROUND - WALK_HEIGHT) {
        body.y = GROUND - WALK_HEIGHT;
        body.vy = 0;
        body.onGround = true;
    } else {
        body.onGround = false;
        if (wasOnGround) {
            body.leftEdgeAgo = 0;
        }
    }
}

function update(milliseconds) {
    const boosting = boostLeft > 0;
    const seconds = milliseconds / 1000;
    const pace = PACE * (boosting ? BOOST_SPEED : 1);
    camera += pace * seconds;
    time += milliseconds;
    step += (girl.flying ? 8 : 11) * seconds;
    if (boosting) {
        boostLeft = Math.max(0, boostLeft - milliseconds);
        if (boostLeft === 0) {
            safeLeft = AFTER_BOOST_MS;
            showNotice('');
        }
    }
    safeLeft = Math.max(0, safeLeft - milliseconds);
    hurtLeft = Math.max(0, hurtLeft - milliseconds);
    tickAlert(milliseconds);
    moveGirl(girl, seconds, held.size > 0, (!girl.walking && brokenWingsLeft === 0) || boosting, camera, platforms);
    spendEnergy(seconds, boosting);
    dropStarDust(milliseconds);

    while (nextX < camera + Scene.viewWidth() + VIEW_AHEAD) {
        addNext();
    }
    showDistance(); // before a last hit, as the game over saves it
    collectStars();
    saveKittens();
    checkHits();
    moveSparkles(seconds, pace);
    showEnergy();
    showWarnings(milliseconds);
    const passed = camera - 40;
    things = things.filter(thing => thing.x + thing.width > passed);
    platforms = platforms.filter(platform => platform.x + platform.width > passed);
    tubes = tubes.filter(tube => tube.x > passed);
    stars = stars.filter(star => star.x > passed);
}

function spendEnergy(seconds, boosting) {
    if (boosting || girl.walking || brokenWingsLeft > 0) {
        return;
    }
    energy = Math.max(0, energy - ENERGY_PER_SECOND * seconds);
    if (energy <= LOW_ENERGY && !warnedLow) {
        warnedLow = true;
        Sound.warn();
    } else if (energy > LOW_ENERGY) {
        warnedLow = false;
    }
    if (energy === 0) {
        girl.walking = true;
        Sound.miss();
    }
}

function gainEnergy(amount) {
    energy = Math.min(100, energy + amount);
    if (girl.walking && energy >= 100) {
        girl.walking = false;
        girl.vy = -FLY_RISE;
        warnedLow = false;
        Sound.start();
        showNotice('Wings full. Fly!');
    }
}

// Star dust behind her while she flies, as in the picture
function dropStarDust(milliseconds) {
    if (!girl.flying || Math.random() > milliseconds / 45) {
        return;
    }
    sparkles.push({
        x: GIRL_X - 12 - Math.random() * 12,
        y: girl.y + 6 + Math.random() * 11,
        size: 0.3 + Math.random() * 0.75,
        life: 1
    });
}

function collectStars() {
    const x = camera + GIRL_X;
    stars = stars.filter(star => {
        const inReach = star.x > x + STAR_REACH.left && star.x < x + STAR_REACH.right
            && star.y > girl.y + STAR_REACH.top && star.y < girl.y + STAR_REACH.bottom;
        if (!inReach) {
            return true;
        }
        gainEnergy(star.big ? ENERGY_PER_BIG_STAR : girl.walking ? ENERGY_PER_STAR_WALKING : ENERGY_PER_STAR);
        starNote = (starNote + 1) % 8;
        Sound.tap(starNote);
        for (let i = 0; i < (star.big ? 8 : 3); i++) {
            sparkles.push({x: star.x - camera + (Math.random() - 0.5) * 8, y: star.y + (Math.random() - 0.5) * 8, size: 0.3 + Math.random() * 0.5, life: 1});
        }
        return false;
    });
}

// A kitten is only saved when she touches its tube. One she goes past sets off the alarm.
function saveKittens() {
    const x = camera + GIRL_X;
    for (const tube of tubes) {
        if (!tube.saved && !tube.missed) {
            const touching = tube.x + TUBE_HALF_WIDTH > x + STAR_REACH.left && tube.x - TUBE_HALF_WIDTH < x + STAR_REACH.right
                && girl.y + STAR_REACH.bottom > GROUND - TUBE_HEIGHT;
            if (touching) {
                tube.saved = true;
                kittens++;
                streak++;
                showKittens();
                Sound.meow();
                giveReward();
                if (streak >= MISSES_FORGIVEN_AFTER && misses > 0) {
                    misses = 0;
                }
            } else if (tube.x + TUBE_HALF_WIDTH < x + STAR_REACH.left) {
                tube.missed = true;
                missKitten();
            }
        }
        if (tube.saved) {
            tube.opened = Math.min(1, tube.opened + 0.022);
        }
    }
}

function missKitten() {
    streak = 0;
    showKittens();
    if (alertLeft > 0 && alertLevel >= LAST_ALERT) {
        return; // it is at its worst already: she only has to survive until it is over
    }
    misses = Math.min(LAST_ALERT, misses + 1);
    alertLevel = misses;
    alertLeft = ALERT_MS;
    sirenLeft = SIREN_MS;
    Sound.siren();
    if (misses === 1) {
        brokenWingsLeft = ALERT_MS;
        // Nothing ahead of her that can't be passed on foot
        things = things.filter(thing => !thing.flyingOnly || thing.x < camera + GIRL_X);
    }
    clearWhatIsComing();
    showNotice('');
}

// So that the alert is felt right away: what she can't see yet is replaced by what comes with it
function clearWhatIsComing() {
    const edge = camera + Scene.viewWidth();
    things = things.filter(thing => thing.x < edge);
    platforms = platforms.filter(platform => platform.x < edge);
    stars = stars.filter(star => star.x < edge);
    tubes = tubes.filter(tube => tube.x < edge);
    const lastInView = Math.max(edge, ...things.map(thing => thing.x + thing.width + GAP.shortest), ...platforms.map(platform => platform.x + platform.width + GAP.shortest));
    nextX = lastInView + 2;
}

function tickAlert(milliseconds) {
    brokenWingsLeft = Math.max(0, brokenWingsLeft - milliseconds);
    if (alertLeft === 0) {
        return;
    }
    alertLeft = Math.max(0, alertLeft - milliseconds);
    sirenLeft -= milliseconds;
    if (sirenLeft <= 0 && alertLeft > 0) {
        sirenLeft = SIREN_MS;
        Sound.siren();
    }
}

// What kittens in a row bring: a miss starts this over, so it also delays them
function giveReward() {
    if (streak % BIG_STAR_EVERY === 0) {
        stars.push({x: camera + GIRL_X + 62, y: Math.max(CEILING + 8, Math.min(GROUND - 16, girl.y)), big: true});
    }
    if (streak % BOOST_EVERY === 0) {
        boostLeft = BOOST_MS;
        safeLeft = 0;
        Sound.start();
    }
    if (streak % HEART_EVERY === 0) {
        strikes = Math.max(0, strikes - 1);
        showScore();
    }
}

function checkHits() {
    if (boostLeft > 0 || safeLeft > 0 || hurtLeft > 0) {
        return;
    }
    if (things.some(thing => touches(thing, girl, camera))) {
        if (!unlimitedHearts) {
            strikes++;
        }
        showScore();
        hurtLeft = AFTER_HIT_MS;
        Sound.miss();
        if (strikes >= MAX_STRIKES) {
            const saved = kittens + (kittens === 1 ? ' kitten' : ' kittens') + ' saved';
            draw();
            if (testRun) {
                score = 0;
                showScore();
            }
            finishGame('No hearts left. ' + saved + (testRun ? '. Test run: not on the leaderboard' : ''));
        }
    }
}

function moveSparkles(seconds, pace) {
    for (const sparkle of sparkles) {
        sparkle.x -= pace * seconds * 0.85;
        sparkle.y += seconds * 5;
        sparkle.life -= seconds * 1.1;
    }
    sparkles = sparkles.filter(sparkle => sparkle.life > 0);
}

function showDistance() {
    const meters = Math.floor(camera / UNITS_PER_METER);
    if (meters !== score) {
        score = meters;
        showScore();
    }
}

function showKittens() {
    $('kittens').textContent = kittens;
    $('streak').textContent = streak;
}

function showEnergy() {
    const rounded = Math.round(energy);
    if (rounded !== shownEnergy) {
        shownEnergy = rounded;
        $('energy').style.clipPath = 'inset(0 ' + (100 - rounded) + '% 0 0 round 6px)';
    }
    $('wings').classList.toggle('low', energy <= LOW_ENERGY && !girl.walking && brokenWingsLeft === 0);
    $('wings').classList.toggle('empty', girl.walking || brokenWingsLeft > 0);
}

function showNotice(text) {
    $('notice').textContent = text;
    $('notice').hidden = !text;
    $('notice').classList.remove('warning');
    noticeLeft = text ? NOTICE_MS : 0;
}

// A short message goes first; otherwise she is warned for as long as it lasts
// What an alert shows on the wall: the cat screen for the first, the banner for the second, for maximum security both
function alertSigns() {
    if (alertLeft === 0) {
        return {};
    }
    const age = ALERT_MS - alertLeft;
    const appearing = Math.floor(age / SCREEN_FRAME_MS);
    const screenFrame = appearing < SCREEN_FRAMES ? appearing : appearing % 5 === 4 ? SCREEN_FRAMES - 2 : SCREEN_FRAMES - 1; // and then a glitch now and then
    return {
        screen: alertLevel !== 2 ? 'alert-screen-' + screenFrame : null,
        banner: alertLevel >= 2 ? 'alert-banner-' + Math.floor(age / BANNER_FRAME_MS) % BANNER_FRAMES : null
    };
}

function showWarnings(milliseconds) {
    if (noticeLeft > 0) {
        noticeLeft -= milliseconds;
        if (noticeLeft <= 0) {
            showNotice('');
        }
        return;
    }
    let warning = '';
    if (boostLeft === 0 && brokenWingsLeft === 0) {
        warning = girl.walking ? 'Collect stars to fly again!' : energy <= LOW_ENERGY ? 'Low energy!' : '';
    }
    if ($('notice').textContent !== warning) {
        $('notice').textContent = warning;
    }
    $('notice').hidden = !warning;
    $('notice').classList.toggle('warning', Boolean(warning));
}

function draw() {
    Scene.draw(paint, {
        camera, time, things, platforms, tubes, stars, sparkles, girl, step, hitBoxOf, girlX: GIRL_X,
        boostLeft, boostWarnFrom: BOOST_WARNING_MS, blink: hurtLeft > 0, alert: alertLeft > 0 ? alertLevel : 0, signs: alertSigns(), pose: poseOf(girl), hurtAge: hurtLeft > 0 ? AFTER_HIT_MS - hurtLeft : null,
        touchAreas: showTouchAreas ? touchAreas() : null
    });
}

// To look at, from the settings: what counts as touching
function touchAreas() {
    const x = camera + GIRL_X;
    return {
        body: POSES[poseOf(girl)].circles.map(part => ({x: GIRL_X + part.x, y: girl.y + part.y, size: part.size})),
        reach: {left: GIRL_X + STAR_REACH.left, right: GIRL_X + STAR_REACH.right, top: girl.y + STAR_REACH.top, bottom: girl.y + STAR_REACH.bottom},
        tubes: tubes.filter(tube => !tube.saved && !tube.missed).map(tube => ({left: tube.x - TUBE_HALF_WIDTH - camera, right: tube.x + TUBE_HALF_WIDTH - camera, top: GROUND - TUBE_HEIGHT, bottom: GROUND})),
        obstacles: things.filter(thing => thing.x - 10 < x + Scene.viewWidth()).flatMap(thing => shapesOf(thing, hitBoxOf(thing, camera)).map(shape => ({...shape, left: shape.left - camera, right: shape.spike ? 0 : shape.right - camera})))
    };
}

function rememberTestSwitches() {
    remember('mission-settings', {touchAreas: showTouchAreas, unlimitedHearts});
}

// For trying the game out. A run with unlimited hearts never counts for the leaderboard.
function setUpTestSwitches() {
    $('resume').insertAdjacentHTML('beforebegin', `<label class="setting row">
        <span>Unlimited hearts</span>
        <input id="unlimited-hearts" type="checkbox" class="switch">
    </label>
    <label class="setting row">
        <span>Show touch areas</span>
        <input id="touch-areas" type="checkbox" class="switch">
    </label>
    <p id="touch-legend" class="touch-legend"><b class="green">Green</b> her body: what can be hurt. <b class="red">Red</b> what hurts. <b class="yellow">Yellow</b> what collects stars.</p>`);
    $('touch-areas').checked = showTouchAreas;
    $('touch-legend').hidden = !showTouchAreas;
    $('touch-areas').addEventListener('change', () => {
        showTouchAreas = $('touch-areas').checked;
        $('touch-legend').hidden = !showTouchAreas;
        rememberTestSwitches();
    });
    $('unlimited-hearts').checked = unlimitedHearts;
    $('unlimited-hearts').addEventListener('change', () => {
        unlimitedHearts = $('unlimited-hearts').checked;
        testRun = testRun || unlimitedHearts;
        rememberTestSwitches();
    });
}

function frame(now) {
    if (state !== 'playing') {
        return;
    }
    const passed = Math.min(now - lastFrame, 50); // a long gap (the page was hidden) doesn't count
    lastFrame = now;
    update(passed);
    if (state === 'playing') {
        draw();
        requestAnimationFrame(frame);
    }
}

function fitCanvas() {
    const ratio = Math.min(window.devicePixelRatio || 1, 3); // every pixel the screen has, so it stays sharp
    const width = Math.round(canvas.clientWidth * ratio);
    const height = Math.round(canvas.clientHeight * ratio);
    if (width > 0 && height > 0 && (canvas.width !== width || canvas.height !== height)) {
        canvas.width = width;
        canvas.height = height;
        Scene.fit(width, height);
        draw();
    }
}

function press(who) {
    held.add(who);
    if (state === 'playing') {
        girl.pressedAgo = 0;
    }
}

function setUpEvents() {
    $('start').addEventListener('click', startGame);
    new ResizeObserver(() => {
        if (state === 'playing' || state === 'ending') {
            fitCanvas();
        }
    }).observe(canvas);

    const stage = $('stage');
    stage.addEventListener('pointerdown', event => {
        event.preventDefault();
        stage.setPointerCapture(event.pointerId);
        press(event.pointerId);
    });
    for (const ending of ['pointerup', 'pointercancel']) {
        stage.addEventListener(ending, event => held.delete(event.pointerId));
    }
    document.addEventListener('keydown', event => {
        if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) {
            return;
        }
        if (event.key === ' ' || event.key === 'ArrowUp' || event.key === 'w') {
            event.preventDefault();
            if (state === 'playing') {
                press(event.key);
            }
        } else if (event.key === 'Escape') {
            $('menu-button').click();
        } else if (event.key === 'Enter' && $('menu').hidden && event.target.tagName !== 'BUTTON' && event.target.tagName !== 'A') {
            if (state === 'intro' && !$('start').disabled) {
                startGame();
            } else if (state === 'over') {
                $('again').click();
            }
        }
    });
    document.addEventListener('keyup', event => held.delete(event.key));
}

if (navigator.maxTouchPoints === 0) {
    $('how').textContent = 'Kittens have been abducted! Hold Space or the up arrow to rise, let go to sink. Stars fill her energy; with none left she walks, and Space jumps. Touch the tubes to free the kittens, as a miss sets off the alarm. Go as far as you can. Enter starts, Esc pauses.';
}
Sound.setTune('mission');
setUpEvents();
setUpTestSwitches();
setUpGame({
    screens: ['intro', 'stage'],
    newGame,
    resume: goOn,
    leaderboardUrl: () => '/api/leaderboard/mission',
    leaderboardTitle: () => 'Furthest (meters)'
});
$('start').disabled = true;
Scene.ready.then(() => {
    $('start').disabled = false;
    $('start').textContent = 'Start';
});
