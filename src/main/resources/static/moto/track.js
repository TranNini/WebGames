// Moto Race's courses and riding, without drawing or network, so it runs in Node too (tests). All in meters and seconds.
// A course is a road from a start to a goal, built from short straight pieces (segments), each with its own bend and
// height; the road is drawn from those as seen from behind the bike. Walls line it (a hedge, a fence, shop fronts, a
// guardrail): the solid ones keep a bike on the road, and riding into one slows it. Things stand beside it (trees, lamps,
// signs), behind the walls. z is how far a bike has come from the start line; x is how far it is from the middle of the
// road (negative: left).
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
            sign: 'chevron-yellow'
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
            sign: 'chevron-yellow'
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
            sign: 'chevron-red'
        }
    };

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

    function build(name) {
        if (built[name]) {
            return built[name];
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
        const track = {
            ...spec, key: name, segments,
            length: (goal - RUN_UP) * SEGMENT, // from the start line to the goal
            left: limit(-1), right: limit(1) // how far the solid walls are from the middle
        };
        built[name] = track;
        return track;
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
            bumped: false
        };
    }

    // One step of riding. input: steer (-1 to 1), brake, gas (false: rolls out, e.g. in the menu).
    // others: the other bikes, {z, x, speed}. Says what happened: 'scrape' (into a wall), 'bump' (into a bike) or ''.
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
        const top = (bike.offRoad ? SIDE_SPEED : TOP_SPEED) * (1 + DRAFT_BOOST * bike.draft);
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

        bike.z += bike.speed * seconds;

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

    return {
        SEGMENT, ROAD, TOP_SPEED, BEND, RUN_UP, TRACKS,
        build, segmentAt, heightAt, newBike, ride, cruise
    };
})();

if (typeof module !== 'undefined') {
    module.exports = Track;
}
