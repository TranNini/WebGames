// Moto Race's courses and riding, without drawing or network, so it runs in Node too (tests). All in meters and seconds.
// A course is a road from a start to a goal, built from short straight pieces (segments), each with its own bend and
// height; the road is drawn from those as seen from behind the bike. Walls line it (a hedge, a fence, shop fronts, a
// guardrail): the solid ones keep a bike on the road, and riding into one slows it. Things stand beside it (trees, lamps,
// signs), behind the walls. On a medium or hard course, things stand on the road too (a car, rocks, a stump, cones):
// riding into one stops the bike short. z is how far a bike has come from the start line; x is how far it is from the
// middle of the road (negative: left).
const Track = (() => {
    const SEGMENT = 4;
    const ROAD = 4; // half the road
    const TOP_SPEED = 62; // 223 km/h
    const SIDE_SPEED = 40; // on the kerb, between the road and a wall
    const PULL = 21; // how quickly the bike speeds up
    const BRAKE = 34;
    const STEER = 9.5; // sideways, at full steer and speed
    const OUTWARD = 1.45; // how hard a bend pushes outwards, per step of its bend, at top speed
    const DRAFT_BOOST = 0.1; // riding right behind another bike: up to this much faster
    const DRAFT_FROM = 2.5;
    const DRAFT_TO = 22;
    const SCRAPE = 0.75; // riding into a wall cuts the speed to this share, and scraping along it slows on
    const BIKE_HALF_WIDTH = 0.45;
    const BIKE_LENGTH = 2;
    const BEND = 0.0042; // turn of the road per segment, per step of its bend (radians); for the drawing
    const RUN_UP = 30; // segments before the start line, for the grid
    const RUN_OUT = 160; // segments after the goal: to stop on, and to see ahead to the end

    // The courses follow the user's pictures (MotoRace_*.png, 2026-11-11). Sections: [segments, bend (- left, + right, up
    // to 6), climb in m]; every section eases into its bend and out of it. kerb: how wide the kerb is left and right of
    // the road. walls: per side, x from the middle; things: rows beside the road, one every `every` segments.
    const TRACKS = {
        sakura: {
            name: 'Sakura River',
            about: 'Along the river, day into night',
            sections: [[65, 0, 0], [90, 1.5, 0], [65, 0, 2], [50, 0, -2], [105, -2, 0], [50, 0, 0], [90, 3, 1], [65, 0, -1],
                [90, -1.5, 0], [50, 0, 3], [50, 0, -3], [105, 2.5, 0], [65, 0, 0], [80, -3.5, 2], [65, 0, -2], [90, 1.5, 0],
                [80, -4, 0], [65, 0, 0], [80, 2, 0], [65, 0, 0]],
            kerb: [0.8, 0.9],
            walls: [
                {side: -1, x: ROAD + 1, height: 0.9, look: 'hedge', solid: true},
                {side: -1, x: ROAD + 7.5, height: 3.4, look: 'bank'},
                {side: 1, x: ROAD + 1.2, height: 1.15, look: 'fence', solid: true}
            ],
            things: [
                {kind: 'cherry', side: -1, x: [ROAD + 2.6, ROAD + 3.6], every: 2, chance: 0.95, size: [1.05, 1.35]},
                {kind: 'cherry', side: -1, x: [ROAD + 4.8, ROAD + 6.6], every: 2, offset: 1, chance: 0.85, size: [0.95, 1.2]},
                {kind: 'lamp', side: -1, x: ROAD + 1.15, every: 8},
                {kind: 'lantern', side: 1, x: ROAD + 1.25, every: 4, offset: 2}
            ],
            sign: 'chevron-yellow',
            obstacles: ['car', 'stump', 'cones', 'car']
        },
        city: {
            name: 'Neon City',
            about: 'Through the streets at night',
            sections: [[65, 0, 0], [40, 5, 0], [90, 0, 0], [40, -5, 0], [65, 0, 1], [50, 6, -1], [50, -2, 0], [80, 0, 2],
                [40, -6, -2], [90, 0, 0], [40, 5, 0], [50, 0, 2], [50, 0, -2], [40, -5, 0], [105, 0, 0], [50, 3, 0],
                [50, -3, 0], [40, 6, 0], [80, 0, 0], [40, -4, 0], [65, 0, 0]],
            kerb: [0.6, 0.7],
            walls: [
                {side: -1, x: ROAD + 0.6, height: 0.95, look: 'railing', solid: true},
                {side: -1, x: ROAD + 4.5, height: 15, look: 'shops'}, // flats over shops
                {side: 1, x: ROAD + 0.7, height: 0.85, look: 'barrier', solid: true},
                {side: 1, x: ROAD + 4, height: 18, look: 'flats'} // two floors of flats
            ],
            things: [
                {kind: 'city-cherry', side: -1, x: [ROAD + 2.2, ROAD + 2.8], every: 5, chance: 0.85, size: [0.75, 0.95]},
                {kind: 'streetlamp', side: -1, x: ROAD + 1.3, every: 9, offset: 3},
                {kind: 'streetlamp', side: 1, x: ROAD + 1.1, every: 9, offset: 7},
                {kind: 'overpass', side: 1, x: 0, every: 150, offset: 60}
            ],
            sign: 'chevron-yellow',
            obstacles: ['car', 'cones', 'car']
        },
        mountain: {
            name: 'Mountain Pass',
            about: 'Up the mountain at sunset',
            sections: [[50, 0, 0], [65, 4, 8], [40, 0, 4], [65, -5, 10], [40, 0, 4], [65, 6, 10], [50, -3, 6], [50, 4, 8],
                [40, 0, 2], [65, -6, 10], [40, 0, 4], [65, 5, 10], [50, -4, 6], [80, 3, 0], [50, -5, -6], [65, 0, 6],
                [50, 6, 8], [65, -3, 4], [50, 0, 0], [50, 4, 2], [65, 0, 0]],
            kerb: [0.9, 0.8],
            walls: [
                {side: -1, x: ROAD + 1.1, height: 7, look: 'stone', solid: true},
                {side: 1, x: ROAD + 0.9, height: 0.85, look: 'guardrail', solid: true}
            ],
            things: [
                {kind: 'sunset-cherry', side: -1, x: [ROAD + 2.4, ROAD + 4], base: 6.4, every: 3, chance: 0.75, size: [1, 1.3]},
                {kind: 'dark-tree', side: -1, x: [ROAD + 3.5, ROAD + 8], base: 6.6, every: 2, offset: 1, chance: 0.9, size: [1, 1.4]},
                {kind: 'raillight', side: 1, x: ROAD + 0.9, every: 5}
            ],
            sign: 'chevron-red',
            obstacles: ['rock', 'stump', 'rock', 'car']
        }
    };

    // How hard a course is: what stands on the road. every: m from one to the next; bend: not in a bend sharper than this;
    // pairs: how often a second one stands beside it, across the road
    const COURSE_LEVELS = {
        easy: null,
        medium: {every: [360, 540], bend: 2, pairs: 0},
        hard: {every: [140, 220], bend: 4.5, pairs: 0.4}
    };
    // How wide (half) and long they are, m: drawn bigger than they are, as the bikes are (scene.js), and counted so, a bit
    // less than they look
    const OBSTACLES = {
        car: {half: 1.15, length: 4.2},
        rock: {half: 1, length: 1.6},
        stump: {half: 0.7, length: 1},
        cones: {half: 1.35, length: 0.5}
    };
    const LANES = [-2.3, 0, 2.3];

    const built = {};

    // The same numbers on every phone, so all see the same trees
    function seeded(seed) {
        return () => {
            seed = (seed + 0x6d2b79f5) | 0;
            let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    const ease = t => t * t * (3 - 2 * t);

    function build(name, level = 'easy') {
        const key = name + ' ' + level;
        if (built[key]) {
            return built[key];
        }
        const spec = TRACKS[name];
        const segments = [];
        let height = 0;
        const add = (count, bend, climb) => {
            const start = height;
            for (let i = 0; i < count; i++) {
                const t = i / count;
                // Into the bend over the first quarter, out of it over the last
                const strength = t < 0.25 ? ease(t / 0.25) : t > 0.75 ? ease((1 - t) / 0.25) : 1;
                segments.push({
                    index: segments.length,
                    bend: bend * strength,
                    y1: start + climb * ease(t),
                    y2: start + climb * ease((i + 1) / count),
                    things: []
                });
            }
            height = start + climb;
        };
        add(RUN_UP, 0, 0);
        for (const [count, bend, climb] of spec.sections) {
            add(count, bend, climb);
        }
        const goal = segments.length;
        add(RUN_OUT, 0, 0);

        const random = seeded(name.length * 7919 + name.charCodeAt(0) * 104729);
        const limit = side => Math.min(...spec.walls.filter(wall => wall.side === side && wall.solid).map(wall => wall.x));
        segments.forEach((segment, i) => {
            for (const row of spec.things) {
                if ((i + (row.offset || 0)) % row.every !== 0 || random() >= (row.chance ?? 1)) {
                    continue;
                }
                const x = Array.isArray(row.x) ? row.x[0] + random() * (row.x[1] - row.x[0]) : row.x;
                const size = row.size ? row.size[0] + random() * (row.size[1] - row.size[0]) : 1;
                segment.things.push({kind: row.kind, x: row.side * x, base: row.base || 0, size, look: random()});
            }
            // Signs on the wall on the outside of a sharp bend, so it can be seen coming, pointing the way it goes
            if (Math.abs(segment.bend) >= 3.5 && i % 6 === 0) {
                const side = segment.bend > 0 ? -1 : 1;
                segment.things.push({kind: spec.sign, x: side * (limit(side) + 0.05), base: 0, size: 1, right: segment.bend > 0});
            }
        });
        segments[RUN_UP].things.push({kind: 'start', x: 0, base: 0, size: 1});
        segments[goal].things.push({kind: 'goal', x: 0, base: 0, size: 1});
        const length = (goal - RUN_UP) * SEGMENT;
        const track = {
            ...spec, key: name, level, segments,
            length, // from the start line to the goal
            left: limit(-1), right: limit(1), // how far the solid walls are from the middle
            obstacles: placeObstacles(spec, segments, length, COURSE_LEVELS[level], seeded(name.length * 3571 + level.length * 613))
        };
        built[key] = track;
        return track;
    }

    // What stands on the road: never right after the start or just before the goal, nor in a bend sharper than the level
    // allows, and always with room to get by on one side at least
    function placeObstacles(spec, segments, length, level, random) {
        const obstacles = [];
        if (!level) {
            return obstacles;
        }
        const place = (kind, lane, i) => {
            const x = LANES[lane] + (random() - 0.5) * 0.6;
            const obstacle = {kind, x, z: (i - RUN_UP) * SEGMENT, ...OBSTACLES[kind], look: random()};
            obstacles.push(obstacle);
            segments[i].things.push({kind, x, base: 0, size: 1, look: obstacle.look, obstacle});
        };
        let z = 240 + random() * 120;
        while (z < length - 160) {
            const i = RUN_UP + Math.floor(z / SEGMENT);
            const sharpest = Math.max(...segments.slice(i - 12, i + 3).map(segment => Math.abs(segment.bend)));
            if (sharpest > level.bend) {
                z += SEGMENT * 6;
                continue;
            }
            const kind = () => spec.obstacles[Math.floor(random() * spec.obstacles.length)];
            if (random() < level.pairs) {
                // Two, on both sides of the road, with the way through between them
                place(kind(), 0, i);
                place(kind(), 2, i + Math.floor(random() * 3));
            } else {
                place(kind(), Math.floor(random() * 3), i);
            }
            z += level.every[0] + random() * (level.every[1] - level.every[0]);
        }
        return obstacles;
    }

    function segmentAt(track, z) {
        const i = RUN_UP + Math.floor(z / SEGMENT);
        return track.segments[Math.max(0, Math.min(track.segments.length - 1, i))];
    }

    function heightAt(track, z) {
        const segment = segmentAt(track, z);
        const t = Math.max(0, Math.min(1, z / SEGMENT + RUN_UP - segment.index));
        return segment.y1 + (segment.y2 - segment.y1) * t;
    }

    // A new bike on the grid: two side by side, a row every 5 m behind the start line
    function newBike(place) {
        return {
            z: -3 - Math.floor(place / 2) * 5,
            x: place % 2 === 0 ? -1.6 : 1.6,
            speed: 0,
            steer: 0,
            draft: 0,
            offRoad: false,
            scraping: false,
            bumped: false,
            hit: null, // what on the road it ran into, until it is past it
            stopped: false, // held behind it
            power: 1 // the computer riders on hard have a little more
        };
    }

    // One step of riding. input: steer (-1 to 1), brake, gas (false: rolls out, e.g. in the menu).
    // others: the other bikes, {z, x, speed}. Says what happened: 'crash' (into something on the road), 'scrape' (into a
    // wall or along something on the road), 'bump' (into a bike) or ''.
    function ride(bike, track, input, others, seconds) {
        let happened = '';
        const segment = segmentAt(track, bike.z);
        const share = bike.speed / TOP_SPEED;
        bike.steer += (input.steer - bike.steer) * Math.min(1, seconds * 9);

        // Speed: up to the top, less on the kerb, more right behind someone
        let draftWanted = 0;
        for (const other of others) {
            const ahead = other.z - bike.z;
            if (ahead > DRAFT_FROM && ahead < DRAFT_TO && Math.abs(other.x - bike.x) < 1.4) {
                draftWanted = 1;
            }
        }
        bike.draft += (draftWanted - bike.draft) * Math.min(1, seconds * 1.5);
        bike.offRoad = Math.abs(bike.x) > ROAD + 0.2;
        const top = (bike.offRoad ? SIDE_SPEED : TOP_SPEED) * (bike.power || 1) * (1 + DRAFT_BOOST * bike.draft);
        if (input.brake) {
            bike.speed = Math.max(0, bike.speed - BRAKE * seconds);
        } else if (!input.gas) {
            bike.speed = Math.max(0, bike.speed - 8 * seconds);
        } else if (bike.speed > top) {
            bike.speed = Math.max(top, bike.speed - 30 * seconds);
        } else {
            bike.speed += PULL * (1 - bike.speed / top) * seconds + 0.4 * seconds;
            bike.speed = Math.min(bike.speed, top);
        }

        // Sideways: the rider steers, the bend pushes outwards
        bike.x += bike.steer * STEER * Math.min(1, 0.25 + share * 1.2) * seconds;
        bike.x -= segment.bend * OUTWARD * share * share * seconds;

        // Along a wall: held off it, slowed when it is hit and while it scrapes
        const leftmost = -track.left + BIKE_HALF_WIDTH;
        const rightmost = track.right - BIKE_HALF_WIDTH;
        const touching = bike.x < leftmost || bike.x > rightmost;
        if (touching) {
            bike.x = bike.x < leftmost ? leftmost + 0.05 : rightmost - 0.05;
            if (!bike.scraping) {
                bike.speed *= SCRAPE;
                happened = 'scrape';
            } else {
                bike.speed = Math.max(0, bike.speed - 6 * seconds);
            }
        }
        bike.scraping = touching;

        const frontBefore = bike.z + BIKE_LENGTH / 2;
        bike.z += bike.speed * seconds;

        // Into something on the road: from behind, the bike is stopped short and slides round it, to the side with room;
        // once clear of it, or coming from beside, it is held off it and gets by along it
        if (bike.hit && (bike.z - BIKE_LENGTH / 2 > bike.hit.z + bike.hit.length || bike.z + BIKE_LENGTH / 2 < bike.hit.z - 3)) {
            bike.hit = null;
        }
        let stopped = false;
        for (const obstacle of track.obstacles) {
            const reach = obstacle.half + BIKE_HALF_WIDTH;
            if (obstacle.z > bike.z + BIKE_LENGTH / 2 || obstacle.z + obstacle.length < bike.z - BIKE_LENGTH / 2
                || Math.abs(bike.x - obstacle.x) >= reach) {
                continue;
            }
            // Round it on the nearer side, unless a wall or something beside it is in the way there
            const clear = x => x > leftmost && x < rightmost && !track.obstacles.some(other => other !== obstacle
                && other.z < bike.z + BIKE_LENGTH && other.z + other.length > bike.z - BIKE_LENGTH
                && Math.abs(other.x - x) < other.half + BIKE_HALF_WIDTH);
            const nearer = bike.x >= obstacle.x ? 1 : -1;
            const side = clear(obstacle.x + nearer * (reach + 0.02)) || !clear(obstacle.x - nearer * (reach + 0.02)) ? nearer : -nearer;
            const firstTime = bike.hit !== obstacle;
            if ((firstTime && frontBefore <= obstacle.z + 0.4) || (!firstTime && bike.stopped)) {
                if (firstTime) {
                    happened = 'crash';
                }
                bike.z = obstacle.z - BIKE_LENGTH / 2 - 0.02;
                bike.speed = Math.min(bike.speed, 6);
                bike.x += side * 9 * seconds;
                stopped = true;
            } else {
                bike.x = obstacle.x + side * (reach + 0.02);
                if (firstTime) {
                    bike.speed *= SCRAPE;
                    happened = happened || 'scrape';
                }
            }
            bike.hit = obstacle;
            break;
        }
        bike.stopped = stopped;

        // Into another bike: the one behind slows down, both are pushed apart
        bike.bumped = false;
        for (const other of others) {
            const ahead = other.z - bike.z;
            const apart = bike.x - other.x;
            if (Math.abs(ahead) < BIKE_LENGTH && Math.abs(apart) < BIKE_HALF_WIDTH * 2) {
                if (ahead > 0 && bike.speed > other.speed) {
                    bike.speed = Math.max(0, other.speed * 0.92);
                    happened = happened || 'bump';
                }
                bike.x += (apart >= 0 ? 1 : -1) * 3 * seconds + (apart >= 0 ? 0.05 : -0.05);
                bike.bumped = true;
            }
        }
        return happened;
    }

    // After the goal: rolls on to a stop, keeping left so those still riding get by
    function cruise(bike, track, seconds) {
        const wanted = Math.max(0, Math.min(22, (track.length + 90 - bike.z) * 0.5));
        const steer = bike.speed > 1 ? Math.max(-1, Math.min(1, (-2 - bike.x) * 0.6)) : 0;
        return ride(bike, track, {steer, brake: bike.speed > wanted + 2, gas: bike.speed < wanted}, [], seconds);
    }

    // The computer riders, in the order they are in the race: how fast they like to go (a share of the top speed), where
    // on the road they like to ride, and how much their line wanders
    const COMPUTERS = [
        {skill: 0.97, lane: -1.4, wobble: 0.5},
        {skill: 0.92, lane: 1.6, wobble: 0.8},
        {skill: 0.95, lane: -0.4, wobble: 0.6},
        {skill: 0.89, lane: 0.8, wobble: 1},
        {skill: 0.93, lane: -2.4, wobble: 0.7}
    ];

    // How good the computer riders are: skill on top of their own; how much they ease off when ahead of the people and
    // push when behind; power: more top speed than a bike has; sees: how many seconds ahead they see what is on the road
    const COMPUTER_LEVELS = {
        easy: {skill: -0.03, ahead: 0.15, behind: 0.05, power: 1, sees: 0.9},
        medium: {skill: 0.04, ahead: 0.04, behind: 0.07, power: 1, sees: 1.4},
        hard: {skill: 0.06, ahead: 0.02, behind: 0.08, power: 1.04, sees: 2}
    };

    // What a computer rider does now. It keeps to its lane, cuts to the inside of a bend, slows for a bend too sharp to
    // hold at its speed, rides round a slower bike ahead and round what stands on the road, once it sees it. pace (-1 to
    // 1): + when it is far behind the people riding, - when far ahead, so it stays near them. rider: a copy of one of
    // COMPUTERS, with its level (COMPUTER_LEVELS) and its time.
    function computer(bike, track, others, rider, pace, seconds) {
        const level = rider.level || COMPUTER_LEVELS.easy;
        bike.power = level.power;
        rider.time = (rider.time || 0) + seconds;
        const share = bike.speed / TOP_SPEED;
        const reach = STEER * Math.min(1, 0.25 + share * 1.2);
        const here = segmentAt(track, bike.z).bend;
        const near = segmentAt(track, bike.z + 6 + bike.speed * 0.35).bend;
        let sharpest = 0;
        for (let ahead = 0; ahead <= bike.speed * 1.6 + 8; ahead += SEGMENT * 2) {
            const bend = segmentAt(track, bike.z + ahead).bend;
            if (Math.abs(bend) > Math.abs(sharpest)) {
                sharpest = bend;
            }
        }

        // Where on the road
        let target = rider.lane * (1 - Math.min(1, Math.abs(near) / 4)) + Math.sign(near) * Math.min(2.4, Math.abs(near) * 0.6);
        target += Math.sin(rider.time * 0.55 + rider.lane * 3) * rider.wobble;
        for (const other of others) {
            const gap = other.z - bike.z;
            if (gap > 0 && gap < 14 && other.speed < bike.speed + 1 && Math.abs(other.x - target) < 1.3) {
                target = other.x + (other.x > 0 ? -1.8 : 1.8);
            }
        }
        target = Math.max(-ROAD + 0.6, Math.min(ROAD - 0.6, target));
        let dodging = false;
        for (const obstacle of track.obstacles) {
            const ahead = obstacle.z - bike.z;
            if (ahead < -obstacle.length - 1 || ahead > bike.speed * level.sees + 10) {
                continue;
            }
            const room = obstacle.half + 1.1;
            if (Math.abs(target - obstacle.x) < room) {
                // The nearer way round that stays on the road and clear of what stands beside it
                // (close to it, only on the side it is already on: it can't get across any more)
                const ways = [obstacle.x - room, obstacle.x + room]
                    .filter(x => x > -track.left + 0.8 && x < track.right - 0.8)
                    .filter(x => !track.obstacles.some(other => other !== obstacle && Math.abs(other.z - obstacle.z) < 16
                        && Math.abs(other.x - x) < other.half + 0.8))
                    .filter((x, i, all) => ahead > 8 || all.length < 2 || Math.sign(x - obstacle.x) === Math.sign(bike.x - obstacle.x))
                    .sort((a, b) => Math.abs(a - bike.x) - Math.abs(b - bike.x));
                if (ways.length) {
                    target = ways[0];
                    dodging = true;
                }
                break;
            }
        }
        const sideways = Math.max(-8, Math.min(8, (target - bike.x) * (dodging ? 2.4 : 1.6)));
        const steer = Math.max(-1, Math.min(1, (sideways + here * OUTWARD * share * share) / reach));

        // How fast: its own top, nearer the riders' pace, and no faster than the sharpest bend coming allows
        const top = TOP_SPEED * level.power * (rider.skill + level.skill + pace * (pace > 0 ? level.behind : level.ahead));
        const bendTop = TOP_SPEED * Math.sqrt(0.8 * STEER / (Math.max(0.1, Math.abs(sharpest)) * OUTWARD));
        const wanted = Math.min(top, bendTop);
        return {steer, brake: bike.speed > wanted + 3, gas: bike.speed < wanted};
    }

    return {
        SEGMENT, ROAD, TOP_SPEED, BEND, RUN_UP, TRACKS, COMPUTERS, COMPUTER_LEVELS, COURSE_LEVELS,
        build, segmentAt, heightAt, newBike, ride, cruise, computer
    };
})();

if (typeof module !== 'undefined') {
    module.exports = Track;
}
