// Mission: Meow's look. She, the kittens and what is in her way are cut from the user's picture (mission/art), at the picture's own scale and
// upscaled three times. Flying she is four pieces, from the first picture, and walking eight, from the second, so that she can flap and take steps.
// The lab behind them is drawn here, as the user preferred it.
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
    // Her pieces as they lie in the picture: x, y, width, height. Each turns around its pivot.
    const CENTER = {x: 385, y: 400};
    const BODY = {name: 'girl-body', x: 204, y: 228, width: 303, height: 234};
    const WING = {name: 'girl-wing', x: 275, y: 320, width: 96, height: 82, pivotX: 368, pivotY: 388};
    const FAR_LEG = {name: 'girl-far', x: 293, y: 420, width: 112, height: 94, pivotX: 368, pivotY: 436};
    const NEAR_LEG = {name: 'girl-near', x: 293, y: 430, width: 120, height: 83, pivotX: 385, pivotY: 447};
    // Walking: pieces as they lie in the second picture, where she is larger. All turn around their pivots; shoes around the ankles.
    const WALK_SCALE = 0.48;
    const WALK_CENTER = {x: 880, y: 462};
    const LEG_ANGLE = 30 * Math.PI / 180; // how far each leg is from straight down in the picture
    const LEG_LENGTH = 196; // from the hip to the ground, in pixels of the second picture
    const WALK = {
        body: {name: 'walk-body', x: 512, y: 92, width: 551, height: 497},
        wing: {name: 'walk-wing', x: 649, y: 350, width: 161, height: 138, pivotX: 800, pivotY: 440},
        nearArm: {name: 'walk-arm-near', x: 744, y: 414, width: 151, height: 169, pivotX: 868, pivotY: 440},
        farArm: {name: 'walk-arm-far', x: 921, y: 458, width: 116, height: 112, pivotX: 945, pivotY: 490},
        backLeg: {name: 'walk-leg-back', x: 766, y: 546, width: 127, height: 129, pivotX: 858, pivotY: 575},
        frontLeg: {name: 'walk-leg-front', x: 864, y: 546, width: 123, height: 159, pivotX: 905, pivotY: 575},
        backShoe: {name: 'walk-shoe-back', x: 710, y: 635, width: 101, height: 115, pivotX: 785, pivotY: 660},
        frontShoe: {name: 'walk-shoe-front', x: 941, y: 668, width: 116, height: 82, pivotX: 962, pivotY: 690}
    };
    const SIZES = {
        'tube-empty-orange': [178, 239], 'tube-empty-grey': [179, 224], 'kitten-orange': [76, 88], 'kitten-grey': [77, 78], 'slab-long': [300, 72], 'emitter-top': [116, 98], 'emitter-bottom': [77, 59], 'emitter-hang': [83, 60], 'rail-left': [68, 73], 'rail-right': [72, 73],
        column: [76, 195], spike: [48, 54], star: [60, 58], sparkle: [42, 46]
    };
    const KITTEN_IN_TUBE = {orange: [53, 116], grey: [53, 114]};
    const GIRL = [BODY, WING, FAR_LEG, NEAR_LEG, ...Object.values(WALK)];
    const FILES = [...Object.keys(SIZES), ...GIRL.map(piece => piece.name)];
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
        for (const piece of GIRL) {
            const scale = piece.name.startsWith('walk') ? WALK_SCALE : 1;
            scaled[piece.name] = sized(images[piece.name], piece.width * picturePixel * scale, piece.height * picturePixel * scale);
        }
        scaled.bigStar = sized(images.star, SIZES.star[0] * picturePixel * BIG_STAR_SCALE, SIZES.star[1] * picturePixel * BIG_STAR_SCALE);
        scaled.bigSpike = sized(images.spike, SIZES.spike[0] * picturePixel * SPIKE_SCALE, SIZES.spike[1] * picturePixel * SPIKE_SCALE);
    }

    // Top left at (x, y) in units
    function sprite(ctx, name, x, y, scale = 1, sizedName = name) {
        const [width, height] = SIZES[name];
        ctx.drawImage(scaled[sizedName], x, y, width * UNIT * scale, height * UNIT * scale);
    }

    function drawPiece(ctx, piece, angle) {
        ctx.save();
        if (angle) {
            ctx.translate(piece.pivotX, piece.pivotY);
            ctx.rotate(angle);
            ctx.translate(-piece.pivotX, -piece.pivotY);
        }
        ctx.drawImage(scaled[piece.name], piece.x, piece.y, piece.width, piece.height);
        ctx.restore();
    }

    // Around her middle (x, y): the wing beats and the legs trail
    function drawFlying(ctx, x, y, step) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(Math.sin(step * 0.5) * 0.02);
        ctx.scale(UNIT, UNIT);
        ctx.translate(-CENTER.x, -CENTER.y);
        const swing = Math.sin(step * 0.7) * 0.07;
        drawPiece(ctx, FAR_LEG, swing);
        drawPiece(ctx, NEAR_LEG, -swing);
        drawPiece(ctx, BODY, 0);
        drawPiece(ctx, WING, Math.sin(step * 1.5) * 0.17);
        ctx.restore();
    }

    // A leg and its shoe. forward: how far the leg points forward now (radians), rest: how far it does in the picture.
    // A leg swinging through the air is shorter, as if its knee bends, and its shoe follows the ankle and lies as it should for that moment.
    function drawLegAndShoe(ctx, leg, shoe, rest, forward, shorter, shoeTurn) {
        const turn = rest - forward; // clockwise on the screen brings the foot back
        ctx.save();
        ctx.translate(leg.pivotX, leg.pivotY);
        ctx.rotate(turn);
        ctx.scale(1, 1 - shorter);
        ctx.translate(-leg.pivotX, -leg.pivotY);
        ctx.drawImage(scaled[leg.name], leg.x, leg.y, leg.width, leg.height);
        // The shoe goes where the ankle goes, not stretched or turned along with the leg
        const ankleX = shoe.pivotX - leg.pivotX;
        const ankleY = (shoe.pivotY - leg.pivotY) * (1 - shorter);
        ctx.restore();
        const cos = Math.cos(turn);
        const sin = Math.sin(turn);
        ctx.save();
        ctx.translate(leg.pivotX + ankleX * cos - ankleY * sin, leg.pivotY + ankleX * sin + ankleY * cos);
        ctx.rotate(shoeTurn);
        ctx.translate(-shoe.pivotX, -shoe.pivotY);
        ctx.drawImage(scaled[shoe.name], shoe.x, shoe.y, shoe.width, shoe.height);
        ctx.restore();
    }

    // One leg's moment in a step. phase 0: reaching forward, on its heel; then down flat and back along the ground; at pi: pushing off its toes; then through the air.
    function legAt(phase) {
        const onGround = Math.sin(phase) >= 0;
        return {
            forward: LEG_ANGLE * Math.cos(phase),
            shorter: onGround ? 0 : -Math.sin(phase) * 0.2,
            onGround
        };
    }

    // Her shoe's tilt for the moment: its toes up on the heel, flat, its heel up on the toes. Positive turns clockwise on the screen.
    function shoeTilt(phase) {
        const forward = Math.cos(phase);
        return forward > 0 ? -0.2 * forward : 0.55 * -forward;
    }

    // Around her middle (x, y), in the air the stride of the picture
    function drawWalking(ctx, x, y, step, onGround) {
        const front = onGround ? legAt(step) : {forward: LEG_ANGLE, shorter: 0};
        const back = onGround ? legAt(step + Math.PI) : {forward: -LEG_ANGLE, shorter: 0};
        const planted = onGround ? (front.onGround ? front : back) : null;
        const lift = planted ? LEG_LENGTH * (Math.cos(planted.forward) - Math.cos(LEG_ANGLE)) : 0; // her hips rise over the planted leg
        const arm = onGround ? Math.cos(step) * 0.22 : 0;
        const pictureScale = UNIT * WALK_SCALE;
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(pictureScale, pictureScale);
        ctx.translate(-WALK_CENTER.x, -WALK_CENTER.y - lift);
        const {body, wing, nearArm, farArm, backLeg, frontLeg, backShoe, frontShoe} = WALK;
        const frontTilt = onGround ? shoeTilt(step) : 0;
        const backTilt = onGround ? shoeTilt(step + Math.PI) : 0;
        drawLegAndShoe(ctx, backLeg, backShoe, -LEG_ANGLE, back.forward, back.shorter, backTilt - shoeTilt(Math.PI));
        drawLegAndShoe(ctx, frontLeg, frontShoe, LEG_ANGLE, front.forward, front.shorter, frontTilt - shoeTilt(0));
        drawPiece(ctx, farArm, arm * 0.7);
        ctx.drawImage(scaled[body.name], body.x, body.y, body.width, body.height);
        drawPiece(ctx, wing, Math.sin(step * 0.5) * 0.05);
        drawPiece(ctx, nearArm, -arm);
        ctx.restore();
    }

    function drawGirl(ctx, x, y, girl, step) {
        if (girl.flying) {
            drawFlying(ctx, x, y, step);
        } else {
            drawWalking(ctx, x, y, step, girl.onGround);
        }
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
        const top = FLOOR + 0.5 - height * UNIT;
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

    function drawPlatform(ctx, platform, x) {
        const [slabWidth] = SIZES['slab-long'];
        const each = slabWidth * UNIT;
        const count = Math.max(1, Math.round(platform.width / each));
        const width = platform.width / count;
        const [columnWidth] = SIZES.column;
        for (let i = 0; i < count; i++) {
            const left = x + i * width;
            ctx.drawImage(scaled.column, left + width / 2 - columnWidth * UNIT / 2, platform.top + 6, columnWidth * UNIT, FLOOR - platform.top - 6);
            ctx.drawImage(scaled['slab-long'], left, platform.top - 0.4, width, SIZES['slab-long'][1] * UNIT);
        }
    }

    function drawThing(ctx, thing, box, time) {
        const {kind} = thing;
        const x = box.left;
        const middle = (box.left + box.right) / 2;
        if (kind === 'spikes') {
            const [width, height] = SIZES.spike;
            const each = width * UNIT * SPIKE_SCALE;
            for (let at = 0; at < thing.width - 0.1; at += each) {
                sprite(ctx, 'spike', thing.screenX + at, FLOOR + 0.6 - height * UNIT * SPIKE_SCALE, SPIKE_SCALE, 'bigSpike');
            }
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
        for (const platform of view.platforms) {
            drawPlatform(ctx, platform, platform.x - camera);
        }
        drawRepeating(ctx, floor, 1, FLOOR_WIDTH, camera, FLOOR, 100 - FLOOR);
        for (const tube of view.tubes) {
            drawTube(ctx, tube, tube.x - camera, time);
        }
        for (const thing of view.things) {
            thing.screenX = thing.x - camera;
            const hitBox = view.hitBoxOf(thing, camera);
            drawThing(ctx, thing, {left: hitBox.left - camera, right: hitBox.right - camera, top: hitBox.top, bottom: hitBox.bottom}, time);
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
        drawGirl(ctx, view.girlX, view.girl.y, view.girl, view.step);
        ctx.globalAlpha = 1;
        if (view.boostLeft > 0) {
            drawBubble(ctx, view.girlX, view.girl.y, view.boostLeft, view.boostWarnFrom);
        }
        if (view.alert > 0) {
            drawAlarm(ctx, view.alert, time);
        }
    }

    return {ready, fit, draw, viewWidth: () => viewWidth, spikeWidth: count => count * SIZES.spike[0] * UNIT * SPIKE_SCALE};
})();
