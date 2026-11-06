const COLORS = [
    {name: 'Purple', hex: '#bf5fe0'},
    {name: 'Pink', hex: '#ffc2ec'},
    {name: 'Sky', hex: '#c2e6ff'},
    {name: 'Rose', hex: '#ff9696'},
    {name: 'Mint', hex: '#c2ffe1'},
    {name: 'Lemon', hex: '#fff7c2'},
    {name: 'Peach', hex: '#ffdac2'},
    {name: 'Periwinkle', hex: '#9691f2'}
];
// colors: which ones the mode uses; the easier modes get those that are easiest to tell apart.
const MODES = {
    easy: {
        label: 'Easy',
        colors: ['Sky', 'Rose', 'Mint', 'Lemon']
    },
    medium: {
        label: 'Medium',
        colors: ['Sky', 'Rose', 'Mint', 'Lemon', 'Periwinkle', 'Pink']
    },
    hard: {
        label: 'Hard',
        colors: COLORS.map(color => color.name)
    }
};
// What the score changes. from: the score this starts at. lit: how many fields are always lit, the mission color
// included; as soon as one goes another comes. lifeMs: how long a field takes to run out.
const LEVELS = [
    {from: 0, lit: 2, lifeMs: 2000},
    {from: 16, lit: 2, lifeMs: 1825},
    {from: 25, lit: 3, lifeMs: 1825},
    {from: 46, lit: 3, lifeMs: 1650},
    {from: 60, lit: 4, lifeMs: 1650},
    {from: 86, lit: 4, lifeMs: 1475},
    {from: 100, lit: 5, lifeMs: 1475},
    {from: 116, lit: 5, lifeMs: 1300},
    {from: 136, lit: 6, lifeMs: 1300}
];
const FIRST_FIELD_MS = 600;
const MISSION_CHANCE = 0.2; // how often a new field has the color not to tap
const FIELD_REST_MS = 250;  // an emptied field stays empty this long, so a new color is seen as new

const reflexSettings = {mode: 'medium', lastMission: '', ...remembered('reflex-settings')};
const fields = [...document.querySelectorAll('.field')].map((el, index) => ({
    el, index, fill: el.firstElementChild, color: null, life: 0, left: 0, rest: 0
}));

// The color not to tap, in the top bar during a game
const missionReminder = document.createElement('div');
missionReminder.className = 'mission-reminder';
missionReminder.setAttribute('role', 'img');
document.querySelector('.bar').append(missionReminder);

let mission = null;
let untilFirstField = 0;
let lastFrame = 0;

function mode() {
    return MODES[reflexSettings.mode];
}

function modeColors() {
    return COLORS.filter(color => mode().colors.includes(color.name));
}

function leaderboardUrl() {
    return '/api/leaderboard/reflex-' + reflexSettings.mode;
}

function showModes() {
    for (const button of document.querySelectorAll('.mode')) {
        button.setAttribute('aria-pressed', String(button.dataset.mode === reflexSettings.mode));
    }
}

// Every game gets another color than the last one
function newMission() {
    const others = modeColors().filter(color => color.name !== reflexSettings.lastMission);
    mission = others[Math.floor(Math.random() * others.length)];
    reflexSettings.lastMission = mission.name;
    remember('reflex-settings', reflexSettings);

    state = 'mission';
    score = 0;
    strikes = 0;
    showScore();
    $('mission-color').style.background = mission.hex;
    $('mission-color').setAttribute('aria-label', mission.name);
    $('mission-name').textContent = mission.name;
    $('mission-name').style.setProperty('--mission', mission.hex);
    missionReminder.style.background = mission.hex;
    missionReminder.setAttribute('aria-label', 'Don\'t tap ' + mission.name);
    showModes();
    showScreen('mission');
}

function startGame() {
    Sound.unlock();
    Sound.start();
    Sound.setMusicSpeed(0);
    Sound.startMusic();
    fields.forEach(clearField);
    fields.forEach(field => field.el.classList.remove('fatal'));
    untilFirstField = FIRST_FIELD_MS;
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

function level() {
    return LEVELS.findLast(level => score >= level.from);
}


function randomColor() {
    // At most half of what is lit, so from two fields on there is always one to tap
    const missionFields = fields.filter(field => field.color === mission).length;
    if (missionFields < Math.ceil(level().lit / 2) && Math.random() < MISSION_CHANCE) {
        return mission;
    }
    const others = modeColors().filter(color => color !== mission);
    return others[Math.floor(Math.random() * others.length)];
}

function lightField() {
    const empty = fields.filter(field => !field.color);
    const rested = empty.filter(field => field.rest === 0);
    const free = rested.length > 0 ? rested : empty; // the next field doesn't wait for one to rest
    if (free.length === 0) {
        return;
    }
    const field = free[Math.floor(Math.random() * free.length)];
    field.color = randomColor();
    field.life = level().lifeMs;
    field.left = field.life;
    field.fill.style.background = field.color.hex;
    field.fill.style.transform = 'scaleY(1)';
    field.el.setAttribute('aria-label', field.color.name);
}

function frame(now) {
    if (state !== 'playing') {
        return;
    }
    const passed = Math.min(now - lastFrame, 100); // a long gap (the page was hidden) doesn't count
    lastFrame = now;

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

    untilFirstField -= passed;
    if (untilFirstField <= 0 && fields.filter(field => field.color).length < level().lit) {
        lightField();
    }
    requestAnimationFrame(frame);
}

function addStrike(field) {
    strikes++;
    showScore();
    field.el.animate({backgroundColor: [cssColor('--red'), cssColor('--field')]}, 320);
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
    Sound.setMusicSpeed(Math.min(score / LEVELS.at(-1).from, 1));
    showScore();
    field.el.animate({backgroundColor: [color, cssColor('--field')]}, 180);
    Sound.tap(field.index);
}

// tappedColor: the mission color when that ended the game, otherwise null (three misses)
function endGame(tappedColor) {
    finishGame(tappedColor ? 'You tapped ' + tappedColor.name : 'Three missed', tappedColor && tappedColor.hex);
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
    for (const button of document.querySelectorAll('.mode')) {
        button.addEventListener('click', () => {
            if (button.dataset.mode !== reflexSettings.mode) {
                reflexSettings.mode = button.dataset.mode;
                newMission();
            }
        });
    }
    $('start').addEventListener('click', startGame);
}

setUpEvents();
setUpGame({
    screens: ['mission', 'board'],
    newGame: newMission,
    resume() {
        lastFrame = performance.now();
        requestAnimationFrame(frame);
    },
    leaderboardUrl,
    leaderboardTitle: () => 'Leaderboard · ' + mode().label
});
