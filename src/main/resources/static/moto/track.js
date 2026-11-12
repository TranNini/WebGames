// Moto Race's courses and riding, without drawing or network, so it runs in Node too (tests). All in meters and seconds.
// A course is a road from a start to a goal, built from short straight pieces (segments), each with its own bend and
// height; the road is drawn from those as seen from behind the bike. Beside it is open ground with things standing on
// it (palms, rocks, cacti, pines): off the road the bike is slower, and riding into one of them is a crash. On a medium
// or hard course, things stand on the road too (a car, rocks, a stump, cones): riding into one stops the bike short. z is
// how far a bike has come from the start line; x is how far it is from the middle of the road (negative: left).
const Track = (() => {
    const SEGMENT = 4;
    const ROAD = 4; // half the road
    const EDGE = ROAD + 8; // no further off the road than this
    const TOP_SPEED = 62; // 223 km/h
    const OFF_ROAD_SPEED = 24;
    const PULL = 21; // how quickly the bike speeds up
    const BRAKE = 34;
    const STEER = 9.5; // sideways, at full steer and speed
    const OUTWARD = 1.45; // how hard a bend pushes outwards, per step of its bend, at top speed
    const DRAFT_BOOST = 0.1; // riding right behind another bike: up to this much faster
    const DRAFT_FROM = 2.5;
    const DRAFT_TO = 22;
    const SCRAPE = 0.75; // riding along something on the road cuts the speed to this share
    const CRASH_SECONDS = 1.4; // after hitting a tree or a rock beside the road: no steering, and carried back onto it
    const GHOST_SECONDS = 1.2; // then: through everything, so it can't be hit again straight away
    const BIKE_HALF_WIDTH = 0.45;
    const BIKE_LENGTH = 2;
    const BEND = 0.0042; // turn of the road per segment, per step of its bend (radians); for the drawing
    const RUN_UP = 30; // segments before the start line, for the grid
    const RUN_OUT = 160; // segments after the goal: to stop on, and to see ahead to the end

    // Sections: [segments, bend (- left, + right, up to 6), climb in m]. Every section eases into its bend and out of it.
    // The climbs of a course add up to 0, so its sections can be ridden again: laps of them, one after the other, make the
    // way from the start to the goal (three, as the first races had, so their times on the leaderboards still compare).
    const TRACKS = {
        seaside: {
            name: 'Seaside',
            about: 'Long bends along the sea',
            scenery: ['palm', 'palm', 'rock', 'hut'],
            sections: [[40, 0, 0], [60, 2, 4], [40, 0, -4], [80, -3, 0], [50, 0, 6], [70, 4, -6], [40, 0, 0], [60, -2, 3],
                [60, 3, -3], [50, 0, 0]],
            laps: 3,
            obstacles: ['car', 'cones', 'rock', 'car']
        },
        canyon: {
            name: 'Canyon',
            about: 'Sharp turns and steep hills',
            scenery: ['cactus', 'boulder', 'cactus', 'mesa'],
            sections: [[30, 0, 0], [50, 5, 0], [30, 0, 12], [40, -6, -12], [50, 0, 0], [40, 6, 9], [30, -4, 0], [60, 0, -9],
                [40, -5, 6], [40, 5, -6], [40, 0, 0]],
            laps: 3,
            obstacles: ['rock', 'rock', 'car', 'cones']
        },
        forest: {
            name: 'Forest',
            about: 'Winding through the trees at dusk',
            scenery: ['pine', 'pine', 'birch', 'log'],
            sections: [[40, 0, 0], [30, -3, 3], [30, 3, -3], [30, -4, 4], [30, 4, -4], [50, 0, 0], [60, -5, 7], [40, 0, -7],
                [30, 3, 2], [30, -3, -2], [50, 4, 0], [40, 0, 0]],
            laps: 3,
            obstacles: ['stump', 'stump', 'rock', 'car']
        }
    };
    // How wide what stands beside the road is, to ride into (half, in m)
    const SOLID = {palm: 0.5, rock: 0.9, hut: 1.8, cactus: 0.5, boulder: 1.1, mesa: 0, pine: 0.6, birch: 0.4, log: 1.2, sign: 0.4};

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
        for (let lap = 0; lap < spec.laps; lap++) {
            for (const [count, bend, climb] of spec.sections) {
                add(count, bend, climb);
            }
        }
        const goal = segments.length;
        add(RUN_OUT, 0, 0);

        const random = seeded(name.length * 7919 + name.charCodeAt(0) * 104729);
        segments.forEach((segment, i) => {
            // Signs on the outside of a sharp bend, so it can be seen coming
            if (Math.abs(segment.bend) >= 3.5 && i % 5 === 0) {
                segment.things.push({kind: 'sign', x: Math.sign(segment.bend) * (ROAD + 1.6), base: 0, size: 1, left: segment.bend > 0});
            }
            if (Math.abs(i - RUN_UP - 3) < 5 || Math.abs(i - goal - 3) < 5) {
                return; // kept clear by the banners
            }
            for (const side of [-1, 1]) {
                if (random() < 0.38) {
                    const kind = spec.scenery[Math.floor(random() * spec.scenery.length)];
                    const near = kind === 'mesa' ? 30 : 2.2;
                    const x = side * (ROAD + near + SOLID[kind] + random() * (kind === 'mesa' ? 30 : 13));
                    if (!segment.things.some(thing => Math.abs(thing.x - x) < 2.5)) {
                        segment.things.push({kind, x, base: 0, flip: random() < 0.5, size: 0.8 + random() * 0.45});
                    }
                }
            }
        });
        segments[RUN_UP].things.push({kind: 'start', x: 0, base: 0, size: 1});
        segments[goal].things.push({kind: 'goal', x: 0, base: 0, size: 1});
        const length = (goal - RUN_UP) * SEGMENT;
        const track = {
            ...spec, key: name, level, segments,
            left: EDGE, right: EDGE, // how far from the middle a bike can go
            length, // from the start line to the goal
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
            crash: 0, // seconds left of a crash
            ghost: 0, // seconds left of riding through things and bikes, after a crash
            back: 0, // where on the road a crash carries the bike
            offRoad: false,
            bumped: false,
            hit: null, // what on the road it ran into, until it is past it
            stopped: false, // held behind it
            power: 1 // the computer riders on hard have a little more
        };
    }

    // One step of riding. input: steer (-1 to 1), brake, gas (false: rolls out, e.g. in the menu).
    // others: the other bikes, {z, x, speed}. Says what happened: 'crash' (into something beside the road or on it),
    // 'scrape' (along something on the road), 'bump' (into a bike) or ''.
    function ride(bike, track, input, others, seconds) {
        let happened = '';
        const segment = segmentAt(track, bike.z);
        const share = bike.speed / TOP_SPEED;
        const steering = bike.crash > 0 ? 0 : input.steer;
        bike.steer += (steering - bike.steer) * Math.min(1, seconds * 9);
        const crashed = bike.crash > 0;
        bike.crash = Math.max(0, bike.crash - seconds);
        if (crashed && bike.crash === 0) {
            bike.ghost = GHOST_SECONDS;
        } else {
            bike.ghost = Math.max(0, bike.ghost - seconds);
        }

        // Speed: up to the top, less off the road, more right behind someone
        let draftWanted = 0;
        for (const other of others) {
            const ahead = other.z - bike.z;
            if (ahead > DRAFT_FROM && ahead < DRAFT_TO && Math.abs(other.x - bike.x) < 1.4) {
                draftWanted = 1;
            }
        }
        bike.draft += (draftWanted - bike.draft) * Math.min(1, seconds * 1.5);
        bike.offRoad = Math.abs(bike.x) > ROAD + 0.2;
        const top = (bike.offRoad ? OFF_ROAD_SPEED : TOP_SPEED) * (bike.power || 1) * (1 + DRAFT_BOOST * bike.draft);
        if (bike.crash > 0) {
            bike.speed = Math.max(3, bike.speed - BRAKE * seconds); // creeps on, back onto the road
        } else if (input.brake) {
            bike.speed = Math.max(0, bike.speed - BRAKE * seconds);
        } else if (!input.gas) {
            bike.speed = Math.max(0, bike.speed - 8 * seconds);
        } else if (bike.speed > top) {
            bike.speed = Math.max(top, bike.speed - 30 * seconds);
        } else {
            bike.speed += PULL * (1 - bike.speed / top) * seconds + 0.4 * seconds;
            bike.speed = Math.min(bike.speed, top);
        }

        // Sideways: the rider steers, the bend pushes outwards; after a crash, carried back onto the road
        if (bike.crash > 0) {
            bike.x += (bike.back - bike.x) * Math.min(1, seconds * 4);
        } else {
            bike.x += bike.steer * STEER * Math.min(1, 0.25 + share * 1.2) * seconds;
            bike.x -= segment.bend * OUTWARD * share * share * seconds;
        }
        const leftmost = -track.left + BIKE_HALF_WIDTH;
        const rightmost = track.right - BIKE_HALF_WIDTH;
        bike.x = Math.max(leftmost, Math.min(rightmost, bike.x));

        // Into a tree or a rock beside the road: slowed right down, and back onto the edge of the road on that side
        if (bike.offRoad && bike.crash === 0 && bike.ghost === 0) {
            for (const thing of segmentAt(track, bike.z + 1).things) {
                const half = thing.obstacle ? 0 : (SOLID[thing.kind] || 0) * (thing.size || 1);
                if (half > 0 && Math.abs(thing.x - bike.x) < half + BIKE_HALF_WIDTH) {
                    bike.crash = CRASH_SECONDS;
                    bike.speed = Math.min(bike.speed, 5);
                    bike.back = Math.sign(bike.x) * (ROAD - 1);
                    happened = 'crash';
                    break;
                }
            }
        }

        const frontBefore = bike.z + BIKE_LENGTH / 2;
        bike.z += bike.speed * seconds;

        // Into something on the road: from behind, the bike is stopped short and slides round it, to the side with room;
        // once clear of it, or coming from beside, it is held off it and gets by along it
        if (bike.hit && (bike.z - BIKE_LENGTH / 2 > bike.hit.z + bike.hit.length || bike.z + BIKE_LENGTH / 2 < bike.hit.z - 3)) {
            bike.hit = null;
        }
        let stopped = false;
        for (const obstacle of bike.crash > 0 || bike.ghost > 0 ? [] : track.obstacles) {
            const reach = obstacle.half + BIKE_HALF_WIDTH;
            if (obstacle.z > bike.z + BIKE_LENGTH / 2 || obstacle.z + obstacle.length < bike.z - BIKE_LENGTH / 2
                || Math.abs(bike.x - obstacle.x) >= reach) {
                continue;
            }
            // Round it on the nearer side, unless something beside it is in the way there
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
        for (const other of bike.crash > 0 || bike.ghost > 0 ? [] : others) {
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
                    .filter(x => Math.abs(x) < ROAD + 0.3) // on the road: beside it, the bike is much slower
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
        SEGMENT, ROAD, EDGE, TOP_SPEED, BEND, RUN_UP, GHOST_SECONDS, TRACKS, COMPUTERS, COMPUTER_LEVELS, COURSE_LEVELS,
        build, segmentAt, heightAt, newBike, ride, cruise, computer
    };
})();

if (typeof module !== 'undefined') {
    module.exports = Track;
}
