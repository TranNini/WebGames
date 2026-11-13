// She flies through the lab saving kittens, for as far as she can get: the distance is the score. All in units: the world is 100 high.
// Moving things follow how far she has come (camera), not the clock, so what can be passed once can always be passed.
const PACE = 44; // units per second. It stays the same; only a boost is faster.
const UNITS_PER_METER = 10;
const GROUND = 84;
const GIRL_X = 42;
const CEILING = 20; // the highest her middle gets
const WALK_HEIGHT = 7.5; // from her middle to the floor when she walks
const FLY_RISE = 62;
const FLY_SINK = 50;
const FLY_TURN = 520; // how quickly she changes between the two
const GRAVITY = 280;
const JUMP_SPEED = 150;
const SHORT_JUMP_SPEED = 55; // letting go early cuts a jump to this
const MOST_FALL = 115;
// What can hurt her is her head, body and legs in her pose, not her hair, wing or shoes (POSES in frames.js).
const LEDGE_WIDTH = 34;
const LEDGE_THICKNESS = 7;
const FEET = {left: -4, right: 5}; // what lands on a platform
const CLIMB_SPEED = 170; // she is brought up onto raised floor she has run into
const STEP_UP = 3; // this far below its top, she still makes it onto raised floor without a bump
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
const BIG_STAR_ROOM = 7; // how much room it takes up around its middle
const STAR_ROOM = 3;
const BOOST_EVERY = 10;
const HEART_EVERY = 25;
const TUBE_HALF_WIDTH = 6.5; // what she has to touch, a bit smaller than the tube looks
const TUBE_HEIGHT = 20;
// Missed kittens: each brings a security alert, worse up to the third, and five in a row forgive them. The first also breaks her wings.
const ALERT_MS = 10000;
const LAST_ALERT = 3;
const SIREN_MS = 2500;
const MISSES_FORGIVEN_AFTER = 5; // kittens in a row
const SHOOTER_RANGE = 180; // it starts shooting about when it comes into view
const SHOOT_EVERY = 62; // a bolt each time she has come this far
const BOLT_SPEED = 1.2; // how much faster than she comes, the other way
const BOLT_LENGTH = 12;
const HIGH_ABOVE_A_HOP = 50; // what an alert adds up high leaves room for a hop over what it adds on the floor
const SCREEN_FRAMES = 6;
const SCREEN_FRAME_MS = 140;
const BANNER_FRAMES = 6;
const BANNER_FRAME_MS = 110;
const DRONE_DRIFT = 0.25; // how much faster than the rest they come at her
// From the second alert on there is more of everything: an obstacle in the middle of each gap, and lasers above to catch her flying
const ALERT_GAPS = [null, null, {shortest: 50, longest: 56}, {shortest: 44, longest: 50}];
const BOOST_SPEED = 1.9;
const BOOST_MS = 4500;
const BOOST_WARNING_MS = 1400; // the bubble blinks for this long before it goes
const AFTER_BOOST_MS = 500; // safe, without blinking, for what she was in the middle of
const AFTER_HIT_MS = 1400;
const NOTICE_MS = 2200;
const GAP = {shortest: 23, longest: 32};
const DRONE_IN_A_GAP = 0.8; // how often a security drone flies above the free road between two sections
const FIRST_STRETCH = 1000; // the first 100 m: no sections with only stars
const VARIETY_FROM_THE_START = 6; // sections meant to come from this many kittens on are there from the start
const VIEW_AHEAD = 40;
// As she gets further the lab changes: each area has its own obstacles from the user's sheet, and themed: how much of what comes is those, the rest stays the basic ones
const AREAS = [{name: 'lab', themed: 0.25}, {name: 'machines', themed: 0.5}, {name: 'power', themed: 0.5}, {name: 'furnace', themed: 0.5}, {name: 'freezer', themed: 0.5}];
const AREA_LENGTH = 2000; // 200 m
const AREA_FADE = 240; // the light changes over this far
const SAW_SIZE = 30;
const CROSS_SIZE = 26;
const MACE_LENGTH = 46;
const MACE_SWING = 0.75; // how far it swings, either way
const ARC_HEIGHT = 14;
const FLAME_LOWEST = 6;
const FLAME_HIGHEST = 20;
const BURNERS = [0.23, 0.48, 0.74]; // along what the flames come out of
// What hurts in each piece, in parts of its size: boxes, spikes (from base to tip) and circles (size in units). A little smaller than what is seen, like the rest.
const PIECE_SHAPES = {
    fan: [{left: 0.06, right: 0.94, top: 0.08, bottom: 1}],
    coil: [{x: 0.5, y: 0.3, size: 4.2}, {left: 0.38, right: 0.62, top: 0.5, bottom: 1}, {left: 0.2, right: 0.8, top: 0.84, bottom: 1}],
    shock: [{left: 0.02, right: 0.98, top: -0.25, bottom: 1}],
    acid: [{left: 0.01, right: 0.99, top: 0.1, bottom: 1}],
    icicles: [
        {left: 0.01, right: 0.99, top: 0.02, bottom: 0.14},
        {x: 0.16, width: 0.12, base: 0.14, tip: 0.97}, {x: 0.36, width: 0.12, base: 0.14, tip: 0.87}, {x: 0.7, width: 0.12, base: 0.14, tip: 1}, {x: 0.88, width: 0.1, base: 0.14, tip: 0.69}
    ],
    'ice-spikes': [
        {left: 0.01, right: 0.99, top: 0.58, bottom: 0.95},
        {x: 0.21, width: 0.15, base: 0.58, tip: 0.12}, {x: 0.445, width: 0.2, base: 0.58, tip: 0.01}, {x: 0.66, width: 0.15, base: 0.58, tip: 0.15}, {x: 0.85, width: 0.09, base: 0.58, tip: 0.42}
    ],
    'ice-wall': [{left: 0.03, right: 0.97, top: 0.03, bottom: 1}],
    'spike-slab': [
        {left: 0.01, right: 0.99, top: 0.02, bottom: 0.4},
        {x: 0.13, width: 0.11, base: 0.45, tip: 1}, {x: 0.3, width: 0.11, base: 0.45, tip: 1}, {x: 0.5, width: 0.09, base: 0.45, tip: 0.78}, {x: 0.7, width: 0.11, base: 0.45, tip: 1}, {x: 0.87, width: 0.11, base: 0.45, tip: 1}
    ]
};

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
    Sound.setMusicAlarm(0);
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
    nextX = 110;
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

