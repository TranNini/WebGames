// Klondike: build each suit from ace to king. No timer, and one thumb is enough: a tap moves a card (with the cards on
// it) to the best place it fits, and a second tap to the next one. The deck and Undo are at the bottom, near the thumb.
const SUITS = ['♠︎', '♥︎', '♦︎', '♣︎']; // ︎: as text, not as an emoji on iOS
const SUIT_NAMES = ['spades', 'hearts', 'diamonds', 'clubs'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const MODES = {1: 'Draw 1', 3: 'Draw 3'};
const MOVE_MS = 200;
const FINISH_STEP_MS = 110; // the cards going up on their own at the end
const MAX_UNDO = 500;
// How far a card covers the one under it in a column, in card heights, and how close they may get when a column is long
const DOWN_STEP = 0.13;
const UP_STEP = 0.3;
const SMALLEST_DOWN_STEP = 0.06;
const SMALLEST_UP_STEP = 0.15;

const solitaireSettings = {draw: 1, ...remembered('solitaire-settings')};
const table = $('table');
const cardEls = [];
const slotEls = {};
let piles = null; // stock, waste, found (one per suit), tab (seven columns); a card is {id, up}
let moves = 0;
let history = [];
let finishing = false;
let liftedUntil = 0;
let finishTimer = 0;

const suitOf = card => Math.floor(card.id / 13);
const rankOf = card => card.id % 13 + 1;
const isRed = card => suitOf(card) === 1 || suitOf(card) === 2;
const savedKey = () => 'solitaire-game-' + solitaireSettings.draw;

function stats() {
    const all = remembered('solitaire-stats');
    return all[solitaireSettings.draw] || {played: 0, won: 0};
}

function saveStats(changed) {
    const all = remembered('solitaire-stats');
    all[solitaireSettings.draw] = changed;
    remember('solitaire-stats', all);
}

function savedGame() {
    const saved = remembered(savedKey());
    return saved.piles ? saved : null;
}

function saveGame() {
    remember(savedKey(), {piles, moves, history});
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
        button.setAttribute('aria-pressed', String(Number(button.dataset.draw) === solitaireSettings.draw));
    }
    const saved = savedGame();
    $('start').textContent = saved ? 'Continue' : 'Deal';
    $('new-deal').hidden = !saved;
    const {played, won} = stats();
    $('stats').textContent = played ? 'Won ' + won + ' of ' + played + ' with ' + MODES[solitaireSettings.draw] : '';
}

function newGame() {
    if (state === 'paused') {
        forgetGame(); // Restart in the menu gives this deal up
    }
    clearTimeout(finishTimer);
    finishing = false;
    state = 'intro';
    score = 0;
    strikes = 0;
    showScore();
    showIntro();
    showScreen('intro');
}

function deal() {
    const deck = [...Array(52).keys()];
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    const cards = deck.map(id => ({id, up: false}));
    piles = {stock: [], waste: [], found: [[], [], [], []], tab: []};
    for (let column = 0; column < 7; column++) {
        piles.tab.push(cards.splice(0, column + 1));
        piles.tab[column].at(-1).up = true;
    }
    piles.stock = cards;
    moves = 0;
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
        ({piles, moves, history} = saved);
    } else {
        deal();
    }
    saveGame();
    finishing = false;
    state = 'playing';
    showScreen('table');
    showMoves();
    layout(false);
    checkEnd();
}

function showMoves() {
    score = moves;
    showScore();
    $('score').setAttribute('aria-label', moves + ' moves');
}

// Where a card is: which pile, and its place in it
function find(id) {
    const look = (kind, index, pile) => {
        const at = pile.findIndex(card => card.id === id);
        return at >= 0 ? {kind, index, pile, at} : null;
    };
    return look('stock', 0, piles.stock) || look('waste', 0, piles.waste)
        || piles.found.map((pile, i) => look('found', i, pile)).find(Boolean)
        || piles.tab.map((pile, i) => look('tab', i, pile)).find(Boolean);
}

function fitsFoundation(card) {
    return piles.found[suitOf(card)].length === rankOf(card) - 1;
}

function fitsColumn(card, column) {
    const top = piles.tab[column].at(-1);
    return top ? top.up && isRed(top) !== isRed(card) && rankOf(top) === rankOf(card) + 1 : rankOf(card) === 13;
}

