// Moto Race's courses and riding, without drawing or network, so it runs in Node too (tests). All in meters and seconds.
// A course is a road from a start to a goal, built from short straight pieces (segments), each with its own bend and
// height; the road is drawn from those as seen from behind the bike. Beside it is open ground with things standing on
// it (palms, rocks, cacti, pines, towers): off the road the bike is slower, and riding into one of them is a crash. On a medium
// or hard course, things stand on the road too (a car, rocks, a stump, cones): riding into one stops the bike short. z is
// how far a bike has come from the start line; x is how far it is from the middle of the road (negative: left). A ramp
// across the road throws a bike into the air: it flies at the speed it had, so where it is in the air follows from where
// it is and how fast it goes, and every phone can work it out for the others (airOf).
const Track = (() => {
    const SEGMENT = 4;
    const ROAD = 4; // half the road, as in the game
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
    const TURBO_DISTANCE = 50; // turbo: this many m faster,
    const TURBO_SPEED = 1.3; // up to this much over the top speed (290 km/h),
    const TURBO_PULL = 40; // speeding up this hard (m/s each second);
    const TURBO_COOLDOWN = 10; // then this many seconds before it can be used again
    const SEPARATE = 2.5; // m/s: how quickly two bikes that touch ease apart
    const SCRAPE = 0.75; // riding along something on the road cuts the speed to this share
    const CRASH_SECONDS = 1.4; // after hitting a tree or a rock beside the road: no steering, and carried back onto it
    const GHOST_SECONDS = 1.2; // then: through everything, so it can't be hit again straight away
    const BIKE_HALF_WIDTH = 0.45;
    const BIKE_LENGTH = 2;
    const BEND = 0.0042; // turn of the road per segment, per step of its bend (radians); for the drawing
    const RUN_UP = 30; // segments before the start line, for the grid
    const RUN_OUT = 160; // segments after the goal: to stop on, and to see ahead to the end
    const RAMP_SEGMENTS = 2; // a ramp is this long, up to its lip
    const RAMP_HEIGHT = 1.5;
    const LIFT = 0.22; // leaving the lip: upwards, this share of the speed
    const GRAVITY = 22; // more than real, so a jump at full speed is about 80 m and not much more than a second
    const AIR_STEER = 0.3; // in the air, the rider can turn only this much

    // Sections: [segments, bend (- left, + right; 6 can just be held at full speed, more needs braking), climb in m]. Every
    // section eases into its bend and out of it.
    // The climbs of a course add up to 0, so its sections can be ridden again: laps of them, one after the other, make the
    // way from the start to the goal (three, as the first races had, so their times on the leaderboards still compare).
    // Tianmen, as in the html test (tianmen-to-chongqing-course.html), in its 2 m steps: a short straight, then three
    // stretches one after the other, each a list of bends easing in, held and easing out [steps in, held, steps out, turn
    // per step (rad)], then straight on to its end. The mountain: ten hairpins, right and left in turn; the road drops away
    // from 100 m on, steepest in the middle, then once more, steeply, through the last tunnel, which comes out in Chongqing
    // at night; three long tunnels; a river along the valley floor below the road. Then a bridge over the river with long
    // gentle bends, and the riverside under the old town. Day turns to dusk on the way down, and night in the city.
    const STEP = 2;
    const STRETCHES = [
        {kind: 'mountain', steps: 975, tod: 0.05, water: -14, bends: [[18, 40, 18, 0.045], [18, 25, 18, -0.047], [18, 60, 18, 0.045],
            [18, 40, 18, -0.047], [18, 50, 18, 0.045], [18, 60, 18, -0.047], [18, 40, 18, 0.045], [18, 50, 18, -0.047],
            [18, 60, 18, 0.045], [18, 40, 18, -0.047]]},
        {kind: 'bridge', steps: 960, tod: 0.95, water: -14, bends: [[30, 50, 30, 0], [50, 70, 50, 0.006], [30, 485, 30, 0]]},
        {kind: 'riverside', steps: 951, tod: 1, water: -9, bends: [[50, 150, 50, 0.02], [40, 60, 40, -0.012], [50, 70, 50, 0.016]]}
    ];
    const DESCENT_TUNNELS = [[110, 215], [355, 535], [795, 975]]; // steps into the mountain
    const BOATS = 16; // on the mountain's river
    const CITY_WATER = -2.6; // m: in the city the river comes up to just below the road
    const LAMPS = 120; // along the bridge and the riverside: lamp posts (every third in the riverside) or lights in the rails

    const TRACKS = {
        seaside: {
            name: 'Seaside',
            about: 'Long bends along the sea',
            // Half the huts are beach spots: a sun umbrella, a swim ring and a sun chair
            scenery: ['palm', 'palm', 'palm', 'palm', 'rock', 'rock', 'hut', 'beach'],
            sections: [[40, 0, 0], [60, 4, 4], [40, 0, -4], [40, -5, 0], [40, 3, 0], [50, 0, 6], [70, 5, -6], [40, 0, 0],
                [30, -6, 3], [30, -2, 0], [60, 4, -3], [50, 0, 0]],
            ramps: [[7, 2], [11, 2]], // [section, segments into it]: on straights, with room to land
            laps: 3,
            obstacles: ['car', 'cones', 'crabs', 'car']
        },
        canyon: {
            name: 'Canyon',
            about: 'Sharp turns and steep hills',
            scenery: ['cactus', 'boulder', 'cactus', 'mesa'],
            // Rolling crests on the straights, over which the road can't be seen
            sections: [[30, 0, 0], [50, 5, 4], [30, 0, 10], [40, -6, -12], [20, 0, -5], [15, 0, 6], [15, 0, -5], [40, 6, 9],
                [30, -4, 2], [20, 0, -6], [20, 0, 5], [20, 0, -8], [40, -5, 6], [40, 5, -6], [20, 0, 4], [20, 0, -4]],
            laps: 3,
            obstacles: ['rock', 'rock', 'car', 'cones'],
            // Its own levels: medium has what is on the road on hard (the same, where it was); hard has that too, in
            // sharper bends as well, on a wilder road (as long, with higher crests, deeper drops, more bends and some to
            // brake for)
            levels: {
                medium: {obstacles: 'hard', about: 'Lots on the road'},
                hard: {
                    obstacles: 'hard', obstaclesInBends: 6, about: 'Lots on the road, big hills, sharp bends',
                    sections: [[30, 0, 0], [30, 5, 8], [25, -6, 10], [20, 0, 6], [30, 7, -18], [15, 0, -8], [15, 0, 9],
                        [15, 0, -9], [30, -7, 12], [25, 6, -4], [25, -5, 8], [20, 0, -10], [15, 0, 8], [15, 0, -8],
                        [30, 6, 15], [30, -7, -14], [25, 5, 0], [20, -4, -6], [20, 0, 4], [15, 0, -3]]
                }
            }
        },
        forest: {
            name: 'Forest',
            about: 'Winding through the trees at dusk',
            scenery: ['pine', 'pine', 'birch', 'log'],
            sections: [[40, 0, 0], [30, -3, 3], [30, 3, -3], [30, -4, 4], [30, 4, -4], [50, 0, 0], [60, -5, 7], [40, 0, -7],
                [30, 3, 2], [30, -3, -2], [50, 4, 0], [40, 0, 0]],
            laps: 3,
            obstacles: ['stump', 'stump', 'rock', 'car']
        },
        // A countryside road in Japan: rice fields on the left, an elevated railway wall and cherry trees on the right
        countryside: {
            name: 'Mountain Passage',
            about: 'Rice fields and cherry blossoms along a railway, then up into the Sa Pa valley',
            country: true, // its scenery is placed below, not drawn from a list
            scenery: [],
            // One ride from the start A to the goal B, 5.5 km: the flat countryside (430 segments), the road climbing away from
            // the railway (270), the way into the valley (50), then the valley (625). The scenery of 3 to 4.6 km is cut (see
            // mapA): the way into the valley runs on into the open valley, and the length cut is added to the end
            sections: [[40, 0, 0], [60, 2.5, 0], [40, 0, 0], [12, 0, 0], [60, 3, 0], [40, 0, 0], [50, 2, 0], [50, -2, 0], [40, 0, 0],
                [60, -2, 3], [35, 0, 5], [60, -2, 5], [25, 0, 4], [40, 2.5, 3],
                [50, 2, 6],
                [60, -2, 1], [60, 2.5, 0], [60, -1.5, 1], [55, 1, 0],
                [60, -2, 3], [60, 2.5, 2], [60, -1.5, 2], [60, 1.5, 0], [60, -2, 1], [60, 2.5, 0], [243, -1, 0]],
            runOut: 24,
            cut: [150, 175],
            cut2: [1270, 38], // 150 m off the end, on the viewpoint (layout 1445 to 1483)
            // (the first 125 are the old cut, 500 m from 4.7 km to go; 50 more, 200 m from 4.9 km to go, make the course 5.3 km)
            cutSmooth: 12, // the bend the cut leaves is eased out over this many segments, not dropped at once // 500 m (4.7 to 4.2 km to go) are taken out of the flat countryside; the course is 125 segments longer at the end (the last section) to make up for it
            // Sharp bends [segment from the start, bend, half width]: 3.3, 3.0, 2.6 and 2.5 km to go
            straight: true,
            sharp: [[125, -7.5, 14], [325, 7.5, 15], [475, -6, 22], [525, 7.5, 15], [575, -7.5, 15], [725, 7.5, 12], [750, -7.5, 12], [775, 7.5, 12]],
            // Two dips with a rise after each, in the first 1.2 km (before the first train), ending level again [segment from the start, length, depth in m]
            curves: [[1080, 3.4, 100], [1408, -3.4, 38], [125, -7.5, 14], [157, 7.5, 14], [555, -12, 20], [595, 12, 20], [635, -12, 20], [675, 12, 20], [715, -12, 20], [755, 12, 20]], // two curves right after the dip and rise (left, then right)
            rises: [[865, 40, 16], [985, 200, 26]], // (the second: the climb round the final mountain bend) // after the last dip: one more rise, and the road stays up there
            dips: [[5, 95, 15], [780, 40, 14, 1.7], [825, 40, 14, 1.7]], // the last two: steep dips with high rises, 20 m after the last bend
            laps: 1,
            obstacles: ['car', 'cones', 'car']
        },
        tianmen: {
            name: "Heaven's Gate", // the name in the user's test page (its key stays tianmen: boards, saved choices)
            about: 'Down the mountain and on into Chongqing at night',
            // Built from the test's course (descend()): the mountain between a forest slope and a stone wall over the
            // valley, then the city's bridge and riverside between rails (drawn by scene.js), nothing beside the road. Its
            // bends push a bike out this share of how sharp they look, so the hairpins ride like bends of 7.
            descent: {bends: 1 / 3},
            laps: 1, // from the top to the foot: not a loop
            bendSlow: 0.4, // in the tightest hairpins a bike goes this much slower by itself (not in the city)
            obstacles: ['sledge', 'truck', 'sledge', 'moped', 'rockslide', 'sledge', 'truck', 'sledge'], // a stone sledge: a sledge hauling a stone block
            levels: {
                // The same way down, its bends pushing less
                easy: {bends: 0.2, about: 'A clear road, softer bends'},
                // Most of it is hairpins and tunnels (nothing stands in those): things stand in the right-hand hairpins on medium, in all on hard
                medium: {obstacles: 'medium', obstaclesInBends: 7.2},
                hard: {obstacles: 'hard', obstaclesInBends: 7.5}
            }
        }
    };
    // How wide what stands beside the road is, to ride into (half, in m)
    const SOLID = {palm: 0.5, rock: 0.9, hut: 1.8, cactus: 0.5, boulder: 1.1, mesa: 0, pine: 0.6, birch: 0.4, log: 1.2, sign: 0.4, beach: 1.3,
        cherry: 0.7, lamp: 0.25, pole: 0, farmhouse: 0, ox: 0, farmerBend: 0, farmerStand: 0};
    // What stands further off: at least this far from the road's edge, and up to this much further
    const FAR = {mesa: [30, 30]};
    const WALL = ROAD * 1.13; // mountain roads: the cliff and the parapet stand at the outer edge of the kerb
    const TUNNEL_HEIGHT = 5.5;

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
        cones: {half: 1.35, length: 0.5},
        crabs: {half: 1.3, length: 0.6},
        truck: {half: 1.2, length: 6},
        moped: {half: 0.5, length: 1.8},
        rockslide: {half: 1.3, length: 2},
        sledge: {half: 1.05, length: 2.4}
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
        const own = (spec.levels && spec.levels[level]) || {};
        const sections = own.sections || spec.sections;
        const segments = [];
        let height = 0;
        let goal;
        let descent = null;
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
        if (spec.descent) {
            // Two of the test's steps to a segment: the bend it is drawn with (view) and the one that pushes the bike (only
            // the mountain's hairpins slow a bike down by themselves)
            const total = STRETCHES.reduce((sum, stretch) => sum + stretch.steps, 0);
            goal = (RUN_UP * SEGMENT + 20 * STEP + total * STEP) / SEGMENT;
            descent = descend((goal + RUN_OUT) * SEGMENT / STEP + 240, goal * SEGMENT / STEP);
            const bends = own.bends || spec.descent.bends;
            for (let i = 0; i < goal + RUN_OUT; i++) {
                const view = (descent.turn[2 * i] + descent.turn[2 * i + 1]) / BEND;
                segments.push({
                    index: i, bend: view * bends, view, y1: descent.height[2 * i], y2: descent.height[2 * i + 2], things: [],
                    walls: true, tunnel: descent.tunnel[2 * i] || descent.tunnel[2 * i + 1],
                    slows: descent.kind[2 * i] === 'mountain'
                });
            }
        } else {
            add(RUN_UP, 0, 0);
            for (let lap = 0; lap < spec.laps; lap++) {
                for (const [count, bend, climb] of sections) {
                    add(count, bend, climb);
                }
            }
            for (const [center, bend, half] of spec.sharp || []) {
                for (let d = -half; d <= half; d++) {
                    const segment = segments[RUN_UP + center + d];
                    const share = ease(Math.min(1, (1 - Math.abs(d) / half) / 0.4)); // a steady, round arc with short ends
                    segment.bend = segment.bend * (1 - share) + bend * share;
                }
            }
            if (spec.straight) {
                segments.forEach(segment => { segment.bend = 0; }); // no curves at all for now (the lists stay, to put them back)
            }
            for (const [center, bend, half] of spec.curves || []) { // the curves in use while 'straight' is on
                for (let d = -half; d <= half; d++) {
                    const segment = segments[RUN_UP + center + d];
                    const share = ease(Math.min(1, (1 - Math.abs(d) / half) / 0.4));
                    segment.bend = segment.bend * (1 - share) + bend * share;
                }
            }
            for (const [start, length, depth, riseTimes = 1] of spec.dips || []) {
                const level = s => { // a dip, then a rise (riseTimes: how much higher than the dip is deep)
                    const u = Math.max(0, Math.min(1, s / length));
                    const v = Math.sin(2 * Math.PI * u) * Math.sin(Math.PI * u);
                    return -depth * v * (v < 0 ? riseTimes : 1);
                };
                for (let k = 0; k < length; k++) {
                    const segment = segments[RUN_UP + start + k];
                    segment.y1 += level(k);
                    segment.y2 += level(k + 1);
                }
            }
            goal = segments.length;
            add(spec.runOut || RUN_OUT, 0, 0); // (the countryside's road ends 120 m after the goal, at the edge of the viewpoint)
            for (const [start, length, rise] of spec.rises || []) { // a rise that stays: the road keeps the higher level to the end
                for (let i = RUN_UP + start; i < segments.length; i++) {
                    const k = i - RUN_UP - start;
                    segments[i].y1 += rise * ease(Math.min(1, k / length));
                    segments[i].y2 += rise * ease(Math.min(1, (k + 1) / length));
                }
            }
        }

        // The ramps, in every lap: the segments up to the lip are raised (drawn by scene.js)
        const ramps = [];
        const lapLength = (spec.sections || []).reduce((sum, [count]) => sum + count, 0);
        for (let lap = 0; lap < (own.sections ? 0 : spec.laps); lap++) {
            for (const [section, into] of spec.ramps || []) {
                const first = RUN_UP + lap * lapLength + spec.sections.slice(0, section).reduce((sum, [count]) => sum + count, 0) + into;
                for (let k = 0; k < RAMP_SEGMENTS; k++) {
                    segments[first + k].ramp = [RAMP_HEIGHT * k / RAMP_SEGMENTS, RAMP_HEIGHT * (k + 1) / RAMP_SEGMENTS];
                }
                const z0 = (first - RUN_UP) * SEGMENT;
                ramps.push({z0, z1: z0 + RAMP_SEGMENTS * SEGMENT});
            }
        }

        const random = seeded(name.length * 7919 + name.charCodeAt(0) * 104729);
        segments.forEach((segment, i) => {
            // Signs on the outside of a sharp bend, so it can be seen coming
            if (Math.abs(segment.bend) >= 3.5 && i % 5 === 0 && !segment.walls) {
                segment.things.push({kind: 'sign', x: Math.sign(segment.bend) * (ROAD + 1.6), base: 0, size: 1, left: segment.bend > 0});
            }
            if (Math.abs(i - RUN_UP - 3) < 5 || Math.abs(i - goal - 3) < 5) {
                return; // kept clear by the banners
            }
            if (spec.descent) {
                return; // between its walls: nothing beside the road
            }
            if (spec.country) {
                // Left: rice fields (drawn by scene.js) with a village, oxen and farmers; right: cherry trees between the guardrail
                // and the railway wall, whose posts stand on its top; lamp posts on the left, beside the road
                const at = i - RUN_UP;
                const P = terrain(segments, at + 0.5);
                const am = mapA(at);
                const put = (kind, x, size, extra) => segment.things.push({kind, x, base: 0, flip: random() < 0.5, size, ...extra});
                // On the left, things stand on the ground there (the fields, later the terraces); on the right on the hillside
                const onLeft = (kind, off, size, extra) => put(kind, -off, size, {base: leftHeight(P, off), ...extra});
                // Three parked mopeds on the wide grass on the right, away from the village (no random() here)
                const farMopeds = {520: [10, 1 + 3 * 2], 690: [11, 2 + 3 * 3], 940: [10, 0 + 3 * 0]}; // [offset, colour + 3 * view]
                if (farMopeds[at]) {
                    segment.things.push({kind: 'moped', x: farMopeds[at][0], base: rightHeight(P, farMopeds[at][0]), flip: false, size: 1, variant: farMopeds[at][1], final: true});
                }
                const onRight = (kind, off, size, extra) => put(kind, off, size, {base: rightHeight(P, off), ...extra});
                if (at >= 985) {
                    // The final mountain bend and the viewpoint: forest and rock on the slopes, then only a few bushes and small
                    // trees (placed from the step number, not from the random numbers)
                    const f1 = (at * 0.6180339887) % 1;
                    const f2 = (at * 0.7548776662) % 1;
                    const f3 = (at * 0.5698402909) % 1;
                    const dense = (0.12 + 0.88 * (1 - sm(1140, 1360, at))) * (1 - 0.85 * P.Vg);
                    const place = (kind, x, size, base) => segment.things.push({kind, x, base, flip: f3 < 0.5, size, final: true});
                    if (at < 1350) {
                        // The forest: pines at several distances on both slopes, with bushes under them
                        const f4 = (at * 0.4142135623) % 1;
                        const f5 = (at * 0.7320508075) % 1;
                        if (f1 < dense) {
                            const off = 11 + f2 * 45;
                            place(f3 < 0.1 ? 'rock' : 'pine', -off, 1.4 + f3 * 1.3, leftHeight(P, off));
                        }
                        if (f4 < dense * 0.85) {
                            const off = 12 + f5 * 95;
                            place('pine', -off, 1.6 + f1 * 1.2, leftHeight(P, off));
                        }
                        if (f3 < dense * 0.75) {
                            const off = 10.5 + f5 * 30;
                            place('bush', -off, 0.9 + f2 * 0.7, leftHeight(P, off));
                        }
                        const span = Math.max(3, P.Lc - WALL_AT - 1);
                        const rightPlace = (kind, off, size) => {
                            const hr = rightHeight(P, off);
                            if (hr > -0.8) { // (not down the slope beside the road, where it would seem to hang over the valley)
                                place(kind, off, size, hr);
                            }
                        };
                        if (f2 < dense) {
                            rightPlace(f3 < 0.12 ? 'rock' : 'pine', WALL_AT + 2 + f1 * span, 1.4 + f3 * 1.3);
                        }
                        if (f5 < dense * 0.85) {
                            rightPlace('pine', WALL_AT + 1.5 + f4 * span, 1.5 + f2 * 1.2);
                        }
                        if (f1 < dense * 0.7) {
                            rightPlace('bush', WALL_AT + 0.8 + f3 * span * 0.8, 0.9 + f5 * 0.7);
                        }
                    }
                    const beforeVillage = segment.things.length;
                    if (P.Vg > 0.5) {
                        // The village: houses either side of the road, farmers, hens, baskets and lamps, a few banana plants and palms
                        const side = k => (k ? 1 : -1);
                        const lift = (off, right) => right ? rightHeight(P, off) : leftHeight(P, off) + (off < 12 ? 0.35 : 0); // (on the left, close to the road, a little higher: the bank there hid their feet)
                        if (at % 9 === 2) {
                            const off = 13 + f2 * 10;
                            place('vhut', -off, 1.8 + f3 * 0.5, lift(off, false));
                        }
                        if (at % 9 === 6) {
                            const off = 11 + f1 * 9;
                            place('vhut', off, 1.8 + f3 * 0.5, lift(off, true));
                        }
                        if (at % 9 === 0) {
                            place(f1 < 0.5 ? 'farmerStand' : 'farmerBend', -(8.5 + f2 * 3), 1.7, lift(9, false));
                        }
                        if (at % 9 === 4) {
                            place('chicken', 7.5 + f2 * 3, 1.4, lift(8, true));
                            place('chicken', 8.3 + f1 * 3, 1.2, lift(8, true));
                        }
                        if (at % 9 === 7) {
                            place(f1 < 0.5 ? 'basket' : 'claypot', -(7.8 + f2 * 2), 1.4, lift(8, false));
                        }
                        // parked mopeds, seen from behind (the same way the riders are): both sides of the street, a few in pairs
                        const gone = at === 1277 || at === 1293 || at === 1321 || at === 1333 || at === 1347; // (five fewer mopeds)
                        if (at % 14 === 3 && !gone) {
                            segment.things.push({kind: 'moped', x: -(8.3 + f2 * 2.2), base: lift(9, false), flip: false, size: 1, variant: Math.floor(f1 * 3) + 3 * (Math.floor(at / 14) % 4), final: true});
                        }
                        if (at % 14 === 9 && !gone) {
                            segment.things.push({kind: 'moped', x: 8 + f2 * 2.2, base: lift(9, true), flip: false, size: 1, variant: Math.floor(f1 * 3) + 3 * ((Math.floor(at / 14) + 2) % 4), final: true});
                        }
                        if (at % 28 === 5 && !gone) {
                            segment.things.push({kind: 'moped', x: -(10.2 + f2 * 1.2), base: lift(10, false), flip: false, size: 1, variant: Math.floor(f2 * 3) + 3 * ((Math.floor(at / 14) + 1) % 4), final: true});
                        }
                        if (at % 12 === 5) {
                            place('farmerStand', 7.8 + f2 * 2, 1.7, lift(8, true));
                        }
                        if (at % 6 === 0) {
                            place('lamp', -(ROAD + 1.4), 1, 0);
                        }
                        if (at % 5 === 1 && f1 < 0.7) {
                            const off = 14 + f2 * 16;
                            const right = f3 < 0.5;
                            place(f3 < 0.15 || (f3 > 0.5 && f3 < 0.6) ? 'palm' : 'banana', right ? off : -off, 1.4 + f1 * 0.5, lift(off, right));
                        }
                    }
                    for (let q = beforeVillage; q < segment.things.length; q++) {
                        segment.things[q].village = true;
                    }
                    if (at >= 1340) {
                        if (at % 6 === 2 && f1 < 0.7) {
                            const off = 8 + f2 * 5;
                            place('bush', off, 0.8 + f3 * 0.5, rightHeight(P, off));
                        }
                        if (at % 11 === 4 && f1 < 0.8) {
                            const off = 13 + f2 * 30;
                            place(f3 < 0.5 ? 'pine' : 'bush', -off, 1.2 + f3 * 0.8, leftHeight(P, off));
                        }
                        if (at % 29 === 7) {
                            place('bush', 9.5 + f2 * 3, 0.9 + f3 * 0.3, rightHeight(P, 10));
                        }
                    }
                    return;
                }
                if (at === 522) {
                    put('cartRear', 14, 1.5, {base: rightHeight(P, 14), flip: false});
                }
                if (at === 586) {
                    put('cartFront', 12, 1.5, {base: rightHeight(P, 12), flip: false});
                }
                // Two houses on top of the hill
                if (at === 548 || at === 508) {
                    put('vhut', P.Lc + (at === 548 ? 3 : 6), 1.9, {base: rightHeight(P, P.Lc + (at === 548 ? 3 : 6)), flip: at === 508});
                }
                // Five carts on the grass strip beside the road on the right (road level, between the guardrail and the wall)
                const roadCarts = {137: ['cart', 8.6, true], 176: ['cartRear', 8.8, false], 331: ['cartFront', 8.8, true], 389: ['cart', 8.6, false], 443: ['cartRear', 8.8, true]};
                if (roadCarts[at]) {
                    const [kind, off, flip] = roadCarts[at];
                    put(kind, off, kind === 'cart' ? 1.3 : 1.4, {base: 0, flip});
                }
                // Three more houses on the hill top
                const moreHouses = {536: [4.5, 1.8, false], 560: [8, 2, true], 522: [4, 1.7, false]};
                if (moreHouses[at]) {
                    const [d, size, flip] = moreHouses[at];
                    put('vhut', P.Lc + d, size, {base: rightHeight(P, P.Lc + d), flip});
                }
                // Two houses on the wide green ground on the right, with a cart and a basket close to the road
                const farmYard = {630: ['vhut', 21, 1.7, false], 646: ['vhut', 33, 1.8, true], 636: ['cart', 15, 1.6, true], 633: ['basket', 17, 1.4, false], 641: ['basket', 8.2, 1.3, false]};
                if (farmYard[at]) {
                    const [kind, off, size, flip] = farmYard[at];
                    put(kind, off, size, {base: rightHeight(P, off), flip, late: true});
                }
                // The same farm yard at the foot of the hill, by the first curve of the bends
                const footYard = {540: ['vhut', 15, 1.7, false], 557: ['vhut', 24, 1.8, true], 546: ['cart', 11.5, 1.6, true], 543: ['basket', 13.5, 1.4, false], 551: ['basket', 8.2, 1.3, false]};
                if (footYard[at]) {
                    const [kind, off, size, flip] = footYard[at];
                    put(kind, off, size, {base: rightHeight(P, off), flip, late: true});
                }
                // And another at the foot of the hill by its end
                const endYard = {590: ['vhut', 15, 1.7, true], 607: ['vhut', 24, 1.8, false], 600: ['cart', 12, 1.6, false], 594: ['basket', 13.5, 1.4, false], 603: ['basket', 8.2, 1.3, false]};
                if (endYard[at]) {
                    const [kind, off, size, flip] = endYard[at];
                    put(kind, off, size, {base: rightHeight(P, off), flip, late: true});
                }
                // More bamboo between the first and the second yard, on the foot of the hill (no random() here: the rest stays as it was)
                if (at >= 560 && at <= 588 && at % 3 === 1) {
                    const k = (at - 560) / 3;
                    const off = 14 + (k * 7.3) % 13 + (k % 2) * 3;
                    put('bamboo', off, 1.4 + (k * 0.37) % 0.5, {base: rightHeight(P, off), flip: k % 2 === 0, late: true});
                    if (k % 3 === 0) {
                        const o2 = off + 3.2;
                        put('bamboo', o2, 1.2 + (k * 0.21) % 0.4, {base: rightHeight(P, o2), flip: true, late: true});
                    }
                }
                // Eight chickens between the first and the second yard, in three small flocks
                const hens = {562: [[10.5, false, 0], [12, true, 1]], 571: [[13, false, 1], [14.6, true, 0], [12.2, false, 0]], 580: [[9, true, 0], [10.6, false, 1], [12, true, 1]]};
                if (hens[at]) {
                    hens[at].forEach(([off, flip, tone]) => put('chicken', off, 2.2, {base: rightHeight(P, off), flip, tone, late: true}));
                }
                // Fermentation clay pots by the farm yards: six in each of the three, in little groups beside the houses
                const potYards = [[534, 14, 9, 27], [585, 14, 9, 25], [624, 14, 9, 30]];
                for (const [from, span, lo, hi] of potYards) {
                    const k = at - from;
                    if (k >= 0 && k < span && k % 2 === 0) {
                        const n = k / 2; // 0..6: a group of 6 pots over 7 slots, one pair stands together
                        const off = lo + ((n * 7.3 + from) % (hi - lo)) ;
                        segment.things.push({kind: 'claypot', x: off, size: 1.5 + (n % 3) * 0.15, base: rightHeight(P, off), flip: n % 2 === 0, tone: n % 3 === 0, late: true}); // (not put: it would draw a random number and move everything placed after it)
                        if (n === 2 || n === 5) {
                            segment.things.push({kind: 'claypot', x: off + 1.6, size: 1.35, base: rightHeight(P, off + 1.6), flip: true, tone: true, late: true});
                        }
                    }
                }
                // Now and then two carts side by side on the right, facing different ways
                const cartPairs = {690: ['cartRear', 'cart', 110], 880: ['cartFront', 'cartRear', 125], 1080: ['cart', 'cartFront', 115], 1250: ['cartFront', 'cart', 120]};
                if (cartPairs[at]) {
                    const [k1, k2, off] = cartPairs[at];
                    put(k1, off, 3, {base: rightHeight(P, off), flip: false});
                    put(k2, off + 9, 3, {base: rightHeight(P, off + 9), flip: true});
                }
                if (at === 500) {
                    put('cart', 13, 1.5, {base: rightHeight(P, 13), flip: false}); // a farm cart beside the road on the right, at 3.5 km to go
                }
                // Oxen and buffalo stand only in the water fields: this picks a spot in one that is wet, as the scene paints it
                const hsh = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
                const wetSpot = (lo, hi) => {
                    const spans = [];
                    if (am < 520) {
                        const E = [12, 27, 45, 69, 102, 147];
                        const RUNS = [5, 6, 8, 10, 12];
                        for (let b = 0; b < 5; b++) {
                            if (hsh(b * 97.3 + Math.floor((i + b * 3) / RUNS[b]) * 13.7 ) > 0.8) { spans.push([E[b], E[b + 1]]); }
                        }
                    } else {
                        const edge = (idx, k) => 12 + 15 * k + (k ? 3.2 * Math.sin(idx * 0.12 + k * 2.1) : 0);
                        for (let k = 0; k < 3; k++) {
                            if (hsh(k * 31.7 + Math.floor((i + k * 5) / (6 + k % 4)) * 7.3) > 0.45) { spans.push([edge(i, k), edge(i, k + 1)]); }
                        }
                    }
                    const ok = spans.map(([a0, b0]) => [Math.max(a0, lo) + 1, Math.min(b0, hi) - 1]).filter(([a0, b0]) => b0 > a0);
                    if (!ok.length) { return null; }
                    const [a0, b0] = ok[Math.floor(random() * ok.length)];
                    return a0 + random() * (b0 - a0);
                };
                const waterBeast = (kind, lo, hi, size) => {
                    const off = wetSpot(lo, hi);
                    if (off !== null) { onLeft(kind, off, size); }
                };
                // The cherry trees grow fewer from segment 380 and end at 600
                if (at % 6 === 0 && (am < 380 || (at * 0.7548776662) % 1 > sm(380, 600, am))) {
                    put('cherry', ROAD + 5.3 + random() * 0.3, (0.85 + random() * 0.15) * 1.5);
                }
                if (at % 8 === 4 && am < 690) {
                    put('lamp', -(ROAD + 1.5), 1, {flip: false});
                }
                // The railway's masts stand on its top, where it runs
                if (at % 6 === 2 && P.rail) {
                    put('pole', ROAD + 9.5 + P.sep, 1.5, {base: am >= 410 ? 9 - P.rise : 9, flip: false});
                }
                if (at % 46 === 10 && am < 540) {
                    for (let k = 0; k < 3; k++) {
                        // (the far houses are fewer: one of three is left out, the random numbers still drawn so nothing else moves)
                        if (k === 2) { random(); random(); random(); continue; }
                        onLeft('farmhouse', 160 + k * 20 + random() * 8, 1.2 + random() * 0.5);
                    }
                }
                if (at % 46 === 30 && am < 540) {
                    for (let k = 0; k < 2; k++) {
                        if (k === 1 && Math.floor(at / 46) % 3 === 0) { random(); random(); random(); continue; }
                        onLeft('farmhouse', 168 + k * 26 + random() * 8, 1.3 + random() * 0.5);
                    }
                }
                if (at % 64 === 20 && am < 600) {
                    waterBeast('ox', 14, 40, 1.5);
                }
                if (at % 64 === 52 && am < 600) {
                    waterBeast('ox', 30, 70, 1.4);
                }
                if (at % 58 === 14 && am < 900) {
                    onLeft('farmerBend', 17 + random() * 3, 1.7);
                }
                if (at % 58 === 44 && am < 900) {
                    onLeft('farmerStand', 32 + random() * 6, 1.7);
                }
                // More oxen and farmers, further out in the fields
                if (at % 64 === 36 && am < 600) {
                    waterBeast('ox', 20, 60, 1.45);
                }
                if (at % 58 === 29 && am < 900) {
                    onLeft('farmerBend', 24 + random() * 6, 1.7);
                }
                if (at % 58 === 5 && am < 900) {
                    onLeft('farmerStand', 18 + random() * 4, 1.7);
                }
                if (at % 58 === 50 && am < 900) {
                    onLeft('farmerBend', 40 + random() * 8, 1.7);
                }
                // The valley, a little at a time. A thing comes in with its share of the way: more of it the further on
                const chance = (from, to, most) => ((at * 0.6180339887) % 1) < sm(from, to, am) * most;
                if (am >= 560) {
                    // Simple tropical plants beside the road: banana plants and bamboo on the left bank, palms on the right
                    if (at % 5 === 1 && chance(560, 760, 0.55)) {
                        onLeft(at % 10 === 1 ? 'bamboo' : 'banana', 13.5 + random() * 3, 1.15 + random() * 0.35);
                    }
                    if (at % 7 === 3 && chance(600, 800, 0.5)) {
                        onRight('banana', ROAD + 4.2 + random() * 2.2, 0.9 + random() * 0.35);
                    }
                    // Small traditional houses and grazing buffalo on the terraces to the left
                    if (at % 31 === 12 && chance(580, 800, 0.9)) {
                        onLeft('vhut', 12 + 15 * Math.floor((34 + random() * 60 - 12) / 15) + 7.5, (1.2 + random() * 0.5) * 1.5); // (50 % bigger: they looked too small) // in the middle of a terrace
                    }
                    if (at % 37 === 9 && chance(580, 760, 0.9)) {
                        waterBeast('buffalo', 14, 50, 1.45 + random() * 0.2);
                    }
                    if (at % 53 === 31 && chance(640, 840, 0.9)) {
                        waterBeast('buffalo', 25, 80, 1.4);
                    }
                    if (at % 11 === 6 && chance(640, 900, 0.35)) {
                        onLeft(at % 22 === 6 ? 'palm' : 'bamboo', 22 + random() * 90, 1.4 + random() * 0.6);
                    }
                }
                if (am >= 470 && am < 720 && at % 8 === 5 && chance(470, 560, 0.8)) {
                    // On the green hillside between the road and the railway
                    onRight(['palm', 'banana', 'bamboo'][at % 3], WALL_AT + 3 + random() * Math.max(2, P.Lc - WALL_AT - 3), 1.1 + random() * 0.5);
                }
                if (am >= 540) {
                    // More farmers working the terraces, on the left
                    if (at % 19 === 7 && chance(540, 680, 0.95)) {
                        onLeft('farmerBend', 14 + random() * 80, 1.7);
                    }
                    if (at % 23 === 15 && chance(560, 700, 0.95)) {
                        onLeft('farmerStand', 14 + random() * 90, 1.7);
                    }
                    if (at % 31 === 22 && chance(600, 760, 0.9)) {
                        onLeft('farmerBend', 20 + random() * 100, 1.7);
                    }
                }
                if (am >= 700) {
                    // On the valley floor and the far side beyond the river
                    if (at % 17 === 5 && chance(700, 960, 0.9)) {
                        const hutOff = (off => off > 210 ? 210 + 11 * Math.floor((off - 210) / 11) + 5.5 : off)(75 + random() * 130);
                        const hutSize = 1.6 + random() * 0.6;
                        if (P.river > 0.3 && Math.abs(hutOff - P.riverAt) < P.river / 2 + 6) {
                            random(); // (not in the river; the random number is still used, so nothing else moves)
                        } else {
                            onRight('vhut', hutOff, hutSize);
                        }
                    }
                    if (at % 29 === 14 && chance(720, 980, 0.9)) {
                        if (P.river > 8) { random(); random(); } // (the valley buffalo are gone; the random numbers are still used, so nothing else moves)
                    }
                    if (at % 13 === 2 && chance(700, 940, 0.6)) {
                        onRight(at % 26 === 2 ? 'palm' : 'banana', 70 + random() * 90, 1.4 + random() * 0.6);
                    }
                    // More palms and banana plants over the valley (positions from the step number, not from the random numbers)
                    if (at % 4 === 1) {
                        const hv = (at * 0.7548776662) % 1;
                        const hw = (at * 0.5698402909) % 1;
                        if (hv < 0.8) {
                            segment.things.push({kind: at % 8 === 1 ? 'palm' : 'banana', x: 55 + hw * 150, base: rightHeight(P, 55 + hw * 150), flip: hv < 0.4, size: 1.4 + hv * 0.7});
                        }
                    }
                    if (at % 19 === 8 && chance(780, 980, 0.6)) {
                        onRight('bamboo', 24 + random() * 60, 1.4 + random() * 0.5);
                    }
                }
                return;
            }
            for (const side of [-1, 1]) {
                if (random() < 0.38) {
                    const kind = spec.scenery[Math.floor(random() * spec.scenery.length)];
                    const [near, spread] = FAR[kind] || [2.2, 13];
                    const x = side * (ROAD + near + SOLID[kind] + random() * spread);
                    if (!segment.things.some(thing => Math.abs(thing.x - x) < 2.5)) {
                        segment.things.push({kind, x, base: 0, flip: random() < 0.5, size: 0.8 + random() * 0.45});
                    }
                }
            }
        });
        // the last two cherry trees of the course are taken out
        const cherries = [];
        segments.forEach(segment => segment.things.forEach(thing => { if (thing.kind === 'cherry') { cherries.push([segment, thing]); } }));
        cherries.slice(-2).forEach(([segment, thing]) => segment.things.splice(segment.things.indexOf(thing), 1));
        if (spec.cut) {
            // take the stretch out: what follows is joined on (at the same height), and the scenery keeps working from the old layout
            const [from, count] = spec.cut;
            const first = RUN_UP + from;
            const drop = segments[first + count].y1 - segments[first].y1;
            segments.splice(first, count);
            segments.forEach((segment, i) => {
                segment.index = i;
                if (i >= first) {
                    segment.y1 -= drop;
                    segment.y2 -= drop;
                }
            });
            if (spec.cutSmooth) {
                const keep = segments[first - 1].bend;
                for (let i = 0; i < spec.cutSmooth; i++) {
                    segments[first + i].bend += keep * ease(1 - (i + 1) / spec.cutSmooth);
                }
            }
            goal -= count;
            cutAt = from;
            cutBy = count;
        }
        if (spec.cut2) {
            // a second stretch, near the end (on the viewpoint, where the ground does not change): from is counted after the first cut
            const [from, count] = spec.cut2;
            const first = RUN_UP + from;
            const drop = segments[first + count].y1 - segments[first].y1;
            segments.splice(first, count);
            segments.forEach((segment, i) => {
                segment.index = i;
                if (i >= first) {
                    segment.y1 -= drop;
                    segment.y2 -= drop;
                }
            });
            const keep = segments[first - 1].bend;
            for (let i = 0; i < 12; i++) {
                segments[first + i].bend += keep * ease(1 - (i + 1) / 12);
            }
            goal -= count;
            cutAt2 = from;
            cutBy2 = count;
        }
        segments[RUN_UP].things.push({kind: 'start', x: 0, base: 0, size: 1});
        segments[goal].things.push({kind: 'goal', x: 0, base: 0, size: 1});
        if (spec.runOut) {
            segments[segments.length - 2].things.push({kind: 'endrail', x: 0, base: 0, size: 1}); // a low wooden barrier across the road's end
        }
        const length = (goal - RUN_UP) * SEGMENT;
        const track = {
            ...spec, key: name, level, segments, descent,
            left: EDGE, right: EDGE, // how far from the middle a bike can go
            length, // from the start line to the goal
            ramps,
            obstacles: placeObstacles(spec, segments, length, ramps,
                own.obstacles ? {...COURSE_LEVELS[own.obstacles], bend: own.obstaclesInBends || COURSE_LEVELS[own.obstacles].bend}
                    : COURSE_LEVELS[level],
                seeded(name.length * 3571 + (own.obstacles || level).length * 613))
        };
        built[key] = track;
        return track;
    }

    // The test's course, step by step from the first segment of the run-up: how much the road turns in each step (rad), its
    // height where each step begins (m), which stretch it is in (kind) and how far into that, how far below the road the
    // valley floor is (m, the mountain) or the water (m, the city), the tunnels, the boats on the river, the lamps
    // (1: a light in the rails, 2: a lamp post on the left); and the stretches, where they begin and end (in steps) and
    // how dark it is in each (tod: 0 day, 1 night). The goal is at step end.
    function descend(steps, end) {
        const before = RUN_UP * SEGMENT / STEP + 20; // the run-up and 40 m on from the start line
        const turn = [];
        const local = [];
        const kind = [];
        const stretches = [];
        const add = (bend, l, stretch) => {
            turn.push(bend);
            local.push(l);
            kind.push(stretch.kind);
        };
        const inOut = t => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t));
        const smooth = (a, b, x) => ease(Math.max(0, Math.min(1, (x - a) / (b - a))));
        while (turn.length < before) {
            add(0, 0, STRETCHES[0]);
        }
        for (const stretch of STRETCHES) {
            const start = turn.length;
            let l = 0;
            for (const [into, held, out, bend] of stretch.bends) {
                for (let n = 0; n < into; n++) {
                    add(bend * inOut(n / into), l++, stretch);
                }
                for (let n = 0; n < held; n++) {
                    add(bend, l++, stretch);
                }
                for (let n = 0; n < out; n++) {
                    add(bend * (1 - inOut(n / out)), l++, stretch);
                }
            }
            while (turn.length - start < stretch.steps) {
                add(0, l++, stretch);
            }
            stretches.push({...stretch, start, end: turn.length});
        }
        const last = stretches[stretches.length - 1];
        for (let l = 2000; turn.length < steps; l++) {
            add(0, l, last);
        }
        const mountain = stretches[0];
        const into = i => (i < before ? 0 : local[i]); // the run-up counts as the mountain's first step
        const height = [0];
        local.forEach((l, i) => {
            const k = mountain.steps;
            const drop = kind[i] !== 'mountain' || i < before || l < 50 ? 0
                : smooth(46, 110, l) * (60 + 95 * smooth(60, 170, l)) * (1 - smooth(k - 170, k - 10, l)) * (0.85 + 0.25 * Math.sin(l * 0.05))
                + 230 * smooth(k - 300, k - 190, l) * (1 - smooth(k - 70, k - 4, l));
            height.push(height[i] - drop / 500);
        });
        const tunnel = local.map((l, i) => kind[i] === 'mountain' && i >= before && DESCENT_TUNNELS.some(([a, b]) => l >= a && l < b));

        // The water: each stretch's level in its middle, smoothly from one to the next; from the bridge on, just below
        // the road
        const middles = stretches.map(stretch => [(stretch.start + stretch.end) / 2, stretch.water]);
        const water = local.map((l, i) => {
            if (i <= middles[0][0]) {
                return middles[0][1];
            }
            for (let k = 0; k < middles.length - 1; k++) {
                if (i < middles[k + 1][0]) {
                    return middles[k][1] + (middles[k + 1][1] - middles[k][1]) * smooth(middles[k][0], middles[k + 1][0], i);
                }
            }
            return middles[middles.length - 1][1];
        }).map((level, i) => level + (CITY_WATER - level) * smooth(stretches[1].start - 10, stretches[1].start + 60, i));

        // Boats spread evenly along the mountain's river from step 170 to its end, in the tunnels too
        const boat = local.map(() => false);
        for (let k = 0; k < BOATS; k++) {
            boat[mountain.start + Math.round(170 + (k + 0.5) * (mountain.steps - 170) / BOATS)] = true;
        }

        // The lamps, from the bridge to the riverside's end
        const lamp = local.map(() => 0);
        const from = stretches[1].start;
        const to = last.end - 6;
        for (let k = 0; k < LAMPS; k++) {
            const i = Math.round(from + (k + 0.5) * (to - from) / LAMPS);
            lamp[i] = kind[i] === 'riverside' && k % 3 === 2 ? 2 : 1;
        }
        return {
            turn, height, local, kind, tunnel, water, boat, lamp,
            valley: local.map((l, i) => (kind[i] === 'mountain' ? 28 - 24.5 * smooth(10, 150, into(i)) : 28)),
            stretches: stretches.map(({kind, start, end, tod}) => ({kind, start, end, tod})),
            before, end, step: STEP
        };
    }

    // What stands on the road: never right after the start or just before the goal, nor in a bend sharper than the level
    // allows, and always with room to get by on one side at least
    function placeObstacles(spec, segments, length, ramps, level, random) {
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
            // Nor before a ramp or where the bikes come down, nor at a tunnel's mouth (in a lit tunnel, yes)
            const near = segments.slice(i - 10, i + 10);
            if (sharpest > level.bend || ramps.some(ramp => z > ramp.z0 - 40 && z < ramp.z1 + 120)
                || near.some(segment => segment.tunnel !== near[0].tunnel)) {
                z += SEGMENT * 6;
                continue;
            }
            const kind = () => spec.obstacles[Math.floor(random() * spec.obstacles.length)];
            if (random() < level.pairs && !segments[i].walls) { // between walls, there'd be no way round
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

    // How high above the road a bike is that took this ramp (null: none), now at z, at this speed (kept in the air)
    function airAt(track, ramp, z, speed) {
        if (!ramp || z < ramp.z0) {
            return 0;
        }
        if (z <= ramp.z1) {
            return RAMP_HEIGHT * (z - ramp.z0) / (ramp.z1 - ramp.z0);
        }
        if (speed < 1) {
            return 0;
        }
        const t = (z - ramp.z1) / speed;
        const y = heightAt(track, ramp.z1) + RAMP_HEIGHT + speed * LIFT * t - GRAVITY * t * t / 2;
        return Math.max(0, y - heightAt(track, z));
    }

    // The last ramp a bike at z has come to
    function rampBefore(track, z) {
        let found = null;
        for (const ramp of track.ramps) {
            if (ramp.z0 <= z) {
                found = ramp;
            }
        }
        return found;
    }

    // Another bike's height in the air, from where it is and its speed (taken to have ridden over the ramp if it is on the
    // road now)
    function airOf(track, z, x, speed) {
        return Math.abs(x) < ROAD + 0.3 ? airAt(track, rampBefore(track, z), z, speed) : 0;
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

    // The Sa Pa valley, at the end of the countryside course. Everything is a function of a, the distance from the start line
    // in segments (it may be fractional); heights are from the road's surface there (m), offsets from its middle (m).
    // From segment 430 the road climbs and bends away from the railway: the railway's side moves out (sep), a green hillside
    // rises between them (hill, Lc: where its crest is), the railway is hidden behind it and ends; the ground beyond the hillside
    // falls away to the valley floor (floor) with a river on it, in gaps between the hills (g: how open the way is to it), and
    // the far side of the valley rises in terraces (A); on the left the fields climb in terraces (left)
    const sm01 = t => {
        t = Math.max(0, Math.min(1, t));
        return t * t * (3 - 2 * t);
    };
    const sm = (a, b, x) => sm01((x - a) / (b - a));
    const WALL_AT = ROAD + 8.5; // where the railway wall stood, and where the ground beside the road begins to rise
    const SLOPE_AT = ROAD + 1.9; // just beyond the guardrail: where the ground falls away to the valley
    const CUT2 = 50; // 200 m between 3.6 and 3.0 km to go are left out (added to the end of the course)
    const CUT = 38; // 150 m of the flat countryside after the first dip is left out (added to the end of the course)
    const RAIL_END = 665; // beyond this segment the railway is gone behind the hills

    // The scenery at distance a (segments): from 3 km (segment 750) 390 segments (1.56 km) of it are left out, the change from
    // the way into the valley to the open valley made over the next 120 segments. Everything below works from this.
    // A stretch taken out of the finished course (set at the end of build): from segment cutAt on, everything is cutBy segments
    // further along in the layout it was made in, and the scenery works from that layout
    let cutAt = 0;
    let cutBy = 0;
    let cutAt2 = 0;
    let cutBy2 = 0;
    const unCut = a => (cutBy && a >= cutAt ? a + cutBy : a) + (cutBy2 && a >= cutAt2 ? cutBy2 : 0);
    const patternIndex = i => i + (cutBy && i - RUN_UP >= cutAt ? cutBy : 0) + (cutBy2 && i - RUN_UP >= cutAt2 ? cutBy2 : 0);
    function mapA(raw) {
        const a = unCut(raw);
        return a + CUT * sm01((a - 140) / 50) + CUT2 * sm01((a - 500) / 100) + 390 * sm01((a - (750 - CUT - CUT2)) / 120);
    }

    function railSep(a) {
        const m = mapA(a);
        return 70 * sm(430, 620, m) + 150 * sm(620, 860, m);
    }

    function terrain(segments, at) {
        const a = mapA(at);
        const i = Math.max(0, Math.min(segments.length - 1, RUN_UP + Math.floor(at)));
        const s = segments[i];
        const rise = s.y1 + (s.y2 - s.y1) * Math.max(0, Math.min(1, at - Math.floor(at)));
        const down = sm(480, 700, a);
        const floor = -(rise + 4) * down;
        // The final mountain bend (layout 980 to 1180) and the viewpoint (from 1330): a mountain shoulder rising beside the road
        // that gives way gradually, forest and rock on the slopes, then the open shelf above the valley
        const u = unCut(at);
        const M = sm(920, 990, u) * (1 - sm(1120, 1280, u));
        const V = sm(1330, 1380, u);
        const Vg = sm(1262, 1284, u) * (1 - sm(1342, 1364, u)); // the village (0.9 to 0.6 km to go): level ground beside the road
        const Fo = sm(960, 1120, u) * (1 - 0.85 * Vg);
        return {
            rise, floor, M, V, Fo, Vg,
            sep: railSep(at), // (railSep maps its argument itself)
            rail: a < RAIL_END,
            // The openings to the valley: a narrow one, then (the railway out of sight) it stays open as the hills fade
            g: Math.max(sm(695, 715, a) * (1 - sm(735, 755, a)), sm(785, 830, a)) * (1 - M),
            pad: sm(618, 628, unCut(at)) * (1 - sm(654, 664, unCut(at))), // a level apron of grass beside the road (the farm yard)
            padB: Math.max(sm(528, 537, unCut(at)) * (1 - sm(562, 571, unCut(at))), sm(583, 591, unCut(at)) * (1 - sm(610, 618, unCut(at)))), // and one at the foot of the hill
            Hc: 14 * sm(440, 640, a) * (1 - 0.85 * sm(680, 790, a)) + 26 * M,
            Lc: WALL_AT + 6 + 26 * sm(430, 700, a),
            left: sm(520, 900, a) * (1 + 0.9 * M),
            A: (0.8 * -floor + 6) * down,
            river: (8 + 26 * sm(740, 1000, a)) * sm(695, 730, a),
            riverAt: 150 + 26 * Math.sin(a * 0.043) + 12 * Math.sin(a * 0.117 + 1.3)
        };
    }

    // The ground on the right at offset off from the road's middle (positive): flat to where the wall stood, then the hillside
    // rising to its crest and falling away to the valley floor, or sloping down from the road where the way is open; beyond the
    // river the far side rises in terraces 11 m wide
    function rightHeight(P, off) {
        const e = WALL_AT;
        if (off <= SLOPE_AT) {
            return 0;
        }
        if (off > 210) {
            const j = Math.floor((off - 210) / 11);
            const d = (j + 0.5) * 11;
            return P.floor + P.A * sm01(d / 270) + 0.1 * Math.max(0, d - 270);
        }
        // The hillside rises from where the wall stood; where the way is open the ground falls away at once, steeply at first
        const ridge = off <= e ? 0 : off < P.Lc ? P.Hc * sm01((off - e) / (P.Lc - e)) : P.Hc + (P.floor - P.Hc) * sm01((off - P.Lc) / 40);
        const slope = P.floor * (1 - Math.pow(1 - Math.min(1, (off - SLOPE_AT) / (110 - SLOPE_AT)), 1.6));
        let natural = (1 - P.g) * ridge + P.g * slope;
        if (P.pad > 0.001) {
            const level = -0.9 - 0.04 * Math.max(0, off - 10);
            natural += (level - natural) * P.pad * sm01((off - SLOPE_AT) / 3) * (1 - sm01((off - 50) / 22));
        }
        if (P.padB > 0.001) {
            natural += (-0.15 - natural) * P.padB * sm01((off - SLOPE_AT) / 3) * (1 - sm01((off - 26) / 14));
        }
        if (P.Vg > 0.001) {
            // the village: a level apron beside the road for the houses
            natural += (-0.3 - natural) * P.Vg * sm01((off - SLOPE_AT) / 3) * (1 - sm01((off - 32) / 10));
        }
        if (P.V > 0.001) {
            // the viewpoint: a broad level shelf beside the road, then the ground falls away to the valley
            natural += (0 - natural) * P.V * (1 - sm01((off - 15) / 5));
        }
        return natural;
    }

    // The ground on the left at off (positive, to the left): the meadow sloping down to the fields, which then climb in
    // terraces 15 m wide, each 1.8 m higher than the last
    function leftHeight(P, off) {
        const from = ROAD + 1.4;
        if (off <= 12) {
            return -1.6 * sm01((off - from) / (12 - from));
        }
        return -1.6 + P.left * 1.8 * (1 + Math.floor((off - 12) / 15));
    }

    // A new bike on the grid: two side by side, a row every 5 m behind the start line
    function newBike(place) {
        return {
            z: -3 - Math.floor(place / 2) * 5,
            x: place % 2 === 0 ? -1.6 : 1.6,
            speed: 0,
            steer: 0,
            draft: 0,
            air: 0, // m above the road: on a ramp or flying from it
            jump: null, // the ramp it is on or flew from
            crash: 0, // seconds left of a crash
            ghost: 0, // seconds left of riding through things and bikes, after a crash
            back: 0, // where on the road a crash carries the bike
            offRoad: false,
            bumped: false,
            hit: null, // what on the road it ran into, until it is past it
            stopped: false, // held behind it
            power: 1, // the computer riders on hard have a little more
            turbo: 0, // m left of a turbo
            turboWait: 0 // seconds before the turbo can be used again
        };
    }

    // One step of riding. input: steer (-1 to 1), brake, gas (false: rolls out, e.g. in the menu), turbo (starts one if it
    // is ready).
    // others: the other bikes, {z, x, speed}. Says what happened: 'crash' (into something beside the road or on it),
    // 'scrape' (along something on the road), 'bump' (into a bike), 'jump' (off a ramp), 'land' or ''.
    function ride(bike, track, input, others, seconds) {
        let happened = '';
        const segment = segmentAt(track, bike.z);
        const share = bike.speed / TOP_SPEED;
        const flying = bike.jump !== null && bike.z > bike.jump.z1 && bike.air > 0;
        const steering = bike.crash > 0 ? 0 : input.steer * (flying ? AIR_STEER : 1);
        bike.steer += (steering - bike.steer) * Math.min(1, seconds * 9);
        const crashed = bike.crash > 0;
        if (input.turbo && bike.turbo === 0 && bike.turboWait === 0 && !crashed) {
            bike.turbo = TURBO_DISTANCE;
        }
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
        const bendSlow = track.bendSlow && segment.slows !== false ? 1 - track.bendSlow * Math.min(1, Math.abs(segment.bend) / 7) : 1;
        const turbo = bike.turbo > 0 ? TURBO_SPEED : 1;
        const top = (bike.offRoad ? OFF_ROAD_SPEED : TOP_SPEED) * (bike.power || 1) * (1 + DRAFT_BOOST * bike.draft) * bendSlow * turbo;
        if (flying) {
            // keeps its speed until it lands
        } else if (bike.crash > 0) {
            bike.speed = Math.max(3, bike.speed - BRAKE * seconds); // creeps on, back onto the road
        } else if (input.brake) {
            bike.speed = Math.max(0, bike.speed - BRAKE * seconds);
        } else if (!input.gas) {
            bike.speed = Math.max(0, bike.speed - 8 * seconds);
        } else if (bike.speed > top) {
            bike.speed = Math.max(top, bike.speed - 30 * seconds);
        } else {
            bike.speed += (bike.turbo > 0 ? TURBO_PULL : PULL * (1 - bike.speed / top)) * seconds + 0.4 * seconds;
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
        // Between walls (a mountain road, a tunnel): held on the road, slowed while it rubs along one
        const walled = segment.walls || segment.tunnel;
        if (walled && Math.abs(bike.x) > WALL - BIKE_HALF_WIDTH) {
            bike.x = Math.sign(bike.x) * (WALL - BIKE_HALF_WIDTH);
            if (!bike.walled) {
                bike.speed *= 0.9;
                happened = 'scrape';
            }
            bike.speed = Math.max(0, bike.speed - 10 * seconds);
            bike.walled = true;
        } else {
            bike.walled = false;
        }

        // Into a tree or a rock beside the road: slowed right down, and back onto the edge of the road on that side
        if (bike.offRoad && bike.crash === 0 && bike.ghost === 0 && bike.air < 1) {
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
        if (bike.turbo > 0) {
            bike.turbo = bike.crash > 0 ? 0 : Math.max(0, bike.turbo - bike.speed * seconds); // a crash ends it
            if (bike.turbo === 0) {
                bike.turboWait = TURBO_COOLDOWN;
            }
        } else {
            bike.turboWait = Math.max(0, bike.turboWait - seconds);
        }

        // Onto a ramp (on the road), off its lip, and down again
        const ramp = rampBefore(track, bike.z);
        if (ramp && bike.z <= ramp.z1 && Math.abs(bike.x) < ROAD && bike.jump !== ramp && !flying) {
            bike.jump = ramp;
        }
        if (bike.jump) {
            const wasOnRamp = bike.z - bike.speed * seconds <= bike.jump.z1;
            bike.air = airAt(track, bike.jump, bike.z, bike.speed);
            if (wasOnRamp && bike.z > bike.jump.z1) {
                happened = 'jump';
            } else if (bike.air === 0 && bike.z > bike.jump.z1) {
                bike.jump = null;
                happened = flying ? 'land' : happened;
            }
        }
        const high = bike.air > 0.6; // over what stands on the road, and over the other bikes

        // Into something on the road: from behind, the bike is stopped short and slides round it, to the side with room;
        // once clear of it, or coming from beside, it is held off it and gets by along it
        if (bike.hit && (bike.z - BIKE_LENGTH / 2 > bike.hit.z + bike.hit.length || bike.z + BIKE_LENGTH / 2 < bike.hit.z - 3)) {
            bike.hit = null;
        }
        let stopped = false;
        for (const obstacle of bike.crash > 0 || bike.ghost > 0 || high ? [] : track.obstacles) {
            const reach = obstacle.half + BIKE_HALF_WIDTH;
            if (obstacle.z > bike.z + BIKE_LENGTH / 2 || obstacle.z + obstacle.length < bike.z - BIKE_LENGTH / 2
                || Math.abs(bike.x - obstacle.x) >= reach) {
                continue;
            }
            // Round it on the nearer side, unless something beside it is in the way there
            const clear = x => x > leftmost && x < rightmost && !(walled && Math.abs(x) > WALL - BIKE_HALF_WIDTH) && !track.obstacles.some(other => other !== obstacle
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

        // Into another bike: the one behind is knocked back a little when they first touch, then held at the other's
        // speed; each eases its half of the overlap away, steadily, so two bikes side by side ride on together without
        // shaking (the other bike's phone, or its computer rider, moves the other half)
        const wasTouching = bike.bumped;
        bike.bumped = false;
        for (const other of bike.crash > 0 || bike.ghost > 0 || high ? [] : others) {
            const ahead = other.z - bike.z;
            const apart = bike.x - other.x;
            if (Math.abs(ahead) < BIKE_LENGTH && Math.abs(apart) < BIKE_HALF_WIDTH * 2 && !((other.air || 0) > 0.6)) {
                if (ahead > 0 && bike.speed > other.speed) {
                    bike.speed = wasTouching ? other.speed : Math.max(0, other.speed * 0.92);
                    happened = happened || (wasTouching ? '' : 'bump');
                }
                // Right on top of each other: the one behind goes left, the one ahead right
                const away = apart > 0 || (apart === 0 && ahead < 0) ? 1 : -1;
                const overlap = BIKE_HALF_WIDTH * 2 - Math.abs(apart);
                bike.x += away * Math.min(overlap / 2, SEPARATE * seconds);
                bike.bumped = true;
            }
        }
        return happened;
    }

    // After the goal: rolls on to a stop, keeping left so those still riding get by
    function cruise(bike, track, seconds) {
        const wanted = Math.max(0, Math.min(22, (track.length + (track.runOut ? 76 : 90) - bike.z) * 0.5));
        const steer = bike.speed > 1 ? Math.max(-1, Math.min(1, (-2 - bike.x) * 0.6)) : 0;
        const result = ride(bike, track, {steer, brake: bike.speed > wanted + 2, gas: bike.speed < wanted}, [], seconds);
        const endZ = (track.segments.length - 1 - RUN_UP) * SEGMENT - 14; // the road's barrier (the countryside's): never rolls closer than 14 m to it
        if (track.runOut && bike.z > endZ) {
            bike.z = endZ;
            bike.speed = 0;
        }
        return result;
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
        // Round a slower bike ahead: on one side, chosen once (the side it is already on, if there is room) and kept until
        // it is past, so it doesn't swerve from side to side
        const lane = target;
        let passing = false;
        for (const other of others) {
            const gap = other.z - bike.z;
            const keep = rider.passSide && gap > -BIKE_LENGTH * 1.5 && gap < 14 && Math.abs(other.x - lane) < 2.2;
            if (keep || (gap > 0 && gap < 14 && other.speed < bike.speed + 1 && Math.abs(other.x - lane) < 1.3)) {
                if (!rider.passSide) {
                    const side = bike.x >= other.x ? 1 : -1;
                    rider.passSide = Math.abs(other.x + side * 1.8) <= ROAD - 0.6 ? side : -side;
                }
                target = other.x + rider.passSide * 1.8;
                passing = true;
            }
        }
        if (!passing) {
            rider.passSide = 0;
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
        SEGMENT, ROAD, EDGE, WALL, TUNNEL_HEIGHT, TOP_SPEED, TURBO_COOLDOWN, BEND, RUN_UP, GHOST_SECONDS, TRACKS, COMPUTERS, COMPUTER_LEVELS, COURSE_LEVELS,
        layoutOf: unCut, build, segmentAt, heightAt, newBike, ride, cruise, computer, airOf, terrain, rightHeight, leftHeight, railSep, mapA, patternIndex, WALL_AT, SLOPE_AT, RAIL_END, RAIL_RAW: RAIL_END - CUT - CUT2
    };
})();

if (typeof module !== 'undefined') {
    module.exports = Track;
}

