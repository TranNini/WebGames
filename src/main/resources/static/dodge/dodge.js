// What the score changes. from: the score this starts at. speed: how many screen heights a block falls per second.
// gap: the free road between two rows, in screen heights, however long what comes is. doubleChance: how often a row blocks
// two of the lanes, which leaves one free lane. The time for a gap, gap / speed, leaves room for two lane changes.
const LEVELS = [
    {from: 0, speed: 0.45, gap: 0.46, doubleChance: 0},
    {from: 11, speed: 0.5, gap: 0.41, doubleChance: 0},
    {from: 21, speed: 0.55, gap: 0.41, doubleChance: 0.3},
    {from: 31, speed: 0.62, gap: 0.39, doubleChance: 0.4},
    {from: 51, speed: 0.72, gap: 0.37, doubleChance: 0.5},
    {from: 71, speed: 0.85, gap: 0.35, doubleChance: 0.6},
    {from: 101, speed: 1, gap: 0.33, doubleChance: 0.7},
    {from: 151, speed: 1.15, gap: 0.37, doubleChance: 0.7}
];
const LANES = 3;
// Places are in screen heights, so a game takes the same time on any screen, upright or sideways. What counts as hitting the
// cat is the middle of her, so ears or a tail just touching don't.
const PLAYER_TOP = 0.87;
const PLAYER_BOTTOM = 0.96;
const FIRST_ROW_AFTER = 0.2;
const SWIPE_PX = 24; // further than this before letting go is a swipe, not a tap
const LANE_CHANGE_SPEED = 20; // how quickly the cat catches up with her lane
const HIT_FLASH_MS = 300;

const canvas = $('canvas');
const paint = canvas.getContext('2d');
const touches = new Map();
let rows = [];
let lane = 1;
let shownLane = 1;
let travelled = 0;
let stride = 0;
let untilNextRow = 0;
let hitFlash = 0;
let lastFrame = 0;

function newGame() {
    state = 'intro';
    score = 0;
    strikes = 0;
    showScore();
    showScreen('intro');
}

function startGame() {
    Sound.unlock();
    Sound.start();
    Sound.setMusicSpeed(0);
    Sound.startMusic();
    rows = [];
    lane = 1;
    shownLane = 1;
    travelled = 0;
    hitFlash = 0;
    untilNextRow = FIRST_ROW_AFTER;
    touches.clear();
    state = 'playing';
    showScreen('road');
    goOn();
}

function goOn() {
    fitCanvas();
    lastFrame = performance.now();
    requestAnimationFrame(frame);
}

function level() {
    return LEVELS.findLast(level => score >= level.from);
}

// At most two things in a row, so there is always a free lane. row.y is the front of the row.
function addRow() {
    const free = [0, 1, 2];
    const count = Math.random() < level().doubleChance ? 2 : 1;
    const blocks = [];
    while (blocks.length < count) {
        const [blocked] = free.splice(Math.floor(Math.random() * free.length), 1);
        blocks.push({lane: blocked, ...Scene.newThing()});
    }
    const row = {y: 0, blocks, hit: false, passed: false};
    rows.push(row);
    return row;
}

function rowLength(row) {
    return Math.max(...row.blocks.map(block => Scene.length(block.kind)));
}

function frame(now) {
    if (state !== 'playing') {
        return;
    }
    const passed = Math.min(now - lastFrame, 100); // a long gap (the page was hidden) doesn't count
    lastFrame = now;
    const fall = level().speed * passed / 1000;
    travelled += fall;
    stride += (11 + 8 * level().speed) * passed / 1000; // her legs go faster with the road
    shownLane += (lane - shownLane) * (1 - Math.exp(-LANE_CHANGE_SPEED * passed / 1000));
    hitFlash = Math.max(0, hitFlash - passed);

    untilNextRow -= fall;
    if (untilNextRow <= 0) {
        untilNextRow += level().gap + rowLength(addRow());
    }
    for (const row of rows) {
        row.y += fall;
    }
    checkHits();
    countPassedRows();
    draw();
    if (state === 'playing') {
        requestAnimationFrame(frame);
    }
}

