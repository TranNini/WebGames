// The island's sounds, made in the browser like all sounds in these games. Takes over the music part of Sound, so the shared menu's sliders work.
const SCALE = [220, 246.94, 277.18, 329.63, 369.99, 440, 493.88, 554.37, 659.25];

export class IslandAudio {
    constructor() {
        this.ctx = null;
        this.soundLevel = 0.7;
        this.musicLevel = 0.4;
        this.playingMusic = false;
        this.takeOverSound();
    }

    // The menu in game.js talks to Sound, so this listens in
    takeOverSound() {
        const unlock = Sound.unlock;
        const setSound = Sound.setSoundVolume;
        const sleep = Sound.sleep;
        Sound.unlock = () => {
            unlock();
            this.unlock();
        };
        Sound.setSoundVolume = level => {
            setSound(level);
            this.soundLevel = level / 100;
            this.applyLevels();
        };
        Sound.setMusicVolume = level => {
            this.musicLevel = level / 100;
            this.applyLevels();
        };
        Sound.startMusic = () => this.startMusic();
        Sound.stopMusic = () => this.stopMusic();
        Sound.sleep = () => {
            sleep();
            if (this.ctx) {
                this.ctx.suspend();
            }
        };
    }

    unlock() {
        if (!this.ctx) {
            const Context = window.AudioContext || window.webkitAudioContext;
            if (!Context) {
                return;
            }
            this.ctx = new Context();
            const c = this.ctx;
            this.master = c.createGain();
            this.muffle = c.createBiquadFilter();
            this.muffle.type = 'lowpass';
            this.muffle.frequency.value = 20000;
            this.master.connect(this.muffle);
            this.muffle.connect(c.destination);
            this.sfx = c.createGain();
            this.ambient = c.createGain();
            this.musicBus = c.createGain();
            this.sfx.connect(this.master);
            this.ambient.connect(this.master);
            this.musicBus.connect(c.destination);
            const length = c.sampleRate * 3;
            this.noise = c.createBuffer(1, length, c.sampleRate);
            const data = this.noise.getChannelData(0);
            for (let i = 0; i < length; i++) {
                data[i] = Math.random() * 2 - 1;
            }
            this.applyLevels();
            this.startAmbience();
        }
        if (this.ctx.state !== 'running') {
            this.ctx.resume();
        }
    }

    applyLevels() {
        if (this.ctx) {
            this.sfx.gain.value = this.soundLevel;
            this.ambient.gain.value = this.soundLevel;
            this.musicBus.gain.value = this.musicLevel * 0.5;
        }
    }

    // A looping noise through a filter, with a gain to change later
    bed(type, frequency, q, gainValue = 0, output = this.ambient) {
        const c = this.ctx;
        const source = c.createBufferSource();
        source.buffer = this.noise;
        source.loop = true;
        const filter = c.createBiquadFilter();
        filter.type = type;
        filter.frequency.value = frequency;
        filter.Q.value = q;
        const gain = c.createGain();
        gain.gain.value = gainValue;
        source.connect(filter);
        filter.connect(gain);
        gain.connect(output);
        source.start();
        return {source, filter, gain};
    }

    startAmbience() {
        this.sea = this.bed('lowpass', 520, 0.6);
        this.wind = this.bed('bandpass', 420, 0.5);
        this.rain = this.recording('art/rain.mp3');
        this.crickets = this.recording('art/crickets.mp3');
        this.nextBird = 3;
    }

    // Real rain and real crickets: a recording that plays round and round, heard once it has loaded
    recording(url) {
        const c = this.ctx;
        const gain = c.createGain();
        gain.gain.value = 0;
        gain.connect(this.ambient);
        fetch(url).then(response => response.arrayBuffer()).then(data => new Promise((done, failed) => c.decodeAudioData(data, done, failed))).then(buffer => {
            const source = c.createBufferSource();
            source.buffer = buffer;
            source.loop = true;
            // Leaves out the silence that this file format has at both ends
            source.loopStart = 0.06;
            source.loopEnd = buffer.duration - 0.06;
            source.connect(gain);
            source.start(0, 0.06);
        }).catch(() => {
            // Without it there is only less to hear
        });
        return gain;
    }

    setGain(node, value, seconds = 1) {
        node.gain.setTargetAtTime(value, this.ctx.currentTime, seconds);
    }

