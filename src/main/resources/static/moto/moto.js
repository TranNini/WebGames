// Moto Race: a race on motorcycles against friends, each on their own phone with their own view from behind their bike.
// The phones meet through the server (/api/race, Races.java): one opens a race, the others join it from the list, the one
// who opened it picks the course and starts. A course goes from a start to a goal, like a trip together. Each phone rides
// its own bike (track.js) and sends where it is 15 times a second; the others' bikes are worked out to now from their last
// message, smoothly. The server keeps the order at the goal, by its own clock, and puts the times on the course's leaderboard.
// The one who opened the race can add computer riders (Track.computer): their phone rides them along with their own bike
// and sends where they are too; if they leave, the next person's phone takes them over. The course and the computer
// riders each have a level: easy, medium or hard (things on the road; how fast and sharp the computer riders are).
const SEND_SECONDS = 1 / 15;
const ON_THE_WAY_MS = 40; // about how long a message takes from the server to a phone
const motoSettings = {track: 'seaside', computers: 0, courseLevel: 'easy', computerLevel: 'medium', steeredBefore: false,
    ...remembered('moto-settings')};
const LEVELS = ['easy', 'medium', 'hard'];
const LEVEL_NAMES = {easy: 'Easy', medium: 'Medium', hard: 'Hard'};
const COURSE_ABOUT = {
    easy: 'A clear road',
    medium: 'Something on the road now and then',
    hard: 'Lots on the road'
};
// The leaderboard of a course at a level (the easy one has the course's own name)
const boardOf = (track, level) => 'moto-' + track + (level && level !== 'easy' ? '-' + level : '');
const MAX_RIDERS = 6;

let socket = null;
let me = 0;
let retryMs = 1000;
let retryTimer = 0;
let openRaces = [];
let room = null; // the race this phone is in, as the server last sent it
let race = null; // while riding: the own bike, the others, the countdown
let results = null;
let lastFrame = 0;
const pointers = new Map(); // finger id: 'left' or 'right'
const keys = new Set();

// --- The connection ---

function connect() {
    clearTimeout(retryTimer);
    if (socket) {
        return;
    }
    showStatus(openRaces.length ? '' : 'Connecting…');
    try {
        socket = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/api/race');
    } catch (e) {
        socket = null;
        retryLater();
        return;
    }
    const own = socket;
    own.addEventListener('open', () => {
        retryMs = 1000;
        send({t: 'hello', name: Player.name()});
        showStatus('');
        renderLobby();
    });
    own.addEventListener('message', event => {
        let message;
        try {
            message = JSON.parse(event.data);
        } catch (e) {
            return;
        }
        receive(message);
    });
    own.addEventListener('close', () => {
        if (socket !== own) {
            return;
        }
        socket = null;
        lostConnection();
        retryLater();
    });
}

function retryLater() {
    showStatus('The race server can\'t be reached. Trying again…');
    renderLobby();
    if (!document.hidden) {
        retryTimer = setTimeout(connect, retryMs);
        retryMs = Math.min(10000, retryMs * 2);
    }
}

function connected() {
    return socket && socket.readyState === WebSocket.OPEN;
}

function send(message) {
    if (connected()) {
        socket.send(JSON.stringify(message));
    }
}

// Riding or waiting in a race: that race is gone for this phone
function lostConnection() {
    if (room) {
        room = null;
        endRide();
        showLobby();
        showStatus('The connection was lost, so you left the race.');
    }
}

function receive(message) {
    switch (message.t) {
        case 'welcome':
            me = message.you;
            break;
        case 'rooms':
            openRaces = message.rooms;
            renderLobby();
            break;
        case 'room':
            gotRoom(message);
            break;
        case 'start':
            startRide(message);
            break;
        case 'bikes':
            gotBikes(message.b);
            break;
        case 'finished':
            if (race) {
                race.finished.set(message.id, {place: message.place, time: message.time});
                const computer = race.computers.find(each => each.id === message.id);
                if (computer) {
                    computer.done = true;
                }
                if (message.id === me) {
                    showFinish(message.place, message.time);
                }
            }
            break;
        case 'results':
            showResults(message);
            break;
        case 'left':
            race?.others.delete(message.id);
            break;
        case 'error':
            showStatus(message.text);
            break;
        default:
    }
}