// The best place for the cards from here: the foundation, then a column with cards, then an empty one. Columns are
// tried from the one right of where the cards are, so tapping again moves them on to the next place that fits.
function bestPlace(from) {
    const card = from.pile[from.at];
    const single = from.at === from.pile.length - 1;
    if (single && from.kind !== 'found' && fitsFoundation(card)) {
        return {kind: 'found', index: suitOf(card)};
    }
    const start = from.kind === 'tab' ? from.index + 1 : 0;
    let empty = null;
    for (let k = 0; k < 7; k++) {
        const column = (start + k) % 7;
        if ((from.kind === 'tab' && column === from.index) || !fitsColumn(card, column)) {
            continue;
        }
        if (piles.tab[column].length > 0) {
            return {kind: 'tab', index: column};
        }
        // A king that already has a column to itself has nowhere better to go
        if (empty === null && !(from.kind === 'tab' && from.at === 0)) {
            empty = {kind: 'tab', index: column};
        }
    }
    return empty;
}

function pileOf(place) {
    return place.kind === 'found' ? piles.found[place.index] : piles.tab[place.index];
}

function keepForUndo() {
    history.push(JSON.stringify({piles, moves}));
    if (history.length > MAX_UNDO) {
        history.shift();
    }
}

function moveCards(from, to) {
    keepForUndo();
    const moving = from.pile.splice(from.at);
    pileOf(to).push(...moving);
    const uncovered = from.kind === 'tab' && from.pile.at(-1);
    if (uncovered && !uncovered.up) {
        uncovered.up = true;
    }
    moves++;
    Sound.tap(to.kind === 'found' ? Math.min(7, Math.floor((rankOf(moving[0]) - 1) * 8 / 13)) : 2);
    changed(moving);
}

function draw() {
    if (piles.stock.length === 0 && piles.waste.length === 0) {
        return;
    }
    keepForUndo();
    let moving;
    if (piles.stock.length === 0) {
        // Turned over again, as often as you like
        piles.stock = piles.waste.reverse().map(card => ({...card, up: false}));
        piles.waste = [];
        moving = piles.stock;
    } else {
        moving = piles.stock.splice(-Math.min(solitaireSettings.draw, piles.stock.length)).reverse();
        moving.forEach(card => {
            card.up = true;
        });
        piles.waste.push(...moving);
    }
    moves++;
    Sound.tap(0);
    changed(moving);
}

function undo() {
    if (state !== 'playing' || finishing || history.length === 0) {
        return;
    }
    ({piles, moves} = JSON.parse(history.pop()));
    Sound.tap(1);
    changed([]);
}

function changed(moving) {
    saveGame();
    showMoves();
    layout(true, moving.map(card => card.id));
    checkEnd();
}

function tapCard(id) {
    if (state !== 'playing' || finishing) {
        return;
    }
    let from = find(id);
    if (from.kind === 'stock') {
        draw();
        return;
    }
    // In the waste and on a foundation only the top card can move
    if (from.kind !== 'tab') {
        from = {...from, at: from.pile.length - 1};
    }
    if (!from.pile[from.at].up) {
        return;
    }
    const to = bestPlace(from);
    if (to) {
        moveCards(from, to);
    } else {
        from.pile.slice(from.at).forEach(card => cardEls[card.id].animate(
            {translate: ['0 0', '-6px 0', '6px 0', '-4px 0', '0 0']}, {duration: 260}));
    }
}

// All cards face up and none left to draw: they go up on their own
function checkEnd() {
    if (state !== 'playing') {
        return;
    }
    if (piles.found.every(pile => pile.length === 13)) {
        win();
    } else if (!finishing && piles.stock.length === 0 && piles.waste.length === 0
        && piles.tab.every(column => column.every(card => card.up))) {
        finishing = true;
        finishTimer = setTimeout(finishStep, FINISH_STEP_MS * 2);
    }
}

function finishStep() {
    if (state !== 'playing') {
        finishing = false; // goes on after the menu
        return;
    }
    const tops = piles.tab.map((column, index) => ({column, index}))
        .filter(({column}) => column.length && fitsFoundation(column.at(-1)))
        .sort((a, b) => rankOf(a.column.at(-1)) - rankOf(b.column.at(-1)));
    finishing = false;
    if (tops.length === 0) {
        return;
    }
    const {column, index} = tops[0];
    moveCards({kind: 'tab', index, pile: column, at: column.length - 1}, {kind: 'found', index: suitOf(column.at(-1))});
    if (state === 'playing' && !piles.found.every(pile => pile.length === 13)) {
        finishing = true;
        finishTimer = setTimeout(finishStep, FINISH_STEP_MS);
    }
}