    // Each frame: what can be heard here
    updateAmbience(info, dt) {
        if (!this.ctx || !this.sea) {
            return;
        }
        const swell = 0.6 + 0.4 * Math.sin(this.ctx.currentTime * 0.5);
        const quiet = info.silent ? 0 : 1;
        this.setGain(this.sea.gain, quiet * Math.max(0.03, (1 - info.shore / 110)) * 0.34 * swell * (info.indoor ? 0.25 : 1));
        this.setGain(this.wind.gain, quiet * (0.02 + info.wind * 0.07) * (info.indoor ? 0.2 : 1));
        this.setGain(this.rain, quiet * Math.min(1, info.rain * 1.3) * 1.8 * (info.indoor ? 0.04 : info.underwater ? 0.2 : info.sheltered ? 0.55 : 1));
        this.setGain(this.crickets, quiet * (info.night && !info.indoor && !info.underwater ? 0.8 * (1 - Math.min(0.85, info.rain * 1.5)) : 0), 2);
        this.muffle.frequency.setTargetAtTime(info.underwater ? 380 : 20000, this.ctx.currentTime, 0.1);
        if (!info.night && !info.silent && !info.underwater && !info.indoor && info.rain < 0.2) {
            this.nextBird -= dt;
            if (this.nextBird <= 0) {
                this.nextBird = 2 + Math.random() * 7;
                this.bird();
            }
        }
    }

    tone(type, frequency, at, seconds, loud, end = null, output = this.sfx) {
        const c = this.ctx;
        const start = c.currentTime + at;
        const osc = c.createOscillator();
        osc.type = type;
        osc.frequency.setValueAtTime(frequency, start);
        if (end) {
            osc.frequency.exponentialRampToValueAtTime(end, start + seconds);
        }
        const gain = c.createGain();
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.linearRampToValueAtTime(loud, start + Math.min(0.012, seconds / 4));
        gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
        osc.connect(gain);
        gain.connect(output);
        osc.start(start);
        osc.stop(start + seconds + 0.02);
    }

    // Rises slowly and falls away
    swell(type, frequency, end, seconds, loud) {
        const c = this.ctx;
        const start = c.currentTime;
        const osc = c.createOscillator();
        osc.type = type;
        osc.frequency.setValueAtTime(frequency, start);
        osc.frequency.exponentialRampToValueAtTime(end, start + seconds);
        const gain = c.createGain();
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(loud, start + seconds * 0.25);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
        osc.connect(gain);
        gain.connect(this.sfx);
        osc.start(start);
        osc.stop(start + seconds + 0.02);
    }

    burst(at, seconds, loud, type = 'lowpass', frequency = 1000, end = null, output = this.sfx) {
        const c = this.ctx;
        const start = c.currentTime + at;
        const source = c.createBufferSource();
        source.buffer = this.noise;
        source.loop = true;
        const filter = c.createBiquadFilter();
        filter.type = type;
        filter.frequency.setValueAtTime(frequency, start);
        if (end) {
            filter.frequency.exponentialRampToValueAtTime(end, start + seconds);
        }
        const gain = c.createGain();
        gain.gain.setValueAtTime(loud, start);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
        source.connect(filter);
        filter.connect(gain);
        gain.connect(output);
        source.start(start, Math.random() * 2);
        source.stop(start + seconds + 0.02);
    }

    bird() {
        const base = 1800 + Math.random() * 1800;
        const n = 2 + Math.floor(Math.random() * 4);
        const loud = 0.012 + Math.random() * 0.02;
        for (let i = 0; i < n; i++) {
            this.tone('sine', base, i * 0.13, 0.1, loud, base * (0.75 + Math.random() * 0.6), this.ambient);
        }
    }

