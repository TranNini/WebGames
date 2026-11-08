// All sounds are made in the browser (Web Audio), so there are no sound files.
// Browsers only allow sound after a tap: call unlock() from a tap handler.
const Sound = (() => {
    const NOTES = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51]; // one for each field
    // The music: bars of a bass note + eight notes in Hz (null: a rest). wave and noteLoudness: the sound of those notes.
    // bassEvery: a bass note every so many notes. beat: a drum under it.
    const TUNES = {
        calm: {
            slowBpm: 112,
            fastBpm: 150,
            wave: 'triangle',
            noteSeconds: 0.2,
            noteLoudness: 0.35,
            bassEvery: 4,
            bassSeconds: 0.5,
            bars: [
                {bass: 110, notes: [220, 261.63, 329.63, 440, 329.63, 261.63, 220, 261.63]},
                {bass: 87.31, notes: [174.61, 220, 261.63, 349.23, 261.63, 220, 174.61, 220]},
                {bass: 130.81, notes: [196, 261.63, 329.63, 392, 329.63, 261.63, 196, 261.63]},
                {bass: 98, notes: [196, 246.94, 293.66, 392, 293.66, 246.94, 196, 246.94]}
            ]
        },
        // Lane Dodge: quicker, with a bass that keeps driving. Four bars of arpeggio, then the same chords with a tune.
        road: {
            slowBpm: 132,
            fastBpm: 176,
            wave: 'square',
            noteSeconds: 0.12,
            noteLoudness: 0.13,
            bassEvery: 2,
            bassSeconds: 0.22,
            bars: [
                {bass: 82.41, notes: [329.63, 493.88, 392, 493.88, 659.25, 493.88, 392, 493.88]},
                {bass: 130.81, notes: [329.63, 523.25, 392, 523.25, 659.25, 523.25, 392, 523.25]},
                {bass: 98, notes: [293.66, 493.88, 392, 493.88, 587.33, 493.88, 392, 493.88]},
                {bass: 146.83, notes: [369.99, 440, 587.33, 440, 369.99, 440, 587.33, 659.25]},
                {bass: 82.41, notes: [659.25, null, 493.88, 392, 659.25, null, 587.33, 493.88]},
                {bass: 130.81, notes: [523.25, null, 392, 329.63, 523.25, 587.33, 659.25, null]},
                {bass: 98, notes: [493.88, null, 392, 293.66, 493.88, 523.25, 587.33, null]},
                {bass: 146.83, notes: [440, null, 369.99, 293.66, 440, 493.88, 587.33, null]}
            ]
        },
        // Scribble Math: slow, soft and bright like a music box, with room between the notes to think
        think: {
            slowBpm: 92,
            fastBpm: 116,
            wave: 'sine',
            noteSeconds: 0.5,
            noteLoudness: 0.4,
            bassEvery: 8,
            bassSeconds: 1.2,
            bars: [
                {bass: 130.81, notes: [523.25, null, 659.25, 783.99, null, 659.25, 523.25, null]},
                {bass: 110, notes: [440, null, 523.25, 659.25, null, 880, 659.25, null]},
                {bass: 87.31, notes: [440, null, 523.25, 698.46, null, 880, 698.46, null]},
                {bass: 98, notes: [493.88, null, 587.33, 783.99, 587.33, null, 493.88, null]},
                {bass: 130.81, notes: [783.99, null, 659.25, null, 783.99, 880, 783.99, null]},
                {bass: 110, notes: [659.25, null, 523.25, null, 659.25, 783.99, 659.25, null]},
                {bass: 87.31, notes: [698.46, 659.25, 587.33, null, 523.25, 587.33, 659.25, null]},
                {bass: 98, notes: [587.33, null, 493.88, null, 392, null, 493.88, 587.33]}
            ]
        },
        // Solitaire: no hurry, like a quiet lounge in F. Soft rolling chords (Fmaj7, Dm7, Bbmaj7, C7), then a slow tune over them.
        // The same speed all the way, as there is no clock.
        patience: {
            slowBpm: 80,
            fastBpm: 80,
            wave: 'triangle',
            noteSeconds: 0.7,
            noteLoudness: 0.28,
            bassEvery: 4,
            bassSeconds: 1.4,
            bars: [
                {bass: 174.61, notes: [349.23, 440, 523.25, 659.25, null, 523.25, 440, null]},
                {bass: 146.83, notes: [293.66, 349.23, 440, 523.25, null, 440, 349.23, null]},
                {bass: 116.54, notes: [349.23, 440, 587.33, 440, null, 349.23, 293.66, null]},
                {bass: 130.81, notes: [392, 466.16, 523.25, 659.25, null, 587.33, 523.25, null]},
                {bass: 174.61, notes: [698.46, null, 659.25, 523.25, null, 440, 523.25, null]},
                {bass: 146.83, notes: [587.33, null, 523.25, 440, null, 349.23, 440, null]},
                {bass: 116.54, notes: [587.33, null, 698.46, 587.33, 466.16, null, 440, null]},
                {bass: 130.81, notes: [392, null, 440, 466.16, 523.25, null, null, null]}
            ]
        },
        // Mahjong: a slow walk through a tea garden. Wind chime notes in D major's five-note scale, ringing long over a low bass.
        // The same speed all the way, as there is no clock.
        garden: {
            slowBpm: 70,
            fastBpm: 70,
            wave: 'sine',
            noteSeconds: 0.9,
            noteLoudness: 0.34,
            bassEvery: 4,
            bassSeconds: 1.6,
            bars: [
                {bass: 146.83, notes: [587.33, null, 739.99, null, 880, 739.99, 587.33, null]},
                {bass: 123.47, notes: [493.88, null, 587.33, 739.99, null, 587.33, 493.88, null]},
                {bass: 98, notes: [440, null, 493.88, 587.33, null, 659.25, 587.33, null]},
                {bass: 110, notes: [659.25, null, 587.33, 493.88, 440, null, 329.63, null]},
                {bass: 146.83, notes: [880, null, 987.77, 880, null, 739.99, 659.25, null]},
                {bass: 123.47, notes: [739.99, null, 659.25, 587.33, null, 493.88, 587.33, null]},
                {bass: 98, notes: [493.88, 587.33, 659.25, null, 739.99, null, 659.25, null]},
                {bass: 110, notes: [587.33, null, null, 440, 493.88, null, 587.33, null]}
            ]
        },
        // Mission: Meow: action, but cute. A steady beat and a bouncing bass under high, bright notes. The same speed all the way.
        mission: {
            slowBpm: 160,
            fastBpm: 160,
            wave: 'triangle',
            noteSeconds: 0.16,
            noteLoudness: 0.26,
            bassEvery: 2,
            bassSeconds: 0.17,
            beat: true,
            bars: [
                {bass: 146.83, notes: [587.33, 698.46, 880, 698.46, 1174.66, 880, 698.46, 880]},
                {bass: 116.54, notes: [587.33, 698.46, 932.33, 698.46, 1174.66, 932.33, 698.46, 932.33]},
                {bass: 174.61, notes: [523.25, 698.46, 880, 698.46, 1046.5, 880, 698.46, 880]},
                {bass: 130.81, notes: [523.25, 659.25, 783.99, 659.25, 1046.5, 783.99, 659.25, 587.33]},
                {bass: 146.83, notes: [1174.66, null, 880, 1046.5, 1174.66, 1396.91, 1174.66, null]},
                {bass: 116.54, notes: [1174.66, 1046.5, 932.33, null, 880, 932.33, 1046.5, null]},
                {bass: 174.61, notes: [1046.5, 880, 1046.5, 1174.66, 1396.91, null, 1174.66, 1046.5]},
                {bass: 110, notes: [880, null, 1108.73, null, 1318.51, 1108.73, 880, 659.25]}
            ]
        }
    };

    let ctx = null;
    let soundGain = null;
    let musicGain = null;
    let soundLevel = 0;
    let musicLevel = 0;
    let tune = TUNES.calm;
    let musicTimer = null;
    let nextNoteAt = 0;
    let step = 0;
    let speed = 0;

    function unlock() {
        if (!ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) {
                return;
            }
            // Mix with what else is playing on the iPhone (music, a podcast) instead of stopping it
            if (navigator.audioSession) {
                navigator.audioSession.type = 'ambient';
            }
            ctx = new AudioContext();
            soundGain = ctx.createGain();
            musicGain = ctx.createGain();
            soundGain.connect(ctx.destination);
            musicGain.connect(ctx.destination);
            setSoundVolume(soundLevel);
            setMusicVolume(musicLevel);
        }
        if (ctx.state !== 'running') {
            ctx.resume().catch(() => {});
        }
    }

    // 0 to 100. Squared, as ears hear loudness that way: the middle of the slider sounds like the middle
    function setSoundVolume(level) {
        soundLevel = level;
        if (ctx) {
            soundGain.gain.value = (level / 100) ** 2;
        }
    }

    function setMusicVolume(level) {
        musicLevel = level;
        if (ctx) {
            musicGain.gain.value = (level / 100) ** 2 * 0.5;
        }
    }

    function tone(output, type, frequency, at, seconds, loudness, endFrequency) {
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency, at);
        if (endFrequency) {
            oscillator.frequency.exponentialRampToValueAtTime(endFrequency, at + seconds);
        }
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.exponentialRampToValueAtTime(loudness, at + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + seconds);
        oscillator.connect(gain).connect(output);
        oscillator.start(at);
        oscillator.stop(at + seconds + 0.02);
    }

    function play(makeTones) {
        if (ctx) {
            makeTones(ctx.currentTime);
        }
    }

    function tap(field) {
        play(now => tone(soundGain, 'triangle', NOTES[field], now, 0.13, 0.6));
    }

    function warn() {
        play(now => {
            tone(soundGain, 'square', 880, now, 0.09, 0.22);
            tone(soundGain, 'square', 660, now + 0.13, 0.12, 0.22);
        });
    }

    function siren() {
        play(now => {
            tone(soundGain, 'sawtooth', 560, now, 0.26, 0.14, 860);
            tone(soundGain, 'sawtooth', 860, now + 0.28, 0.26, 0.14, 560);
        });
    }

    function meow() {
        play(now => {
            tone(soundGain, 'triangle', 640, now, 0.13, 0.5, 980);
            tone(soundGain, 'triangle', 980, now + 0.11, 0.2, 0.42, 560);
        });
    }

    function miss() {
        play(now => tone(soundGain, 'square', 196, now, 0.28, 0.3, 98));
    }

    function start() {
        play(now => [523.25, 659.25, 783.99].forEach((note, i) => tone(soundGain, 'triangle', note, now + i * 0.09, 0.18, 0.5)));
    }

    function gameOver() {
        play(now => [392, 311.13, 233.08].forEach((note, i) => tone(soundGain, 'sawtooth', note, now + i * 0.17, 0.32, 0.3)));
    }

    function scheduleMusic() {
        if (ctx.state !== 'running') {
            return;
        }
        nextNoteAt = Math.max(nextNoteAt, ctx.currentTime);
        while (nextNoteAt < ctx.currentTime + 0.4) {
            const bar = tune.bars[Math.floor(step / 8) % tune.bars.length];
            const note = step % 8;
            if (note % tune.bassEvery === 0) {
                tone(musicGain, 'sine', bar.bass, nextNoteAt, tune.bassSeconds, 0.8);
            }
            if (bar.notes[note]) {
                tone(musicGain, tune.wave, bar.notes[note], nextNoteAt, tune.noteSeconds, tune.noteLoudness);
            }
            if (tune.beat && note % 4 === 0) {
                tone(musicGain, 'sine', 170, nextNoteAt, 0.12, 0.7, 50);
            }
            if (tune.beat && note % 4 === 2) {
                tone(musicGain, 'triangle', 330, nextNoteAt, 0.09, 0.35, 150);
            }
            step++;
            nextNoteAt += 30 / (tune.slowBpm + (tune.fastBpm - tune.slowBpm) * speed);
        }
    }

    function setTune(name) {
        tune = TUNES[name];
    }

    function startMusic() {
        if (ctx && !musicTimer) {
            step = 0;
            nextNoteAt = ctx.currentTime + 0.05;
            scheduleMusic();
            musicTimer = setInterval(scheduleMusic, 100);
        }
    }

    function stopMusic() {
        clearInterval(musicTimer);
        musicTimer = null;
    }

    // 0 = slow, 1 = fast: the music keeps up with the game
    function setMusicSpeed(value) {
        speed = value;
    }

    // While the page isn't visible (phone locked, other app)
    function sleep() {
        if (ctx) {
            ctx.suspend().catch(() => {});
        }
    }

    return {unlock, setSoundVolume, setMusicVolume, tap, meow, warn, siren, miss, start, gameOver, startMusic, stopMusic, setMusicSpeed, setTune, sleep};
})();
