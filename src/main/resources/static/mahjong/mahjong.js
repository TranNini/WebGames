// Mahjong solitaire: take the tiles away in matching pairs until the board is empty, against the clock. One thumb is enough:
// tap one free tile, then its partner. Undo, Hint and, when no pair is left, Shuffle are at the bottom, near the thumb.
// The score is the time, so the leaderboards list the fastest; a hint or a shuffle adds to it. The rules are in board.js,
// the pictures in faces.js.
// shade: tiles that can't be taken yet have a darker face (not on Hard)
const LEVELS = {
    easy: {name: 'Easy', shade: true},
    medium: {name: 'Medium', shade: true},
    hard: {name: 'Hard', shade: false}
};
const RANDOM = 'Random';
const HINT_SECONDS = 15;
const SHUFFLE_SECONDS = 30;
const DEPTH = 0.085; // how far a layer sits up and left of the one below it, in tile widths
const TILE_RATIO = 4 / 3; // height to width
const REMOVE_MS = 160;
const HINT_MS = 1600;

// The first version had a small and a big board, without a clock: they are now Easy and Hard
function moveOldGames() {
    const old = {small: 'easy', big: 'hard'};
    const before = remembered('mahjong-settings');
    if (before.size) {
        remember('mahjong-settings', {level: old[before.size] || 'easy'});
    }
    const counted = remembered('mahjong-stats');
    let moved = false;
    for (const [from, to] of Object.entries(old)) {
        if (counted[from]) {
            counted[to] ||= counted[from];
            delete counted[from];
            moved = true;
        }
        const game = remembered('mahjong-game-' + from);
        if (game.faces && !remembered('mahjong-game-' + to).faces) {
            remember('mahjong-game-' + to, {...game, elapsed: 0});
        }
        try {
            localStorage.removeItem('mahjong-game-' + from);
        } catch (e) {
            // nothing was kept
        }
    }
    if (moved) {
        remember('mahjong-stats', counted);
    }
}

moveOldGames();
const mahjongSettings = {level: 'easy', noHints: false, ...remembered('mahjong-settings')};
if (!LEVELS[mahjongSettings.level]) {
    mahjongSettings.level = 'easy';
}
const boardEl = $('board');
let tiles = []; // positions of the layout being played
let near = [];
let tileEls = [];
let faces = [];
let gone = [];
let history = []; // [a, b]: a pair taken away; {faces}: the faces before a shuffle
let layoutName = ''; // which of the level's layouts (board.js)
let shape = ''; // upright or sideways: which of that layout's height maps
let selected = -1;
let taking = false; // while a pair shrinks away
let hintTimer = 0;
let shuffledFaces = null; // ready when the board is stuck and can be mixed again
let elapsed = 0; // milliseconds played on this deal, penalties included; the clock stops in the menu
let lastTick = performance.now();

const level = () => LEVELS[mahjongSettings.level];
// The level, and whether hints are off: each has its own saved game, stats and leaderboard (easy, easy-nohints, ...)
const modeKey = () => mahjongSettings.level + (mahjongSettings.noHints ? '-nohints' : '');
const modeName = () => level().name + (mahjongSettings.noHints ? ' · No hints' : '');
const savedKey = () => 'mahjong-game-' + modeKey();
const tilesLeft = () => gone.filter(g => !g).length;

// 75 seconds: 1:15
function formatTime(seconds) {
    const whole = Math.floor(seconds);
    return Math.floor(whole / 60) + ':' + String(whole % 60).padStart(2, '0');
}

function stats() {
    return remembered('mahjong-stats')[modeKey()] || {played: 0, won: 0};
}

function saveStats(changed) {
    const all = remembered('mahjong-stats');
    all[modeKey()] = changed;
    remember('mahjong-stats', all);
}

function savedGame() {
    const saved = remembered(savedKey());
    // Games from before there were several layouts have no name: they were on the level's first
    const layout = saved.faces && Board.layoutOf(mahjongSettings.level, saved.layout);
    return layout && layout[saved.shape] && saved.faces.length === Board.TILE_COUNTS[mahjongSettings.level] ? saved : null;
}