// down: hanging from what is at base
function spikes(x, count, base = GROUND, down = false) {
    things.push({kind: 'spikes', x, width: Scene.spikeWidth(count), height: 10, base, down});
}

// look: 'tesla' is the same thing in another form, lightning instead of a laser
function post(x, height = 21, base = GROUND, look = 'laser') {
    things.push({kind: 'post', x, width: 2, height, base, look});
}

// Raised floor, solid, as in the user's picture: she can be on it, and running into its side costs a heart.
// warn: spikes in front of it, to show that it hurts.
function raised(x, width, height, warn = true) {
    platforms.push({solid: true, x, width, top: GROUND - height});
    things.push({kind: 'block', x, width, top: GROUND - height});
    if (warn) {
        spikes(x - Scene.spikeWidth(2) - 1, 2);
    }
}

// A tube on something, in place of the next one that would come by itself
function tubeOn(x, base) {
    tubes.push({x, base, look: Math.floor(Math.random() * 100), opened: 0, saved: false});
    nextKittenAt = x + KITTEN_EVERY * 0.75;
}

// A platform in the air, itself in the way too, with something on it
function ledge(x, top, width = LEDGE_WIDTH) {
    things.push({kind: 'ledge', x, width, top});
}

// A platform to be on, in the air: she can stand or fly along on top of it, though its side and underside hurt
function floating(x, top, width) {
    ledge(x, top, width);
    platforms.push({hidden: true, rest: true, x, width, top});
}

// Spikes along a platform: on top of it, or under it
function spikesOnLedge(x, top) {
    spikes(x + 3, 3, top);
}

function spikesUnderLedge(x, top) {
    spikes(x + 3, 3, top + LEDGE_THICKNESS, true);
}

function hanging(x, bottom = GROUND - 37, look = 'laser') {
    things.push({kind: 'hanging', x, width: 2, bottom, look});
}

// A piece from the user's obstacle sheet that stays where it is. Without a top it stands on the floor.
function piece(art, x, top) {
    const {width, height} = Scene.piece(art);
    things.push({kind: 'piece', art, x, width, height, top: top === undefined ? GROUND + 0.4 - height : top});
    return width;
}

// A spinning saw, half in what it stands on
function saw(x, base = GROUND) {
    things.push({kind: 'saw', x, width: SAW_SIZE, y: base - 5});
}

function spinner(x, y) {
    things.push({kind: 'spinner', x, width: CROSS_SIZE, y});
}

// A spiked ball swinging from the ceiling
function mace(x, phase) {
    things.push({kind: 'mace', x, width: 2, wavelength: 150, phase});
}

// A crusher that comes down to the floor. Phase 0.25: at its highest when she is under it.
function crusher(x, phase) {
    things.push({kind: 'press', x, width: Scene.piece('press').width, middle: 26, reach: 26, wavelength: 170, phase});
}

// A platform going up and down
function lift(x, phase) {
    const {width, height} = Scene.piece('lift');
    things.push({kind: 'lift', x, width, length: height, middle: 40, reach: 22, wavelength: 170, phase});
}

// Lightning between two pillars
function arcFence(x, width = 28) {
    things.push({kind: 'arc', x, width});
}

function flames(x, phase, base = GROUND) {
    things.push({kind: 'flames', x, width: Scene.piece('burners').width, wavelength: 130, phase, base});
}

function mover(x, phase, place = {middle: 26, reach: 19}) {
    things.push({kind: 'mover', x, width: 2, length: 15, wavelength: 120, phase, ...place});
}

// A drone that looks her way and shoots laser bolts along its height, at regular distances, until it has left the screen
function shooter(x, height) {
    things.push({kind: 'shooter', x, width: 12, height});
}

// Security drones: they come flying at her, and stay above her head when she is on foot
function drone(x, phase, alarm) {
    things.push({kind: 'drone', x, width: 9, middle: 56, reach: 9, wavelength: 150, phase, alarm});
}

function beam(x, phase) {
    things.push({kind: 'beam', x, width: 10, length: 2, middle: 24, reach: 18, wavelength: 170, phase});
}