    play(name) {
        if (!this.ctx) {
            return;
        }
        const sounds = {
            step: () => this.burst(0, 0.08, 0.06, 'lowpass', 900),
            stepSand: () => this.burst(0, 0.11, 0.05, 'bandpass', 1500),
            stepWater: () => this.burst(0, 0.16, 0.07, 'bandpass', 800),
            chop: () => {
                this.burst(0, 0.1, 0.5, 'bandpass', 900);
                this.tone('square', 170, 0, 0.09, 0.14, 80);
            },
            mine: () => {
                this.burst(0, 0.07, 0.3, 'highpass', 2200);
                this.tone('triangle', 1250, 0, 0.1, 0.16, 800);
            },
            crash: () => {
                this.burst(0, 0.8, 0.45, 'lowpass', 1200, 90);
                this.burst(0.3, 0.3, 0.3, 'lowpass', 500);
            },
            dig: () => this.burst(0, 0.26, 0.28, 'lowpass', 700, 220),
            swing: () => this.burst(0, 0.14, 0.09, 'bandpass', 1400, 500),
            pick: () => {
                this.tone('triangle', 540, 0, 0.07, 0.15, 720);
                this.tone('triangle', 800, 0.06, 0.08, 0.1);
            },
            craft: () => {
                [0, 0.13, 0.26].forEach(at => this.burst(at, 0.06, 0.32, 'bandpass', 1500));
                this.tone('triangle', 660, 0.36, 0.2, 0.12, 880);
            },
            build: () => {
                [0, 0.17, 0.3].forEach(at => {
                    this.burst(at, 0.07, 0.38, 'bandpass', 620);
                    this.tone('square', 150, at, 0.05, 0.1);
                });
            },
            eat: () => {
                [0, 0.13, 0.27].forEach(at => this.burst(at, 0.08, 0.2, 'bandpass', 2300));
            },
            drink: () => {
                [0, 0.2, 0.4].forEach(at => this.tone('sine', 320, at, 0.14, 0.2, 640));
            },
            splash: () => this.burst(0, 0.5, 0.3, 'bandpass', 1100, 320),
            hurt: () => {
                this.tone('sawtooth', 210, 0, 0.26, 0.2, 110);
                this.burst(0, 0.12, 0.2, 'lowpass', 1000);
            },
            bow: () => {
                this.tone('triangle', 240, 0, 0.1, 0.16, 90);
                this.burst(0, 0.16, 0.11, 'highpass', 2600);
            },
            chest: () => {
                this.tone('sawtooth', 120, 0, 0.26, 0.04, 210);
                this.burst(0.2, 0.08, 0.2, 'bandpass', 800);
            },
            fire: () => this.burst(0, 0.5, 0.14, 'highpass', 2100),
            note: () => this.burst(0, 0.18, 0.14, 'highpass', 3000, 6000),
            discover: () => [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone('triangle', f, i * 0.12, 0.45, 0.1)),
            good: () => [659.25, 880].forEach((f, i) => this.tone('sine', f, i * 0.11, 0.3, 0.13)),
            bite: () => {
                this.tone('sine', 500, 0, 0.08, 0.2, 900);
                this.tone('sine', 500, 0.1, 0.08, 0.2, 900);
                this.burst(0, 0.2, 0.15, 'bandpass', 1300);
            },
            boar: () => this.tone('sawtooth', 150, 0, 0.32, 0.14, 330),
            monkey: () => [0, 0.11, 0.22].forEach(at => this.tone('square', 900, at, 0.08, 0.05, 1500)),
            parrot: () => [0, 0.16].forEach(at => this.tone('sawtooth', 1700, at, 0.13, 0.05, 900)),
            snake: () => this.burst(0, 0.8, 0.12, 'highpass', 5000),
            croc: () => this.tone('sawtooth', 62, 0, 0.8, 0.28, 44),
            jaguar: () => {
                this.tone('sawtooth', 120, 0, 0.7, 0.24, 70);
                this.burst(0, 0.7, 0.11, 'bandpass', 500);
            },
            // It has seen you: thin, wrong notes and something low under them, for a second
            seen: () => {
                [1244, 1319, 1865, 2093].forEach((f, i) => this.swell('sawtooth', f, f * (i % 2 ? 0.97 : 1.03), 1, 0.045));
                this.swell('sine', 62, 41, 1, 0.5);
                this.burst(0, 1, 0.09, 'bandpass', 3200, 700);
            },
            taken: () => {
                [311, 330, 466, 622, 1245].forEach(f => this.tone('sawtooth', f, 0, 1.3, 0.15, f * 0.6));
                this.burst(0, 1.4, 0.8, 'lowpass', 3200, 90);
                this.tone('sine', 44, 0, 1.6, 0.8, 28);
            },
            chime: () => {
                this.tone('sine', 880, 0, 0.7, 0.14);
                this.tone('sine', 659.25, 0.42, 1.1, 0.14);
            },
            alarm: () => {
                this.tone('square', 980, 0, 0.14, 0.05);
                this.tone('square', 980, 0.24, 0.14, 0.05);
            },
            boom: () => {
                this.burst(0, 1.8, 0.95, 'lowpass', 900, 50);
                this.tone('sine', 72, 0, 1.2, 0.6, 28);
            },
            impact: () => {
                this.burst(0, 3, 1.1, 'lowpass', 2500, 60);
                this.tone('sine', 55, 0, 1.6, 0.8, 20);
            },
            rattle: () => this.burst(0, 0.12, 0.26, 'bandpass', 2100),
            gasp: () => {
                this.burst(0, 0.5, 0.1, 'bandpass', 1800, 900);
            },
            fanfare: () => [392, 523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone('triangle', f, i * 0.17, 0.75, 0.16))
        };
        (sounds[name] || (() => {}))();
    }

