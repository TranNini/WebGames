// What the score changes. from: the score this starts at. speed: how many screen heights a block falls per second.
// spacing: the distance between two rows, in screen heights. doubleChance: how often a row blocks two of the lanes,
// which leaves one free lane. The time between two rows, spacing / speed, leaves room for two lane changes.
const LEVELS = [
    {from: 0, speed: 0.45, spacing: 0.55, doubleChance: 0},
    {from: 11, speed: 0.5, spacing: 0.5, doubleChance: 0},
    {from: 21, speed: 0.55, spacing: 0.5, doubleChance: 0.3},
    {from: 31, speed: 0.62, spacing: 0.48, doubleChance: 0.4},
    {from: 51, speed: 0.72, spacing: 0.46, doubleChance: 0.5},
    {from: 71, speed: 0.85, spacing: 0.44, doubleChance: 0.6},
    {from: 101, speed: 1, spacing: 0.42, doubleChance: 0.7},
    {from: 151, speed: 1.15, spacing: 0.46, doubleChance: 0.7}
];
const LANES = 3;
const BLOCK_COLORS = ['#c2e6ff', '#ffc2ec', '#c2ffe1', '#fff7c2', '#ffdac2', '#9691f2']; // not red: that is for a hit
// Heights and places are in screen heights, so a game takes the same time on any screen, upright or sideways
const BLOCK_HEIGHT = 0.09;
const PLAYER_TOP = 0.87;
const PLAYER_BOTTOM = 0.96;
const FIRST_ROW_AFTER = 0.2;
const SWIPE_PX = 24; // further than this before letting go is a swipe, not a tap
const LANE_CHANGE_SPEED = 30; // how quickly the player's block catches up with its lane
const HIT_FLASH_MS = 300;

const canvas = $('canvas');
const paint = canvas.getContext('2d');
const touches = new Map();
let colors = {};
let rows = [];
let lane = 1;
let shownLane = 1;
let travelled = 0;
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
    readColors(); // dark mode may have changed in the menu
    fitCanvas();
    lastFrame = performance.now();
    requestAnimationFrame(frame);
}

function readColors() {
    colors = {
        player: cssColor('--text'),
        hit: cssColor('--red'),
        edge: cssColor('--edge'),
        line: cssColor('--grey')
    };
}

function level() {
    return LEVELS.findLast(level => score >= level.from);
}

// At most two blocks in a row, so there is always a free lane
function addRow() {
    const free = [0, 1, 2];
    const count = Math.random() < level().doubleChance ? 2 : 1;
    const blocks = [];
    while (blocks.length < count) {
        const [blocked] = free.splice(Math.floor(Math.random() * free.length), 1);
        blocks.push({lane: blocked, color: BLOCK_COLORS[Math.floor(Math.random() * BLOCK_COLORS.length)]});
    }
    rows.push({y: -BLOCK_HEIGHT, blocks, hit: false});
}

function frame(now) {
    if (state !== 'playing') {
        return;
    }
    const passed = Math.min(now - lastFrame, 100); // a long gap (the page was hidden) doesn't count
    lastFrame = now;
    const fall = level().speed * passed / 1000;
    travelled += fall;
    shownLane += (lane - shownLane) * (1 - Math.exp(-LANE_CHANGE_SPEED * passed / 1000));
    hitFlash = Math.max(0, hitFlash - passed);

    untilNextRow -= fall;
    if (untilNextRow <= 0) {
        addRow();
        untilNextRow += level().spacing;
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
        const reachesPlayer = row.y + BLOCK_HEIGHT > PLAYER_TOP && row.y < PLAYER_BOTTOM;
        const block = reachesPlayer && row.blocks.find(block => block.lane === lane);
        if (block) {
            row.blocks.splice(row.blocks.indexOf(block), 1);
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
    rows = rows.filter(row => {
        if (row.y < PLAYER_BOTTOM) {
            return true;
        }
        if (!row.hit) {
            score++;
            Sound.setMusicSpeed(Math.min(score / LEVELS.at(-1).from, 1));
            showScore();
        }
        return false;
    });
}

function changeLane(direction) {
    const next = Math.max(0, Math.min(LANES - 1, lane + direction));
    if (state === 'playing' && next !== lane) {
        lane = next;
        Sound.tap(lane);
    }
}

function fitCanvas() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(canvas.clientWidth * ratio);
    const height = Math.round(canvas.clientHeight * ratio);
    if (width > 0 && height > 0 && (canvas.width !== width || canvas.height !== height)) {
        canvas.width = width;
        canvas.height = height;
        draw();
    }
}

function fillBlock(x, y, width, height, color) {
    const edge = Math.min(width, height) * 0.22;
    paint.fillStyle = color;
    paint.beginPath();
    paint.roundRect(x, y, width, height, edge);
    paint.fill();
    paint.strokeStyle = colors.edge;
    paint.lineWidth = 2 * (window.devicePixelRatio || 1);
    paint.stroke();
}

function draw() {
    const {width, height} = canvas;
    const laneWidth = width / LANES;
    const margin = laneWidth * 0.08;
    paint.clearRect(0, 0, width, height);

    // Lines between the lanes, moving with the road
    const dash = height * 0.05;
    paint.strokeStyle = colors.line;
    paint.lineWidth = 2 * (window.devicePixelRatio || 1);
    paint.setLineDash([dash, dash]);
    paint.lineDashOffset = -travelled * height;
    paint.globalAlpha = 0.5;
    paint.beginPath();
    for (let i = 1; i < LANES; i++) {
        paint.moveTo(i * laneWidth, 0);
        paint.lineTo(i * laneWidth, height);
    }
    paint.stroke();
    paint.setLineDash([]);
    paint.globalAlpha = 1;

    for (const row of rows) {
        for (const block of row.blocks) {
            fillBlock(block.lane * laneWidth + margin, row.y * height, laneWidth - 2 * margin, BLOCK_HEIGHT * height, block.color);
        }
    }

    const playerHeight = (PLAYER_BOTTOM - PLAYER_TOP) * height;
    const playerWidth = Math.min(laneWidth * 0.62, playerHeight * 1.5);
    const playerX = (shownLane + 0.5) * laneWidth - playerWidth / 2;
    fillBlock(playerX, PLAYER_TOP * height, playerWidth, playerHeight, hitFlash > 0 ? colors.hit : colors.player);
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