// area: only comes there; without one it is basic, and comes everywhere. from: from how many kittens on. flyingOnly: not to be got past on foot, so it only comes when her wings are sure to last. onFootOnly: the lower version for when they aren't. weight: how much likelier than others, as these two only come part of the time.
const CHUNKS = [
    {from: 0, name: 'small spikes', make: x => { spikes(x + 12, 2); arc(x, 6); return 36; }},
    {from: 0, name: 'wide spikes', make: x => { spikes(x + 14, 3); arc(x, 7, 44); return 44; }},
    {from: 0, name: 'stars in a line', onlyStars: true, make: x => { line(x, starHeight(), 5); return 38; }},
    {from: 0, name: 'stars in a wave', onlyStars: true, make: x => { wave(x, starHeight(), 6, 8); return 46; }},
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
    {from: 1, name: 'raised floor with stars', make: x => { raised(x + 16, 48, 14); line(x + 22, 24, 6); return 76; }},
    {from: 3, name: 'raised floor with a kitten', make: x => { raised(x + 16, 64, 14); tubeOn(x + 48, GROUND - 14); arc(x - 6, 4, 34); return 92; }},
    {from: 8, name: 'raised floor in two steps', make: x => { raised(x + 14, 58, 14); spikes(x + 72 - Scene.spikeWidth(2) - 1, 2, GROUND - 14); raised(x + 72, 48, 24, false); line(x + 78, 34, 5); return 132; }},
    {from: 10, name: 'spikes on raised floor', make: x => { raised(x + 14, 76, 14); line(x + 18, 24, 3); spikes(x + 48, 2, GROUND - 14); return 102; }},
    {from: 12, name: 'a laser on raised floor', make: x => { raised(x + 14, 76, 14); line(x + 18, 24, 3); post(x + 52, 18, GROUND - 14); return 102; }},
    {from: 2, name: 'a platform with spikes above and below', weight: 2, make: x => {
        const top = GROUND - 48;
        ledge(x + 10, top);
        spikesOnLedge(x + 10, top);
        spikesUnderLedge(x + 10, top);
        spikes(x + 84, 2);
        wave(x + 56, 22, 4, 4);
        return 104;
    }},
    {from: 3, name: 'spikes on a platform, a laser down to the floor', onFootOnly: true, weight: 2, make: x => {
        const top = GROUND - 20; // low enough to jump over on foot
        ledge(x + 10, top, 24);
        spikes(x + 12.8, 2, top);
        post(x + 21, 20 - LEDGE_THICKNESS);
        arc(x, 6, 46);
        return 56;
    }},
    {from: 3, name: 'spikes under a platform, a laser up to the ceiling', weight: 2, make: x => {
        const top = GROUND - 52;
        ledge(x + 10, top);
        spikesUnderLedge(x + 10, top);
        hanging(x + 10 + LEDGE_WIDTH / 2 - 1, top);
        line(x + 8, 16, 5);
        spikes(x + 84, 2);
        return 104;
    }},
    {from: 3, name: 'spikes on a high platform, a laser down to the floor', flyingOnly: true, weight: 4, make: x => {
        const top = GROUND - 46;
        ledge(x + 10, top);
        spikesOnLedge(x + 10, top);
        post(x + 10 + LEDGE_WIDTH / 2 - 1, 46 - LEDGE_THICKNESS);
        wave(x, 62, 6, 2);
        return 56;
    }},
    {from: 2, name: 'a kitten on a high raised floor', weight: 2, make: x => { raised(x + 18, 62, 30); tubeOn(x + 50, GROUND - 30); arc(x - 8, 4, 46); return 86; }},
    {from: 3, name: 'a kitten on a low floating platform', weight: 2, make: x => { floating(x + 14, GROUND - 24, 46); tubeOn(x + 37, GROUND - 24); spikes(x + 26, 2); return 66; }},
    {from: 5, name: 'a kitten on a high floating platform', flyingOnly: true, weight: 3, make: x => {
        floating(x + 14, GROUND - 46, 46);
        tubeOn(x + 37, GROUND - 46);
        post(x + 36, 46 - LEDGE_THICKNESS);
        wave(x - 8, 58, 3, 2);
        return 66;
    }},
    {from: 6, name: 'a kitten past a laser on raised floor', make: x => { raised(x + 14, 84, 14); hanging(x + 36, GROUND - 42); tubeOn(x + 72, GROUND - 14); return 104; }},
    {from: 2, name: 'lasers to weave through', weight: 2, make: x => { hanging(x + 8, GROUND - 44); post(x + 56); hanging(x + 104, GROUND - 44); post(x + 152); wave(x + 16, 26, 8, 8, 8); return 162; }},
    {from: 4, name: 'between spiked platforms', weight: 2, make: x => {
        ledge(x + 8, GROUND - 56);
        spikesUnderLedge(x + 8, GROUND - 56);
        spikes(x + 18, 2);
        ledge(x + 70, GROUND - 20, 24);
        spikes(x + 72.8, 2, GROUND - 20);
        post(x + 81, 20 - LEDGE_THICKNESS);
        arc(x + 62, 5, 46);
        return 102;
    }},
    {from: 6, name: 'through narrow gaps', make: x => { post(x + 10, 20); hanging(x + 10, GROUND - 54); post(x + 72, 9); hanging(x + 72, GROUND - 38); line(x + 58, 20, 3); return 82; }},
    {from: 4, name: 'a shooting drone up high', weight: 3, make: x => { shooter(x + 60, 58); spikes(x + 20, 2); wave(x + 34, 24, 4, 4); return 84; }},
    {from: 6, name: 'a shooting drone in the middle', flyingOnly: true, weight: 3, make: x => { shooter(x + 60, 44); spikes(x + 20, 2); line(x + 44, 56, 4); return 84; }},
    {from: 13, name: 'two lasers', make: x => { post(x + 8); post(x + 66); return 76; }},
    {from: 15, name: 'a laser and spikes', make: x => { hanging(x + 8); spikes(x + 62, 3); arc(x + 52, 6); return 92; }},
    {from: 18, name: 'two moving lasers', make: x => { mover(x + 10, 0.75); mover(x + 76, 0.75); return 96; }},

    {area: 'lab', from: 0, name: 'a spiked slab overhead', make: x => { spikes(x + 8, 2); piece('spike-slab', x + 30, GROUND - 62); spikes(x + 76, 2); wave(x + 32, 24, 5, 4); return 96; }},
    {area: 'lab', from: 0, name: 'a moving platform', make: x => { lift(x + 12, 0.25); spikes(x + 58, 2); hanging(x + 88, GROUND - 48); line(x + 12, 18, 5); return 100; }},

    {area: 'machines', from: 0, name: 'a saw', make: x => { saw(x + 16); hanging(x + 60, GROUND - 48); spikes(x + 84, 2); arc(x, 6, 46); line(x + 56, 18, 3); return 104; }},
    {area: 'machines', from: 0, name: 'two saws', make: x => { saw(x + 14); mace(x + 58, 0.25); saw(x + 78); arc(x, 5, 46); arc(x + 64, 5, 46); return 114; }},
    {area: 'machines', from: 0, name: 'a swinging mace', make: x => { mace(x + 34, 0.25); spikes(x + 70, 2); spinner(x + 92, GROUND - 58); line(x + 12, 20, 4); line(x + 90, 16, 3); return 124; }},
    {area: 'machines', from: 0, name: 'a spinning cross', make: x => { spinner(x + 12, GROUND - 46); piece('fan', x + 70); spikes(x + 122, 2); wave(x + 48, 30, 4, 3); line(x + 100, 26, 3); return 140; }},
    {area: 'machines', from: 0, name: 'a crusher', make: x => { crusher(x + 16, 0.25); piece('fan', x + 62); hanging(x + 96, GROUND - 48); line(x + 18, 18, 4); line(x + 88, 18, 3); return 112; }},
    {area: 'machines', from: 0, name: 'two crushers', make: x => { crusher(x + 10, 0.25); crusher(x + 62, 0.3); spikes(x + 102, 2); line(x + 14, 18, 7); return 122; }},
    {area: 'machines', from: 0, name: 'fans', make: x => { piece('fan', x + 12); hanging(x + 48, GROUND - 52); piece('fan', x + 66); arc(x, 5, 44); arc(x + 54, 5, 44); return 92; }},
    {area: 'machines', from: 0, name: 'a mace and a saw', make: x => { mace(x + 26, 0.25); saw(x + 66); spikes(x + 124, 2); arc(x + 50, 6, 46); line(x + 108, 26, 3); return 146; }},
    {area: 'machines', from: 0, name: 'a saw on raised floor', make: x => { raised(x + 14, 84, 14); saw(x + 44, GROUND - 14); arc(x + 30, 6, 56); return 104; }},

    {area: 'power', from: 0, name: 'an electric fence', make: x => { arcFence(x + 14); hanging(x + 62, GROUND - 50, 'tesla'); piece('shock', x + 88); arc(x, 6, 46); line(x + 78, 20, 4); return 128; }},
    {area: 'power', from: 0, name: 'a tesla column', make: x => { post(x + 16, 21, GROUND, 'tesla'); hanging(x + 44, GROUND - 52, 'tesla'); post(x + 72, 21, GROUND, 'tesla'); arc(x, 5, 44); arc(x + 56, 5, 44); return 90; }},
    {area: 'power', from: 0, name: 'a tesla gate', flyingOnly: true, make: x => { post(x + 18, 34, GROUND, 'tesla'); hanging(x + 18, GROUND - 74, 'tesla'); wave(x, 54, 6, 3); piece('shock', x + 50); return 88; }},
    {area: 'power', from: 0, name: 'coils', make: x => { piece('coil', x + 14); hanging(x + 44, GROUND - 52, 'tesla'); piece('coil', x + 70); arc(x, 5, 42); arc(x + 56, 5, 42); return 94; }},
    {area: 'power', from: 0, name: 'an electrified floor', make: x => { piece('shock', x + 14); arc(x + 2, 6, 40); post(x + 86, 21, GROUND, 'tesla'); hanging(x + 114, GROUND - 50, 'tesla'); line(x + 72, 26, 3); return 124; }},
    {area: 'power', from: 0, name: 'tesla from above, shocks below', make: x => { hanging(x + 8, GROUND - 44, 'tesla'); piece('shock', x + 36); hanging(x + 84, GROUND - 44, 'tesla'); piece('coil', x + 112); line(x + 42, 24, 4); return 136; }},
    {area: 'power', from: 0, name: 'a coil on raised floor', make: x => { raised(x + 14, 84, 14); piece('coil', x + 50, GROUND - 14 + 0.4 - Scene.piece('coil').height); arc(x + 34, 6, 56); return 104; }},

    {area: 'furnace', from: 0, name: 'an acid pool', make: x => { piece('acid', x + 14); hanging(x + 60, GROUND - 50); spikes(x + 84, 2); arc(x + 2, 6, 40); line(x + 58, 20, 3); return 104; }},
    {area: 'furnace', from: 0, name: 'two acid pools', make: x => { piece('acid', x + 10); hanging(x + 54, GROUND - 50); piece('acid', x + 70); arc(x, 5, 40); arc(x + 60, 5, 40); return 110; }},
    {area: 'furnace', from: 0, name: 'flames', make: x => { flames(x + 14, 0); hanging(x + 56, GROUND - 50); piece('acid', x + 74); arc(x, 6, 46); line(x + 62, 22, 3); return 114; }},
    {area: 'furnace', from: 0, name: 'two flames', make: x => { flames(x + 12, 0.25); hanging(x + 54, GROUND - 52); flames(x + 72, 0.75); arc(x, 5, 46); arc(x + 60, 5, 46); return 108; }},
    {area: 'furnace', from: 0, name: 'flames beside a spiked slab', make: x => { flames(x + 12, 0.5); piece('spike-slab', x + 50, GROUND - 62); spikes(x + 94, 2); arc(x, 5, 46); line(x + 52, 22, 4); return 112; }},
    {area: 'furnace', from: 0, name: 'a laser above acid', make: x => { hanging(x + 16, GROUND - 42); piece('acid', x + 46); post(x + 108); arc(x + 34, 6, 40); line(x + 96, 28, 2); return 118; }},
    {area: 'furnace', from: 0, name: 'flames on raised floor', make: x => { raised(x + 14, 84, 14); flames(x + 42, 0, GROUND - 14); arc(x + 30, 6, 60); return 104; }},

    {area: 'freezer', from: 0, name: 'ice spikes', make: x => { piece('ice-spikes', x + 12); hanging(x + 60, GROUND - 50); spikes(x + 84, 2); arc(x, 7, 46); line(x + 58, 20, 3); return 104; }},
    {area: 'freezer', from: 0, name: 'ice spikes, then icicles', make: x => { piece('ice-spikes', x + 8); piece('icicles', x + 46, GROUND - 70); spikes(x + 98, 2); line(x + 48, 24, 5); return 120; }},
    {area: 'freezer', from: 0, name: 'icicles, then spikes', make: x => { piece('icicles', x + 6, GROUND - 58); spikes(x + 66, 3); hanging(x + 102, GROUND - 50); arc(x + 56, 6, 44); return 114; }},
    {area: 'freezer', from: 0, name: 'an energy wall', flyingOnly: true, make: x => { piece('ice-wall', x + 14); hanging(x + 40, GROUND - 74); piece('ice-spikes', x + 74); wave(x + 2, 40, 7, 3, 9); return 112; }},
    {area: 'freezer', from: 0, name: 'two ice spikes', make: x => { piece('ice-spikes', x + 10); hanging(x + 52, GROUND - 52); piece('ice-spikes', x + 74); arc(x - 2, 6, 44); arc(x + 62, 6, 44); return 116; }},
    {area: 'freezer', from: 0, name: 'icicles above a laser', make: x => { piece('icicles', x + 8, GROUND - 68); post(x + 30, 21); piece('ice-spikes', x + 66); wave(x + 44, 22, 4, 4); return 106; }},
    {area: 'freezer', from: 0, name: 'ice spikes on raised floor', make: x => { raised(x + 14, 90, 14); piece('ice-spikes', x + 46, GROUND - 14 + 0.4 - Scene.piece('ice-spikes').height); arc(x + 32, 6, 58); return 110; }}
];

