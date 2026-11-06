// She flies through the lab saving kittens, for as far as she can get: the distance is the score. All in units: the world is 100 high.
// Moving things follow how far she has come (camera), not the clock, so what can be passed once can always be passed.
const PACE = 44; // units per second. It stays the same; only a boost is faster.
const UNITS_PER_METER = 10;
const GROUND = 84;
const GIRL_X = 42;
const CEILING = 20; // the highest her middle gets
const WALK_HEIGHT = 15; // from her middle to the floor when she walks
const FLY_RISE = 62;
const FLY_SINK = 34;
const FLY_TURN = 520; // how quickly she changes between the two
const GRAVITY = 280;
const JUMP_SPEED = 141;
const SHORT_JUMP_SPEED = 55; // letting go early cuts a jump to this
const MOST_FALL = 115;
// What can hurt her: only the core of her body, around her middle, not her hair, wings or trailing feet. It reaches low enough that nothing on the
// floor goes under her. What collects stars is a little wider than that: her body, not the tips of her hair.
const HIT_FLYING = {left: -5, right: 7, top: -12, bottom: 11};
const HIT_WALKING = {left: -4, right: 5, top: -13, bottom: 12};
const STAR_REACH = {left: -9, right: 11, top: -14, bottom: 11};
const JUMP_MEMORY_MS = 110; // a press just before landing still jumps
const AFTER_EDGE_MS = 80; // and one just after running off a platform

const ENERGY_PER_SECOND = 8.5; // flying
const ENERGY_PER_STAR = 3.5;
const ENERGY_PER_STAR_WALKING = 7; // so that a walk doesn't last long: she mainly flies
const ENERGY_PER_BIG_STAR = 30;
const LOW_ENERGY = 25;
const KITTEN_EVERY = 190; // a kitten about every 5 seconds
const BIG_STAR_EVERY = 5; // saved kittens
const BOOST_EVERY = 10;
const HEART_EVERY = 20;
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

function newGirl() {
    return {y: 50, vy: 0, onGround: false, flying: true, walking: false, rising: false, pressedAgo: Infinity, leftEdgeAgo: Infinity};
}

