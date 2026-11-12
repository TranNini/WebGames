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
        }
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
        const look = LOOKS[track.key];
        const upright = height > width;
        // Sideways, the camera comes closer: the road and the bikes fill more of the wide screen, with less sky
        const horizon = height * (upright ? 0.3 : 0.33);
        const bikeY = height * (upright ? 0.86 : 0.9);
        // The road at the bike takes most of the width; the camera's height follows from where the bike is on screen
        const focal = (upright ? width * 0.74 : Math.min(width * 0.86, height * 2.2)) * CAMERA_BACK / (2 * Track.ROAD);
        const cameraHeight = (bikeY - horizon) * CAMERA_BACK / focal;
        const cameraZ = bike.z - CAMERA_BACK;
        const cameraY = Track.heightAt(track, bike.z) + cameraHeight;
        const cameraX = bike.x;
        // Bikes are drawn bigger than they are, to be seen well, but the own one no taller than a fifth of the screen
        // (a phone sideways, where the screen is low: a third; a tablet sideways: a quarter)
        const tallest = upright ? 0.21 : height < 500 ? 0.32 : 0.24;
        const bikeScale = Math.min(BIKE_SCALE, height * tallest / 1.8 / (focal / CAMERA_BACK));

        skyShift += view.turned;
        drawSky(look, horizon, upright);

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
                    drawBike(width / 2, bikeY, focal / CAMERA_BACK * bikeScale, RIDER_COLORS[view.color], lean, view.braking, null,
                        look.lights);
                    continue;
                }
                const t = Math.max(0, Math.min(1, (other.ahead - entry.z1) / Track.SEGMENT));
                const scale = focal / Math.max(1, other.ahead);
                const roadX = entry.roadX + entry.roadDx * t;
                const sx = width / 2 + (roadX + other.x - cameraX) * scale;
                const sy = entry.y1 + (entry.y2 - entry.y1) * t;
                clipped(entry.clip, () => drawBike(sx, sy, scale * bikeScale, other.color, other.lean, other.braking, other.name,
                    look.lights));
            }
        }

    }

    const haze = n => Math.min(1, (n / DRAW_SEGMENTS) ** 1.6);

    function clipped(clipY, paint) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, width, clipY);
        ctx.clip();
        paint();
        ctx.restore();
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
        if (look.sea) {
            ctx.fillStyle = look.sea; // in front of the far hills, so it is seen
            ctx.fillRect(0, horizon - Math.max(6, horizon * 0.07), width, Math.max(6, horizon * 0.07) + 2);
        } else {
            hills(look.hills[1], horizon, horizon * 0.12, skyShift * 0.7, 0.019, 1.7);
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
        const sy = entry.y1;
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
            THINGS[thing.kind](tint, thing);
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

    // What stands beside the road, in meters from where it stands
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
        }
    };


    // On the road (medium and hard courses), seen from behind, in the bikes' flat look

    const OBSTACLE_SCALE = 1.4; // bigger than they are, as the bikes are, to be seen in time (track.js counts them so)
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

    // A motorcycle with its rider, seen from behind. x, y: where its wheel touches the road; scale: pixels per meter.
    function drawBike(x, y, scale, color, lean, braking, name, lights = 0) {
        if (scale < 0.5) {
            return;
        }
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(scale, scale);
        blob('rgba(0,0,0,0.28)', 0, 0, 0.42, 0.07);
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
            const top = y - scale * 1.85;
            ctx.strokeText(name, x, top);
            ctx.fillText(name, x, top);
        }
    }

    return {setUp, resize, draw, RIDER_COLORS, LOOKS};
})();
