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
        turboFlame = view.bike.turbo > 0;
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

    // Tianmen to Chongqing, drawn as the html test draws it (tianmen-to-chongqing-course.html), 1:1: its camera, its 2 m
    // steps, its colors, its light. The mountain: on the left a forest slope 22 m high, darker forest above it; on the right
    // a stone wall down to the valley floor, a river with Chinese boats on it; guardrails on both sides, a parapet with
    // blocks while the valley is deep. In a tunnel: a concrete gallery, pillars with orange lamps every fourth step, the
    // valley seen between them, beams and a red neon line under its roof. Far off, the sky, clouds and four layers of
    // green peaks, rising as the road goes down; day turns to dusk, the peaks fade and Chongqing's towers rise before the
    // last tunnel. Then Chongqing at night, the river just below the road on both sides, boats with lit decks on it and
    // the lights' reflections; far off violet hills, the city's towers and the stars coming out. Along the bridge's first
    // 600 m a hillside of old houses on the left: stilted floors with warm windows, balconies, lanterns and tiled eaves on
    // a lavender retaining wall; then the riverside, lights in the rails and lamp posts, their light on the wet road.
    const DESCENT = {
        cameraHigh: 2, cameraBack: 6.5, near: 0.52, ahead: 220, behind: 30, kerb: 1.12, roof: 6.7,
        bike: 0.81, // the bikes as tall as the test's riders (1.42 m)
        px: 1 / 1.5 // the test drew in device pixels, up to 1.5 to a CSS pixel; we draw in CSS pixels
    };
    const hexRgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
    // The sky by the time of day (0 day, 0.34 sunset, 0.66 dusk, 1 night); the city's colors by day and by night
    const DESCENT_SKY = [[0, ['#2a74e6', '#5b9bf0', '#c4def8']], [0.34, ['#2e3f9c', '#7a4fa8', '#ff9f7a']],
        [0.66, ['#1b2160', '#4a3a96', '#d86aa0']], [1, ['#070c2c', '#0f1a54', '#3a3f8a']]].map(([t, c]) => [t, c.map(hexRgb)]);
    const CITY_COLORS = {
        asph: [[90, 94, 126], [30, 32, 52]], asph2: [[92, 96, 128], [31, 33, 53]], kerb: [[128, 120, 158], [58, 50, 88]],
        rail: [[182, 169, 198], [112, 98, 142]], railD: [[142, 128, 162], [70, 60, 100]], water: [[74, 106, 208], [16, 24, 96]],
        line: [[244, 244, 251], [206, 208, 234]]
    };
    // On the mountain: a pale road and rails; its blue sky, turning to dusk
    const MOUNTAIN_COLORS = {asph: [182, 182, 176], asph2: [188, 188, 182], kerb: [208, 206, 196], line: [238, 236, 226], rail: [188, 182, 164],
        railD: [150, 144, 126]};
    const MOUNTAIN_SKY = [[118, 158, 214], [176, 204, 230], [214, 228, 236]];
    const DUSK_SKY = [[50, 42, 124], [150, 82, 152], [240, 150, 142]];
    // The city's sky as the night comes in (from the bridge on, over 3.4 km): its top, middle and horizon, at first and at last
    const CITY_SKY = [[[54, 38, 116], [14, 12, 62]], [[146, 80, 158], [54, 34, 112]], [[228, 152, 174], [118, 72, 152]]];
    // The hillside houses: their fronts' colors, their roofs', and how far off the road each of their four tiers stands
    // (in half road widths)
    const CITY_FRONTS = [[158, 88, 84], [138, 80, 116], [114, 86, 148], [170, 98, 86], [100, 86, 142]];
    const CITY_ROOFS = [[60, 40, 84], [98, 52, 58], [74, 46, 70]];
    const CITY_TIERS = [2.1, 3.1, 4.3, 6.0];
    // The far hills behind the city: per layer, its waves (how many, how high, phase)
    const CITY_HILLS = [[[3, 1, 0.4], [7, 0.5, 2.1], [13, 0.25, 4.4]], [[4, 1, 1.3], [9, 0.5, 3.7], [17, 0.25, 0.6]],
        [[5, 1, 2.2], [11, 0.5, 0.9], [19, 0.25, 5.1]]];
    const CLOUDS = [[0.05, 0.2, 0.34], [0.28, 0.34, 0.16], [0.5, 0.16, 0.3], [0.72, 0.3, 0.18], [0.9, 0.12, 0.26],
        [1.15, 0.28, 0.2], [1.4, 0.14, 0.3], [1.65, 0.34, 0.15]];
    const roadX = new Float64Array(DESCENT.ahead + DESCENT.behind + 2); // the road's middle, m sideways, step by step
    const roadZ = new Float64Array(DESCENT.ahead + DESCENT.behind + 2); // how far ahead of the camera, m
    let farShift = 0; // the far view's turn, px, and eased
    let farShiftSmooth = 0;
    let descentLayers = null;
    let descentCity = null;
    let descentGlow = null;
    let descentLamp = null;
    const cities = new WeakMap(); // the hillside houses and the boats of each course, as laid out
    // The light where the camera is: time of day, how dark, the sky, the haze far off, the road's colors; on the mountain
    // (mountain: 1 there, 0 in the city) how far into dusk, how far Chongqing has risen, how far the peaks have faded; in the
    // city how far into the night (cityNight, 0 to 1)
    const light = {tod: 0, night: 0, sky: MOUNTAIN_SKY, haze: MOUNTAIN_SKY[2], colors: {}, mountain: 1, dusk: 0, city: 0, fade: 0,
        cityNight: 0};

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
    const hazed = (c, f) => rgb(rgbMix(c, light.haze, f));
    const smoothStep = (a, b, x) => {
        const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
        return t * t * (3 - 2 * t);
    };

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
        paint(c.getContext('2d'), w, h);
        return c;
    }

    function roundRect(c, x, y, w, h, r) {
        c.beginPath();
        if (c.roundRect) {
            c.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2));
        } else {
            c.rect(x, y, w, h);
        }
    }

    // The light at step p, as the test's setLight
    function setLight(d, p) {
        const mids = d.stretches.map(s => [(s.start + s.end) / 2, s.tod]);
        let tod = mids[mids.length - 1][1];
        if (p <= mids[0][0]) {
            tod = mids[0][1];
        } else {
            for (let k = 0; k < mids.length - 1; k++) {
                if (p < mids[k + 1][0]) {
                    tod = mids[k][1] + (mids[k + 1][1] - mids[k][1]) * smoothStep(0, 1, (p - mids[k][0]) / (mids[k + 1][0] - mids[k][0]));
                    break;
                }
            }
        }
        let k = 0;
        while (k < DESCENT_SKY.length - 2 && tod > DESCENT_SKY[k + 1][0]) {
            k++;
        }
        const along = Math.max(0, Math.min(1, (tod - DESCENT_SKY[k][0]) / (DESCENT_SKY[k + 1][0] - DESCENT_SKY[k][0])));
        const sky = DESCENT_SKY[k][1].map((c, j) => rgbMix(c, DESCENT_SKY[k + 1][1][j], along));
        light.tod = tod;
        light.night = smoothStep(0.22, 0.9, tod);
        for (const key in CITY_COLORS) {
            light.colors[key] = rgbMix(CITY_COLORS[key][0], CITY_COLORS[key][1], light.night);
        }
        const mountain = d.stretches[0];
        light.mountain = 1 - smoothStep(mountain.end - 60, mountain.end + 60, p);
        light.dusk = light.city = light.fade = 0;
        light.sky = sky;
        light.haze = sky[2];
        if (light.mountain > 0) {
            for (const key in MOUNTAIN_COLORS) {
                light.colors[key] = rgbMix(light.colors[key], MOUNTAIN_COLORS[key], light.mountain);
            }
            light.dusk = smoothStep(535, 835, p - mountain.start);
            light.city = smoothStep(805, 945, p - mountain.start);
            light.fade = smoothStep(575, 775, p - mountain.start);
            light.sky = sky.map((c, j) => rgbMix(c, rgbMix(MOUNTAIN_SKY[j], DUSK_SKY[j], light.dusk * 0.95), light.mountain));
            light.haze = light.sky[2];
        }
        // From the bridge on, the city's own sky
        const bridge = d.stretches[1].start;
        const city = smoothStep(bridge - 70, bridge + 70, p);
        light.cityNight = Math.max(0, Math.min(1, (p - bridge) / 1700));
        if (city > 0) {
            light.sky = light.sky.map((c, j) => rgbMix(c, rgbMix(CITY_SKY[j][0], CITY_SKY[j][1], light.cityNight), city));
            light.haze = light.sky[2];
        }
    }

    function glowSprite() {
        descentGlow = descentGlow || canvasOf(128, 128, c => {
            const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
            g.addColorStop(0, 'rgba(255,190,100,.95)');
            g.addColorStop(0.35, 'rgba(255,150,60,.35)');
            g.addColorStop(1, 'rgba(255,120,40,0)');
            c.fillStyle = g;
            c.fillRect(0, 0, 128, 128);
        });
        return descentGlow;
    }

    // A warm glow (in the tunnels; by lamps at night, as dark as it is)
    function tunnelGlow(x, y, r, a) {
        if (r < 2 * DESCENT.px) {
            return;
        }
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = a;
        ctx.drawImage(glowSprite(), x - r, y - r, r * 2, r * 2);
        ctx.restore();
    }

    function lampGlow(x, y, r, a) {
        if (light.night >= 0.05) {
            tunnelGlow(x, y, r, a * light.night);
        }
    }

    // A lamp post with two lamps, by day and by night (the test's sprite)
    function lampSprite() {
        descentLamp = descentLamp || [false, true].map(night => canvasOf(40, 84, (c, w, h) => {
            c.fillStyle = night ? '#2b2f4a' : '#6f7488';
            roundRect(c, w / 2 - 2, h * 0.18, 4, h * 0.82, 2);
            c.fill();
            c.strokeStyle = night ? '#2b2f4a' : '#6f7488';
            c.lineWidth = 3;
            c.beginPath();
            c.moveTo(w / 2, h * 0.2);
            c.lineTo(w * 0.2, h * 0.2);
            c.moveTo(w / 2, h * 0.2);
            c.lineTo(w * 0.8, h * 0.2);
            c.stroke();
            for (const x of [w * 0.2, w * 0.8]) {
                const y = h * 0.17;
                c.fillStyle = night ? '#ffe2a0' : '#f4efe6';
                c.beginPath();
                c.ellipse(x, y, 8, 5, 0, 0, 7);
                c.fill();
                c.fillStyle = night ? '#fff6dc' : '#fff';
                c.beginPath();
                c.ellipse(x, y + 1, 5, 3, 0, 0, 7);
                c.fill();
            }
        }));
        return descentLamp;
    }

    // The four layers of peaks, paler and bluer further off
    function makeDescentLayers() {
        const colors = [['#b4c9dc', '#cfdde8'], ['#8fb0b8', '#bcd0d4'], ['#5f9272', '#8fb59a'], ['#3d7452', '#5f9272']];
        const waves = [[4, 9], [5, 12], [6, 13], [7, 16]];
        const tall = [0.5, 0.6, 0.75, 0.85];
        return colors.map((c, j) => canvasOf(2048, 420, x => {
            const ph = [j * 1.3, j * 2.1 + 0.7];
            const peak = u => {
                const a = 0.5 + 0.5 * Math.sin(waves[j][0] * u + ph[0] * 3);
                const b = 0.5 + 0.5 * Math.sin(waves[j][1] * u + ph[1] * 3);
                const v = 0.62 * a + 0.38 * b;
                return tall[j] * v * v * (3 - 2 * v) * 1.05;
            };
            const top = u => 420 - 20 - (0.17 * tall[j] + peak(u / 2048 * 6.2832)) * 330;
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
        }));
    }

    // Chongqing's towers far off (risen at dusk over the mountain, then behind the city): a strip that repeats sideways;
    // violet silhouettes behind navy and indigo towers with windows, flat roofs, crown lights and antennas
    function makeDescentCity() {
        return canvasOf(2048, 420, c => {
            const random = testRandom(41);
            const lit = ['#ffd98a', '#ffe9b8', '#ffcf70', '#ffe2a0', '#6fd8ff', '#ff8fc4'];
            for (let x = 0; x < 2048;) {
                const w = 30 + random() * 40;
                const h = 60 + random() * 110;
                c.fillStyle = '#4a3e8e';
                c.fillRect(x, 400 - h, Math.min(w, 2048 - x), h + 30);
                if (random() < 0.5) {
                    c.fillStyle = 'rgba(170,150,230,.35)';
                    for (let q = 0; q < 4; q++) {
                        c.fillRect(x + 5 + random() * (w - 12), 400 - h + 8 + random() * (h - 14), 3, 4);
                    }
                }
                x += w + 2 + random() * 6;
            }
            const bodies = ['#252a78', '#2b3082', '#202570', '#2f3386'];
            const crowns = ['#ff7aa8', '#5ab8ff', '#ffd070', '#ff9cc8', '#9ff0ff'];
            let x = 4;
            let k = 0;
            while (x < 2040) {
                const w = 34 + random() * 46;
                const tall = random() < 0.1;
                const h = tall ? 250 + random() * 80 : 80 + random() * 150;
                const ww = Math.min(w, 2048 - x);
                c.fillStyle = bodies[k % 4];
                c.fillRect(x, 400 - h, ww, h + 30);
                c.fillStyle = 'rgba(120,110,210,.25)';
                c.fillRect(x, 400 - h, 3, h);
                // The windows: warm yellow, a few pink and cyan
                const across = Math.max(2, Math.floor(ww / 9));
                const rows = Math.max(3, Math.floor(h / 13));
                for (let j = 0; j < rows; j++) {
                    for (let i = 0; i < across; i++) {
                        const r = random();
                        if (r < 0.4) {
                            c.fillStyle = lit[r < 0.34 ? (random() * 4) | 0 : 4 + ((random() * 2) | 0)];
                            c.fillRect(x + 3 + i * ((ww - 6) / across), 400 - h + 8 + j * ((h - 12) / rows), Math.max(2, (ww - 6) / across - 3),
                                Math.max(3, (h - 12) / rows - 5));
                        }
                    }
                }
                // On the roof a crown light and an antenna (the tall ones), or a lit edge and a hut
                const crown = crowns[k % 5];
                if (tall) {
                    c.fillStyle = crown;
                    c.fillRect(x + ww * 0.15, 400 - h - 7, ww * 0.7, 8);
                    c.fillRect(x + ww * 0.45, 400 - h - 30, 3, 24);
                    c.fillStyle = 'rgba(255,255,255,.5)';
                    c.fillRect(x + ww * 0.45 - 1, 400 - h - 32, 5, 4);
                } else if (random() < 0.45) {
                    c.fillStyle = crown;
                    c.fillRect(x + 2, 400 - h - 4, ww - 4, 4);
                    if (random() < 0.5) {
                        c.fillStyle = '#403a96';
                        c.fillRect(x + ww * 0.3, 400 - h - 12, ww * 0.4, 9);
                    }
                }
                x += w + 3 + random() * 7;
                k++;
            }
            // Haze at the skyline's foot
            const g = c.createLinearGradient(0, 320, 0, 420);
            g.addColorStop(0, 'rgba(120,80,170,0)');
            g.addColorStop(1, 'rgba(120,80,170,.55)');
            c.fillStyle = g;
            c.fillRect(0, 320, 2048, 100);
        });
    }

    // The city as the test lays it out, numbered by its steps (i = t - 40): along the bridge's first 300 steps the hillside
    // houses in sections of 5 to 12 steps, each with four tiers of its own heights, colors and roof (lower at first);
    // and a boat every 330 steps from step 170 of the bridge
    function cityOf(d) {
        let city = cities.get(d);
        if (!city) {
            const z0 = d.stretches[1].start - 40;
            const end = z0 + 300;
            const sections = [];
            const section = new Int16Array(d.turn.length).fill(-1);
            const boat = new Uint8Array(d.turn.length);
            const random = testRandom(913);
            let i = z0;
            while (i < end) {
                const steps = 5 + Math.floor(random() * 8);
                const ramp = 0.3 + 0.7 * smoothStep(0, 90, i - z0);
                const t0 = (4.5 + random() * 6) * ramp + 1.5;
                const t1 = t0 + (5 + random() * 8) * ramp;
                const t2 = t1 + (7 + random() * 10) * ramp;
                const t3 = t2 + (10 + random() * 16) * ramp;
                sections.push({tiers: [t0, t1, t2, t3], front: Math.floor(random() * 5), roof: Math.floor(random() * 3),
                    shift: [(random() - 0.5) * 0.3, (random() - 0.5) * 0.3, (random() - 0.5) * 0.3, 0], start: i});
                for (let k = 0; k < steps && i + k < end; k++) {
                    section[i + k] = sections.length - 1;
                }
                i += steps;
            }
            for (let l = 170; l < 1900; l += 330) {
                boat[z0 + l] = 1;
            }
            city = {end, sections, section, boat};
            cities.set(d, city);
        }
        return city;
    }

    // The city's far view (alpha: as much as it shows; late: how far into the night): stars once the night comes in, broad
    // soft clouds, three layers of violet hills and the towers small against the haze
    function drawCityBack(alpha, late, horizon) {
        if (alpha < 0.01) {
            return;
        }
        const W = width;
        const H = height;
        const sky = light.sky;
        ctx.globalAlpha = alpha;
        if (late > 0.25) {
            ctx.fillStyle = '#fff';
            for (let k = 0; k < 42; k++) {
                const x = ((testHash(k * 7 + 1) * W * 1.6 - farShiftSmooth * 0.04) % W + W) % W;
                ctx.globalAlpha = alpha * Math.max(0, Math.min(0.7, (late - 0.25) * 1.2)) * (0.5 + 0.5 * testHash(k * 5));
                ctx.fillRect(x, testHash(k * 11 + 3) * horizon * 0.55, 1.6 * DESCENT.px, 1.6 * DESCENT.px);
            }
            ctx.globalAlpha = alpha;
        }
        const white = rgb(rgbMix(sky[1], [255, 200, 224], 0.4));
        const shade = rgb(rgbMix(sky[1], [255, 200, 224], 0.18));
        for (const [fx, fy, fs] of CLOUDS) {
            const span = W * 2.2;
            cloud(((fx * span - farShiftSmooth * 0.2) % span + span) % span - W * 0.2, horizon * fy * 0.9, W * fs * 0.5, white, shade);
        }
        const layers = [[0.28, 0.34, 0.4], [0.4, 0.28, 0.33], [0.55, 0.22, 0.27]]; // per layer: its turn, -, its height
        const colors = [rgbMix(sky[2], [96, 80, 170], 0.42), rgbMix(sky[2], [60, 52, 134], 0.62), rgbMix(sky[2], [36, 34, 98], 0.82)];
        for (let j = 0; j < 3; j++) {
            const span = H * 1.6 * (1 + j * 0.35);
            const off = farShiftSmooth * layers[j][0];
            const foot = horizon + H * 0.01;
            const high = H * layers[j][2];
            ctx.fillStyle = rgb(colors[j]);
            ctx.beginPath();
            ctx.moveTo(-10, foot + 4 * DESCENT.px);
            for (let x = -10; x <= W + 14; x += 12 * DESCENT.px) {
                const u = (x + off) / span * 6.2832;
                let v = 0;
                for (const [waves, high2, phase] of CITY_HILLS[j]) {
                    v += high2 * Math.sin(u * waves + phase);
                }
                v = 0.5 + 0.5 * v / 1.75;
                ctx.lineTo(x, foot - high * (0.25 + 0.75 * v) * (1 - j * 0.18));
            }
            ctx.lineTo(W + 14, foot + 4 * DESCENT.px);
            ctx.closePath();
            ctx.fill();
        }
        descentCity = descentCity || makeDescentCity();
        const s = H * 0.3 / 420;
        const y = horizon + 20 * s;
        const tile = 2048 * s;
        const off = ((farShiftSmooth * 0.6) % tile + tile) % tile;
        for (let x = -off; x < W; x += tile) {
            ctx.drawImage(descentCity, x, y - 420 * s, tile + 1, 420 * s);
        }
        const [r, g, b] = sky[2].map(c => c | 0);
        const haze = ctx.createLinearGradient(0, horizon - H * 0.1, 0, horizon + 2);
        haze.addColorStop(0, `rgba(${r},${g},${b},0)`);
        haze.addColorStop(1, `rgba(${r},${g},${b},.5)`);
        ctx.fillStyle = haze;
        ctx.fillRect(0, horizon - H * 0.1, W, H * 0.1 + 2);
        ctx.globalAlpha = 1;
    }

    // The far view: the sky, the city's; on the mountain its own sky, clouds and peaks over them (lower at the summit,
    // rising as the road goes down: down is 0 to 1), and Chongqing rising at dusk
    function drawDescentBack(d, p, horizon, down) {
        const W = width;
        const H = height;
        const sky = light.sky;
        const g = ctx.createLinearGradient(0, 0, 0, horizon + 2);
        g.addColorStop(0, rgb(sky[0]));
        g.addColorStop(0.55, rgb(sky[1]));
        g.addColorStop(1, rgb(sky[2]));
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, horizon + 2);
        // The city's far view comes in as the mountain ends (stretch 0 is the mountain, the others are the city)
        let drawn = false;
        for (let k = 0; k < d.stretches.length - 1; k++) {
            const b = d.stretches[k].end;
            if (p > b - 70 && p < b + 70) {
                drawCityBack(k > 0 ? 1 : smoothStep(b - 70, b + 70, p), light.cityNight, horizon);
                drawn = true;
                break;
            }
        }
        if (!drawn && d.kind[Math.max(0, Math.min(d.kind.length - 1, Math.floor(p)))] !== 'mountain') {
            drawCityBack(1, light.cityNight, horizon);
        }
        const [hr, hg, hb] = light.haze.map(c => c | 0);
        const haze = ctx.createLinearGradient(0, horizon - H * 0.04, 0, horizon + 2);
        haze.addColorStop(0, `rgba(${hr},${hg},${hb},0)`);
        haze.addColorStop(1, `rgba(${hr},${hg},${hb},.5)`);
        ctx.fillStyle = haze;
        ctx.fillRect(0, horizon - H * 0.04, W, H * 0.04 + 2);
        ctx.fillStyle = rgb(light.colors.water);
        ctx.fillRect(0, horizon, W, H - horizon);
        if (light.mountain > 0.01) {
            drawMountainBack(light.mountain, horizon, down);
            return;
        }
        const water = ctx.createLinearGradient(0, horizon, 0, horizon + H * 0.07);
        water.addColorStop(0, `rgba(${hr},${hg},${hb},.9)`);
        water.addColorStop(1, `rgba(${hr},${hg},${hb},0)`);
        ctx.fillStyle = water;
        ctx.fillRect(0, horizon, W, H * 0.07);
    }

    function drawMountainBack(w, horizon, down) {
        const W = width;
        const H = height;
        const sky = MOUNTAIN_SKY.map((c, j) => rgbMix(c, DUSK_SKY[j], light.dusk * 0.95));
        const g = ctx.createLinearGradient(0, 0, 0, horizon + 2);
        g.addColorStop(0, rgb(sky[0]));
        g.addColorStop(0.6, rgb(sky[1]));
        g.addColorStop(1, rgb(sky[2]));
        ctx.globalAlpha = w;
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, horizon + 2);
        ctx.fillStyle = rgb(sky[2]);
        ctx.fillRect(0, horizon, W, H - horizon);
        const white = rgb(rgbMix([255, 255, 255], [255, 196, 206], light.dusk));
        const shade = rgb(rgbMix([200, 216, 238], [160, 120, 186], light.dusk));
        for (const [fx, fy, fs] of CLOUDS) {
            const span = W * 2.2;
            const x = ((fx * span - farShiftSmooth * 0.2) % span + span) % span - W * 0.2;
            cloud(x, horizon * fy * 0.9, W * fs * 0.5, white, shade);
        }
        descentLayers = descentLayers || makeDescentLayers();
        const turns = [0.35, 0.55, 0.8, 1];
        descentLayers.forEach((layer, j) => {
            const s = H * (0.3 + 0.07 * j) / 420;
            const y0 = horizon + H * (0.035 * j + 0.16 * (1 - Math.min(1, down * 1.6)));
            const tile = 2048 * s;
            const off = ((farShiftSmooth * turns[j]) % tile + tile) % tile;
            ctx.globalAlpha = w * (1 - light.fade);
            for (let x = -off; x < W; x += tile) {
                ctx.drawImage(layer, x, y0 - 420 * s, tile + 1, 420 * s);
            }
            ctx.fillStyle = j < 2 ? rgb(rgbMix(hexRgb(j ? '#bcd0d4' : '#cfdde8'), sky[2], light.dusk * 0.9)) : j === 2 ? '#8fb59a' : '#5f9272';
            ctx.fillRect(0, y0 - 1, W, H);
            if (j === 1) {
                const mist = ctx.createLinearGradient(0, y0 - H * 0.16, 0, y0 + H * 0.04);
                mist.addColorStop(0, 'rgba(240,246,250,0)');
                mist.addColorStop(1, `rgba(240,246,250,${0.55 * (1 - down * 0.6)})`);
                ctx.fillStyle = mist;
                ctx.fillRect(0, y0 - H * 0.16, W, H * 0.2);
                if (light.city > 0.01) {
                    ctx.globalAlpha = w * light.city;
                    descentCity = descentCity || makeDescentCity();
                    const s2 = H * 0.29 / 420;
                    const y2 = y0 + H * 0.05;
                    const tile2 = 2048 * s2;
                    const off2 = ((farShiftSmooth * 0.6) % tile2 + tile2) % tile2;
                    const ground = ctx.createLinearGradient(0, y2, 0, y2 + H * 0.3);
                    ground.addColorStop(0, '#5a4a9c');
                    ground.addColorStop(1, '#3a3080');
                    ctx.fillStyle = ground;
                    ctx.fillRect(0, y2 - 1, W, H);
                    for (let x = -off2; x < W; x += tile2) {
                        ctx.drawImage(descentCity, x, y2 - 420 * s2, tile2 + 1, 420 * s2);
                    }
                }
            }
        });
        ctx.globalAlpha = 1;
    }

    // The valley floor beyond the wall on the right, from xs to the screen's edge, and from 30 steps into the mountain a
    // river along it, its banks shading into the grass; where it is (m from the road's middle), or null
    function drawValleyFloor(d, t, sx1, sx2, w1, w2, b1, b2, f, xs1, xs2) {
        const px = DESCENT.px;
        const W = width;
        const f2 = Math.min(1, f + 0.12);
        const grass = rgbMix([40, 98, 64], [26, 74, 52], 0.5);
        four(hazed(grass, Math.min(0.5, f2 + 0.2)), xs1, b1 + px, W + 4, b1 + px, W + 4, b2 - 1.5 * px, xs2, b2 - 1.5 * px);
        if (d.local[t] < 30) {
            return null;
        }
        const ra = 12;
        const rb = 22;
        const river = rgbMix(grass, [70, 176, 204], smoothStep(30, 260, d.local[t]));
        const top1 = b1 + px;
        const top2 = b2 - 3.2 * px;
        four(hazed(river, f2 * 0.7), sx1 + ra * w1, top1, sx1 + rb * w1, top1, sx2 + rb * w2, top2, sx2 + ra * w2, top2);
        const strips = 8;
        const dw = (rb - ra) * 0.1;
        const fogNear = Math.min(1, f2 + 0.2);
        const fogRiver = f2 * 0.7;
        for (let j = 0; j < strips; j++) {
            const tl = (j + 1) / (strips + 1);
            const tt = tl * tl * (3 - 2 * tl);
            const l1 = ra - (strips - j) * dw * 0.5;
            const l2 = ra - (strips - 1 - j) * dw * 0.5;
            const r1 = rb + j * dw * 0.5;
            const r2 = rb + (j + 1) * dw * 0.5;
            four(hazed(rgbMix(grass, river, tt), fogNear + (fogRiver - fogNear) * tt),
                sx1 + l1 * w1, top1, sx1 + l2 * w1, top1, sx2 + l2 * w2, top2, sx2 + l1 * w2, top2);
            const tr = (strips - j) / (strips + 1);
            const tu = tr * tr * (3 - 2 * tr);
            four(hazed(rgbMix(grass, river, tu), fogNear + (fogRiver - fogNear) * tu),
                sx1 + r1 * w1, top1, sx1 + r2 * w1, top1, sx2 + r2 * w2, top2, sx2 + r1 * w2, top2);
        }
        return [ra, rb];
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

    // A river boat in the city, 70 to 110 m off the road (now and then on the left, where no houses are): a dark hull with
    // its light on the water, three white decks with lit windows, a red funnel
    function drawCityBoat(city, i, sx1, pp, by, f) {
        const px = DESCENT.px;
        const off = (70 + 40 * testHash(i * 3 + 1)) * (city.section[i] < 0 && testHash(i * 5 + 2) < 0.5 ? -1 : 1);
        const cx = sx1 + off * pp;
        const hw = 11 * pp;
        const ff = f * 0.5;
        if (hw < 4 * px) {
            return;
        }
        ctx.fillStyle = `rgba(255,214,140,${0.22 * (1 - ff)})`;
        ctx.beginPath();
        ctx.ellipse(cx, by + 0.9 * pp, hw * 0.95, 0.55 * pp, 0, 0, 7);
        ctx.fill();
        four(hazed([58, 46, 88], ff), cx - hw, by - 1.1 * pp, cx + hw * 1.08, by - 1.25 * pp, cx + hw * 0.92, by + 0.05 * pp, cx - hw * 0.86, by + 0.05 * pp);
        const deck = (x0, x1, yb, h, color) => {
            ctx.fillStyle = hazed(color, ff);
            ctx.fillRect(x0, yb - h, x1 - x0, h);
            const windows = Math.max(4, Math.round((x1 - x0) / (1.25 * pp)));
            ctx.fillStyle = hazed([255, 214, 130], ff * 0.6);
            for (let q = 0; q < windows; q++) {
                ctx.fillRect(x0 + (q + 0.2) * (x1 - x0) / windows, yb - h * 0.72, (x1 - x0) / windows * 0.58, h * 0.42);
            }
        };
        deck(cx - hw * 0.92, cx + hw * 0.98, by - 1.1 * pp, 1.7 * pp, [238, 234, 226]);
        deck(cx - hw * 0.72, cx + hw * 0.78, by - 2.8 * pp, 1.6 * pp, [250, 238, 196]);
        deck(cx - hw * 0.42, cx + hw * 0.4, by - 4.4 * pp, 1.5 * pp, [240, 236, 228]);
        ctx.fillStyle = hazed([146, 58, 70], ff);
        ctx.fillRect(cx - 0.5 * pp, by - 6.7 * pp, 1.1 * pp, 1.4 * pp);
        lampGlow(cx, by - 4.4 * pp, pp * 4, 0.5);
    }

    // The hillside houses on the left in step i (numbered as in the test), seen at the road's step n: a dark mass behind,
    // four tiers of house fronts (far to near) with posts, rows of warm windows and long wooden balconies, paper lanterns
    // under the eaves and the tiled eaves themselves; below them the lavender retaining wall, bushes along its top and a
    // tree where a section begins. Towards the end they get lower and the wall goes down to the road
    // A traditional red paper lantern (cord, gold caps, ribbed round body), simple when far off; u: px to a metre
    function redLantern(x, y, u, f) {
        const px = DESCENT.px;
        const R = Math.max(1.6 * px, u * 0.62);
        const Hh = R * 0.86;
        const red = hazed([214, 30, 38], f * 0.4);
        const gold = hazed([240, 196, 84], f * 0.5);
        if (R < 6 * px) {
            ctx.fillStyle = red;
            ctx.fillRect(x - R, y + u * 0.3, R * 2, Hh * 1.9);
            return;
        }
        if (R < 11 * px) {
            ctx.fillStyle = red;
            ctx.beginPath();
            ctx.ellipse(x, y + u * 0.45 + Hh, R, Hh, 0, 0, 7);
            ctx.fill();
            ctx.fillStyle = gold;
            ctx.fillRect(x - R * 0.6, y + u * 0.4, R * 1.2, Math.max(1.2 * px, u * 0.16));
            return;
        }
        const cy = y + u * 0.45 + Hh;
        ctx.strokeStyle = hazed([70, 40, 36], f);
        ctx.lineWidth = Math.max(0.6 * px, u * 0.05);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + u * 0.45);
        ctx.stroke();
        ctx.fillStyle = red;
        ctx.beginPath();
        ctx.ellipse(x, cy, R, Hh, 0, 0, 7);
        ctx.fill();
        ctx.fillStyle = hazed([244, 70, 64], f * 0.4);
        ctx.beginPath();
        ctx.ellipse(x - R * 0.28, cy - Hh * 0.18, R * 0.34, Hh * 0.62, 0, 0, 7);
        ctx.fill();
        ctx.strokeStyle = hazed([150, 16, 28], f * 0.4);
        ctx.lineWidth = Math.max(0.5 * px, u * 0.04);
        for (const k of [0.36, 0.7]) {
            ctx.beginPath();
            ctx.ellipse(x, cy, R * k, Hh, 0, 0, 7);
            ctx.stroke();
        }
        ctx.fillStyle = gold;
        const cw = R * 0.62;
        const ch = Math.max(1.2 * px, u * 0.16);
        ctx.fillRect(x - cw, y + u * 0.45 - ch * 0.3, cw * 2, ch);
        ctx.fillRect(x - cw, cy + Hh - ch * 0.7, cw * 2, ch);
    }

    // Which lantern spots are kept (83 of every 91), so the section ends up with 290
    function lanternKept(city, i) {
        const q = Math.floor(i / 3) - Math.floor((city.end - 300) / 3);
        return Math.floor((q + 1) * 83 / 91) > Math.floor(q * 83 / 91);
    }

    function lanternFade(city, i) {
        const kb = 1 - smoothStep(city.end - 70, city.end, i);
        return Math.max(0, Math.min(1, (kb - 0.35) / 0.4));
    }

    function lastLantern(city) {
        if (city.lastLantern === undefined) {
            city.lastLantern = -1;
            for (let i = city.end - 1; i >= city.end - 300 && city.lastLantern < 0; i--) {
                if (i % 3 === 0 && lanternFade(city, i) > 0 && lanternKept(city, i)) {
                    city.lastLantern = i;
                }
            }
        }
        return city.lastLantern;
    }

    // The cable-stayed bridge: its deck starts 300 m after the old-town houses end; two pylons; the river lies far below it
    const lerp = (a, b, t) => a + (b - a) * t;
    const BRIDGE_XO = 120; // steps kept behind the camera in the sideways array
    const bridgeX = new Float64Array(BRIDGE_XO + 1700);
    const PYL = [[6, 0], [4.9, 12], [3.7, 26], [2.5, 40], [1.6, 52], [1.0, 62]]; // a pylon leg: how far from the middle (m), how high (m)
    const PYLON_COLOR = [236, 228, 252];
    const PYLON_DARK = [178, 164, 222];
    const legLat = h => {
        for (let k = 0; k < PYL.length - 1; k++) {
            if (h <= PYL[k + 1][1]) {
                return PYL[k][0] + (PYL[k + 1][0] - PYL[k][0]) * (h - PYL[k][1]) / (PYL[k + 1][1] - PYL[k][1]);
            }
        }
        return 1;
    };

    function bridgeOf(d) {
        if (!d.bridge) {
            const T0 = d.stretches[1].start;
            const BR0 = T0 + 300 + 150; // the houses end 300 steps in; then 300 m (150 steps) of road
            // the city starts 700 m (350 steps) after the last red cable (124 steps past the second pylon)
            d.bridge = {T0, BR0, BRP: [BR0 + 110, BR0 + 375], BRE: BR0 + 650, CITY: BR0 + 375 + 124 + 350};
            for (let i = T0; i < d.water.length; i++) {
                d.water[i] -= 20 * smoothStep(BR0 - 80, BR0 + 30, i);
            }
            // In the city only lamp posts: 14 on each side (2: left, 3: right), no lights in the rails
            const cityEnd = d.turn.length - 8;
            for (let i = d.bridge.CITY; i < d.lamp.length; i++) {
                d.lamp[i] = 0;
            }
            // the posts that stood before the city (7, on the left) are moved into it: 18 on each side, evenly, level across the road
            for (let i = 0; i < d.bridge.CITY; i++) {
                if (d.lamp[i] === 2) {
                    d.lamp[i] = 0;
                }
            }
            const putPost = (i, side) => {
                const has = d.lamp[i];
                d.lamp[i] = side < 0 ? (has === 3 ? 4 : 2) : (has === 2 ? 4 : 3);
            };
            for (let k = 0; k < 18; k++) {
                putPost(Math.round(d.bridge.CITY + (k + 0.5) * (cityEnd - d.bridge.CITY) / 18), -1);
            }
            for (let k = 0; k < 18; k++) {
                putPost(Math.round(d.bridge.CITY + (k + 0.5) * (cityEnd - d.bridge.CITY) / 18), 1); // level with the left ones
            }
        }
        return d.bridge;
    }

    // The skyscrapers on both sides of the road after the bridge: dark towers with lit windows, taller and denser with
    // every step (the test's own)
    const CITY_BODY = [[22, 26, 70], [30, 30, 86], [40, 34, 100], [26, 40, 92], [48, 32, 92]];
    const CITY_WINDOWS = ['rgba(96,226,255,', 'rgba(255,96,196,', 'rgba(255,214,112,', 'rgba(150,130,255,'];

    function drawSkyscrapers(water, start, i, t, n, {sx1, sx2, w1, w2, pp1, pp2, f, yAt}) {
        const gk = smoothStep(start - 110, start + 510, t);
        const b = i >> 3;
        const li = i & 7;
        const wy = water;
        const ba = yAt(wy, n);
        const bb = yAt(wy, n + 1);
        for (let row = 1; row >= 0; row--) {
            for (let sd = -1; sd <= 1; sd += 2) {
                const hb = testHash(b * 13 + row * 5 + (sd > 0 ? 3 : 0) + 1);
                const hc = testHash(b * 7 + row * 3 + (sd > 0 ? 1 : 0) + 9);
                if (hb < 0.2 + 0.45 * (1 - gk) || li >= 5 + ((hc * 3) | 0)) {
                    continue;
                }
                const lat = (row ? 32 : 11) + hc * (row ? 20 : 9);
                const wid = 11 + hb * 9;
                const hT = Math.max(26, ((row ? 90 : 46) + hc * (row ? 110 : 80)) * (0.22 + 0.78 * gk));
                const col = CITY_BODY[(hb * 5) | 0];
                const t1 = yAt(hT, n);
                const t2 = yAt(hT, n + 1);
                const xa1 = sx1 + sd * lat * pp1;
                const xa2 = sx2 + sd * lat * pp2;
                four(hazed(col, f * 0.5), xa1, ba, xa2, bb, xa2, t2, xa1, t1);
                if (li === 0) {
                    const xb1 = sx1 + sd * (lat + wid) * pp1;
                    four(hazed(rgbMix(col, [0, 0, 20], 0.25), f), xa1, ba, xb1, ba, xb1, t1, xa1, t1);
                    four(hazed(rgbMix(col, [150, 120, 230], 0.35), f), xa1, t1, xb1, t1, xb1, t1 - Math.min(1.3 * pp1, 6), xa1, t1 - Math.min(1.3 * pp1, 6));
                    if (n < 140) {
                        const floors = Math.max(2, Math.floor((hT - wy) / 3.6));
                        const cells = n < 40 ? 26 : n < 90 ? 18 : 12;
                        ctx.globalAlpha = 1 - f * 0.7;
                        for (let k = 0; k < cells; k++) {
                            const hk = testHash(i * 41 + k * 7 + row * 3 + (sd > 0 ? 5 : 0));
                            const hj = testHash(i * 43 + k * 13 + row);
                            const hu = testHash(i * 47 + k * 3 + 2);
                            if (hk > 0.7) {
                                continue;
                            }
                            const fh = wy + ((hj * floors) | 0) * 3.6 + 1;
                            const u0 = 0.08 + ((hu * 5) | 0) * 0.17;
                            const u1 = u0 + 0.11;
                            ctx.fillStyle = CITY_WINDOWS[(hk * 20 | 0) % 4] + (0.55 + 0.4 * hj) + ')';
                            const xx1 = lerp(xa1, xb1, u0);
                            const xx2 = lerp(xa1, xb1, u1);
                            ctx.beginPath();
                            ctx.moveTo(xx1, yAt(fh, n));
                            ctx.lineTo(xx2, yAt(fh, n));
                            ctx.lineTo(xx2, yAt(fh + 1.5, n));
                            ctx.lineTo(xx1, yAt(fh + 1.5, n));
                            ctx.closePath();
                            ctx.fill();
                        }
                        ctx.globalAlpha = 1;
                    }
                }
                const windows = n < 30 ? 20 : n < 60 ? 14 : n < 80 ? 10 : n < 130 ? 9 : 8;
                const floors = Math.max(2, Math.floor((hT - wy) / 3.6));
                ctx.globalAlpha = 1 - f * 0.8;
                for (let k = 0; k < windows; k++) {
                    const hk = testHash(i * 17 + k * 5 + row * 3 + (sd > 0 ? 2 : 0));
                    const hj = testHash(i * 29 + k * 11 + row);
                    if (hk > 0.75) {
                        continue;
                    }
                    const fh = wy + ((hj * floors) | 0) * 3.6 + 1;
                    const ya = yAt(fh, n);
                    const yb = yAt(fh + 1.5, n);
                    const yc = yAt(fh + 1.5, n + 1);
                    const yd = yAt(fh, n + 1);
                    const u = 0.3;
                    const v = 0.7;
                    ctx.fillStyle = CITY_WINDOWS[(hk * 20 | 0) % 4] + (0.55 + 0.4 * hj) + ')';
                    const x1 = lerp(xa1, xa2, u);
                    const x2 = lerp(xa1, xa2, v);
                    const ya1 = lerp(ya, yd, u);
                    const ya2 = lerp(ya, yd, v);
                    const yb1 = lerp(yb, yc, u);
                    const yb2 = lerp(yb, yc, v);
                    four(CITY_WINDOWS[(hk * 20 | 0) % 4] + (0.55 + 0.4 * hj) + ')', x1, ya1, x2, ya2, x2, yb2, x1, yb1);
                    if (hk < 1 / 7 && n < 80 && n > 3) {
                        lampGlow((x1 + x2) / 2, (ya1 + yb1) / 2, Math.min(pp1 * 3.2, 70 * DESCENT.px), 0.4);
                    }
                }
                ctx.globalAlpha = 1;
            }
        }
    }

    function drawCityHouses(city, i, n, {sx1, sx2, w1, w2, y1, y2, pp1, pp2, f, yAt}) {
        const house = city.sections[city.section[i]];
        const px = DESCENT.px;
        const lerp = (a, b, t) => a + (b - a) * t;
        const BASE = 2.4;
        const low = 1 - smoothStep(city.end - 70, city.end, i);
        const wall = 1 - smoothStep(city.end - 28, city.end, i);
        const foot = BASE * wall;
        const tiers = house.tiers.map(v => foot + (v - BASE) * low);
        const ex = 1.3 * px;
        const first = i === house.start;
        const into = i - house.start;
        const by1 = yAt(foot, n);
        const by2 = yAt(foot, n + 1);
        {
            const o = CITY_TIERS[3] + 0.4;
            const xa1 = sx1 - o * w1;
            const xa2 = sx2 - o * w2;
            const top1 = yAt(tiers[3] * 0.85, n);
            const top2 = yAt(tiers[3] * 0.85, n + 1);
            const dark = hazed([40, 32, 90], f);
            four(dark, -4, by1, xa1, by1, xa1, top1, -4, top1);
            four(dark, xa1, by1, xa2 + ex, by2, xa2 + ex, top2, xa1, top1);
        }
        for (let k = 3; k >= 0; k--) {
            const o = CITY_TIERS[k] + house.shift[k];
            const xa1 = sx1 - o * w1;
            const xa2 = sx2 - o * w2;
            const top = tiers[k];
            const ty1 = yAt(top, n);
            const ty2 = yAt(top, n + 1);
            const under = k === 0 ? foot : tiers[k - 1];
            // Where the houses come down at the section's end and no window fits any more: bushes instead of the roof
            if (k < 3 && low < 1 && foot + Math.max(0, Math.ceil((under - foot - 0.9) / 3.2)) * 3.2 + 2.6 > top - 0.5) {
                const cx = (xa1 + xa2) / 2;
                const cy = (by1 + by2) / 2;
                const r = (0.9 + testHash(i * 5 + k * 3 + 1) * 0.6) * (pp1 + pp2) / 2;
                for (let q = 0; q < 3; q++) {
                    const hq = testHash(i * 9 + q * 4 + k * 2 + 2);
                    ctx.fillStyle = hazed(hq < 0.33 ? [40, 102, 98] : hq < 0.66 ? [58, 126, 108] : [34, 86, 92], f);
                    ctx.beginPath();
                    ctx.arc(cx + (q - 1) * r * 0.9, cy - r * (0.45 + (q === 1 ? 0.35 : 0)), r * (q === 1 ? 1.05 : 0.8), 0, 7);
                    ctx.fill();
                }
                continue;
            }
            four(hazed(rgbMix(CITY_FRONTS[house.front], [70, 52, 120], k * 0.14), f), xa1, by1, xa2 + ex, by2, xa2 + ex, ty2, xa1, ty1);
            // The end face of each section: its side seen from the road, with its own rows of windows and a corner lantern
            if (first && n < 150 && lanternFade(city, i) > 0 && pp1 > 1.2 * px) {
                const xd = sx1 - (o + 2.6) * w1;
                const yb = yAt(under, n);
                const yt = ty1;
                four(hazed(rgbMix(rgbMix(CITY_FRONTS[house.front], [70, 52, 120], k * 0.14), [48, 34, 84], 0.38), f), xd, yb, xa1, yb, xa1, yt, xd, yt);
                if (k < 3) {
                    for (let q = Math.max(0, Math.ceil((under - foot - 0.9) / 3.2)); q < 40; q++) {
                        const hb2 = foot + q * 3.2 + 0.9;
                        if (hb2 + 1.7 > top - 0.5) {
                            break;
                        }
                        const ya = yAt(hb2, n);
                        const yz = yAt(hb2 + 1.7, n);
                        for (let c = 0; c < 3; c++) {
                            const hs2 = testHash(i * 19 + k * 5 + q * 11 + c * 3);
                            ctx.fillStyle = hs2 < 0.82 ? hazed(hs2 < 0.3 ? [255, 248, 206] : hs2 < 0.6 ? [255, 226, 132] : [255, 200, 104], f * 0.3) : hazed([64, 40, 70], f);
                            ctx.fillRect(lerp(xd, xa1, 0.1 + c * 0.3), yz, lerp(xd, xa1, 0.32 + c * 0.3) - lerp(xd, xa1, 0.1 + c * 0.3), ya - yz);
                        }
                    }
                    if (n < 110 && city.section[i] % 3 !== 0) {
                        const lx = lerp(xd, xa1, 0.5);
                        lampGlow(lx, yt + pp1 * 1.1, pp1 * 3.8, 0.95 * lanternFade(city, i));
                        redLantern(lx, yt, pp1, f);
                    }
                }
            }
            // Dark wooden posts every three bays
            if (into % 3 === 0) {
                const x = lerp(xa1, xa2, 0.1);
                four(hazed([50, 30, 46], f), xa1, by1, x, lerp(by1, by2, 0.1), x, lerp(ty1, ty2, 0.1), xa1, ty1);
            }
            // Rows of warm windows and long wooden balconies
            if (n < 120 && pp1 > 2.2 * px) {
                const floor = 3.2;
                for (let q = Math.max(0, Math.ceil((under - foot - 0.9) / floor)); q < 40; q++) {
                    const hb = foot + q * floor + 0.9;
                    const ht = hb + 1.7;
                    if (ht > top - 0.5) {
                        break;
                    }
                    const hs = testHash(i * 31 + k * 7 + q * 13 + house.start);
                    const xl = lerp(xa1, xa2, 0.2);
                    const xr = lerp(xa1, xa2, 0.8);
                    const b1 = yAt(hb, n);
                    const b2 = yAt(hb, n + 1);
                    const t1 = yAt(ht, n);
                    const t2 = yAt(ht, n + 1);
                    four(hs < 0.84 ? hazed(hs < 0.3 ? [255, 236, 170] : hs < 0.6 ? [255, 204, 100] : [255, 178, 80], f * 0.5) : hazed([64, 40, 70], f),
                        xl, lerp(b1, b2, 0.2), xr, lerp(b1, b2, 0.8), xr, lerp(t1, t2, 0.8), xl, lerp(t1, t2, 0.2));
                    if (k < 2 && pp1 > 3.5 * px) {
                        const hf = foot + q * floor + 0.2;
                        const xo1 = sx1 - (o - 0.45) * w1;
                        const xo2 = sx2 - (o - 0.45) * w2;
                        const g1 = yAt(hf + 0.14, n);
                        const g2 = yAt(hf + 0.14, n + 1);
                        four(hazed([70, 42, 54], f), xa1, yAt(hf, n), xa2 + ex, yAt(hf, n + 1), xo2 + ex, g2, xo1, g1);
                        four(hazed([108, 66, 64], f), xo1, g1, xo2 + ex, g2, xo2 + ex, yAt(hf + 0.55, n + 1), xo1, yAt(hf + 0.55, n));
                    }
                }
            }
            // Paper lanterns under the eaves, on the lowest three tiers
            if (i % 3 === 0 && n < 110 && k < 3 && lanternFade(city, i) > 0 && lanternKept(city, i) && !(k === 2 && i === lastLantern(city))) {
                const lx = lerp(xa1, xa2, 0.1) + (sx1 - (o - 0.38) * w1 - xa1) * 0.9;
                const ly = yAt(top - 0.3, n);
                if (pp1 > 3 * px) {
                    lampGlow(lx, ly + pp1 * 1.1, pp1 * 3.3, 0.95 * lanternFade(city, i));
                }
                redLantern(lx, ly, pp1, f);
            }
            if (k === 0 && n < 120 && into % 2 === 0) {
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                four('rgba(255,170,90,.12)', xa1, by1, xa2 + ex, by2, xa2 + ex, yAt(foot + (top - foot) * 0.55, n + 1), xa1, yAt(foot + (top - foot) * 0.55, n));
                ctx.restore();
            }
            // Wide eaves with a tiled edge, turned up at the section's corner
            {
                const e = 0.38;
                const xo1 = sx1 - (o - e) * w1;
                const xo2 = sx2 - (o - e) * w2;
                const yo1 = yAt(top + 0.25, n);
                const yo2 = yAt(top + 0.25, n + 1);
                const yf1 = yAt(top + 0.9, n);
                const yf2 = yAt(top + 0.9, n + 1);
                four(hazed(CITY_ROOFS[house.roof], f), xa1, ty1, xa2 + ex, ty2, xo2 + ex, yo2, xo1, yo1);
                const tile = hazed(rgbMix(CITY_ROOFS[house.roof], [230, 150, 140], 0.38), f);
                four(tile, xo1, yo1, xo2 + ex, yo2, xo2 + ex, yf2, xo1, yf1);
                if (first && n < 130) {
                    ctx.beginPath();
                    ctx.moveTo(xo1, yo1);
                    ctx.lineTo(sx1 - (o - e - 0.5) * w1, yAt(top + 1.3, n));
                    ctx.lineTo(xo1, yf1);
                    ctx.closePath();
                    ctx.fill();
                }
            }
        }
        // The retaining wall: lavender panels with darker seams, a lit one now and then
        const xw1 = sx1 - 1.34 * w1;
        const xw2 = sx2 - 1.34 * w2;
        const panel = hazed(Math.floor(i / 4) & 1 ? [124, 110, 174] : [116, 102, 166], f);
        if (xw1 > -4) {
            four(panel, -4, y1, xw1, y1, xw1, by1, -4, by1);
        }
        four(panel, xw1, y1, xw2 + ex, y2, xw2 + ex, by2, xw1, by1);
        four(hazed([152, 140, 198], f), xw1, yAt(foot - 0.3, n), xw2 + ex, yAt(foot - 0.3, n + 1), xw2 + ex, by2, xw1, by1);
        if (n < 130 && i % 6 === 1 && wall > 0.3) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            four('rgba(255,176,96,.16)', xw1, y1, xw2 + ex, y2, xw2 + ex, by2, xw1, by1);
            ctx.restore();
            lampGlow((xw1 + xw2) / 2, (by1 + by2) / 2, (pp1 + pp2) * 1.6, 0.5);
        }
        if (i % 4 === 0) {
            const xs = lerp(xw1, xw2, 0.1);
            four(hazed([86, 74, 134], f), xw1, y1, xs, lerp(y1, y2, 0.1), xs, lerp(by1, by2, 0.1), xw1, by1);
        }
        // Rounded bushes along the wall's top, and a tree where a section begins
        if (n < 110 && n > 3 && wall > 0.35 && testHash(i * 17 + 3) < 0.5) {
            const cx = (sx1 + sx2) / 2 - 1.45 * (w1 + w2) / 2;
            const cy = (by1 + by2) / 2;
            const r = (0.38 + testHash(i * 5 + 1) * 0.42) * (pp1 + pp2) / 2;
            for (let q = 0; q < 3; q++) {
                const hq = testHash(i * 9 + q * 4 + 2);
                ctx.fillStyle = hazed(hq < 0.33 ? [40, 102, 98] : hq < 0.66 ? [58, 126, 108] : [34, 86, 92], f);
                ctx.beginPath();
                ctx.arc(cx + (q - 1) * r * 0.9, cy - r * (0.45 + (q === 1 ? 0.35 : 0)), r * (q === 1 ? 1.05 : 0.8), 0, 7);
                ctx.fill();
            }
        }
        if (first && n < 130 && testHash(house.start * 3 + 1) < 0.7) {
            const cx = sx1 - (CITY_TIERS[0] + house.shift[0] - 0.2) * w1;
            const cy = yAt(tiers[0] + 0.6, n);
            const r = 1.2 * pp1 * Math.min(1, low * 2);
            ctx.fillStyle = hazed([40, 98, 92], f);
            ctx.beginPath();
            ctx.arc(cx, cy - r * 0.6, r, 0, 7);
            ctx.fill();
            ctx.fillStyle = hazed([58, 120, 102], f);
            ctx.beginPath();
            ctx.arc(cx - r * 0.4, cy - r * 0.9, r * 0.6, 0, 7);
            ctx.fill();
        }
    }

    function drawDescent(view) {
        const {track, bike} = view;
        const d = track.descent;
        const D = DESCENT;
        const px = D.px;
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
        const roadMiddle = n => W / 2 + F * (X(n) - cameraX) / Z(n);
        const roadY = n => HZ + F * (D.cameraHigh + cameraY - groundAt(base + n)) / Z(n);
        const goal = track.length / Track.SEGMENT;

        setLight(d, pos / SEG);
        const colors = light.colors;
        const night = light.night;
        // The far view turns with the road
        farShift += Math.max(-45, Math.min(45, (view.heading || 0) * F));
        farShiftSmooth += (farShift - farShiftSmooth) * 0.25;
        drawDescentBack(d, pos / SEG, HZ, Math.max(0, Math.min(1, cameraY / Math.min(-1, d.height[d.end]))));

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

        // The bridge: far off (up to 2.9 km) it needs the road's sideways run well past what the steps are drawn to
        const BR = bridgeOf(d);
        const XO = BRIDGE_XO;
        let brFar = false;
        if (base >= BR.T0 - 4) {
            let need = false;
            for (const p of BR.BRP) {
                if (p - base > -XO + 20 && p - base < 1450) {
                    need = true;
                }
            }
            if (need) {
                let x2 = 0;
                let dx2 = -(turnAt(base) * pct);
                for (let n = 0; n <= 1600; n++) {
                    bridgeX[n + XO] = x2;
                    x2 += dx2;
                    dx2 += turnAt(base + n);
                }
                x2 = 0;
                dx2 = -(turnAt(base) * pct);
                for (let n = -1; n >= -XO; n--) {
                    dx2 -= turnAt(base + n);
                    x2 -= dx2;
                    bridgeX[n + XO] = x2;
                }
                brFar = true;
            }
        }
        const bP3 = (ox, hm, nn) => [bridgeX[nn + XO] + ox - cameraX, hm - D.cameraHigh - cameraY + groundAt(base + nn), (base + nn) * SEG - camZ];
        const bLine = (A, B, wm, col) => {
            if (A[2] < D.near && B[2] < D.near) {
                return;
            }
            let a = A;
            let b = B;
            if (a[2] < D.near) {
                const k = (D.near - a[2]) / (b[2] - a[2]);
                a = [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, D.near];
            }
            if (b[2] < D.near) {
                const k = (D.near - b[2]) / (a[2] - b[2]);
                b = [b[0] + (a[0] - b[0]) * k, b[1] + (a[1] - b[1]) * k, D.near];
            }
            ctx.lineWidth = Math.max(px, Math.min(H * 0.4, wm * F / ((a[2] + b[2]) / 2)));
            ctx.strokeStyle = col;
            ctx.beginPath();
            ctx.moveTo(W / 2 + F * a[0] / a[2], HZ - F * a[1] / a[2]);
            ctx.lineTo(W / 2 + F * b[0] / b[2], HZ - F * b[1] / b[2]);
            ctx.stroke();
        };
        // A pale A-frame pylon with a fan of red stay cables, all tied to the deck's edges; pi: its step
        const drawPylon = pi => {
            const q = pi - base;
            if (q < -XO + 20 || q > 1450) {
                return;
            }
            const wb = d.water[Math.max(0, Math.min(last, pi))];
            const HS = 2.7;
            const fg = Math.max(0, Math.min(1, q / 1500)) * 0.3;
            const P = (ox, h, nn) => bP3(ox, nn === q && h > 3 ? h * HS : h, nn);
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            const cc = hazed([255, 84, 60], fg);
            const cc2 = hazed([255, 150, 110], fg);
            for (let k = 0; k < 9; k++) {
                const h = 33 + k * 3.3;
                const lat = legLat(h);
                const dd = Math.round((9 + k * 7.5) * 1.8);
                for (const dir of [-1, 1]) {
                    const nn = q + dir * dd;
                    if (nn < -XO || nn > 1560) {
                        continue;
                    }
                    for (const sd of [-1, 1]) {
                        const A = P(sd * lat, h, q);
                        const B = P(sd * 1.12 * ROAD, 1.1, nn);
                        bLine(A, B, q > 150 ? 0.9 : 0.3, cc);
                        if (q < 330) {
                            bLine(A, B, 0.1, cc2);
                        }
                    }
                }
            }
            if (night > 0.05) {
                ctx.globalCompositeOperation = 'lighter';
                for (let k = 0; k < 9; k += 2) {
                    const h = 33 + k * 3.3;
                    const lat = legLat(h);
                    const dd = Math.round((9 + k * 7.5) * 1.8);
                    for (const dir of [-1, 1]) {
                        for (const sd of [-1, 1]) {
                            const nn = q + dir * dd;
                            if (nn < -XO || nn > 1560) {
                                continue;
                            }
                            bLine(P(sd * lat, h, q), P(sd * 1.12 * ROAD, 1.1, nn), q > 150 ? 5 : 1.8, `rgba(255,80,50,${0.14 * night})`);
                        }
                    }
                }
                ctx.globalCompositeOperation = 'source-over';
            }
            for (const sd of [-1, 1]) {
                for (let k = 0; k < PYL.length; k++) {
                    const A = k ? P(sd * PYL[k - 1][0], PYL[k - 1][1], q) : P(sd * 6, wb, q);
                    const B = P(sd * PYL[k][0], PYL[k][1], q);
                    const wid = 5.4 + (2.8 - 5.4) * k / (PYL.length - 1);
                    bLine(A, B, q > 150 ? wid * 1.8 : wid, hazed(PYLON_DARK, fg));
                    bLine(A, B, q > 150 ? wid : wid * 0.55, hazed(PYLON_COLOR, fg));
                }
            }
            bLine(P(-legLat(41), 41, q), P(legLat(41), 41, q), 1.1, hazed(PYLON_COLOR, fg));
            bLine(P(-1.0, 63, q), P(1.0, 63, q), 1.8, hazed(PYLON_COLOR, fg));
            bLine(P(0, 63, q), P(0, 71, q), 0.5, hazed(PYLON_COLOR, fg));
            const T = P(0, 71.5, q);
            if (T[2] > D.near) {
                ctx.globalCompositeOperation = 'lighter';
                ctx.fillStyle = `rgba(255,60,60,${0.5 + 0.4 * Math.sin(performance.now() * 0.004)})`;
                ctx.beginPath();
                ctx.arc(W / 2 + F * T[0] / T[2], HZ - F * T[1] / T[2], Math.max(1.5 * px, 3 * F / T[2]), 0, 7);
                ctx.fill();
                ctx.globalCompositeOperation = 'source-over';
            }
        };
        // The deck of the far bridge: a ribbon with amber lights, seen before the road's own steps begin
        const drawFarBridge = () => {
            const n0 = Math.max(D.ahead - 6, BR.BR0 - base);
            const n1 = Math.min(1480, BR.BRE - base);
            if (n1 <= n0) {
                return;
            }
            const st = 10;
            ctx.lineCap = 'butt';
            let prev = null;
            for (let nn = n0; nn <= n1; nn += st) {
                const c = bP3(0, 0, nn);
                if (c[2] < D.near) {
                    prev = null;
                    continue;
                }
                const sx = W / 2 + F * c[0] / c[2];
                const yy = HZ - F * c[1] / c[2];
                const ww = F * ROAD / c[2];
                if (prev) {
                    four(hazed([92, 74, 150], Math.max(0, Math.min(1, nn / 1500)) * 0.55), prev[0] - prev[2], prev[1], prev[0] + prev[2], prev[1], sx + ww, yy, sx - ww, yy);
                }
                prev = [sx, yy, ww];
            }
            for (const sd of [-1, 1]) {
                ctx.beginPath();
                let first = true;
                for (let nn = n0; nn <= n1; nn += st) {
                    const c = bP3(sd * 1.12 * ROAD, 1.2, nn);
                    if (c[2] < D.near) {
                        continue;
                    }
                    const xx = W / 2 + F * c[0] / c[2];
                    const yy = HZ - F * c[1] / c[2];
                    if (first) {
                        ctx.moveTo(xx, yy);
                        first = false;
                    } else {
                        ctx.lineTo(xx, yy);
                    }
                }
                ctx.lineWidth = Math.max(px, 1.6 * px);
                ctx.strokeStyle = hazed([255, 176, 64], 0.15);
                ctx.stroke();
            }
        };
        if (brFar) {
            drawFarBridge();
            for (const p of BR.BRP) {
                if (p - base >= D.ahead) {
                    drawPylon(p);
                }
            }
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
        // What stands on the road fades into the haze; its lights come on in the dark
        const look = {...LOOKS.tianmen, fog: '#' + light.haze.map(c => (c | 0).toString(16).padStart(2, '0')).join(''), lights: night};

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
            const onMountain = d.kind[t] === 'mountain';
            const inTunnel = onMountain && d.tunnel[t];
            const xl1 = sx1 - hl * w1;
            const xl2 = sx2 - hl * w2;
            const xr1 = sx1 + hl * w1;
            const xr2 = sx2 + hl * w2;
            if (inTunnel) {
                const tc1 = yAt(D.roof, n);
                const tc2 = yAt(D.roof, n + 1);
                const pillar = i % 4 === 0;
                const beam = i % 2 === 0;
                const f2 = Math.min(1, f + 0.05);
                const concrete = hazed([172, 166, 150], f2);
                // The portal: a pale concrete face where the tunnel begins, ending at the thick outer wall on the right
                // (nothing above it: the sky stays); the wall's front face runs from the lintel down to the bottom
                const thick = 0.45;
                const rb1 = sx1 + (hl + thick) * w1;
                const yb1 = yAt(-60, n);
                if (!d.tunnel[t - 1]) {
                    const h2 = yAt(9.6, n);
                    four(concrete, -4, tc1, rb1, tc1, rb1, h2, -4, h2);
                    four(concrete, xr1, h2, rb1, h2, rb1, yb1, xr1, yb1);
                }
                // Between the pillars: the valley, the river and its boats
                const b1 = yAt(-d.valley[t], n);
                const b2 = yAt(-d.valley[t + 1], n + 1);
                const river = drawValleyFloor(d, t, sx1, sx2, w1, w2, b1, b2, f, xr1, xr2);
                if (river && d.boat[t] && n >= 6 && n < 160) {
                    const hv3 = testHash(i * 13 + 2);
                    drawBoat(sx1 + (river[0] + river[1]) / 2 * w1 + (hv3 - 0.5) * 0.9 * w1, (b1 + b2) / 2, pp1, f2 * 0.7, hv3);
                }
                for (const side of [-1, 1]) {
                    const e = side < 0 ? -4 : W + 4;
                    const a1 = sx1 + side * hl * w1;
                    const a2 = sx2 + side * hl * w2;
                    if (pillar) {
                        const dark = hazed([108, 92, 86], f2);
                        if (side < 0) {
                            four(dark, e, y1, a1, y1, a2, y2, e, y2);
                            four(dark, e, tc1, a1, tc1, a1, y1, e, y1);
                        } else {
                            four(dark, a1, tc1, rb1, tc1, rb1, yb1, a1, yb1);
                        }
                        four(dark, a1, y1, a2, y2, a2, tc2, a1, tc1);
                        const l1 = yAt(2.2, n);
                        const l2 = yAt(3.4, n);
                        four(hazed([255, 154, 60], f2), a1, l1, a1, l2, a2, yAt(3.4, n + 1), a2, yAt(2.2, n + 1));
                        if (n >= 3 && n < 70) {
                            tunnelGlow(a1, (l1 + l2) / 2, Math.min(pp1 * 1.7, 60 * px), 0.5);
                        }
                    } else {
                        if (side < 0) {
                            const rock = hazed(i % 3 === 1 ? [178, 168, 152] : [160, 150, 134], Math.min(1, f2 + 0.25));
                            four(rock, e, tc1, a1, tc1, a2, tc2, a2, y2);
                            four(rock, e, tc1, a2, tc2, a2, y2, e, y1);
                        } else {
                            four(hazed([164, 158, 142], f2), a1, y1, a2, y2, a2, yAt(-d.valley[t + 1], n + 1), a1, yAt(-d.valley[t], n));
                        }
                        const p1 = yAt(1, n);
                        const p2 = yAt(1, n + 1);
                        four(hazed([138, 123, 114], f2), a1, y1, a2, y2, a2, p2, a1, p1);
                        four(hazed([176, 161, 152], f2), a1, p1, a2, p2, a2, yAt(1.18, n + 1), a1, yAt(1.18, n));
                    }
                }
                // The roof with beams, its edges' faces up to the slab's top, and a red neon line along each side
                four(hazed(beam ? [74, 64, 61] : [102, 92, 86], f2), sx1 - (hl + 1.4) * w1, tc1, sx1 + (hl + thick) * w1, tc1,
                    sx2 + (hl + thick) * w2, tc2, sx2 - (hl + 1.4) * w2, tc2);
                for (const side of [-1, 1]) {
                    const out = hl + (side > 0 ? thick : 0.5);
                    four(concrete, sx1 + side * out * w1, tc1, sx2 + side * out * w2, tc2, sx2 + side * out * w2, yAt(9.6, n + 1),
                        sx1 + side * out * w1, yAt(9.6, n));
                }
                for (const side of [-1, 1]) {
                    const a = side * 0.74;
                    const b = side * 0.84;
                    four(hazed([255, 74, 90], f * 0.5), sx1 + a * w1, tc1, sx1 + b * w1, tc1, sx2 + b * w2, tc2, sx2 + a * w2, tc2);
                    if (n >= 3 && n < 70 && i % 2 === 0) {
                        tunnelGlow(sx1 + side * 0.79 * w1, tc1, Math.min(pp1 * 1.2, 50 * px), 0.4);
                    }
                }
            } else if (onMountain) {
                const f2 = Math.min(1, f + 0.12);
                const hv = testHash(i * 5 + 3);
                const hv2 = testHash(i * 11 + 7);
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
                const b1 = yAt(-d.valley[t], n);
                const b2 = yAt(-d.valley[t + 1], n + 1);
                const river = drawValleyFloor(d, t, sx1, sx2, w1, w2, b1, b2, f, xr1, xr2);
                if (river && d.boat[t] && n >= 6 && n < 160) {
                    const hv3 = testHash(i * 13 + 2);
                    drawBoat(sx1 + (river[0] + river[1]) / 2 * w1 + (hv3 - 0.5) * 0.9 * w1, (b1 + b2) / 2, pp1, f2 * 0.7, hv3);
                }
                four(hazed([164, 158, 142], f2), xr1, y1, xr2, y2, xr2, b2, xr1, b1);
                if (d.valley[t] < 20) {
                    const m1 = yAt(-d.valley[t] * 0.45, n);
                    const m2 = yAt(-d.valley[t + 1] * 0.45, n + 1);
                    four(hazed([124, 118, 102], f2), xr1, m1, xr2, m2, xr2, b2, xr1, b1);
                    const k1 = yAt(-d.valley[t] * 0.8, n);
                    const k2 = yAt(-d.valley[t + 1] * 0.8, n + 1);
                    four(hazed([98, 94, 82], f2), xr1, k1, xr2, k2, xr2, b2, xr1, b1);
                }
                if (n < 90) {
                    for (const down of [-5, -10, -15, -20, -25]) {
                        if (-down <= d.valley[t] - 1) {
                            four('rgba(90,84,70,.22)', xr1, yAt(down, n), xr2, yAt(down, n + 1), xr2, yAt(down - 0.8, n + 1), xr1, yAt(down - 0.8, n));
                        }
                    }
                }
            } else {
                // The city: the river just below the road on the right, its violet swell, a boat now and then, the lights'
                // reflections; on the left the hillside houses, or the river
                const city = cityOf(d);
                const wy1 = yAt(d.water[t], n);
                const wy2 = yAt(d.water[t], n + 1);
                const water = hazed(rgbMix(rgbMix(colors.water, [18, 26, 88], 0.35), [76, 48, 140],
                    (0.5 + 0.5 * Math.sin(i * 0.037 + Math.sin(i * 0.011) * 2)) * 0.5), f);
                four(water, xr1, wy1, W + 4, wy1, W + 4, wy2, xr2, wy2);
                if (city.boat[i] && n >= 8) {
                    drawCityBoat(city, i, sx1, pp1, (wy1 + wy2) / 2, f);
                }
                if (i % 2 === 0 && n > 12) {
                    const hv = testHash(i * 7 + 1);
                    const hv2 = testHash(i * 13 + 5);
                    if (hv < 0.85) {
                        const side = city.section[i] < 0 && i % 4 === 2 ? -1 : 1;
                        const cx = sx1 + side * (14 + hv * 110) * pp1;
                        const cy = (wy1 + wy2) / 2;
                        const rx = (3 + hv2 * 8) * pp1;
                        const ry = Math.max(0.8 * px, rx * 0.07);
                        ctx.save();
                        ctx.globalCompositeOperation = 'lighter';
                        ctx.fillStyle = hv2 < 0.4 ? 'rgba(255,176,74,.24)' : hv2 < 0.7 ? 'rgba(255,96,170,.2)' : 'rgba(255,224,120,.22)';
                        ctx.beginPath();
                        ctx.ellipse(cx, cy, rx, ry, 0, 0, 7);
                        ctx.fill();
                        ctx.beginPath();
                        ctx.ellipse(cx, cy, rx * 0.45, ry * 0.6, 0, 0, 7);
                        ctx.fill();
                        ctx.restore();
                    }
                }
                if (city.section[i] >= 0) {
                    drawCityHouses(city, i, n, {sx1, sx2, w1, w2, y1, y2, pp1, pp2, f, yAt});
                } else {
                    four(water, -4, wy1, xl1, wy1, xl2, wy2, -4, wy2);
                }
            }

            if (!onMountain && t >= BR.CITY && n < D.ahead) {
                drawSkyscrapers(d.water[t], BR.CITY, i, t, n, {sx1, sx2, w1, w2, pp1, pp2, f, yAt});
            }
            // The road; the start and the goal across it in checks
            const brk = !onMountain ? smoothStep(BR.BR0 - 30, BR.BR0 + 20, t) : 0; // 0 before the bridge, 1 on it
            const gate = Math.floor(t * SEG / Track.SEGMENT) - Track.RUN_UP;
            const startLine = gate === 0 || gate === 1 || gate === goal || gate === goal + 1;
            const o = 1.2 * px; // a little over the next, so no seams show
            four(startLine ? '#f2f2f2' : hazed(inTunnel ? rgbMix(colors.asph2, [34, 22, 44], 0.4) : brk > 0 ? rgbMix(colors.asph2, [70, 54, 124], 0.5 * brk) : colors.asph2, f),
                sx1 - w1, y1 + o, sx1 + w1, y1 + o, sx2 + w2, y2 - o, sx2 - w2, y2 - o);
            if (startLine) {
                drawChecks(sx1, y1, w1, sx2, y2, w2, t);
            }
            if (inTunnel) {
                for (const side of [-1, 1]) {
                    four(`rgba(255,80,96,${0.2 * (1 - f)})`, sx1 + side * 0.78 * w1, y1, sx1 + side * 0.78 * w1 + 0.1 * w1, y1,
                        sx2 + side * 0.78 * w2 + 0.1 * w2, y2, sx2 + side * 0.78 * w2, y2);
                }
            }
            const kerb = hazed(colors.kerb, f);
            four(kerb, xl1, y1 + o, sx1 - w1, y1 + o, sx2 - w2, y2 - o, xl2, y2 - o);
            four(kerb, sx1 + w1, y1 + o, xr1, y1 + o, xr2, y2 - o, sx2 + w2, y2 - o);
            if (n < 110 && !startLine) {
                const line = hazed(rgbMix(colors.line, colors.asph, 0.35), f);
                const lineL = brk > 0 ? hazed([255, 206, 70], f) : line; // on the bridge: yellow on the left, white on the right
                const lineR = brk > 0 ? hazed([246, 246, 255], f) : line;
                four(lineL, sx1 - 0.93 * w1, y1, sx1 - 0.9 * w1, y1, sx2 - 0.9 * w2, y2, sx2 - 0.93 * w2, y2);
                four(lineR, sx1 + 0.9 * w1, y1, sx1 + 0.93 * w1, y1, sx2 + 0.93 * w2, y2, sx2 + 0.9 * w2, y2);
                if (Math.floor(i / 3) % 2 === 0) {
                    four(brk > 0 ? lineR : line, sx1 - 0.012 * w1, y1, sx1 + 0.012 * w1, y1, sx2 + 0.012 * w2, y2, sx2 - 0.012 * w2, y2);
                }
            }
            // At night: the lamps' light on the wet road, and now and then a neon sign's
            if (night > 0.1 && n < 170 && n > 6) {
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                if (d.lamp[t] === 1) {
                    const k = n + 2;
                    const wk = F * ROAD / Z(k);
                    for (const side of [-1, 1]) {
                        const a = side * 0.55;
                        const b = side * 0.92;
                        four(`rgba(255,154,60,${0.2 * night})`, sx1 + a * w1, y1, sx1 + b * w1, y1, roadMiddle(k) + b * wk, roadY(k),
                            roadMiddle(k) + a * wk, roadY(k));
                    }
                }
                const hv = testHash(i * 3 + 9);
                if (i % 5 === 0 && hv < 0.45) {
                    const c = hv < 0.15 ? '255,63,168' : hv < 0.3 ? '63,208,255' : '168,107,255';
                    const at = hv * 4 - 0.9;
                    const k = n + 4;
                    const wk = F * ROAD / Z(k);
                    four(`rgba(${c},${0.2 * night})`, sx1 + (at - 0.1) * w1, y1, sx1 + (at + 0.1) * w1, y1, roadMiddle(k) + (at + 0.1) * wk, roadY(k),
                        roadMiddle(k) + (at - 0.1) * wk, roadY(k));
                }
                ctx.restore();
            }
            // Guardrails with a flat top (a light in them in the city), and the parapet's blocks over a deep valley
            if (!inTunnel) {
                for (const side of [-1, 1]) {
                    const rx1 = sx1 + side * hl * w1;
                    const rx2 = sx2 + side * hl * w2;
                    four(hazed(brk > 0 ? rgbMix(colors.railD, [150, 138, 198], 0.8 * brk) : colors.railD, f), rx1, y1, rx1, y1 - 0.55 * pp1, rx2, y2 - 0.55 * pp2, rx2, y2);
                    four(hazed(brk > 0 ? rgbMix(colors.rail, [214, 204, 246], 0.85 * brk) : colors.rail, f), rx1, y1 - 0.55 * pp1, rx1, y1 - 1.08 * pp1, rx2, y2 - 1.08 * pp2, rx2, y2 - 0.55 * pp2);
                    if (brk > 0.5 && t < BR.CITY && i % 4 === 0 && n < 90 && n > 3) { // an amber light in the barrier (none in the city)
                        const xm = lerp(rx1, rx2, 0.45);
                        const xn2 = lerp(rx1, rx2, 0.6);
                        const ym = lerp(y1, y2, 0.45);
                        const yn = lerp(y1, y2, 0.6);
                        const pm = lerp(pp1, pp2, 0.45);
                        const pn = lerp(pp1, pp2, 0.6);
                        four(hazed([255, 176, 64], f * 0.5), xm, ym - 0.55 * pm, xm, ym - 0.9 * pm, xn2, yn - 0.9 * pn, xn2, yn - 0.55 * pn);
                        lampGlow(xm, ym - 0.72 * pm, pp1 * 2.2, 0.55);
                    }
                    const top1 = 0.3 * w1;
                    const top2 = 0.3 * w2;
                    four(hazed(rgbMix(colors.rail, [255, 255, 255], 0.35), f), rx1, y1 - 1.08 * pp1, rx1 + side * top1, y1 - 1.08 * pp1,
                        rx2 + side * top2, y2 - 1.08 * pp2, rx2, y2 - 1.08 * pp2);
                    if (i % 6 === 0) {
                        four(hazed(colors.railD, f), rx1, y1 - 1.08 * pp1, rx1 + side * top1, y1 - 1.08 * pp1, rx1 + side * top1, y1 - 0.5 * pp1,
                            rx1, y1 - 0.55 * pp1);
                    }
                    if (d.lamp[t] === 1) {
                        const a = y1 - 0.64 * pp1;
                        const b = y1 - 0.98 * pp1;
                        four(night > 0.5 ? '#ffe9b8' : '#fff3dc', rx1, a, rx1, b, rx2, y2 - 0.98 * pp2, rx2, y2 - 0.64 * pp2);
                        if (n < 120) {
                            lampGlow((rx1 + rx2) / 2, (a + b) / 2, pp1 * 3.2, 0.75);
                        }
                    }
                }
                if (onMountain && i % 2 === 0 && d.valley[t] >= 12) {
                    four(hazed([196, 190, 172], f), xr1, y1 - 1.08 * pp1, xr2, y2 - 1.08 * pp2, xr2, y2 - 1.75 * pp2, xr1, y1 - 1.75 * pp1);
                    four(hazed([226, 220, 202], f), xr1, y1 - 1.75 * pp1, xr1 + 0.3 * w1, y1 - 1.75 * pp1, xr2 + 0.3 * w2, y2 - 1.75 * pp2,
                        xr2, y2 - 1.75 * pp2);
                    four(hazed([150, 144, 128], f), xr1, y1 - 1.08 * pp1, xr1 + 0.3 * w1, y1 - 1.08 * pp1, xr1 + 0.3 * w1, y1 - 1.75 * pp1,
                        xr1, y1 - 1.75 * pp1);
                }
            }
            // A lamp post on the left or the right, along the riverside
            for (const postSide of [-1, 1]) {
                if (!(postSide < 0 ? d.lamp[t] === 2 || d.lamp[t] === 4 : d.lamp[t] === 3 || d.lamp[t] === 4)) {
                    continue;
                }
                const alpha = Math.max(0, Math.min(1, (D.ahead - n) / 40)) * Math.max(0, Math.min(1, (z1 - 4.8) / 4.4));
                const dw = 3.4 * pp1;
                const dh = 7 * pp1;
                const cx = W / 2 + F * (X(n) + postSide * 4.9 - cameraX) / z1;
                const top = y1 - dh;
                if (alpha >= 0.02 && dw >= 1.5 * px) {
                    const [day, dark] = lampSprite();
                    ctx.save();
                    ctx.globalAlpha = alpha;
                    if (night <= 0.97) {
                        ctx.drawImage(day, cx - dw / 2, top, dw, dh);
                    }
                    if (night >= 0.03) {
                        ctx.globalAlpha = alpha * (night > 0.97 ? 1 : night);
                        ctx.drawImage(dark, cx - dw / 2, top, dw, dh);
                    }
                    ctx.restore();
                    for (const hx of [0.2, 0.8]) {
                        lampGlow(cx - dw / 2 + hx * dw, top + 0.17 * dh, pp1 * 4.5, 0.85);
                    }
                }
            }

            if (brFar && n >= 0 && (t === BR.BRP[0] || t === BR.BRP[1])) {
                drawPylon(t);
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
                        RIDER_COLORS[view.color], lean, view.braking, null, night, bike.air * perMeter);
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
                    scale * D.bike, other.color, other.lean, other.braking, other.name, night, (other.air || 0) * scale);
            }
        }
        // Pylons behind the camera
        if (brFar) {
            for (const p of BR.BRP) {
                if (p - base < 0) {
                    drawPylon(p);
                }
            }
        }
        // Darker at night
        if (night > 0.02) {
            ctx.fillStyle = `rgba(6,8,40,${0.12 * night})`;
            ctx.fillRect(0, 0, W, H);
        }
    }

    // A soft cloud: a shaded underside, then the white
    function cloud(x, y, w, white = '#ffffff', shade = '#c8d8ee') {
        for (const [color, parts] of [[shade, [[0, 0.05, 0.5, 0.22], [0.34, 0.1, 0.36, 0.2], [-0.36, 0.12, 0.34, 0.18], [0.1, -0.06, 0.32, 0.22]]],
            [white, [[0, 0, 0.5, 0.22], [0.34, 0.06, 0.36, 0.2], [-0.36, 0.08, 0.34, 0.18], [0.1, -0.1, 0.32, 0.22]]]]) {
            for (const [dx, dy, rx, ry] of parts) {
                blob(color, x + dx * w, y + dy * w * 0.5 + (color === shade ? w * 0.04 : 0), rx * w * 0.5, ry * w * 0.5);
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
    let turboFlame = false; // the own bike's turbo is on: flames from its exhausts

    function drawBike(x, y, scale, color, lean, braking, name, lights = 0, lift = 0) {
        if (scale < 0.5) {
            return;
        }
        // One cohesive, rounded rider seen from behind: pastel helmet with a dark band, plum jacket with arms out to the
        // bars, peach hands, dark trousers; the bike's pink rear fairing over a dark purple body, one taillight, one fat
        // tyre and two exhausts. The rider's own colour tints the helmet, fairing and jacket.
        const base = hexRgb(color);
        const pastel = rgb(rgbMix(base, [255, 255, 255], 0.5));
        const pastelHi = rgb(rgbMix(base, [255, 255, 255], 0.78));
        const jacket = rgb(rgbMix(base, [44, 22, 66], 0.76));
        const jacketShade = rgb(rgbMix(base, [34, 16, 52], 0.84));
        const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
        const soft = (fill, pts) => { // a closed shape with rounded corners
            const n = pts.length;
            const start = mid(pts[n - 1], pts[0]);
            ctx.fillStyle = fill;
            ctx.beginPath();
            ctx.moveTo(start[0], start[1]);
            for (let k = 0; k < n; k++) {
                const to = mid(pts[k], pts[(k + 1) % n]);
                ctx.quadraticCurveTo(pts[k][0], pts[k][1], to[0], to[1]);
            }
            ctx.closePath();
            ctx.fill();
        };
        const mirror = pts => pts.map(([px0, py0]) => [-px0, py0]).reverse();
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(scale, scale);
        const away = Math.max(0.35, 1 - lift / scale * 0.25); // the shadow smaller the higher it flies
        blob(`rgba(0,0,0,${0.28 * away})`, 0, 0, 0.42 * away, 0.07 * away);
        ctx.translate(0, -lift / scale);
        ctx.rotate(lean);
        // Handlebar, behind the rider
        ctx.strokeStyle = '#352a45';
        ctx.lineWidth = 0.06;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-0.58, -1.06);
        ctx.lineTo(0.58, -1.06);
        ctx.stroke();
        // Legs: dark trousers down to the footrests, mostly hidden by the bike's body
        const leg = [[-0.3, -1.0], [-0.14, -1.0], [-0.14, -0.84], [-0.22, -0.62], [-0.3, -0.45], [-0.44, -0.42], [-0.44, -0.52], [-0.38, -0.8]];
        soft('#3d2c5a', leg);
        soft('#3d2c5a', mirror(leg));
        soft('#2c2040', [[-0.5, -0.4], [-0.3, -0.4], [-0.3, -0.35], [-0.5, -0.35]]);
        soft('#2c2040', [[0.5, -0.4], [0.3, -0.4], [0.3, -0.35], [0.5, -0.35]]);
        // The one fat rear tyre
        soft('#2b2535', [[-0.1, 0], [-0.135, -0.1], [-0.125, -0.5], [0.125, -0.5], [0.135, -0.1], [0.1, 0]]);
        // Exhausts: light cylinders, a round dark opening facing back, a warm accent where they mount
        for (const side of [-1, 1]) {
            const ex = side * 0.255;
            soft('#c9c3dc', [[side * 0.17, -0.37], [side * 0.34, -0.37], [side * 0.34, -0.23], [side * 0.17, -0.23]]);
            ctx.fillStyle = '#e4e0f0';
            ctx.beginPath();
            ctx.ellipse(ex, -0.3, 0.078, 0.078, 0, 0, 7);
            ctx.fill();
            ctx.fillStyle = '#3d2c58';
            ctx.beginPath();
            ctx.ellipse(ex, -0.3, 0.05, 0.05, 0, 0, 7);
            ctx.fill();
            ctx.fillStyle = '#ff9a4a';
            ctx.beginPath();
            ctx.ellipse(side * 0.33, -0.34, 0.025, 0.02, 0, 0, 7);
            ctx.fill();
            if (turboFlame && name === null) { // a flickering flame out of each opening, towards the camera
                const flicker = 0.85 + 0.3 * Math.random();
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                blob('rgba(255,120,40,0.55)', ex, -0.3, 0.17 * flicker, 0.15 * flicker);
                blob('rgba(255,190,90,0.8)', ex, -0.3, 0.1 * flicker, 0.09 * flicker);
                blob('rgba(255,245,210,0.95)', ex, -0.3, 0.045, 0.045);
                ctx.restore();
            }
        }
        // Bike body: deep purple below, the pastel rear fairing over it, the taillight under the fairing
        soft('#4a2f6e', [[-0.3, -0.72], [-0.33, -0.6], [-0.23, -0.44], [-0.12, -0.4], [0.12, -0.4], [0.23, -0.44], [0.33, -0.6], [0.3, -0.72]]);
        soft(pastel, [[-0.33, -0.7], [-0.31, -0.82], [-0.17, -0.93], [0.17, -0.93], [0.31, -0.82], [0.33, -0.7], [0, -0.67]]);
        soft(pastelHi, [[-0.2, -0.82], [-0.12, -0.89], [-0.05, -0.88], [-0.12, -0.8]]);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        blob(braking ? 'rgba(255,70,60,0.7)' : `rgba(255,60,50,${0.22 + 0.25 * Math.min(1, lights)})`, 0, -0.6, braking ? 0.34 : 0.27, braking ? 0.13 : 0.1);
        ctx.restore();
        soft(braking ? '#ff6a50' : '#ff9a5a', [[-0.15, -0.64], [-0.15, -0.58], [0.15, -0.58], [0.15, -0.64]]);
        soft(braking ? '#fff0d0' : '#ffe6bd', [[-0.08, -0.625], [-0.08, -0.595], [0.08, -0.595], [0.08, -0.625]]);
        // Torso: broad rounded shoulders, a slight waist
        soft(jacket, [[-0.24, -0.94], [-0.3, -1.06], [-0.34, -1.22], [-0.26, -1.36], [-0.12, -1.42], [0.12, -1.42], [0.26, -1.36], [0.34, -1.22], [0.3, -1.06], [0.24, -0.94], [0, -0.92]]);
        // Arms out to the bars, tapering to the wrists, joined at the shoulders
        const arm = [[-0.24, -1.4], [-0.38, -1.34], [-0.5, -1.2], [-0.52, -1.06], [-0.44, -1.05], [-0.4, -1.15], [-0.3, -1.24]];
        soft(jacket, arm);
        soft(jacket, mirror(arm));
        soft(jacketShade, [[-0.3, -1.24], [-0.4, -1.15], [-0.44, -1.05], [-0.38, -1.1], [-0.29, -1.18]]);
        soft(jacketShade, mirror([[-0.3, -1.24], [-0.4, -1.15], [-0.44, -1.05], [-0.38, -1.1], [-0.29, -1.18]]));
        // Small peach hands on the bars
        for (const side of [-1, 1]) {
            ctx.fillStyle = '#f6c7a8';
            ctx.beginPath();
            ctx.ellipse(side * 0.485, -1.05, 0.05, 0.05, 0, 0, 7);
            ctx.fill();
        }
        // Helmet: a big bubble, a lighter highlight, a dark band round the lower back
        ctx.fillStyle = pastel;
        ctx.beginPath();
        ctx.ellipse(0, -1.6, 0.2, 0.19, 0, 0, 7);
        ctx.fill();
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(0, -1.6, 0.2, 0.19, 0, 0, 7);
        ctx.clip();
        ctx.fillStyle = '#3a2c4c';
        ctx.fillRect(-0.25, -1.5, 0.5, 0.1);
        ctx.restore();
        ctx.fillStyle = pastelHi;
        ctx.beginPath();
        ctx.ellipse(-0.07, -1.68, 0.07, 0.045, -0.4, 0, 7);
        ctx.fill();
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