function newGame() {
    state = 'intro';
    score = 0;
    strikes = 0;
    kittens = 0;
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

function spikes(x, count) {
    things.push({kind: 'spikes', x, width: Scene.spikeWidth(count), height: 10});
}

function post(x, height = 21) {
    things.push({kind: 'post', x, width: 2, height});
}

function hanging(x, bottom = GROUND - 37) {
    things.push({kind: 'hanging', x, width: 2, bottom});
}

function mover(x, phase) {
    things.push({kind: 'mover', x, width: 2, length: 15, middle: 26, reach: 19, wavelength: 120, phase});
}

function beam(x, phase) {
    things.push({kind: 'beam', x, width: 14, length: 2, middle: 26, reach: 20, wavelength: 120, phase});
}

// from: from how many kittens on. flyingOnly: not to be got past on foot, so it only comes when her wings are sure to last.
const CHUNKS = [
    {from: 0, name: 'small spikes', make: x => { spikes(x + 12, 2); arc(x, 6); return 36; }},
    {from: 0, name: 'wide spikes', make: x => { spikes(x + 14, 3); arc(x, 7, 44); return 44; }},
    {from: 0, name: 'stars in a line', make: x => { line(x, starHeight(), 8); return 58; }},
    {from: 0, name: 'stars in a wave', make: x => { wave(x, starHeight(), 9, 8); return 66; }},
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
    const wingsLast = !girl.walking && energy >= 55;
    const possible = CHUNKS.filter(chunk => kittens >= chunk.from && chunk !== lastChunk && (wingsLast || !chunk.flyingOnly));
    lastChunk = possible[Math.floor(Math.random() * possible.length)];
    nextX += lastChunk.make(nextX);
    if (girl.walking || energy < LOW_ENERGY) {
        line(nextX + 8, 10, 5); // something to refill on, so that a walk doesn't last
    }
    nextX += between(GAP.shortest, GAP.longest);
}

// Where something that can hurt her is
function hitBoxOf(thing, at) {
    if (thing.kind === 'spikes') {
        return {left: thing.x + 3, right: thing.x + thing.width - 3, top: GROUND - thing.height + 3, bottom: GROUND};
    }
    if (thing.kind === 'post' || thing.kind === 'fence') {
        return {left: thing.x, right: thing.x + thing.width, top: GROUND - thing.height, bottom: GROUND};
    }
    if (thing.kind === 'hanging') {
        return {left: thing.x, right: thing.x + thing.width, top: 0, bottom: thing.bottom};
    }
    const reached = at + GIRL_X - thing.x;
    const height = thing.middle + thing.reach * Math.sin((reached / thing.wavelength + thing.phase) * Math.PI * 2);
    const y = GROUND - height;
    return {left: thing.x, right: thing.x + thing.width, top: y - thing.length / 2, bottom: y + thing.length / 2};
}

function touches(box, body, at) {
    const x = at + GIRL_X;
    const hit = body.flying ? HIT_FLYING : HIT_WALKING;
    return box.left < x + hit.right && box.right > x + hit.left && box.top < body.y + hit.bottom && box.bottom > body.y + hit.top;
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
    const landing = body.vy >= 0 && floors.find(floor => x + HIT_WALKING.right > floor.x && x + HIT_WALKING.left < floor.x + floor.width
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
    moveGirl(girl, seconds, held.size > 0, !girl.walking || boosting, camera, platforms);
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
    if (boosting || girl.walking) {
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

function saveKittens() {
    for (const tube of tubes) {
        if (!tube.saved && tube.x < camera + GIRL_X) {
            tube.saved = true;
            kittens++;
            showKittens();
            Sound.meow();
            giveReward();
        }
        if (tube.saved) {
            tube.opened = Math.min(1, tube.opened + 0.022);
        }
    }
}

// What saved kittens bring. The biggest news is shown.
function giveReward() {
    const rewards = [];
    if (kittens % BIG_STAR_EVERY === 0) {
        stars.push({x: camera + GIRL_X + 62, y: Math.max(CEILING + 8, Math.min(GROUND - 16, girl.y)), big: true});
        rewards.push('a big star');
    }
    if (kittens % BOOST_EVERY === 0) {
        boostLeft = BOOST_MS;
        safeLeft = 0;
        Sound.start();
        rewards.push('boost');
    }
    if (kittens % HEART_EVERY === 0) {
        strikes = Math.max(0, strikes - 1);
        showScore();
        rewards.push('a heart');
    }
    if (rewards.length) {
        showNotice(kittens + ' kittens: ' + rewards.join(', ') + '!');
    }
}

function checkHits() {
    if (boostLeft > 0 || safeLeft > 0 || hurtLeft > 0) {
        return;
    }
    if (things.some(thing => touches(hitBoxOf(thing, camera), girl, camera))) {
        strikes++;
        showScore();
        hurtLeft = AFTER_HIT_MS;
        Sound.miss();
        if (strikes >= MAX_STRIKES) {
            draw();
            finishGame('No hearts left. ' + kittens + (kittens === 1 ? ' kitten' : ' kittens') + ' saved');
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
}

function showEnergy() {
    const rounded = Math.round(energy);
    if (rounded !== shownEnergy) {
        shownEnergy = rounded;
        $('energy').style.clipPath = 'inset(0 ' + (100 - rounded) + '% 0 0 round 6px)';
    }
    $('wings').classList.toggle('low', energy <= LOW_ENERGY && !girl.walking);
    $('wings').classList.toggle('empty', girl.walking);
}

function showNotice(text) {
    $('notice').textContent = text;
    $('notice').hidden = !text;
    $('notice').classList.remove('warning');
    noticeLeft = text ? NOTICE_MS : 0;
}

// A short message goes first; otherwise she is warned for as long as it lasts
function showWarnings(milliseconds) {
    if (noticeLeft > 0) {
        noticeLeft -= milliseconds;
        if (noticeLeft <= 0) {
            showNotice('');
        }
        return;
    }
    const warning = girl.walking && boostLeft === 0 ? 'Collect stars to fly again!' : energy <= LOW_ENERGY && boostLeft === 0 ? 'Low energy!' : '';
    if ($('notice').textContent !== warning) {
        $('notice').textContent = warning;
    }
    $('notice').hidden = !warning;
    $('notice').classList.toggle('warning', Boolean(warning));
}

function draw() {
    Scene.draw(paint, {
        camera, time, things, platforms, tubes, stars, sparkles, girl, step, hitBoxOf, girlX: GIRL_X,
        boostLeft, boostWarnFrom: BOOST_WARNING_MS, blink: hurtLeft > 0
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
    $('how').textContent = 'Kittens have been abducted! Hold Space or the up arrow to rise, let go to sink. Flying uses energy, and stars fill it up. With none left she walks, and Space jumps, until she has collected a full bar. Go as far as you can. Enter starts, Esc pauses.';
}
Sound.setTune('mission');
setUpEvents();
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
