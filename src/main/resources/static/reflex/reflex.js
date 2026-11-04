const COLORS = [
    {name: 'Lilac', hex: '#f4c2ff'},
    {name: 'Pink', hex: '#ffc2ec'},
    {name: 'Sky', hex: '#c2e6ff'},
    {name: 'Rose', hex: '#ff9696'},
    {name: 'Mint', hex: '#c2ffe1'},
    {name: 'Lemon', hex: '#fff7c2'},
    {name: 'Peach', hex: '#ffdac2'},
    {name: 'Periwinkle', hex: '#9691f2'}
];
const MAX_STRIKES = 3;
const MAX_ENTRIES = 20;
const API = '/api/leaderboard/reflex';

// The game gets harder the longer it lasts: fields fade faster and appear more often.
// Half of the way from slowest to fastest after about 40 seconds.
const RAMP_MS = 60000;
const SLOWEST_LIFE_MS = 2000;
const FASTEST_LIFE_MS = 600;
const SLOWEST_GAP_MS = 1100;
const FASTEST_GAP_MS = 280;
const MISSION_CHANCE = 0.2; // how often a new field has the color not to tap
const FIELD_REST_MS = 250;  // an emptied field stays empty this long, so a new color is seen as new

const $ = id => document.getElementById(id);

const sideways = matchMedia('(orientation: landscape)');

const settings = {vibration: true, sound: 70, music: 40, name: '', lastMission: ''};
const fields = [...document.querySelectorAll('.field')].map((el, index) => ({
    el, index, fill: el.firstElementChild, color: null, life: 0, left: 0, rest: 0
}));

let state = 'mission'; // mission, playing, paused, over
let screenBehindMenu = null;
let mission = null;
let score = 0;
let strikes = 0;
let elapsed = 0;
let untilNextField = 0;
let lastFrame = 0;

// Leaderboard on the game over screen
let entries = null; // null: couldn't be loaded
let saved = false;
let warnedAboutLeaving = false;
const nameForm = document.createElement('form');
const nameInput = document.createElement('input');

// Settings stay on the device. Storage can fail (private mode); the game then just doesn't remember them.
function loadSettings() {
    try {
        Object.assign(settings, JSON.parse(localStorage.getItem('reflex-settings')) || {});
    } catch (e) {
        // keep the defaults
    }
}

function saveSettings() {
    try {
        localStorage.setItem('reflex-settings', JSON.stringify(settings));
    } catch (e) {
        // not remembered
    }
}

function vibrate(pattern) {
    if (!settings.vibration) {
        return;
    }
    if (navigator.vibrate) {
        navigator.vibrate(pattern);
    } else {
        $('haptic').click();
    }
}

function vibrateGameOver() {
    vibrate([200, 100, 300]);
    // The iPhone may only give its haptic tap when a finger lets go, so also on the finger still on the screen
    if (!navigator.vibrate) {
        document.addEventListener('touchend', () => vibrate(0), {once: true, signal: AbortSignal.timeout(1000)});
    }
}

// Sideways the game takes the whole screen. Browsers only allow that from a tap, so it starts with the first
// tap after turning. Not on the game over screen: iPad Safari warns about typing a name in full screen.
// Safari on the iPhone has no full screen for pages at all; there it takes Add to Home Screen.
function enterFullscreen() {
    const page = document.documentElement;
    const enter = page.requestFullscreen || page.webkitRequestFullscreen;
    if (enter && sideways.matches && state !== 'over' && !fullscreenElement()) {
        Promise.resolve(enter.call(page)).catch(() => {});
    }
}

function leaveFullscreen() {
    const exit = document.exitFullscreen || document.webkitExitFullscreen;
    if (exit && fullscreenElement()) {
        Promise.resolve(exit.call(document)).catch(() => {});
    }
}

function fullscreenElement() {
    return document.fullscreenElement || document.webkitFullscreenElement;
}

function showScreen(screen) {
    for (const id of ['mission', 'board', 'menu', 'over']) {
        $(id).hidden = id !== screen;
    }
}

function showScore() {
    $('score').textContent = score;
    [...$('strikes').children].forEach((x, i) => x.classList.toggle('on', i < strikes));
    $('strikes').setAttribute('aria-label', strikes + ' of ' + MAX_STRIKES + ' strikes');
}