function saveGame() {
    remember(savedKey(), {layout: layoutName, shape, faces, gone, history, elapsed});
}

function forgetGame() {
    try {
        localStorage.removeItem(savedKey());
    } catch (e) {
        // nothing was kept
    }
}

function showIntro() {
    for (const button of document.querySelectorAll('.mode')) {
        button.setAttribute('aria-pressed', String(button.dataset.level === mahjongSettings.level));
    }
    $('no-hints').checked = mahjongSettings.noHints;
    showLayoutChoices();
    const saved = savedGame();
    $('start').textContent = saved ? 'Continue ' + Board.layoutOf(mahjongSettings.level, saved.layout).name : 'Deal';
    $('new-deal').hidden = !saved;
    const {played, won, best} = stats();
    $('stats').textContent = played ? 'Cleared ' + won + ' of ' + played + ' on ' + level().name
        + (mahjongSettings.noHints ? ' without hints' : '')
        + (best ? ' · best ' + formatTime(best) : '') : '';
}

const upright = () => innerWidth <= innerHeight * 1.1;

// Random and the level's layouts, each with a small outline of the shape a deal on this screen would get:
// the higher the stack, the darker the place
function showLayoutChoices() {
    const shuffleIcon = '<svg class="layout-preview random" viewBox="0 0 24 24" aria-hidden="true"><path d="M16 3h5v5"></path>'
        + '<path d="M4 20 21 3"></path><path d="M21 16v5h-5"></path><path d="m15 15 6 6"></path><path d="M4 4l5 5"></path></svg>';
    const choices = [{name: RANDOM, picture: shuffleIcon}, ...Board.LAYOUTS[mahjongSettings.level].map(layout => ({
        name: layout.name,
        picture: outline(layout[upright() ? 'upright' : 'sideways'])
    }))];
    $('layouts').replaceChildren(...choices.map(({name, picture}) => {
        const button = document.createElement('button');
        button.className = 'layout-choice';
        button.dataset.layout = name;
        button.setAttribute('aria-pressed', String(name === pickedLayout()));
        button.innerHTML = picture + '<span></span>';
        button.querySelector('span').textContent = name;
        return button;
    }));
}

function outline(map) {
    const rects = map.flatMap((row, r) => [...row].flatMap((cell, c) => {
        const height = Number(cell) || 0;
        return height ? ['<rect x="' + c * 3 + '" y="' + r * 4 + '" width="2.6" height="3.6" rx="0.4" class="h' + Math.min(height, 4) + '"></rect>'] : [];
    }));
    return '<svg class="layout-preview" viewBox="-0.2 -0.2 ' + (map[0].length * 3) + ' ' + (map.length * 4) + '" aria-hidden="true">'
        + rects.join('') + '</svg>';
}

function newGame() {
    if (state === 'paused') {
        forgetGame(); // Restart in the menu gives this deal up
    }
    clearTimeout(hintTimer);
    taking = false;
    state = 'intro';
    score = 0;
    strikes = 0;
    showScore();
    $('score').textContent = formatTime(0);
    showIntro();
    showScreen('intro');
}

// The board's own tiles: the layout fixes where they lie, so a new layout means new elements
function useLayout(name, newShape) {
    const layout = Board.layoutOf(mahjongSettings.level, name);
    layoutName = layout.name;
    shape = newShape;
    tiles = Board.positions(layout[shape]);
    near = Board.neighbours(tiles);
    tileEls = tiles.map((tile, i) => {
        const el = document.createElement('div');
        el.className = 'tile';
        el.dataset.index = i;
        el.innerHTML = '<svg viewBox="0 0 30 40" aria-hidden="true"><use></use></svg>';
        return el;
    });
    boardEl.replaceChildren(...tileEls);
}