function win() {
    finishing = true; // no more taps while the last card lands
    forgetGame();
    const counted = stats();
    const won = counted.won + 1;
    saveStats({...counted, won});
    setTimeout(() => {
        finishing = false;
        score = won; // the leaderboard counts games won
        finishGame('In ' + moves + ' moves', null, true);
    }, MOVE_MS + 300);
}

// --- Drawing the table ---

function cardHtml(id) {
    const card = {id};
    const suit = SUITS[suitOf(card)];
    return '<span class="corner">' + RANKS[rankOf(card) - 1] + '<small>' + suit + '</small></span><span class="pip">' + suit + '</span>';
}

function makeTable() {
    for (let id = 0; id < 52; id++) {
        const el = document.createElement('div');
        el.className = 'card ' + (isRed({id}) ? 'red' : 'black');
        el.dataset.id = id;
        el.innerHTML = cardHtml(id);
        cardEls.push(el);
    }
    const slot = (name, text, label) => {
        const el = document.createElement('div');
        el.className = 'slot ' + name;
        el.textContent = text;
        el.setAttribute('aria-label', label);
        slotEls[name] = el;
        return el;
    };
    table.prepend(
        slot('stock', '↻', 'Turn the cards over again'),
        ...SUITS.map((suit, i) => slot('found' + i, suit, 'Foundation for ' + SUIT_NAMES[i])),
        ...[...Array(7).keys()].map(i => slot('tab' + i, '', 'Empty column')),
        ...cardEls
    );
}

// Where everything goes. Upright: foundations on top, the columns in the middle, Undo, waste and deck at the bottom.
// Sideways: foundations on the left, the columns in the middle, waste and deck on the right.
function places() {
    const width = table.clientWidth;
    const height = table.clientHeight;
    const gap = Math.max(4, Math.round(Math.min(width, height) * 0.015));
    const p = {gap};
    if (width < height * 1.1) {
        p.cw = Math.min((width - 6 * gap) / 7, (height - 4 * gap) / (1.4 * 5.2));
        p.ch = p.cw * 1.4;
        const left = (width - 7 * p.cw - 6 * gap) / 2;
        const x = i => left + i * (p.cw + gap);
        p.found = [0, 1, 2, 3].map(i => ({x: x(i), y: 0}));
        p.tab = [...Array(7).keys()].map(i => ({x: x(i), y: p.ch + 2 * gap}));
        p.tabBottom = height - p.ch - 2 * gap;
        p.stock = {x: x(6), y: height - p.ch};
        p.waste = {x: x(5), y: height - p.ch};
        p.fan = {x: -p.cw * 0.6, y: 0};
        const undoHeight = Math.min(p.ch, 56);
        p.undo = {x: x(0), y: height - undoHeight, w: 2 * p.cw + gap, h: undoHeight};
    } else {
        p.cw = Math.min((width - 11 * gap) / 10, (height - 3 * gap) / (1.4 * 3.4));
        p.ch = p.cw * 1.4;
        const left = (width - 10 * p.cw - 11 * gap) / 2;
        const x = i => left + i * (p.cw + gap) + (i >= 2 ? gap : 0) + (i >= 9 ? gap : 0);
        p.found = [0, 1, 2, 3].map(i => ({x: x(i % 2), y: Math.floor(i / 2) * (p.ch + gap)}));
        p.tab = [...Array(7).keys()].map(i => ({x: x(2 + i), y: 0}));
        p.tabBottom = height;
        p.stock = {x: x(9), y: height - p.ch};
        p.waste = {x: x(9), y: height - 2 * p.ch - gap};
        p.fan = {x: 0, y: -p.ch * 0.3};
        const undoHeight = Math.min(p.ch * 0.8, 52);
        p.undo = {x: x(0), y: height - undoHeight, w: 2 * p.cw + gap, h: undoHeight};
    }
    return p;
}

// Card heights a column's cards step down by, closer together when the column would not fit
function columnSteps(column, room, ch) {
    const down = column.filter(card => !card.up).length;
    const up = column.length - down;
    let downStep = DOWN_STEP * ch;
    let upStep = UP_STEP * ch;
    const needed = () => ch + down * downStep + Math.max(0, up - 1) * upStep;
    if (needed() > room && up > 1) {
        upStep = Math.max(SMALLEST_UP_STEP * ch, (room - ch - down * downStep) / (up - 1));
    }
    if (needed() > room && down > 0) {
        downStep = Math.max(SMALLEST_DOWN_STEP * ch, (room - ch - Math.max(0, up - 1) * upStep) / down);
    }
    return {downStep, upStep};
}