    thunder(delay) {
        if (!this.ctx) {
            return;
        }
        this.burst(delay, 2.6, 0.55, 'lowpass', 280, 40, this.ambient);
        this.burst(delay, 0.3, 0.35, 'lowpass', 1200, 200, this.ambient);
    }

    // For the crash and the rescue: a held sound that can be changed and stopped
    hold(kind) {
        if (!this.ctx) {
            return {set() {}, stop() {}};
        }
        const c = this.ctx;
        if (kind === 'tinnitus') {
            const osc = c.createOscillator();
            osc.frequency.value = 7350;
            const gain = c.createGain();
            gain.gain.value = 0;
            osc.connect(gain);
            gain.connect(this.sfx);
            osc.start();
            return {
                set: value => gain.gain.setTargetAtTime(value * 0.11, c.currentTime, 0.4),
                stop: () => osc.stop(c.currentTime + 0.1)
            };
        }
        if (kind === 'cabin') {
            const hum = this.bed('lowpass', 240, 0.8, 0, this.sfx);
            const hiss = this.bed('bandpass', 1200, 0.3, 0, this.sfx);
            const engine = c.createOscillator();
            engine.type = 'sawtooth';
            engine.frequency.value = 92;
            const engineGain = c.createGain();
            engineGain.gain.value = 0;
            const low = c.createBiquadFilter();
            low.type = 'lowpass';
            low.frequency.value = 300;
            engine.connect(low);
            low.connect(engineGain);
            engineGain.connect(this.sfx);
            engine.start();
            return {
                set: storm => {
                    this.setGain(hum.gain, 0.2 + storm * 0.55, 0.4);
                    this.setGain(hiss.gain, 0.02 + storm * 0.4, 0.4);
                    this.setGain(engineGain, 0.05 + storm * 0.05, 0.4);
                    engine.frequency.setTargetAtTime(92 + storm * 45, c.currentTime, 0.5);
                },
                stop: () => {
                    [hum, hiss].forEach(b => b.source.stop());
                    engine.stop();
                }
            };
        }
        if (kind === 'heli') {
            const chop = this.bed('lowpass', 420, 1, 0, this.sfx);
            const lfo = c.createOscillator();
            lfo.type = 'sawtooth';
            lfo.frequency.value = 12;
            const depth = c.createGain();
            depth.gain.value = 0;
            const pulse = c.createGain();
            pulse.gain.value = 0.6;
            lfo.connect(depth);
            depth.connect(pulse.gain);
            chop.gain.disconnect();
            chop.gain.connect(pulse);
            pulse.connect(this.sfx);
            chop.gain.gain.value = 1;
            lfo.start();
            return {
                set: value => {
                    pulse.gain.setTargetAtTime(value * 0.55, c.currentTime, 0.3);
                    depth.gain.setTargetAtTime(value * 0.5, c.currentTime, 0.3);
                },
                stop: () => {
                    chop.source.stop();
                    lfo.stop();
                }
            };
        }
        return {set() {}, stop() {}};
    }

    startMusic() {
        this.unlock();
        if (!this.ctx || this.playingMusic) {
            return;
        }
        this.playingMusic = true;
        this.nextNote = this.ctx.currentTime + 0.1;
        this.place = 3;
        this.bar = 0;
        this.musicTimer = setInterval(() => this.scheduleMusic(), 200);
    }

    stopMusic() {
        this.playingMusic = false;
        clearInterval(this.musicTimer);
    }

    // Soft plucks wander over a pentatonic scale, with rests, and a low note now and then
    scheduleMusic() {
        const c = this.ctx;
        while (this.nextNote < c.currentTime + 0.5) {
            const at = this.nextNote - c.currentTime;
            if (Math.random() < 0.62) {
                this.place = Math.max(0, Math.min(SCALE.length - 1, this.place + Math.floor(Math.random() * 5) - 2));
                const note = SCALE[this.place];
                this.tone('triangle', note, at, 1.1, 0.14, null, this.musicBus);
                this.tone('sine', note * 2, at, 0.5, 0.05, null, this.musicBus);
            }
            if (this.bar % 8 === 0) {
                this.tone('sine', [110, 138.59, 92.5, 123.47][(this.bar / 8) % 4], at, 2.5, 0.2, null, this.musicBus);
            }
            this.bar++;
            this.nextNote += 0.42;
        }
    }
}