// The layout picked on the first screen for this level, or Random
const pickedLayout = () => (mahjongSettings.layouts || {})[mahjongSettings.level] || RANDOM;

// The picked layout, or with Random one of the level's layouts, but not the one played last
function nextLayout() {
    if (pickedLayout() !== RANDOM) {
        return Board.layoutOf(mahjongSettings.level, pickedLayout()).name;
    }
    const last = (mahjongSettings.lastLayout || {})[mahjongSettings.level];
    const choices = Board.LAYOUTS[mahjongSettings.level].filter(layout => layout.name !== last);
    const name = choices[Math.floor(Math.random() * choices.length)].name;
    mahjongSettings.lastLayout = {...mahjongSettings.lastLayout, [mahjongSettings.level]: name};
    remember('mahjong-settings', mahjongSettings);
    return name;
}

function deal() {
    // Sideways screens get the wide shape. A deal keeps its shape when the screen turns; it just gets smaller.
    useLayout(nextLayout(), upright() ? 'upright' : 'sideways');
    faces = Board.deal(tiles, near);
    gone = tiles.map(() => false);
    history = [];
    elapsed = 0;
    const counted = stats();
    saveStats({...counted, played: counted.played + 1});
}

function startGame(fresh) {
    Sound.unlock();
    Sound.start();
    Sound.setMusicSpeed(0);
    Sound.startMusic();
    const saved = fresh ? null : savedGame();
    if (saved) {
        useLayout(saved.layout, saved.shape);
        ({faces, gone, history} = saved);
        elapsed = saved.elapsed || 0;
    } else {
        deal();
    }
    saveGame();
    selected = -1;
    lastTick = performance.now();
    state = 'playing';
    showScreen('table');
    changed();
}

function showTilesLeft() {
    $('layout-name').textContent = layoutName;
    $('left-count').textContent = tilesLeft() + ' left';
}

// The clock runs only while the board is being played: not in the menu, nor while the phone is locked
function tick() {
    const now = performance.now();
    const step = Math.min(now - lastTick, 1000); // a sleeping page's timers don't add a jump
    lastTick = now;
    if (state === 'playing' && !document.hidden) {
        elapsed += step;
    }
    if (state === 'playing' || state === 'paused') {
        showClock();
    }
}

function showClock() {
    $('score').textContent = formatTime(elapsed / 1000);
    $('score').setAttribute('aria-label', 'Time ' + formatTime(elapsed / 1000));
}

function addPenalty(seconds) {
    elapsed += seconds * 1000;
    showClock();
    $('score').animate({color: ['var(--red)', 'var(--red)', 'var(--text)'], scale: [1.15, 1]}, {duration: 700});
}

// After every change: the faces, which tiles are free, the buttons, and whether the game is won or stuck
function changed() {
    saveGame();
    showTilesLeft();
    drawTiles();
    layout();
    $('undo').disabled = history.length === 0;
    if (tilesLeft() === 0) {
        win();
        return;
    }
    const stuck = !Board.freePair(faces, near, gone);
    shuffledFaces = stuck ? Board.shuffle(faces, near, gone) : null;
    $('stuck').hidden = !stuck;
    $('stuck').textContent = !stuck ? '' : shuffledFaces ? 'No pairs left. Shuffle the tiles, or undo.'
        : 'These tiles can\'t all be cleared any more. Undo a few moves.';
    $('hint').hidden = stuck || mahjongSettings.noHints;
    $('shuffle').hidden = !stuck || !shuffledFaces;
}

function drawTiles() {
    tileEls.forEach((el, i) => {
        el.hidden = gone[i];
        if (gone[i]) {
            return;
        }
        el.querySelector('use').setAttribute('href', '#face-' + faces[i]);
        el.setAttribute('aria-label', Faces.name(faces[i]));
        el.classList.toggle('blocked', level().shade && !mahjongSettings.noHints && !Board.isFree(i, near, gone));
        el.classList.toggle('selected', i === selected);
    });
}