// Every game gets another color than the last one
function newMission() {
    const others = COLORS.filter(color => color.name !== settings.lastMission);
    mission = others[Math.floor(Math.random() * others.length)];
    settings.lastMission = mission.name;
    saveSettings();

    state = 'mission';
    score = 0;
    strikes = 0;
    showScore();
    $('mission-color').style.background = mission.hex;
    $('mission-color').setAttribute('aria-label', mission.name);
    $('mission-name').textContent = mission.name;
    $('mission-name').style.color = mission.hex;
    showScreen('mission');
}

function startGame() {
    Sound.unlock();
    Sound.start();
    Sound.setMusicSpeed(0);
    Sound.startMusic();
    fields.forEach(clearField);
    fields.forEach(field => field.el.classList.remove('fatal'));
    elapsed = 0;
    untilNextField = 600;
    state = 'playing';
    showScreen('board');
    lastFrame = performance.now();
    requestAnimationFrame(frame);
}

function clearField(field) {
    field.color = null;
    field.rest = FIELD_REST_MS;
    field.fill.style.transform = 'scaleY(0)';
    field.el.setAttribute('aria-label', 'Empty field');
}

function difficulty() {
    return 1 - Math.exp(-elapsed / RAMP_MS);
}

function randomColor() {
    if (Math.random() < MISSION_CHANCE) {
        return mission;
    }
    const others = COLORS.filter(color => color !== mission);
    return others[Math.floor(Math.random() * others.length)];
}

function lightField() {
    const free = fields.filter(field => !field.color && field.rest === 0);
    if (free.length === 0) {
        untilNextField = 50;
        return;
    }
    const field = free[Math.floor(Math.random() * free.length)];
    const hard = difficulty();
    field.color = randomColor();
    field.life = SLOWEST_LIFE_MS + (FASTEST_LIFE_MS - SLOWEST_LIFE_MS) * hard;
    field.left = field.life;
    field.fill.style.background = field.color.hex;
    field.fill.style.transform = 'scaleY(1)';
    field.el.setAttribute('aria-label', field.color.name);
    // Random times: somewhere between 65% and 135% of the current gap
    const gap = SLOWEST_GAP_MS + (FASTEST_GAP_MS - SLOWEST_GAP_MS) * hard;
    untilNextField = gap * (0.65 + Math.random() * 0.7);
}

function frame(now) {
    if (state !== 'playing') {
        return;
    }
    const passed = Math.min(now - lastFrame, 100); // a long gap (the page was hidden) doesn't count
    lastFrame = now;
    elapsed += passed;
    Sound.setMusicSpeed(difficulty());

    for (const field of fields) {
        if (!field.color) {
            field.rest = Math.max(0, field.rest - passed);
            continue;
        }
        field.left -= passed;
        if (field.left > 0) {
            field.fill.style.transform = 'scaleY(' + field.left / field.life + ')';
            continue;
        }
        const missed = field.color !== mission;
        clearField(field);
        if (missed) {
            addStrike(field);
            if (state !== 'playing') {
                return;
            }
        }
    }

    untilNextField -= passed;
    if (untilNextField <= 0) {
        lightField();
    }
    requestAnimationFrame(frame);
}

function addStrike(field) {
    strikes++;
    showScore();
    field.el.animate({backgroundColor: ['#ff5a5a', '#26252e']}, 320);
    Sound.miss();
    if (strikes >= MAX_STRIKES) {
        endGame(null);
    }
}

function tapField(field) {
    if (state !== 'playing' || !field.color) {
        return;
    }
    if (field.color === mission) {
        field.el.classList.add('fatal');
        endGame(mission);
        return;
    }
    const color = field.color.hex;
    clearField(field);
    score++;
    showScore();
    field.el.animate({backgroundColor: [color, '#26252e']}, 180);
    Sound.tap(field.index);
}

// tappedColor: the mission color when that ended the game, otherwise null (three misses)
async function endGame(tappedColor) {
    state = 'ending';
    Sound.stopMusic();
    Sound.gameOver();
    vibrateGameOver();
    // A moment to see what happened, and fingers still tapping don't press a button on the next screen
    const moment = new Promise(resolve => setTimeout(resolve, 700));
    await Promise.all([moment, loadLeaderboard()]);

    $('reason').textContent = tappedColor ? 'You tapped ' + tappedColor.name : 'Three missed';
    $('reason-color').hidden = !tappedColor;
    if (tappedColor) {
        $('reason-color').style.background = tappedColor.hex;
    }
    saved = false;
    warnedAboutLeaving = false;
    nameInput.value = settings.name;
    renderLeaderboard();
    state = 'over';
    showScreen('over');
}