function areaAt(x) {
    return AREAS[Math.floor(Math.max(0, x) / AREA_LENGTH) % AREAS.length];
}

// The light of where she is, changing from one area to the next
function areaLight() {
    const middle = camera + Scene.viewWidth() / 2;
    const into = middle % AREA_LENGTH;
    return {from: areaAt(middle - AREA_LENGTH).name, to: areaAt(middle).name, mix: Math.min(1, into / AREA_FADE)};
}

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
    const seen = level >= 2 ? Infinity : Math.max(kittens, VARIETY_FROM_THE_START);
    const possible = CHUNKS.filter(chunk => seen >= chunk.from && chunk !== lastChunk && (wingsLast ? !chunk.onFootOnly : !chunk.flyingOnly) && (level < 2 && nextX >= FIRST_STRETCH || !chunk.onlyStars));
    const area = areaAt(nextX);
    const themed = possible.filter(chunk => chunk.area === area.name);
    const basic = possible.filter(chunk => !chunk.area);
    const chosenFrom = themed.length > 0 && (basic.length === 0 || Math.random() < area.themed) ? themed : basic;
    const weighted = chosenFrom.flatMap(chunk => Array(chunk.weight || 1).fill(chunk));
    lastChunk = weighted[Math.floor(Math.random() * weighted.length)];
    const before = things.length;
    const platformsBefore = platforms.length;
    const tubesBefore = tubes.length;
    nextX += lastChunk.make(nextX);
    if (lastChunk.flyingOnly) {
        [...things.slice(before), ...platforms.slice(platformsBefore), ...tubes.slice(tubesBefore)].forEach(thing => {
            thing.flyingOnly = true;
        });
    }
    if (girl.walking || energy < LOW_ENERGY || brokenWingsLeft > 0) {
        line(nextX + 8, 10, 5); // something to refill on, so that a walk doesn't last
    }
    const gap = between((ALERT_GAPS[level] || GAP).shortest, (ALERT_GAPS[level] || GAP).longest);
    if (level >= 2) {
        addExtras(level, gap);
    } else if (Math.random() < DRONE_IN_A_GAP) {
        drone(nextX + gap / 2, Math.random(), false);
    }
    nextX += gap;
    // A row of stars can run on into what comes after it: none stay inside raised floor
    stars = stars.filter(star => !platforms.some(floor => floor.solid && star.x > floor.x - STAR_ROOM && star.x < floor.x + floor.width + STAR_ROOM && star.y > floor.top - STAR_ROOM));
}