function tapTile(i) {
    if (state !== 'playing' || taking || gone[i]) {
        return;
    }
    if (!Board.isFree(i, near, gone)) {
        tileEls[i].animate({translate: ['0 0', '-5px 0', '5px 0', '-3px 0', '0 0']}, {duration: 260});
        return;
    }
    clearHint();
    if (i === selected) {
        selected = -1;
        Sound.tap(1);
    } else if (selected >= 0 && Board.matches(faces[i], faces[selected])) {
        takePair(selected, i);
        return;
    } else {
        selected = i;
        Sound.tap(2);
    }
    drawTiles();
}

function takePair(a, b) {
    selected = -1;
    history.push([a, b]);
    gone[a] = true;
    gone[b] = true;
    Sound.tap(5);
    // They shrink away before the board changes
    for (const i of [a, b]) {
        tileEls[i].classList.add('selected');
        tileEls[i].animate({scale: [1, 0.2]}, {duration: REMOVE_MS, easing: 'ease-in'});
    }
    taking = true;
    setTimeout(() => {
        taking = false;
        if (state === 'playing' || state === 'paused') {
            changed();
        }
    }, REMOVE_MS - 10);
}

function undo() {
    if (state !== 'playing' || taking || history.length === 0) {
        return;
    }
    clearHint();
    const last = history.pop();
    if (Array.isArray(last)) {
        last.forEach(i => {
            gone[i] = false;
        });
    } else {
        faces = last.faces;
    }
    selected = -1;
    Sound.tap(1);
    changed();
}

function shuffle() {
    if (state !== 'playing' || taking || !shuffledFaces) {
        return;
    }
    history.push({faces});
    faces = shuffledFaces;
    selected = -1;
    Sound.tap(0);
    addPenalty(SHUFFLE_SECONDS);
    for (const el of tileEls) {
        el.animate({rotate: ['0deg', '8deg', '-8deg', '0deg']}, {duration: 320});
    }
    changed();
}

function hint() {
    if (state !== 'playing' || taking || mahjongSettings.noHints) {
        return;
    }
    const pair = Board.freePair(faces, near, gone);
    if (!pair) {
        return;
    }
    clearHint();
    selected = -1;
    drawTiles();
    Sound.tap(3);
    addPenalty(HINT_SECONDS);
    saveGame();
    pair.forEach(i => tileEls[i].classList.add('hint'));
    hintTimer = setTimeout(clearHint, HINT_MS);
}

function clearHint() {
    clearTimeout(hintTimer);
    tileEls.forEach(el => el.classList.remove('hint'));
}

function win() {
    state = 'ending';
    forgetGame();
    const seconds = Math.max(1, Math.round(elapsed / 1000));
    showClock();
    const counted = stats();
    saveStats({...counted, won: counted.won + 1, best: Math.min(counted.best || Infinity, seconds)});
    setTimeout(() => {
        score = seconds; // the leaderboard lists the fastest
        finishGame('Cleared ' + layoutName + ' in ' + formatTime(seconds), null, true);
    }, 300);
}

// --- Placing the tiles ---

// The biggest tiles that let the whole layout fit, each layer a little up and left of the one below
function layout() {
    if (!tiles.length || $('table').hidden) {
        return;
    }
    const width = boardEl.clientWidth;
    const height = boardEl.clientHeight;
    const columns = Math.max(...tiles.map(t => t.x)) / 2 + 1;
    const rows = Math.max(...tiles.map(t => t.y)) / 2 + 1;
    const top = Math.max(...tiles.map(t => t.z));
    const layers = top + 1; // the lowest layer's edge shows as well
    const tw = Math.min(width / (columns + DEPTH * layers), height / (rows * TILE_RATIO + DEPTH * layers));
    if (!(tw > 0)) {
        return;
    }
    const th = tw * TILE_RATIO;
    const depth = tw * DEPTH;
    const left = (width - tw * (columns + DEPTH * layers)) / 2;
    const up = (height - th * rows - depth * layers) / 2;
    boardEl.style.setProperty('--tw', tw + 'px');
    boardEl.style.setProperty('--th', th + 'px');
    boardEl.style.setProperty('--sides', sides(depth));
    tiles.forEach((tile, i) => {
        const el = tileEls[i];
        el.style.left = (left + tile.x / 2 * tw + (top - tile.z) * depth) + 'px';
        el.style.top = (up + tile.y / 2 * th + (top - tile.z) * depth) + 'px';
        el.style.zIndex = tile.z * 10000 + tile.y * 100 + tile.x; // higher layers, then lower rows, then further right cover
    });
}

