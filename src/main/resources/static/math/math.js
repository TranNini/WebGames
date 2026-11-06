// What the score changes. seconds: the time for a sum. plusMinus: the highest number in a + or -. timesDivide: the highest
// factor in a x or /, 0 for none yet. No answer is 100 or more, and none is below zero or a fraction.
const LEVELS = [
    {from: 0, seconds: 9, plusMinus: 10, timesDivide: 0},
    {from: 6, seconds: 8, plusMinus: 20, timesDivide: 0},
    {from: 11, seconds: 8, plusMinus: 20, timesDivide: 5},
    {from: 21, seconds: 7, plusMinus: 50, timesDivide: 9},
    {from: 41, seconds: 6.5, plusMinus: 99, timesDivide: 9},
    {from: 61, seconds: 6, plusMinus: 99, timesDivide: 9},
    {from: 81, seconds: 5.5, plusMinus: 99, timesDivide: 9},
    {from: 101, seconds: 5, plusMinus: 99, timesDivide: 9},
    {from: 151, seconds: 4.5, plusMinus: 99, timesDivide: 9}
];
const NEXT_SHOWN = 2;
const FIRST_READ_MS = 80; // after lifting the pen: enough for a right answer to go on
const LAST_READ_MS = 150; // and then it counts as what was meant: a second stroke of a digit comes sooner than this
const MISSING_DIGIT_MS = 300; // a next digit may take longer
const WRONG_SHOWN_MS = 80;
const TIME_UP_SHOWN_MS = 1100;
const LOW_TIME = 0.25;
const SMALLEST_STROKE = 0.02; // shorter than this share of the pad, it is a slip and not writing

// Without a touch screen the answers are typed, and there is nothing to write on
const typing = navigator.maxTouchPoints === 0;
const pad = $('pad');
const paint = pad.getContext('2d');
let sum = null;
let nextSums = [];
let timeLeft = 0;
let timeTotal = 0;
let strokes = [];
let drawingPointer = null;
let sinceLifted = 0;
let readFirst = false;
let wrongLeft = 0;
let timeUpLeft = 0;
let typed = '';
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
    nextSums = [];
    sum = null;
    state = 'playing';
    $('hint').hidden = false;
    showScreen('sums');
    nextSum();
    goOn();
}

function goOn() {
    drawingPointer = null;
    fitPad();
    lastFrame = performance.now();
    requestAnimationFrame(frame);
}

function level() {
    return LEVELS.findLast(level => score >= level.from);
}

function between(lowest, highest) {
    return lowest + Math.floor(Math.random() * (highest - lowest + 1));
}

function newSum() {
    const {plusMinus, timesDivide} = level();
    const kinds = timesDivide ? ['+', '-', '×', '÷'] : ['+', '-'];
    const kind = kinds[between(0, kinds.length - 1)];
    if (kind === '+') {
        const answer = between(2, plusMinus);
        const first = between(1, answer - 1);
        return {text: first + ' + ' + (answer - first), answer};
    }
    if (kind === '-') {
        const first = between(2, plusMinus);
        const second = between(1, first - 1);
        return {text: first + ' - ' + second, answer: first - second};
    }
    const one = between(2, timesDivide);
    const other = between(2, timesDivide);
    return kind === '×'
        ? {text: one + ' × ' + other, answer: one * other}
        : {text: one * other + ' ÷ ' + one, answer: other};
}

function differentSum(others) {
    let found = newSum();
    while (others.some(other => other.text === found.text)) {
        found = newSum();
    }
    return found;
}

function nextSum() {
    while (nextSums.length < NEXT_SHOWN + 1) {
        nextSums.push(differentSum(sum ? [sum, ...nextSums] : nextSums));
    }
    sum = nextSums.shift();
    timeTotal = level().seconds * 1000;
    timeLeft = timeTotal;
    timeUpLeft = 0;
    clearWriting();
    showSum();
}

function showSum() {
    $('now').textContent = sum.text;
    showAnswer('?');
    $('answer').className = 'answer';
    $('next').replaceChildren(...nextSums.slice(0, NEXT_SHOWN).map(next => {
        const line = document.createElement('div');
        line.textContent = next.text;
        return line;
    }));
}