// What an alert adds to a gap: one more on the floor to jump, and above her head lasers that leave her alone on foot
function addExtras(level, gap) {
    if (Math.random() < 0.5) {
        post(nextX + gap / 2 - 1);
    } else {
        spikes(nextX + gap / 2 - Scene.spikeWidth(1), 2);
    }
    hanging(nextX + gap * 0.2, GROUND - HIGH_ABOVE_A_HOP);
    drone(nextX + gap * 0.74, 0, level >= LAST_ALERT); // not above the one on the floor: she has to be able to jump that
    drone(nextX + gap * 0.3, 0.5, level >= LAST_ALERT);
    hanging(nextX + gap * 0.88, GROUND - HIGH_ABOVE_A_HOP);
    if (level >= LAST_ALERT) {
        drone(nextX + gap * 0.5, 0.25, true);
        drone(nextX + gap * 0.62, 0.75, true);
    }
}

// Where something that can hurt her is
function hitBoxOf(thing, at) {
    if (thing.kind === 'ledge') {
        return {left: thing.x, right: thing.x + thing.width, top: thing.top, bottom: thing.top + 7};
    }
    if (thing.kind === 'piece') {
        return {left: thing.x, right: thing.x + thing.width, top: thing.top, bottom: thing.top + thing.height, spin: (at + GIRL_X - thing.x) * 0.2};
    }
    if (thing.kind === 'arc') {
        return {left: thing.x, right: thing.x + thing.width, top: GROUND - ARC_HEIGHT, bottom: GROUND};
    }
    if (thing.kind === 'block') {
        return {left: thing.x, right: thing.x + thing.width, top: thing.top, bottom: GROUND};
    }
    if (thing.kind === 'spikes' && thing.down) {
        return {left: thing.x, right: thing.x + thing.width, top: thing.base, bottom: thing.base + thing.height};
    }
    if (thing.kind === 'spikes' || thing.kind === 'post' || thing.kind === 'fence') {
        const base = thing.base || GROUND;
        return {left: thing.x, right: thing.x + thing.width, top: base - thing.height, bottom: base};
    }
    if (thing.kind === 'hanging') {
        return {left: thing.x, right: thing.x + thing.width, top: 0, bottom: thing.bottom};
    }
    const reached = at + GIRL_X - thing.x;
    const moved = thing.wavelength ? Math.sin((reached / thing.wavelength + thing.phase) * Math.PI * 2) : 0;
    if (thing.kind === 'saw') {
        return {left: thing.x, right: thing.x + thing.width, top: thing.y - thing.width / 2, bottom: thing.y + thing.width / 2, spin: reached * 0.13};
    }
    if (thing.kind === 'spinner') {
        return {left: thing.x - 4, right: thing.x + thing.width + 4, top: thing.y - thing.width / 2, bottom: thing.y + thing.width / 2, spin: reached * 0.05};
    }
    if (thing.kind === 'mace') {
        const swing = MACE_SWING * moved;
        const side = Math.sin(MACE_SWING) * MACE_LENGTH + 9;
        return {left: thing.x - side, right: thing.x + side, top: 0, bottom: MACE_LENGTH + 9, swing, headX: Math.sin(swing) * MACE_LENGTH, headY: Math.cos(swing) * MACE_LENGTH};
    }
    if (thing.kind === 'press') {
        return {left: thing.x, right: thing.x + thing.width, top: 0, bottom: GROUND - thing.middle - thing.reach * moved};
    }
    if (thing.kind === 'flames') {
        const heights = BURNERS.map((along, i) => FLAME_LOWEST + (FLAME_HIGHEST - FLAME_LOWEST) * (0.5 + 0.5 * Math.sin((reached / thing.wavelength + thing.phase + i * 0.1) * Math.PI * 2)));
        return {left: thing.x, right: thing.x + thing.width, top: thing.base - Scene.piece('burners').height - FLAME_HIGHEST, bottom: thing.base, heights};
    }
    if (thing.kind === 'shooter') {
        const y = GROUND - thing.height;
        const bolts = [];
        const firstShot = thing.x - SHOOTER_RANGE;
        const latest = Math.min(Math.floor((at - firstShot) / SHOOT_EVERY), Math.floor(SHOOTER_RANGE / SHOOT_EVERY));
        for (let shot = latest; shot >= 0 && shot > latest - 5; shot--) {
            const flown = (at - (firstShot + shot * SHOOT_EVERY)) * BOLT_SPEED;
            const left = thing.x - thing.width / 2 - BOLT_LENGTH - flown;
            bolts.push({left, right: left + BOLT_LENGTH, top: y - 0.7, bottom: y + 0.7});
        }
        return {
            left: thing.x - thing.width / 2, right: thing.x + thing.width / 2, top: y - 4.5, bottom: y + 4.5, bolts,
            justFired: latest >= 0 && at - (firstShot + latest * SHOOT_EVERY) < 5
        };
    }
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
    if (thing.kind === 'piece') {
        return PIECE_SHAPES[thing.art].map(shape => {
            if (shape.size) {
                return {round: true, x: box.left + shape.x * thing.width, y: box.top + shape.y * thing.height, size: shape.size};
            }
            if (shape.tip === undefined) {
                return {left: box.left + shape.left * thing.width, right: box.left + shape.right * thing.width, top: box.top + shape.top * thing.height, bottom: box.top + shape.bottom * thing.height};
            }
            const left = box.left + (shape.x - shape.width * 0.4) * thing.width;
            const width = shape.width * 0.8 * thing.width;
            const from = box.top + shape.base * thing.height;
            const height = Math.abs(shape.tip - shape.base) * thing.height * 0.92;
            return shape.tip < shape.base ? {spike: true, left, width, height, base: from} : {spike: true, left, width, height, base: from + height, flip: from * 2 + height};
        });
    }
    if (thing.kind === 'saw') {
        return [{round: true, x: box.left + thing.width / 2, y: thing.y, size: thing.width / 2 * 0.8}];
    }
    if (thing.kind === 'spinner') {
        const middle = thing.x + thing.width / 2;
        const reach = thing.width * 0.68; // to the end of an arm
        return [0, 1, 2, 3].flatMap(arm => [0.3, 0.6, 0.88].map(along => {
            const angle = box.spin + Math.PI / 4 + arm * Math.PI / 2;
            return {round: true, x: middle + Math.cos(angle) * reach * along, y: thing.y + Math.sin(angle) * reach * along, size: along > 0.8 ? 3 : 2.2};
        }));
    }
    if (thing.kind === 'mace') {
        const head = {round: true, x: thing.x + box.headX, y: box.headY, size: 7};
        return [head, ...[0.3, 0.5, 0.7].map(along => ({round: true, x: thing.x + box.headX * along, y: box.headY * along, size: 1.2}))];
    }
    if (thing.kind === 'press') {
        const headTop = box.bottom - Scene.piece('press').height;
        const middle = thing.x + thing.width / 2;
        return [{left: box.left + 1, right: box.right - 1, top: headTop + 1, bottom: box.bottom - 0.6}, {left: middle - 1.8, right: middle + 1.8, top: 0, bottom: headTop + 1}];
    }
    if (thing.kind === 'lift') {
        return [{left: box.left + 1, right: box.right - 1, top: box.top + 0.6, bottom: box.bottom - 0.6}];
    }
    if (thing.kind === 'arc') {
        const pillar = Scene.piece('pylon-left').width;
        const middle = GROUND - ARC_HEIGHT / 2;
        return [
            {left: box.left + 1, right: box.left + pillar - 1, top: box.top + 1, bottom: box.bottom},
            {left: box.right - pillar + 1, right: box.right - 1, top: box.top + 1, bottom: box.bottom},
            {left: box.left + pillar, right: box.right - pillar, top: middle - 1.2, bottom: middle + 1.2}
        ];
    }
    if (thing.kind === 'flames') {
        const burners = thing.base - Scene.piece('burners').height;
        return [{left: box.left + 0.5, right: box.right - 0.5, top: burners + 0.6, bottom: thing.base}, ...BURNERS.map((along, i) => ({
            left: box.left + along * thing.width - 1.5, right: box.left + along * thing.width + 1.5, top: burners - box.heights[i] * 0.85, bottom: burners + 0.6
        }))];
    }
    if (thing.kind === 'spikes') {
        const each = Scene.spikeWidth(1);
        const spikeShapes = [];
        for (let at = 0; at < thing.width - 0.1; at += each) {
            spikeShapes.push({spike: true, left: thing.x + at + each * 0.15, width: each * 0.7, height: thing.height * 0.85, base: box.bottom, flip: thing.down ? box.top + box.bottom : 0});
        }
        return spikeShapes;
    }
    if (thing.kind === 'drone') {
        return [box];
    }
    if (thing.kind === 'shooter') {
        return [{left: box.left + 1.5, right: box.right - 1.5, top: box.top + 1, bottom: box.bottom - 1}, ...box.bolts];
    }
    if (thing.kind === 'block') {
        return [{left: box.left, right: box.left + 1.5, top: box.top + STEP_UP, bottom: box.bottom}]; // its side
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
    return shapesOf(thing, box).some(shape => {
        if (shape.round) {
            return Math.hypot(circle.x - shape.x, circle.y - shape.y) < circle.size + shape.size;
        }
        return shape.spike
            ? circleTouchesSpike(shape.flip ? {...circle, y: shape.flip - circle.y} : circle, shape.left, shape.width, shape.height, shape.base)
            : circleTouchesBox(circle, shape.left, shape.right, shape.top, shape.bottom);
    });
}

function touches(thing, body, at) {
    const box = hitBoxOf(thing, at);
    const x = at + GIRL_X;
    if (thing.kind !== 'shooter' && (box.left > x + 20 || box.right + 6 < x - 20)) {
        return false;
    }
    if (thing.kind === 'block') {
        return x + FEET.right > box.left && x + FEET.left < box.right && body.y + WALK_HEIGHT > box.top + STEP_UP;
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

// Raised floor can't be gone through: whoever is lower than its top is brought up onto it
function climbSolidFloor(body, seconds, x, floors) {
    const under = floors.filter(floor => floor.solid && x + FEET.right > floor.x && x + FEET.left < floor.x + floor.width);
    if (under.length === 0) {
        return;
    }
    const standsAt = Math.min(...under.map(floor => floor.top)) - WALK_HEIGHT;
    if (body.y > standsAt) {
        body.y = Math.max(standsAt, body.y - CLIMB_SPEED * seconds);
        body.vy = Math.min(body.vy, 0);
        if (!body.flying && body.y === standsAt) {
            body.vy = 0;
            body.onGround = true;
        }
    }
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
        const was = body.y;
        body.y = Math.max(CEILING, Math.min(GROUND - WALK_HEIGHT, body.y + body.vy * seconds));
        const restsOn = body.vy >= 0 && floors.find(floor => floor.rest && at + GIRL_X + FEET.right > floor.x && at + GIRL_X + FEET.left < floor.x + floor.width
            && was <= floor.top - WALK_HEIGHT + 0.5 && body.y >= floor.top - WALK_HEIGHT);
        if (restsOn) {
            body.y = restsOn.top - WALK_HEIGHT;
        }
        body.flying = true;
        body.onGround = false;
        body.rising = false;
        climbSolidFloor(body, seconds, at + GIRL_X, floors);
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
    climbSolidFloor(body, seconds, x, floors);
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
    soundTheShots();
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

function soundTheShots() {
    for (const thing of things) {
        if (thing.kind === 'shooter' && thing.x > camera && thing.x < camera + Scene.viewWidth()) {
            const shot = Math.floor((camera - thing.x + SHOOTER_RANGE) / SHOOT_EVERY);
            if (shot >= 0 && shot !== thing.lastShot) {
                thing.lastShot = shot;
                Sound.zap();
            }
        }
    }
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
                && girl.y + STAR_REACH.bottom > (tube.base || GROUND) - TUBE_HEIGHT && girl.y + STAR_REACH.top < (tube.base || GROUND);
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
    Sound.setMusicAlarm(alertLevel);
    sirenLeft = SIREN_MS;
    Sound.siren();
    if (misses === 1) {
        brokenWingsLeft = ALERT_MS;
        // Nothing ahead of her that can't be passed on foot
        const stays = thing => !thing.flyingOnly || thing.x < camera + GIRL_X;
        things = things.filter(stays);
        platforms = platforms.filter(stays);
        tubes = tubes.filter(stays);
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
    if (alertLeft === 0) {
        Sound.setMusicAlarm(0);
    }
    sirenLeft -= milliseconds;
    if (sirenLeft <= 0 && alertLeft > 0) {
        sirenLeft = SIREN_MS;
        Sound.siren();
    }
}

function nothingInBigStar(x, y) {
    return !things.some(thing => circleTouchesThing({x, y, size: BIG_STAR_ROOM}, thing, hitBoxOf(thing, x - GIRL_X)));
}

// Whether she can get a big star there: nothing in it, and a free way to it at that height, so it isn't right behind a laser
function bigStarFits(x, y) {
    const body = {...newGirl(), y};
    const wayIsFree = back => !things.some(thing => touches(thing, body, x - GIRL_X - back));
    return nothingInBigStar(x, y) && [0, 8, 16, 24, 32].every(wayIsFree);
}

// Ahead of her at her height, or else the nearest place that is free
function placeForBigStar() {
    const wanted = {x: camera + GIRL_X + 62, y: Math.max(CEILING + 8, Math.min(GROUND - 16, girl.y))};
    if (bigStarFits(wanted.x, wanted.y)) {
        return wanted;
    }
    const places = [];
    for (let further = 0; further <= 40; further += 8) {
        for (let y = CEILING + 8; y <= GROUND - 16; y += 2) {
            places.push({x: wanted.x + further, y, away: further / 2 + Math.abs(y - wanted.y)});
        }
    }
    places.sort((one, other) => one.away - other.away);
    return places.find(place => bigStarFits(place.x, place.y)) || places.find(place => nothingInBigStar(place.x, place.y)) || wanted;
}

// What kittens in a row bring: a miss starts this over, so it also delays them
function giveReward() {
    if (streak % BIG_STAR_EVERY === 0) {
        const place = placeForBigStar();
        stars.push({x: place.x, y: place.y, big: true});
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
    const age = Math.max(0, ALERT_MS - alertLeft);
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
        burners: BURNERS, areaLight: areaLight(), boostLeft, boostWarnFrom: BOOST_WARNING_MS, blink: hurtLeft > 0, alert: alertLeft > 0 ? alertLevel : 0, signs: alertSigns(), pose: poseOf(girl), hurtAge: hurtLeft > 0 ? AFTER_HIT_MS - hurtLeft : null,
        touchAreas: showTouchAreas ? touchAreas() : null
    });
}

// To look at, from the settings: what counts as touching
function touchAreas() {
    const x = camera + GIRL_X;
    return {
        body: POSES[poseOf(girl)].circles.map(part => ({x: GIRL_X + part.x, y: girl.y + part.y, size: part.size})),
        reach: {left: GIRL_X + STAR_REACH.left, right: GIRL_X + STAR_REACH.right, top: girl.y + STAR_REACH.top, bottom: girl.y + STAR_REACH.bottom},
        tubes: tubes.filter(tube => !tube.saved && !tube.missed).map(tube => ({left: tube.x - TUBE_HALF_WIDTH - camera, right: tube.x + TUBE_HALF_WIDTH - camera, top: (tube.base || GROUND) - TUBE_HEIGHT, bottom: tube.base || GROUND})),
        obstacles: things.filter(thing => thing.x - 10 < x + Scene.viewWidth()).flatMap(thing => shapesOf(thing, hitBoxOf(thing, camera)).map(shape => (shape.round ? {...shape, x: shape.x - camera} : {...shape, left: shape.left - camera, right: shape.spike ? 0 : shape.right - camera})))
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
    // A long gap (the page was hidden) doesn't count. A frame's time can lie just before the moment the game started.
    const passed = Math.max(0, Math.min(now - lastFrame, 50));
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