function gotRoom(message) {
    const first = !room;
    room = message;
    if (message.phase === 'lobby') {
        if (first || $('room').hidden) {
            showRoom();
        }
        renderRoom();
    } else if (message.phase === 'results') {
        renderResultButtons();
    }
    if (race) {
        for (const rider of message.riders) {
            const other = race.others.get(rider.id);
            if (other) {
                other.name = rider.name;
            }
        }
        if (isHost()) {
            takeOverComputers();
        }
    }
}

// The host who rode the computer riders left: this phone rides them on from where they were last seen
function takeOverComputers() {
    for (const rider of room.riders) {
        const other = rider.computer && race.others.get(rider.id);
        if (other) {
            const bike = Track.newBike(0);
            Object.assign(bike, {z: other.z ?? other.last.z, x: other.x ?? other.last.x, speed: other.last.speed});
            race.computers.push(newComputer(rider, bike, race.computers.length));
            race.others.delete(rider.id);
        }
    }
}

function newComputer(rider, bike, index) {
    return {
        id: rider.id, name: rider.name, color: rider.color, bike,
        brain: {...Track.COMPUTERS[index % Track.COMPUTERS.length], level: Track.COMPUTER_LEVELS[room.computerLevel]},
        done: race.finished.has(rider.id), braking: false, sentGuess: false
    };
}

// --- Screens ---

function showStatus(text) {
    $('status').textContent = text;
    $('status').hidden = !text;
}

function setScreen(id) {
    state = id === 'race' ? 'playing' : 'lobby';
    if (!$('menu').hidden) {
        resetMenuButton();
    }
    showScreen(id);
}

function showLobby() {
    setScreen('lobby');
    renderLobby();
}

function renderLobby() {
    $('new-race').disabled = !connected();
    const list = $('races');
    if (!openRaces.length) {
        const empty = document.createElement('p');
        empty.className = 'empty';
        empty.textContent = connected() ? 'No races waiting. Open one, and your friends see it here.' : '';
        list.replaceChildren(empty);
        return;
    }
    list.replaceChildren(...openRaces.map(open => {
        const button = document.createElement('button');
        button.className = 'race-choice';
        const who = document.createElement('span');
        who.className = 'race-host';
        who.textContent = open.host;
        const what = document.createElement('small');
        what.textContent = Track.TRACKS[open.track].name + (open.courseLevel !== 'easy' ? ' (' + LEVEL_NAMES[open.courseLevel] + ')' : '')
            + ' · ' + open.riders + (open.riders === 1 ? ' rider' : ' riders')
            + (open.computers ? ' · ' + open.computers + ' computer' : '');
        who.append(what);
        const join = document.createElement('b');
        join.textContent = 'Join';
        button.append(who, join);
        button.addEventListener('click', () => {
            Sound.unlock();
            send({t: 'join', code: open.code});
        });
        return button;
    }));
}

function showRoom() {
    results = null;
    showStatus('');
    setScreen('room');
}

const isHost = () => room && room.host === me;
const hostName = () => (room.riders.find(rider => rider.id === room.host) || {name: ''}).name;

function renderRoom() {
    if (!room) {
        return;
    }
    $('room-title').textContent = isHost() ? 'Your race' : hostName() + '’s race';
    $('tracks').replaceChildren(...Object.entries(Track.TRACKS).map(([key, track]) => {
        const button = document.createElement('button');
        button.className = 'track-choice ' + key;
        button.setAttribute('aria-pressed', String(room.track === key));
        button.disabled = !isHost();
        const name = document.createElement('span');
        name.textContent = track.name;
        const about = document.createElement('small');
        about.textContent = track.about;
        button.append(name, about);
        button.addEventListener('click', () => {
            motoSettings.track = key;
            remember('moto-settings', motoSettings);
            send({t: 'track', track: key});
        });
        return button;
    }));
    $('rider-count').textContent = room.riders.length + ' of ' + MAX_RIDERS;
    $('riders').replaceChildren(...room.riders.map(rider => riderRow(rider, rider.id === room.host ? 'opened it' : '')));
    renderLevels();
    renderComputers();
    const people = room.riders.filter(rider => !rider.computer).length;
    $('start').hidden = !isHost();
    $('start').textContent = room.riders.length > 1 ? 'Start race' : 'Ride alone';
    $('room-note').textContent = isHost()
        ? (people > 1 ? 'Start when everyone is in.' : 'Friends can join from Moto Race on their phones until you start.')
        : 'Waiting for ' + hostName() + ' to start the race.';
}

