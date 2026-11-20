// Moto Race's picture: the road as seen from behind the own bike, with what stands beside it and on it, and the other
// bikes on it. All drawn in code. The road is drawn from near to far, each segment only where nearer hills don't hide it; then what
// stands on it from far to near, cut off where a hill in front covers it.
const Scene = (() => {
    const DRAW_SEGMENTS = 230; // 920 m ahead (the haze still works over the first 680 m)
    const CAMERA_BACK = 6.5; // the camera is this far behind the bike
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
        // Drawn by drawDescent, as in the html test; its haze, for what stands on the road
        // Bright day in the Japanese countryside: layered blue mountains, rice fields and a railway wall (drawCountry)
        countryside: {
            sky: ['#3f9fe8', '#cfe9f8'], fog: '#d8edf7', hills: ['#bcd5ee', '#8db3e3', '#5f8acf'], grass: ['#78c050', '#78c050'],
            road: ['#6e6a7c', '#6a6678'], rumble: ['#f6f6f2', '#f6f6f2'], line: '#fbfbf6', sun: '#ffffff', lights: 0, country: true
        },
        tianmen: {fog: '#d6e4ec', lights: 0}
    };

    let canvas = null;
    let ctx = null;
    let width = 0;
    let height = 0;
    let skyShift = 0;
    let currentTrains = []; // the bullet trains on the railway: {head, len}: where its nose is, in m along the road, and how long it is (it travels the way the road does)
    let shownNow = null; // the segments in view, and the camera's height, for the line-of-sight test of far valley things
    let cameraYNow = 0;
    let currentTrack = null; // the track being drawn (the valley's ground is worked out from it)
    let finale = 0; // 0 to 1: how far into the final viewpoint (more far ranges, mist and clouds below the ridges)
    let farness = 0; // 0 to 1: how much of the Sa Pa valley the rider has come to (the far mountains rise with it)

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
        currentTrains = view.trains || [];
        currentTrack = track;
        finale = track.country ? (t => t * t * (3 - 2 * t))(Math.max(0, Math.min(1, (Track.layoutOf(bike.z / Track.SEGMENT) - 1230) / 170))) : 0;
        farness = track.country ? Math.max(0, Math.min(1, (Track.mapA(bike.z / Track.SEGMENT) - 560) / 440)) : 0;
        if (track.descent) {
            drawDescent(view);
            return;
        }
        const look = LOOKS[track.key];
        const isFar = segment => Track.mapA(segment.index - Track.RUN_UP) >= 425; // where the railway leaves the road
        const upright = height > width;
        // Sideways, the camera comes closer: the road and the bikes fill more of the wide screen, with less sky
        const horizon = height * (upright ? 0.42 : 0.45); // Heaven's Gate camera
        
        // The road at the bike takes most of the width; the camera's height follows from where the bike is on screen
        const focal = upright ? width * 0.66 : Math.max(width * 0.5 / Math.tan(40 * Math.PI / 180), height * 0.42);
        const bikeGround = Track.heightAt(track, bike.z);
        const camGround = Track.heightAt(track, bike.z - CAMERA_BACK);
        const bikeY = horizon + focal * (2 + camGround - bikeGround) / CAMERA_BACK; // exactly as in Heaven's Gate // as in Heaven's Gate: the camera follows the ground under it, the bike moves on the screen over rises and dips
        const cameraHeight = 2;
        const cameraZ = bike.z - CAMERA_BACK;
        // In the air the camera goes up with the bike, a little less, so the bike is seen rising and the road dropping away
        const cameraY = camGround + cameraHeight; // as in Heaven's Gate: the ground under the camera, 2 m up
        const cameraX = bike.x;
        // Bikes are drawn bigger than they are, to be seen well, but the own one no taller than a fifth of the screen
        // (a phone sideways, where the screen is low: a third; a tablet sideways: a quarter)
        const tallest = upright ? 0.21 : height < 500 ? 0.32 : 0.24;
        const bikeScale = 0.81;

        // The far view turns with the road
        skyShift += view.turned;
        drawSky(look, horizon, upright);
        // The land far off, in the haze: seen under the horizon where the road beyond a crest is hidden (left unpainted,
        // it kept what was drawn there before, and things left trails)
        ctx.fillStyle = look.country ? mix('#b9e38c', look.fog, 0.25) : look.fog; // the far land of the countryside: light green
        ctx.fillRect(0, horizon + 2, width, height - horizon - 2);
        if (look.country) {
            // the far land in bands of different greens (fields and hedges in the haze), wider the nearer: not one flat sheet
            const farGreens = ['#a6dc78', '#c4e88c', '#94d26e', '#b5e281', '#9ed874'];
            let by = horizon + 2;
            for (let k = 0; k < 14 && by < height; k++) {
                const bh = (2 + k * k * 0.9) * (height / 390);
                let bandColor = hexMix(farGreens[(k * 3) % 5], look.fog, 0.2);
                if (finale > 0.001) {
                    // the viewpoint: the valley far below is forest, hazy and pale far off, darker nearer, with rounded tree tops
                    const dt = Math.min(1, k / 9);
                    bandColor = hexMix(bandColor, hexMix(hexMix('#a9cfae', '#5d9c6a', dt), '#2f7a46', Math.max(0, dt - 0.4)), finale);
                }
                ctx.fillStyle = bandColor;
                ctx.fillRect(0, by, width, Math.min(bh, height - by));
                if (finale > 0.001 && k < 11) {
                    const r = Math.max(2.5, bh * 0.55);
                    for (let x = -((skyShift * 0.05) % r); x < width + r; x += r * 1.5) {
                        ctx.beginPath();
                        ctx.arc(x, by + 0.5, r * (0.8 + 0.4 * hash(Math.floor((x + skyShift * 0.05) / r) + k * 17)) * finale, Math.PI, 0);
                        ctx.fill();
                    }
                }
                by += bh;
            }
        }

        if (look.country && finale > 0.001) {
            // white clouds lying over the forest, far below
            const cu = Math.max(8, horizon * 0.09);
            const cspan = width + cu * 24;
            for (const [k, dy, size] of [[0, 0.035, 1.6], [1, 0.07, 2.2], [2, 0.05, 1.3], [3, 0.095, 2.6]]) {
                const cx = (((k * 0.27 * cspan - skyShift * 0.4) % cspan) + cspan) % cspan - cu * 10;
                const cy = horizon + height * dy;
                ctx.fillStyle = 'rgba(255,255,255,' + (0.85 * finale) + ')';
                ctx.beginPath();
                ctx.ellipse(cx, cy, cu * 3.6 * size, cu * 0.5 * size, 0, 0, Math.PI * 2);
                ctx.ellipse(cx - cu * 1.9 * size, cy + cu * 0.12, cu * 2 * size, cu * 0.45 * size, 0, 0, Math.PI * 2);
                ctx.ellipse(cx + cu * 2.1 * size, cy + cu * 0.1, cu * 2.2 * size, cu * 0.42 * size, 0, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        if (look.country && finale > 0.001) {
            const haze2 = ctx.createLinearGradient(0, horizon, 0, horizon + height * 0.12);
            haze2.addColorStop(0, 'rgba(255,255,255,' + (0.55 * finale) + ')');
            haze2.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = haze2;
            ctx.fillRect(0, horizon + 2, width, height * 0.12);
        }

        const first = Track.RUN_UP + Math.floor(cameraZ / Track.SEGMENT);
        const into = cameraZ / Track.SEGMENT - Math.floor(cameraZ / Track.SEGMENT);
        const bendStep = Track.BEND * Track.SEGMENT;
        let x = 0;
        let dx = -track.segments[first].bend * bendStep * into;
        let lowest = height; // nearer road already covers what is below this
        let lowestX = null; // where that crest is across the screen, and how big a metre is there
        let lowestS = 0;
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
            shown.push({segment, n, z1, z2, x1, x2, y1, y2, scale1, scale2, roadX: x, roadDx: dx, clip: lowest, clipX: lowestX, clipS: lowestS, visible});
            x += dx;
            dx += segment.bend * bendStep;
            if (visible) {
                lowest = y2;
                lowestX = x2;
                lowestS = scale2;
            }
        }
        // how far into a hidden stretch (behind a crest) each segment lies: its first few still show their railway wall and trees
        {
            let run = 0;
            for (const entry of shown) {
                run = entry.visible ? 0 : run + 1;
                entry.hr = run;
            }
        }
        shownNow = shown;
        cameraYNow = cameraY;
        if (look.country && currentTrack) {
            // the tallest hill between the camera and each segment: what lies lower beyond a taller hill is hidden by it
            let tallest = 0;
            for (const entry of shown) {
                const tp = Track.terrain(currentTrack.segments, entry.segment.index - Track.RUN_UP);
                const hc = tp.Hc * (1 - tp.g); // where the way to the valley is open there is no hill
                entry.hc = hc;
                entry.tp = tp;
                entry.nearHc = tallest;
                tallest = Math.max(tallest, hc);
            }
        }

        // Far to near, each a little over the one behind it, so no seams show: first the ground, then the road on it. Where a
        // hill in front hides the lower part of a segment, its road is cut off there.
        for (let i = shown.length - 1; i >= 0; i--) {
            const {segment, n, y1, y2, visible} = shown[i];
            if (visible) {
                const top = Math.max(y2 - 0.7, 0);
                ctx.fillStyle = mix(look.grass[Math.floor(segment.index / 3) % 2], look.fog, haze(n));
                // The countryside: no ground beyond the railway wall (seen over it from high up, it was a green strip)
                // (where the ground falls away to the valley beside the road, the flat fill stops at its edge: the slopes and the far
                // land are drawn there, not one flat green sheet at the road's level)
                const open = look.country && currentTrack && Track.terrain(currentTrack.segments, segment.index - Track.RUN_UP).floor < -0.3;
                const side = open ? Track.SLOPE_AT + 0.5 : Track.ROAD + 8.5 + 9;
                const reach = look.country ? Math.max(0, Math.min(width, shown[i].x1 + side * shown[i].scale1)) : width;
                if (look.country) {
                    // the outer edge follows the segment (near end to far end) instead of a square step, so a hill's edge is a smooth line
                    const reachFar = Math.max(0, Math.min(width, shown[i].x2 + side * shown[i].scale2));
                    const bottom = Math.min(y1, height);
                    const k = bottom > y2 ? Math.max(0, Math.min(1, (top - y2) / (bottom - y2))) : 0;
                    const reachTop = reachFar + (reach - reachFar) * k;
                    ctx.beginPath();
                    ctx.moveTo(0, top);
                    ctx.lineTo(reachTop, top);
                    ctx.lineTo(reach, bottom);
                    ctx.lineTo(0, bottom);
                    ctx.closePath();
                    ctx.fill();
                } else {
                    ctx.fillRect(0, top, reach, Math.min(y1, height) - top);
                }
            }
        }
        for (let i = shown.length - 1; i >= 0; i--) {
            const {segment, n, x2, scale1, scale2, clip, visible} = shown[i];
            if (!visible) {
                if (look.country && shown[i].z1 >= 1 && isFar(segment)) {
                    // the valley beside a hidden stretch of road is still seen from the road's side
                    drawCountry(shown[i], look, n, 'ground');
                }
                if (look.country && shown[i].z1 >= 1 && !isFar(segment)) {
                    // Behind a crest the road is hidden, but the railway wall stands higher than it: drawn here, in turn with the
                    // road, so what is nearer covers it
                    drawCountry(shown[i], look, n, true);
                }
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
            if (look.country) {
                // Beyond segment 425 the railway, its masts, the hills and what stands on them are drawn here, a segment at a
                // time with the road: what is nearer then hides what is behind (a hill hides the railway)
                if (isFar(segment)) {
                    drawCountry(shown[i], look, n, true);
                    if (shown[i].z1 >= 1) {
                        for (const thing of segment.things) {
                            if (thing.kind === 'pole') {
                                drawThing(thing, shown[i], look, cameraX, n);
                            }
                        }
                    }
                }
                drawCountry(shown[i], look, n, 'ground');
                if (isFar(segment) && shown[i].z1 >= 1) {
                    for (const thing of segment.things) {
                        if (thing.kind !== 'pole' && farRight(thing, n)) {
                            drawThing(thing, shown[i], look, cameraX, n);
                        }
                    }
                }
            }
            const fade = haze(n);
            const stripe = Math.floor(segment.index / 3) % 2;
            quad(mix(look.rumble[stripe], look.fog, fade), x1, y1, w1 * 1.13, x2, y2, w2 * 1.13);
            const gate = segment.index - Track.RUN_UP;
            const goal = track.length / Track.SEGMENT;
            const startLine = gate === 0 || gate === goal;
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
            if ((other.own ? ahead > 1 : ahead >= 4.6) && n < shown.length - 2) { // (a bike right in front of the camera is not drawn, as in Heaven's Gate)
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
            if (look.country && entry.visible) {
                drawCountry(entry, look, n);
                if (!isFar(entry.segment)) {
                    drawCountry(entry, look, n, true);
                }
            }
            if (look.country && n + 1 < shown.length && shown[n + 1].z1 >= 1) {
                // The cherry trees stand against the wall: drawn once the wall's next segment is, so a crown reaching over the
                // wall is not cut by it
                for (const thing of shown[n + 1].segment.things) {
                    if (thing.kind === 'cherry' && (shown[n + 1].visible || !isFar(shown[n + 1].segment))) {
                        drawThing(thing, shown[n + 1], look, cameraX, n + 1);
                    }
                }
            }
            if (entry.z1 >= 1) {
                for (const thing of entry.segment.things) {
                    if (!(look.country && thing.kind === 'cherry') && !(look.country && !entry.visible && thing.kind === 'pole') && !(look.country && isFar(entry.segment) && entry.visible && (thing.kind === 'pole' || farRight(thing, n)))) {
                        drawThing(thing, entry, look, cameraX, n);
                    }
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
                    drawBike(width / 2, bikeY - (look.country ? terrainDrop(bike.x) * 0.4 * perMeter : 0), perMeter * bikeScale, RIDER_COLORS[view.color], lean,
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
                const sy = horizon - (ground - cameraY) * scale - (look.country ? terrainDrop(other.x) * 0.4 * scale : 0);
                clipped(look.country ? Math.min(height, entry.clip + 2) : entry.clip, () => drawBike(sx, sy, scale * bikeScale, other.color, other.lean, other.braking, other.name,
                    look.lights, (other.air || 0) * scale));
            }
        }
        // The bullet trains, over the trees: they run above the wall, higher than the crowns
        if (false) {
            for (let n = shown.length - 1; n >= 0; n--) {
                if (shown[n].visible) {
                    drawCountry(shown[n], look, n, 'train');
                }
            }
        }
    }

    // The countryside beside one segment: on the left the rice fields in strips and patches, on the right the guardrail, the
    // railway wall with its railing and the wires over it (the masts and trees are things)
    const FIELD_DROP = -0.8; // the fields lie this far below the road, the meadow between sloping down to them
    // How far the ground lies below the road at lateral x (m, negative: left): level to 5.4 m out, then easing down to the fields
    const terrainDrop = x => {
        const from = Track.ROAD * 1.13;
        const s = Math.max(0, Math.min(1, (-x - from) / (-FIELD_EDGES[0] - from)));
        return FIELD_DROP * s * s * (3 - 2 * s);
    };
    const FIELD_EDGES = [-12, -27, -45, -69, -102, -147, -227, -407]; // the fields start 7 m from the road's edge
    const FIELD_RUNS = [5, 6, 8, 10, 12, 16, 20];
    const FIELD_COLORS = ['#a8de4c', '#74c157', '#c8dc5c', '#62b64f', '#92d9ea', '#a9e2ef'];
    function drawCountry(entry, look, n, wallOnly) {
        const {segment, x1, y1, x2, scale1, scale2} = entry;
        const y2 = entry.y2 - 0.7;
        const fade = Math.min(1, haze(n) * 0.6);
        const tint = color => mix(color, look.fog, fade);
        const at = (off, h, t = 0) => [x1 + (x2 - x1) * t + off * (scale1 + (scale2 - scale1) * t),
            y1 + (y2 - y1) * t - h * (scale1 + (scale2 - scale1) * t)];
        // A ribbon from (offA, hA) to (offB, hB), from the segment's near end (t0) to its far end (t1)
        const ribbon = (color, offA, hA, offB, hB, t0 = 0, t1 = 1) => {
            const [ax, ay] = at(offA, hA, t0);
            const [bx, by] = at(offB, hB, t0);
            const [cx, cy] = at(offB, hB, t1);
            const [dx, dy] = at(offA, hA, t1);
            four(color, ax, ay, bx, by, cx, cy, dx, dy);
        };
        const realIndex = segment.index;
        const index = Track.patternIndex(realIndex); // (patterns of fields and walls go on as if nothing was taken out)
        // The valley's ground at this segment's near and far end (from segment 410 on; before that it is the plain countryside)
        const rawA = realIndex - Track.RUN_UP;
        const a = Track.mapA(rawA); // where in the scenery this segment is (the cut stretches are left out)
        const val = a >= 410 && currentTrack !== null;
        const P0 = val ? Track.terrain(currentTrack.segments, rawA) : null;
        const P1 = val ? Track.terrain(currentTrack.segments, rawA + 1) : null;
        // A slab of ground from offset oa to ob at the near end (0) and the far end (1), each with its own height
        const slab = (color, oa0, ha0, ob0, hb0, oa1, ha1, ob1, hb1) => {
            const [ax, ay] = at(oa0, ha0, 0);
            const [bx, by] = at(ob0, hb0, 0);
            const [cx, cy] = at(ob1, hb1, 1);
            const [dx, dy] = at(oa1, ha1, 1);
            four(color, ax, ay, bx, by, cx, cy, dx, dy);
            // the same colour round the edge: no thin light seams between the pieces
            ctx.strokeStyle = color;
            ctx.lineWidth = 1.2;
            ctx.lineJoin = 'round';
            ctx.stroke();
        };
        // Where small houses stand within a few segments of this one (offsets from the road's middle, left and right): the
        // terrace under one is left as plain, flat grass
        const houses = {left: [], right: []};
        if (val) {
            for (let d = -5; d <= 5; d++) {
                const near = currentTrack.segments[realIndex + d];
                for (const thing of near ? near.things : []) {
                    if (thing.kind === 'vhut') {
                        (thing.x < 0 ? houses.left : houses.right).push(Math.abs(thing.x));
                    }
                }
            }
        }
        const LAWN = '#a6dc66';
        const TERRACES = ['#a9de52', '#8ed15b', '#bfe064', '#76c458', '#b6e269'];
        // Left: broad terraces of rice climbing the hillside, each a step higher than the one before, their edges winding
        const drawLeftTerraces = () => {
            const w = 15;
            const K = n < 40 ? 27 : n < 90 ? 20 : 15;
            const edge = (idx, k) => 12 + w * k + (k ? 3.2 * Math.sin(idx * 0.12 + k * 2.1) : 0);
            const topH = (P, k) => -1.6 + P.left * 1.8 * (1 + k);
            // Far off two or three terraces are drawn as one
            const dk = n < 40 ? 1 : n < 90 ? 2 : 3;
            for (let k = Math.floor((K - 1) / dk) * dk; k >= 0; k -= dk) {
                const kh = k + ((dk - 1) >> 1);
                const kp = Math.max(-1, k - dk + ((dk - 1) >> 1));
                const a0 = edge(index, k);
                const b0 = edge(index, k + dk);
                const a1 = edge(index + 1, k);
                const b1 = edge(index + 1, k + dk);
                const h0 = topH(P0, kh);
                const h1 = topH(P1, kh);
                const hh = hash(kh * 31.7 + Math.floor((index + kh * 5) / (6 + kh % 4)) * 7.3);
                const lawn = houses.left.some(o => o > a0 - 1 && o < b0 + 1);
                const water = hh > 0.45 && !lawn && kh < 3; // water only on the three lowest terraces
                const wild = P0.Fo; // the final mountain: forest and rock instead of rice
                let color = lawn ? LAWN : water && wild < 0.3 ? '#a5dded' : TERRACES[Math.floor(hh / 0.45 * 5) % 5];
                if (wild > 0.01) {
                    color = hexMix(hexMix(color, '#2f7a46', wild * 0.8), '#8f9188', wild * Math.max(0, Math.min(1, (kh - 3) / 9)) * (0.35 + 0.45 * hh));
                }
                slab(tint(color), -a0, h0, -b0, h0, -a1, h1, -b1, h1);
                const lerp = (p, q, t) => p + (q - p) * t;
                const pt = (off, t) => at(-lerp(off[0], off[1], t), lerp(h0, h1, t), t);
                if (lawn || wild > 0.5) {
                    // flat green space around the house: no rice, no border
                } else if (!water) {
                    // Grown rice, as in the lower fields: rows along the terrace and, near by, a clump of blades at every step
                    const row = tint(hexMix(color, '#2f8a3a', 0.45));
                    const rowList = k >= 3 ? [] : n < 50 ? [1, 2, 3, 4, 5] : n < 154 ? [2, 4] : []; // only the three lowest terraces have the detail
                    {
                        for (const r of rowList) {
                            const m0 = a0 + (b0 - a0) * r / 6;
                            const m1 = a1 + (b1 - a1) * r / 6;
                            slab(row, -(m0 - 0.2), h0, -(m0 + 0.2), h0, -(m1 - 0.2), h1, -(m1 + 0.2), h1);
                        }
                    }
                    if (n < 48 && k < 3) {
                        const tall = Math.max(2, scale1 * 0.55);
                        for (let r = 1; r < 6; r++) {
                            for (let m = 0; m < 3; m++) {
                                const hh2 = hash(index * 11 + r * 7 + m * 3 + k * 53);
                                const t = (m + 0.15 + hh2 * 0.6) / 3;
                                const [px, py] = pt([a0 + (b0 - a0) * r / 6 + (hh2 - 0.5) * 0.3, a1 + (b1 - a1) * r / 6 + (hh2 - 0.5) * 0.3], t);
                                const sz = tall * (0.8 + hh2 * 0.4);
                                ctx.fillStyle = tint(hh2 > 0.5 ? '#43a53f' : '#378f36');
                                ctx.beginPath();
                                ctx.moveTo(px - sz * 0.22, py);
                                ctx.lineTo(px - sz * 0.34, py - sz * 0.8);
                                ctx.lineTo(px - sz * 0.1, py - sz * 0.3);
                                ctx.lineTo(px - sz * 0.02, py - sz * 1.05);
                                ctx.lineTo(px + sz * 0.08, py - sz * 0.32);
                                ctx.lineTo(px + sz * 0.3, py - sz * 0.85);
                                ctx.lineTo(px + sz * 0.22, py);
                                ctx.closePath();
                                ctx.fill();
                                ctx.fillStyle = tint('#79d255');
                                ctx.beginPath();
                                ctx.moveTo(px - sz * 0.02, py - sz * 1.05);
                                ctx.lineTo(px + sz * 0.08, py - sz * 0.32);
                                ctx.lineTo(px - sz * 0.1, py - sz * 0.3);
                                ctx.closePath();
                                ctx.fill();
                            }
                        }
                    }
                } else if (n < 28 && k < 3) {
                    // Sparse seedlings standing in the water
                    ctx.fillStyle = tint('#4aa84a');
                    const blade = Math.max(1.3, scale1 * 0.09);
                    for (let m = 0; m < 3; m++) {
                        const hh2 = hash(index * 7 + m * 13 + k * 29);
                        const [px, py] = pt([lerp(a0, b0, 0.15 + 0.7 * hash(index + m * 5 + k)), lerp(a1, b1, 0.15 + 0.7 * hash(index + m * 5 + k))], hh2);
                        ctx.beginPath();
                        ctx.moveTo(px - blade * 0.6, py);
                        ctx.lineTo(px - blade * 0.2, py - blade * 1.6);
                        ctx.lineTo(px + blade * 0.05, py);
                        ctx.lineTo(px + blade * 0.35, py - blade * 1.9);
                        ctx.lineTo(px + blade * 0.7, py);
                        ctx.closePath();
                        ctx.fill();
                    }
                }
                // The border across the terrace where a new paddy begins: its top and the face towards the road
                if (!lawn && wild < 0.5 && (index + k * 3) % (6 + k % 4) === 0 && n < 154 && k < 3) {
                    const top = h0 + 0.26;
                    if (n < 80) {
                        const [fx, fy] = at(-a0, h0, 0);
                        const [gx, gy] = at(-b0, h0, 0);
                        const [ix, iy] = at(-b0, top, 0);
                        const [jx, jy] = at(-a0, top, 0);
                        four(tint('#4f9b41'), fx, fy, gx, gy, ix, iy, jx, jy);
                    }
                    const [tx, ty] = at(-a0, top, 0);
                    const [ux, uy] = at(-b0, top, 0);
                    const [vx, vy] = at(-b0, top, 0.2);
                    const [wx, wy] = at(-a0, top, 0.2);
                    four(tint('#b9e56a'), tx, ty, ux, uy, vx, vy, wx, wy);
                }
                // The step up from the terrace below, facing the road, with a bright lip
                slab(tint(hexMix(k % 2 ? '#4f9b41' : '#468f3c', '#2a5f3a', wild * 0.7)), -a0, topH(P0, kp), -a0, h0, -a1, topH(P1, kp), -a1, h1);
                if (n < 60 && k < 3) {
                    slab(tint(hexMix('#c4ea6c', '#4b8a4a', wild * 0.85)), -a0, h0, -(a0 + 0.6), h0, -a1, h1, -(a1 + 0.6), h1);
                }
            }
        };
        // Right: the hillside between the road and the railway, the ground falling away beyond it to the valley floor and the
        // river, and the far side rising in terraces
        const h0r = off => Track.rightHeight(P0, off);
        const h1r = off => Track.rightHeight(P1, off);
        const drawRightTerrain = () => {
            const e = Track.SLOPE_AT;
            const h0 = off => Track.rightHeight(P0, off);
            const h1 = off => Track.rightHeight(P1, off);
            if (P0.floor < -0.3 || P0.A > 0.3) {
                // Beyond the last terrace a far hillside in the haze, so no gap of bare sky shows (only where the ground falls away: it
                // showed as a pale patch beside the wall before)
                const o0 = 210 + 41 * 11;
                const b0 = h0(o0 + 5.5);
                const b1 = h1(o0 + 5.5);
                slab(tint('#86c96a'), o0, b0, 3000, b0 + 0.03 * (3000 - o0), o0, b1, 3000, b1 + 0.03 * (3000 - o0));
            }
            if (P0.A > 0.3) {
                // Far off the terraces are drawn two or four to a piece
                const dj = n < 50 ? 1 : n < 100 ? 2 : 4;
                for (let j = n < 80 ? 40 : 32; j >= 0; j -= dj) {
                    const oa = 210 + j * 11;
                    const ob = oa + 11 * dj;
                    const mid = oa + 5.5;
                    const top0 = h0(mid);
                    const top1 = h1(mid);
                    const hh = hash(j * 29.1 + Math.floor((index + j * 3) / (7 + j % 5)) * 5.3);
                    const lawn = houses.right.some(o => o > oa - 1 && o < ob + 1);
                    const water = hh > 0.7 && !lawn;
                    const color = lawn ? LAWN : water ? '#a5dded' : TERRACES[Math.floor(hh / 0.7 * 5) % 5];
                    slab(tint(color), oa, top0, ob, top0, oa, top1, ob, top1);
                    slab(tint('#4f9b41'), ob, top0, ob, h0(ob + 5.5), ob, top1, ob, h1(ob + 5.5));
                }
            }
            if (P0.floor < -0.3) {
                const f0 = P0.floor;
                const f1 = P1.floor;
                const edges = [110, 122, 135, 149, 163, 178, 193, 210];
                for (let i = edges.length - 2; i >= 0; i--) {
                    const hh = hash(i * 17.3 + Math.floor(index / 4) * 3.1);
                    slab(tint(TERRACES[Math.floor(hh * 5) % 5]), edges[i], f0, edges[i + 1], f0, edges[i], f1, edges[i + 1], f1);
                }
                if (P0.river > 0.3) {
                    const c0 = P0.riverAt;
                    const c1 = P1.riverAt;
                    const r0 = P0.river / 2;
                    const r1 = P1.river / 2;
                    const water = hexMix('#9fdcec', '#2fc0bd', Math.max(0, Math.min(1, (a - 740) / 260)));
                    slab(tint('#e8dfb4'), c0 - r0 - 1.3, f0, c0 + r0 + 1.3, f0, c1 - r1 - 1.3, f1, c1 + r1 + 1.3, f1);
                    slab(tint(water), c0 - r0, f0, c0 + r0, f0, c1 - r1, f1, c1 + r1, f1);
                    if (n < 60 && P0.river > 6) {
                        slab(tint(hexMix(water, '#ffffff', 0.45)), c0 - r0 * 0.35, f0, c0 - r0 * 0.2, f0, c1 - r1 * 0.35, f1, c1 - r1 * 0.2, f1);
                    }
                }
            }
            const nodes = n < 60 ? [e, e + 2, e + 5, e + 9, e + 15, e + 23, e + 33, e + 46, e + 62, e + 80, 110] : [e, e + 5, e + 15, e + 33, e + 62, 110];
            for (let i = nodes.length - 2; i >= 0; i--) {
                const oa = nodes[i];
                const ob = nodes[i + 1];
                const ha0 = h0(oa);
                const hb0 = h0(ob);
                const lit = Math.max(0.15, Math.min(1, 0.55 + (hb0 - ha0) / (ob - oa) * 2.2));
                // more shades: lit and shaded faces, lighter and yellower higher up, a faint band along the road every few segments
                const band = (Math.floor(index / 4) % 3) * 0.05;
                const high = Math.max(0, Math.min(1, ha0 / 14));
                const base = hexMix(hexMix('#4d9a47', '#86cc5e', lit), '#b6dd6c', high * 0.45);
                // the slope in strips whose green follows the height: lighter and warmer where it is high and catches the sun, cooler
                // and darker down in the hollow, with only a gentle patchiness, so it blends and reads as rounded ground
                const pieces = 6;
                for (let s = 0; s < pieces; s++) {
                    const pa = oa + (ob - oa) * s / pieces;
                    const pb = oa + (ob - oa) * (s + 1) / pieces;
                    const hm = (h0(pa) + h0(pb)) / 2;
                    const tilt = (h0(pb) - h0(pa)) / Math.max(0.1, pb - pa); // facing up (+) or down (-) away from the road
                    const sun = Math.max(0, Math.min(1, 0.68 + tilt * 1.4));
                    const depth = Math.max(0, Math.min(1, -hm / 12)); // how far below the road
                    const patch = (hash(i * 7.7 + s * 3.1 + Math.floor(index / 4) * 1.37) - 0.5) * 0.16;
                    let col = hexMix('#58a84a', '#a4d866', Math.max(0, Math.min(1, sun * 0.75 + patch + (hm > 0 ? 0.2 : 0))));
                    col = hexMix(col, '#2f7f4f', depth * 0.2);
                    if (P0.Fo > 0.01) {
                        // the final mountain: dark forest green, grey rock high up and in streaks
                        const rk = P0.Fo * Math.max(0, Math.min(1, (hm - 7) / 14)) * (0.45 + 0.4 * hash(i * 5.3 + s * 1.7 + Math.floor(index / 6) * 2.9));
                        col = hexMix(hexMix(col, '#2f7a46', P0.Fo * 0.8), '#8f9188', rk);
                    }
                    slab(tint(hexMix(col, '#3f8a46', band * 0.6)), pa, h0(pa), pb, h0(pb), pa, h1(pa), pb, h1(pb));
                }
            }
        };
        // A bullet train on the railway, in 1 m pieces: white with one blue stripe, a row of dark windows, a long pointed nose
        // with a dark windshield; the side towards the road is drawn (after the trees, so it is seen over them)
        const drawTrainSlices = () => {
            const W = Track.ROAD + 8.5;
            const H = 9;
            if (val && !P0.rail) {
                return; // the railway has gone behind the hills
            }
            if (val && 9 - (P0.rise + P1.rise) / 2 - Track.rightHeight(P0, Track.WALL_AT + (P0.sep + P1.sep) / 2) < 0.5) {
                return; // where the wall has gone (the railway is no higher than the ground), so has the train
            }
                const seg = Track.SEGMENT;
                const Z0 = (realIndex - Track.RUN_UP) * seg;
                const Lcz = z => W + 3.4 + Track.railSep(z / seg);
                for (const tr of currentTrains) {
                    const tail = tr.head - tr.len;
                    if (tr.head <= Z0 || tail >= Z0 + seg) {
                        continue;
                    }
                    for (let k = 0; k < seg; k++) {
                        const za = Math.max(Z0 + k, tail);
                        const zb = Math.min(Z0 + k + 1, tr.head);
                        if (zb <= za) {
                            continue;
                        }
                        const t0 = (za - Z0) / seg;
                        const t1 = (zb - Z0) / seg;
                        // The railway keeps its own level while the road climbs: its height from the road here
                        const Hs = val ? H - (segment.y1 + (segment.y2 - segment.y1) * (t0 + t1) / 2) : H; // before the valley the wall (and the railway on it) follows the road
                        const sepA = Track.railSep(za / seg);
                        const sepB = Track.railSep(zb / seg);
                        const shape = z => {
                            const u = tr.head - z;
                            const tailEnd = u > tr.len / 2;
                            const f = Math.max(0, Math.min(1, Math.min(u, tr.len - u) / (tailEnd ? 5 : 14))); // the rear end is 5 m, the nose 14 m
                            if (tailEnd) {
                                // The rear: rounded like a capsule, the roof curving down and the walls in, not cut off flat
                                return {u, f, tailEnd, lat: Lcz(z) - 1.7 * (0.5 + 0.5 * Math.pow(f, 0.7)), top: Hs + 2.95 + 1.25 * Math.pow(f, 0.55)};
                            }
                            return {u, f, tailEnd, lat: Lcz(z) - 1.7 * (0.22 + 0.78 * Math.pow(f, 0.6)), top: Hs + 1.8 + 2.4 * Math.pow(f, 0.5)};
                        };
                        const A = shape(za);
                        const B = shape(zb);
                        const part = (color, lowA, highA, lowB, highB) => {
                            const [ax, ay] = at(A.lat, lowA, t0);
                            const [bx, by] = at(A.lat, highA, t0);
                            const [cx, cy] = at(B.lat, highB, t1);
                            const [dx, dy] = at(B.lat, lowB, t1);
                            four(tint(color), ax, ay, bx, by, cx, cy, dx, dy);
                        };
                        // Depth: a soft shadow of the train on the railway bed, the skirt in shade, a darker belt under the roof,
                        // a recessed window band, and a joint between the carriages
                        {
                            const [sax, say] = at(A.lat, Hs, t0);
                            const [sbx, sby] = at(W + 1.8 + sepA, Hs, t0);
                            const [scx, scy] = at(W + 1.8 + sepB, Hs, t1);
                            const [sdx, sdy] = at(B.lat, Hs, t1);
                            four(tint('#6f6a86'), sax, say, sbx, sby, scx, scy, sdx, sdy);
                        }
                        part('#9aa4b8', Hs + 0.35, Hs + 0.9, Hs + 0.35, Hs + 0.9);
                        // curving away at the rear: the white turns a little grey, so the rounded end reads as round
                        const white = A.tailEnd ? hexMix('#f7f9fc', '#c9d1e1', 0.55 * (1 - A.f)) : '#f7f9fc';
                        part(white, Hs + 0.9, Hs + 1.75, Hs + 0.9, Hs + 1.75);
                        part('#1d4fc4', Hs + 1.75, Hs + 2.35, Hs + 1.75, Hs + 2.35);
                        part(white, Hs + 2.35, Math.max(Hs + 2.4, A.top - 0.6), Hs + 2.35, Math.max(Hs + 2.4, B.top - 0.6));
                        part('#d3dae6', Math.max(Hs + 2.4, A.top - 0.6), A.top, Math.max(Hs + 2.4, B.top - 0.6), B.top);
                        part('#c3cbda', Math.max(Hs + 2.4, A.top - 0.75), Math.max(Hs + 2.4, A.top - 0.6), Math.max(Hs + 2.4, B.top - 0.75), Math.max(Hs + 2.4, B.top - 0.6));
                        part('#ccd4e2', Hs + 2.35, Hs + 2.6, Hs + 2.35, Hs + 2.6);
                        part('#164aa8', Hs + 1.75, Hs + 1.9, Hs + 1.75, Hs + 1.9);
                        const mid = (A.u + B.u) / 2;
                        const body = Math.min(mid, tr.len - mid + 9); // (the rear end is shorter: windows run up to 5 m from it)
                        if (body < 10 && !A.tailEnd) {
                            // The windshield, one dark shape in the nose
                            part('#1b2552', A.top - 1.4, A.top - 0.35, B.top - 1.4, B.top - 0.35);
                        } else if (body >= 14) {
                            const c = (mid - 14) % 25;
                            if (c > 1.2 && c < 23.8 && c % 4.2 < 3) {
                                part('#e9eef6', Hs + 2.6, Hs + 3.6, Hs + 2.6, Hs + 3.6);
                                part('#1b2552', Hs + 2.7, Hs + 3.5, Hs + 2.7, Hs + 3.5);
                                part('#34417a', Hs + 3.25, Hs + 3.5, Hs + 3.25, Hs + 3.5);
                            } else if (c <= 1.2 || c >= 23.8) {
                                part('#aab3c6', Hs + 0.9, Hs + 2.6, Hs + 0.9, Hs + 2.6);
                            }
                        }
                    }
                    // The back of the train, seen from behind: a soft white capsule end with one dark rounded window and two red lights
                    if (tail >= Z0 && tail < Z0 + seg) {
                        const tt = (tail - Z0) / seg;
                        const Hc0 = val ? H - (segment.y1 + (segment.y2 - segment.y1) * tt) : H;
                        const cx = Lcz(tail);
                        const wcap = 1.7 * 0.5;
                        const hc = Hc0 + 1.95;
                        const hh = 1.0;
                        const poly = (color, pts) => {
                            ctx.fillStyle = tint(color);
                            ctx.beginPath();
                            pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
                            ctx.closePath();
                            ctx.fill();
                        };
                        const ell = (rx, ry, ox, oy, steps = 28) => Array.from({length: steps}, (_, i) => {
                            const th = i / steps * Math.PI * 2;
                            return at(cx + ox + rx * Math.cos(th), hc + oy + ry * Math.sin(th), tt);
                        });
                        poly('#c9d1e1', ell(wcap, hh, 0, 0)); // the curved edge, in a light shade
                        poly('#f7f9fc', ell(wcap * 0.9, hh * 0.93, -0.03, 0.02));
                        // a soft shadow following the upper curve
                        poly('#dfe5ee', Array.from({length: 20}, (_, i) => {
                            const th = Math.PI * (0.12 + 0.76 * i / 19);
                            return at(cx + wcap * 0.9 * Math.cos(th), hc + hh * 0.93 * Math.sin(th), tt);
                        }).concat(Array.from({length: 20}, (_, i) => {
                            const th = Math.PI * (0.88 - 0.76 * i / 19);
                            return at(cx + wcap * 0.9 * Math.cos(th), hc + 0.02 + (hh * 0.93 - 0.2) * Math.sin(th), tt);
                        })));
                        // the blue stripe, following the body round the back
                        {
                            const chord = h => wcap * 0.9 * Math.sqrt(Math.max(0, 1 - Math.pow((h - hc) / (hh * 0.93), 2)));
                            const h0b = Hc0 + 1.75;
                            const h1b = Hc0 + 2.0;
                            poly('#1d4fc4', [at(cx - chord(h0b), h0b, tt), at(cx + chord(h0b), h0b, tt), at(cx + chord(h1b), h1b, tt), at(cx - chord(h1b), h1b, tt)]);
                        }
                        // the one dark window, wide with soft corners, near the top; a darker edge on one side
                        const win = (ox, oy, rx, ry) => Array.from({length: 32}, (_, i) => {
                            const th = i / 32 * Math.PI * 2;
                            const c = Math.cos(th);
                            const sn = Math.sin(th);
                            return at(cx + ox + rx * Math.sign(c) * Math.pow(Math.abs(c), 0.35), hc + oy + ry * Math.sign(sn) * Math.pow(Math.abs(sn), 0.35), tt);
                        });
                        poly('#1b2552', win(0, 0.5, 0.5, 0.2));
                        poly('#141c42', win(0.3, 0.5, 0.2, 0.17));
                        // two small red lights below it, with a lighter spot
                        for (const side of [-1, 1]) {
                            poly('#e03232', ell(0.1, 0.1, side * 0.3, -0.38, 14));
                            poly('#ff9a9a', ell(0.04, 0.04, side * 0.3 - 0.03, -0.35, 10));
                        }
                    }
                }
        };
        // What lies beyond a crest is hidden below it. The fields, wall and guardrail lie lower than the road, so they
        // are let through by that much (3.2 m); on a flat road clip is the segment's own start and nothing is lost
        const holdY = wallOnly === 'ground' || wallOnly === 'train' || a >= 425 ? height : // (far segments are drawn with the road: it hides them)
             Math.min(height, entry.clip + 1.0 * entry.scale1 + 2);
        clipped(holdY, () => {
            if (wallOnly === 'ground') {
                // The valley's ground, drawn with the road (before it, segment by segment) so a hill hides the road behind it
                // and the road hides what is far behind it
                if (val) {
                    if (a >= 520) {
                        drawLeftTerraces();
                    }
                    if (P0.Hc > 0.05 || P0.A > 0.05 || P0.g > 0 || P0.floor < -0.05) {
                        drawRightTerrain();
                    }
                    if (P0.V > 0.6) {
                        // the viewpoint's small wooden safety railing along the edge of the shelf: posts and two rails
                        const rail = 14;
                        const rh0 = h0r(rail);
                        const rh1 = h1r(rail);
                        ribbon(tint('#a87a47'), rail, rh0 + 0.42, rail, rh0 + 0.52, 0, 1);
                        ribbon(tint('#b98a55'), rail, rh0 + 0.86, rail, rh0 + 0.98, 0, 1);
                        const [px, py] = at(rail, rh0, 0);
                        const pw = Math.max(1.2, scale1 * 0.1);
                        const ph = scale1 * 1.05;
                        ctx.fillStyle = tint('#8a5f33');
                        ctx.fillRect(px - pw / 2, py - ph, pw, ph);
                    }
                }
                return;
            }
            if (wallOnly === 'train') {
                if (a < 520) {
                    drawTrainSlices();
                }
                return;
            }
            if (!wallOnly) {
            // Left: the fields, further out in bigger patches, each with its own colour; a grass bank between them
            // Paddies at slightly different heights (the village's strip and the far ones level), each with its own colour,
            // raised earth borders between them (light on top, darker on the side, a soft shadow at their foot), a channel or
            // two, and a border where the embankment meets the first. Far to near, so the nearer borders cover what is behind.
            const terraced = val && a >= 520;
            if (!terraced) {
            const bands = 7;
            const SIDE = '#4f9b41';
            const TOP = '#b9e56a';
            const SHADE = 'rgba(25,70,35,0.16)';
            const patchOf = b => Math.floor((index + b * 3) / FIELD_RUNS[b]);
            const heightOf = (b, p) => (b >= 5 ? FIELD_DROP : FIELD_DROP + (hash(b * 57.1 + p * 11.3) - 0.5) * 0.5);
            const wet = (b, p) => b < 5 && b !== 5 && hash(b * 97.3 + p * 13.7) > 0.8;
            for (let b = bands - 1; b >= 0; b--) {
                const run = FIELD_RUNS[b];
                const p = patchOf(b);
                const e = heightOf(b, p);
                const pick = hash(b * 97.3 + p * 13.7);
                const water = wet(b, p);
                // The band the village stands on is plain grass: no paddies, no water
                const color = b === 5 ? (p & 1 ? '#8ccb57' : '#97d05e')
                    : FIELD_COLORS[water ? 4 + (p & 1) : Math.floor(pick / 0.8 * 4) % 4];
                const near = FIELD_EDGES[b];
                const far = FIELD_EDGES[b + 1];
                ribbon(tint(water ? hexMix(color, '#7fcbe0', 0.12) : color), near, e, far, e);
                if (!water && b < 3 && n < 154) {
                    // Grown rice: rows along the paddy, near by with a clump of blades at every step
                    const span = far - near;
                    const row = tint(hexMix(color, '#2f8a3a', 0.45));
                    for (let k = 1; k < 6; k++) {
                        const off = near + span * k / 6;
                        ribbon(row, off - 0.2, e, off + 0.2, e);
                    }
                    if (n < 48) {
                        const tall = Math.max(2, scale1 * 0.55);
                        for (let k = 1; k < 6; k++) {
                            for (let m = 0; m < 3; m++) {
                                const h = hash(index * 11 + k * 7 + m * 3 + b * 53);
                                const [px, py] = at(near + span * k / 6 + (h - 0.5) * 0.3, e, (m + 0.15 + h * 0.6) / 3);
                                const s = tall * (0.8 + h * 0.4);
                                ctx.fillStyle = tint(h > 0.5 ? '#43a53f' : '#378f36');
                                ctx.beginPath();
                                ctx.moveTo(px - s * 0.22, py);
                                ctx.lineTo(px - s * 0.34, py - s * 0.8);
                                ctx.lineTo(px - s * 0.1, py - s * 0.3);
                                ctx.lineTo(px - s * 0.02, py - s * 1.05);
                                ctx.lineTo(px + s * 0.08, py - s * 0.32);
                                ctx.lineTo(px + s * 0.3, py - s * 0.85);
                                ctx.lineTo(px + s * 0.22, py);
                                ctx.closePath();
                                ctx.fill();
                                ctx.fillStyle = tint('#79d255');
                                ctx.beginPath();
                                ctx.moveTo(px - s * 0.02, py - s * 1.05);
                                ctx.lineTo(px + s * 0.08, py - s * 0.32);
                                ctx.lineTo(px - s * 0.1, py - s * 0.3);
                                ctx.closePath();
                                ctx.fill();
                            }
                        }
                    }
                }
                if (water && b < 3 && n < 28) {
                    // Sparse seedlings standing in the water
                    ctx.fillStyle = tint('#4aa84a');
                    const blade = Math.max(1.3, scale1 * 0.09);
                    for (let m = 0; m < 3; m++) {
                        const h = hash(index * 7 + m * 13 + b * 29);
                        const [px, py] = at(near + (far - near) * (0.15 + 0.7 * hash(index + m * 5 + b)), e, h);
                        ctx.beginPath();
                        ctx.moveTo(px - blade * 0.6, py);
                        ctx.lineTo(px - blade * 0.2, py - blade * 1.6);
                        ctx.lineTo(px + blade * 0.05, py);
                        ctx.lineTo(px + blade * 0.35, py - blade * 1.9);
                        ctx.lineTo(px + blade * 0.7, py);
                        ctx.closePath();
                        ctx.fill();
                    }
                }
                // The border across the paddy where a new one begins: its top and the face towards the road
                if ((index + b * 3) % run === 0 && b < 3 && n < 154) {
                    const eNear = heightOf(b, p - 1);
                    const top = Math.max(e, eNear) + 0.26;
                    if (n < 80) {
                        const [ax, ay] = at(near, eNear, 0);
                        const [bx, by] = at(far, eNear, 0);
                        const [cx, cy] = at(far, top, 0);
                        const [dx, dy] = at(near, top, 0);
                        four(tint(SIDE), ax, ay, bx, by, cx, cy, dx, dy);
                    }
                    ribbon(tint(TOP), near, top, far, top, 0, 0.2);
                }
                // The border along the paddy's far edge (and the channel, where there is one): the face towards the road
                // with a shadow at its foot, then its top
                const k = b + 1;
                if (k <= 3 && n < 168) {
                    const pFar = patchOf(b + 1);
                    const eFar = heightOf(b + 1, pFar);
                    const top = Math.max(e, eFar) + 0.28;
                    if (k === 2 || k === 4) {
                        // An irrigation channel between the two borders
                        const bed = Math.min(e, eFar) - 0.3;
                        ribbon(tint('#7bbfd8'), far + 0.7, bed, far - 0.7, bed);
                        ribbon(tint('#a7dcee'), far + 0.55, bed, far - 0.55, bed);
                        if (n < 80) {
                            ribbon(tint(SIDE), far - 0.7, bed, far - 0.7, top);
                            ribbon(SHADE, far + 0.7, e, far + 1.2, e);
                        }
                        ribbon(tint(TOP), far + 1.05, top, far + 0.7, top);
                        ribbon(tint(TOP), far - 0.7, top, far - 1.05, top);
                    } else {
                        if (n < 80) {
                            ribbon(SHADE, far + 0.35, e, far + 1.1, e);
                            ribbon(tint(SIDE), far + 0.35, e, far + 0.35, top);
                        }
                        ribbon(tint(TOP), far + 0.35, top, far - 0.35, top);
                    }
                }
            }
            // At the embankment's foot a border runs along the first paddy
            if (n < 168) {
                const e0 = heightOf(0, patchOf(0));
                const top = Math.max(FIELD_DROP, e0) + 0.3;
                if (n < 80) {
                    ribbon(tint(SIDE), FIELD_EDGES[0] + 0.35, FIELD_DROP, FIELD_EDGES[0] + 0.35, top);
                }
                ribbon(tint(TOP), FIELD_EDGES[0] + 0.35, top, FIELD_EDGES[0] - 0.35, top);
            }
            }
            for (let k = 0; k < 8; k++) {
                const from = Track.ROAD * 1.13;
                const a = from + (-FIELD_EDGES[0] - from) * k / 8;
                const b = from + (-FIELD_EDGES[0] - from) * (k + 1) / 8;
                ribbon(tint(hexMix('#92d25f', '#6cb445', k / 7)), -a, terrainDrop(-a), -b, terrainDrop(-b));
            }
            }
            if (!wallOnly) {
            // (no guardrails)
            }
            // Right: the railway wall in large sections, its top ledge, railing and the wires over it
            if (!wallOnly) {
            // A few cherry petals on the road, near
            if (false && n < 40) { // off: no petals on the road
                ctx.fillStyle = 'rgba(250,170,200,0.9)';
                for (let k = 0; k < 3; k++) {
                    if (hash(index * 7 + k) < 0.5) {
                        const [px, py] = at((hash(index * 3 + k * 11) - 0.5) * 7, 0, hash(index + k) );
                        ctx.beginPath();
                        ctx.ellipse(px, py, Math.min(9, Math.max(0.8, scale1 * 0.05)), Math.min(4, Math.max(0.4, scale1 * 0.02)), 0.4, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
            }
                return;
            }
            // The hillside and valley (only once the ground is no longer flat), the railway on its own route over it
            let sep = 0;
            let base0 = 0;
            let kH = 1;
            if (val) {
                if (!P0.rail) {
                    return;
                }
                sep = (P0.sep + P1.sep) / 2;
                base0 = Track.rightHeight(P0, Track.WALL_AT + sep);
                const Hw = 9 - (P0.rise + P1.rise) / 2 - base0;
                if (Hw < 0.5) {
                    return;
                }
                kH = Hw / 9;
            }
            const W = Track.ROAD + 8.5 + sep;
            const H = 9;
            // The wall's heights run from the ground at its foot to the railway's level (kH); what stands on it keeps its size
            const mh = h => (h <= H ? base0 + h * kH : base0 + H * kH + (h - H));
            const atL = (off, h, t = 0) => at(off, mh(h), t);
            const ribbonL = (color, offA, hA, offB, hB, t0 = 0, t1 = 1) => ribbon(color, offA, mh(hA), offB, mh(hB), t0, t1);
            const section = Math.floor(index / 5) % 2;
            // The wall's face with a sunk panel in each section, a shadow under the cornice, a plinth at its foot, a pilaster
            // standing out of it every fifth segment and a cornice over it, jutting out
            ribbonL(tint(section ? '#a9a3bd' : '#b4aec8'), W, 0, W, H);
            ribbonL(tint(section ? '#9f99b6' : '#aaa4be'), W, 2.2, W, 8, 0.1, 0.9);
            ribbonL(tint(section ? '#b9b3cc' : '#c3bdd5'), W, 8, W, 8.15, 0.1, 0.9);
            ribbonL(tint('#9791ad'), W, H - 1.3, W, H - 0.55);
            ribbonL(tint('#8f89a4'), W - 0.5, 0, W - 0.5, 0.7);
            ribbonL(tint('#c7c2d8'), W - 0.5, 0.7, W, 0.7);
            if (index % 5 === 0) {
                const [ax, ay] = atL(W - 0.9, 0, 0);
                const [bx, by] = atL(W, 0, 0);
                const [cx, cy] = atL(W, H, 0);
                const [dx, dy] = atL(W - 0.9, H, 0);
                four(tint('#c4bed7'), ax, ay, bx, by, cx, cy, dx, dy);
                ribbonL(tint('#a39db9'), W - 0.9, 0, W - 0.9, H, 0, 0.25);
                ribbonL(tint('#cfcadf'), W - 0.9, H - 0.2, W - 0.9, H, 0, 0.25);
            }
            ribbonL(tint('#847e9a'), W - 0.8, H - 0.6, W, H - 0.6);
            ribbonL(tint('#bdb7d0'), W - 0.8, H - 0.6, W - 0.8, H);
            ribbonL(tint('#c7c2d8'), W - 0.8, H, W + 1.7, H);
            // The railway bed behind the cornice: ballast with two rails
            ribbonL(tint('#9d99b0'), W + 1.7, H, W + 5.1, H);
            ribbonL(tint('#555468'), W + 2.5, H, W + 2.65, H);
            ribbonL(tint('#555468'), W + 4.15, H, W + 4.3, H);
            ribbonL(tint('#8f89a4'), W + 0.2, H + 0.9, W + 0.2, H + 1.05);
            if (index % 2 === 0) {
                ribbonL(tint('#8f89a4'), W + 0.14, H, W + 0.26, H + 1.05, 0, 0.12);
            }
            ctx.strokeStyle = tint('#3a3a46');
            ctx.lineWidth = Math.max(0.5, scale1 * 0.035);
            for (const h of [H + 7.2, H + 6]) {
                const [ax, ay] = atL(W + 1, h);
                const [bx, by] = atL(W + 1, h, 1);
                ctx.beginPath();
                ctx.moveTo(ax, ay);
                ctx.lineTo(bx, by);
                ctx.stroke();
            }
            // The train is drawn here, with the wall, a segment at a time: trees nearer than it hide it
            drawTrainSlices();
        });
    }

    const haze = n => Math.min(1, (n / DRAW_SEGMENTS) ** 1.7);

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
                    if (n < 154 && city.section[i] % 3 !== 0) {
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
            if (n < 168 && pp1 > 2.2 * px) {
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
            if (i % 3 === 0 && n < 154 && k < 3 && lanternFade(city, i) > 0 && lanternKept(city, i) && !(k === 2 && i === lastLantern(city))) {
                const lx = lerp(xa1, xa2, 0.1) + (sx1 - (o - 0.38) * w1 - xa1) * 0.9;
                const ly = yAt(top - 0.3, n);
                if (pp1 > 3 * px) {
                    lampGlow(lx, ly + pp1 * 1.1, pp1 * 3.3, 0.95 * lanternFade(city, i));
                }
                redLantern(lx, ly, pp1, f);
            }
            if (k === 0 && n < 168 && into % 2 === 0) {
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
        if (n < 154 && n > 3 && wall > 0.35 && testHash(i * 17 + 3) < 0.5) {
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
                if (n < 154 && hv2 < 0.85) {
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
            const startLine = gate === 0 || gate === goal;
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
            if (n < 154 && !startLine) {
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
                        if (n < 168) {
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
        if (look.country) {
            drawCountrySky(look, horizon);
            return;
        }
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

    // Soft white clouds with a pale blue underside, then three layers of blue mountains, the nearest the darkest
    function drawCountrySky(look, horizon) {
        const unit = Math.max(8, horizon * 0.09);
        const span = width + unit * 20;
        for (const [k, rise, size] of [[0, 0.62, 1.2], [1, 0.34, 0.9], [2, 0.74, 1.05], [3, 0.2, 0.7]]) {
            const cx = (((k * 0.31 * span - skyShift * 0.12) % span) + span) % span - unit * 8;
            const cy = horizon * rise;
            for (const [color, dy] of [['#dbe9f7', 0.22], ['#ffffff', 0]]) {
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.ellipse(cx, cy + dy * unit * size, unit * 3.2 * size, unit * 0.8 * size, 0, 0, Math.PI * 2);
                ctx.ellipse(cx - unit * 1.6 * size, cy + dy * unit * size - unit * 0.3, unit * 1.5 * size, unit * 1.0 * size, 0, 0, Math.PI * 2);
                ctx.ellipse(cx + unit * 0.6 * size, cy + dy * unit * size - unit * 0.7 * size, unit * 1.8 * size, unit * 1.2 * size, 0, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        const f = farness * farness * (3 - 2 * farness);
        if (finale > 0.001) {
            // the viewpoint: one more, paler range far behind the others
            hills(mix(look.hills[0], '#ffffff', 0.4), horizon, horizon * 0.5 * finale, skyShift * 0.15, 0.005, 5.7);
        }
        hills(look.hills[0], horizon, horizon * 0.3 * (1 + 0.9 * f), skyShift * 0.25, 0.007, 1.3);
        hills(look.hills[1], horizon, horizon * 0.22 * (1 + 0.8 * f), skyShift * 0.45, 0.011, 4.1);
        hills(look.hills[2], horizon, horizon * 0.13 * (1 + 0.5 * f), skyShift * 0.7, 0.017, 2.2);
        if (finale > 0.001) {
            // light mist and a few white clouds lying below the distant ridges, in the valley
            const mist = ctx.createLinearGradient(0, horizon - horizon * 0.2, 0, horizon + 2);
            mist.addColorStop(0, 'rgba(255,255,255,0)');
            mist.addColorStop(1, 'rgba(255,255,255,' + (0.62 * finale) + ')');
            ctx.fillStyle = mist;
            ctx.fillRect(0, horizon - horizon * 0.2, width, horizon * 0.2 + 2);
            const span2 = width + unit * 24;
            for (const [k, rise, size] of [[0, 0.93, 1.5], [1, 0.9, 1.1], [2, 0.95, 1.7], [3, 0.88, 1.2], [4, 0.94, 1.4]]) {
                const cx = (((k * 0.23 * span2 - skyShift * 0.3) % span2) + span2) % span2 - unit * 10;
                const cy = horizon * rise;
                ctx.fillStyle = 'rgba(255,255,255,' + (0.8 * finale) + ')';
                ctx.beginPath();
                ctx.ellipse(cx, cy, unit * 3.4 * size, unit * 0.55 * size, 0, 0, Math.PI * 2);
                ctx.ellipse(cx - unit * 1.8 * size, cy + unit * 0.1, unit * 1.9 * size, unit * 0.5 * size, 0, 0, Math.PI * 2);
                ctx.ellipse(cx + unit * 2 * size, cy + unit * 0.1, unit * 2.1 * size, unit * 0.45 * size, 0, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    // The same number for the same n, from 0 to 1
    const hash = n => {
        const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
        return s - Math.floor(s);
    };

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

    // A farm cart seen at an angle (up is negative, meters): the near end towards the viewer, its side towards the road (left)
    function drawCartAngled(tint, front) {
        const light = tint('#c98a4b');
        const body = tint('#a1764a');
        const dark = tint('#7a5632');
        const rim = tint('#5b3a22');
        const spoke = tint('#8c6439');
        const dx = -1.0; // how far the far end is drawn to the left and up
        const dy = -0.3;
        const x0 = -0.95;
        const x1 = 0.95; // the near end, left and right
        const yt = -1.12; // platform top at the near end
        const yb = -0.86; // its underside
        const P = (x, y, k) => [x + dx * k, y + dy * k]; // k: 0 near end, 1 far end
        const quad = (color, pts) => shape(color, pts);
        // far wheel, edge-on, on the right (behind the near end)
        blob(rim, x1 + 0.25, -0.78 + dy * 0.5, 0.17, 0.74);
        blob(spoke, x1 + 0.25, -0.78 + dy * 0.5, 0.07, 0.6);
        // axle under the platform
        quad(dark, [[x0 - 0.1, -0.84 + dy * 0.5 - 0.06], [x1 + 0.3, -0.84 + dy * 0.5 - 0.06], [x1 + 0.3, -0.7 + dy * 0.5], [x0 - 0.1, -0.7 + dy * 0.5]]);
        // shafts on the far end, reaching out to the left behind; or, from the front, the near end's two shafts to the ground
        if (front) {
            quad(dark, [[-0.7, yb], [-0.5, yb], [-0.85, 0.05], [-1.07, 0.05]]);
            quad(dark, [[0.5, yb], [0.7, yb], [1.07, 0.05], [0.85, 0.05]]);
            quad(light, [[-0.72, yb - 0.1], [-0.54, yb - 0.1], [-0.89, 0], [-1.07, 0]]);
            quad(light, [[0.54, yb - 0.1], [0.72, yb - 0.1], [1.07, 0], [0.89, 0]]);
        }
        // platform: side (towards the road), top, and the near end
        quad(dark, [[x0, yt], [x0, yb], P(x0, yb, 1), P(x0, yt, 1)]);
        quad(light, [[x0, yt], [x1, yt], P(x1, yt, 1), P(x0, yt, 1)]);
        quad(body, [[x0, yt], [x1, yt], [x1, yb], [x0, yb]]);
        // cargo on the platform: a sack, a basket, a crate
        blob(tint('#e8dcb8'), 0.35 + dx * 0.45, yt - 0.35 + dy * 0.45, 0.5, 0.42);
        quad(tint('#b98a4e'), [[x0 + 0.2, yt - 0.02 + dy * 0.3], [x0 + 0.75, yt - 0.02 + dy * 0.3], [x0 + 0.8, yt - 0.5 + dy * 0.3], [x0 + 0.15, yt - 0.5 + dy * 0.3]]);
        quad(tint('#8c6439'), [[x0 + 0.15, yt - 0.5 + dy * 0.3], [x0 + 0.8, yt - 0.5 + dy * 0.3], [x0 + 0.8, yt - 0.57 + dy * 0.3], [x0 + 0.15, yt - 0.57 + dy * 0.3]]);
        // railing on the side towards the road (two posts and two beams) and at the near end
        const post = (x, k) => { const [px, py] = P(x, yt, k); quad(body, [[px - 0.06, py], [px - 0.06, py - 0.75], [px + 0.06, py - 0.75], [px + 0.06, py]]); };
        const rail = (xa, ka, xb, kb, h, th) => { const [ax, ay] = P(xa, yt - h, ka); const [bx, by] = P(xb, yt - h, kb); quad(light, [[ax, ay], [bx, by], [bx, by + th], [ax, ay + th]]); };
        post(x0, 1);
        rail(x0, 0, x0, 1, 0.75, 0.1);
        rail(x0, 0, x0, 1, 0.38, 0.09);
        post(x0, 0);
        post(x1, 0);
        if (!front) {
            quad(body, [[x0, yt], [x0, yt - 0.7], [x1, yt - 0.7], [x1, yt]]);
            quad(light, [[x0 - 0.04, yt - 0.7], [x1 + 0.04, yt - 0.7], [x1 + 0.04, yt - 0.82], [x0 - 0.04, yt - 0.82]]);
            quad(light, [[x0, yt - 0.35], [x1, yt - 0.35], [x1, yt - 0.44], [x0, yt - 0.44]]);
        } else {
            rail(x0, 0, x1, 0, 0.75, 0.1);
            rail(x0, 0, x1, 0, 0.38, 0.09);
        }
        // near wheel, on the side towards the road, seen at an angle: an ellipse with six spokes
        const cx = x0 + dx * 0.5 - 0.1;
        const cy = -0.78 + dy * 0.5;
        ctx.lineCap = 'round';
        ctx.strokeStyle = spoke;
        ctx.lineWidth = 0.09;
        for (let k = 0; k < 6; k++) {
            const t = k * Math.PI / 3 + 0.3;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + Math.cos(t) * 0.32, cy + Math.sin(t) * 0.72);
            ctx.stroke();
        }
        ctx.strokeStyle = rim;
        ctx.lineWidth = 0.16;
        ctx.beginPath();
        ctx.ellipse(cx, cy, 0.34, 0.74, 0, 0, Math.PI * 2);
        ctx.stroke();
        blob(rim, cx, cy, 0.09, 0.12);
    }

    // Houses, people, oxen and palms far off: they are left out until they are tall enough on the screen to read as
    // themselves (appear: px), and are drawn as plain shapes until they are larger still (plain: px)
    const SMALL = {
        farmhouse: {h: 4.5, appear: 2.2, plain: 7},
        vhut: {h: 4.2, appear: 2.2, plain: 7},
        farmerBend: {h: 1.9, appear: 2.2, plain: 7},
        farmerStand: {h: 2.1, appear: 2.2, plain: 7},
        ox: {h: 1.9, appear: 2.2, plain: 7},
        buffalo: {h: 2.1, appear: 2.2, plain: 7},
        palm: {h: 8, appear: 2.2, plain: 7},
        banana: {h: 4, appear: 2.2, plain: 7},
        bamboo: {h: 6.5, appear: 2.2, plain: 7},
        cart: {h: 1.9, appear: 2.2, plain: 7},
        cartRear: {h: 1.9, appear: 2.2, plain: 7},
        cartFront: {h: 1.9, appear: 2.2, plain: 7}
    };
    const PLAIN_THINGS = {
        // the carts keep their full drawing at any distance, so the way one faces never seems to change
        cart(tint, thing, size) { THINGS.cart(tint, thing, size); },
        cartRear(tint, thing, size) { THINGS.cartRear(tint, thing, size); },
        cartFront(tint, thing, size) { THINGS.cartFront(tint, thing, size); },
        farmhouse(tint) {
            shape(tint('#f4ecd7'), [[-4, 0], [-4, -2.6], [4, -2.6], [4, 0]]);
            shape(tint('#47546d'), [[-5.1, -2.45], [-3.3, -4.5], [3.3, -4.5], [5.1, -2.45]]);
        },
        vhut(tint) {
            shape(tint('#a1764a'), [[-2.4, 0], [-2.4, -2.0], [2.4, -2.0], [2.4, 0]]);
            shape(tint('#5e4b47'), [[-3.3, -1.85], [-1.7, -4.2], [1.7, -4.2], [3.3, -1.85]]);
        },
        farmerBend(tint) {
            shape(tint('#3d6fd0'), [[0.1, 0], [-0.9, -1.1], [-0.2, -1.4], [0.5, 0]]);
            shape(tint('#f2dc8a'), [[-1.6, -1.26], [-1.0, -1.82], [-0.4, -1.26]]);
        },
        farmerStand(tint) {
            shape(tint('#3d6fd0'), [[-0.34, 0], [-0.26, -1.5], [0.26, -1.5], [0.34, 0]]);
            shape(tint('#f2dc8a'), [[-0.5, -1.7], [0, -2.15], [0.5, -1.7]]);
        },
        ox(tint) {
            blob(tint('#8a5a36'), 0, -1.1, 1.5, 0.9);
            blob(tint('#8a5a36'), -1.85, -0.9, 0.5, 0.45);
        },
        buffalo(tint) {
            blob(tint('#55555f'), 0, -1.1, 1.6, 0.95);
            blob(tint('#55555f'), -2.0, -0.9, 0.55, 0.45);
        },
        palm(tint) {
            ctx.strokeStyle = tint('#8a6440');
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(1.1, -7);
            ctx.stroke();
            blob(tint('#3aa65a'), 1.1, -7, 2.8, 1.1);
        },
        banana(tint) {
            shape(tint('#86a64c'), [[-0.16, 0], [-0.12, -2.0], [0.12, -2.0], [0.16, 0]]);
            blob(tint('#4db35a'), 0, -2.3, 2.0, 0.9);
        },
        bamboo(tint) {
            ctx.strokeStyle = tint('#7aa83a');
            ctx.lineWidth = 0.4;
            ctx.beginPath();
            ctx.moveTo(-0.2, 0);
            ctx.lineTo(0, -6);
            ctx.moveTo(0.4, 0);
            ctx.lineTo(0.5, -5.2);
            ctx.stroke();
            blob(tint('#4aa14a'), 0.2, -6, 1.2, 0.6);
        }
    };

    // Things on the right far off are drawn with their segment (nearer ground and houses then cover them). The farm yard things
    // (thing.late) are drawn with the rest, in the near stretch, so what is far off on the left cannot be drawn over them
    function farRight(thing, n) {
        return thing.x > Track.WALL_AT && !(thing.late && n < 90);
    }

    // Countryside things drawn smaller, to sit right beside the riders (1.4 m tall): a chicken, a cart, a basket, a pot, the rest a little
    const THING_SCALE = {chicken: 0.5, cart: 0.55, cartRear: 0.55, cartFront: 0.55, basket: 0.42, claypot: 0.8, sign: 0.9, endrail: 1, moped: 1.15};
    function drawThing(thing, entry, look, cameraX, n) {
        const scale = entry.scale1;
        const sx = width / 2 + (entry.roadX + thing.x - cameraX) * scale;
        const sy = entry.y1 - ((thing.base || 0) + (look.country && thing.x < 0 && (thing.kind === 'ox' || thing.kind === 'buffalo') ? 0.55 : 0)) * scale; // on a cliff, or below the road (cattle in the fields stand on the bunds, so the fields in front do not hide their legs)
        const shrink = look.country ? (THING_SCALE[thing.kind] || 0.75) : 1;
        const size = (thing.size || 1) * shrink * scale;
        if (size < 0.6 || sx < -size * 20 || sx > width + size * 20) {
            return;
        }
        const small = look.country ? SMALL[thing.kind] : null;
        if (small && size / shrink * small.h < small.appear * (thing.x > Track.WALL_AT ? 0.55 : 1)) {
            return;
        }
        const tint = color => mix(color, look.fog, haze(n) * 0.85);
        if (entry.clip <= 0) {
            return;
        }
        if (look.country && thing.x > Track.WALL_AT && thing.kind !== 'pole' && thing.kind !== 'cherry' && entry.nearHc >= 1.5 && entry.nearHc > entry.hc + 0.5 && thing.x > 46 && (thing.base || 0) + 2 < entry.nearHc) { // (only what lies beyond the hill's crest, not the hillside's own houses)
            return; // beyond a taller hill (the valley houses, cattle and trees)
        }
        if (look.country && Math.abs(thing.x) > Track.ROAD + 3 && !['pole', 'cherry', 'sign', 'start', 'goal', 'lamp'].includes(thing.kind) && entry.tp && shownNow) {
            // On the right, down in the valley: the ground between the camera and the thing, nearer, hides it where it rises above
            // the line of sight (the road's own dips and rises included)
            const topY = entry.segment.y1 + (thing.base || 0) + 0.5;
            for (let k = 1; k <= 30; k++) {
                const t = k / 34; // (not right up to the thing: the ground it stands on is no cover for it)
                const z = entry.z1 * t;
                const j = Math.max(0, Math.min(shownNow.length - 1, entry.n + Math.floor((z - entry.z1) / Track.SEGMENT)));
                const near = shownNow[j];
                if (!near || !near.tp) {
                    continue;
                }
                // the thing's place sideways of the camera, and the road's middle there (the road bends, so not the same)
                const lateral = (entry.roadX + thing.x - cameraX) * t - (near.roadX - cameraX);
                // (a road that bends puts the right-hand hill in front of what lies on the left, and the other way round)
                const ground = near.segment.y1 + (lateral >= 0 ? Track.rightHeight(near.tp, lateral) : Track.leftHeight(near.tp, -lateral));
                if (ground > cameraYNow + (topY - cameraYNow) * t + 1.2) {
                    return;
                }
            }
        }
        if (look.country && thing.final && !thing.village && entry.tp) {
            // Nothing of the final stretch hangs in the air: what the ground drawn under it (the coarse slopes far off, the terraces
            // grouped) is lower than where it stands is left out
            const P = entry.tp;
            const off = Math.abs(thing.x);
            let drawn;
            if (thing.x > 0) {
                const e = Track.SLOPE_AT;
                const nodes = entry.n < 60 ? [e, e + 2, e + 5, e + 9, e + 15, e + 23, e + 33, e + 46, e + 62, e + 80, 110] : [e, e + 5, e + 15, e + 33, e + 62, 110];
                drawn = 0;
                for (let q = 0; q + 1 < nodes.length; q++) {
                    if (off >= nodes[q] && off <= nodes[q + 1]) {
                        const ha = Track.rightHeight(P, nodes[q]);
                        const hb = Track.rightHeight(P, nodes[q + 1]);
                        drawn = ha + (hb - ha) * (off - nodes[q]) / (nodes[q + 1] - nodes[q]);
                        break;
                    }
                }
            } else if (off <= 12) {
                drawn = Track.leftHeight(P, off);
            } else {
                const idx = Track.patternIndex(entry.segment.index);
                const dk = entry.n < 40 ? 1 : entry.n < 90 ? 2 : 3;
                const K = entry.n < 40 ? 27 : entry.n < 90 ? 20 : 15;
                const edge = (i, k) => 12 + 15 * k + (k ? 3.2 * Math.sin(i * 0.12 + k * 2.1) : 0);
                drawn = Track.leftHeight(P, off);
                for (let k = Math.floor((K - 1) / dk) * dk; k >= 0; k -= dk) {
                    if (off >= edge(idx, k) && off < edge(idx, k + dk)) {
                        drawn = -1.6 + P.left * 1.8 * (1 + k + ((dk - 1) >> 1));
                        break;
                    }
                }
            }
            if ((thing.base || 0) - drawn > 0.35) {
                return;
            }
        }
        if (look.country && thing.kind === 'pole' && entry.nearHc >= 3) {
            return; // a railway mast behind a hill: covered by it
        }
        if (look.country && thing.x > Track.WALL_AT && (thing.base || 0) < -1 && shownNow && thing.kind !== 'pole' && thing.kind !== 'cherry') {
            // Down in the valley on the right: what lies to the road's side of the road's right edge on the screen is behind the road
            // (or the lip of the slope beside it), not beside it
            for (let j = 0; j < entry.n; j++) {
                const e = shownNow[j];
                if (!e.visible || sy > e.y1 || sy < e.y2) {
                    continue;
                }
                const t = e.y1 > e.y2 ? (sy - e.y2) / (e.y1 - e.y2) : 0;
                const edge = e.x2 + Track.ROAD * 1.13 * e.scale2 + (e.x1 + Track.ROAD * 1.13 * e.scale1 - e.x2 - Track.ROAD * 1.13 * e.scale2) * t;
                if (sx < edge + 6) {
                    return;
                }
                break;
            }
        }
        if (thing.obstacle) {
            clipped(entry.clip, () => drawObstacle(thing, {x: sx, y: sy}, size * OBSTACLE_SCALE, look));
            return;
        }
        if (thing.kind === 'start' || thing.kind === 'goal') {
            clipped(entry.clip, () => drawGate(thing.kind === 'start' ? 'START' : 'GOAL', entry, sy, size, cameraX));
            return;
        }
        // beyond a crest only what stands above it shows; things on lower ground on the left (the fields) are let through by that depth, on the right (the valley beyond the hill) they are not
        // beyond a crest only what stands above it shows; things on lower ground (the fields on the left, the valley on the right
        // beyond a low hill) are let through by that depth, but not where they would stand on the road itself across the screen
        let overRoad = false;
        if (entry.clipX !== null) {
            const edge = (Track.ROAD + 2.5) * entry.clipS + size * 2.5;
            overRoad = Math.abs(sx - entry.clipX) < edge;
        }
        clipped(look.country ? Math.min(height, entry.clip + (!overRoad && !(thing.final && thing.kind === 'bush') && (thing.x < 0 || (thing.base < 0 && currentTrack && entry.hc < 4)) ? Math.max(0, -(thing.base || 0)) * scale : 0) + (thing.village ? 60 : 2)) : entry.clip, () => {
            ctx.save();
            ctx.translate(sx, sy);
            if (thing.flip) {
                ctx.scale(-1, 1);
            }
            ctx.scale(size, size); // from here on in meters, up is negative
            (small && size / shrink * small.h < small.plain * 0.45 ? PLAIN_THINGS : THINGS)[thing.kind](tint, thing, size);
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
        // The countryside: a cherry tree (dark trunk, soft pink clouds), a curved lamp post, a railway mast, a village house, an ox
        // grazing (seen from the side, facing left) and two farmers
        cherry(tint) {
            // Trunk with a flared foot and a darker side, branches up into the crown
            shape(tint('#5a3b2a'), [[-0.34, 0], [-0.2, -0.5], [-0.15, -2.5], [0.15, -2.5], [0.2, -0.5], [0.36, 0]]);
            shape(tint('#47301f'), [[0.02, 0], [0.04, -2.5], [0.15, -2.5], [0.2, -0.5], [0.36, 0]]);
            ctx.strokeStyle = tint('#5a3b2a');
            ctx.lineCap = 'round';
            ctx.lineWidth = 0.17;
            ctx.beginPath();
            ctx.moveTo(0, -2.0);
            ctx.lineTo(-1.3, -3.4);
            ctx.moveTo(0, -2.3);
            ctx.lineTo(1.2, -3.5);
            ctx.moveTo(0, -2.5);
            ctx.lineTo(-0.3, -4.0);
            ctx.moveTo(0, -2.4);
            ctx.lineTo(0.5, -4.1);
            ctx.stroke();
            ctx.lineWidth = 0.1;
            ctx.beginPath();
            ctx.moveTo(-1.0, -3.1);
            ctx.lineTo(-1.9, -3.5);
            ctx.moveTo(0.95, -3.2);
            ctx.lineTo(1.9, -3.7);
            ctx.stroke();
            // The crown: darker pink underneath, clouds of blossom over it, lighter on top
            blob(tint('#ee93b5'), 0, -3.9, 2.55, 1.35);
            blob(tint('#ee93b5'), -1.9, -3.5, 1.5, 0.9);
            blob(tint('#ee93b5'), 2.0, -3.6, 1.5, 0.95);
            blob(tint('#f4a3c2'), 0, -4.4, 2.4, 1.55);
            blob(tint('#f7b5cd'), -1.7, -3.9, 1.5, 1.05);
            blob(tint('#f7b5cd'), 1.8, -4.0, 1.55, 1.1);
            blob(tint('#f9bfd5'), -0.9, -5.0, 1.25, 0.8);
            blob(tint('#fbcddf'), 0.5, -5.2, 1.5, 0.95);
            blob(tint('#fde0ec'), -0.1, -5.5, 0.8, 0.45);
            // Clusters of deeper blossom and pale highlights, and a few petals drifting under it
            for (const [x, y, r] of [[-1.5, -4.3, 0.2], [0.9, -4.0, 0.22], [-0.3, -3.8, 0.18], [1.7, -4.4, 0.18], [-2.1, -3.7, 0.16], [0.2, -4.9, 0.17]]) {
                blob(tint('#e97fa6'), x, y, r, r * 0.85);
            }
            for (const [x, y, r] of [[-1.1, -5.0, 0.2], [1.2, -4.8, 0.22], [-0.2, -5.4, 0.15], [0.8, -4.45, 0.14], [-1.9, -4.2, 0.14]]) {
                blob(tint('#fff0f6'), x, y, r, r * 0.8);
            }
            for (const [x, y] of [[-1.3, -2.3], [0.9, -1.7], [1.7, -2.6], [-0.5, -1.2], [-2.0, -1.6]]) {
                blob(tint('#f9bfd5'), x, y, 0.1, 0.06);
            }
        },
        lamp(tint) {
            ctx.strokeStyle = tint('#9aa0ab');
            ctx.lineWidth = 0.17;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(0, -6.8);
            ctx.quadraticCurveTo(0, -8, 1.7, -7.9);
            ctx.stroke();
            shape(tint('#c7ccd5'), [[1.5, -8.05], [3.3, -8.05], [3.4, -7.8], [3.3, -7.6], [1.5, -7.6]]);
            shape(tint('#fff3c4'), [[1.9, -7.62], [3.0, -7.62], [3.0, -7.52], [1.9, -7.52]]);
        },
        pole(tint) {
            ctx.strokeStyle = tint('#5d6070');
            ctx.lineWidth = 0.24;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(0, -6);
            ctx.moveTo(-1.3, -5.2);
            ctx.lineTo(1.3, -5.2);
            ctx.stroke();
            blob(tint('#cfd3dd'), -1.2, -4.95, 0.13, 0.22);
            blob(tint('#cfd3dd'), 1.2, -4.95, 0.13, 0.22);
        },
        farmhouse(tint) {
            shape(tint('#f4ecd7'), [[-4, 0], [-4, -2.6], [4, -2.6], [4, 0]]);
            shape(tint('#e6dcc0'), [[-4, -0.25], [4, -0.25], [4, 0], [-4, 0]]);
            shape(tint('#47546d'), [[-5.1, -2.45], [-3.3, -4.5], [3.3, -4.5], [5.1, -2.45]]);
            shape(tint('#38445b'), [[-5.1, -2.45], [5.1, -2.45], [5.0, -2.75], [-5.0, -2.75]]);
            for (const x of [-3, -1.7, 2.1]) {
                shape(tint('#46557a'), [[x - 0.45, -1.1], [x - 0.45, -1.95], [x + 0.45, -1.95], [x + 0.45, -1.1]]);
            }
            shape(tint('#8b6a49'), [[0.1, 0], [0.1, -1.7], [1.1, -1.7], [1.1, 0]]);
        },
        ox(tint) {
            const body = tint('#8a5a36');
            const dark = tint('#6e4528');
            for (const x of [-1.05, -0.65, 0.75, 1.1]) {
                shape(dark, [[x - 0.15, -1], [x - 0.13, 0], [x + 0.13, 0], [x + 0.15, -1]]);
            }
            blob(body, 0, -1.45, 1.5, 0.78);
            ctx.strokeStyle = dark;
            ctx.lineWidth = 0.12;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(1.45, -1.7);
            ctx.quadraticCurveTo(1.75, -1.2, 1.6, -0.6);
            ctx.stroke();
            shape(body, [[-1.1, -1.9], [-1.9, -1.0], [-1.85, -0.6], [-1.3, -0.7], [-0.9, -1.2]]);
            blob(body, -1.85, -0.72, 0.42, 0.34);
            shape(tint('#efe6cc'), [[-1.75, -1.0], [-1.95, -1.3], [-1.6, -1.15]]);
            shape(tint('#efe6cc'), [[-1.5, -0.98], [-1.5, -1.3], [-1.3, -1.05]]);
        },
        farmerBend(tint) {
            ctx.lineCap = 'round';
            ctx.strokeStyle = tint('#26356b');
            ctx.lineWidth = 0.24;
            ctx.beginPath();
            ctx.moveTo(0.1, 0);
            ctx.lineTo(0.15, -0.85);
            ctx.moveTo(-0.25, 0);
            ctx.lineTo(0, -0.85);
            ctx.stroke();
            ctx.strokeStyle = tint('#3d6fd0');
            ctx.lineWidth = 0.55;
            ctx.beginPath();
            ctx.moveTo(0.1, -0.85);
            ctx.lineTo(-0.7, -1.2);
            ctx.stroke();
            ctx.lineWidth = 0.15;
            ctx.beginPath();
            ctx.moveTo(-0.55, -1.15);
            ctx.lineTo(-0.9, -0.5);
            ctx.stroke();
            blob(tint('#f1c9a0'), -1.0, -1.18, 0.17, 0.17);
            shape(tint('#f2dc8a'), [[-1.6, -1.26], [-1.0, -1.82], [-0.4, -1.26]]);
            blob(tint('#bfe6f2'), -0.2, 0.02, 0.9, 0.12);
        },
        farmerStand(tint) {
            ctx.lineCap = 'round';
            ctx.strokeStyle = tint('#26356b');
            ctx.lineWidth = 0.24;
            ctx.beginPath();
            ctx.moveTo(-0.15, 0);
            ctx.lineTo(-0.12, -0.85);
            ctx.moveTo(0.15, 0);
            ctx.lineTo(0.12, -0.85);
            ctx.stroke();
            shape(tint('#3d6fd0'), [[-0.34, -0.85], [-0.26, -1.5], [0.26, -1.5], [0.34, -0.85]]);
            ctx.strokeStyle = tint('#3d6fd0');
            ctx.lineWidth = 0.13;
            ctx.beginPath();
            ctx.moveTo(-0.28, -1.42);
            ctx.lineTo(-0.58, -0.82);
            ctx.moveTo(0.28, -1.42);
            ctx.lineTo(0.58, -0.82);
            ctx.stroke();
            blob(tint('#a8794a'), -0.62, -0.62, 0.2, 0.17);
            blob(tint('#a8794a'), 0.62, -0.62, 0.2, 0.17);
            blob(tint('#f1c9a0'), 0, -1.65, 0.16, 0.16);
            shape(tint('#f2dc8a'), [[-0.5, -1.7], [0, -2.15], [0.5, -1.7]]);
        },
        // The Sa Pa valley: a buffalo (dark, with swept-back horns), a small timber house, a banana plant and bamboo
        // A traditional wooden farm cart, seen from the side: a low platform above the axle, short railings, two big spoked
        // wheels (the far one a little behind), long shafts out in front, and a sack, a basket and a crate on it
        cart(tint) {
            const body = tint('#a1764a');
            const beam = tint('#c98a4b');
            const rim = tint('#5b3a22');
            const spoke = tint('#8c6439');
            const under = tint('#7a5632');
            // shafts (far one first, a little higher)
            shape(under, [[-1.2, -1.0], [-3.6, -0.45], [-3.6, -0.33], [-1.2, -0.88]]);
            shape(beam, [[-1.2, -0.92], [-3.6, -0.3], [-3.6, -0.18], [-1.2, -0.8]]);
            // far wheel
            const wheel = (cx, cy, rimColor, spokeColor) => {
                ctx.strokeStyle = spokeColor;
                ctx.lineWidth = 0.09;
                ctx.lineCap = 'round';
                for (let k = 0; k < 6; k++) {
                    const t = k * Math.PI / 3 + 0.3;
                    ctx.beginPath();
                    ctx.moveTo(cx, cy);
                    ctx.lineTo(cx + Math.cos(t) * 0.72, cy + Math.sin(t) * 0.72);
                    ctx.stroke();
                }
                ctx.strokeStyle = rimColor;
                ctx.lineWidth = 0.17;
                ctx.beginPath();
                ctx.arc(cx, cy, 0.72, 0, Math.PI * 2);
                ctx.stroke();
                blob(rimColor, cx, cy, 0.14, 0.14);
            };
            wheel(0.38, -0.78, under, under);
            // axle and platform
            shape(under, [[-0.7, -0.82], [-0.7, -0.7], [0.9, -0.7], [0.9, -0.82]]);
            shape(under, [[-1.4, -0.85], [1.4, -0.85], [1.3, -0.78], [-1.3, -0.78]]);
            shape(body, [[-1.4, -1.12], [-1.4, -0.85], [1.4, -0.85], [1.4, -1.12]]);
            // cargo behind the railings
            shape(tint('#c9a36b'), [[0.55, -1.12], [1.25, -1.12], [1.25, -1.55], [0.55, -1.55]]);
            blob(tint('#e8dcb8'), 0.9, -1.55, 0.42, 0.42);
            shape(tint('#b98a4e'), [[-0.25, -1.12], [0.3, -1.12], [0.4, -1.5], [-0.35, -1.5]]);
            shape(tint('#8c6439'), [[-0.35, -1.5], [0.4, -1.5], [0.4, -1.57], [-0.35, -1.57]]);
            shape(tint('#9a6e3f'), [[-1.2, -1.12], [-0.55, -1.12], [-0.55, -1.55], [-1.2, -1.55]]);
            // railings
            for (const x of [-1.4, -0.45, 0.5, 1.4]) {
                shape(body, [[x - 0.06, -1.12], [x - 0.06, -1.9], [x + 0.06, -1.9], [x + 0.06, -1.12]]);
            }
            shape(beam, [[-1.46, -1.9], [1.46, -1.9], [1.46, -1.78], [-1.46, -1.78]]);
            shape(beam, [[-1.4, -1.5], [1.4, -1.5], [1.4, -1.4], [-1.4, -1.4]]);
            // near wheel
            wheel(-0.25, -0.75, rim, spoke);
        },
        // The same farm cart in three-quarter view, from behind (the road side of it) and from the front: the near end, the top
        // of the platform and the side facing the road are all seen, with the near wheel's spokes and the far wheel edge-on
        cartRear(tint, thing) { drawCartAngled(tint, false); },
        cartFront(tint, thing) { drawCartAngled(tint, true); },
        // A Vietnamese round woven basket (thung): a wide shallow bowl of bamboo weave with a darker rim
        basket(tint) {
            // deeper and rounder: a bowl as tall as it is wide, woven bands across it, a dark rim and a visible opening
            const weave = tint('#c9a063');
            const light = tint('#d9b574');
            const dark = tint('#9a7040');
            const rim = tint('#7a5632');
            shape(weave, [[-0.75, -1.05], [-0.62, -0.28], [-0.4, -0.04], [0.4, -0.04], [0.62, -0.28], [0.75, -1.05]]);
            shape(light, [[-0.75, -1.05], [-0.7, -0.8], [0.7, -0.8], [0.75, -1.05]]);
            shape(dark, [[-0.66, -0.6], [0.66, -0.6], [0.63, -0.5], [-0.63, -0.5]]);
            shape(dark, [[-0.56, -0.3], [0.56, -0.3], [0.52, -0.2], [-0.52, -0.2]]);
            ctx.strokeStyle = dark;
            ctx.lineWidth = 0.05;
            ctx.lineCap = 'round';
            for (const x of [-0.45, -0.15, 0.15, 0.45]) {
                ctx.beginPath();
                ctx.moveTo(x * 1.1, -1.0);
                ctx.lineTo(x * 0.8, -0.06);
                ctx.stroke();
            }
            blob(rim, 0, -1.05, 0.8, 0.14);
            blob(tint('#5a3d22'), 0, -1.06, 0.66, 0.09);
        },
        // A chicken, side view, facing left: a round body, a tail, a head with a red comb and an orange beak, thin legs
        chicken(tint, thing) {
            const hen = thing && thing.tone ? '#b5683c' : '#f1ead8';
            const wing = thing && thing.tone ? '#8f4a26' : '#d9cfb4';
            ctx.strokeStyle = tint('#d9953a');
            ctx.lineWidth = 0.05;
            ctx.lineCap = 'round';
            for (const x of [-0.08, 0.1]) {
                ctx.beginPath();
                ctx.moveTo(x, -0.28);
                ctx.lineTo(x, 0);
                ctx.stroke();
            }
            shape(tint(wing), [[0.2, -0.5], [0.55, -0.88], [0.48, -0.42]]);
            blob(tint(hen), 0, -0.44, 0.33, 0.24);
            blob(tint(wing), 0.06, -0.42, 0.18, 0.1);
            shape(tint(hen), [[-0.2, -0.55], [-0.3, -0.85], [-0.16, -0.86], [-0.08, -0.58]]);
            blob(tint(hen), -0.3, -0.84, 0.13, 0.12);
            blob(tint('#d93b3b'), -0.3, -0.98, 0.07, 0.06);
            shape(tint('#f0a030'), [[-0.42, -0.84], [-0.56, -0.8], [-0.42, -0.77]]);
            blob(tint('#d93b3b'), -0.4, -0.72, 0.035, 0.05);
            blob('#222', -0.34, -0.86, 0.015, 0.015);
        },
        // A Vietnamese fermentation jar (vai / chum): a dark brown glazed clay pot with a round belly, a short neck, a flared rim
        // and a flat clay lid
        claypot(tint, thing) {
            const body = tint(thing && thing.tone ? '#8a4b2a' : '#a3592f');
            const dark = tint('#5e3119');
            const light = tint('#c47a45');
            shape(dark, [[-0.3, -0.02], [0.3, -0.02], [0.34, -0.12], [-0.34, -0.12]]);
            blob(body, 0, -0.62, 0.56, 0.58);
            shape(body, [[-0.46, -1.02], [-0.42, -1.32], [0.42, -1.32], [0.46, -1.02]]);
            shape(dark, [[-0.54, -1.32], [0.54, -1.32], [0.5, -1.42], [-0.5, -1.42]]);
            shape(light, [[-0.42, -1.42], [0.42, -1.42], [0.32, -1.56], [-0.32, -1.56]]);
            blob(light, -0.2, -0.78, 0.1, 0.22);
            shape(dark, [[-0.5, -0.5], [0.5, -0.5], [0.52, -0.4], [-0.52, -0.4]]);
        },
        buffalo(tint) {
            const body = tint('#55555f');
            const dark = tint('#3b3b44');
            const horn = tint('#d9d2bd');
            for (const x of [-1.05, -0.6, 0.75, 1.1]) {
                shape(dark, [[x - 0.17, -1], [x - 0.15, 0], [x + 0.15, 0], [x + 0.17, -1]]);
            }
            blob(body, 0.05, -1.45, 1.6, 0.82);
            blob(body, -0.7, -1.95, 0.75, 0.42);
            shape(body, [[-1.2, -1.9], [-2.05, -1.0], [-2.0, -0.55], [-1.4, -0.65], [-0.95, -1.2]]);
            blob(body, -2.0, -0.7, 0.45, 0.34);
            blob(tint('#8a8a92'), -2.28, -0.62, 0.2, 0.16);
            ctx.lineCap = 'round';
            ctx.strokeStyle = horn;
            ctx.lineWidth = 0.14;
            ctx.beginPath();
            ctx.moveTo(-1.7, -1.05);
            ctx.quadraticCurveTo(-2.5, -1.45, -1.75, -1.9);
            ctx.stroke();
            ctx.strokeStyle = dark;
            ctx.lineWidth = 0.12;
            ctx.beginPath();
            ctx.moveTo(1.55, -1.75);
            ctx.quadraticCurveTo(1.95, -1.2, 1.75, -0.55);
            ctx.stroke();
        },
        vhut(tint) {
            shape(tint('#a1764a'), [[-2.4, 0], [-2.4, -2.0], [2.4, -2.0], [2.4, 0]]);
            for (const x of [-1.2, 0, 1.2]) {
                shape(tint('#8c6439'), [[x - 0.04, 0], [x - 0.04, -2.0], [x + 0.04, -2.0], [x + 0.04, 0]]);
            }
            shape(tint('#8c6439'), [[-2.4, -0.3], [2.4, -0.3], [2.4, 0], [-2.4, 0]]);
            shape(tint('#5e4b47'), [[-3.3, -1.85], [-1.7, -4.2], [1.7, -4.2], [3.3, -1.85]]);
            shape(tint('#4a3a38'), [[-3.3, -1.85], [3.3, -1.85], [3.2, -2.2], [-3.2, -2.2]]);
            shape(tint('#6d5a55'), [[-1.7, -4.2], [1.7, -4.2], [1.2, -3.4], [-1.2, -3.4]]);
            shape(tint('#3c2f2a'), [[-1.5, 0], [-1.5, -1.5], [-0.5, -1.5], [-0.5, 0]]);
            shape(tint('#3c2f2a'), [[0.7, -0.9], [0.7, -1.6], [1.7, -1.6], [1.7, -0.9]]);
        },
        banana(tint) {
            shape(tint('#86a64c'), [[-0.16, 0], [-0.12, -2.0], [0.12, -2.0], [0.16, 0]]);
            for (const [angle, length, color] of [[-0.25, 2.1, '#3f9f4a'], [-0.85, 2.3, '#4db35a'], [-1.57, 2.1, '#5cc063'], [-2.3, 2.3, '#4db35a'], [-2.9, 2.1, '#3f9f4a']]) {
                ctx.save();
                ctx.translate(0, -2.0);
                ctx.rotate(angle);
                blob(tint(color), length / 2, 0, length / 2, 0.4);
                ctx.restore();
            }
            blob(tint('#c8d65a'), 0.12, -1.75, 0.16, 0.26);
        },
        bamboo(tint) {
            ctx.lineCap = 'round';
            for (const [x, h, lean] of [[-0.55, 5.4, 0.5], [-0.15, 6.4, -0.2], [0.3, 5.9, 0.1], [0.65, 5.0, -0.5]]) {
                ctx.strokeStyle = tint('#7aa83a');
                ctx.lineWidth = 0.17;
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x + lean, -h);
                ctx.stroke();
                ctx.strokeStyle = tint('#5f8a2c');
                ctx.lineWidth = 0.2;
                for (let k = 1; k < 5; k++) {
                    ctx.beginPath();
                    ctx.moveTo(x + lean * k / 5 - 0.1, -h * k / 5);
                    ctx.lineTo(x + lean * k / 5 + 0.1, -h * k / 5);
                    ctx.stroke();
                }
                blob(tint('#4aa14a'), x + lean, -h, 1.0, 0.4);
                blob(tint('#5db85a'), x + lean + 0.4, -h + 0.5, 0.8, 0.3);
            }
        },
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
        moped(tint, thing) {
            // A parked moped seen from behind and a little above, like the riders: rounded overlapping panels in three tones
            // (light top, warm body, darker sides), a dark seat, one taillight, a thick rear tire, a small exhaust, wide handlebars
            const palettes = [
                ['#fff3a8', '#f6c944', '#d79f2b'], // pastel yellow
                ['#ffb7b0', '#e84a40', '#b9322f'], // red
                ['#ffffff', '#eef0f6', '#c2c7d6']  // white
            ];
            const [top, main, side] = palettes[(thing.variant || 0) % palettes.length];
            const dark = tint('#4a3f5e');
            const charcoal = tint('#38324a');
            const curve = (color, points) => {
                // a closed shape through the points with rounded corners
                ctx.fillStyle = color;
                ctx.beginPath();
                const n = points.length;
                ctx.moveTo((points[0][0] + points[n - 1][0]) / 2, (points[0][1] + points[n - 1][1]) / 2);
                for (let i = 0; i < n; i++) {
                    const p = points[i];
                    const q = points[(i + 1) % n];
                    ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
                }
                ctx.closePath();
                ctx.fill();
            };
            const view = Math.floor((thing.variant || 0) / 3) % 4; // 0 from behind, 1 from the front, 2 and 3 side on (facing left, facing right)
            if (view >= 2) {
                ctx.save();
                if (view === 3) {
                    ctx.scale(-1, 1);
                }
                ctx.fillStyle = 'rgba(20,20,40,0.2)';
                ctx.beginPath();
                ctx.ellipse(0, -0.02, 1.0, 0.16, 0, 0, Math.PI * 2);
                ctx.fill();
                // the exhaust at the rear, low
                curve(tint('#a3a6b3'), [[0.45, -0.3], [0.5, -0.4], [0.95, -0.38], [0.98, -0.3], [0.9, -0.24], [0.5, -0.24]]);
                // the rear body, the front shield and the floor between them
                curve(tint(side), [[-0.05, -0.34], [0.2, -0.36], [0.85, -0.42], [0.95, -0.7], [0.85, -0.92], [0.1, -0.88], [-0.1, -0.6]]);
                curve(tint(main), [[-0.1, -0.4], [0.2, -0.42], [0.8, -0.5], [0.88, -0.7], [0.78, -0.88], [0.15, -0.85], [-0.05, -0.62]]);
                curve(tint(main), [[-0.62, -0.34], [-0.3, -0.3], [-0.1, -0.34], [-0.1, -0.5], [-0.3, -0.7], [-0.55, -1.15], [-0.64, -1.1], [-0.68, -0.7]]);
                curve(tint(top), [[0.1, -0.8], [0.8, -0.85], [0.78, -0.9], [0.1, -0.88]]);
                // the seat
                curve(tint('#34284a'), [[-0.12, -0.9], [0.0, -1.0], [0.8, -1.0], [0.9, -0.94], [0.8, -0.86], [0.0, -0.86]]);
                curve(tint('#6a5890'), [[-0.05, -0.96], [0.02, -1.02], [0.7, -1.02], [0.76, -0.97]]);
                // the taillight at the very back
                curve(tint('#ff6a5c'), [[0.9, -0.84], [0.96, -0.8], [0.95, -0.7], [0.9, -0.7]]);
                // the front fork, wheel, fender and handlebar with the headlight
                ctx.strokeStyle = charcoal;
                ctx.lineWidth = 0.07;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(-0.6, -1.1);
                ctx.lineTo(-0.72, -0.26);
                ctx.moveTo(-0.58, -1.12);
                ctx.lineTo(-0.5, -1.38);
                ctx.lineTo(-0.7, -1.4);
                ctx.stroke();
                curve(tint(main), [[-0.97, -0.5], [-0.82, -0.58], [-0.6, -0.5], [-0.62, -0.46], [-0.95, -0.44]]);
                blob(tint('#25202f'), -0.72, -1.4, 0.07, 0.07);
                blob(tint('#fff6c8'), -0.68, -1.12, 0.1, 0.1);
                // the wheels, tires round a grey hub
                for (const wx of [-0.72, 0.62]) {
                    blob(charcoal, wx, -0.26, 0.27, 0.27);
                    blob(tint('#a3a6b3'), wx, -0.26, 0.12, 0.12);
                    blob(tint('#38324a'), wx, -0.26, 0.04, 0.04);
                }
                ctx.restore();
                return;
            }
            const front = view === 1;
            // the soft shadow on the ground
            ctx.fillStyle = 'rgba(20,20,40,0.2)';
            ctx.beginPath();
            ctx.ellipse(0, -0.02, 0.58, 0.15, 0, 0, Math.PI * 2);
            ctx.fill();
            // the rear tire, thick and a little tucked in, with a darker middle
            curve(charcoal, [[-0.11, 0], [-0.12, -0.3], [-0.1, -0.62], [0.1, -0.62], [0.12, -0.3], [0.11, 0]]);
            curve(tint('#26212f'), [[-0.04, -0.05], [-0.05, -0.3], [-0.04, -0.58], [0.04, -0.58], [0.05, -0.3], [0.04, -0.05]]);
            // the exhaust, low on the right: a grey cylinder with a dark opening
            curve(tint('#a3a6b3'), [[0.2, -0.2], [0.22, -0.36], [0.36, -0.36], [0.38, -0.2], [0.3, -0.12]]);
            blob(tint('#2e2a38'), 0.3, -0.27, 0.06, 0.07);
            if (front) {
                ctx.fillStyle = main; // (the exhaust hides behind the wheel seen from the front)
                curve(charcoal, [[-0.11, 0], [-0.12, -0.3], [-0.1, -0.62], [0.1, -0.62], [0.12, -0.3], [0.11, 0]]);
            }
            // the lower body in dark purple joins the wheel, the side panels and the seat
            curve(dark, [[-0.2, -0.3], [-0.26, -0.55], [0.26, -0.55], [0.2, -0.3]]);
            // the darker side panels, wider, curving in to the wheel
            curve(tint(side), [[-0.14, -0.34], [-0.37, -0.56], [-0.41, -0.84], [-0.3, -1.0], [0.3, -1.0], [0.41, -0.84], [0.37, -0.56], [0.14, -0.34]]);
            // the main body over them
            curve(tint(main), [[-0.13, -0.38], [-0.3, -0.58], [-0.33, -0.86], [-0.24, -0.98], [0.24, -0.98], [0.33, -0.86], [0.3, -0.58], [0.13, -0.38]]);
            // the top surface, the lightest, and one soft highlight across the upper rear
            curve(tint(top), [[-0.31, -0.9], [-0.25, -1.0], [-0.12, -1.06], [0.12, -1.06], [0.25, -1.0], [0.31, -0.9], [0, -0.94]]);
            ctx.strokeStyle = 'rgba(255,255,255,0.5)';
            ctx.lineWidth = 0.05;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(-0.22, -0.84);
            ctx.quadraticCurveTo(0, -0.94, 0.22, -0.84);
            ctx.stroke();
            // the taillight under the seat: a dark red housing round a bright coral light
            curve(tint(front ? '#c9c2a0' : '#a52f3a'), [[-0.19, -0.82], [-0.2, -0.7], [0.2, -0.7], [0.19, -0.82], [0, -0.85]]);
            curve(tint(front ? '#fff6c8' : '#ff6a5c'), [[-0.15, -0.79], [-0.16, -0.72], [0.16, -0.72], [0.15, -0.79], [0, -0.81]]);
            ctx.fillStyle = front ? 'rgba(255,240,170,0.3)' : 'rgba(255,120,100,0.25)';
            ctx.beginPath();
            ctx.ellipse(0, -0.74, 0.27, 0.1, 0, 0, Math.PI * 2);
            ctx.fill();
            // the dark seat: a lighter top, darker sides, wider at the front than the rear, with a dark seam under it
            curve(tint('#34284a'), [[-0.22, -0.98], [-0.24, -1.06], [0.24, -1.06], [0.22, -0.98]]);
            curve(tint('#6a5890'), [[-0.2, -1.06], [-0.27, -1.2], [-0.2, -1.26], [0.2, -1.26], [0.27, -1.2], [0.2, -1.06]]);
            // the handlebars, wider than the body, short and slightly curved, with round grips
            curve(charcoal, [[-0.06, -1.24], [-0.06, -1.34], [0.06, -1.34], [0.06, -1.24]]);
            ctx.strokeStyle = charcoal;
            ctx.lineWidth = 0.07;
            ctx.beginPath();
            ctx.moveTo(-0.44, -1.4);
            ctx.quadraticCurveTo(0, -1.28, 0.44, -1.4);
            ctx.stroke();
            blob(tint('#25202f'), -0.45, -1.41, 0.065, 0.07);
            blob(tint('#25202f'), 0.45, -1.41, 0.065, 0.07);
            if (front) {
                ctx.lineWidth = 0.04;
                ctx.beginPath();
                ctx.moveTo(-0.4, -1.4);
                ctx.lineTo(-0.5, -1.62);
                ctx.moveTo(0.4, -1.4);
                ctx.lineTo(0.5, -1.62);
                ctx.stroke();
                blob(tint('#cfd3e0'), -0.5, -1.64, 0.09, 0.06);
                blob(tint('#cfd3e0'), 0.5, -1.64, 0.09, 0.06);
            }
        },
        endrail(tint) {
            for (let x = -5; x <= 5.01; x += 1.25) {
                shape(tint('#8a5f33'), [[x - 0.09, 0], [x - 0.09, -1.1], [x + 0.09, -1.1], [x + 0.09, 0]]);
            }
            shape(tint('#b98a55'), [[-5.1, -0.5], [-5.1, -0.62], [5.1, -0.62], [5.1, -0.5]]);
            shape(tint('#c79862'), [[-5.1, -0.95], [-5.1, -1.12], [5.1, -1.12], [5.1, -0.95]]);
        },
        bush(tint) {
            blob(tint('#3b7d46'), -0.9, -0.55, 1.1, 0.7);
            blob(tint('#4a9150'), 0.7, -0.6, 1.2, 0.75);
            blob(tint('#5aa55a'), 0, -1.05, 1.1, 0.7);
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
            // a slim post and a small yellow plate with two dark chevrons
            ctx.fillStyle = tint('#45474d');
            ctx.fillRect(-0.04, -1.7, 0.08, 1.7);
            ctx.fillStyle = tint('#f5c400');
            ctx.fillRect(-0.38, -1.95, 0.76, 0.4);
            const way = thing.left ? -1 : 1;
            for (const offset of [-0.2, 0.05]) {
                const at = offset * way;
                shape(tint('#1d1b24'), [[at - 0.06 * way, -1.9], [at + 0.1 * way, -1.75], [at - 0.06 * way, -1.6], [at, -1.75]]);
            }
        },
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

