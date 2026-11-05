// Reads handwritten numbers from their strokes, on the device itself. A stroke is a list of points {x, y} in any size.
const Digits = (() => {
    const POINTS = 8; // what the network looks at: this many points, evenly spread along a digit
    const OVERLAP = 0.3; // strokes above each other by this share of the narrower one are one digit
    // The game knows the answer, so its digit is read when it has at least this chance, even if another looks likelier.
    // On handwriting of people the network never saw: 99% of right digits are read, and 0.5% of wrong ones get through.
    const BENEFIT_OF_THE_DOUBT = 0.05;

    // 8 points along the whole digit, with a straight line for the jump between strokes, in a box from -1 to 1
    function features(strokes) {
        const line = strokes.flat();
        const lengths = [];
        let total = 0;
        for (let i = 1; i < line.length; i++) {
            const length = Math.hypot(line[i].x - line[i - 1].x, line[i].y - line[i - 1].y);
            lengths.push(length);
            total += length;
        }
        const left = Math.min(...line.map(p => p.x));
        const right = Math.max(...line.map(p => p.x));
        const top = Math.min(...line.map(p => p.y));
        const bottom = Math.max(...line.map(p => p.y));
        const size = Math.max(right - left, bottom - top) || 1;
        const result = [];
        let segment = 0;
        let walked = 0;
        for (let k = 0; k < POINTS; k++) {
            const wanted = total * k / (POINTS - 1);
            while (segment < lengths.length - 1 && walked + lengths[segment] < wanted) {
                walked += lengths[segment];
                segment++;
            }
            const along = lengths[segment] ? Math.min(1, (wanted - walked) / lengths[segment]) : 0;
            const from = line[segment];
            const to = line[segment + 1] || from;
            result.push((from.x + along * (to.x - from.x) - (left + right) / 2) / size * 2);
            result.push((from.y + along * (to.y - from.y) - (top + bottom) / 2) / size * 2);
        }
        return result;
    }

    // The chance of each digit 0 to 9
    function chances(strokes) {
        let values = features(strokes);
        DIGIT_MODEL.forEach((layer, index) => {
            const next = [];
            for (let j = 0; j < layer.m; j++) {
                let sum = layer.b[j];
                for (let i = 0; i < layer.n; i++) {
                    sum += layer.w[j * layer.n + i] * values[i];
                }
                next.push(index < DIGIT_MODEL.length - 1 ? Math.max(0, sum) : sum);
            }
            values = next;
        });
        const highest = Math.max(...values);
        const raised = values.map(value => Math.exp(value - highest));
        const all = raised.reduce((sum, value) => sum + value);
        return raised.map(value => value / all);
    }

    function rangeOf(stroke) {
        const xs = stroke.map(p => p.x);
        return {left: Math.min(...xs), right: Math.max(...xs)};
    }

    // Strokes above each other make one digit, whatever order they came in. From left to right.
    function splitIntoDigits(strokes) {
        const groups = strokes.map(stroke => ({strokes: [stroke], ...rangeOf(stroke)}));
        for (let i = 0; i < groups.length; i++) {
            for (let j = i + 1; j < groups.length; j++) {
                const a = groups[i];
                const b = groups[j];
                const shared = Math.min(a.right, b.right) - Math.max(a.left, b.left);
                const narrower = Math.min(a.right - a.left, b.right - b.left);
                if (shared >= 0 && shared >= narrower * OVERLAP) { // >= for a dead straight line down: it has no width
                    a.strokes.push(...b.strokes);
                    a.left = Math.min(a.left, b.left);
                    a.right = Math.max(a.right, b.right);
                    groups.splice(j, 1);
                    i = -1; // what grew may now reach another
                    break;
                }
            }
        }
        return groups.sort((a, b) => a.left - b.left).map(group => group.strokes);
    }

    // The number that was written, as text. expected: the answer, also text.
    function read(strokes, expected) {
        const digits = splitIntoDigits(strokes);
        return digits.map((digit, place) => {
            const chance = chances(digit);
            const wanted = digits.length === expected.length ? Number(expected[place]) : -1;
            return wanted >= 0 && chance[wanted] >= BENEFIT_OF_THE_DOUBT ? wanted : chance.indexOf(Math.max(...chance));
        }).join('');
    }

    return {read};
})();