// Easy, medium, hard: for the course and for the computer riders. The host chooses; the others see what was chosen.
function levelButtons(element, chosen, choose) {
    element.replaceChildren(...LEVELS.map(level => {
        const button = document.createElement('button');
        button.className = 'level-choice';
        button.textContent = LEVEL_NAMES[level];
        button.setAttribute('aria-pressed', String(chosen === level));
        button.disabled = !isHost();
        button.addEventListener('click', () => choose(level));
        return button;
    }));
}

function renderLevels() {
    levelButtons($('course-level'), room.courseLevel, level => {
        motoSettings.courseLevel = level;
        remember('moto-settings', motoSettings);
        send({t: 'level', of: 'course', level});
    });
    const own = Track.TRACKS[room.track].levels;
    $('course-about').textContent = (own && own[room.courseLevel] && own[room.courseLevel].about) || COURSE_ABOUT[room.courseLevel];
    levelButtons($('computer-level'), room.computerLevel, level => {
        motoSettings.computerLevel = level;
        remember('moto-settings', motoSettings);
        send({t: 'level', of: 'computers', level});
    });
    $('computer-level-row').hidden = !room.riders.some(rider => rider.computer);
}

// How many computer riders: the host chooses, from none to as many as fit next to the people
function renderComputers() {
    const count = room.riders.filter(rider => rider.computer).length;
    const most = MAX_RIDERS - room.riders.filter(rider => !rider.computer).length;
    $('computers').hidden = !isHost();
    $('computer-count').textContent = count === 0 ? 'None' : String(count);
    $('fewer-computers').disabled = count === 0;
    $('more-computers').disabled = count >= most;
}

function chooseComputers(change) {
    const count = room.riders.filter(rider => rider.computer).length + change;
    motoSettings.computers = Math.max(0, Math.min(MAX_RIDERS - 1, count));
    remember('moto-settings', motoSettings);
    send({t: 'computers', count: motoSettings.computers});
}

function riderRow(rider, extra, time) {
    const row = document.createElement('li');
    row.className = rider.id === me ? 'rider mine' : 'rider';
    const dot = document.createElement('span');
    dot.className = 'rider-dot';
    dot.style.background = Scene.RIDER_COLORS[rider.color];
    const name = document.createElement('span');
    name.className = 'rider-name';
    name.textContent = rider.name + (rider.id === me ? ' (you)' : '');
    row.append(dot, name);
    if (rider.computer && !extra) {
        extra = 'computer';
    }
    if (extra !== undefined && extra !== '') {
        const small = document.createElement('small');
        small.textContent = extra;
        row.append(small);
    }
    if (time !== undefined) {
        const right = document.createElement('b');
        right.textContent = time;
        row.append(right);
    }
    return row;
}

// --- Riding ---

function startRide(message) {
    const now = performance.now();
    const track = Track.build(message.track, message.level);
    const others = new Map();
    const computers = [];
    race = {finished: new Map()};
    message.grid.forEach((id, place) => {
        if (id !== me) {
            const rider = room.riders.find(each => each.id === id) || {name: 'Rider', color: 0};
            const bike = Track.newBike(place);
            if (rider.computer && isHost()) {
                computers.push(newComputer(rider, bike, computers.length));
            } else {
                others.set(id, {name: rider.name, color: rider.color, last: {at: now, z: bike.z, x: bike.x, speed: 0}, lean: 0});
            }
        }
    });
    const own = room.riders.find(rider => rider.id === me) || {color: 0};
    race = {
        track,
        startAt: now + message.in,
        bike: Track.newBike(message.grid.indexOf(me)),
        color: own.color,
        others,
        computers,
        finished: race.finished,
        sentAt: 0,
        shownCount: null,
        done: false
    };
    pointers.clear();
    $('finish-note').hidden = true;
    $('steer-hint').hidden = motoSettings.steeredBefore;
    setScreen('race');
    Scene.resize();
    $('trip').replaceChildren();
    showTrip([]);
}