function checkHits() {
    for (const row of rows) {
        const block = row.blocks.find(block => block.lane === lane && !block.hit
            && row.y > PLAYER_TOP && row.y - Scene.length(block.kind) < PLAYER_BOTTOM);
        if (block) {
            block.hit = true;
            row.hit = true;
            addStrike();
            if (state !== 'playing') {
                return;
            }
        }
    }
}

function addStrike() {
    strikes++;
    showScore();
    hitFlash = HIT_FLASH_MS;
    Sound.miss();
    if (strikes >= MAX_STRIKES) {
        finishGame('Three hits');
    }
}

// A row counts when it is past the player without a hit
function countPassedRows() {
    if (state !== 'playing') {
        return;
    }
    for (const row of rows) {
        if (!row.passed && row.y - rowLength(row) >= PLAYER_BOTTOM) {
            row.passed = true;
            if (!row.hit) {
                score++;
                Sound.setMusicSpeed(Math.min(score / LEVELS.at(-1).from, 1));
                showScore();
            }
        }
    }
    rows = rows.filter(row => row.y - rowLength(row) < 1);
}

function changeLane(direction) {
    const next = Math.max(0, Math.min(LANES - 1, lane + direction));
    if (state === 'playing' && next !== lane) {
        lane = next;
        Sound.tap(lane);
    }
}

function fitCanvas() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2); // more isn't seen, and costs a lot on a phone
    const width = Math.round(canvas.clientWidth * ratio);
    const height = Math.round(canvas.clientHeight * ratio);
    if (width > 0 && height > 0 && (canvas.width !== width || canvas.height !== height)) {
        canvas.width = width;
        canvas.height = height;
        Scene.fit(width, height);
        draw();
    }
}

function draw() {
    Scene.draw(paint, {rows, lane, shownLane, travelled, stride, hurt: hitFlash});
}

function setUpEvents() {
    $('start').addEventListener('click', startGame);
    new ResizeObserver(() => {
        if (state === 'playing' || state === 'ending') {
            fitCanvas();
        }
    }).observe(canvas);

    // A swipe changes lanes as soon as it is one, so one swipe can change two. A tap on letting go: only then is it clear
    // that it isn't a swipe. Each finger on its own.
    canvas.addEventListener('pointerdown', event => {
        event.preventDefault();
        canvas.setPointerCapture(event.pointerId);
        touches.set(event.pointerId, {x: event.clientX, swiped: false});
    });
    canvas.addEventListener('pointermove', event => {
        const touch = touches.get(event.pointerId);
        if (touch && Math.abs(event.clientX - touch.x) >= SWIPE_PX) {
            changeLane(Math.sign(event.clientX - touch.x));
            touch.x = event.clientX;
            touch.swiped = true;
        }
    });
    canvas.addEventListener('pointerup', event => {
        const touch = touches.get(event.pointerId);
        touches.delete(event.pointerId);
        if (touch && !touch.swiped) {
            const box = canvas.getBoundingClientRect();
            changeLane(event.clientX < box.left + box.width / 2 ? -1 : 1);
        }
    });
    canvas.addEventListener('pointercancel', event => touches.delete(event.pointerId));
    // No touch screen: the arrow keys
    document.addEventListener('keydown', event => {
        if (event.key === 'ArrowLeft') {
            changeLane(-1);
        } else if (event.key === 'ArrowRight') {
            changeLane(1);
        }
    });
}

Sound.setTune('road');
setUpEvents();
setUpGame({
    screens: ['intro', 'road'],
    newGame,
    resume: goOn,
    leaderboardUrl: () => '/api/leaderboard/dodge',
    leaderboardTitle: () => 'Leaderboard'
});
