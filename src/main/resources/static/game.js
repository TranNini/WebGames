// What the games share: the top bar, the settings menu, the leaderboard and the game over screen. A game loads this first,
// uses what is here and calls setUpGame. The state, score and strikes are the game's to change.
const MAX_STRIKES = 3;
const MAX_ENTRIES = 20;

const $ = id => document.getElementById(id);
const cssColor = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

const sideways = matchMedia('(orientation: landscape)');
// An iPad says it is a Mac, but a Mac has no touch screen
const isIphoneOrIpad = /iPhone|iPad|iPod/.test(navigator.userAgent)
    || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

const settings = {sound: 70, music: 40};

let game = null;
let state = ''; // the game's own first state, then playing, paused, ending, over
let score = 0;
let strikes = 0;
let screenBehindMenu = null;

// Leaderboard on the game over screen
let entries = null; // null: couldn't be loaded
let saved = false;
let warnedAboutLeaving = false;

const gameScreen = document.querySelector('.screen');
gameScreen.insertAdjacentHTML('afterbegin', `<header class="bar">
    <div id="strikes" class="strikes"><span>X</span><span>X</span><span>X</span></div>
    <div id="score" class="score">0</div>
    <button id="menu-button" class="icon-button" aria-label="Menu">
        <svg id="gear" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-2.82 1.17V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-2.82-1.17l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0-1.17-2.82H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.17-2.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 2.82-1.17V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 2.82 1.17l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0 1.17 2.82H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
        <svg id="close" viewBox="0 0 24 24" aria-hidden="true" hidden><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>
    </button>
</header>`);
gameScreen.insertAdjacentHTML('beforeend', `<section id="menu" class="menu" hidden>
    <h2 id="menu-title">Paused</h2>
    <label class="setting row">
        <span>Dark mode</span>
        <input id="dark-mode" type="checkbox" class="switch">
    </label>
    <label class="setting">
        <span>Sound volume</span>
        <input id="sound" type="range" min="0" max="100">
    </label>
    <label class="setting">
        <span>Music volume</span>
        <input id="music" type="range" min="0" max="100">
    </label>
    <button id="resume" class="button primary">Resume</button>
    <button id="restart" class="button" hidden>Restart</button>
    <a class="button" href="/">Back to games</a>
</section>
<main id="over" class="over" hidden>
    <div class="over-title">
        <h1 id="over-heading">Game over</h1>
        <div class="reason"><span id="reason-color" aria-hidden="true"></span><span id="reason"></span></div>
    </div>
    <section class="leaderboard">
        <h2 id="leaderboard-title">Leaderboard</h2>
        <div id="rows"></div>
        <p id="board-note" class="note" hidden></p>
    </section>
    <div class="over-buttons">
        <button id="again" class="button primary">Play again</button>
        <a id="back" class="button" href="/">Back to games</a>
    </div>
</main>`);

// Storage can fail (private mode); a game then just doesn't remember
function remembered(key) {
    try {
        return JSON.parse(localStorage.getItem(key)) || {};
    } catch (e) {
        return {};
    }
}

function remember(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
        // not remembered
    }
}

// The same for all games. Reflex Tap kept them itself before there was a second game.
function loadSettings() {
    const before = {...remembered('reflex-settings'), ...remembered('games-settings')};
    for (const key of Object.keys(settings)) {
        if (key in before) {
            settings[key] = before[key];
        }
    }
}

function saveSettings() {
    remember('games-settings', settings);
}

