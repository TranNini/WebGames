// Mission: Meow's look: the pieces are cut from the user's picture (mission/art), at the picture's own scale, so it looks like the picture.
// She is four pieces, so that she can flap her wing and walk. A world is 100 units high; the rules are in mission.js.
const Scene = (() => {
    const FLOOR = 84; // in units from the top, as in mission.js
    const UNIT = 100 / 887; // units per pixel of the picture
    const WALL_SPEED = 0.3; // what is further away moves slower
    const SPIKE_SCALE = 1.7;
    const WALK_LEAN = 28 * Math.PI / 180; // flying she lies forward as in the picture; walking she is upright
    // Her pieces as they lie in the picture: x, y, width, height. Each turns around its pivot.
    const CENTER = {x: 385, y: 400};
    const BODY = {name: 'girl-body', x: 204, y: 228, width: 303, height: 234};
    const WING = {name: 'girl-wing', x: 275, y: 320, width: 96, height: 82, pivotX: 368, pivotY: 388};
    const FAR_LEG = {name: 'girl-far', x: 293, y: 420, width: 112, height: 94, pivotX: 368, pivotY: 436};
    const NEAR_LEG = {name: 'girl-near', x: 293, y: 430, width: 120, height: 83, pivotX: 385, pivotY: 447};
    const SIZES = {
        'tube-orange': [178, 239], 'tube-grey': [179, 224], 'tube-empty-orange': [178, 239], 'tube-empty-grey': [179, 224],
        'kitten-orange': [113, 90], 'kitten-grey': [113, 80], 'slab-long': [300, 72], column: [76, 195], 'emitter-top': [116, 98],
        'emitter-bottom': [77, 59], 'emitter-hang': [83, 60], 'rail-left': [68, 73], 'rail-right': [72, 73], spike: [48, 54], star: [60, 58], sparkle: [42, 46]
    };
    const FILES = [...Object.keys(SIZES), 'girl-body', 'girl-wing', 'girl-far', 'girl-near'];
    const images = {};
    let wall = null;
    let floor = null;
    let unit = 1;
    let viewWidth = 100;

    function load(name, file) {
        return new Promise(resolve => {
            const image = new Image();
            image.onload = () => resolve(image);
            image.onerror = () => resolve(image);
            image.src = '/mission/art/' + file;
        }).then(image => {
            images[name] = image;
        });
    }

    const ready = Promise.all([...FILES.map(name => load(name, name + '.png')), load('wall', 'wall.jpg'), load('floor', 'floor.jpg')]).then(() => {
        wall = images.wall;
        floor = images.floor;
    });

    function fit(width, height) {
        unit = height / 100;
        viewWidth = width / unit;
    }

    // Top left at (x, y) in units
    function sprite(ctx, name, x, y, scale = 1) {
        const [width, height] = SIZES[name];
        ctx.drawImage(images[name], x, y, width * UNIT * scale, height * UNIT * scale);
    }

    function drawPiece(ctx, piece, angle) {
        ctx.save();
        if (angle) {
            ctx.translate(piece.pivotX, piece.pivotY);
            ctx.rotate(angle);
            ctx.translate(-piece.pivotX, -piece.pivotY);
        }
        ctx.drawImage(images[piece.name], piece.x, piece.y, piece.width, piece.height);
        ctx.restore();
    }

    // Around her middle (x, y). Flying: the wing beats and the legs trail. Walking: upright, the legs swinging.
    function drawGirl(ctx, x, y, girl, step) {
        const walking = !girl.flying;
        const walkAmount = girl.upright;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(-WALK_LEAN * walkAmount + Math.sin(step * 0.5) * 0.02 * (1 - walkAmount));
        ctx.scale(UNIT, UNIT);
        ctx.translate(-CENTER.x, -CENTER.y);
        const swing = walking ? Math.sin(step) * 0.46 : Math.sin(step * 0.7) * 0.09;
        drawPiece(ctx, FAR_LEG, walking ? swing : swing * 0.8);
        drawPiece(ctx, NEAR_LEG, walking ? -swing : -swing * 0.8);
        drawPiece(ctx, BODY, 0);
        drawPiece(ctx, WING, walking ? -0.1 : Math.sin(step * 1.5) * 0.24 + 0.05);
        ctx.restore();
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

    function drawTube(ctx, tube, x, time) {
        const kind = tube.look % 2 ? 'grey' : 'orange';
        const [width, height] = SIZES['tube-' + kind];
        const left = x - width * UNIT / 2;
        const top = FLOOR + 0.5 - height * UNIT;
        sprite(ctx, (tube.saved ? 'tube-empty-' : 'tube-') + kind, left, top);
        if (tube.saved && tube.opened < 1) {
            const leap = tube.opened;
            const [catWidth, catHeight] = SIZES['kitten-' + kind];
            const catX = x - catWidth * UNIT / 2 - leap * 26;
            const catY = FLOOR - 7 - catHeight * UNIT - Math.sin(leap * Math.PI) * 26 + leap * 6;
            ctx.globalAlpha = Math.min(1, (1 - leap) * 3);
            sprite(ctx, 'kitten-' + kind, catX, catY);
            ctx.globalAlpha = 1;
        }
    }

    function drawPlatform(ctx, platform, x) {
        const [slabWidth] = SIZES['slab-long'];
        const each = slabWidth * UNIT;
        const count = Math.max(1, Math.round(platform.width / each));
        const width = platform.width / count;
        const [columnWidth] = SIZES.column;
        for (let i = 0; i < count; i++) {
            const left = x + i * width;
            ctx.drawImage(images.column, left + width / 2 - columnWidth * UNIT / 2, platform.top + 6, columnWidth * UNIT, FLOOR - platform.top - 6);
            ctx.drawImage(images['slab-long'], left, platform.top - 0.4, width, SIZES['slab-long'][1] * UNIT);
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
                sprite(ctx, 'spike', thing.screenX + at, FLOOR + 0.6 - height * UNIT * SPIKE_SCALE, SPIKE_SCALE);
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
            const row = SIZES['rail-left'][1] * UNIT;
            for (let i = 0; i < 3; i++) {
                drawRailBeam(ctx, x, thing.width, FLOOR - row * (i + 0.5), time + i * 60);
            }
        }
    }

    function drawRailBeam(ctx, x, width, y, time) {
        const [leftWidth, height] = SIZES['rail-left'];
        drawBeam(ctx, x + 2, y, x + width - 2, y, time);
        sprite(ctx, 'rail-left', x - leftWidth * UNIT + 3, y - height * UNIT / 2);
        sprite(ctx, 'rail-right', x + width - 3, y - height * UNIT / 2);
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
        drawRepeating(ctx, wall, WALL_SPEED, 1684 * UNIT, camera, 0, 745 * UNIT);
        for (const platform of view.platforms) {
            drawPlatform(ctx, platform, platform.x - camera);
        }
        drawRepeating(ctx, floor, 1, 1704 * UNIT, camera, 743 * UNIT, 144 * UNIT);
        for (const tube of view.tubes) {
            drawTube(ctx, tube, tube.x - camera, time);
        }
        for (const thing of view.things) {
            thing.screenX = thing.x - camera;
            const hitBox = view.hitBoxOf(thing, camera);
            drawThing(ctx, thing, {left: hitBox.left - camera, right: hitBox.right - camera, top: hitBox.top, bottom: hitBox.bottom}, time);
        }
        for (const one of view.stars) {
            const scale = one.big ? 2.1 : 1;
            const [width, height] = SIZES.star;
            const bob = Math.sin((one.x + time * 0.08) * 0.09) * 0.6;
            sprite(ctx, 'star', one.x - camera - width * UNIT * scale / 2, one.y - height * UNIT * scale / 2 + bob, scale);
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
    }

    return {ready, fit, draw, viewWidth: () => viewWidth, spikeWidth: count => count * SIZES.spike[0] * UNIT * SPIKE_SCALE};
})();
