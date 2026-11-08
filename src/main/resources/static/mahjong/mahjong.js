// Mahjong solitaire: take the tiles away in matching pairs until the board is empty. No timer, one thumb is enough:
// tap one free tile, then its partner. Undo, Hint and, when no pair is left, Shuffle are at the bottom, near the thumb.
// The rules are in board.js, the pictures in faces.js.
const SIZES = {small: 'Small', big: 'Big'};
const DEPTH = 0.085; // how far a layer sits up and left of the one below it, in tile widths
const TILE_RATIO = 4 / 3; // height to width
const REMOVE_MS = 160;
const HINT_MS = 1600;

const mahjongSettings = {size: 'small', ...remembered('mahjong-settings')};
const boardEl = $('board');
let tiles = []; // positions of the layout being played
let near = [];
let tileEls = [];
let faces = [];
let gone = [];
let history = []; // [a, b]: a pair taken away; {faces}: the faces before a shuffle
let shape = ''; // upright or sideways: which of the mode's layouts
let selected = -1;
let taking = false; // while a pair shrinks away
let hintTimer = 0;
let shuffledFaces = null; // ready when the board is stuck and can be mixed again

const savedKey = () => 'mahjong-game-' + mahjongSettings.size;
const tilesLeft = () => gone.filter(g => !g).length;

function stats() {
    return remembered('mahjong-stats')[mahjongSettings.size] || {played: 0, won: 0};
}

function saveStats(changed) {
    const all = remembered('mahjong-stats');
    all[mahjongSettings.size] = changed;
    remember('mahjong-stats', all);
}

function savedGame() {
    const saved = remembered(savedKey());
    return saved.faces && Board.LAYOUTS[mahjongSettings.size][saved.shape] ? saved : null;
}

function saveGame() {
    remember(savedKey(), {shape, faces, gone, history});
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
        button.setAttribute('aria-pressed', String(button.dataset.size === mahjongSettings.size));
    }
    const saved = savedGame();
    $('start').textContent = saved ? 'Continue' : 'Deal';
    $('new-deal').hidden = !saved;
    const {played, won} = stats();
    $('stats').textContent = played ? 'Cleared ' + won + ' of ' + played + ' on the ' + SIZES[mahjongSettings.size].toLowerCase() + ' board' : '';
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
    showIntro();
    showScreen('intro');
}

// The board's own tiles: the layout fixes where they lie, so a new layout means new elements
function useShape(newShape) {
    shape = newShape;
    tiles = Board.positions(Board.LAYOUTS[mahjongSettings.size][shape]);
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

function deal() {
    // Sideways screens get the wide layout. A deal keeps its layout when the screen turns; it just gets smaller.
    useShape(innerWidth > innerHeight * 1.1 ? 'sideways' : 'upright');
    faces = Board.deal(tiles, near);
    gone = tiles.map(() => false);
    history = [];
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
        useShape(saved.shape);
        ({faces, gone, history} = saved);
    } else {
        deal();
    }
    saveGame();
    selected = -1;
    state = 'playing';
    showScreen('table');
    changed();
}

function showTilesLeft() {
    score = tilesLeft();
    showScore();
    $('score').setAttribute('aria-label', score + ' tiles left');
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
    $('hint').hidden = stuck;
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
        el.classList.toggle('blocked', !Board.isFree(i, near, gone));
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
    for (const el of tileEls) {
        el.animate({rotate: ['0deg', '8deg', '-8deg', '0deg']}, {duration: 320});
    }
    changed();
}

function hint() {
    if (state !== 'playing' || taking) {
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
    const counted = stats();
    const won = counted.won + 1;
    saveStats({...counted, won});
    setTimeout(() => {
        score = won; // the leaderboard counts boards cleared
        finishGame('All ' + tiles.length + ' tiles cleared', null, true);
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
            mahjongSettings.size = button.dataset.size;
            remember('mahjong-settings', mahjongSettings);
            showIntro();
        });
    }
    new ResizeObserver(layout).observe(boardEl);
    document.addEventListener('keydown', pressKey);
}

Sound.setTune('garden');
setUpEvents();
setUpGame({
    screens: ['intro', 'table'],
    newGame,
    resume: layout,
    leaderboardUrl: () => '/api/leaderboard/mahjong-' + mahjongSettings.size,
    leaderboardTitle: () => 'Boards cleared · ' + SIZES[mahjongSettings.size]
});
