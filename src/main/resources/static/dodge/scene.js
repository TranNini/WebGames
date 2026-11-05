// Lane Dodge's look: the road, the cat and what comes towards her, after the user's picture. All drawn in code, so it
// stays sharp on any screen and things can move. The rules are in dodge.js.
const Scene = (() => {
    const CAR_COLORS = [
        {body: '#f4352f', light: '#ff6f5e', dark: '#b81c1c'},
        {body: '#fdb90f', light: '#ffd84f', dark: '#d98a00'},
        {body: '#2f8fe8', light: '#6cb8f5', dark: '#1b62b0'},
        {body: '#f4f4f6', light: '#ffffff', dark: '#b9b9c4'}
    ];
    const KID_LOOKS = [
        {shirt: '#2fb4e8', pants: '#34507a', hat: '#f4352f', skin: '#ffd2ad', wheels: '#f4352f'},
        {shirt: '#ff7ab8', pants: '#5a4a8c', hat: '#ffd84f', skin: '#f2b98c', wheels: '#2f8fe8'},
        {shirt: '#7ed957', pants: '#3a3f58', hat: '#2f8fe8', skin: '#b97c50', wheels: '#fdb90f'},
        {shirt: '#fdb90f', pants: '#7a3b2e', hat: '#8d5cd6', skin: '#8a5a3a', wheels: '#7ed957'}
    ];
    // Half of what comes is a car
    const KINDS = ['car', 'car', 'car', 'bike', 'roller', 'skateboard'];
    // Length as a share of a car's, and how many pixels of the drawing below a car's width of 100 makes
    const LENGTHS = {car: 1, bike: 0.8, roller: 0.62, skateboard: 0.68};
    const KID_SCALE = {bike: 1.05, roller: 1.25, skateboard: 1.25};
    const CAT_LENGTH = 1.15; // in car widths
    const CAT_Y = 0.905; // her middle, in screen heights
    const GROUND_SPEED = 0.7; // the ground moves slower than what comes towards her, as that moves too

    let width = 0;
    let height = 0;
    let roadLeft = 0;
    let laneWidth = 0;
    let carWidth = 0;
    let ground = null;
    let carSprites = [];

    function newCanvas(canvasWidth, canvasHeight) {
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(canvasWidth);
        canvas.height = Math.ceil(canvasHeight);
        return canvas;
    }

    function oval(ctx, x, y, radiusX, radiusY, color) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(x, y, radiusX, radiusY, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    function limb(ctx, fromX, fromY, toX, toY, thickness, color) {
        ctx.strokeStyle = color;
        ctx.lineWidth = thickness;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(fromX, fromY);
        ctx.lineTo(toX, toY);
        ctx.stroke();
    }

    function box(ctx, x, y, boxWidth, boxHeight, corner, color) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.roundRect(x, y, boxWidth, boxHeight, corner);
        ctx.fill();
    }

    // The same ground every time: a new layout only makes it fit
    function seededRandom(seed) {
        return () => {
            seed = (seed + 0x6d2b79f5) | 0;
            let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    // Takes a new size. Only here the pictures that don't change are painted, as that takes a moment.
    function fit(newWidth, newHeight) {
        width = newWidth;
        height = newHeight;
        const road = Math.min(width * 0.78, height);
        roadLeft = (width - road) / 2;
        laneWidth = road / 3;
        carWidth = Math.min(height * 0.15, laneWidth * 0.74);
        ground = paintGround(road);
        carSprites = CAR_COLORS.map(paintCar);
    }

    // One screen height of ground, which fits onto itself when it moves
    function paintGround(road) {
        const tile = newCanvas(width, height);
        const ctx = tile.getContext('2d');
        const random = seededRandom(7);
        const curb = Math.min(roadLeft * 0.2, road * 0.03);
        const grass = roadLeft - curb;

        ctx.fillStyle = '#5e5c6a';
        ctx.fillRect(roadLeft, 0, road, height);
        const speck = Math.max(1, Math.round(height / 500));
        for (let i = road * height / 90; i > 0; i--) {
            ctx.fillStyle = random() < 0.5 ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.07)';
            ctx.fillRect(roadLeft + random() * road, random() * height, speck, speck);
        }

        const dashes = 8;
        const dash = height / dashes;
        const dashWidth = Math.max(2, road * 0.012);
        for (const line of [1, 2]) {
            for (let i = 0; i < dashes; i++) {
                box(ctx, roadLeft + line * laneWidth - dashWidth / 2, (i + 0.2) * dash, dashWidth, dash * 0.55, dashWidth / 2, '#c6c4cf');
            }
        }

        paintSide(ctx, random, 0, grass, curb, -1);
        paintSide(ctx, random, width - grass, grass, curb, 1);
        return tile;
    }

    // outward: -1 for the left side, 1 for the right
    function paintSide(ctx, random, left, grass, curb, outward) {
        ctx.fillStyle = '#6ccb2c';
        ctx.fillRect(left, 0, grass, height);
        const unit = Math.min(height * 0.012, grass * 0.14);
        // What runs over the top of the tile also shows at the bottom
        const scatter = (count, paintOne) => {
            for (let i = 0; i < count; i++) {
                const x = left + random() * grass;
                const y = (i + random()) * height / count;
                const seed = random();
                for (const repeat of [-height, 0, height]) {
                    paintOne(x, y + repeat, seed);
                }
            }
        };
        const perScreen = factor => Math.max(1, Math.round(factor * grass * height / (unit * unit * 1000)));

        scatter(perScreen(14), (x, y, seed) => limb(ctx, x, y, x + (seed - 0.5) * unit, y - unit * 1.2, unit * 0.22, seed < 0.5 ? '#8fe04a' : '#54ad21'));
        scatter(perScreen(1.2), (x, y) => paintClover(ctx, x, y, unit));
        scatter(perScreen(2.2), (x, y) => paintFlower(ctx, x, y, unit));
        scatter(perScreen(0.7), (x, y, seed) => paintRock(ctx, x, y, unit * (2.2 + seed * 2)));
        const bushes = Math.max(2, Math.round(height / (grass * 2.4 + height * 0.25)));
        for (let i = 0; i < bushes; i++) {
            const y = (i + 0.3 + random() * 0.4) * height / bushes;
            const size = Math.min(grass * 0.62, height * 0.1) * (0.8 + random() * 0.4);
            const x = outward < 0 ? left + size * 0.15 : left + grass - size * 0.15;
            const seed = Math.floor(random() * 1000);
            for (const repeat of [-height, 0, height]) {
                paintBush(ctx, x, y + repeat, size, seed);
            }
        }

        // The stones along the road, on the side of the grass towards the road
        const curbLeft = outward < 0 ? left + grass : left - curb;
        ctx.fillStyle = '#a89d94';
        ctx.fillRect(curbLeft, 0, curb, height);
        const stones = Math.max(4, Math.round(height / (curb * 7 + height * 0.05)));
        let top = 0;
        for (let i = 0; i < stones; i++) {
            const stone = height / stones * (i % 2 ? 0.8 : 1.2);
            const bottom = i === stones - 1 ? height : top + stone;
            box(ctx, curbLeft + curb * 0.05, top + 1, curb * 0.9, bottom - top - 2, curb * 0.16, '#dcd1c9');
            top = bottom;
        }
    }

    function paintFlower(ctx, x, y, unit) {
        for (let petal = 0; petal < 5; petal++) {
            const angle = petal * Math.PI * 2 / 5 - Math.PI / 2;
            oval(ctx, x + Math.cos(angle) * unit * 1.1, y + Math.sin(angle) * unit * 1.1, unit * 0.85, unit * 0.85, '#ffffff');
        }
        oval(ctx, x, y, unit * 0.65, unit * 0.65, '#f5b60f');
    }

    function paintClover(ctx, x, y, unit) {
        for (const [leafX, leafY] of [[0, -1], [-0.95, 0.5], [0.95, 0.5]]) {
            oval(ctx, x + leafX * unit, y + leafY * unit, unit * 0.85, unit * 0.85, '#2f8a2a');
        }
    }

    function paintRock(ctx, x, y, size) {
        oval(ctx, x + size * 0.1, y + size * 0.3, size * 1.08, size * 0.72, 'rgba(30, 80, 20, 0.35)');
        const stone = ctx.createLinearGradient(x, y - size, x, y + size);
        stone.addColorStop(0, '#b4b3b9');
        stone.addColorStop(1, '#75737e');
        ctx.fillStyle = stone;
        ctx.beginPath();
        ctx.ellipse(x, y, size, size * 0.8, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    function paintBush(ctx, x, y, size, seed) {
        const random = seededRandom(seed);
        oval(ctx, x, y + size * 0.25, size * 1.15, size, 'rgba(25, 80, 15, 0.4)');
        for (let i = 0; i < 9; i++) {
            const angle = random() * Math.PI * 2;
            const reach = i === 8 ? 0 : size * (0.3 + random() * 0.45);
            const leafX = x + Math.cos(angle) * reach;
            const leafY = y + Math.sin(angle) * reach;
            const radius = size * (0.42 + random() * 0.2);
            const leaf = ctx.createRadialGradient(leafX - radius * 0.3, leafY - radius * 0.4, radius * 0.1, leafX, leafY, radius);
            leaf.addColorStop(0, '#8fe63c');
            leaf.addColorStop(1, '#2f9a1f');
            ctx.fillStyle = leaf;
            ctx.beginPath();
            ctx.arc(leafX, leafY, radius, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Seen from above with its front down, as it comes towards her. 100 wide and 200 long around its middle.
    function paintCar(color) {
        const sprite = newCanvas(carWidth * 1.5, carWidth * 2.4);
        const ctx = sprite.getContext('2d');
        ctx.translate(sprite.width / 2, sprite.height / 2);
        ctx.scale(carWidth / 100, carWidth / 100);

        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
        ctx.shadowBlur = 10 * carWidth / 100;
        ctx.shadowOffsetX = 5 * carWidth / 100;
        ctx.shadowOffsetY = 9 * carWidth / 100;
        box(ctx, -48, -98, 96, 196, 30, color.dark);
        ctx.restore();

        for (const side of [-1, 1]) {
            for (const end of [-1, 1]) {
                box(ctx, side * 50 - 5, end * 58 - 15, 10, 30, 4, '#23222b');
            }
            oval(ctx, side * 53, 24, 7, 5, color.dark); // mirror
        }

        const paintwork = ctx.createLinearGradient(-50, 0, 50, 0);
        paintwork.addColorStop(0, color.dark);
        paintwork.addColorStop(0.18, color.body);
        paintwork.addColorStop(0.5, color.light);
        paintwork.addColorStop(0.82, color.body);
        paintwork.addColorStop(1, color.dark);
        box(ctx, -48, -98, 96, 196, 30, paintwork);

        // Windows: the windscreen towards the front, the rear window, the side windows, with the roof on top
        ctx.fillStyle = '#343546';
        ctx.beginPath();
        ctx.moveTo(-33, 10);
        ctx.lineTo(33, 10);
        ctx.quadraticCurveTo(38, 28, 34, 44);
        ctx.quadraticCurveTo(0, 54, -34, 44);
        ctx.quadraticCurveTo(-38, 28, -33, 10);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-31, -40);
        ctx.lineTo(31, -40);
        ctx.quadraticCurveTo(35, -55, 31, -66);
        ctx.quadraticCurveTo(0, -74, -31, -66);
        ctx.quadraticCurveTo(-35, -55, -31, -40);
        ctx.fill();
        for (const side of [-1, 1]) {
            box(ctx, side * 38 - 3, -42, 6, 54, 3, '#343546');
        }
        box(ctx, -30, -40, 60, 50, 10, color.light);
        box(ctx, -18, 13, 7, 26, 3, 'rgba(255, 255, 255, 0.18)'); // a shine on the windscreen

        for (const side of [-1, 1]) {
            oval(ctx, side * 29, 90, 13, 6, '#fff8d8');
            box(ctx, side * 29 - 12, -97, 24, 6, 3, '#d81818');
            limb(ctx, side * 22, 60, side * 26, 80, 2, color.dark); // lines on the hood
        }
        return sprite;
    }

    // Her back, as she runs away from us: head up, the paws on her sides going to and fro in turn. Around her middle, about 100 long.
    function drawCat(ctx, x, y, scale, stride, lean, hurt) {
        const colors = hurt
            ? {fur: '#ff8a7a', shine: '#ffb6a8', shade: '#d93a2f', stripe: '#c22a22'}
            : {fur: '#f98e12', shine: '#ffb446', shade: '#e0730a', stripe: '#d8650a'};
        const step = Math.sin(stride);
        const bounce = Math.cos(stride * 2);
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(scale, scale);
        oval(ctx, 5, 13, 34, 40, 'rgba(0, 0, 0, 0.25)');
        ctx.rotate(lean + step * 0.05);

        // Tail, swinging against the steps, with a white tip
        const swing = step * 14;
        ctx.strokeStyle = colors.fur;
        ctx.lineWidth = 11;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(2, 40);
        ctx.quadraticCurveTo(4 + swing, 56, 22 + swing, 50);
        ctx.stroke();
        limb(ctx, 19 + swing, 51, 24 + swing, 49, 11, '#fff7ee');

        // Front left goes with back right, front right with back left
        const reach = 15;
        for (const [legX, legY, turn] of [[-1, -2, 1], [1, -2, -1], [-1, 28, -1], [1, 28, 1]]) {
            const pawX = legX * 35;
            const pawY = legY + turn * step * reach;
            limb(ctx, legX * 20, legY, pawX, pawY, 12, colors.shade);
            oval(ctx, pawX, pawY, 7.5, 8.5, colors.shine);
        }

        const fur = ctx.createRadialGradient(-6, 8, 4, 0, 14, 38);
        fur.addColorStop(0, colors.shine);
        fur.addColorStop(1, colors.fur);
        ctx.fillStyle = fur;
        ctx.beginPath();
        ctx.ellipse(0, 14 + bounce, 28, 31 + bounce, 0, 0, Math.PI * 2);
        ctx.fill();

        // Stripes across her back and down its middle
        limb(ctx, 0, -6, 0, 36, 4.5, colors.stripe);
        for (const [stripeY, stripeWidth] of [[0, 13], [12, 18], [24, 15]]) {
            limb(ctx, -stripeWidth, stripeY, stripeWidth, stripeY, 4, colors.stripe);
        }

        // Head, bobbing a little
        ctx.translate(0, -1 + bounce * 1.5);
        for (const side of [-1, 1]) {
            ctx.fillStyle = colors.shade;
            ctx.beginPath();
            ctx.moveTo(side * 21, -30);
            ctx.lineTo(side * 21, -50);
            ctx.lineTo(side * 5, -41);
            ctx.closePath();
            ctx.fill();
            limb(ctx, side * 24, -21, side * 33, -24, 1, '#fff7ee');
            limb(ctx, side * 24, -18, side * 34, -18, 1, '#fff7ee');
        }
        const head = ctx.createRadialGradient(-5, -30, 3, 0, -24, 26);
        head.addColorStop(0, colors.shine);
        head.addColorStop(1, colors.fur);
        ctx.fillStyle = head;
        ctx.beginPath();
        ctx.ellipse(0, -25, 24, 20, 0, 0, Math.PI * 2);
        ctx.fill();
        limb(ctx, 0, -39, 0, -26, 4.5, colors.stripe);
        for (const side of [-1, 1]) {
            limb(ctx, side * 9, -35, side * 8, -26, 3.5, colors.stripe);
        }
        limb(ctx, -13, -14, 13, -14, 3.5, colors.stripe);
        ctx.restore();
    }

    // A kid's head from above, looking towards the cat: the hat at the back, the face to the front
    function drawHead(ctx, x, y, look) {
        oval(ctx, x, y, 15, 15, look.skin);
        ctx.fillStyle = look.hat;
        ctx.beginPath();
        ctx.ellipse(x, y - 2, 16, 13.5, 0, Math.PI, 0);
        ctx.quadraticCurveTo(x, y + 4, x - 16, y - 2);
        ctx.fill();
        oval(ctx, x - 5, y + 6, 1.9, 2.2, '#2b2230');
        oval(ctx, x + 5, y + 6, 1.9, 2.2, '#2b2230');
    }

    function drawBike(ctx, look, stride) {
        const pedal = Math.sin(stride);
        limb(ctx, 4, -66, 4, 82, 12, 'rgba(0, 0, 0, 0.2)');
        oval(ctx, 4, -8, 26, 24, 'rgba(0, 0, 0, 0.2)');
        box(ctx, -5, -72, 10, 44, 5, '#23222b');
        box(ctx, -5, 34, 10, 44, 5, '#23222b');
        limb(ctx, 0, -40, 0, 42, 8, look.wheels);
        limb(ctx, -29, 34, 29, 34, 6, '#3a3945');
        for (const side of [-1, 1]) {
            const foot = pedal * side * 11;
            limb(ctx, side * 10, -24, side * 22, -6 + foot, 11, look.pants);
            limb(ctx, side * 22, -6 + foot, side * 13, 12 + foot, 9, look.pants);
            oval(ctx, side * 13, 16 + foot, 6.5, 8.5, '#2b2230');
        }
        oval(ctx, 0, -24, 21, 19, look.shirt);
        for (const side of [-1, 1]) {
            limb(ctx, side * 18, -22, side * 25, 4, 8, look.shirt);
            limb(ctx, side * 25, 4, side * 25, 30, 7, look.skin);
            oval(ctx, side * 25, 33, 5.5, 5.5, look.skin);
        }
        drawHead(ctx, 0, -2, look);
    }

    // Skates pushing out in turn and the arms swinging against them
    function drawRoller(ctx, look, stride) {
        const push = Math.sin(stride);
        oval(ctx, 4, 6, 25, 36, 'rgba(0, 0, 0, 0.2)');
        for (const side of [-1, 1]) {
            const footY = 24 + push * side * 15;
            const footX = side * (15 + Math.max(0, -push * side) * 8);
            limb(ctx, side * 8, -4, footX, footY - 8, 11, look.pants);
            box(ctx, footX - 7, footY - 13, 14, 28, 6, '#f6f5f8');
            for (const wheel of [-8, 0, 8]) {
                oval(ctx, footX, footY + wheel + 1, 8.5, 2.6, look.wheels);
            }
        }
        ctx.save();
        ctx.rotate(push * 0.14);
        for (const side of [-1, 1]) {
            limb(ctx, side * 19, -13, side * 33, -12 - push * side * 17, 8, look.shirt);
            oval(ctx, side * 33, -12 - push * side * 17, 5.5, 5.5, look.skin);
        }
        oval(ctx, 0, -12, 23, 16, look.shirt);
        ctx.restore();
        drawHead(ctx, 0, -6, look);
    }

    // Standing sideways on the board, arms out to keep balance, the head turned to where it goes
    function drawSkateboard(ctx, look, stride) {
        const balance = Math.sin(stride * 0.6);
        box(ctx, -12, -46, 32, 106, 15, 'rgba(0, 0, 0, 0.2)');
        ctx.rotate(balance * 0.07);
        for (const wheelY of [-33, 33]) {
            box(ctx, -19, wheelY - 5, 38, 10, 4, look.wheels);
        }
        box(ctx, -15, -52, 30, 104, 15, '#7a4a2b');
        box(ctx, -12, -48, 24, 96, 12, '#34323e');
        for (const footY of [-26, 26]) {
            limb(ctx, 0, footY / 3, 0, footY, 13, look.pants);
            box(ctx, -13, footY - 7, 26, 14, 6, '#f6f5f8');
        }
        for (const side of [-1, 1]) {
            limb(ctx, side * 3, side * 13, 31 * side, side * 21 + balance * 7, 8, look.shirt);
            oval(ctx, 31 * side, side * 21 + balance * 7, 5.5, 5.5, look.skin);
        }
        oval(ctx, 0, -2, 15, 22, look.shirt);
        drawHead(ctx, 0, 1, look);
    }

    const KIDS = {bike: drawBike, roller: drawRoller, skateboard: drawSkateboard};

    function drawThing(ctx, thing, front, stride) {
        const x = roadLeft + (thing.lane + 0.5) * laneWidth;
        const thingLength = LENGTHS[thing.kind] * carWidth * 2;
        if (thing.kind === 'car') {
            const sprite = carSprites[thing.look % carSprites.length];
            ctx.drawImage(sprite, x - sprite.width / 2, front - thingLength / 2 - sprite.height / 2);
            return;
        }
        const scale = KID_SCALE[thing.kind] * carWidth / 100;
        ctx.save();
        ctx.translate(x, front - thingLength / 2);
        ctx.scale(scale, scale);
        KIDS[thing.kind](ctx, KID_LOOKS[thing.look % KID_LOOKS.length], stride + thing.look);
        ctx.restore();
    }

    // view: rows ({y: the front in screen heights, blocks}), shownLane, lane, travelled, stride (how far the legs have gone), hurt (ms left)
    function draw(ctx, view) {
        const shift = Math.round(view.travelled * GROUND_SPEED * height) % height;
        ctx.drawImage(ground, 0, shift);
        ctx.drawImage(ground, 0, shift - height);
        for (const row of view.rows) {
            for (const block of row.blocks) {
                ctx.globalAlpha = block.hit ? 0.5 : 1; // it has done its damage and only goes past
                drawThing(ctx, block, row.y * height, view.stride);
            }
        }
        const hurt = view.hurt > 0;
        ctx.globalAlpha = hurt && Math.floor(view.hurt / 70) % 2 ? 0.55 : 1;
        const lean = Math.max(-0.5, Math.min(0.5, (view.lane - view.shownLane) * 0.7));
        const catLength = carWidth * CAT_LENGTH;
        const catY = Math.min(CAT_Y * height, height - catLength * 0.62); // her tail stays on a low, wide screen
        drawCat(ctx, roadLeft + (view.shownLane + 0.5) * laneWidth, catY, catLength / 100, view.stride, lean, hurt);
        ctx.globalAlpha = 1;
    }

    return {
        fit,
        draw,
        // In screen heights
        length: kind => LENGTHS[kind] * carWidth * 2 / height,
        newThing: () => ({kind: KINDS[Math.floor(Math.random() * KINDS.length)], look: Math.floor(Math.random() * 1000)})
    };
})();
