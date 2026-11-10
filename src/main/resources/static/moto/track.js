// Moto Race's tracks and riding, without drawing or network, so it runs in Node too (tests). All in meters and seconds.
// A track is a loop of short straight pieces (segments), each with its own bend and height: the road is drawn from
// those as seen from behind the bike. z is how far a bike has come since the start line, over all laps; x is how far
// it is from the middle of the road (negative: left).
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
    const CRASH_SECONDS = 1.1;
    const BIKE_HALF_WIDTH = 0.45;
    const BIKE_LENGTH = 2;
    const BEND = 0.0042; // turn of the road per segment, per step of its bend (radians); for the drawing

    // Sections: [segments, bend (- left, + right, up to 6), climb in m]. Every section eases into its bend and out of it.
    // The climbs of a track add up to 0, so the road meets itself at the start line.
    const TRACKS = {
        seaside: {
            name: 'Seaside',
            about: 'Long bends along the sea',
            scenery: ['palm', 'palm', 'rock', 'hut'],
            sections: [[40, 0, 0], [60, 2, 4], [40, 0, -4], [80, -3, 0], [50, 0, 6], [70, 4, -6], [40, 0, 0], [60, -2, 3],
                [60, 3, -3], [50, 0, 0]]
        },
        canyon: {
            name: 'Canyon',
            about: 'Sharp turns and steep hills',
            scenery: ['cactus', 'boulder', 'cactus', 'mesa'],
            sections: [[30, 0, 0], [50, 5, 0], [30, 0, 12], [40, -6, -12], [50, 0, 0], [40, 6, 9], [30, -4, 0], [60, 0, -9],
                [40, -5, 6], [40, 5, -6], [40, 0, 0]]
        },
        forest: {
            name: 'Forest',
            about: 'Winding through the trees at dusk',
            scenery: ['pine', 'pine', 'birch', 'log'],
            sections: [[40, 0, 0], [30, -3, 3], [30, 3, -3], [30, -4, 4], [30, 4, -4], [50, 0, 0], [60, -5, 7], [40, 0, -7],
                [30, 3, 2], [30, -3, -2], [50, 4, 0], [40, 0, 0]]
        }
    };
    // How wide what stands by the road is, to ride into (half, in m)
    const SOLID = {palm: 0.5, rock: 0.9, hut: 1.8, cactus: 0.5, boulder: 1.1, mesa: 0, pine: 0.6, birch: 0.4, log: 1.2, sign: 0.4};

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
        for (const [count, bend, climb] of spec.sections) {
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
        }
        const random = seeded(name.length * 7919 + name.charCodeAt(0) * 104729);
        segments.forEach((segment, i) => {
            // Signs on the outside of a sharp bend, so it can be seen coming
            if (Math.abs(segment.bend) >= 3.5 && i % 5 === 0) {
                segment.things.push({kind: 'sign', x: Math.sign(segment.bend) * (ROAD + 1.6), left: segment.bend > 0});
            }
            if (i < 8) {
                return; // the start is kept clear, for the banner
            }
            for (const side of [-1, 1]) {
                if (random() < 0.38) {
                    const kind = spec.scenery[Math.floor(random() * spec.scenery.length)];
                    const near = kind === 'mesa' ? 30 : 2.2;
                    const x = side * (ROAD + near + SOLID[kind] + random() * (kind === 'mesa' ? 30 : 13));
                    if (!segment.things.some(thing => Math.abs(thing.x - x) < 2.5)) {
                        segment.things.push({kind, x, flip: random() < 0.5, size: 0.8 + random() * 0.45});
                    }
                }
            }
        });
        const track = {...spec, key: name, segments, length: segments.length * SEGMENT};
        built[name] = track;
        return track;
    }

    const wrap = (track, z) => ((z % track.length) + track.length) % track.length;

    function segmentAt(track, z) {
        return track.segments[Math.floor(wrap(track, z) / SEGMENT)];
    }

    function heightAt(track, z) {
        const segment = segmentAt(track, z);
        const t = (wrap(track, z) % SEGMENT) / SEGMENT;
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
            offRoad: false,
            bumped: false
        };
    }

    // One step of riding. input: steer (-1 to 1), brake, gas (false: rolls out, e.g. in the menu).
    // others: the other bikes, {z, x, speed}. Says what happened: 'crash' or 'bump' or ''.
    function ride(bike, track, input, others, seconds) {
        let happened = '';
        const segment = segmentAt(track, bike.z);
        const share = bike.speed / TOP_SPEED;
        const steering = bike.crash > 0 ? 0 : input.steer;
        bike.steer += (steering - bike.steer) * Math.min(1, seconds * 9);
        bike.crash = Math.max(0, bike.crash - seconds);

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
        const top = (bike.offRoad ? OFF_ROAD_SPEED : TOP_SPEED) * (1 + DRAFT_BOOST * bike.draft);
        if (bike.crash > 0) {
            bike.speed = Math.max(0, bike.speed - BRAKE * 1.5 * seconds);
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

        // Sideways: the rider steers, the bend pushes outwards
        bike.x += bike.steer * STEER * Math.min(1, 0.25 + share * 1.2) * seconds;
        bike.x -= segment.bend * OUTWARD * share * share * seconds;
        bike.x = Math.max(-EDGE, Math.min(EDGE, bike.x));

        // Into a tree or a rock: almost stopped, and back on the road a bit
        if (bike.offRoad && bike.crash === 0) {
            for (const thing of segmentAt(track, bike.z + 1).things) {
                const half = SOLID[thing.kind] * (thing.size || 1);
                if (half > 0 && Math.abs(thing.x - bike.x) < half + BIKE_HALF_WIDTH) {
                    bike.crash = CRASH_SECONDS;
                    bike.speed = Math.min(bike.speed, 6);
                    bike.x += thing.x > bike.x ? -1.2 : 1.2;
                    happened = 'crash';
                }
            }
        }

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

    // After the finish: rides on slowly in the middle of the road
    function cruise(bike, track, seconds) {
        const wanted = Math.max(-1, Math.min(1, -bike.x * 0.6));
        return ride(bike, track, {steer: wanted, brake: bike.speed > 26, gas: bike.speed < 24}, [], seconds);
    }

    return {
        SEGMENT, ROAD, EDGE, TOP_SPEED, BEND, BIKE_HALF_WIDTH, TRACKS,
        build, segmentAt, heightAt, wrap, newBike, ride, cruise
    };
})();

if (typeof module !== 'undefined') {
    module.exports = Track;
}