// Sideways the game takes the whole screen. Browsers only allow that from a tap, so it starts with the first
// tap after turning. On the iPhone and iPad it takes Add to Home Screen instead: the iPhone's Safari has no full
// screen for pages, and the iPad's takes quick tapping for typing on a fake keyboard and keeps warning about it.
function enterFullscreen() {
    const page = document.documentElement;
    const enter = page.requestFullscreen || page.webkitRequestFullscreen;
    if (enter && !isIphoneOrIpad && sideways.matches && !fullscreenElement()) {
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

function showScreen(shown) {
    for (const id of [...game.screens, 'menu', 'over']) {
        $(id).hidden = id !== shown;
    }
}

function showScore() {
    $('score').textContent = score;
    [...$('strikes').children].forEach((x, i) => x.classList.toggle('on', i < strikes));
    $('strikes').setAttribute('aria-label', strikes + ' of ' + MAX_STRIKES + ' strikes');
}

// reasonColor: a color to show with the reason, if any. won: the game was won (Solitaire), not lost.
async function finishGame(reason, reasonColor, won = false) {
    state = 'ending';
    Sound.stopMusic();
    if (won) {
        Sound.start();
    } else {
        Sound.gameOver();
    }
    $('over-heading').textContent = won ? 'You won!' : 'Game over';
    saved = false;
    warnedAboutLeaving = false;
    // A moment to see what happened, and fingers still tapping don't press a button on the next screen
    const moment = new Promise(resolve => setTimeout(resolve, 700));
    await Promise.all([moment, updateLeaderboard()]);

    $('reason').textContent = reason;
    $('reason-color').hidden = !reasonColor;
    if (reasonColor) {
        $('reason-color').style.background = reasonColor;
    }
    $('leaderboard-title').textContent = game.leaderboardTitle();
    renderLeaderboard();
    state = 'over';
    showScreen('over');
}

async function updateLeaderboard() {
    await saveScore();
    if (!saved) {
        await loadLeaderboard();
    }
}

async function loadLeaderboard() {
    try {
        const response = await fetch(game.leaderboardUrl(), {signal: AbortSignal.timeout(5000)});
        if (!response.ok) {
            throw new Error(response.status);
        }
        entries = await response.json();
    } catch (e) {
        entries = null;
    }
}

// The server decides what happens to the score (Leaderboard.java) and answers with the new list.
// True when there's nothing left to save.
async function saveScore(keepalive) {
    if (saved || score === 0) {
        return true;
    }
    try {
        const response = await fetch(game.leaderboardUrl(), {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({name: Player.name(), score}),
            keepalive: Boolean(keepalive),
            signal: AbortSignal.timeout(5000)
        });
        if (!response.ok) {
            throw new Error(response.status);
        }
        entries = await response.json();
        saved = true;
        return true;
    } catch (e) {
        return false;
    }
}

function ownEntry() {
    const name = Player.name().toLowerCase();
    return (entries || []).find(entry => entry.name.toLowerCase() === name);
}

// Top 3 + ... + own place. The own place is part of the top 3 when it is that high.
function renderLeaderboard() {
    const list = entries || [];
    const own = ownEntry();
    const rows = [];
    list.forEach((entry, index) => {
        if (index >= 3 && entry !== own) {
            return;
        }
        if (index > 3) {
            rows.push(dotsRow());
        }
        rows.push(entryRow(entry, entry === own));
    });
    $('rows').replaceChildren(...rows);
    showNote(own, list);
}

function entryRow(entry, isOwn) {
    const row = document.createElement('div');
    row.className = isOwn ? 'entry mine' : 'entry';
    const rankCell = document.createElement('b');
    rankCell.textContent = entry.rank;
    const nameCell = document.createElement('span');
    nameCell.className = 'name';
    nameCell.textContent = entry.name;
    const pointsCell = document.createElement('b');
    pointsCell.textContent = shownScore(entry.score);
    row.append(rankCell, nameCell, pointsCell);
    return row;
}

function dotsRow() {
    const dots = document.createElement('div');
    dots.className = 'dots';
    dots.textContent = '...';
    return dots;
}

// A game can show its scores its own way (Mahjong: as a time)
function shownScore(value) {
    return game.formatScore ? game.formatScore(value) : value;
}

// A game whose score is a time wants it low (lowerIsBetter)
function better(a, b) {
    return game.lowerIsBetter ? a < b : a > b;
}

function showNote(own, list) {
    let text = '';
    if (score > 0 && !saved) {
        text = 'Your score couldn\'t be saved. Check the connection and try again.';
    } else if (entries === null) {
        text = 'The leaderboard can\'t be reached right now.';
    } else if (score > 0 && own && better(own.score, score)) {
        text = 'Your best stays at ' + shownScore(own.score) + '.';
    } else if (score > 0 && !own) {
        text = 'Beat ' + shownScore(list[list.length - 1].score) + ' to reach the top ' + MAX_ENTRIES + '.';
    } else if (list.length === 0) {
        text = 'No scores yet. Be the first!';
    }
    $('board-note').textContent = text;
    $('board-note').hidden = !text;
}

// Before leaving the game over screen: tries once more if the score couldn't be saved. If that fails too
// it stays, once; the second tap leaves anyway.
async function leaveGameOver(leave) {
    const done = await saveScore();
    if (done || warnedAboutLeaving) {
        leave();
        return;
    }
    warnedAboutLeaving = true;
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
    screenBehindMenu = [...game.screens, 'over'].find(id => !$(id).hidden);
    if (state === 'playing') {
        state = 'paused';
        Sound.stopMusic();
    }
    const inGame = state === 'paused';
    $('menu-title').textContent = inGame ? 'Paused' : 'Settings';
    $('resume').textContent = inGame ? 'Resume' : 'Close';
    $('restart').hidden = !inGame;
    showMenuIcon('close');
    $('menu-button').setAttribute('aria-label', 'Close menu');
    showScreen('menu');
}

function resetMenuButton() {
    showMenuIcon('gear');
    $('menu-button').setAttribute('aria-label', 'Menu');
}

// Gives up this game, like leaving it does: the score isn't saved
function restartGame() {
    Sound.unlock();
    Sound.stopMusic();
    resetMenuButton();
    game.newGame();
}

function closeMenu() {
    Sound.unlock();
    resetMenuButton();
    showScreen(screenBehindMenu);
    if (state === 'paused') {
        state = 'playing';
        game.resume();
        Sound.startMusic();
    } else {
        Sound.stopMusic(); // it only played to try the music volume
    }
}

function setUpMenu() {
    $('dark-mode').checked = Theme.current() === 'dark';
    $('sound').value = settings.sound;
    $('music').value = settings.music;
    Sound.setSoundVolume(settings.sound);
    Sound.setMusicVolume(settings.music);

    $('menu-button').addEventListener('click', () => ($('menu').hidden ? openMenu() : closeMenu()));
    $('resume').addEventListener('click', closeMenu);
    $('restart').addEventListener('click', restartGame);
    $('dark-mode').addEventListener('change', () => Theme.set($('dark-mode').checked ? 'dark' : 'light'));
    window.addEventListener('pageshow', () => {
        $('dark-mode').checked = Theme.current() === 'dark'; // after theme.js, also when the page comes back as it was
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

function setUpShellEvents() {
    $('again').addEventListener('click', () => leaveGameOver(game.newGame));
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
    // Closing the app on the game over screen tries once more to save a score that couldn't be saved
    window.addEventListener('pagehide', () => {
        if (state === 'over' && !$('over').hidden) {
            saveScore(true);
        }
    });
}

// screens: the ids of the game's own screens. newGame: back to its first screen. resume: goes on after the menu.
// leaderboardUrl, leaderboardTitle: functions, as a game may have several lists. formatScore (optional): how a score is shown.
// lowerIsBetter (optional): the score is a time, and the server's list has the fastest first (Leaderboard.TIMES).
function setUpGame(theGame) {
    game = theGame;
    loadSettings();
    setUpMenu();
    setUpShellEvents();
    game.newGame();
}