function endRide() {
    race = null;
    Sound.setEngine(null);
    Sound.stopMusic();
}

function gotBikes(bikes) {
    if (!race) {
        return;
    }
    const now = performance.now();
    for (const [id, z, x, speed, age] of bikes) {
        const other = race.others.get(id);
        if (other) {
            // age: since the server got it; the way from the server here is guessed
            other.last = {at: now - age - ON_THE_WAY_MS, z, x, speed};
        }
    }
}

// Where another bike is now: where its last message had it, ridden on at its speed since. The drawn bike eases toward
// that, so a late message doesn't make it jump.
function follow(other, now, seconds) {
    const last = other.last;
    const age = Math.min(700, Math.max(0, now - last.at)) / 1000;
    const z = last.z + last.speed * age;
    if (other.z === undefined || Math.abs(z - other.z) > 40) {
        other.z = z;
        other.x = last.x;
    }
    const before = other.x;
    other.z += last.speed * seconds;
    other.z += (z - other.z) * Math.min(1, seconds * 6);
    other.x += (last.x - other.x) * Math.min(1, seconds * 10);
    const sideways = seconds > 0 ? (other.x - before) / seconds : 0;
    other.lean += (Math.max(-1, Math.min(1, sideways / 7)) * 0.42 - other.lean) * Math.min(1, seconds * 8);
    return {z: other.z, x: other.x, speed: last.speed};
}

function steering() {
    const sides = [...pointers.values()];
    const left = sides.includes('left') || keys.has('left');
    const right = sides.includes('right') || keys.has('right');
    const brake = (left && right && sides.length > 1) || keys.has('brake');
    return {steer: brake ? 0 : (right ? 1 : 0) - (left ? 1 : 0), brake, gas: true};
}

const ORDINALS = ['1st', '2nd', '3rd', '4th', '5th', '6th'];

function formatTime(ms) {
    const tenths = Math.round(ms / 100);
    const minutes = Math.floor(tenths / 600);
    const seconds = (tenths % 600) / 10;
    return minutes + ':' + seconds.toFixed(1).padStart(4, '0');
}

function frame(now) {
    requestAnimationFrame(frame);
    const seconds = Math.min(0.05, Math.max(0, (now - lastFrame) / 1000));
    lastFrame = now;
    if (!race) {
        return;
    }
    const {bike, track} = race;
    const riding = now >= race.startAt;
    showCountdown(now);

    const others = [];
    for (const [id, other] of race.others) {
        const place = follow(other, now, seconds);
        others.push({id, ...place, air: Track.airOf(race.track, place.z, place.x, place.speed), lean: other.lean,
            color: Scene.RIDER_COLORS[other.color], name: other.name, braking: false});
    }
    rideComputers(now >= race.startAt, others, seconds);
    for (const computer of race.computers) {
        const {bike: own} = computer;
        others.push({id: computer.id, z: own.z, x: own.x, speed: own.speed, air: own.air, lean: own.steer * 0.42,
            color: Scene.RIDER_COLORS[computer.color], name: computer.name, braking: computer.braking});
    }

    let input = {steer: 0, brake: false, gas: false};
    if (riding && !race.done) {
        input = state === 'playing' ? steering() : input;
        if (input.steer && !motoSettings.steeredBefore) {
            motoSettings.steeredBefore = true;
            remember('moto-settings', motoSettings);
        }
        const before = Track.segmentAt(track, bike.z);
        const happened = Track.ride(bike, track, input, others, seconds);
        if (happened === 'crash') {
            Sound.miss();
            navigator.vibrate?.(150);
        } else if (happened === 'scrape') {
            Sound.miss();
        } else if (happened === 'bump') {
            Sound.tap(0);
        } else if (happened === 'jump') {
            Sound.tap(3);
        } else if (happened === 'land') {
            Sound.tap(0);
        }
        race.turned = before.bend * bike.speed * seconds * 0.9;
        if (bike.z >= track.length) {
            race.done = true;
            send({t: 'finish'});
            Sound.start();
            showFinish(null, null);
        }
    } else if (race.done) {
        Track.cruise(bike, track, seconds);
        race.turned = Track.segmentAt(track, bike.z).bend * bike.speed * seconds * 0.9;
    } else {
        race.turned = 0;
    }
    if (!$('steer-hint').hidden && (motoSettings.steeredBefore || now > race.startAt + 6000)) {
        $('steer-hint').hidden = true;
    }

    if (now - race.sentAt >= SEND_SECONDS * 1000) {
        race.sentAt = now;
        const message = {t: 'pos', z: +bike.z.toFixed(2), x: +bike.x.toFixed(2), v: +bike.speed.toFixed(2)};
        if (race.computers.length) {
            message.computers = race.computers.map(({id, bike: own}) => [id, +own.z.toFixed(2), +own.x.toFixed(2), +own.speed.toFixed(2)]);
        }
        send(message);
    }
    Sound.setEngine(riding || bike.speed > 0 ? bike.speed / Track.TOP_SPEED : 0);
    Sound.setMusicSpeed(bike.speed / Track.TOP_SPEED);

    showTrip(others);
    showStandings(others);
    $('speed-number').textContent = Math.round(bike.speed * 3.6);
    Scene.draw({track, bike, others, color: race.color, braking: input.brake, turned: race.turned || 0});
}

