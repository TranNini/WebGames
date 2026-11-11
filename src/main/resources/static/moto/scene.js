// Moto Race's picture: the road as seen from behind the own bike, with the walls and things beside it and the other bikes on
// it. The look follows the user's pictures (MotoRace_*.png): the far view, walls, trees and signs are pieces of them in
// art/ (cut, straightened and painted by a script outside the repo); the road, kerbs, fences, lamps and lights are drawn in
// code in their colours. Sakura River turns from day into night along the way: its pieces come in both and are mixed.
// The road is worked out near to far (each segment only where nearer hills don't hide it), then painted far to near.
const Scene = (() => {
    const DRAW_SEGMENTS = 170; // 680 m ahead
    const CAMERA_BACK = 5; // the camera is this far behind the bike
    const BIKE_SCALE = 1.7; // bikes are drawn bigger than they are, to be seen well on a phone
    const RIDER_COLORS = ['#e5484d', '#3e7bfa', '#f5c400', '#2fb36d', '#9b5de5', '#f7782b'];
    const NIGHT_STEPS = 40; // Sakura's mixed pictures are made again at most this often over the ride

    // Colours of what is drawn in code. Sakura has a day and a night look, mixed by how far the ride has come.
    // left/right: the ground beside the road, in two shades as the road (null: a drop, the far view shows); lights: how
    // bright lamps glow; wet: how much the road mirrors them; neon: colours the shop signs throw on the wet pavement.
    const LOOKS = {
        sakuraDay: {
            road: ['#7b7882', '#77747e'], line: '#f4f3ef', center: '#f4f3ef', dashed: true, kerb: '#cdc6c0',
            left: ['#6f8d43', '#6a8840'], right: ['#6d9ccc', '#78a7d6'], fog: '#d7e6f3', petal: '#f6bccf', lights: 0, wet: 0.05,
            fence: '#2e3138', pole: '#24262b'
        },
        sakuraNight: {
            road: ['#2b2534', '#29232f'], line: '#e8e2ee', center: '#e8e2ee', dashed: true, kerb: '#5e5162',
            left: ['#1f2a1d', '#1c271a'], right: ['#2a2452', '#342b60'], fog: '#1d1a35', petal: '#f08cc6', lights: 1, wet: 0.85,
            fence: '#1b1c22', pole: '#17181d'
        },
        city: {
            road: ['#28232f', '#26212c'], line: '#ece8f0', center: '#ece8f0', dashed: true, kerb: '#4d4256',
            left: ['#3b2f47', '#382c44'], right: ['#2f2a35', '#2c2732'], fog: '#1c1a2e', petal: '#ec9ad0', lights: 1, wet: 1,
            neon: ['rgba(255,70,200,1)', 'rgba(70,200,255,1)', 'rgba(190,90,255,1)'],
            fence: '#211f27', pole: '#1e1d23'
        },
        mountain: {
            road: ['#4c4452', '#49414f'], line: '#f2ede8', center: '#eaa43c', dashed: false, kerb: '#5f5762',
            left: ['#2f3527', '#2c3225'], right: null, valley: ['#3a3348', '#221e2c'], fog: '#b98aa6', petal: '#f7c1d0',
            lights: 0.75, wet: 0.6,
            fence: '#aeb0ba', pole: '#3b3a40'
        }
    };
    // The far view of each course: its pictures, and which row of them is at the horizon
    const SKIES = {
        sakura: {day: 'sakura-sky-day', night: 'sakura-sky-night', horizonRow: 445},
        city: {day: 'city-sky', horizonRow: 378},
        mountain: {day: 'mountain-sky', horizonRow: 420}
    };
    // Walls laid along the road from a picture: which one, whether it repeats mirrored (no writing on it), Sakura's in two.
    // above: pictures stacked on it, top first, each as wide as it, so a street front is one wall (fewer pieces to draw).
    const WALL_ART = {
        hedge: {day: 'sakura-hedge-day', night: 'sakura-hedge-night', mirror: true},
        bank: {day: 'sakura-bank-day', night: 'sakura-bank-night', mirror: false}, // stone: made to repeat without a seam
        shops: {day: 'city-shops', above: ['city-flats'], mirror: false},
        flats: {day: 'city-flats', above: ['city-flats'], mirror: false},
        stone: {day: 'mountain-wall', mirror: false}
    };
    // Trees: picture, height in m, where the trunk stands across the picture (each leans right, over the road on the left)
    const TREES = {
        cherry: {pictures: [0, 1, 2].map(i => ({day: `cherry${i}-day`, night: `cherry${i}-night`})), height: 7.2, foot: [0.447, 0.471, 0.458]},
        'city-cherry': {pictures: [{day: 'cherry-city'}], height: 6.2, foot: [0.471]},
        'sunset-cherry': {pictures: [{day: 'cherry-sunset'}], height: 7, foot: [0.458]},
        'dark-tree': {pictures: [{day: 'tree-dark'}], height: 9, foot: [0.479]}
    };
    const PICTURES = ['sakura-sky-day', 'sakura-sky-night', 'city-sky', 'mountain-sky', 'sakura-hedge-day', 'sakura-hedge-night',
        'sakura-bank-day', 'sakura-bank-night', 'city-shops', 'city-flats', 'mountain-wall', 'sakura-lantern-day',
        'sakura-lantern-night', 'chevron-red', 'chevron-yellow', 'city-overpass', 'cherry0-day', 'cherry0-night', 'cherry1-day',
        'cherry1-night', 'cherry2-day', 'cherry2-night', 'cherry-city', 'cherry-sunset', 'tree-dark'];

    let canvas = null;
    let ctx = null;
    let width = 0;
    let height = 0;
    let pixelRatio = 1;
    let skyShift = 0;
    const pictures = {};
    const mixed = new Map(); // day and night mixed, and walls put next to their mirror image: made once per step
    let petals = [];
    let lastDraw = 0;

    function setUp(element) {
        canvas = element;
        ctx = canvas.getContext('2d');
        resize();
        for (const name of PICTURES) {
            const image = new Image();
            image.decoding = 'async';
            image.src = 'art/' + name + '.webp';
            pictures[name] = image;
        }
    }

    function resize() {
        pixelRatio = Math.min(2, window.devicePixelRatio || 1);
        width = canvas.clientWidth;
        height = canvas.clientHeight;
        canvas.width = Math.round(width * pixelRatio);
        canvas.height = Math.round(height * pixelRatio);
        ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
        petals = [];
    }

    const ready = image => image && image.complete && image.naturalWidth > 0;

    // A picture for now: Sakura's day and night mixed by how dark it is, a wall next to its mirror image
    function picture(art, night, mirror) {
        const step = art.night ? Math.round(night * NIGHT_STEPS) : 0;
        const key = art.day + '|' + step + '|' + (mirror ? 1 : 0);
        if (mixed.has(key)) {
            return mixed.get(key);
        }
        let day = pictures[art.day];
        const dark = art.night ? pictures[art.night] : null;
        if (!ready(day) || (dark && !ready(dark))) {
            return null;
        }
        if (art.above) {
            day = stacked(art);
            if (!day) {
                return null;
            }
        }
        if (!mirror && (!dark || step === 0)) {
            return day;
        }
        const made = document.createElement('canvas');
        made.width = day.naturalWidth * (mirror ? 2 : 1);
        made.height = day.naturalHeight;
        const c = made.getContext('2d');
        const paint = x => {
            c.drawImage(day, x, 0);
            if (dark && step > 0) {
                c.globalAlpha = step / NIGHT_STEPS;
                c.drawImage(dark, x, 0);
                c.globalAlpha = 1;
            }
        };
        paint(0);
        if (mirror) {
            c.save();
            c.translate(made.width, 0);
            c.scale(-1, 1);
            paint(0);
            c.restore();
        }
        // Only the newest step of each is kept
        for (const old of mixed.keys()) {
            if (old.startsWith(art.day + '|') && old.endsWith('|' + (mirror ? 1 : 0))) {
                mixed.delete(old);
            }
        }
        mixed.set(key, made);
        return made;
    }

    // A picture with others stacked on top of it, all as wide as it
    const stacks = new Map();
    function stacked(art) {
        if (stacks.has(art.day)) {
            return stacks.get(art.day);
        }
        const layers = [...art.above, art.day].map(name => pictures[name]);
        if (!layers.every(ready)) {
            return null;
        }
        const wide = pictures[art.day].naturalWidth;
        const tall = layers.map(image => Math.round(image.naturalHeight * wide / image.naturalWidth));
        const made = document.createElement('canvas');
        made.width = wide;
        made.height = tall.reduce((sum, each) => sum + each, 0);
        const c = made.getContext('2d');
        let y = 0;
        layers.forEach((image, i) => {
            c.drawImage(image, 0, y, wide, tall[i]);
            y += tall[i];
        });
        stacks.set(art.day, made);
        return made;
    }

    // Colours between two
    function mix(a, b, t) {
        if (t <= 0) {
            return a;
        }
        const pa = parseInt(a.slice(1), 16);
        const pb = parseInt(b.slice(1), 16);
        const channel = shift => Math.round(((pa >> shift) & 255) * (1 - t) + ((pb >> shift) & 255) * t);
        return '#' + ((channel(16) << 16) | (channel(8) << 8) | channel(0)).toString(16).padStart(6, '0');
    }

    function lookFor(key, night) {
        if (key !== 'sakura') {
            return LOOKS[key];
        }
        const day = LOOKS.sakuraDay;
        const dark = LOOKS.sakuraNight;
        const look = {};
        for (const [name, value] of Object.entries(day)) {
            const other = dark[name];
            if (Array.isArray(value)) {
                look[name] = value.map((each, i) => mix(each, other[i], night));
            } else if (typeof value === 'string') {
                look[name] = mix(value, other, night);
            } else if (typeof value === 'number') {
                look[name] = value + (other - value) * night;
            } else {
                look[name] = value;
            }
        }
        return look;
    }

    // How dark Sakura River is: day for the first stretch, night by the end
    function nightOf(track, z) {
        if (track.key !== 'sakura') {
            return track.key === 'city' ? 1 : 0;
        }
        const t = Math.max(0, Math.min(1, (z / track.length - 0.12) / 0.7));
        return t * t * (3 - 2 * t);
    }

    // view: {track, bike (own), others: [{z, x, lean, color, name, braking}], color, braking, turned (the sky's turn this frame)}
    function draw(view) {
        if (canvas.clientWidth !== width || canvas.clientHeight !== height) {
            resize();
        }
        const now = performance.now();
        const seconds = Math.min(0.05, (now - lastDraw) / 1000);
        lastDraw = now;
        const {track, bike} = view;
        const night = nightOf(track, bike.z);
        const look = lookFor(track.key, night);
        const upright = height > width;
        const horizon = height * (upright ? 0.3 : 0.38);
        const bikeY = height * 0.86;
        // The road at the bike takes most of the width; the camera's height follows from where the bike is on screen
        const focal = Math.min(width, height * 1.7) * 0.74 * CAMERA_BACK / (2 * Track.ROAD);
        const cameraHeight = (bikeY - horizon) * CAMERA_BACK / focal;
        const cameraZ = bike.z - CAMERA_BACK;
        const cameraY = Track.heightAt(track, bike.z) + cameraHeight;
        const cameraX = bike.x;
        // Bikes are drawn bigger than they are, to be seen well, but the own one no taller than a fifth of the screen
        const bikeScale = Math.min(BIKE_SCALE, height * 0.21 / 1.8 / (focal / CAMERA_BACK));

        skyShift += view.turned;
        drawSky(track, look, night, horizon);

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
        const frame = {track, look, night, horizon, focal, cameraX, cameraY, cameraZ, bikeY, bikeScale, view};

        // Far to near, each a little over the one behind it, so no seams show: first the ground, then the road on it
        for (let i = shown.length - 1; i >= 0; i--) {
            if (shown[i].visible) {
                drawGround(shown[i], look);
            }
        }
        for (let i = shown.length - 1; i >= 0; i--) {
            if (shown[i].visible) {
                drawRoad(shown[i], frame);
            }
        }
        // Lamps mirrored in the wet road: on the nearer road, so not cut off at their own segment like what stands there
        if (look.wet > 0.05) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            for (let i = shown.length - 1; i >= 0; i--) {
                if (shown[i].visible && shown[i].z1 >= 0.6) {
                    drawReflections(shown[i], frame);
                }
            }
            ctx.restore();
        }

        // Walls, things and bikes, far to near; within a segment, what is further to the side first. The own bike among
        // them, so one just behind it is drawn over it.
        const bikesIn = new Map();
        for (const other of [...view.others, {own: true, z: bike.z, x: bike.x}]) {
            const ahead = other.own ? CAMERA_BACK : other.z - cameraZ;
            const n = Math.floor((ahead + into * Track.SEGMENT) / Track.SEGMENT);
            if (ahead > 1 && n < shown.length - 2) {
                if (!bikesIn.has(n)) {
                    bikesIn.set(n, []);
                }
                bikesIn.get(n).push({...other, ahead});
            }
        }
        for (let i = shown.length - 1; i >= 0; i--) {
            const entry = shown[i];
            if (entry.clip <= 0) {
                continue;
            }
            const items = [];
            if (entry.z1 >= 0.6) {
                for (const wall of track.walls) {
                    items.push({far: Math.abs(wall.side * wall.x + entry.roadX - cameraX) + 0.01, paint: () => drawWall(entry, wall, frame)});
                }
                for (const thing of entry.segment.things) {
                    const far = thing.kind === 'overpass' || thing.kind === 'start' || thing.kind === 'goal'
                        ? -1 : Math.abs(thing.x + entry.roadX - cameraX);
                    items.push({far, paint: () => drawThing(thing, entry, frame)});
                }
            }
            for (const other of bikesIn.get(entry.n) || []) {
                items.push({far: Math.abs(other.x - cameraX) - 0.5, paint: () => drawRider(other, entry, frame)});
            }
            if (!items.length) {
                continue;
            }
            items.sort((a, b) => b.far - a.far);
            const hidden = entry.clip < height;
            if (hidden) {
                ctx.save();
                ctx.beginPath();
                ctx.rect(0, 0, width, entry.clip);
                ctx.clip();
            }
            for (const item of items) {
                item.paint();
            }
            if (hidden) {
                ctx.restore();
            }
        }
        drawPetals(look, bike.speed, seconds);
    }

    // --- The far view ---

    function drawSky(track, look, night, horizon) {
        const sky = SKIES[track.key];
        const image = picture(sky, night, false);
        if (look.right === null) {
            // Below the far view, where the road has a drop beside it: the valley, darker downwards, with a town's lights
            const valley = ctx.createLinearGradient(0, horizon, 0, height);
            valley.addColorStop(0, look.valley[0]);
            valley.addColorStop(1, look.valley[1]);
            ctx.fillStyle = valley;
            ctx.fillRect(0, 0, width, height);
        }
        if (!image) {
            ctx.fillStyle = look.fog;
            ctx.fillRect(0, 0, width, horizon + 2);
            return;
        }
        // Tall enough to reach the top, and one picture at least half the screen wide; turns with the road
        const scale = Math.max(horizon / sky.horizonRow, width * 0.55 / (image.width / 2));
        const tile = image.width * scale;
        const top = horizon - sky.horizonRow * scale;
        if (top > 0) {
            ctx.fillStyle = topColor(sky, image, night);
            ctx.fillRect(0, 0, width, top + 1);
        }
        let x = -(((skyShift * 0.9 * width) % tile) + tile) % tile;
        for (; x < width; x += tile) {
            ctx.drawImage(image, x, top, tile + 0.5, image.height * scale);
        }
        if (look.right === null) {
            // The picture's foot fades into the valley, so its edge doesn't show
            const bottom = top + image.height * scale;
            const fade = ctx.createLinearGradient(0, bottom - 40 * scale, 0, bottom);
            fade.addColorStop(0, 'rgba(58,51,72,0)');
            fade.addColorStop(1, look.valley[0]);
            ctx.fillStyle = fade;
            ctx.fillRect(0, bottom - 40 * scale, width, 40 * scale + 1);
            drawTownLights(horizon, bottom);
        }
    }

    // Little warm lights scattered over the valley; they turn with the far view
    let town = null;
    function drawTownLights(horizon, from) {
        if (!town) {
            town = [];
            let seed = 7;
            const next = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
            for (let i = 0; i < 260; i++) {
                town.push({x: next(), y: next() ** 1.7, size: 0.5 + next() * 1.2, warm: next() < 0.8});
            }
        }
        const span = width * 2.2;
        const shift = ((skyShift * 0.9 * width * 1.15) % span + span) % span;
        for (const dot of town) {
            const x = (dot.x * span - shift + span) % span;
            if (x > width) {
                continue;
            }
            const y = from - 30 + dot.y * (height - from) * 0.6;
            ctx.fillStyle = dot.warm ? '#ffcf86' : '#e9e4ff';
            ctx.fillRect(x, y, dot.size, dot.size);
        }
    }

    const topColors = new Map();
    function topColor(sky, image, night) {
        const key = sky.day + Math.round(night * NIGHT_STEPS);
        if (!topColors.has(key)) {
            const probe = document.createElement('canvas');
            probe.width = probe.height = 1;
            const c = probe.getContext('2d');
            c.drawImage(image, 0, 0, image.width, 2, 0, 0, 1, 1);
            const [r, g, b] = c.getImageData(0, 0, 1, 1).data;
            topColors.set(key, `rgb(${r},${g},${b})`);
        }
        return topColors.get(key);
    }

    // --- The ground and the road ---

    const haze = n => Math.min(1, Math.max(0, (n - 60) / (DRAW_SEGMENTS - 60)) ** 1.5);

    // A segment's near edge, cut where a nearer hill hides it
    function nearEdge(entry) {
        let {x1, y1, scale1} = entry;
        const {x2, y2, scale2, clip} = entry;
        if (y1 > clip) {
            const t = (clip - y2) / (y1 - y2);
            x1 = x2 + (x1 - x2) * t;
            scale1 = scale2 + (scale1 - scale2) * t;
            y1 = clip;
        }
        return {x1, y1, scale1};
    }

    // A strip along the road, from one distance across it to another (m from the middle)
    function strip(entry, edge, from, to, color) {
        const {x2, scale2} = entry;
        const y2 = entry.y2 - 0.7;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(edge.x1 + from * edge.scale1, edge.y1);
        ctx.lineTo(x2 + from * scale2, y2);
        ctx.lineTo(x2 + to * scale2, y2);
        ctx.lineTo(edge.x1 + to * edge.scale1, edge.y1);
        ctx.closePath();
        ctx.fill();
    }

    function drawGround(entry, look) {
        const edge = nearEdge(entry);
        const fade = haze(entry.n);
        const y2 = entry.y2 - 0.7;
        const side = (color, toRight) => {
            ctx.fillStyle = mix(color, look.fog, fade);
            ctx.beginPath();
            ctx.moveTo(edge.x1, edge.y1);
            ctx.lineTo(entry.x2, y2);
            ctx.lineTo(toRight ? width + 2 : -2, y2);
            ctx.lineTo(toRight ? width + 2 : -2, edge.y1);
            ctx.closePath();
            ctx.fill();
        };
        const stripe = Math.floor(entry.segment.index / 3) % 2;
        side(look.left[stripe], false);
        if (look.right) {
            side(look.right[stripe], true);
        }
    }

    function drawRoad(entry, frame) {
        const {track, look} = frame;
        const {segment, n} = entry;
        const edge = nearEdge(entry);
        const fade = haze(n);
        const R = Track.ROAD;
        const stripe = Math.floor(segment.index / 3) % 2;
        strip(entry, edge, -R - track.kerb[0], -R, mix(look.kerb, look.fog, fade));
        strip(entry, edge, R, R + track.kerb[1], mix(look.kerb, look.fog, fade));
        strip(entry, edge, -R, R, mix(look.road[stripe], look.fog, fade));
        const line = mix(look.line, look.fog, fade);
        strip(entry, edge, -R + 0.12, -R + 0.27, line);
        strip(entry, edge, R - 0.27, R - 0.12, line);
        const gate = segment.index - Track.RUN_UP;
        const goal = track.length / Track.SEGMENT;
        if (gate === 0 || gate === 1 || gate === goal || gate === goal + 1) {
            drawChecks(entry, edge, segment.index);
        } else if (!look.dashed) {
            strip(entry, edge, -0.12, 0.12, mix(look.center, look.fog, fade));
        } else if (segment.index % 4 < 2) {
            strip(entry, edge, -0.08, 0.08, mix(look.center, look.fog, fade));
        }
        if (n < 45) {
            drawRoadPetals(entry, edge, look);
        }
    }

    function drawChecks(entry, edge, index) {
        const squares = 10;
        for (let i = 0; i < squares; i++) {
            const a = -Track.ROAD + (2 * Track.ROAD * i) / squares;
            strip(entry, edge, a, a + (2 * Track.ROAD) / squares, (i + index) % 2 ? '#f2f2f2' : '#22242a');
        }
    }

    // Petals lying on the road and kerbs, the same on every phone
    function drawRoadPetals(entry, edge, look) {
        let seed = entry.segment.index * 2654435761;
        const next = () => {
            seed = (seed ^ (seed >>> 13)) * 1274126177;
            seed ^= seed >>> 16;
            return ((seed >>> 0) % 10000) / 10000;
        };
        ctx.fillStyle = look.petal;
        const count = 3 + Math.floor(next() * 4);
        for (let i = 0; i < count; i++) {
            const along = next();
            const across = (next() * 2 - 1) * (Track.ROAD + 0.8);
            const edgeBias = next() < 0.5 ? Math.sign(across) * Track.ROAD * 0.35 : 0; // more by the kerbs
            const scale = edge.scale1 + (entry.scale2 - edge.scale1) * along;
            const y = edge.y1 + (entry.y2 - edge.y1) * along;
            const x = edge.x1 + (entry.x2 - edge.x1) * along + (across * 0.8 + edgeBias) * scale;
            const size = 0.07 * scale;
            if (size > 0.4) {
                ctx.beginPath();
                ctx.ellipse(x, y, size * 1.4, size * 0.6, next() * 3, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    // --- Walls ---

    // Where a point beside the road is on screen: f, how far along the segment (0 to 1); across, m from the middle; up, m
    function at(entry, frame, f, across, up) {
        const z = Math.max(0.5, entry.z1 + f * Track.SEGMENT);
        const scale = frame.focal / z;
        const segment = entry.segment;
        const ground = segment.y1 + (segment.y2 - segment.y1) * f;
        return {
            x: width / 2 + (entry.roadX + entry.roadDx * f + across - frame.cameraX) * scale,
            y: frame.horizon - (ground + up - frame.cameraY) * scale,
            scale
        };
    }

    function drawWall(entry, wall, frame) {
        const across = wall.side * wall.x;
        const base = wall.base || 0;
        const art = WALL_ART[wall.look];
        if (art) {
            texturedWall(entry, frame, across, base, wall.height, art);
            return;
        }
        const near = at(entry, frame, 0, across, 0);
        const far = at(entry, frame, 1, across, 0);
        if (Math.max(near.x, far.x) < -20 || Math.min(near.x, far.x) > width + 20) {
            return;
        }
        const {look} = frame;
        const index = entry.segment.index;
        // A band of the wall's face between two heights
        const band = (from, to, color) => {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.moveTo(near.x, near.y - from * near.scale);
            ctx.lineTo(far.x, far.y - from * far.scale);
            ctx.lineTo(far.x, far.y - to * far.scale);
            ctx.lineTo(near.x, near.y - to * near.scale);
            ctx.closePath();
            ctx.fill();
        };
        const post = (f, from, to, thick, color) => {
            const p = f === 0 ? near : at(entry, frame, f, across, 0);
            const w = Math.max(1, thick * p.scale);
            ctx.fillStyle = color;
            ctx.fillRect(p.x - w / 2, p.y - to * p.scale, w, (to - from) * p.scale);
        };
        switch (wall.look) {
            case 'barrier': // red and white concrete blocks, as in the city picture
                band(0, wall.height, index % 2 ? '#d93a3a' : '#e9e5e2');
                band(wall.height - 0.08, wall.height, index % 2 ? '#ea6a63' : '#ffffff');
                band(0, 0.08, '#5a5560');
                break;
            case 'guardrail': // a steel beam on posts, catching the sunset
                post(0, 0, wall.height, 0.14, look.pole);
                post(0.5, 0, wall.height, 0.14, look.pole);
                band(0.4, 0.8, look.fence);
                band(0.66, 0.74, '#f4e9ee');
                band(0.4, 0.46, '#6f6a78');
                break;
            case 'fence': // the river railing: posts, rails and thin bars
                post(0, 0, wall.height, 0.12, look.fence);
                if (near.scale > 10) {
                    for (let f = 0.125; f < 1; f += 0.125) {
                        post(f, 0.12, wall.height - 0.08, 0.035, look.fence);
                    }
                }
                band(wall.height - 0.08, wall.height, look.fence);
                band(0.7, 0.75, look.fence);
                band(0.1, 0.16, look.fence);
                break;
            case 'railing': // the pavement's railing in the city
                if (index % 2 === 0) {
                    post(0, 0, wall.height, 0.1, look.fence);
                }
                band(wall.height - 0.07, wall.height, look.fence);
                band(wall.height - 0.05, wall.height - 0.03, '#6e6578');
                band(0.45, 0.5, look.fence);
                break;
            default:
        }
    }

    // A wall from a picture: the picture repeats along the road, cut in columns so it follows the perspective. Each column
    // is slanted to follow the wall's foot and top, so a wall seen nearly edge-on stays one band.
    function texturedWall(entry, frame, across, base, tall, art) {
        const image = picture(art, frame.night, art.mirror);
        if (!image) {
            return;
        }
        const near = at(entry, frame, 0, across, base);
        const far = at(entry, frame, 1, across, base);
        if (Math.max(near.x, far.x) < -2 || Math.min(near.x, far.x) > width + 2 || near.scale * tall < 0.5) {
            return;
        }
        const each = (image.height ? image.width / image.height : 1) * tall; // m of road one repeat covers
        // Enough columns that the wall's height changes by at most about 3 pixels from one to the next
        const columns = Math.max(1, Math.min(120, Math.ceil(Math.max(tall * Math.abs(near.scale - far.scale) / 3,
            Math.abs(near.x - far.x) / 12))));
        const start = (entry.segment.index - Track.RUN_UP) * Track.SEGMENT;
        let from = near;
        for (let i = 0; i < columns; i++) {
            const f1 = (i + 1) / columns;
            const to = i + 1 === columns ? far : at(entry, frame, f1, across, base);
            // Where in the picture, also before the start line (below 0)
            const u0 = (((start + (i / columns) * Track.SEGMENT) / each) % 1 + 1) % 1;
            let u1 = (((start + f1 * Track.SEGMENT) / each) % 1 + 1) % 1;
            u1 = u1 <= u0 ? 1 : u1;
            // From the near edge's top to the far edge's top, the column's height down from there
            const fromTop = from.y - tall * from.scale;
            const toTop = to.y - tall * to.scale;
            const high = tall * (from.scale + to.scale) / 2;
            const grow = Math.sign(to.x - from.x) * 0.6; // a little over the next column, so no seam shows
            ctx.setTransform(pixelRatio * (to.x - from.x + grow), pixelRatio * (toTop - fromTop), 0, pixelRatio * high,
                pixelRatio * from.x, pixelRatio * fromTop);
            ctx.drawImage(image, u0 * image.width, 0, Math.max(1, (u1 - u0) * image.width), image.height, 0, 0, 1, 1);
            from = to;
        }
        ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    }

    // --- Things beside the road ---

    function drawThing(thing, entry, frame) {
        const p = at(entry, frame, 0, thing.x, thing.base);
        const {look, night} = frame;
        const size = thing.size * p.scale;
        if (size < 0.4 || p.x < -size * 12 || p.x > width + size * 12) {
            return;
        }
        const flip = thing.x > 0; // trees lean over the road: those on the right are mirrored
        const tree = TREES[thing.kind];
        if (tree) {
            const which = Math.floor(thing.look * tree.pictures.length);
            const image = picture(tree.pictures[which], night, false);
            if (image) {
                const h = tree.height * size;
                const w = h * image.width / image.height;
                const foot = tree.foot[which];
                drawImage(image, p.x - (flip ? 1 - foot : foot) * w, p.y - h, w, h, flip);
            }
            return;
        }
        switch (thing.kind) {
            case 'lamp': { // Sakura's lantern lamps on black posts
                const top = p.y - 4.3 * size;
                ctx.fillStyle = look.pole;
                ctx.fillRect(p.x - 0.07 * size, top, 0.14 * size, 4.3 * size);
                ctx.fillRect(p.x - 0.24 * size, top - 0.08 * size, 0.48 * size, 0.1 * size);
                ctx.fillStyle = mix('#e8e4da', '#ffe0a0', night);
                ctx.fillRect(p.x - 0.17 * size, top - 0.62 * size, 0.34 * size, 0.54 * size);
                ctx.fillStyle = look.pole;
                ctx.fillRect(p.x - 0.26 * size, top - 0.72 * size, 0.52 * size, 0.12 * size);
                light(p, top - 0.35 * size, 4.6, 1.8, size, look.lights * 0.9);
                break;
            }
            case 'lantern': { // the river's glowing posts, from the picture
                const image = picture({day: 'sakura-lantern-day', night: 'sakura-lantern-night'}, night, false);
                if (image) {
                    const h = 1.05 * size;
                    ctx.drawImage(image, p.x - h * 0.26, p.y - h, h * 0.52, h);
                }
                light(p, p.y - 0.6 * size, 0.6, 0.9, size, look.lights * 0.8);
                break;
            }
            case 'streetlamp': { // the city's lamps, leaning over the road
                const toward = thing.x < 0 ? 1 : -1;
                const top = p.y - 7 * size;
                ctx.fillStyle = look.pole;
                ctx.fillRect(p.x - 0.09 * size, top, 0.18 * size, 7 * size);
                ctx.strokeStyle = look.pole;
                ctx.lineWidth = Math.max(1, 0.12 * size);
                ctx.beginPath();
                ctx.moveTo(p.x, top + 0.2 * size);
                ctx.quadraticCurveTo(p.x, top - 0.3 * size, p.x + toward * 1.7 * size, top - 0.2 * size);
                ctx.stroke();
                const head = {x: p.x + toward * 1.9 * size, y: p.y, scale: p.scale};
                ctx.fillStyle = '#ffe7b5';
                ctx.beginPath();
                ctx.ellipse(head.x, top - 0.12 * size, 0.42 * size, 0.12 * size, 0, 0, Math.PI * 2);
                ctx.fill();
                light(head, top - 0.1 * size, 7, 4, size, look.lights);
                break;
            }
            case 'raillight': { // little lamps on the guardrail
                ctx.fillStyle = '#ffd38a';
                ctx.fillRect(p.x - 0.1 * size, p.y - 0.95 * size, 0.2 * size, 0.14 * size);
                light(p, p.y - 0.88 * size, 0.9, 1, size, look.lights);
                break;
            }
            case 'chevron-red':
            case 'chevron-yellow': { // which way the bend goes, on the wall at its outside
                const red = thing.kind === 'chevron-red';
                const image = pictures[thing.kind];
                if (!ready(image)) {
                    return;
                }
                const w = (red ? 1.3 : 1.7) * size;
                const h = w * image.height / image.width;
                const lift = (red && thing.x < 0 ? 1.7 : 0.75) * size;
                ctx.fillStyle = look.pole;
                ctx.fillRect(p.x - w * 0.3, p.y - lift, Math.max(1, 0.06 * size), lift);
                ctx.fillRect(p.x + w * 0.27, p.y - lift, Math.max(1, 0.06 * size), lift);
                drawImage(image, p.x - w / 2, p.y - lift - h, w, h, !thing.right);
                break;
            }
            case 'overpass': { // a road over the street, on two pillars
                const image = pictures['city-overpass'];
                const w = 30 * size;
                const h = ready(image) ? w * image.height / image.width : 5 * size;
                const under = 6.6 * size;
                ctx.fillStyle = '#3d3946';
                for (const side of [-1, 1]) {
                    const pillar = width / 2 + (entry.roadX + side * (Track.ROAD + 2.6) - frame.cameraX) * p.scale;
                    ctx.fillRect(pillar - 0.6 * size, p.y - under, 1.2 * size, under);
                }
                const middle = width / 2 + (entry.roadX - frame.cameraX) * p.scale;
                if (ready(image)) {
                    ctx.drawImage(image, middle - w / 2, p.y - under - h, w, h);
                }
                break;
            }
            case 'start':
            case 'goal':
                drawGate(thing.kind === 'start' ? 'START' : 'GOAL', entry, p, size, frame);
                break;
            default:
        }
    }

    function drawImage(image, x, y, w, h, flip) {
        if (flip) {
            ctx.save();
            ctx.translate(x + w, y);
            ctx.scale(-1, 1);
            ctx.drawImage(image, 0, 0, w, h);
            ctx.restore();
        } else {
            ctx.drawImage(image, x, y, w, h);
        }
    }

    // A banner across the road on two posts
    function drawGate(text, entry, p, size, frame) {
        const middle = width / 2 + (entry.roadX - frame.cameraX) * p.scale;
        const half = (Track.ROAD + 0.5) * size;
        ctx.fillStyle = '#2b2b33';
        ctx.fillRect(middle - half - 0.15 * size, p.y - 5.6 * size, 0.3 * size, 5.6 * size);
        ctx.fillRect(middle + half - 0.15 * size, p.y - 5.6 * size, 0.3 * size, 5.6 * size);
        const top = p.y - 5.8 * size;
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

    // A lamp's glow, and its streak on the wet road below it (as in the pictures)
    const WARM = 'rgba(255,206,140,1)';
    const glows = new Map();
    function glow(color) {
        if (!glows.has(color)) {
            const made = document.createElement('canvas');
            made.width = made.height = 64;
            const c = made.getContext('2d');
            const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
            g.addColorStop(0, color);
            g.addColorStop(0.25, color.replace('1)', '0.45)'));
            g.addColorStop(1, color.replace('1)', '0)'));
            c.fillStyle = g;
            c.fillRect(0, 0, 64, 64);
            const streak = document.createElement('canvas');
            streak.width = 16;
            streak.height = 128;
            const s = streak.getContext('2d');
            const v = s.createLinearGradient(0, 0, 0, 128);
            v.addColorStop(0, color.replace('1)', '0.55)'));
            v.addColorStop(1, color.replace('1)', '0)'));
            const across = s.createLinearGradient(0, 0, 16, 0);
            s.fillStyle = v;
            s.fillRect(0, 0, 16, 128);
            s.globalCompositeOperation = 'destination-in';
            across.addColorStop(0, 'rgba(0,0,0,0)');
            across.addColorStop(0.5, 'rgba(0,0,0,1)');
            across.addColorStop(1, 'rgba(0,0,0,0)');
            s.fillStyle = across;
            s.fillRect(0, 0, 16, 128);
            glows.set(color, {glow: made, streak});
        }
        return glows.get(color);
    }

    function light(foot, y, high, reach, size, strength) {
        if (strength < 0.05 || size < 0.6) {
            return;
        }
        const {glow: halo} = glow(WARM);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = Math.min(1, strength);
        const r = reach * size;
        ctx.drawImage(halo, foot.x - r, y - r, r * 2, r * 2);
        ctx.restore();
    }

    // What shines, and how high: mirrored in the road as far below its foot as it is above it
    const SHINES = {lamp: {high: 4.6, width: 0.6}, lantern: {high: 0.7, width: 0.5}, streetlamp: {high: 7, width: 0.9, reach: 1.9},
        raillight: {high: 0.9, width: 0.35}};

    function drawReflections(entry, frame) {
        const {look} = frame;
        for (const thing of entry.segment.things) {
            const shine = SHINES[thing.kind];
            if (!shine) {
                continue;
            }
            const p = at(entry, frame, 0, thing.x, 0);
            const size = thing.size * p.scale;
            if (size < 0.6) {
                continue;
            }
            const x = p.x + (shine.reach ? (thing.x < 0 ? 1 : -1) * shine.reach * size : 0);
            streak(WARM, x, p.y, shine.width * size, shine.high * size * 1.3, look.lights * look.wet);
        }
        // The shop signs' colours on the wet pavement, at the foot of the shops
        if (look.neon && entry.segment.index % 2 === 0) {
            const shops = frame.track.walls.find(wall => wall.look === 'shops');
            if (shops) {
                const p = at(entry, frame, 0.5, shops.side * shops.x, 0);
                const color = look.neon[Math.floor(entry.segment.index / 2) % look.neon.length];
                streak(color, p.x, p.y, 1.6 * p.scale, 5 * p.scale, look.wet * 0.8);
            }
        }
    }

    function streak(color, x, y, w, long, strength) {
        if (strength < 0.05 || w < 1) {
            return;
        }
        ctx.globalAlpha = Math.min(1, strength);
        ctx.drawImage(glow(color).streak, x - w / 2, y, w, long);
    }

    // --- Riders ---

    function drawRider(other, entry, frame) {
        const {view, bikeY, bikeScale, focal} = frame;
        if (other.own) {
            const bike = view.bike;
            drawBike(width / 2, bikeY, focal / CAMERA_BACK * bikeScale, RIDER_COLORS[view.color], bike.steer * 0.42, view.braking,
                null, frame.look.lights);
            return;
        }
        const t = Math.max(0, Math.min(1, (other.ahead - entry.z1) / Track.SEGMENT));
        const p = at(entry, frame, t, other.x, 0);
        drawBike(p.x, p.y, p.scale * bikeScale, other.color, other.lean, other.braking, other.name, frame.look.lights);
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

    // --- Petals in the air: they drift down and past, faster the faster the bike goes ---

    function drawPetals(look, speed, seconds) {
        const wanted = Math.round(Math.min(40, width * height / 9000));
        while (petals.length < wanted) {
            petals.push(newPetal(true));
        }
        ctx.fillStyle = look.petal;
        for (const petal of petals) {
            const out = (petal.x - width / 2) / width;
            petal.x += (petal.drift + out * speed * 9) * seconds;
            petal.y += (petal.fall + speed * 2.2 * petal.near) * seconds;
            petal.turn += petal.spin * seconds;
            if (petal.y > height + 10 || petal.x < -10 || petal.x > width + 10) {
                Object.assign(petal, newPetal(false));
            }
            const size = petal.size * (0.6 + petal.near);
            ctx.beginPath();
            ctx.ellipse(petal.x, petal.y, size, size * 0.55 * Math.abs(Math.cos(petal.turn)) + 0.6, petal.turn * 0.4, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function newPetal(anywhere) {
        return {
            x: Math.random() * width,
            y: anywhere ? Math.random() * height : -10 - Math.random() * height * 0.3,
            drift: (Math.random() - 0.6) * 30,
            fall: 18 + Math.random() * 30,
            near: Math.random(),
            size: 2 + Math.random() * 2.5,
            turn: Math.random() * 6,
            spin: (Math.random() - 0.5) * 5
        };
    }

    return {setUp, resize, draw, RIDER_COLORS};
})();