async function loadLeaderboard() {
    try {
        const response = await fetch(API, {signal: AbortSignal.timeout(5000)});
        if (!response.ok) {
            throw new Error(response.status);
        }
        entries = await response.json();
    } catch (e) {
        entries = null;
    }
}

function sameName(a, b) {
    return a.trim().toLowerCase() === b.trim().toLowerCase();
}

// Where this name is after this game. Same rules as the server (Leaderboard.java): a name is on the
// list once with its best score, of equal scores the older one ranks higher, and 20 places is all there is.
function place(name) {
    const list = entries || [];
    const own = name ? list.find(entry => sameName(entry.name, name)) : null;
    if (own && own.score >= score) {
        return {rank: own.rank, score: own.score, isOldBest: true};
    }
    const others = list.filter(entry => entry !== own);
    const rank = others.filter(entry => entry.score >= score).length + 1;
    return {rank, score, isOldBest: false, onList: score > 0 && rank <= MAX_ENTRIES};
}

// Top 3 + ... + own place. The own place is part of the top 3 when it is that high.
function renderLeaderboard() {
    const name = nameInput.value.trim();
    const mine = place(name);
    const list = entries || [];
    const typing = !saved && (mine.isOldBest || mine.onList);

    const ordered = typing ? list.filter(entry => !sameName(entry.name, name)) : [...list];
    if (typing) {
        ordered.splice(mine.rank - 1, 0, {score: mine.score, typing: true});
    }
    const ownIndex = ordered.findIndex(entry => entry.typing || (saved && sameName(entry.name, settings.name)));

    const rows = [];
    ordered.forEach((entry, index) => {
        if (index >= 3 && index !== ownIndex) {
            return;
        }
        if (index > 3) {
            rows.push(dotsRow());
        }
        rows.push(entryRow(index + 1, entry, index === ownIndex));
    });
    $('rows').replaceChildren(...rows);
    showNote(mine, list);
}

function entryRow(rank, entry, isOwn) {
    const row = document.createElement('div');
    row.className = isOwn ? 'entry mine' : 'entry';
    const rankCell = document.createElement('b');
    rankCell.textContent = rank;
    const nameCell = document.createElement('span');
    nameCell.className = 'name';
    nameCell.textContent = entry.name;
    const pointsCell = document.createElement('b');
    pointsCell.textContent = entry.score;
    row.append(rankCell, entry.typing ? nameForm : nameCell, pointsCell);
    return row;
}

function dotsRow() {
    const dots = document.createElement('div');
    dots.className = 'dots';
    dots.textContent = '...';
    return dots;
}

function showNote(mine, list) {
    let text = '';
    if (entries === null) {
        text = 'The leaderboard can\'t be reached right now.';
    } else if (!saved && mine.isOldBest && mine.score > score) {
        text = 'Your best stays at ' + mine.score + '.';
    } else if (!saved && !mine.isOldBest && !mine.onList && score > 0) {
        text = 'Beat ' + list[list.length - 1].score + ' to reach the top ' + MAX_ENTRIES + '.';
    } else if (list.length === 0 && score === 0) {
        text = 'No scores yet. Be the first!';
    }
    $('board-note').textContent = text;
    $('board-note').hidden = !text;
}

function setNote(text) {
    $('board-note').textContent = text;
    $('board-note').hidden = false;
}

// True when there's nothing left to save
async function saveScore(keepalive) {
    if (saved || entries === null) {
        return true;
    }
    const name = nameInput.value.trim();
    const mine = place(name);
    if (!name || mine.isOldBest || !mine.onList) {
        return !(mine.onList && !name);
    }
    settings.name = name;
    saveSettings();
    try {
        const response = await fetch(API, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({name, score}),
            keepalive: Boolean(keepalive)
        });
        if (!response.ok) {
            throw new Error(response.status);
        }
        entries = await response.json();
        saved = true;
        renderLeaderboard();
        return true;
    } catch (e) {
        setNote('Your score couldn\'t be saved. Check the connection and try again.');
        return false;
    }
}

// Before leaving the game over screen: saves the score. If that isn't possible (no name yet, no
// connection) it says so and stays, once; the second tap leaves anyway.
async function leaveGameOver(leave) {
    const done = await saveScore();
    if (done || warnedAboutLeaving) {
        leave();
        return;
    }
    warnedAboutLeaving = true;
    if (!nameInput.value.trim()) {
        setNote('Type a name to save your score, or tap again to go on without it.');
        nameInput.focus();
    }
}

// Set as an attribute: svg elements have no hidden property
function showMenuIcon(icon) {
    $('gear').toggleAttribute('hidden', icon !== 'gear');
    $('close').toggleAttribute('hidden', icon !== 'close');
}