// The computer riders this phone rides: like a bike, with Track.computer steering. Each keeps near the people riding.
// When all the people are at the goal, those still on the way are given their time at the speed they have.
function rideComputers(riding, people, seconds) {
    const humans = [race.bike, ...people.filter(other => !room.riders.some(rider => rider.id === other.id && rider.computer))];
    const peopleIn = room.riders.every(rider => rider.computer || race.finished.has(rider.id));
    for (const computer of race.computers) {
        const {bike} = computer;
        const around = [race.bike, ...people, ...race.computers.filter(other => other !== computer).map(other => other.bike)];
        if (computer.done) {
            Track.cruise(bike, race.track, seconds);
            computer.braking = false;
        } else if (riding) {
            const nearest = humans.reduce((best, human) => Math.abs(human.z - bike.z) < Math.abs(best.z - bike.z) ? human : best);
            const pace = Math.max(-1, Math.min(1, (nearest.z - bike.z) / 200));
            const input = Track.computer(bike, race.track, around, computer.brain, pace, seconds);
            Track.ride(bike, race.track, input, around, seconds);
            computer.braking = input.brake;
            if (bike.z >= race.track.length) {
                computer.done = true;
                send({t: 'finish', id: computer.id});
            } else if (peopleIn && !computer.sentGuess) {
                computer.sentGuess = true;
                const rest = (race.track.length - bike.z) / Math.max(20, bike.speed) * 1000;
                send({t: 'finish', id: computer.id, rest: Math.round(Math.min(120000, rest))});
            }
        }
    }
}

function showCountdown(now) {
    const left = race.startAt - now;
    let shown = '';
    if (left > 0 && left <= 3000) {
        shown = String(Math.ceil(left / 1000));
    } else if (left <= 0 && left > -900) {
        shown = 'GO!';
    }
    if (shown !== race.shownCount) {
        race.shownCount = shown;
        $('countdown').textContent = shown;
        $('countdown').hidden = !shown;
        if (shown === 'GO!') {
            Sound.start();
            if (state === 'playing') {
                Sound.startMusic();
            }
        } else if (shown) {
            Sound.tap(2);
        }
    }
}