function layout(animate, lifted = []) {
    if (!piles || table.hidden) {
        return;
    }
    const p = places();
    if (!(p.cw > 0)) {
        return;
    }
    table.classList.toggle('still', !animate);
    table.style.setProperty('--cw', p.cw + 'px');
    table.style.setProperty('--ch', p.ch + 'px');
    const put = (el, at, z) => {
        el.style.transform = 'translate(' + at.x + 'px, ' + at.y + 'px)';
        el.style.zIndex = z;
    };
    const putCard = (card, at, z) => {
        const el = cardEls[card.id];
        el.classList.toggle('down', !card.up);
        const label = card.up ? RANKS[rankOf(card) - 1] + ' of ' + SUIT_NAMES[suitOf(card)] : 'Face down card';
        el.setAttribute('aria-label', label);
        put(el, at, lifted.includes(card.id) ? 200 + z : z);
    };
    put(slotEls.stock, p.stock, 0);
    piles.stock.forEach((card, i) => putCard(card, p.stock, 1 + i));
    const shown = solitaireSettings.draw === 3 ? Math.min(3, piles.waste.length) : 1;
    piles.waste.forEach((card, i) => {
        const fanned = Math.max(0, i - (piles.waste.length - shown)); // the last few spread out, the newest nearest the deck
        const back = shown - 1 - fanned;
        putCard(card, {x: p.waste.x + p.fan.x * back, y: p.waste.y + p.fan.y * back}, 1 + i);
    });
    piles.found.forEach((pile, i) => {
        put(slotEls['found' + i], p.found[i], 0);
        pile.forEach((card, k) => putCard(card, p.found[i], 1 + k));
    });
    piles.tab.forEach((column, i) => {
        put(slotEls['tab' + i], p.tab[i], 0);
        const {downStep, upStep} = columnSteps(column, p.tabBottom - p.tab[i].y, p.ch);
        let y = p.tab[i].y;
        column.forEach((card, k) => {
            putCard(card, {x: p.tab[i].x, y}, 1 + k);
            y += card.up ? upStep : downStep;
        });
    });
    slotEls.stock.classList.toggle('empty', piles.stock.length === 0 && piles.waste.length > 0);
    const undoButton = $('undo');
    undoButton.style.transform = 'translate(' + p.undo.x + 'px, ' + p.undo.y + 'px)';
    undoButton.style.width = p.undo.w + 'px';
    undoButton.style.height = p.undo.h + 'px';
    undoButton.disabled = history.length === 0;
    // Lifted cards fly above the others, then settle into their pile
    if (lifted.length) {
        liftedUntil = performance.now() + MOVE_MS;
        setTimeout(() => {
            if (performance.now() >= liftedUntil) {
                layout(true);
            }
        }, MOVE_MS + 20);
    }
}

function pressKey(event) {
    if ((event.ctrlKey || event.metaKey) && event.key !== 'z' || event.altKey || event.repeat) {
        return;
    }
    if (event.key === 'Escape') {
        $('menu-button').click();
    } else if (state === 'playing' && (event.key === 'z' || event.key === 'Backspace')) {
        undo();
    } else if (state === 'playing' && event.key === ' ') {
        event.preventDefault();
        if (!finishing) {
            draw();
        }
    }
}

function setUpEvents() {
    table.addEventListener('click', event => {
        const card = event.target.closest('.card');
        if (card) {
            tapCard(Number(card.dataset.id));
        } else if (event.target.closest('.slot.stock') && state === 'playing' && !finishing) {
            draw();
        }
    });
    $('undo').addEventListener('click', undo);
    $('start').addEventListener('click', () => startGame(false));
    $('new-deal').addEventListener('click', () => {
        forgetGame();
        startGame(true);
    });
    for (const button of document.querySelectorAll('.mode')) {
        button.addEventListener('click', () => {
            solitaireSettings.draw = Number(button.dataset.draw);
            remember('solitaire-settings', solitaireSettings);
            showIntro();
        });
    }
    new ResizeObserver(() => layout(false)).observe(table);
    document.addEventListener('keydown', pressKey);
}

Sound.setTune('patience');
makeTable();
setUpEvents();
setUpGame({
    screens: ['intro', 'table'],
    newGame,
    resume() {
        layout(false);
        checkEnd();
    },
    leaderboardUrl: () => '/api/leaderboard/solitaire-' + solitaireSettings.draw,
    leaderboardTitle: () => 'Games won · ' + MODES[solitaireSettings.draw]
});