function openMenu() {
    if (state === 'ending') {
        return;
    }
    Sound.unlock();
    screenBehindMenu = ['mission', 'board', 'over'].find(id => !$(id).hidden);
    if (state === 'playing') {
        state = 'paused';
    }
    const inGame = state === 'paused';
    $('menu-title').textContent = inGame ? 'Paused' : 'Settings';
    $('resume').textContent = inGame ? 'Resume' : 'Close';
    showMenuIcon('close');
    $('menu-button').setAttribute('aria-label', 'Close menu');
    showScreen('menu');
}

function closeMenu() {
    Sound.unlock();
    showMenuIcon('gear');
    $('menu-button').setAttribute('aria-label', 'Menu');
    showScreen(screenBehindMenu);
    if (state === 'paused') {
        state = 'playing';
        lastFrame = performance.now();
        requestAnimationFrame(frame);
    } else {
        Sound.stopMusic(); // it only played to try the music volume
    }
}

function setUpMenu() {
    $('vibration').checked = settings.vibration;
    $('sound').value = settings.sound;
    $('music').value = settings.music;
    Sound.setSoundVolume(settings.sound);
    Sound.setMusicVolume(settings.music);

    $('menu-button').addEventListener('click', () => ($('menu').hidden ? openMenu() : closeMenu()));
    $('resume').addEventListener('click', closeMenu);
    $('vibration').addEventListener('change', () => {
        settings.vibration = $('vibration').checked;
        saveSettings();
        vibrate(40);
    });
    $('sound').addEventListener('input', () => {
        settings.sound = Number($('sound').value);
        Sound.setSoundVolume(settings.sound);
        saveSettings();
    });
    // Let go of the slider: a tap to hear the volume
    $('sound').addEventListener('change', () => Sound.tap(4));
    $('music').addEventListener('input', () => {
        settings.music = Number($('music').value);
        Sound.setMusicVolume(settings.music);
        saveSettings();
        Sound.startMusic();
    });
}

function setUpNameForm() {
    nameInput.type = 'text';
    nameInput.maxLength = 16;
    nameInput.placeholder = 'Your name';
    nameInput.setAttribute('aria-label', 'Your name');
    nameInput.setAttribute('autocomplete', 'off');
    nameInput.setAttribute('autocapitalize', 'words');
    nameInput.setAttribute('autocorrect', 'off');
    nameInput.spellcheck = false;
    nameForm.append(nameInput);
    nameForm.addEventListener('submit', event => {
        event.preventDefault();
        nameInput.blur();
        saveScore();
    });
    nameInput.addEventListener('change', renderLeaderboard);
    nameInput.addEventListener('focus', leaveFullscreen);
}

function setUpEvents() {
    for (const field of fields) {
        // On touch, not on letting go: the fastest there is, and several fingers can tap at once
        field.el.addEventListener('pointerdown', event => {
            event.preventDefault();
            tapField(field);
        });
        // No pointer: the keyboard
        field.el.addEventListener('click', event => {
            if (event.detail === 0) {
                tapField(field);
            }
        });
    }
    $('start').addEventListener('click', startGame);
    $('again').addEventListener('click', () => leaveGameOver(newMission));
    $('back').addEventListener('click', event => {
        event.preventDefault();
        leaveGameOver(() => {
            location.href = '/';
        });
    });
    document.addEventListener('contextmenu', event => event.preventDefault());
    // Double tap and pinch zoom, which iOS allows whatever the page says
    document.addEventListener('gesturestart', event => event.preventDefault());

    // Phone locked or another app: the game waits in the menu, nothing is missed meanwhile
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            if (state === 'playing') {
                openMenu();
            }
            Sound.sleep();
        }
    });
    // iOS can stop sound on its own (a call, the page was hidden); the next tap brings it back
    document.addEventListener('pointerdown', () => Sound.unlock());
    document.addEventListener('touchend', () => Sound.unlock());
    document.addEventListener('touchend', enterFullscreen);
    document.addEventListener('click', enterFullscreen);
    sideways.addEventListener('change', () => {
        if (!sideways.matches) {
            leaveFullscreen();
        }
    });
    // Closing the app on the game over screen doesn't lose a score that has a name
    window.addEventListener('pagehide', () => {
        if (state === 'over' && !$('over').hidden) {
            saveScore(true);
        }
    });
}

loadSettings();
setUpMenu();
setUpNameForm();
setUpEvents();
newMission();