// How far to the goal, in the bar, and everyone on a line from the start to the goal
function showTrip(others) {
    const length = race.track.length;
    const left = Math.max(0, length - Math.max(0, race.bike.z));
    const text = race.done ? 'Goal' : left >= 1000 ? (left / 1000).toFixed(1) + ' km' : Math.ceil(left / 10) * 10 + ' m';
    if ($('lap').dataset.shown !== text) {
        $('lap').dataset.shown = text;
        $('lap').replaceChildren(text);
        if (!race.done) {
            $('lap').append(Object.assign(document.createElement('small'), {textContent: ' to go'}));
        }
    }
    const riders = [{id: me, color: race.color, z: race.bike.z}, ...others.map(other => ({
        id: other.id, color: colorOf(other.id), z: other.z
    }))];
    const line = $('trip');
    for (const rider of riders) {
        let dot = line.querySelector(`[data-id="${rider.id}"]`);
        if (!dot) {
            dot = Object.assign(document.createElement('span'), {className: rider.id === me ? 'trip-dot mine' : 'trip-dot'});
            dot.dataset.id = rider.id;
            dot.style.background = Scene.RIDER_COLORS[rider.color];
            line.append(dot);
        }
        dot.style.left = (Math.max(0, Math.min(1, rider.z / length)) * 100).toFixed(2) + '%';
    }
    for (const dot of line.querySelectorAll('.trip-dot')) {
        if (!riders.some(rider => String(rider.id) === dot.dataset.id)) {
            dot.remove();
        }
    }
}

function colorOf(id) {
    const other = race.others.get(id) || race.computers.find(computer => computer.id === id);
    return other ? other.color : 0;
}

// The places now: who has finished in their order, then the others by how far they are
function standings(others) {
    const list = [{id: me, name: Player.name(), color: race.color, z: race.bike.z}, ...others.map(other => ({
        id: other.id, name: other.name, color: colorOf(other.id), z: other.z
    }))];
    const finishedPlace = rider => (race.finished.get(rider.id) || {place: 99}).place;
    list.sort((a, b) => finishedPlace(a) - finishedPlace(b) || b.z - a.z);
    return list;
}

function showStandings(others) {
    const list = standings(others);
    const place = list.findIndex(rider => rider.id === me);
    score = place + 1;
    $('score').textContent = list.length > 1 ? ORDINALS[place] : '';
    $('standings').hidden = list.length < 2;
    const text = list.map(rider => rider.id + ':' + rider.name).join('|');
    if ($('standings').dataset.shown !== text) {
        $('standings').dataset.shown = text;
        $('standings').replaceChildren(...list.map(rider => riderRow(rider)));
    }
}

function showFinish(place, time) {
    $('finish-note').hidden = false;
    const count = race ? race.others.size + race.computers.length + 1 : 1;
    if (place) {
        $('finish-place').textContent = count > 1 ? (place === 1 ? 'You won!' : ORDINALS[place - 1] + ' place') : 'Finished!';
        $('finish-time').textContent = formatTime(time);
    } else {
        $('finish-place').textContent = 'Finished!';
        $('finish-time').textContent = '';
    }
    $('finish-wait').hidden = count < 2;
}

// --- After the race ---

function showResults(message) {
    const ownPlace = message.results.find(result => result.id === me);
    endRide();
    results = message;
    const alone = message.results.length === 1;
    if (!ownPlace || ownPlace.time === null) {
        $('results-title').textContent = 'Out of time';
    } else if (alone) {
        $('results-title').textContent = formatTime(ownPlace.time);
    } else {
        $('results-title').textContent = ownPlace.place === 1 ? 'You won!' : 'You came ' + ORDINALS[ownPlace.place - 1];
    }
    $('places').replaceChildren(...message.results.map(result => {
        const row = riderRow(result, '', result.time === null ? 'didn’t finish' : formatTime(result.time));
        row.prepend(Object.assign(document.createElement('b'), {className: 'rider-place', textContent: result.place}));
        return row;
    }));
    $('fastest-title').textContent = 'Fastest · ' + Track.TRACKS[message.track].name
        + (message.level !== 'easy' ? ' (' + LEVEL_NAMES[message.level] + ')' : '');
    $('fastest').replaceChildren();
    $('fastest-note').hidden = true;
    loadFastest(boardOf(message.track, message.level));
    renderResultButtons();
    setScreen('results');
}

function renderResultButtons() {
    if (!room) {
        return;
    }
    $('again-race').hidden = !isHost();
    $('results-note').textContent = isHost() || room.riders.length < 2 ? '' : 'Waiting for ' + hostName() + ' to race again.';
}