// The tile's edge below and right of its face: a cream rim, then the green back, as steps of solid shadow
function sides(depth) {
    const steps = Math.max(2, Math.round(depth));
    return [...Array(steps).keys()].map(k => {
        const at = ((k + 1) * depth / steps).toFixed(2) + 'px';
        return at + ' ' + at + ' 0 ' + (k < steps * 0.35 ? 'var(--tile-rim)' : 'var(--tile-back)');
    }).join(', ');
}

function pressKey(event) {
    if ((event.ctrlKey || event.metaKey) && event.key !== 'z' || event.altKey || event.repeat) {
        return;
    }
    if (event.key === 'Escape') {
        $('menu-button').click();
    } else if (state === 'playing' && (event.key === 'z' || event.key === 'Backspace')) {
        undo();
    } else if (state === 'playing' && event.key === 'h') {
        hint();
    }
}

function setUpEvents() {
    boardEl.addEventListener('click', event => {
        const tile = event.target.closest('.tile');
        if (tile) {
            tapTile(Number(tile.dataset.index));
        }
    });
    $('undo').addEventListener('click', undo);
    $('hint').addEventListener('click', hint);
    $('shuffle').addEventListener('click', shuffle);
    $('start').addEventListener('click', () => startGame(false));
    $('new-deal').addEventListener('click', () => {
        forgetGame();
        startGame(true);
    });
    for (const button of document.querySelectorAll('.mode')) {
        button.addEventListener('click', () => {
            mahjongSettings.level = button.dataset.level;
            remember('mahjong-settings', mahjongSettings);
            showIntro();
        });
    }
    $('layouts').addEventListener('click', event => {
        const button = event.target.closest('.layout-choice');
        if (button) {
            mahjongSettings.layouts = {...mahjongSettings.layouts, [mahjongSettings.level]: button.dataset.layout};
            remember('mahjong-settings', mahjongSettings);
            showIntro();
        }
    });
    // The outlines follow the screen: a phone turned sideways gets the wide shapes
    addEventListener('resize', () => {
        if (state === 'intro') {
            showLayoutChoices();
        }
    });
    $('no-hints').addEventListener('change', () => {
        mahjongSettings.noHints = $('no-hints').checked;
        remember('mahjong-settings', mahjongSettings);
        showIntro();
    });
    new ResizeObserver(layout).observe(boardEl);
    document.addEventListener('keydown', pressKey);
    // The time so far is kept when the page goes away
    const keepTime = () => {
        if (state === 'playing' || state === 'paused') {
            saveGame();
        }
    };
    document.addEventListener('visibilitychange', keepTime);
    window.addEventListener('pagehide', keepTime);
    setInterval(tick, 250);
}

Sound.setTune('garden');
document.querySelector('.bar').insertAdjacentHTML('beforeend', '<span id="tiles-left" class="tiles-left"><small id="layout-name"></small><span id="left-count"></span></span>');
setUpEvents();
setUpGame({
    screens: ['intro', 'table'],
    newGame,
    resume() {
        lastTick = performance.now();
        layout();
    },
    leaderboardUrl: () => '/api/leaderboard/mahjong-' + modeKey(),
    leaderboardTitle: () => 'Fastest · ' + modeName(),
    formatScore: formatTime,
    lowerIsBetter: true
});
