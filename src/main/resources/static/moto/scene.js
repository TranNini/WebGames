// Moto Race's picture: the road as seen from behind the own bike, with what stands beside it and on it, and the other
// bikes on it. All drawn in code. The road is drawn from near to far, each segment only where nearer hills don't hide it; then what
// stands on it from far to near, cut off where a hill in front covers it.
const Scene = (() => {
    const DRAW_SEGMENTS = 170; // 680 m ahead
    const CAMERA_BACK = 5; // the camera is this far behind the bike
    const BIKE_SCALE = 1.7; // bikes are drawn bigger than they are, to be seen well on a phone
    const RIDER_COLORS = ['#e5484d', '#3e7bfa', '#f5c400', '#2fb36d', '#9b5de5', '#f7782b'];

    const LOOKS = {
        seaside: {
            sky: ['#5fb4ec', '#bfe6fb'], fog: '#cfeaf8', hills: ['#7fb7c9', '#4f9ab0'], sea: '#2f86b8',
            grass: ['#e9d7a4', '#e0cb92'], road: ['#6b6f78', '#676b74'], rumble: ['#e8eef3', '#d9473f'], line: '#f4f4f0', sun: '#fff6c9',
            lights: 0
        },
        canyon: {
            sky: ['#f39a5b', '#fbd59a'], fog: '#f6cf9c', hills: ['#c9774b', '#a85a37'],
            grass: ['#d9a066', '#cf9459'], road: ['#5d5552', '#59514e'], rumble: ['#f2e8da', '#b23b2e'], line: '#f6d36b', sun: '#fff1c4',
            lights: 0
        },
        forest: {
            sky: ['#3b3566', '#c9839a'], fog: '#8a6f8f', hills: ['#2e3b4f', '#22303f'],
            grass: ['#3e7a45', '#36703d'], road: ['#4b4f58', '#474b54'], rumble: ['#e9e9ee', '#c4433a'], line: '#f1f1e6', sun: '#ffe6b0',
            lights: 0.5
        },
        // At night: towers lit up on the hills, a river below them, mist
        chongqing: {
            sky: ['#121936', '#76587c'], fog: '#5a5476', hills: ['#2b3050', '#232842'], river: '#232c4c',
            grass: ['#33423e', '#2e3c38'], road: ['#3f4149', '#3b3d45'], rumble: ['#ecebef', '#d33a35'], line: '#f2cf5b', sun: '#f3ecd6',
            lights: 0.8, city: true
        },
        // Drawn by drawDescent, as in the html test; its haze, for what stands on the road
        tianmen: {fog: '#d6e4ec', lights: 0}
    };

    let canvas = null;
    let ctx = null;
    let width = 0;
    let height = 0;
    let skyShift = 0;

    function setUp(element) {
        canvas = element;
        ctx = canvas.getContext('2d');
        resize();
    }

    function resize() {
        const ratio = Math.min(2, window.devicePixelRatio || 1);
        width = canvas.clientWidth;
        height = canvas.clientHeight;
        canvas.width = Math.round(width * ratio);
        canvas.height = Math.round(height * ratio);
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    }

    // Colors toward the haze in the distance
    function mix(a, b, t) {
        const pa = parseInt(a.slice(1), 16);
        const pb = parseInt(b.slice(1), 16);
        const channel = shift => Math.round(((pa >> shift) & 255) * (1 - t) + ((pb >> shift) & 255) * t);
        return `rgb(${channel(16)},${channel(8)},${channel(0)})`;
    }

    // The same as mix, as #rrggbb, to be mixed again
    function hexMix(a, b, t) {
        const pa = parseInt(a.slice(1), 16);
        const pb = parseInt(b.slice(1), 16);
        const channel = shift => Math.round(((pa >> shift) & 255) * (1 - t) + ((pb >> shift) & 255) * t);
        return '#' + ((channel(16) << 16) | (channel(8) << 8) | channel(0)).toString(16).padStart(6, '0');
    }

    function quad(color, x1, y1, w1, x2, y2, w2) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(x1 - w1, y1);
        ctx.lineTo(x2 - w2, y2);
        ctx.lineTo(x2 + w2, y2);
        ctx.lineTo(x1 + w1, y1);
        ctx.closePath();
        ctx.fill();
    }

    // view: {track, bike (own), others: [{z, x, lean, color, name, braking}], color, braking, turned (the sky's turn this frame)}
    function draw(view) {
        if (canvas.clientWidth !== width || canvas.clientHeight !== height) {
            resize();
        }
        const {track, bike} = view;
        if (track.descent) {
            drawDescent(view);
            return;
        }
        const look = LOOKS[track.key];
        const upright = height > width;
        // Sideways, the camera comes closer: the road and the bikes fill more of the wide screen, with less sky
        const horizon = height * (upright ? 0.3 : 0.33);
        const bikeY = height * (upright ? 0.86 : 0.9);
        // The road at the bike takes most of the width; the camera's height follows from where the bike is on screen
        const focal = (upright ? width * 0.74 : Math.min(width * 0.86, height * 2.2)) * CAMERA_BACK / (2 * Track.ROAD);
        const cameraHeight = (bikeY - horizon) * CAMERA_BACK / focal;
        const cameraZ = bike.z - CAMERA_BACK;
        // In the air the camera goes up with the bike, a little less, so the bike is seen rising and the road dropping away
        const cameraY = Track.heightAt(track, bike.z) + cameraHeight + bike.air * 0.6;
        const cameraX = bike.x;
        // Bikes are drawn bigger than they are, to be seen well, but the own one no taller than a fifth of the screen
        // (a phone sideways, where the screen is low: a third; a tablet sideways: a quarter)
        const tallest = upright ? 0.21 : height < 500 ? 0.32 : 0.24;
        const bikeScale = Math.min(BIKE_SCALE, height * tallest / 1.8 / (focal / CAMERA_BACK));

        // The far view turns with the road
        skyShift += view.turned;
        drawSky(look, horizon, upright);
        // The land far off, in the haze: seen under the horizon where the road beyond a crest is hidden (left unpainted,
        // it kept what was drawn there before, and things left trails)
        ctx.fillStyle = look.fog;
        ctx.fillRect(0, horizon + 2, width, height - horizon - 2);

        const first = Track.RUN_UP + Math.floor(cameraZ / Track.SEGMENT);
        const into = cameraZ / Track.SEGMENT - Math.floor(cameraZ / Track.SEGMENT);
        const bendStep = Track.BEND * Track.SEGMENT;
        let x = 0;
        let dx = -track.segments[first].bend * bendStep * into;
        let lowest = height; // nearer road already covers what is below this
        const shown = [];

        for (let n = 0; n < DRAW_SEGMENTS && first + n < track.segments.length; n++) {
            const segment = track.segments[first + n];
            const z1 = (n - into) * Track.SEGMENT;
            const z2 = z1 + Track.SEGMENT;
            const near = Math.max(z1, 0.5);
            const scale1 = focal / near;
            const scale2 = focal / z2;
            const x1 = width / 2 + (x - cameraX) * scale1;
            const x2 = width / 2 + (x + dx - cameraX) * scale2;
            const y1 = horizon - (segment.y1 - cameraY) * scale1;
            const y2 = horizon - (segment.y2 - cameraY) * scale2;
            const visible = z2 > 0.5 && y2 < lowest;
            shown.push({segment, n, z1, z2, x1, x2, y1, y2, scale1, scale2, roadX: x, roadDx: dx, clip: lowest, visible});
            x += dx;
            dx += segment.bend * bendStep;
            if (visible) {
                lowest = y2;
            }
        }

        // Far to near, each a little over the one behind it, so no seams show: first the ground, then the road on it. Where a
        // hill in front hides the lower part of a segment, its road is cut off there.
        for (let i = shown.length - 1; i >= 0; i--) {
            const {segment, n, y1, y2, visible} = shown[i];
            if (visible) {
                const top = Math.max(y2 - 0.7, 0);
                ctx.fillStyle = mix(look.grass[Math.floor(segment.index / 3) % 2], look.fog, haze(n));
                ctx.fillRect(0, top, width, Math.min(y1, height) - top);
            }
        }
        for (let i = shown.length - 1; i >= 0; i--) {
            const {segment, n, x2, scale1, scale2, clip, visible} = shown[i];
            if (!visible) {
                continue;
            }
            let {x1, y1} = shown[i];
            const y2 = shown[i].y2 - 0.7;
            const w2 = Track.ROAD * scale2;
            let w1 = Track.ROAD * scale1;
            if (y1 > clip) {
                const t = (clip - y2) / (y1 - y2);
                x1 = x2 + (x1 - x2) * t;
                w1 = w2 + (w1 - w2) * t;
                y1 = clip;
            }
            const fade = haze(n);
            const stripe = Math.floor(segment.index / 3) % 2;
            quad(mix(look.rumble[stripe], look.fog, fade), x1, y1, w1 * 1.13, x2, y2, w2 * 1.13);
            const gate = segment.index - Track.RUN_UP;
            const goal = track.length / Track.SEGMENT;
            const startLine = gate === 0 || gate === 1 || gate === goal || gate === goal + 1;
            quad(mix(startLine ? '#f2f2f2' : look.road[stripe], look.fog, fade), x1, y1, w1, x2, y2, w2);
            if (startLine) {
                drawChecks(x1, y1, w1, x2, y2, w2, segment.index);
            } else if (stripe === 0) {
                quad(mix(look.line, look.fog, fade), x1, y1, w1 * 0.025, x2, y2, w2 * 0.025);
            }
            if (segment.ramp) {
                drawRamp(shown[i], segment.ramp, fade, look);
            }
        }

        // Things and bikes, far to near; the own bike among them, so one just behind it is drawn over it
        const bikesIn = new Map();
        const own = {own: true, z: bike.z};
        for (const other of [...view.others, own]) {
            const ahead = other.own ? CAMERA_BACK : other.z - cameraZ;
            const n = Math.floor((ahead + into * Track.SEGMENT) / Track.SEGMENT);
            if (ahead > 1 && n < shown.length - 2) {
                if (!bikesIn.has(n)) {
                    bikesIn.set(n, []);
                }
                bikesIn.get(n).push({...other, ahead});
            }
        }
        for (const list of bikesIn.values()) {
            list.sort((a, b) => b.ahead - a.ahead);
        }
        for (let n = shown.length - 1; n >= 0; n--) {
            const entry = shown[n];
            if (entry.z1 >= 1) {
                for (const thing of entry.segment.things) {
                    drawThing(thing, entry, look, cameraX, n);
                }
            }
            for (const other of bikesIn.get(n) || []) {
                if (other.own) {
                    const lean = bike.steer * 0.42 + (bike.crash > 0 ? Math.sin(bike.crash * 18) * 0.3 : 0);
                    // Blinks while it rides through things after a crash (shown, then gone; never see-through)
                    if (bike.ghost > 0 && Math.floor(bike.ghost * 8) % 2 === 1) {
                        continue;
                    }
                    const perMeter = focal / CAMERA_BACK;
                    drawBike(width / 2, bikeY + bike.air * 0.6 * perMeter, perMeter * bikeScale, RIDER_COLORS[view.color], lean,
                        view.braking, null, look.lights, bike.air * perMeter);
                    continue;
                }
                // Where it is, seen from the camera: not a share of the way between the segment's ends on screen, which
                // isn't where it is in depth and made bikes near the own one jump at each segment
                const t = Math.max(0, Math.min(1, (other.ahead - entry.z1) / Track.SEGMENT));
                const scale = focal / Math.max(0.5, other.ahead);
                const roadX = entry.roadX + entry.roadDx * t;
                const ground = entry.segment.y1 + (entry.segment.y2 - entry.segment.y1) * t;
                const sx = width / 2 + (roadX + other.x - cameraX) * scale;
                const sy = horizon - (ground - cameraY) * scale;
                clipped(entry.clip, () => drawBike(sx, sy, scale * bikeScale, other.color, other.lean, other.braking, other.name,
                    look.lights, (other.air || 0) * scale));
            }
        }
    }

    const haze = n => Math.min(1, (n / DRAW_SEGMENTS) ** 1.6);

    // Tianmen, drawn as the html test draws it (tianmen-descent-test.html), 1:1: its camera, its 2 m steps, its colors. On
    // the left a forest slope 22 m high, darker forest above it; on the right a stone wall down to the valley floor 28 m
    // below, a parapet with blocks on it; guardrails on both sides. In a tunnel: a concrete underpass, pillars with orange
    // lamps every fourth step, the green slope and the valley seen between them, beams and a red neon line under its roof.
    // Near the end the valley floor rises to the road, with a river on it and Chinese boats. Far off, the sky, clouds and
    // four layers of green karst peaks, rising as the road goes down.
    const DESCENT = {
        cameraHigh: 2, cameraBack: 6.5, near: 0.52, ahead: 220, behind: 30, kerb: 1.12, roof: 5.8,
        bike: 0.81, // the bikes as tall as the test's riders (1.42 m)
        sky: [[118, 158, 214], [176, 204, 230], [214, 228, 236]], // its last color is the haze
        road: [[182, 182, 176], [188, 188, 182]], kerbColor: [208, 206, 196], line: [238, 236, 226],
        rail: [188, 182, 164], railDark: [150, 144, 126]
    };
    const roadX = new Float64Array(DESCENT.ahead + DESCENT.behind + 2); // the road's middle, m sideways, step by step
    const roadZ = new Float64Array(DESCENT.ahead + DESCENT.behind + 2); // how far ahead of the camera, m
    let farShift = 0; // the far view's turn, px, and eased
    let farShiftSmooth = 0;
    let descentLayers = null;
    let descentGlow = null;

    // The test's hash and random numbers, so its patterns come out the same
    const testHash = i => ((Math.imul(i ^ 0x9e3779b9, 2654435761) >>> 0) % 100000) / 100000;
    const testRandom = seed => {
        let s = seed | 0;
        return () => {
            s = s + 0x6D2B79F5 | 0;
            let t = Math.imul(s ^ s >>> 15, 1 | s);
            t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
    };
    const rgbMix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    const rgb = c => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
    const hazed = (c, f) => rgb(rgbMix(c, DESCENT.sky[2], f));

    function four(color, x1, y1, x2, y2, x3, y3, x4, y4) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.lineTo(x3, y3);
        ctx.lineTo(x4, y4);
        ctx.closePath();
        ctx.fill();
    }

    function canvasOf(w, h, paint) {
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        paint(c.getContext('2d'));
        return c;
    }

    // A warm glow in the tunnels
    function tunnelGlow(x, y, r, a) {
        if (r < 2) {
            return;
        }
        descentGlow = descentGlow || canvasOf(128, 128, c => {
            const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
            g.addColorStop(0, 'rgba(255,190,100,.95)');
            g.addColorStop(0.35, 'rgba(255,150,60,.35)');
            g.addColorStop(1, 'rgba(255,120,40,0)');
            c.fillStyle = g;
            c.fillRect(0, 0, 128, 128);
        });
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = a;
        ctx.drawImage(descentGlow, x - r, y - r, r * 2, r * 2);
        ctx.restore();
    }

    // The four layers of peaks, paler and bluer further off, limestone showing on the nearer two, the road snaking down two
    function makeDescentLayers() {
        const colors = [['#b4c9dc', '#cfdde8'], ['#8fb0b8', '#bcd0d4'], ['#5f9272', '#8fb59a'], ['#3d7452', '#5f9272']];
        const waves = [[5, 11], [7, 15], [9, 19], [11, 23]];
        const tall = [0.5, 0.6, 0.75, 0.85];
        return colors.map((c, j) => canvasOf(2048, 420, x => {
            const ph = [j * 1.3, j * 2.1 + 0.7];
            const peak = u => {
                const a = Math.pow(1 - Math.abs(Math.sin(waves[j][0] * u + ph[0] * 3)), 1.6);
                const b = Math.pow(1 - Math.abs(Math.sin(waves[j][1] * u + ph[1] * 3)), 1.3);
                return tall[j] * (0.62 * a + 0.38 * b);
            };
            const top = u => 420 - 20 - peak(u / 2048 * 6.2832) * 330;
            const g = x.createLinearGradient(0, 60, 0, 420);
            g.addColorStop(0, c[0]);
            g.addColorStop(1, c[1]);
            x.fillStyle = g;
            x.beginPath();
            x.moveTo(0, 420);
            for (let u = 0; u <= 2048; u += 8) {
                x.lineTo(u, top(u));
            }
            x.lineTo(2048, 420);
            x.fill();
            if (j >= 2) {
                const random = testRandom(j * 17);
                x.fillStyle = 'rgba(205,204,192,.5)';
                for (let k = 0; k < 26; k++) {
                    const u = random() * 2040;
                    const y = top(u);
                    x.beginPath();
                    x.moveTo(u, y + 4);
                    x.lineTo(u + 10 + random() * 14, y + 40 + random() * 50);
                    x.lineTo(u - 8 - random() * 10, y + 36 + random() * 50);
                    x.closePath();
                    x.fill();
                }
            }
            if (j === 1 || j === 2) {
                const u0 = 300 + j * 600;
                const y0 = top(u0) + 60;
                x.strokeStyle = 'rgba(240,236,222,.85)';
                x.lineWidth = 3;
                x.lineJoin = 'round';
                x.beginPath();
                for (let t = 0; t < 9; t++) {
                    x.lineTo(u0 + (t % 2 ? 64 : 0) + t * 5, y0 + t * 13);
                }
                x.stroke();
            }
        }));
    }

    // The far view: sky, clouds, the peaks (lower at the summit, rising as the road goes down: down is 0 to 1), mist
    function drawDescentBack(horizon, down) {
        const [s0, s1, s2] = DESCENT.sky;
        const g = ctx.createLinearGradient(0, 0, 0, horizon + 2);
        g.addColorStop(0, rgb(s0));
        g.addColorStop(0.6, rgb(s1));
        g.addColorStop(1, rgb(s2));
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, width, horizon + 2);
        ctx.fillStyle = 'rgb(204,220,222)';
        ctx.fillRect(0, horizon, width, height - horizon);
        for (const [fx, fy, fs] of [[0.05, 0.2, 0.34], [0.28, 0.34, 0.16], [0.5, 0.16, 0.3], [0.72, 0.3, 0.18], [0.9, 0.12, 0.26],
            [1.15, 0.28, 0.2], [1.4, 0.14, 0.3], [1.65, 0.34, 0.15]]) {
            const span = width * 2.2;
            const x = ((fx * span - farShiftSmooth * 0.2) % span + span) % span - width * 0.2;
            cloud(x, horizon * fy * 0.9, width * fs * 0.5);
        }
        descentLayers = descentLayers || makeDescentLayers();
        const turns = [0.35, 0.55, 0.8, 1];
        const below = ['#cfdde8', '#bcd0d4', '#8fb59a', '#5f9272'];
        descentLayers.forEach((layer, j) => {
            const s = height * (0.3 + 0.07 * j) / 420;
            const y0 = horizon + height * (0.035 * j + 0.16 * (1 - Math.min(1, down * 1.6)));
            const tile = 2048 * s;
            const off = ((farShiftSmooth * turns[j]) % tile + tile) % tile;
            for (let x = -off; x < width; x += tile) {
                ctx.drawImage(layer, x, y0 - 420 * s, tile + 1, 420 * s);
            }
            ctx.fillStyle = below[j];
            ctx.fillRect(0, y0 - 1, width, height);
            if (j === 1) {
                const mist = ctx.createLinearGradient(0, y0 - height * 0.16, 0, y0 + height * 0.04);
                mist.addColorStop(0, 'rgba(240,246,250,0)');
                mist.addColorStop(1, `rgba(240,246,250,${0.55 * (1 - down * 0.6)})`);
                ctx.fillStyle = mist;
                ctx.fillRect(0, y0 - height * 0.16, width, height * 0.2);
            }
        });
    }

    // A Chinese boat on the river: a junk with a battened red sail, or a sampan with a woven canopy and a fisherman in a
    // conical hat
    function drawBoat(cx, by, pp, ff, kind) {
        const hw = 3.6 * pp;
        ctx.fillStyle = `rgba(20,80,100,${0.3 * (1 - ff)})`;
        ctx.beginPath();
        ctx.ellipse(cx, by + 0.35 * pp, hw * 1.1, 0.28 * pp, 0, 0, 7);
        ctx.fill();
        ctx.fillStyle = hazed([96, 48, 34], ff);
        ctx.beginPath();
        ctx.moveTo(cx - hw, by - 1.1 * pp);
        ctx.quadraticCurveTo(cx - hw * 0.8, by + 0.2 * pp, cx - hw * 0.3, by + 0.3 * pp);
        ctx.lineTo(cx + hw * 0.4, by + 0.3 * pp);
        ctx.quadraticCurveTo(cx + hw * 0.9, by, cx + hw * 1.05, by - 1.3 * pp);
        ctx.closePath();
        ctx.fill();
        four(hazed([150, 86, 56], ff), cx - hw, by - 1.1 * pp, cx + hw * 1.05, by - 1.3 * pp, cx + hw, by - 0.95 * pp, cx - hw * 0.95, by - 0.8 * pp);
        if (kind < 0.5) {
            ctx.strokeStyle = hazed([70, 40, 30], ff);
            ctx.lineWidth = Math.max(0.7, 0.14 * pp);
            ctx.beginPath();
            ctx.moveTo(cx, by - 1);
            ctx.lineTo(cx, by - 6.6 * pp);
            ctx.stroke();
            four(hazed([190, 64, 42], ff), cx - hw * 0.7, by - 1.1 * pp, cx - hw * 0.55, by - 6 * pp, cx + hw * 0.55, by - 5.2 * pp, cx + hw * 0.65, by - 1.2 * pp);
            ctx.strokeStyle = 'rgba(100,30,20,.55)';
            ctx.lineWidth = Math.max(0.6, 0.1 * pp);
            for (let k = 1; k < 5; k++) {
                const y0 = by - 1.1 * pp - k * 0.95 * pp;
                ctx.beginPath();
                ctx.moveTo(cx - hw * 0.66, y0);
                ctx.lineTo(cx + hw * 0.6, y0 + 0.08 * pp);
                ctx.stroke();
            }
        } else {
            ctx.fillStyle = hazed([74, 62, 48], ff);
            ctx.beginPath();
            ctx.ellipse(cx - hw * 0.1, by - pp, hw * 0.55, 1.1 * pp, 0, Math.PI, 0);
            ctx.fill();
            ctx.fillStyle = hazed([54, 100, 140], ff);
            ctx.fillRect(cx + hw * 0.55, by - 2.4 * pp, 0.5 * pp, 1.4 * pp);
            ctx.fillStyle = hazed([226, 204, 130], ff);
            ctx.beginPath();
            ctx.moveTo(cx + hw * 0.8 - 0.8 * pp, by - 2.3 * pp);
            ctx.lineTo(cx + hw * 0.8, by - 3.3 * pp);
            ctx.lineTo(cx + hw * 0.8 + 0.8 * pp, by - 2.3 * pp);
            ctx.closePath();
            ctx.fill();
        }
    }

    function drawDescent(view) {
        const {track, bike} = view;
        const d = track.descent;
        const D = DESCENT;
        const W = width;
        const H = height;
        const F = W < H ? W * 0.66 : Math.max(W * 0.5 / Math.tan(40 * Math.PI / 180), H * 0.42);
        const HZ = H * (W < H ? 0.42 : 0.45);
        const SEG = d.step;
        const ROAD = Track.ROAD;
        const OFF = D.behind;
        const last = d.turn.length - 2;
        const groundAt = i => d.height[Math.max(0, Math.min(last, i))];
        const groundAtZ = p => {
            const i = Math.floor(p / SEG);
            return groundAt(i) + (groundAt(i + 1) - groundAt(i)) * (p / SEG - i);
        };
        const turnAt = i => (i < 0 || i > last ? 0 : d.turn[i] * SEG); // m sideways per step, per step
        const start = Track.RUN_UP * Track.SEGMENT; // the bikes' z is from the start line, the steps from the run-up's start
        const pos = bike.z + start;
        const camZ = pos - D.cameraBack;
        const base = Math.floor(pos / SEG);
        const pct = pos / SEG - base;
        const cameraX = bike.x;
        const cameraY = groundAtZ(camZ);
        const X = n => roadX[n + OFF];
        const Z = n => roadZ[n + OFF];
        const yAt = (high, n) => HZ - F * (high - D.cameraHigh - cameraY + groundAt(base + n)) / Math.max(D.near, Z(n));
        const goal = track.length / Track.SEGMENT;

        // The far view turns with the road
        farShift += Math.max(-45, Math.min(45, (view.heading || 0) * F));
        farShiftSmooth += (farShift - farShiftSmooth) * 0.25;
        drawDescentBack(HZ, Math.max(0, Math.min(1, cameraY / Math.min(-1, d.height[d.height.length - 1]))));

        let x = 0;
        let dx = -(turnAt(base) * pct);
        for (let n = 0; n <= D.ahead + 1; n++) {
            roadX[n + OFF] = x;
            if (n <= D.ahead) {
                x += dx;
                dx += turnAt(base + n);
            }
        }
        x = 0;
        dx = -(turnAt(base) * pct);
        for (let n = -1; n >= -OFF; n--) {
            dx -= turnAt(base + n);
            x -= dx;
            roadX[n + OFF] = x;
        }
        for (let n = -OFF; n <= D.ahead + 1; n++) {
            roadZ[n + OFF] = (base + n) * SEG - camZ;
        }

        // The bikes by the step they are in; the own one among them, so one just behind it is drawn over it
        const bikesIn = new Map();
        for (const other of [...view.others, {own: true, z: bike.z}]) {
            const n = Math.floor((other.z + start) / SEG) - base;
            if (n >= -4 && n < D.ahead) {
                if (!bikesIn.has(n)) {
                    bikesIn.set(n, []);
                }
                bikesIn.get(n).push(other);
            }
        }
        for (const list of bikesIn.values()) {
            list.sort((a, b) => b.z - a.z);
        }
        const look = LOOKS.tianmen;

        for (let n = D.ahead - 1; n >= -4; n--) {
            const t = base + n;
            if (t < 0 || t >= last) {
                continue;
            }
            const i = t - 40; // numbered as in the test, for its patterns
            let z1 = Z(n);
            const z2 = Z(n + 1);
            let xn = X(n);
            let Y1 = groundAt(t);
            const Y2 = groundAt(t + 1);
            if (z2 < D.near) {
                continue;
            }
            if (z1 < D.near) {
                const tt = (D.near - z1) / (z2 - z1);
                xn += (X(n + 1) - xn) * tt;
                Y1 += (Y2 - Y1) * tt;
                z1 = D.near;
            }
            const f = Math.pow(Math.max(0, n) / D.ahead, 1.3) * 0.9;
            const sx1 = W / 2 + F * (xn - cameraX) / z1;
            const sx2 = W / 2 + F * (X(n + 1) - cameraX) / z2;
            const w1 = F * ROAD / z1;
            const w2 = F * ROAD / z2;
            const y1 = HZ + F * (D.cameraHigh + cameraY - Y1) / z1;
            const y2 = HZ + F * (D.cameraHigh + cameraY - Y2) / z2;
            const hl = D.kerb;
            const pp1 = F / z1;
            const pp2 = F / z2;
            const inTunnel = d.tunnel[t];
            if (inTunnel) {
                const tc1 = yAt(D.roof, n);
                const tc2 = yAt(D.roof, n + 1);
                const xl1 = sx1 - hl * w1;
                const xl2 = sx2 - hl * w2;
                const xr1 = sx1 + hl * w1;
                const xr2 = sx2 + hl * w2;
                const pillar = i % 4 === 0;
                const beam = i % 2 === 0;
                const f2 = Math.min(1, f + 0.05);
                // The portal: a pale concrete face where the tunnel begins, ending at the thick outer wall on the right
                // (nothing above it: the sky stays); the wall's front face runs from the lintel down to the bottom
                const rb1 = sx1 + (hl + 0.45) * w1;
                const yb1 = yAt(-60, n);
                if (!d.tunnel[t - 1]) {
                    const h2 = yAt(8.5, n);
                    four(hazed([172, 166, 150], f2), -4, tc1, rb1, tc1, rb1, h2, -4, h2);
                    four(hazed([120, 112, 98], f2), -4, tc1, rb1, tc1, rb1, tc1 - 0.7 * pp1, -4, tc1 - 0.7 * pp1);
                    four(hazed([172, 166, 150], f2), xr1, h2, rb1, h2, rb1, yb1, xr1, yb1);
                }
                for (const side of [-1, 1]) {
                    const e = side < 0 ? -4 : W + 4;
                    const a1 = sx1 + side * hl * w1;
                    const a2 = sx2 + side * hl * w2;
                    if (pillar) {
                        const concrete = hazed([108, 92, 86], f2);
                        if (side < 0) {
                            four(concrete, e, y1, a1, y1, a2, y2, e, y2);
                            four(concrete, e, tc1, a1, tc1, a1, y1, e, y1);
                        } else {
                            four(concrete, a1, tc1, rb1, tc1, rb1, yb1, a1, yb1);
                        }
                        four(concrete, a1, y1, a2, y2, a2, tc2, a1, tc1);
                        const l1 = yAt(2.2, n);
                        const l2 = yAt(3.4, n);
                        four(hazed([255, 154, 60], f2), a1, l1, a1, l2, a2, yAt(3.4, n + 1), a2, yAt(2.2, n + 1));
                        if (n >= 3 && n < 70) {
                            tunnelGlow(a1, (l1 + l2) / 2, Math.min(pp1 * 1.7, 40), 0.5);
                        }
                    } else {
                        if (side < 0) {
                            const slope = hazed(i % 3 === 1 ? [150, 186, 160] : [128, 168, 140], Math.min(1, f2 + 0.25));
                            four(slope, e, tc1, a1, tc1, a2, tc2, a2, y2);
                            four(slope, e, tc1, a2, tc2, a2, y2, e, y1);
                        } else {
                            const vb1 = yAt(-28, n);
                            const vb2 = yAt(-28, n + 1);
                            four(hazed([40, 98, 64], Math.min(1, f2 + 0.2)), a1, vb1, W + 4, vb1, W + 4, vb2, a2, vb2);
                            four(hazed([164, 158, 142], f2), a1, y1, a2, y2, a2, vb2, a1, vb1);
                        }
                        const p1 = yAt(1, n);
                        const p2 = yAt(1, n + 1);
                        four(hazed([138, 123, 114], f2), a1, y1, a2, y2, a2, p2, a1, p1);
                        four(hazed([176, 161, 152], f2), a1, p1, a2, p2, a2, yAt(1.18, n + 1), a1, yAt(1.18, n));
                    }
                }
                // The roof with beams, and a red neon line along each side
                four(hazed(beam ? [74, 64, 61] : [102, 92, 86], f2), xl1, tc1, xr1, tc1, xr2, tc2, xl2, tc2);
                for (const side of [-1, 1]) {
                    const a = side * 0.74;
                    const b = side * 0.84;
                    four(hazed([255, 74, 90], f * 0.5), sx1 + a * w1, tc1, sx1 + b * w1, tc1, sx2 + b * w2, tc2, sx2 + a * w2, tc2);
                    if (n >= 3 && n < 70 && i % 2 === 0) {
                        tunnelGlow(sx1 + side * 0.79 * w1, tc1, Math.min(pp1 * 1.2, 33), 0.4);
                    }
                }
            } else {
                const f2 = Math.min(1, f + 0.12);
                const hv = testHash(i * 5 + 3);
                const hv2 = testHash(i * 11 + 7);
                const xl1 = sx1 - hl * w1;
                const xl2 = sx2 - hl * w2;
                const xt1 = xl1 - 9 * pp1;
                const xt2 = xl2 - 9 * pp2;
                const t1 = yAt(22, n);
                const t2 = yAt(22, n + 1);
                const forest = rgbMix([30, 86, 56], [58, 122, 74], hv);
                const face = hv < 0.07 ? rgbMix([118, 128, 118], [134, 140, 130], hv2) : forest;
                const above = hazed(rgbMix(forest, [0, 0, 0], 0.18), f2);
                four(above, -4, t1, xt1, t1, xt2, t2, -4, t2);
                four(above, -4, yAt(60, n), xt1, t1, xt2, t2, -4, yAt(60, n + 1));
                four(hazed(forest, f2), -4, y1, xl1, y1, xl2, y2, -4, y2);
                four(hazed(face, f2), xl1, y1, xt1, t1, xt2, t2, xl2, y2);
                if (n < 110 && hv2 < 0.85) {
                    for (const u of [0.45, 0.9]) {
                        ctx.fillStyle = hazed(rgbMix([28, 88, 56], [46, 118, 70], hv2), f2);
                        ctx.beginPath();
                        ctx.arc(xl1 + (xt1 - xl1) * (u + hv * 0.1), y1 + (t1 - y1) * u, (2.6 + hv2 * 2) * pp1, 0, 7);
                        ctx.fill();
                    }
                }
                const xr1 = sx1 + hl * w1;
                const xr2 = sx2 + hl * w2;
                const b1 = yAt(-d.valley[t], n);
                const b2 = yAt(-d.valley[t + 1], n + 1);
                four(hazed(rgbMix([40, 98, 64], [26, 74, 52], hv), Math.min(1, f2 + 0.2)), xr1, b1, W + 4, b1, W + 4, b2, xr2, b2);
                // A river across the valley floor at the foot of the mountain, boats on it
                if (d.valley[t] < 12) {
                    const ra = 7;
                    const rb = 10;
                    four(hazed([86, 184, 204], f2 * 0.7), sx1 + ra * w1, b1, sx1 + rb * w1, b1, sx2 + rb * w2, b2, sx2 + ra * w2, b2);
                    const bank = hazed([150, 150, 120], f2);
                    four(bank, sx1 + (ra - 0.12) * w1, b1, sx1 + ra * w1, b1, sx2 + ra * w2, b2, sx2 + (ra - 0.12) * w2, b2);
                    four(bank, sx1 + rb * w1, b1, sx1 + (rb + 0.12) * w1, b1, sx2 + (rb + 0.12) * w2, b2, sx2 + rb * w2, b2);
                    if (i % 36 === 3 && n >= 6 && n < 160) { // a boat every 72 m (the test had one every 18 m)
                        const hv3 = testHash(i * 13 + 2);
                        drawBoat(sx1 + (ra + rb) / 2 * w1 + (hv3 - 0.5) * 0.9 * w1, (b1 + b2) / 2, pp1, f2 * 0.7, hv3);
                    }
                }
                four(hazed([164, 158, 142], f2), xr1, y1, xr2, y2, xr2, b2, xr1, b1);
                if (n < 90) {
                    for (const down of [-5, -10, -15, -20, -25]) {
                        if (-down <= d.valley[t] - 1) {
                            four('rgba(90,84,70,.22)', xr1, yAt(down, n), xr2, yAt(down, n + 1), xr2, yAt(down - 0.8, n + 1), xr1, yAt(down - 0.8, n));
                        }
                    }
                }
            }

            // The road; the start and the goal across it in checks
            const gate = Math.floor(t * SEG / Track.SEGMENT) - Track.RUN_UP;
            const startLine = gate === 0 || gate === 1 || gate === goal || gate === goal + 1;
            four(startLine ? '#f2f2f2' : hazed(i % 2 ? D.road[0] : D.road[1], f), sx1 - w1, y1, sx1 + w1, y1, sx2 + w2, y2, sx2 - w2, y2);
            if (startLine) {
                drawChecks(sx1, y1, w1, sx2, y2, w2, t);
            }
            if (inTunnel) {
                four('rgba(34,22,44,.4)', sx1 - w1, y1, sx1 + w1, y1, sx2 + w2, y2, sx2 - w2, y2);
                for (const side of [-1, 1]) {
                    four(`rgba(255,80,96,${0.2 * (1 - f)})`, sx1 + side * 0.78 * w1, y1, sx1 + side * 0.78 * w1 + 0.1 * w1, y1,
                        sx2 + side * 0.78 * w2 + 0.1 * w2, y2, sx2 + side * 0.78 * w2, y2);
                }
            }
            const kerb = hazed(D.kerbColor, f);
            four(kerb, sx1 - hl * w1, y1, sx1 - w1, y1, sx2 - w2, y2, sx2 - hl * w2, y2);
            four(kerb, sx1 + w1, y1, sx1 + hl * w1, y1, sx2 + hl * w2, y2, sx2 + w2, y2);
            if (n < 110 && !startLine) {
                const line = hazed(rgbMix(D.line, D.road[0], 0.35), f);
                four(line, sx1 - 0.93 * w1, y1, sx1 - 0.9 * w1, y1, sx2 - 0.9 * w2, y2, sx2 - 0.93 * w2, y2);
                four(line, sx1 + 0.9 * w1, y1, sx1 + 0.93 * w1, y1, sx2 + 0.93 * w2, y2, sx2 + 0.9 * w2, y2);
                if (Math.floor(i / 3) % 2 === 0) {
                    four(line, sx1 - 0.012 * w1, y1, sx1 + 0.012 * w1, y1, sx2 + 0.012 * w2, y2, sx2 - 0.012 * w2, y2);
                }
            }
            // Guardrails, and the parapet's blocks over the valley
            if (!inTunnel) {
                for (const side of [-1, 1]) {
                    const rx1 = sx1 + side * hl * w1;
                    const rx2 = sx2 + side * hl * w2;
                    four(hazed(D.railDark, f), rx1, y1, rx1, y1 - 0.55 * pp1, rx2, y2 - 0.55 * pp2, rx2, y2);
                    four(hazed(D.rail, f), rx1, y1 - 0.55 * pp1, rx1, y1 - 1.08 * pp1, rx2, y2 - 1.08 * pp2, rx2, y2 - 0.55 * pp2);
                }
                if (i % 2 === 0 && d.valley[t] >= 12) {
                    const rx1 = sx1 + hl * w1;
                    const rx2 = sx2 + hl * w2;
                    four(hazed([196, 190, 172], f), rx1, y1 - 1.08 * pp1, rx2, y2 - 1.08 * pp2, rx2, y2 - 1.75 * pp2, rx1, y1 - 1.75 * pp1);
                }
            }

            // What stands on the road (and the banners), where its segment begins
            const segment = t % 2 === 0 ? track.segments[t / 2] : null;
            if (segment && z1 >= 1) {
                const entry = {roadX: xn, scale1: F / z1, y1, clip: H};
                for (const thing of segment.things) {
                    drawThing(thing, entry, look, cameraX, n);
                }
            }
            // The bikes
            for (const other of bikesIn.get(n) || []) {
                const z = other.z + start;
                if (other.own) {
                    // Blinks while it rides through things after a crash (shown, then gone; never see-through)
                    if (bike.ghost > 0 && Math.floor(bike.ghost * 8) % 2 === 1) {
                        continue;
                    }
                    const perMeter = F / D.cameraBack;
                    const lean = bike.steer * 0.42 + (bike.crash > 0 ? Math.sin(bike.crash * 18) * 0.3 : 0);
                    drawBike(W / 2, HZ + F * (D.cameraHigh + cameraY - groundAtZ(z)) / D.cameraBack, perMeter * D.bike,
                        RIDER_COLORS[view.color], lean, view.braking, null, 0, bike.air * perMeter);
                    continue;
                }
                const ahead = z - camZ;
                if (ahead < 4.6) {
                    continue; // as in the test: right in front of the camera, not drawn
                }
                const tt = z / SEG - Math.floor(z / SEG);
                const xi = X(n) + (X(n + 1) - X(n)) * tt;
                const scale = F / ahead;
                drawBike(W / 2 + (xi + other.x - cameraX) * scale, HZ + F * (D.cameraHigh + cameraY - groundAtZ(z)) / ahead,
                    scale * D.bike, other.color, other.lean, other.braking, other.name, 0, (other.air || 0) * scale);
            }
        }
    }

    // A soft cloud: a shaded underside, then the white
    function cloud(x, y, w) {
        for (const [color, parts] of [['#c8d8ee', [[0, 0.05, 0.5, 0.22], [0.34, 0.1, 0.36, 0.2], [-0.36, 0.12, 0.34, 0.18], [0.1, -0.06, 0.32, 0.22]]],
            ['#ffffff', [[0, 0, 0.5, 0.22], [0.34, 0.06, 0.36, 0.2], [-0.36, 0.08, 0.34, 0.18], [0.1, -0.1, 0.32, 0.22]]]]) {
            for (const [dx, dy, rx, ry] of parts) {
                blob(color, x + dx * w, y + dy * w * 0.5 + (color === '#c8d8ee' ? w * 0.04 : 0), rx * w * 0.5, ry * w * 0.5);
            }
        }
    }

    function clipped(clipY, paint) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, width, clipY);
        ctx.clip();
        paint();
        ctx.restore();
    }

    // A ramp across the road, yellow with black stripes, rising to its lip; its sides show below it
    function drawRamp({x1, y1, x2, y2, scale1, scale2}, [h1, h2], fade, look) {
        const w1 = Track.ROAD * scale1;
        const w2 = Track.ROAD * scale2;
        const top1 = y1 - h1 * scale1;
        const top2 = y2 - h2 * scale2;
        for (const side of [-1, 1]) {
            shape(mix('#8a6a1c', look.fog, fade), [[x1 + side * w1, y1], [x1 + side * w1, top1], [x2 + side * w2, top2], [x2 + side * w2, y2]]);
        }
        quad(mix('#f5c400', look.fog, fade), x1, top1, w1, x2, top2, w2);
        for (const at of [-0.7, -0.35, 0, 0.35, 0.7]) {
            quad(mix('#26252b', look.fog, fade), x1 + at * w1, top1, w1 * 0.07, x2 + at * w2, top2, w2 * 0.07);
        }
        if (h2 >= 1.4) {
            quad(mix('#26252b', look.fog, fade), x2, top2 + 0.12 * scale2, w2, x2, top2, w2); // the lip
        }
    }

    function drawChecks(x1, y1, w1, x2, y2, w2, index) {
        const squares = 10;
        for (let i = 0; i < squares; i++) {
            if ((i + index) % 2) {
                continue;
            }
            const a = -1 + (2 * i) / squares;
            const b = a + 2 / squares;
            ctx.fillStyle = '#22242a';
            ctx.beginPath();
            ctx.moveTo(x1 + a * w1, y1);
            ctx.lineTo(x2 + a * w2, y2);
            ctx.lineTo(x2 + b * w2, y2);
            ctx.lineTo(x1 + b * w1, y1);
            ctx.closePath();
            ctx.fill();
        }
    }

    function drawSky(look, horizon, upright) {
        const sky = ctx.createLinearGradient(0, 0, 0, horizon);
        sky.addColorStop(0, look.sky[0]);
        sky.addColorStop(1, look.sky[1]);
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, width, horizon + 2);
        // The sun stays, the hills turn with the road
        ctx.fillStyle = look.sun;
        ctx.beginPath();
        ctx.arc(width * 0.72 - skyShift * 0.15 % width, horizon * (upright ? 0.35 : 0.3), Math.min(width, height) * 0.06, 0, Math.PI * 2);
        ctx.fill();
        hills(look.hills[0], horizon, horizon * 0.22, skyShift * 0.35, 0.011, 3.1);
        if (look.city) {
            city(look, horizon, skyShift * 0.55);
        } else if (look.sea) {
            ctx.fillStyle = look.sea; // in front of the far hills, so it is seen
            ctx.fillRect(0, horizon - Math.max(6, horizon * 0.07), width, Math.max(6, horizon * 0.07) + 2);
        } else {
            hills(look.hills[1], horizon, horizon * 0.12, skyShift * 0.7, 0.019, 1.7);
        }
    }

    // The same number for the same n, from 0 to 1
    const hash = n => {
        const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
        return s - Math.floor(s);
    };

    // Far off: towers on the hills, lit windows, a river below them with the lights in it, and now and then an arch bridge
    function city(look, horizon, shift) {
        const unit = Math.max(3, horizon * 0.018);
        const water = Math.max(6, horizon * 0.08);
        const slot = unit * 4;
        const hill = x => horizon - water - unit * (2 + 3 * (Math.sin((x + shift) / slot * 0.21) + 1));
        ctx.fillStyle = look.hills[1];
        ctx.beginPath();
        ctx.moveTo(0, horizon + 2);
        for (let x = 0; x <= width + 8; x += 8) {
            ctx.lineTo(x, hill(x));
        }
        ctx.lineTo(width, horizon + 2);
        ctx.closePath();
        ctx.fill();
        const first = Math.floor(shift / slot) - 2;
        const last = Math.ceil((shift + width) / slot) + 1;
        const lit = Math.max(1, unit * 0.36);
        for (let k = first; k <= last; k++) {
            const w = unit * (2.2 + hash(k) * 2.4);
            const x = k * slot - shift + hash(k + 991) * unit;
            const top = hill(x + w / 2) - unit * (4 + hash(k + 57) ** 2 * 20);
            ctx.fillStyle = mix(k % 2 ? '#262d4d' : '#2f3659', look.fog, 0.15);
            ctx.fillRect(x, top, w, horizon - top);
            for (let row = 0, y = top + unit * 0.7; y < horizon - water - unit; row++, y += unit * 1.05) {
                for (let col = 0, wx = x + unit * 0.4; wx < x + w - unit * 0.5; col++, wx += unit * 0.85) {
                    const on = hash(k * 131 + row * 17 + col * 3);
                    if (on < 0.4) {
                        ctx.fillStyle = on < 0.08 ? '#a8d8ff' : '#ffd58a';
                        ctx.fillRect(wx, y, lit, lit);
                    }
                }
            }
            if (hash(k + 7) < 0.25) {
                ctx.fillStyle = '#ff4b4b'; // a warning light on the roof
                ctx.fillRect(x + w / 2 - lit / 2, top - lit, lit, lit);
            }
        }
        ctx.fillStyle = look.river;
        ctx.fillRect(0, horizon - water, width, water + 2);
        for (let k = first; k <= last; k++) {
            if (hash(k + 3) < 0.6) {
                ctx.fillStyle = hash(k + 5) < 0.2 ? 'rgba(168,216,255,0.45)' : 'rgba(255,213,138,0.5)';
                const x = k * slot - shift + hash(k + 11) * slot;
                ctx.fillRect(x, horizon - water + water * (0.15 + hash(k + 13) * 0.7), unit * (0.8 + hash(k + 17) * 1.6), 1);
            }
            if (((k % 29) + 29) % 29 === 0) {
                bridge(k * slot - shift, slot * 9, horizon - water * 0.72, unit);
            }
        }
    }

    function bridge(x, long, deck, unit) {
        ctx.strokeStyle = '#8b90a8';
        ctx.lineWidth = Math.max(1, unit * 0.3);
        ctx.beginPath();
        ctx.moveTo(x, deck);
        ctx.lineTo(x + long, deck);
        ctx.moveTo(x + long * 0.12, deck);
        ctx.quadraticCurveTo(x + long / 2, deck - unit * 9, x + long * 0.88, deck);
        ctx.stroke();
        ctx.lineWidth = Math.max(0.6, unit * 0.12);
        ctx.beginPath();
        for (let i = 1; i < 8; i++) {
            const at = 0.12 + i * 0.095;
            const s = (at - 0.12) / 0.76;
            ctx.moveTo(x + long * at, deck);
            ctx.lineTo(x + long * at, deck - unit * 4.5 * 4 * s * (1 - s));
        }
        ctx.stroke();
        ctx.fillStyle = '#ffe2a0';
        for (let i = 0; i <= 12; i++) {
            ctx.fillRect(x + (long * i) / 12 - 1, deck - 2, 2, 2);
        }
    }

    function hills(color, horizon, tall, shift, waves, seed) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(0, horizon + 2);
        for (let x = 0; x <= width + 8; x += 8) {
            const at = (x + shift) * waves;
            const y = horizon - tall * (0.55 + 0.25 * Math.sin(at) + 0.2 * Math.sin(at * 2.3 + seed));
            ctx.lineTo(x, y);
        }
        ctx.lineTo(width, horizon + 2);
        ctx.closePath();
        ctx.fill();
    }

    function drawThing(thing, entry, look, cameraX, n) {
        const scale = entry.scale1;
        const sx = width / 2 + (entry.roadX + thing.x - cameraX) * scale;
        const sy = entry.y1 - (thing.base || 0) * scale; // on a cliff, or below the road
        const size = (thing.size || 1) * scale;
        if (size < 0.6 || sx < -size * 20 || sx > width + size * 20) {
            return;
        }
        const tint = color => mix(color, look.fog, haze(n) * 0.85);
        if (entry.clip <= 0) {
            return;
        }
        if (thing.obstacle) {
            clipped(entry.clip, () => drawObstacle(thing, {x: sx, y: sy}, size * OBSTACLE_SCALE, look));
            return;
        }
        if (thing.kind === 'start' || thing.kind === 'goal') {
            clipped(entry.clip, () => drawGate(thing.kind === 'start' ? 'START' : 'GOAL', entry, sy, size, cameraX));
            return;
        }
        clipped(entry.clip, () => {
            ctx.save();
            ctx.translate(sx, sy);
            if (thing.flip) {
                ctx.scale(-1, 1);
            }
            ctx.scale(size, size); // from here on in meters, up is negative
            THINGS[thing.kind](tint, thing, size);
            ctx.restore();
        });
    }

    function shape(color, points) {
        ctx.fillStyle = color;
        ctx.beginPath();
        points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.closePath();
        ctx.fill();
    }

    function blob(color, x, y, rx, ry) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    // A glow at night, in meters
    function glow(color, x, y, r) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        blob(color, x, y, r, r);
        ctx.restore();
    }

    // What stands beside the road, in meters from where it stands. size: pixels per meter.
    const THINGS = {
        palm(tint) {
            ctx.strokeStyle = tint('#8a6440');
            ctx.lineWidth = 0.38;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.quadraticCurveTo(0.2, -3.5, 1.1, -7);
            ctx.stroke();
            for (const [angle, length] of [[-2.6, 3], [-1.9, 2.6], [-0.9, 2.8], [-0.3, 3], [0.4, 2.5], [-1.4, 2.2]]) {
                ctx.strokeStyle = tint(angle < -1.5 ? '#2f8f4e' : '#3aa65a');
                ctx.lineWidth = 0.55;
                ctx.beginPath();
                ctx.moveTo(1.1, -7);
                ctx.quadraticCurveTo(1.1 + Math.cos(angle) * length * 0.6, -7 + Math.sin(angle) * length * 0.6 - 0.6,
                    1.1 + Math.cos(angle) * length, -7 + Math.sin(angle) * length * 0.3 + 1);
                ctx.stroke();
            }
        },
        rock(tint) {
            shape(tint('#9a9a93'), [[-1, 0], [-0.8, -0.8], [-0.2, -1.2], [0.6, -1], [1, -0.3], [0.9, 0]]);
            shape(tint('#b3b3ab'), [[-0.8, -0.8], [-0.2, -1.2], [0.2, -0.7], [-0.4, -0.5]]);
        },
        hut(tint) {
            shape(tint('#c98b4a'), [[-1.8, 0], [-1.8, -2.2], [1.8, -2.2], [1.8, 0]]);
            shape(tint('#e05a47'), [[-2.3, -2.1], [0, -3.6], [2.3, -2.1]]);
            shape(tint('#5a3b24'), [[-0.45, 0], [-0.45, -1.4], [0.45, -1.4], [0.45, 0]]);
        },
        cactus(tint) {
            const green = tint('#3f8f4a');
            ctx.strokeStyle = green;
            ctx.lineCap = 'round';
            ctx.lineWidth = 0.55;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(0, -3.6);
            ctx.moveTo(0, -1.6);
            ctx.quadraticCurveTo(-1, -1.6, -1, -2.6);
            ctx.moveTo(0, -2.1);
            ctx.quadraticCurveTo(0.9, -2.1, 0.9, -3.1);
            ctx.stroke();
        },
        boulder(tint) {
            blob(tint('#b0603c'), 0, -0.9, 1.2, 0.95);
            blob(tint('#c7774d'), -0.3, -1.2, 0.55, 0.4);
        },
        mesa(tint) {
            shape(tint('#b9653f'), [[-9, 0], [-7, -9], [-6, -10], [5, -10], [6.5, -8.5], [9, 0]]);
            shape(tint('#a3552f'), [[-7, -9], [-6, -10], [5, -10], [6.5, -8.5]]);
        },
        pine(tint) {
            shape(tint('#5b3d26'), [[-0.25, 0], [-0.25, -1.4], [0.25, -1.4], [0.25, 0]]);
            shape(tint('#1f5a36'), [[-1.9, -1.2], [0, -4.2], [1.9, -1.2]]);
            shape(tint('#24683e'), [[-1.5, -3], [0, -5.8], [1.5, -3]]);
            shape(tint('#2c7848'), [[-1, -4.6], [0, -7.2], [1, -4.6]]);
        },
        birch(tint) {
            shape(tint('#ecebe4'), [[-0.18, 0], [-0.14, -4.5], [0.14, -4.5], [0.18, 0]]);
            ctx.fillStyle = tint('#3a3a3a');
            for (const y of [-1, -2.1, -3.3]) {
                ctx.fillRect(-0.16, y, 0.18, 0.12);
            }
            blob(tint('#7bbf4f'), 0, -5, 1.4, 1.5);
            blob(tint('#8fcf60'), 0.4, -5.5, 0.8, 0.8);
        },
        log(tint) {
            shape(tint('#7a5232'), [[-1.2, 0], [-1.2, -0.6], [1.2, -0.6], [1.2, 0]]);
            blob(tint('#c79a63'), 1.2, -0.3, 0.2, 0.3);
        },
        // A beach spot: a striped sun umbrella with a swim ring leaning on its pole, and a sun chair beside it
        beach(tint, thing) {
            const colors = BEACH_COLORS[Math.floor(Math.abs(thing.x) * 7) % BEACH_COLORS.length];
            blob(tint('#cbb27a'), 0.5, 0, 1.9, 0.18);
            // The sun chair: legs, then the cloth, lying back
            ctx.strokeStyle = tint('#e8e3d6');
            ctx.lineWidth = 0.07;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(-1.5, 0);
            ctx.lineTo(-1.3, -0.4);
            ctx.moveTo(-0.1, 0);
            ctx.lineTo(-0.2, -0.4);
            ctx.moveTo(-1.6, -0.4);
            ctx.lineTo(-0.1, -0.4);
            ctx.lineTo(0.35, -1.15);
            ctx.stroke();
            shape(tint(colors[0]), [[-1.55, -0.46], [-0.12, -0.46], [0.3, -1.12], [0.16, -1.18], [-0.22, -0.56], [-1.55, -0.56]]);
            shape(tint(colors[1]), [[-1.05, -0.46], [-0.6, -0.46], [-0.6, -0.56], [-1.05, -0.56]]);
            // The umbrella's pole, a little slanted, and its canopy in stripes
            ctx.strokeStyle = tint('#d9d4c7');
            ctx.lineWidth = 0.08;
            ctx.beginPath();
            ctx.moveTo(1.15, 0);
            ctx.lineTo(1.05, -2.7);
            ctx.stroke();
            const panels = 6;
            for (let i = 0; i < panels; i++) {
                const a = -1.6 + (3.2 * i) / panels;
                const b = -1.6 + (3.2 * (i + 1)) / panels;
                const top = x => -2.75 - 0.75 * (1 - (x / 1.6) ** 2);
                shape(tint(colors[i % 2]), [[1.05 + a, -2.6 + Math.abs(a) * 0.06], [1.05 + a, top(a)], [1.05 + (a + b) / 2, top((a + b) / 2)],
                    [1.05 + b, top(b)], [1.05 + b, -2.6 + Math.abs(b) * 0.06]]);
            }
            for (let i = 0; i < panels; i++) {
                const middle = -1.6 + (3.2 * (i + 0.5)) / panels;
                blob(tint(colors[i % 2]), 1.05 + middle, -2.62, 3.2 / panels / 2, 0.1);
            }
            blob(tint('#d9d4c7'), 1.05, -3.52, 0.07, 0.07);
            // The swim ring, leaning on the pole
            ctx.lineWidth = 0.2;
            ctx.lineCap = 'butt';
            for (let i = 0; i < 8; i++) {
                ctx.strokeStyle = tint(i % 2 ? '#f6f3ec' : colors[2]);
                ctx.beginPath();
                ctx.ellipse(1.45, -0.42, 0.34, 0.4, -0.25, (i * Math.PI) / 4, ((i + 1) * Math.PI) / 4);
                ctx.stroke();
            }
        },
        // A bend sign: black and yellow arrows pointing the way the road goes
        sign(tint, thing) {
            ctx.fillStyle = tint('#45474d');
            ctx.fillRect(-0.06, -1.1, 0.12, 1.1);
            ctx.fillStyle = tint('#f5c400');
            ctx.fillRect(-0.6, -1.7, 1.2, 0.6);
            ctx.fillStyle = tint('#1d1b24');
            const way = thing.left ? -1 : 1;
            for (const offset of [-0.32, 0.08]) {
                const at = offset * way;
                shape(tint('#1d1b24'), [[at - 0.1 * way, -1.62], [at + 0.15 * way, -1.4], [at - 0.1 * way, -1.18], [at, -1.4]]);
            }
        },
        // Chongqing: a tower of flats, its windows lit (the same ones each time, from where it stands)
        tower(tint, thing, size) {
            const seed = Math.floor(Math.abs(thing.x) * 1000);
            const tall = 16 + hash(seed) * 22;
            const half = 3.4 + hash(seed + 1) * 1.6;
            shape(tint(hash(seed + 2) < 0.5 ? '#2b3252' : '#343a5a'), [[-half, 0], [-half, -tall], [half, -tall], [half, 0]]);
            shape(tint('#232944'), [[half * 0.55, 0], [half * 0.55, -tall], [half, -tall], [half, 0]]);
            if (size > 1.4) {
                const warm = tint('#ffd27a');
                const cool = tint('#a8d8ff');
                let n = 0;
                for (let y = -tall + 1.2; y < -1.2; y += 1.6) {
                    for (let x = -half + 0.6; x < half - 0.6; x += 1.3) {
                        const on = hash(seed + 7 + n++);
                        if (on < 0.45) {
                            ctx.fillStyle = on < 0.08 ? cool : warm;
                            ctx.fillRect(x, y, 0.6, 0.75);
                        }
                    }
                }
            } else {
                ctx.fillStyle = tint('#6b6276');
                ctx.fillRect(-half * 0.7, -tall * 0.9, half * 1.2, tall * 0.8);
            }
            glow('rgba(255,70,70,0.8)', 0, -tall - 0.3, 0.35);
        },
        // A house on stilts on the hillside, floor over floor, each with its roof turned up at the ends
        stilt(tint) {
            ctx.fillStyle = tint('#3a2a22');
            for (const x of [-1.9, -0.7, 0.7, 1.9]) {
                ctx.fillRect(x - 0.1, -1.6, 0.2, 1.6);
            }
            for (const [half, bottom] of [[2.2, -1.6], [1.95, -3.5], [1.65, -5.4]]) {
                shape(tint('#6e412b'), [[-half, bottom], [-half, bottom - 1.5], [half, bottom - 1.5], [half, bottom]]);
                ctx.fillStyle = tint('#ffc46b');
                for (let x = -half + 0.3; x < half - 0.4; x += 0.7) {
                    ctx.fillRect(x, bottom - 1.15, 0.45, 0.75);
                }
                const eave = bottom - 1.4;
                shape(tint('#2c2a32'), [[-half - 0.75, eave - 0.3], [-half - 0.3, eave + 0.05], [half + 0.3, eave + 0.05],
                    [half + 0.75, eave - 0.3], [half - 0.1, eave - 0.6], [-half + 0.1, eave - 0.6]]);
            }
            for (const x of [-1.35, 1.35]) {
                blob(tint('#e0362c'), x, -3.05, 0.22, 0.26);
                glow('rgba(255,120,60,0.22)', x, -3.05, 0.7);
            }
        },
        // A post with two red lanterns
        lantern(tint) {
            ctx.fillStyle = tint('#2b2b31');
            ctx.fillRect(-0.07, -3.3, 0.14, 3.3);
            ctx.fillRect(-0.85, -3.3, 1.7, 0.1);
            for (const x of [-0.62, 0.62]) {
                ctx.fillRect(x - 0.015, -3.2, 0.03, 0.2);
                blob(tint('#d8322b'), x, -2.65, 0.3, 0.36);
                ctx.fillStyle = tint('#e8b04a');
                ctx.fillRect(x - 0.16, -3.03, 0.32, 0.07);
                ctx.fillRect(x - 0.16, -2.33, 0.32, 0.07);
                glow('rgba(255,90,60,0.25)', x, -2.65, 0.85);
            }
        },
        // A big fig tree, wide and round
        ficus(tint) {
            shape(tint('#5a4a3c'), [[-0.45, 0], [-0.3, -2.2], [-0.85, -3.2], [-0.6, -3.35], [0, -2.6], [0.55, -3.4], [0.8, -3.2],
                [0.3, -2.2], [0.45, 0]]);
            blob(tint('#2c5538'), -1.1, -4, 1.8, 1.3);
            blob(tint('#326040'), 1.1, -4.2, 1.9, 1.4);
            blob(tint('#3a6d48'), 0, -4.9, 1.8, 1.25);
        },
        pillar(tint) {
            shape(tint('#8a8c96'), [[-0.5, 0], [-0.42, -7.4], [0.42, -7.4], [0.5, 0]]);
            shape(tint('#70727c'), [[0.15, 0], [0.12, -7.4], [0.42, -7.4], [0.5, 0]]);
            ctx.fillStyle = tint('#9a9ca6');
            ctx.fillRect(-1, -7.75, 2, 0.4);
        },
        // The monorail across the road, high on its beam, and its train going by
        monorail(tint, thing) {
            ctx.fillStyle = tint('#7c7f8a');
            for (const x of [-96, -64, -32, 32, 64, 96]) {
                ctx.fillRect(x - 0.45, -7.4, 0.9, 7.4);
            }
            ctx.fillStyle = tint('#a3a5ae');
            ctx.fillRect(-140, -8.7, 280, 1.1);
            ctx.fillStyle = tint('#6d707b');
            ctx.fillRect(-140, -7.8, 280, 0.25);
            const way = thing.phase < 0.5 ? 1 : -1;
            const at = way * ((((performance.now() / 1000) * 20 + thing.phase * 150) % 150) - 75);
            for (let car = -1; car <= 1; car++) {
                const middle = at + car * 15.4;
                shape(tint('#eceef2'), [[middle - 7.5, -8.4], [middle - 7.5, -11.4], [middle + 7.5, -11.4], [middle + 7.5, -8.4]]);
                if (car !== 0) {
                    // The rounded nose at both ends of the train
                    const end = middle + car * 7.5;
                    shape(tint('#eceef2'), [[end, -8.4], [end, -11.4], [end + car * 1.2, -10.6], [end + car * 1.5, -8.4]]);
                    ctx.fillStyle = tint('#2a3042');
                    ctx.fillRect(end + (car > 0 ? 0 : -1.1), -10.9, 1.1, 0.9);
                }
                ctx.fillStyle = tint('#d23a3a');
                ctx.fillRect(middle - 7.5, -9.1, 15, 0.35);
                ctx.fillStyle = tint('#ffe7a8');
                for (let x = middle - 6.6; x < middle + 6.4; x += 1.6) {
                    ctx.fillRect(x, -11, 1.1, 1.3);
                }
            }
        }
    };


    // On the road (medium and hard courses), seen from behind, in the bikes' flat look

    const OBSTACLE_SCALE = 1.4; // bigger than they are, as the bikes are, to be seen in time (track.js counts them so)
    const BEACH_COLORS = [['#e5484d', '#f6f3ec', '#ff8fb1'], ['#2fa7c9', '#f6f3ec', '#f5c400'], ['#f5a524', '#e5484d', '#3fc1a5'],
        ['#3e7bfa', '#f6f3ec', '#ff6b3d']];
    const TRUCK_COLORS = ['#f1efe8', '#2f6fb5', '#c43c3c', '#3f8a4f', '#e8892f'];
    const MOPED_COLORS = ['#e5484d', '#f1efe8', '#3e7bfa', '#2fb36d', '#f5c400'];
    const CAR_COLORS = ['#d9dde4', '#2f6fb5', '#c43c3c', '#f1efe8', '#3a3d45', '#e0b33a'];
    const ROCK_COLORS = [['#7a7380', '#958d9a', '#57505d'], ['#6e6a66', '#8c8781', '#504c48']];

    function drawObstacle(thing, p, size, look) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.scale(size, size);
        switch (thing.kind) {
            case 'car':
                drawCar(thing.look, look.lights);
                break;
            case 'truck':
                drawTruck(thing.look, look.lights);
                break;
            case 'moped':
                drawMoped(thing.look);
                break;
            case 'rockslide':
                // Stones fallen onto the road, a heap of them and some rolled further
                blob('rgba(0,0,0,0.3)', 0, 0, 1.05, 0.12);
                for (const [x, y, w, h, color] of [[-0.6, 0, 0.42, 0.5, '#7d766d'], [0.55, 0, 0.45, 0.55, '#6f685f'], [0, 0, 0.55, 0.8, '#8a8379'],
                    [-0.25, -0.45, 0.32, 0.38, '#958e84'], [0.3, -0.5, 0.3, 0.32, '#7d766d'], [0.02, -0.82, 0.24, 0.26, '#a39c91']]) {
                    shape(color, [[x - w, y], [x - w * 0.95, y - h * 0.55], [x - w * 0.45, y - h], [x + w * 0.4, y - h * 0.95], [x + w, y - h * 0.4], [x + w * 0.9, y]]);
                    shape('rgba(255,255,255,0.12)', [[x - w * 0.95, y - h * 0.55], [x - w * 0.45, y - h], [x + w * 0.4, y - h * 0.95], [x, y - h * 0.6]]);
                }
                for (const [x, r] of [[-1.15, 0.1], [-0.95, 0.07], [1.05, 0.12], [1.25, 0.08], [0.85, 0.06]]) {
                    blob('#857e74', x, -r * 0.8, r, r * 0.8);
                }
                break;
            case 'sledge':
                // A wooden sledge hauling a cut stone block, tied down with ropes; the tips of its runners curl up past it
                blob('rgba(0,0,0,0.3)', 0, 0, 1.0, 0.12);
                for (const side of [-1, 1]) {
                    shape('#5a3a22', [[side * 0.62, -0.2], [side * 0.6, -0.5], [side * 0.66, -0.68], [side * 0.76, -0.66], [side * 0.72, -0.5], [side * 0.74, -0.2]]);
                    shape('#4a2f1b', [[side * 0.6, 0], [side * 0.6, -0.2], [side * 0.8, -0.2], [side * 0.8, 0]]);
                }
                shape('#8a5a32', [[-0.88, -0.17], [-0.88, -0.33], [0.88, -0.33], [0.88, -0.17]]);
                for (const x of [-0.45, 0, 0.45]) {
                    shape('#6e4626', [[x - 0.015, -0.17], [x - 0.015, -0.33], [x + 0.015, -0.33], [x + 0.015, -0.17]]);
                }
                shape('#9a948a', [[-0.62, -0.33], [-0.6, -1.12], [0.58, -1.14], [0.62, -0.33]]);
                shape('#7f796f', [[0.3, -0.33], [0.29, -1.135], [0.58, -1.14], [0.62, -0.33]]);
                shape('#b3ada2', [[-0.6, -1.12], [-0.48, -1.22], [0.66, -1.24], [0.58, -1.14]]);
                shape('rgba(255,255,255,0.14)', [[-0.6, -0.4], [-0.59, -1.1], [-0.5, -1.1], [-0.52, -0.4]]);
                ctx.strokeStyle = '#c9a46a';
                ctx.lineWidth = 0.05;
                ctx.beginPath();
                for (const x of [-0.3, 0.32]) {
                    ctx.moveTo(x, -0.33);
                    ctx.lineTo(x, -1.13);
                }
                ctx.moveTo(-0.61, -0.75);
                ctx.lineTo(0.61, -0.72);
                ctx.stroke();
                break;
            case 'rock': {
                const [body, lit, dark] = ROCK_COLORS[Math.floor(thing.look * 2)];
                blob('rgba(0,0,0,0.3)', 0, 0, 0.95, 0.1);
                shape(body, [[-0.82, 0], [-0.88, -0.36], [-0.58, -0.8], [-0.12, -0.98], [0.38, -0.86], [0.78, -0.5], [0.84, 0]]);
                shape(lit, [[-0.58, -0.8], [-0.12, -0.98], [0.38, -0.86], [0.1, -0.62], [-0.4, -0.58]]);
                shape(dark, [[0.38, -0.86], [0.78, -0.5], [0.84, 0], [0.42, 0], [0.3, -0.45]]);
                shape(body, [[0.62, 0], [0.7, -0.22], [0.98, -0.28], [1.12, 0]]);
                shape(dark, [[-1.15, 0], [-1.05, -0.2], [-0.84, -0.18], [-0.8, 0]]);
                break;
            }
            case 'stump':
                blob('rgba(0,0,0,0.3)', 0, 0, 0.66, 0.09);
                shape('#5b3f2b', [[-0.68, 0], [-0.5, -0.12], [-0.48, -0.62], [0.48, -0.62], [0.5, -0.12], [0.68, 0]]);
                shape('#4a3322', [[-0.2, -0.04], [-0.16, -0.6], [-0.08, -0.6], [-0.1, -0.04]]);
                shape('#4a3322', [[0.22, -0.04], [0.26, -0.6], [0.34, -0.6], [0.3, -0.04]]);
                blob('#c9a27a', 0, -0.62, 0.48, 0.15);
                ctx.strokeStyle = '#9e7650';
                ctx.lineWidth = 0.03;
                ctx.beginPath();
                ctx.ellipse(0, -0.62, 0.3, 0.09, 0, 0, Math.PI * 2);
                ctx.ellipse(0, -0.62, 0.14, 0.04, 0, 0, Math.PI * 2);
                ctx.stroke();
                break;
            case 'baskets':
                // Bamboo baskets, one on two, the top one full of oranges
                blob('rgba(0,0,0,0.3)', 0, 0, 0.85, 0.1);
                for (const [x, y] of [[-0.4, 0], [0.4, 0], [0, -0.52]]) {
                    shape('#b98a4c', [[x - 0.36, y], [x - 0.42, y - 0.52], [x + 0.42, y - 0.52], [x + 0.36, y]]);
                    ctx.strokeStyle = '#8a6230';
                    ctx.lineWidth = 0.035;
                    ctx.beginPath();
                    for (const s of [-0.26, -0.09, 0.09, 0.26]) {
                        ctx.moveTo(x + s, y);
                        ctx.lineTo(x + s * 1.15, y - 0.52);
                    }
                    ctx.moveTo(x - 0.39, y - 0.26);
                    ctx.lineTo(x + 0.39, y - 0.26);
                    ctx.stroke();
                    shape('#d6aa66', [[x - 0.44, y - 0.5], [x - 0.44, y - 0.58], [x + 0.44, y - 0.58], [x + 0.44, y - 0.5]]);
                }
                for (const [x, y] of [[-0.24, -1.13], [0, -1.17], [0.24, -1.13], [-0.12, -1.28], [0.12, -1.28]]) {
                    blob('#f28a22', x, y, 0.13, 0.12);
                }
                break;
            case 'crabs': {
                // Three red crabs crossing the road, snapping their claws
                const now = performance.now() / 1000;
                for (const [i, x] of [-0.82, 0.05, 0.86].entries()) {
                    const at = x + (thing.look * 7 + i) % 1 * 0.16 - 0.08;
                    const snap = Math.sin(now * 9 + i * 2.1) * 0.04;
                    const step = Math.sin(now * 14 + i) * 0.03;
                    blob('rgba(0,0,0,0.28)', at, 0, 0.34, 0.06);
                    ctx.strokeStyle = '#b9301c';
                    ctx.lineWidth = 0.045;
                    ctx.lineCap = 'round';
                    ctx.beginPath();
                    for (const side of [-1, 1]) {
                        for (const [k, out] of [0.22, 0.29, 0.34].entries()) {
                            ctx.moveTo(at + side * 0.12, -0.16 + k * 0.03);
                            ctx.lineTo(at + side * out, -0.2 + k * 0.03 + (k % 2 ? step : -step));
                            ctx.lineTo(at + side * (out + 0.05), 0);
                        }
                        // The arms up to the claws
                        ctx.moveTo(at + side * 0.14, -0.24);
                        ctx.lineTo(at + side * 0.3, -0.38 + snap);
                    }
                    ctx.stroke();
                    blob('#e2492b', at, -0.22, 0.24, 0.14);
                    blob('#f0704a', at - 0.04, -0.27, 0.12, 0.06);
                    for (const side of [-1, 1]) {
                        blob('#e85a33', at + side * 0.32, -0.45 + snap, 0.1, 0.085);
                        ctx.strokeStyle = '#8f2414';
                        ctx.lineWidth = 0.025;
                        ctx.beginPath();
                        ctx.moveTo(at + side * 0.32, -0.53 + snap);
                        ctx.lineTo(at + side * 0.33, -0.44 + snap);
                        ctx.stroke();
                        // Eyes on stalks
                        ctx.strokeStyle = '#b9301c';
                        ctx.lineWidth = 0.03;
                        ctx.beginPath();
                        ctx.moveTo(at + side * 0.06, -0.33);
                        ctx.lineTo(at + side * 0.08, -0.43);
                        ctx.stroke();
                        blob('#1b1b20', at + side * 0.08, -0.45, 0.04, 0.04);
                        blob('#ffffff', at + side * 0.07, -0.465, 0.013, 0.013);
                    }
                }
                break;
            }
            case 'cones':
                for (const x of [-0.85, 0, 0.85]) {
                    blob('rgba(0,0,0,0.28)', x, 0, 0.3, 0.06);
                    shape('#24252b', [[x - 0.24, 0], [x - 0.24, -0.06], [x + 0.24, -0.06], [x + 0.24, 0]]);
                    shape('#f26a1b', [[x - 0.17, -0.06], [x - 0.04, -0.74], [x + 0.04, -0.74], [x + 0.17, -0.06]]);
                    shape('#f4f4f0', [[x - 0.13, -0.3], [x - 0.09, -0.48], [x + 0.09, -0.48], [x + 0.13, -0.3]]);
                }
                break;
            default:
        }
        ctx.restore();
    }

    // A car standing on the road, its hazard lights blinking
    function drawCar(look, lights) {
        const body = CAR_COLORS[Math.floor(look * CAR_COLORS.length)];
        blob('rgba(0,0,0,0.32)', 0, 0, 1.12, 0.12);
        shape('#18181c', [[-0.92, 0], [-0.92, -0.36], [-0.6, -0.36], [-0.6, 0]]);
        shape('#18181c', [[0.6, 0], [0.6, -0.36], [0.92, -0.36], [0.92, 0]]);
        shape(body, [[-0.97, -0.24], [-1, -0.86], [-0.84, -0.94], [0.84, -0.94], [1, -0.86], [0.97, -0.24]]);
        shape('rgba(0,0,0,0.18)', [[-0.84, -0.94], [-0.66, -1.42], [0.66, -1.42], [0.84, -0.94]]);
        shape(body, [[-0.8, -0.92], [-0.64, -1.4], [0.64, -1.4], [0.8, -0.92]]);
        shape('#27303c', [[-0.68, -0.96], [-0.55, -1.33], [0.55, -1.33], [0.68, -0.96]]);
        shape('rgba(255,255,255,0.16)', [[-0.5, -1.0], [-0.38, -1.3], [-0.2, -1.3], [-0.32, -1.0]]);
        shape('#2a2b31', [[-0.98, -0.24], [-0.98, -0.4], [0.98, -0.4], [0.98, -0.24]]);
        shape('#f2f2ea', [[-0.22, -0.44], [-0.22, -0.56], [0.22, -0.56], [0.22, -0.44]]);
        const blinking = performance.now() % 900 < 450;
        for (const side of [-1, 1]) {
            shape('#b01e24', [[side * 0.7, -0.64], [side * 0.7, -0.8], [side * 0.95, -0.8], [side * 0.95, -0.64]]);
            shape(blinking ? '#ffb020' : '#8a5a1a', [[side * 0.7, -0.54], [side * 0.7, -0.63], [side * 0.95, -0.63], [side * 0.95, -0.54]]);
        }
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (const side of [-1, 1]) {
            if (lights > 0.3) {
                blob('rgba(255,50,50,0.35)', side * 0.82, -0.72, 0.32, 0.16);
            }
            if (blinking) {
                blob(`rgba(255,170,40,${0.35 + lights * 0.35})`, side * 0.82, -0.58, 0.4 + lights * 0.25, 0.2 + lights * 0.1);
            }
        }
        ctx.restore();
    }

    // A truck standing on the road, from behind: its box with two doors, hazard lights blinking
    function drawTruck(look, lights) {
        const body = TRUCK_COLORS[Math.floor(look * TRUCK_COLORS.length)];
        blob('rgba(0,0,0,0.32)', 0, 0, 1.15, 0.13);
        for (const side of [-1, 1]) {
            shape('#18181c', [[side * 0.55, 0], [side * 0.55, -0.4], [side * 0.98, -0.4], [side * 0.98, 0]]);
        }
        shape('#2a2b31', [[-1.02, -0.3], [-1.02, -0.46], [1.02, -0.46], [1.02, -0.3]]);
        shape(body, [[-1.06, -0.46], [-1.06, -2.35], [1.06, -2.35], [1.06, -0.46]]);
        shape('rgba(0,0,0,0.14)', [[-1.06, -2.35], [-1.06, -2.25], [1.06, -2.25], [1.06, -2.35]]);
        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        ctx.lineWidth = 0.03;
        ctx.beginPath();
        ctx.moveTo(0, -0.5);
        ctx.lineTo(0, -2.25);
        ctx.rect(-0.98, -2.25, 1.96, 1.75);
        ctx.stroke();
        for (const side of [-1, 1]) {
            shape('#9a9ca4', [[side * 0.12, -1.25], [side * 0.12, -1.5], [side * 0.18, -1.5], [side * 0.18, -1.25]]);
        }
        shape('#f2f2ea', [[-0.22, -0.32], [-0.22, -0.44], [0.22, -0.44], [0.22, -0.32]]);
        const blinking = performance.now() % 900 < 450;
        for (const side of [-1, 1]) {
            shape('#b01e24', [[side * 0.72, -0.48], [side * 0.72, -0.6], [side * 0.98, -0.6], [side * 0.98, -0.48]]);
            shape(blinking ? '#ffb020' : '#8a5a1a', [[side * 0.72, -0.62], [side * 0.72, -0.72], [side * 0.98, -0.72], [side * 0.98, -0.62]]);
        }
        if (blinking && lights > 0.3) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            for (const side of [-1, 1]) {
                blob('rgba(255,170,40,0.35)', side * 0.85, -0.67, 0.4, 0.2);
            }
            ctx.restore();
        }
    }

    // A moped parked on its stand, from behind: wheel, seat, a box on the back, the handlebar and mirrors over it
    function drawMoped(look) {
        const body = MOPED_COLORS[Math.floor(look * MOPED_COLORS.length)];
        blob('rgba(0,0,0,0.3)', 0, 0, 0.42, 0.08);
        ctx.strokeStyle = '#2a2b31';
        ctx.lineWidth = 0.04;
        ctx.beginPath();
        ctx.moveTo(-0.42, -1.12);
        ctx.lineTo(0.42, -1.12);
        for (const side of [-1, 1]) {
            ctx.moveTo(side * 0.36, -1.12);
            ctx.lineTo(side * 0.42, -1.32);
        }
        ctx.stroke();
        for (const side of [-1, 1]) {
            blob('#2a2b31', side * 0.43, -1.36, 0.07, 0.05);
        }
        shape('#1c1c20', [[-0.08, 0], [-0.09, -0.42], [0.09, -0.42], [0.08, 0]]);
        shape(body, [[-0.3, -0.36], [-0.34, -0.66], [-0.22, -0.8], [0.22, -0.8], [0.34, -0.66], [0.3, -0.36]]);
        shape('#24252b', [[-0.24, -0.8], [-0.22, -0.88], [0.22, -0.88], [0.24, -0.8]]);
        shape('#b01e24', [[-0.1, -0.5], [-0.1, -0.58], [0.1, -0.58], [0.1, -0.5]]);
        shape('#ececec', [[-0.24, -0.88], [-0.26, -1.22], [0.26, -1.22], [0.24, -0.88]]);
        shape(body, [[-0.26, -1.12], [-0.26, -1.22], [0.26, -1.22], [0.26, -1.12]]);
        shape('rgba(0,0,0,0.3)', [[-0.04, 0], [-0.3, 0.0], [-0.26, -0.05], [-0.04, -0.12]]); // its stand
    }

    // A banner across the road on two posts
    function drawGate(text, entry, y, size, cameraX) {
        const middle = width / 2 + (entry.roadX - cameraX) * entry.scale1;
        const half = (Track.ROAD + 0.5) * size;
        ctx.fillStyle = '#2b2b33';
        ctx.fillRect(middle - half - 0.15 * size, y - 5.6 * size, 0.3 * size, 5.6 * size);
        ctx.fillRect(middle + half - 0.15 * size, y - 5.6 * size, 0.3 * size, 5.6 * size);
        const top = y - 5.8 * size;
        const tall = 1.25 * size;
        ctx.fillStyle = text === 'GOAL' ? '#e5484d' : '#1f1d2a';
        ctx.fillRect(middle - half, top, half * 2, tall);
        const squares = 16;
        for (let i = 0; i < squares; i++) {
            ctx.fillStyle = i % 2 ? '#f2f2f2' : '#22242a';
            ctx.fillRect(middle - half + (i * half * 2) / squares, top + tall, (half * 2) / squares + 0.5, 0.22 * size);
            ctx.fillStyle = i % 2 ? '#22242a' : '#f2f2f2';
            ctx.fillRect(middle - half + (i * half * 2) / squares, top - 0.22 * size, (half * 2) / squares + 0.5, 0.22 * size);
        }
        if (tall > 6) {
            ctx.fillStyle = '#ffffff';
            ctx.font = `700 ${Math.round(tall * 0.72)}px Fredoka, system-ui, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, middle, top + tall * 0.54);
            ctx.textBaseline = 'alphabetic';
        }
    }

    // A motorcycle with its rider, seen from behind. x, y: where its wheel touches the road; scale: pixels per meter; lift:
    // pixels it is above the road (on a ramp or flying), its shadow staying on the road.
    function drawBike(x, y, scale, color, lean, braking, name, lights = 0, lift = 0) {
        if (scale < 0.5) {
            return;
        }
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(scale, scale);
        const away = Math.max(0.35, 1 - lift / scale * 0.25); // the shadow smaller the higher it flies
        blob(`rgba(0,0,0,${0.28 * away})`, 0, 0, 0.42 * away, 0.07 * away);
        ctx.translate(0, -lift / scale);
        ctx.rotate(lean);
        // Tyre and mudguard
        shape('#1c1c20', [[-0.11, 0], [-0.13, -0.5], [0.13, -0.5], [0.11, 0]]);
        // Exhausts
        shape('#8d929c', [[-0.36, -0.36], [-0.36, -0.5], [-0.2, -0.52], [-0.2, -0.36]]);
        shape('#8d929c', [[0.36, -0.36], [0.36, -0.5], [0.2, -0.52], [0.2, -0.36]]);
        // Tail and seat
        shape(color, [[-0.28, -0.5], [-0.32, -0.72], [-0.12, -0.84], [0.12, -0.84], [0.32, -0.72], [0.28, -0.5]]);
        shape(braking ? '#ff3b30' : '#a3202a', [[-0.16, -0.6], [-0.16, -0.68], [0.16, -0.68], [0.16, -0.6]]);
        if (braking) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            blob(lights > 0.3 ? 'rgba(255,70,60,0.6)' : 'rgba(255,70,60,0.35)', 0, -0.64, 0.4, 0.14);
            ctx.restore();
        }
        // Rider: legs, back, arms out to the bars, helmet
        shape('#2a2b33', [[-0.33, -0.62], [-0.26, -0.98], [-0.1, -0.98], [-0.16, -0.62]]);
        shape('#2a2b33', [[0.33, -0.62], [0.26, -0.98], [0.1, -0.98], [0.16, -0.62]]);
        shape(color, [[-0.3, -0.92], [-0.34, -1.3], [-0.2, -1.42], [0.2, -1.42], [0.34, -1.3], [0.3, -0.92]]);
        shape('rgba(255,255,255,0.28)', [[-0.05, -0.94], [-0.05, -1.4], [0.05, -1.4], [0.05, -0.94]]);
        shape('#2a2b33', [[-0.34, -1.3], [-0.48, -1.12], [-0.42, -1.06], [-0.28, -1.22]]);
        shape('#2a2b33', [[0.34, -1.3], [0.48, -1.12], [0.42, -1.06], [0.28, -1.22]]);
        blob(color, 0, -1.56, 0.2, 0.19);
        blob('rgba(255,255,255,0.35)', -0.06, -1.62, 0.07, 0.05);
        ctx.restore();
        if (name) {
            const size = Math.max(10, Math.min(15, scale * 0.24));
            ctx.font = `600 ${size}px Fredoka, system-ui, sans-serif`;
            ctx.textAlign = 'center';
            ctx.lineWidth = 3;
            ctx.strokeStyle = 'rgba(20,20,26,0.75)';
            ctx.fillStyle = '#ffffff';
            const top = y - lift - scale * 1.85;
            ctx.strokeText(name, x, top);
            ctx.fillText(name, x, top);
        }
    }

    return {setUp, resize, draw, RIDER_COLORS, LOOKS};
})();