async function loadFastest(board) {
    let list = null;
    try {
        const response = await fetch('/api/leaderboard/' + board, {signal: AbortSignal.timeout(5000)});
        if (response.ok) {
            list = await response.json();
        }
    } catch (e) {
        list = null;
    }
    if (!results || boardOf(results.track, results.level) !== board) {
        return;
    }
    if (list === null) {
        $('fastest-note').textContent = 'The leaderboard can\'t be reached right now.';
        $('fastest-note').hidden = false;
        return;
    }
    const name = Player.name().toLowerCase();
    const own = list.find(entry => entry.name.toLowerCase() === name);
    const rows = [];
    list.forEach((entry, index) => {
        if (index < 5 || entry === own) {
            if (index > 5 && entry === own) {
                rows.push(Object.assign(document.createElement('div'), {className: 'dots', textContent: '...'}));
            }
            const row = entryRow(entry, entry === own);
            row.lastChild.textContent = formatTime(entry.score * 100);
            rows.push(row);
        }
    });
    $('fastest').replaceChildren(...rows);
    if (!list.length) {
        $('fastest-note').textContent = 'No times yet.';
        $('fastest-note').hidden = false;
    }
}

// --- Input ---

function setUpEvents() {
    $('new-race').addEventListener('click', () => {
        Sound.unlock();
        send({t: 'create', track: motoSettings.track in Track.TRACKS ? motoSettings.track : 'seaside', computers: motoSettings.computers,
            courseLevel: motoSettings.courseLevel, computerLevel: motoSettings.computerLevel});
    });
    $('start').addEventListener('click', () => {
        Sound.unlock();
        send({t: 'start'});
    });
    $('fewer-computers').addEventListener('click', () => chooseComputers(-1));
    $('more-computers').addEventListener('click', () => chooseComputers(1));
    $('leave').addEventListener('click', leaveRace);
    $('leave-results').addEventListener('click', leaveRace);
    $('again-race').addEventListener('click', () => send({t: 'again'}));

    const area = $('race');
    const side = event => (event.clientX < area.clientWidth / 2 ? 'left' : 'right');
    area.addEventListener('pointerdown', event => {
        Sound.unlock();
        pointers.set(event.pointerId, side(event));
    });
    area.addEventListener('pointermove', event => {
        if (pointers.has(event.pointerId)) {
            pointers.set(event.pointerId, side(event));
        }
    });
    for (const type of ['pointerup', 'pointercancel', 'pointerleave']) {
        area.addEventListener(type, event => pointers.delete(event.pointerId));
    }
    const KEYS = {ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right', ArrowDown: 'brake', s: 'brake', ' ': 'brake'};
    document.addEventListener('keydown', event => {
        if (KEYS[event.key] && race) {
            keys.add(KEYS[event.key]);
            event.preventDefault();
        }
    });
    document.addEventListener('keyup', event => keys.delete(KEYS[event.key]));
    window.addEventListener('blur', () => keys.clear());
}

// The race goes on while the menu is open: say so, and Restart leaves the race. After setUpGame, so it comes after the
// menu's own wording.
function setUpMenuForRace() {
    const menuForRace = () => {
        if (state === 'paused' && race) {
            $('menu-title').textContent = 'The race goes on';
            $('resume').textContent = 'Back to the race';
            $('restart').textContent = 'Leave race';
        }
    };
    $('menu-button').addEventListener('click', menuForRace);
    document.addEventListener('visibilitychange', () => {
        menuForRace();
        if (!document.hidden && !socket) {
            retryMs = 1000;
            connect();
        }
    });
}

function leaveRace() {
    send({t: 'leave'});
    room = null;
    results = null;
    endRide();
    showLobby();
}

// The bar: the way to the goal where other games have their X's, the place in the middle
function setUpBar() {
    const lap = document.createElement('div');
    lap.id = 'lap';
    lap.className = 'lap';
    document.querySelector('.bar').prepend(lap);
}

Sound.setTune('throttle');
setUpBar();
Scene.setUp($('canvas'));
setUpEvents();
setUpGame({
    screens: ['lobby', 'room', 'race', 'results'],
    newGame() {
        if (room) {
            leaveRace();
        } else {
            showLobby();
        }
        connect();
    },
    resume() {
        pointers.clear();
    },
    leaderboardUrl: () => '/api/leaderboard/' + (room ? boardOf(room.track, room.courseLevel) : 'moto-seaside'),
    leaderboardTitle: () => 'Fastest'
});
setUpMenuForRace();
requestAnimationFrame(frame);
