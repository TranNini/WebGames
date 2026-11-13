// Mission: Meow's look. She comes from the user's sprite sheet (frames.js); the kittens and what is in her way are cut from their picture, at its own
// scale. All in mission/art, upscaled three times. The lab behind them is drawn here, as the user preferred it.
// A world is 100 units high; the rules are in mission.js.
const Scene = (() => {
    const FLOOR = 84; // in units from the top, as in mission.js
    const UNIT = 100 / 887; // units per pixel of the picture
    const BACK_WIDTH = 240; // the walls repeat after this many units
    const MID_WIDTH = 170;
    const FLOOR_WIDTH = 120;
    const BACK_SPEED = 0.25; // what is further away moves slower
    const MID_SPEED = 0.55;
    const SHARPEST_BACK = 14; // pixels per unit: the far walls need no more
    const SPIKE_SCALE = 1.7;
    const BIG_STAR_SCALE = 2.1;
    const FRAME_SCALE = 0.18; // units for a pixel of the sprite sheet
    const HURT_FRAME_MS = 130;
    const SIZES = {
        'block-top': [431, 44], 'block-body': [418, 96], 'tube-empty-orange': [178, 239], 'tube-empty-grey': [179, 224], 'kitten-orange': [76, 88], 'kitten-grey': [77, 78], 'slab-long': [300, 72], 'emitter-top': [116, 98], 'emitter-bottom': [77, 59], 'emitter-hang': [83, 60], 'rail-left': [68, 73], 'rail-right': [72, 73],
        column: [76, 195], spike: [48, 54], star: [60, 58], sparkle: [42, 46]
    };
    const KITTEN_IN_TUBE = {orange: [53, 116], grey: [53, 114]};
    const ALL_FRAMES = Object.values(FRAMES).flat();
    // From the user's warning sheet: a drone in 10 frames, flying and with its alarm on, and the signs an alert shows
    const DRONE_FRAMES = 10;
    const DRONE_SCALE = 0.12; // units for a pixel of the sheet
    const DRONE_SIZES = {drone: [130, 96], 'drone-alert': [130, 110]};
    const SHOOTER_SCALE = 1.25; // the one that shoots is a bit bigger than the others
    const DRONE_NAMES = Object.keys(DRONE_SIZES).flatMap(kind => Array.from({length: DRONE_FRAMES}, (_, frame) => kind + '-' + frame));
    const SIGNS = Array.from({length: 6}, (_, frame) => ['alert-screen-' + frame, 'alert-banner-' + frame]).flat();
    const SCREEN_SIZE = {width: 33, height: 20.8};
    const BANNER_SIZE = {width: 54, height: 10.8};
    const SIGNS_Y = 26; // below what is on top of the screen
    // From the user's obstacle sheet, in units
    const PIECES = {
        wheel: [30, 29.4], 'saw-base': [34, 4], 'mace-head': [18, 18.3], 'mace-cap': [10, 4.2], 'mace-rod': [3.4, 46], cross: [26, 25.5], fan: [20, 18.3], press: [28, 17.4], 'press-rod': [5, 40],
        'pylon-left': [7.7, 14], 'pylon-right': [8, 14], 'tesla-top': [8, 3.6], 'tesla-bottom': [8, 3.6], coil: [18, 15.9], shock: [28, 3.9], acid: [34, 6.75], burners: [30, 5.9], flame: [5.5, 12.4],
        icicles: [44, 20.9], 'ice-spikes': [34, 12.1], 'ice-wall': [50, 16], 'spike-slab': [36, 13], lift: [32, 7]
    };
    // The light of each area, over the walls and floor
    const AREA_LIGHT = {lab: null, machines: [255, 150, 50, 0.1], power: [70, 100, 255, 0.16], furnace: [255, 70, 20, 0.17], freezer: [130, 215, 255, 0.2]};
    const FILES = [...Object.keys(SIZES), ...ALL_FRAMES.map(frame => frame.file), ...DRONE_NAMES, ...SIGNS, ...Object.keys(PIECES).map(name => 'ob-' + name)];
    const images = {};
    let scaled = {};
    let unit = 1;
    let viewWidth = 100;
    let back = null;
    let mid = null;
    let floor = null;

    function newCanvas(width, height) {
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(width);
        canvas.height = Math.ceil(height);
        return canvas;
    }

    function oval(ctx, x, y, radiusX, radiusY, color) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(x, y, radiusX, radiusY, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    function limb(ctx, points, thickness, color) {
        ctx.strokeStyle = color;
        ctx.lineWidth = thickness;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(points[0], points[1]);
        for (let i = 2; i < points.length; i += 2) {
            ctx.lineTo(points[i], points[i + 1]);
        }
        ctx.stroke();
    }

    function box(ctx, x, y, width, height, corner, color) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.roundRect(x, y, width, height, corner);
        ctx.fill();
    }

    function polygon(ctx, color, ...points) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(points[0], points[1]);
        for (let i = 2; i < points.length; i += 2) {
            ctx.lineTo(points[i], points[i + 1]);
        }
        ctx.closePath();
        ctx.fill();
    }

    function stripes(ctx, x, y, width, height) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, width, height);
        ctx.clip();
        ctx.fillStyle = '#2a2228';
        ctx.fillRect(x, y, width, height);
        for (let at = x - height; at < x + width; at += height * 2) {
            polygon(ctx, '#c98a2e', at, y + height, at + height, y + height, at + height * 2, y, at + height, y);
        }
        ctx.restore();
    }

    function neon(ctx, x, y, width, height) {
        box(ctx, x - 0.8, y - 0.8, width + 1.6, height + 1.6, 1.2, 'rgba(255, 90, 140, 0.25)');
        box(ctx, x, y, width, height, Math.min(width, height) / 2, '#ff8fb5');
    }

    function paintWindow(ctx, left, top, width, height, paintView) {
        const cut = Math.min(width, height) * 0.16;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(left + cut, top);
        ctx.lineTo(left + width - cut, top);
        ctx.lineTo(left + width, top + cut);
        ctx.lineTo(left + width, top + height - cut);
        ctx.lineTo(left + width - cut, top + height);
        ctx.lineTo(left + cut, top + height);
        ctx.lineTo(left, top + height - cut);
        ctx.lineTo(left, top + cut);
        ctx.closePath();
        ctx.save();
        ctx.clip();
        const sky = ctx.createLinearGradient(0, top, 0, top + height);
        sky.addColorStop(0, '#6d3560');
        sky.addColorStop(0.6, '#c35a8c');
        sky.addColorStop(1, '#e27aa2');
        ctx.fillStyle = sky;
        ctx.fillRect(left, top, width, height);
        oval(ctx, left + width * 0.25, top + height * 0.3, width * 0.22, 1.2, 'rgba(255, 190, 215, 0.35)');
        oval(ctx, left + width * 0.65, top + height * 0.45, width * 0.25, 1.4, 'rgba(255, 190, 215, 0.3)');
        paintView();
        ctx.restore();
        ctx.lineWidth = 1.6;
        ctx.strokeStyle = '#1e1720';
        ctx.stroke();
        ctx.restore();
    }

    function paintDish(ctx, x, y, size) {
        const color = '#48283f';
        limb(ctx, [x, y, x - size * 0.3, y + size], size * 0.09, color);
        limb(ctx, [x, y, x + size * 0.3, y + size], size * 0.09, color);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(x, y - size * 0.1, size * 0.75, size * 0.34, -0.5, 0, Math.PI);
        ctx.closePath();
        ctx.fill();
    }

    function paintCatFace(ctx, x, y, size, color) {
        ctx.strokeStyle = color;
        ctx.lineWidth = size * 0.09;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(x - size, y + size * 0.1);
        ctx.lineTo(x - size * 0.92, y - size * 0.92);
        ctx.lineTo(x - size * 0.35, y - size * 0.55);
        ctx.quadraticCurveTo(x, y - size * 0.68, x + size * 0.35, y - size * 0.55);
        ctx.lineTo(x + size * 0.92, y - size * 0.92);
        ctx.lineTo(x + size, y + size * 0.1);
        ctx.quadraticCurveTo(x + size, y + size * 0.85, x, y + size * 0.85);
        ctx.quadraticCurveTo(x - size, y + size * 0.85, x - size, y + size * 0.1);
        ctx.stroke();
        oval(ctx, x - size * 0.42, y + size * 0.1, size * 0.09, size * 0.12, color);
        oval(ctx, x + size * 0.42, y + size * 0.1, size * 0.09, size * 0.12, color);
        oval(ctx, x, y + size * 0.3, size * 0.07, size * 0.05, color);
    }

    // The far walls: dark panels, pipes, a banner and windows to a pink evening
    function paintBack(backUnit) {
        const tile = newCanvas(BACK_WIDTH * backUnit, 100 * backUnit);
        const ctx = tile.getContext('2d');
        ctx.scale(backUnit, backUnit);
        const wall = ctx.createLinearGradient(0, 0, 0, 100);
        wall.addColorStop(0, '#2a2230');
        wall.addColorStop(1, '#3c2c3e');
        ctx.fillStyle = wall;
        ctx.fillRect(0, 0, BACK_WIDTH, 100);
        ctx.strokeStyle = 'rgba(15, 10, 18, 0.55)';
        ctx.lineWidth = 0.5;
        for (let x = 0; x < BACK_WIDTH; x += 30) {
            for (let y = (x / 30) % 2 ? 6 : -10; y < 100; y += 32) {
                ctx.strokeRect(x + 0.6, y + 0.6, 28.8, 30.8);
            }
        }
        paintWindow(ctx, 18, 16, 48, 32, () => {
            paintDish(ctx, 44, 32, 13);
            polygon(ctx, '#48283f', 18, 48, 18, 43, 34, 41, 66, 44, 66, 48);
        });
        limb(ctx, [42, 16, 42, 48], 1.3, '#1e1720');
        limb(ctx, [18, 32, 66, 32], 1.3, '#1e1720');
        ctx.fillStyle = '#74365a';
        ctx.beginPath();
        ctx.moveTo(95, 0);
        ctx.lineTo(125, 0);
        ctx.lineTo(125, 26);
        ctx.lineTo(95, 40);
        ctx.closePath();
        ctx.fill();
        paintCatFace(ctx, 110, 14, 8, '#b7608a');
        paintWindow(ctx, 148, 26, 62, 30, () => {
            polygon(ctx, '#48283f', 148, 56, 148, 48, 170, 46, 198, 49, 210, 47, 210, 56);
            paintCatFace(ctx, 176, 44, 2.2, '#48283f');
        });
        limb(ctx, [179, 26, 179, 56], 1.2, '#1e1720');
        limb(ctx, [70, 0, 70, 12, 84, 22, 84, 80], 2.4, '#1c151e');
        limb(ctx, [136, 0, 136, 66], 2, '#1c151e');
        limb(ctx, [220, 100, 220, 40, 232, 30, 232, 0], 2.2, '#1c151e');
        for (const [x, y, w, h] of [[8, 58, 7, 0.9], [80, 40, 1, 5], [128, 62, 7, 0.9], [215, 20, 1, 5], [40, 64, 8, 0.9], [188, 68, 6, 0.9]]) {
            neon(ctx, x, y, w, h);
        }
        return tile;
    }

    // Nearer: pillars and beams, with air between them
    function paintMid(backUnit) {
        const tile = newCanvas(MID_WIDTH * backUnit, 100 * backUnit);
        const ctx = tile.getContext('2d');
        ctx.scale(backUnit, backUnit);
        const dark = '#221a26';
        for (const x of [12, 118]) {
            box(ctx, x, 0, 13, FLOOR, 0.8, dark);
            ctx.strokeStyle = '#322838';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(x + 2, 10, 9, 22);
            ctx.strokeRect(x + 2, 40, 9, 30);
            neon(ctx, x + 5, 34, 3, 0.8);
        }
        box(ctx, 25, 62, 93, 3.4, 0.5, dark);
        stripes(ctx, 62, 65.4, 20, 2);
        box(ctx, 62, 0, 7, 12, 0.8, dark);
        limb(ctx, [25, 70, 45, 62], 1.4, dark);
        limb(ctx, [118, 70, 98, 62], 1.4, dark);
        return tile;
    }

    function paintFloor(floorUnit) {
        const height = 100 - FLOOR;
        const tile = newCanvas(FLOOR_WIDTH * floorUnit, height * floorUnit);
        const ctx = tile.getContext('2d');
        ctx.scale(floorUnit, floorUnit);
        ctx.translate(0, -FLOOR);
        ctx.fillStyle = '#231b27';
        ctx.fillRect(0, FLOOR, FLOOR_WIDTH, height);
        ctx.strokeStyle = '#37293b';
        ctx.lineWidth = 0.4;
        for (let x = 0; x < FLOOR_WIDTH; x += 24) {
            ctx.strokeRect(x + 0.4, FLOOR + 6.5, 23.2, height - 7);
        }
        stripes(ctx, 32, 97.4, 22, 2.6);
        stripes(ctx, 92, 97.4, 16, 2.6);
        let left = 0;
        for (const width of [17, 21, 14, 22, 15, 19, 12]) {
            box(ctx, left + 0.15, FLOOR, width - 0.3, 5.6, 0.8, '#7f7480');
            box(ctx, left + 0.15, FLOOR, width - 0.3, 1.3, 0.6, '#c9afbb');
            limb(ctx, [left + width * 0.3, FLOOR + 2, left + width * 0.36, FLOOR + 4], 0.14, '#5f5560');
            left += width;
        }
        for (const x of [8, 44, 78, 106]) {
            neon(ctx, x, FLOOR + 6.6, 7, 0.8);
        }
        return tile;
    }

    function load(name) {
        return new Promise(resolve => {
            const image = new Image();
            image.onload = () => resolve(image);
            image.onerror = () => resolve(image);
            image.src = '/mission/art/' + name + '.webp';
        }).then(image => {
            images[name] = image;
        });
    }

    const ready = Promise.all(FILES.map(load));

    // A piece at the size it has on this screen, in halving steps, so that it stays sharp and quick to draw
    function sized(image, width, height) {
        let source = image;
        let sourceWidth = image.width;
        let sourceHeight = image.height;
        while (sourceWidth > width * 2 && sourceHeight > height * 2) {
            sourceWidth = Math.ceil(sourceWidth / 2);
            sourceHeight = Math.ceil(sourceHeight / 2);
            const half = newCanvas(sourceWidth, sourceHeight);
            const halfPaint = half.getContext('2d');
            halfPaint.imageSmoothingQuality = 'high';
            halfPaint.drawImage(source, 0, 0, sourceWidth, sourceHeight);
            source = half;
        }
        const result = newCanvas(width, height);
        const resultPaint = result.getContext('2d');
        resultPaint.imageSmoothingQuality = 'high';
        resultPaint.drawImage(source, 0, 0, result.width, result.height);
        return result;
    }

    function fit(width, height) {
        unit = height / 100;
        viewWidth = width / unit;
        const backUnit = Math.min(unit, SHARPEST_BACK);
        back = paintBack(backUnit);
        mid = paintMid(backUnit);
        floor = paintFloor(unit);
        scaled = {};
        const picturePixel = UNIT * unit;
        for (const [name, [pieceWidth, pieceHeight]] of Object.entries(SIZES)) {
            scaled[name] = sized(images[name], pieceWidth * picturePixel, pieceHeight * picturePixel);
        }
        for (const frame of ALL_FRAMES) {
            scaled[frame.file] = sized(images[frame.file], frame.width * FRAME_SCALE * frame.scale * unit, frame.height * FRAME_SCALE * frame.scale * unit);
        }
        for (const name of DRONE_NAMES) {
            const [droneWidth, droneHeight] = DRONE_SIZES[name.startsWith('drone-alert') ? 'drone-alert' : 'drone'];
            scaled[name] = sized(images[name], droneWidth * DRONE_SCALE * unit, droneHeight * DRONE_SCALE * unit);
        }
        for (const name of SIGNS) {
            const size = name.startsWith('alert-screen') ? SCREEN_SIZE : BANNER_SIZE;
            scaled[name] = sized(images[name], size.width * unit, size.height * unit);
        }
        for (const [name, [pieceWidth, pieceHeight]] of Object.entries(PIECES)) {
            scaled['ob-' + name] = sized(images['ob-' + name], pieceWidth * unit, pieceHeight * unit);
        }
        scaled.bigStar = sized(images.star, SIZES.star[0] * picturePixel * BIG_STAR_SCALE, SIZES.star[1] * picturePixel * BIG_STAR_SCALE);
        scaled.bigSpike = sized(images.spike, SIZES.spike[0] * picturePixel * SPIKE_SCALE, SIZES.spike[1] * picturePixel * SPIKE_SCALE);
    }

    // Top left at (x, y) in units
    function sprite(ctx, name, x, y, scale = 1, sizedName = name) {
        const [width, height] = SIZES[name];
        ctx.drawImage(scaled[sizedName], x, y, width * UNIT * scale, height * UNIT * scale);
    }

    // The frame for this moment of a pose. In the air on foot she holds one frame; flying her wings beat all the time.
    function frameOf(pose, step, onFoot) {
        const frames = FRAMES[pose];
        if (pose === 'walk') {
            return frames[Math.floor(step / (Math.PI * 2) * frames.length) % frames.length];
        }
        if (pose === 'fly') {
            return frames[Math.floor(step * 1.6) % frames.length];
        }
        if (pose === 'hover') {
            return frames[Math.floor(step * 0.9) % frames.length];
        }
        return onFoot ? frames[2] : frames[1 + Math.floor(step * 1.2) % (frames.length - 1)];
    }

    // Her body's middle at (x, y)
    function drawGirl(ctx, x, y, view) {
        const {pose, step, hurtAge, girl} = view;
        const frame = hurtAge !== null && hurtAge < HURT_FRAME_MS * FRAMES.hurt.length
            ? FRAMES.hurt[Math.floor(hurtAge / HURT_FRAME_MS)]
            : frameOf(pose, step, !girl.flying);
        const scale = FRAME_SCALE * frame.scale;
        ctx.drawImage(scaled[frame.file], x - frame.x * scale, y - frame.y * scale, frame.width * scale, frame.height * scale);
    }

    function drawBubble(ctx, x, y, left, warnFrom) {
        if (left < warnFrom && Math.floor(left / 130) % 2) {
            return; // it blinks before it goes
        }
        const glow = ctx.createRadialGradient(x, y, 16, x, y, 26);
        glow.addColorStop(0, 'rgba(180, 240, 255, 0.05)');
        glow.addColorStop(0.78, 'rgba(170, 225, 255, 0.28)');
        glow.addColorStop(0.92, 'rgba(235, 250, 255, 0.75)');
        glow.addColorStop(1, 'rgba(200, 240, 255, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x, y, 26, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
        ctx.beginPath();
        ctx.ellipse(x - 12, y - 15, 5, 2.4, -0.7, 0, Math.PI * 2);
        ctx.fill();
    }

    function drawBeam(ctx, x1, y1, x2, y2, time) {
        const pulse = 1 + Math.sin(time * 0.02) * 0.1;
        ctx.lineCap = 'round';
        for (const [width, color] of [[4.2 * pulse, 'rgba(255, 45, 85, 0.16)'], [2.4 * pulse, 'rgba(255, 45, 85, 0.5)'], [1.1, '#fff1f3']]) {
            ctx.strokeStyle = color;
            ctx.lineWidth = width;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        }
    }

    // A solid kitten in an empty glass tube, in the place it has in the picture. It leaps out when she is saved.
    function drawTube(ctx, tube, x, time) {
        const kind = tube.look % 2 ? 'grey' : 'orange';
        const name = 'tube-empty-' + kind;
        const [width, height] = SIZES[name];
        const left = x - width * UNIT / 2;
        const top = (tube.base || FLOOR) + 0.5 - height * UNIT;
        sprite(ctx, name, left, top);
        if (tube.opened >= 1) {
            return;
        }
        const [offsetX, offsetY] = KITTEN_IN_TUBE[kind];
        const leap = tube.saved ? tube.opened : 0;
        const catX = left + offsetX * UNIT - leap * 26;
        const catY = top + offsetY * UNIT - Math.sin(leap * Math.PI) * 26 + leap * 8;
        if (leap > 0.66) {
            ctx.globalAlpha = (1 - leap) * 3;
        }
        sprite(ctx, 'kitten-' + kind, catX, catY);
        ctx.globalAlpha = 1;
    }

    function drawSlabs(ctx, x, totalWidth, top) {
        const count = Math.max(1, Math.round(totalWidth / (SIZES['slab-long'][0] * UNIT)));
        const width = totalWidth / count;
        for (let i = 0; i < count; i++) {
            ctx.drawImage(scaled['slab-long'], x + i * width, top - 0.4, width, SIZES['slab-long'][1] * UNIT);
        }
    }

    // Raised floor, as in the picture: its top and what is under it, to any size
    function drawBlock(ctx, platform, x) {
        ctx.drawImage(scaled['block-body'], x + 0.8, platform.top + 3.6, platform.width - 1.6, FLOOR + 0.5 - platform.top - 3.6);
        ctx.drawImage(scaled['block-top'], x, platform.top - 0.3, platform.width, SIZES['block-top'][1] * UNIT);
    }

    function drawPlatform(ctx, platform, x) {
        if (platform.hidden) {
            return; // the ledge that goes with it is drawn
        }
        if (platform.solid) {
            drawBlock(ctx, platform, x);
            return;
        }
        const count = Math.max(1, Math.round(platform.width / (SIZES['slab-long'][0] * UNIT)));
        const width = platform.width / count;
        const [columnWidth] = SIZES.column;
        for (let i = 0; i < count; i++) {
            ctx.drawImage(scaled.column, x + i * width + width / 2 - columnWidth * UNIT / 2, platform.top + 6, columnWidth * UNIT, FLOOR - platform.top - 6);
        }
        drawSlabs(ctx, x, platform.width, platform.top);
    }

    // Red with a bright head and a fading tail, so that it can't be taken for the neon lights on the wall
    function drawBolt(ctx, bolt) {
        const y = (bolt.top + bolt.bottom) / 2;
        const tail = ctx.createLinearGradient(bolt.left, 0, bolt.right, 0);
        tail.addColorStop(0, 'rgba(255, 30, 60, 0.95)');
        tail.addColorStop(1, 'rgba(255, 30, 60, 0)');
        ctx.lineCap = 'round';
        ctx.strokeStyle = tail;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(bolt.left, y);
        ctx.lineTo(bolt.right, y);
        ctx.stroke();
        ctx.lineWidth = 1.1;
        ctx.strokeStyle = '#ff5a70';
        ctx.beginPath();
        ctx.moveTo(bolt.left, y);
        ctx.lineTo((bolt.left + bolt.right) / 2, y);
        ctx.stroke();
        ctx.fillStyle = '#fff1f3';
        ctx.beginPath();
        ctx.ellipse(bolt.left + 0.6, y, 1.5, 0.9, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    function drawPiece(ctx, name, x, y) {
        const [width, height] = PIECES[name];
        ctx.drawImage(scaled['ob-' + name], x, y, width, height);
    }

    function turned(ctx, name, x, y, angle) {
        const [width, height] = PIECES[name];
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.drawImage(scaled['ob-' + name], -width / 2, -height / 2, width, height);
        ctx.restore();
    }

    // Blue and jagged, a new shape every few moments
    function drawLightning(ctx, x1, y1, x2, y2, time, seed = 0) {
        const parts = Math.max(3, Math.round(Math.hypot(x2 - x1, y2 - y1) / 3));
        const moment = Math.floor(time / 70);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        for (const [width, color] of [[2.6, 'rgba(70, 110, 255, 0.35)'], [1.2, '#7fa2ff'], [0.5, '#f0f5ff']]) {
            ctx.strokeStyle = color;
            ctx.lineWidth = width;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            for (let i = 1; i < parts; i++) {
                const random = Math.sin(i * 12.9 + seed * 7.1 + moment * 78.2) * 43758;
                const off = (random - Math.floor(random) - 0.5) * 2.4;
                const along = i / parts;
                const across = Math.abs(y2 - y1) > Math.abs(x2 - x1);
                ctx.lineTo(x1 + (x2 - x1) * along + (across ? off : 0), y1 + (y2 - y1) * along + (across ? 0 : off));
            }
            ctx.lineTo(x2, y2);
            ctx.stroke();
        }
    }

    function drawPlacedPiece(ctx, thing, box, time) {
        drawPiece(ctx, thing.art, box.left, box.top);
        const {width, height} = thing;
        if (thing.art === 'fan') {
            ctx.save();
            ctx.beginPath();
            ctx.arc(box.left + width * 0.5, box.top + height * 0.5, width * 0.38, 0, Math.PI * 2);
            ctx.clip();
            turned(ctx, 'fan', box.left + width * 0.5, box.top + height * 0.5, box.spin);
            ctx.restore();
        } else if (thing.art === 'shock') {
            for (const along of [0.14, 0.42, 0.68, 0.9]) {
                const random = Math.sin(along * 91 + Math.floor(time / 120) * 3.3) * 91;
                drawLightning(ctx, box.left + width * along, box.top + 0.8, box.left + width * along + (random - Math.floor(random) - 0.5) * 4, box.top - 3.6, time, along * 10);
            }
        } else if (thing.art === 'coil') {
            const ballX = box.left + width * 0.5;
            const ballY = box.top + height * 0.3;
            drawLightning(ctx, ballX, ballY, ballX - 7, ballY + 4 * Math.sin(time * 0.01), time, 1);
            drawLightning(ctx, ballX, ballY, ballX + 7, ballY + 4 * Math.cos(time * 0.012), time, 2);
        } else if (thing.art === 'acid') {
            ctx.fillStyle = '#d6f25a';
            for (const along of [0.26, 0.4, 0.55, 0.7]) {
                const age = (time * 0.0009 + along * 3) % 1;
                ctx.beginPath();
                ctx.arc(box.left + width * along, box.top + height * 0.33 - age * 2.4, 0.5 + age * 0.5, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    function drawThing(ctx, thing, box, time, view) {
        const {kind} = thing;
        const x = box.left;
        const middle = (box.left + box.right) / 2;
        if (kind === 'piece') {
            drawPlacedPiece(ctx, thing, box, time);
        } else if (kind === 'saw') {
            const center = middle;
            ctx.save();
            ctx.beginPath();
            ctx.rect(center - thing.width, 0, thing.width * 2, thing.y + 2);
            ctx.clip();
            turned(ctx, 'wheel', center, thing.y, box.spin);
            ctx.restore();
            drawPiece(ctx, 'saw-base', center - PIECES['saw-base'][0] / 2, thing.y + 5.5 - PIECES['saw-base'][1]);
        } else if (kind === 'spinner') {
            turned(ctx, 'cross', middle, thing.y, box.spin);
        } else if (kind === 'mace') {
            const pivot = thing.screenX;
            const [rodWidth, rodLength] = PIECES['mace-rod'];
            ctx.save();
            ctx.translate(pivot, 0);
            ctx.rotate(-box.swing);
            ctx.drawImage(scaled['ob-mace-rod'], -rodWidth / 2, 0, rodWidth, rodLength);
            ctx.restore();
            drawPiece(ctx, 'mace-cap', pivot - PIECES['mace-cap'][0] / 2, -0.6);
            turned(ctx, 'mace-head', pivot + box.headX, box.headY, -box.swing);
        } else if (kind === 'press') {
            const [headWidth, headHeight] = PIECES.press;
            const [rodWidth] = PIECES['press-rod'];
            ctx.drawImage(scaled['ob-press-rod'], middle - rodWidth / 2, 0, rodWidth, box.bottom - headHeight + 1);
            drawPiece(ctx, 'press', middle - headWidth / 2, box.bottom - headHeight);
        } else if (kind === 'lift') {
            drawPiece(ctx, 'lift', x, box.top);
        } else if (kind === 'arc') {
            const y = (box.top + box.bottom) / 2 - 1.2;
            drawLightning(ctx, x + PIECES['pylon-left'][0] - 1, y, box.right - PIECES['pylon-right'][0] + 1, y, time, thing.x % 7);
            drawPiece(ctx, 'pylon-left', x, box.top);
            drawPiece(ctx, 'pylon-right', box.right - PIECES['pylon-right'][0], box.top);
        } else if (kind === 'flames') {
            const [flameWidth] = PIECES.flame;
            const burners = thing.base + 0.4 - PIECES.burners[1];
            box.heights.forEach((height, i) => {
                const flicker = 1 + Math.sin(time * 0.03 + i * 2) * 0.06;
                ctx.drawImage(scaled['ob-flame'], x + view.burners[i] * thing.width - flameWidth * flicker / 2, burners + 0.8 - height, flameWidth * flicker, height);
            });
            drawPiece(ctx, 'burners', x, burners);
        } else if (kind === 'post' && thing.look === 'tesla') {
            const [capWidth, capHeight] = PIECES['tesla-top'];
            drawLightning(ctx, middle, box.top + 2, middle, box.bottom - 2, time, thing.x % 5);
            drawPiece(ctx, 'tesla-top', middle - capWidth / 2, box.top);
            drawPiece(ctx, 'tesla-bottom', middle - capWidth / 2, box.bottom + 0.4 - capHeight);
        } else if (kind === 'hanging' && thing.look === 'tesla') {
            const [capWidth, capHeight] = PIECES['tesla-top'];
            drawLightning(ctx, middle, 2, middle, box.bottom - 2, time, thing.x % 5);
            drawPiece(ctx, 'tesla-top', middle - capWidth / 2, -0.4);
            drawPiece(ctx, 'tesla-bottom', middle - capWidth / 2, box.bottom - capHeight);
        } else if (kind === 'spikes') {
            const [width, height] = SIZES.spike;
            const each = width * UNIT * SPIKE_SCALE;
            const base = thing.base || FLOOR;
            ctx.save();
            if (thing.down) {
                ctx.translate(0, base * 2); // mirrored in the underside of what it hangs from
                ctx.scale(1, -1);
            }
            for (let at = 0; at < thing.width - 0.1; at += each) {
                sprite(ctx, 'spike', thing.screenX + at, base + 0.6 - height * UNIT * SPIKE_SCALE, SPIKE_SCALE, 'bigSpike');
            }
            ctx.restore();
        } else if (kind === 'ledge') {
            drawSlabs(ctx, x, thing.width, box.top);
        } else if (kind === 'shooter') {
            const [droneWidth, droneHeight] = DRONE_SIZES.drone;
            const width = droneWidth * DRONE_SCALE * SHOOTER_SCALE;
            const height = droneHeight * DRONE_SCALE * SHOOTER_SCALE;
            const middleY = (box.top + box.bottom) / 2;
            box.bolts.forEach(bolt => drawBolt(ctx, bolt));
            ctx.drawImage(scaled['drone-' + Math.floor(time / 70) % DRONE_FRAMES], (box.left + box.right - width) / 2, middleY - height / 2, width, height);
            if (box.justFired) {
                ctx.fillStyle = 'rgba(255, 225, 230, 0.9)';
                ctx.beginPath();
                ctx.arc(box.left - 0.5, middleY, 2.6, 0, Math.PI * 2);
                ctx.fill();
            }
        } else if (kind === 'drone') {
            const name = thing.alarm ? 'drone-alert' : 'drone';
            const [droneWidth, droneHeight] = DRONE_SIZES[name];
            const width = droneWidth * DRONE_SCALE;
            const height = droneHeight * DRONE_SCALE;
            ctx.drawImage(scaled[name + '-' + Math.floor(time / 70) % DRONE_FRAMES], (box.left + box.right - width) / 2, (box.top + box.bottom - height) / 2, width, height);
        } else if (kind === 'post' || kind === 'mover') {
            const [hangWidth, hangHeight] = SIZES['emitter-hang'];
            const [footWidth, footHeight] = SIZES['emitter-bottom'];
            drawBeam(ctx, middle, box.top + 3, middle, box.bottom - 3, time);
            sprite(ctx, 'emitter-hang', middle - hangWidth * UNIT / 2, box.top - 0.6);
            sprite(ctx, 'emitter-bottom', middle - footWidth * UNIT / 2, box.bottom + 0.6 - footHeight * UNIT);
            void hangHeight;
        } else if (kind === 'hanging') {
            const [topWidth] = SIZES['emitter-top'];
            const [footWidth, footHeight] = SIZES['emitter-bottom'];
            drawBeam(ctx, middle, 8, middle, box.bottom - 2, time);
            sprite(ctx, 'emitter-top', middle - topWidth * UNIT / 2, 0);
            ctx.save();
            ctx.translate(middle, box.bottom);
            ctx.scale(1, -1);
            sprite(ctx, 'emitter-bottom', -footWidth * UNIT / 2, -0.6);
            ctx.restore();
            void footHeight;
        } else if (kind === 'beam') {
            const y = (box.top + box.bottom) / 2;
            drawRailBeam(ctx, x, thing.width, y, time);
        } else if (kind === 'fence') {
            for (let i = 0; i < 3; i++) {
                drawRailBeam(ctx, x, thing.width, FLOOR - SIZES['rail-left'][1] * UNIT * (i + 0.5), time + i * 60);
            }
        }
    }

    function drawRailBeam(ctx, x, width, y, time) {
        const [leftWidth, height] = SIZES['rail-left'];
        drawBeam(ctx, x + 2, y, x + width - 2, y, time);
        sprite(ctx, 'rail-left', x - leftWidth * UNIT + 3, y - height * UNIT / 2);
        sprite(ctx, 'rail-right', x + width - 3, y - height * UNIT / 2);
    }

    function outlineBox(ctx, area) {
        ctx.fillRect(area.left, area.top, area.right - area.left, area.bottom - area.top);
        ctx.strokeRect(area.left, area.top, area.right - area.left, area.bottom - area.top);
    }

    // From the settings: what counts as touching, drawn over everything
    function drawTouchAreas(ctx, areas) {
        ctx.lineWidth = 0.35;
        ctx.strokeStyle = '#ffe94d';
        ctx.fillStyle = 'rgba(255, 233, 77, 0.1)';
        outlineBox(ctx, areas.reach);
        areas.tubes.forEach(tube => outlineBox(ctx, tube));
        ctx.strokeStyle = '#ff2d55';
        ctx.fillStyle = 'rgba(255, 45, 85, 0.3)';
        for (const shape of areas.obstacles) {
            if (shape.round) {
                ctx.beginPath();
                ctx.arc(shape.x, shape.y, shape.size, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            } else if (shape.spike) {
                const y = at => (shape.flip ? shape.flip - at : at);
                ctx.beginPath();
                ctx.moveTo(shape.left, y(shape.base));
                ctx.lineTo(shape.left + shape.width / 2, y(shape.base - shape.height));
                ctx.lineTo(shape.left + shape.width, y(shape.base));
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
            } else {
                outlineBox(ctx, shape);
            }
        }
        ctx.strokeStyle = '#26ff8a';
        ctx.fillStyle = 'rgba(38, 255, 138, 0.3)';
        for (const part of areas.body) {
            ctx.beginPath();
            ctx.arc(part.x, part.y, part.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        }
    }

    // On the wall, behind everything that matters. Beside each other when there are two.
    function drawSigns(ctx, {screen, banner}) {
        const width = (screen ? SCREEN_SIZE.width : 0) + (banner ? BANNER_SIZE.width : 0) + (screen && banner ? 3 : 0);
        let left = (viewWidth - width) / 2;
        if (banner) {
            ctx.drawImage(scaled[banner], left, SIGNS_Y + (screen ? (SCREEN_SIZE.height - BANNER_SIZE.height) / 2 : 0), BANNER_SIZE.width, BANNER_SIZE.height);
            left += BANNER_SIZE.width + 3;
        }
        if (screen) {
            ctx.drawImage(scaled[screen], left, SIGNS_Y, SCREEN_SIZE.width, SCREEN_SIZE.height);
        }
    }

    // The lab's lights go red, more with each alert
    function drawAlarm(ctx, level, time) {
        const pulse = (Math.sin(time * 0.008) + 1) / 2;
        const middleX = viewWidth / 2;
        const glow = ctx.createRadialGradient(middleX, 50, 45, middleX, 50, Math.max(viewWidth * 0.6, 70));
        glow.addColorStop(0, 'rgba(255, 20, 60, 0)');
        glow.addColorStop(1, 'rgba(255, 20, 60, ' + (0.16 + level * 0.1 + pulse * 0.2) + ')');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, viewWidth, 100);
    }

    function drawAreaLight(ctx, {from, to, mix}, y, height) {
        for (const [name, share] of [[from, 1 - mix], [to, mix]]) {
            const light = AREA_LIGHT[name];
            if (light && share > 0) {
                ctx.fillStyle = 'rgba(' + light[0] + ', ' + light[1] + ', ' + light[2] + ', ' + light[3] * share + ')';
                ctx.fillRect(0, y, viewWidth, height);
            }
        }
    }

    function drawRepeating(ctx, image, speed, width, camera, y, height) {
        let left = -((camera * speed) % width);
        while (left < viewWidth) {
            ctx.drawImage(image, left, y, width + 0.1, height);
            left += width;
        }
    }

    // view: camera, things, platforms, tubes, stars, sparkles, girl, girlX, step, boostLeft, boostWarnFrom, blink, time, hitBoxOf
    function draw(ctx, view) {
        ctx.setTransform(unit, 0, 0, unit, 0, 0);
        const {camera, time} = view;
        drawRepeating(ctx, back, BACK_SPEED, BACK_WIDTH, camera, 0, 100);
        drawRepeating(ctx, mid, MID_SPEED, MID_WIDTH, camera, 0, 100);
        drawAreaLight(ctx, view.areaLight, 0, FLOOR);
        if (view.signs) {
            drawSigns(ctx, view.signs);
        }
        for (const platform of view.platforms) {
            drawPlatform(ctx, platform, platform.x - camera);
        }
        drawRepeating(ctx, floor, 1, FLOOR_WIDTH, camera, FLOOR, 100 - FLOOR);
        drawAreaLight(ctx, view.areaLight, FLOOR, 100 - FLOOR);
        for (const tube of view.tubes) {
            drawTube(ctx, tube, tube.x - camera, time);
        }
        for (const thing of view.things) {
            thing.screenX = thing.x - camera;
            const hitBox = view.hitBoxOf(thing, camera);
            drawThing(ctx, thing, {
                ...hitBox, left: hitBox.left - camera, right: hitBox.right - camera,
                bolts: (hitBox.bolts || []).map(bolt => ({...bolt, left: bolt.left - camera, right: bolt.right - camera}))
            }, time, view);
        }
        for (const one of view.stars) {
            const scale = one.big ? BIG_STAR_SCALE : 1;
            const [width, height] = SIZES.star;
            const bob = Math.sin((one.x + time * 0.08) * 0.09) * 0.6;
            sprite(ctx, 'star', one.x - camera - width * UNIT * scale / 2, one.y - height * UNIT * scale / 2 + bob, scale, one.big ? 'bigStar' : 'star');
        }
        for (const sparkle of view.sparkles) {
            const [width, height] = SIZES.sparkle;
            ctx.globalAlpha = Math.max(0, Math.min(1, sparkle.life * 1.6));
            const scale = sparkle.size;
            sprite(ctx, 'sparkle', sparkle.x - width * UNIT * scale / 2, sparkle.y - height * UNIT * scale / 2, scale);
        }
        ctx.globalAlpha = view.blink && Math.floor(time / 90) % 2 ? 0.4 : 1;
        drawGirl(ctx, view.girlX, view.girl.y, view);
        ctx.globalAlpha = 1;
        if (view.boostLeft > 0) {
            drawBubble(ctx, view.girlX, view.girl.y, view.boostLeft, view.boostWarnFrom);
        }
        if (view.alert > 0) {
            drawAlarm(ctx, view.alert, time);
        }
        if (view.touchAreas) {
            drawTouchAreas(ctx, view.touchAreas);
        }
    }

    return {ready, fit, draw, viewWidth: () => viewWidth, spikeWidth: count => count * SIZES.spike[0] * UNIT * SPIKE_SCALE, piece: name => ({width: PIECES[name][0], height: PIECES[name][1]})};
})();