function showAnswer(text) {
    $('answer').textContent = '= ' + text;
}

function clearWriting() {
    strokes = [];
    typed = '';
    drawingPointer = null;
    readFirst = false;
    sinceLifted = 0;
    wrongLeft = 0;
    drawWriting();
}

function frame(now) {
    if (state !== 'playing') {
        return;
    }
    const passed = Math.min(now - lastFrame, 100); // a long gap (the page was hidden) doesn't count
    lastFrame = now;
    if (timeUpLeft > 0) {
        timeUpLeft -= passed;
        if (timeUpLeft <= 0) {
            nextSum();
        }
    } else {
        timeLeft -= passed;
        readWhatWasWritten(passed);
        if (state === 'playing' && timeLeft <= 0) {
            timeIsUp();
        }
    }
    showTime();
    if (state === 'playing') {
        requestAnimationFrame(frame);
    }
}

function showTime() {
    const left = Math.max(0, timeLeft / timeTotal);
    $('time-left').style.transform = 'scaleX(' + left + ')';
    $('time-left').classList.toggle('low', left < LOW_TIME);
}

function readWhatWasWritten(passed) {
    if (wrongLeft > 0) {
        wrongLeft -= passed;
        if (wrongLeft <= 0) {
            startOver();
        }
        return;
    }
    if (strokes.length === 0 || drawingPointer !== null) {
        return;
    }
    sinceLifted += passed;
    if (sinceLifted < FIRST_READ_MS) {
        return;
    }
    const expected = String(sum.answer);
    const written = Digits.read(strokes, expected);
    if (!readFirst) {
        readFirst = true;
        showAnswer(written);
    }
    if (written === expected) {
        rightAnswer();
    } else if (sinceLifted >= (written.length < expected.length ? MISSING_DIGIT_MS : LAST_READ_MS)) {
        wrongAnswer(written);
    }
}

function rightAnswer() {
    score++;
    Sound.setMusicSpeed(Math.min(score / LEVELS.at(-1).from, 1));
    Sound.tap(score % 8);
    showScore();
    nextSum();
    $('score').classList.remove('right');
    void $('score').offsetWidth; // so that the flash starts again
    $('score').classList.add('right');
}

// Not a strike, as it could be a digit read wrong: it costs the time, and the player can write it again
function wrongAnswer(written) {
    showAnswer(written);
    $('answer').className = 'answer wrong';
    wrongLeft = WRONG_SHOWN_MS;
    drawWriting();
}

function timeIsUp() {
    strikes++;
    showScore();
    Sound.miss();
    clearWriting();
    showAnswer(sum.answer);
    $('answer').className = 'answer wrong';
    if (strikes >= MAX_STRIKES) {
        finishGame('Time ran out on ' + sum.text + ' = ' + sum.answer);
    } else {
        timeUpLeft = TIME_UP_SHOWN_MS;
    }
}

function fitPad() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.round(pad.clientWidth * ratio);
    const height = Math.round(pad.clientHeight * ratio);
    if (width > 0 && height > 0 && (pad.width !== width || pad.height !== height)) {
        pad.width = width;
        pad.height = height;
    }
    drawWriting();
}

function drawWriting() {
    const ratio = pad.clientWidth ? pad.width / pad.clientWidth : 1;
    paint.setTransform(ratio, 0, 0, ratio, 0, 0);
    paint.clearRect(0, 0, pad.clientWidth, pad.clientHeight);
    paint.strokeStyle = cssColor(wrongLeft > 0 ? '--red' : '--text');
    paint.lineWidth = Math.max(5, Math.min(pad.clientWidth, pad.clientHeight) * 0.022);
    paint.lineCap = 'round';
    paint.lineJoin = 'round';
    for (const stroke of strokes) {
        paint.beginPath();
        paint.moveTo(stroke[0].x, stroke[0].y);
        stroke.forEach(point => paint.lineTo(point.x, point.y));
        // A dot too
        paint.lineTo(stroke.at(-1).x + 0.01, stroke.at(-1).y);
        paint.stroke();
    }
}

function pointOn(event) {
    const box = pad.getBoundingClientRect();
    return {x: event.clientX - box.left, y: event.clientY - box.top};
}

function strokeLength(stroke) {
    let length = 0;
    for (let i = 1; i < stroke.length; i++) {
        length += Math.hypot(stroke[i].x - stroke[i - 1].x, stroke[i].y - stroke[i - 1].y);
    }
    return length;
}

function liftPen() {
    const stroke = strokes.at(-1);
    drawingPointer = null;
    if (strokeLength(stroke) < Math.min(pad.clientWidth, pad.clientHeight) * SMALLEST_STROKE) {
        strokes.pop();
        drawWriting();
    }
    readFirst = false;
    sinceLifted = 0;
}

function canType() {
    return state === 'playing' && timeUpLeft <= 0;
}

function startOver() {
    clearWriting();
    showAnswer('?');
    $('answer').className = 'answer';
}

function typeDigit(digit) {
    if (wrongLeft > 0) {
        startOver();
    }
    const expected = String(sum.answer);
    typed += digit;
    showAnswer(typed);
    if (typed === expected) {
        rightAnswer();
    } else if (typed.length >= expected.length) {
        wrongAnswer(typed);
    }
}

function eraseDigit() {
    if (wrongLeft <= 0 && typed) {
        typed = typed.slice(0, -1);
        showAnswer(typed || '?');
    }
}

function pressKey(event) {
    if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) {
        return;
    }
    // The number pad also with Num Lock off, when its keys say they are arrows
    const digit = /^Numpad[0-9]$/.test(event.code) ? event.code.at(-1) : event.key;
    if (event.key === 'Escape') {
        $('menu-button').click();
    } else if (canType() && /^[0-9]$/.test(digit)) {
        typeDigit(digit);
    } else if (canType() && event.key === 'Backspace') {
        eraseDigit();
    } else if (canType() && event.key === 'Enter' && typed && wrongLeft <= 0) {
        wrongAnswer(typed); // a right one has already gone on
    } else if (event.key === 'Enter' && $('menu').hidden && event.target.tagName !== 'BUTTON' && event.target.tagName !== 'A') {
        // From the first screen into a game, and from its end to the first screen
        if (state === 'intro') {
            startGame();
        } else if (state === 'over') {
            $('again').click();
        }
    }
}

function setUpEvents() {
    $('start').addEventListener('click', startGame);
    new ResizeObserver(() => {
        if (state === 'playing' || state === 'ending') {
            fitPad();
        }
    }).observe(pad);

    // One finger or pen writes; a hand resting on the screen beside it doesn't
    pad.addEventListener('pointerdown', event => {
        event.preventDefault();
        if (state !== 'playing' || timeUpLeft > 0 || drawingPointer !== null) {
            return;
        }
        if (wrongLeft > 0) {
            startOver();
        }
        pad.setPointerCapture(event.pointerId);
        $('hint').hidden = true;
        drawingPointer = event.pointerId;
        strokes.push([pointOn(event)]);
        drawWriting();
    });
    pad.addEventListener('pointermove', event => {
        if (event.pointerId !== drawingPointer) {
            return;
        }
        const points = event.getCoalescedEvents ? event.getCoalescedEvents() : [];
        for (const point of points.length ? points : [event]) {
            strokes.at(-1).push(pointOn(point));
        }
        drawWriting();
    });
    for (const ending of ['pointerup', 'pointercancel']) {
        pad.addEventListener(ending, event => {
            if (event.pointerId === drawingPointer) {
                liftPen();
            }
        });
    }
    document.addEventListener('keydown', pressKey);
}

Sound.setTune('think');
if (typing) {
    $('sums').classList.add('typing');
    $('how').textContent = 'Solve the sum and type the answer. The next sum comes right away. If the time runs out three times, the game ends. Enter starts, Esc pauses.';
}
setUpEvents();
setUpGame({
    screens: ['intro', 'sums'],
    newGame,
    resume: goOn,
    leaderboardUrl: () => '/api/leaderboard/math',
    leaderboardTitle: () => 'Leaderboard'
});
