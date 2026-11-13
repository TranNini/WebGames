// The pictures: one sheet of plants, bark, rock and wood and the ground tiles come from art/ (made from CC0 photos, see art/LICENSE.txt); noise for water and clouds is made here.
import * as THREE from './lib/three.module.min.js';
import {rng} from './world.js';

const COLS = 6;
const ROWS = 5;
const NAMES = ['frond', 'leaves', 'fern', 'grass', 'barkPalm', 'barkTree', 'bamboo', 'rock', 'banana', 'berry',
    'flower', 'wood', 'thatch', 'metal', 'cloth', 'coral', 'plain', 'ore', 'kelp', 'hull', 'leavesB', 'bigleaf', 'bambooLeaf', 'rockMoss', 'barkDark',
    'furJaguar', 'furBoar', 'furMonkey', 'scales', 'shell'];
export const REGION = {};
NAMES.forEach((name, i) => {
    const pad = 0.0015;
    const u = (i % COLS) / COLS;
    const v = 1 - (Math.floor(i / COLS) + 1) / ROWS;
    REGION[name] = {u0: u + pad, v0: v + pad, u1: u + 1 / COLS - pad, v1: v + 1 / ROWS - pad};
});

// Adds triangles to one geometry. Everything goes through a matrix, so pieces can be placed and turned.
export class Shape {
    constructor() {
        this.position = [];
        this.normal = [];
        this.uv = [];
        this.color = [];
        this.index = [];
        this.matrix = new THREE.Matrix4();
        this.normalMatrix = new THREE.Matrix3();
    }

    at(x = 0, y = 0, z = 0, turnY = 0, scale = 1, tiltX = 0, tiltZ = 0) {
        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(tiltX, turnY, tiltZ, 'YXZ'));
        this.matrix.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(scale, scale, scale));
        this.normalMatrix.getNormalMatrix(this.matrix);
        return this;
    }

    vertex(x, y, z, nx, ny, nz, u, v, region, color) {
        const p = new THREE.Vector3(x, y, z).applyMatrix4(this.matrix);
        const n = new THREE.Vector3(nx, ny, nz).applyMatrix3(this.normalMatrix).normalize();
        this.position.push(p.x, p.y, p.z);
        this.normal.push(n.x, n.y, n.z);
        this.uv.push(region.u0 + (region.u1 - region.u0) * u, region.v0 + (region.v1 - region.v0) * v);
        this.color.push(color.r, color.g, color.b);
        return this.position.length / 3 - 1;
    }

    // A flat card with the given corners; normal: how light falls on it (leaves look fuller when it points outward)
    card(a, b, c, d, region, color = WHITE, normal = null) {
        const n = normal || new THREE.Vector3().crossVectors(
            new THREE.Vector3().subVectors(b, a), new THREE.Vector3().subVectors(d, a)).normalize();
        // Flat things are lit from above, whichever way round their corners were given
        if (!normal && n.y < -0.2) {
            n.negate();
        }
        const i = this.vertex(a.x, a.y, a.z, n.x, n.y, n.z, 0, 0, region, color);
        this.vertex(b.x, b.y, b.z, n.x, n.y, n.z, 1, 0, region, color);
        this.vertex(c.x, c.y, c.z, n.x, n.y, n.z, 1, 1, region, color);
        this.vertex(d.x, d.y, d.z, n.x, n.y, n.z, 0, 1, region, color);
        this.index.push(i, i + 1, i + 2, i, i + 2, i + 3);
    }

    // Two crossed cards standing on the ground
    cross(height, width, region, color = WHITE, turn = 0) {
        for (let k = 0; k < 2; k++) {
            const angle = turn + k * Math.PI / 2;
            const dx = Math.cos(angle) * width / 2;
            const dz = Math.sin(angle) * width / 2;
            const up = new THREE.Vector3(0.15, 1, 0.15).normalize();
            this.card(new THREE.Vector3(-dx, 0, -dz), new THREE.Vector3(dx, 0, dz),
                new THREE.Vector3(dx, height, dz), new THREE.Vector3(-dx, height, -dz), region, color, up);
        }
    }

    // A round tube along points, with a radius for each
    tube(path, radii, sides, region, color = WHITE, repeat = 1) {
        const start = this.position.length / 3;
        const dir = new THREE.Vector3();
        const side = new THREE.Vector3();
        const up = new THREE.Vector3();
        for (let i = 0; i < path.length; i++) {
            dir.subVectors(path[Math.min(i + 1, path.length - 1)], path[Math.max(i - 1, 0)]).normalize();
            side.set(1, 0, 0).cross(dir);
            if (side.lengthSq() < 0.01) {
                side.set(0, 0, 1).cross(dir);
            }
            side.normalize();
            up.crossVectors(dir, side).normalize();
            for (let k = 0; k <= sides; k++) {
                const a = k / sides * Math.PI * 2;
                const nx = side.x * Math.cos(a) + up.x * Math.sin(a);
                const ny = side.y * Math.cos(a) + up.y * Math.sin(a);
                const nz = side.z * Math.cos(a) + up.z * Math.sin(a);
                const r = radii[i];
                // A picture on the sheet can't repeat, so it goes up and back down
                const along = (i / (path.length - 1) * repeat) % 2;
                const v = along > 1 ? 2 - along : along;
                this.vertex(path[i].x + nx * r, path[i].y + ny * r, path[i].z + nz * r, nx, ny, nz, k / sides, v, region, color);
            }
        }
        for (let i = 0; i < path.length - 1; i++) {
            for (let k = 0; k < sides; k++) {
                const a = start + i * (sides + 1) + k;
                const b = a + sides + 1;
                this.index.push(a, b, a + 1, a + 1, b, b + 1);
            }
        }
    }

    // A body along the z axis, from rings of [z, y, half width, half height, optional brightness].
    // The picture's edges go on the belly, its middle along the back.
    loft(rings, sides, region, tint = WHITE, stretch = 1) {
        const start = this.position.length / 3;
        const c = new THREE.Color();
        rings.forEach(([z, y, rx, ry, light = 1], j) => {
            c.copy(tint).multiplyScalar(light);
            for (let i = 0; i <= sides; i++) {
                const a = -Math.PI / 2 + i / sides * Math.PI * 2;
                const nx = Math.cos(a) / Math.max(rx, 0.001);
                const ny = Math.sin(a) / Math.max(ry, 0.001);
                const length = Math.hypot(nx, ny);
                const before = rings[Math.max(0, j - 1)];
                const after = rings[Math.min(rings.length - 1, j + 1)];
                const grow = (after[2] + after[3] - before[2] - before[3]) / 2 / Math.max(0.01, after[0] - before[0]);
                const v = (j / (rings.length - 1) * stretch) % 2;
                this.vertex(rx * Math.cos(a), y + ry * Math.sin(a), z, nx / length, ny / length, -grow, i / sides, v > 1 ? 2 - v : v, region, c);
            }
        });
        for (let j = 0; j < rings.length - 1; j++) {
            for (let i = 0; i < sides; i++) {
                const a = start + j * (sides + 1) + i;
                const b = a + sides + 1;
                this.index.push(a, a + 1, b, a + 1, b + 1, b);
            }
        }
    }

    // A rounded lump; rough: how much it is dented, to look like rock
    blob(cx, cy, cz, rx, ry, rz, color = WHITE, region = REGION.plain, wide = 8, high = 6, rough = 0, seed = 1) {
        const start = this.position.length / 3;
        const random = rng(seed * 7919);
        const dents = [];
        for (let i = 0; i <= (wide + 1) * (high + 1); i++) {
            dents.push(1 + (random() - 0.5) * rough);
        }
        for (let j = 0; j <= high; j++) {
            const phi = j / high * Math.PI;
            for (let i = 0; i <= wide; i++) {
                const theta = i / wide * Math.PI * 2;
                const nx = Math.sin(phi) * Math.cos(theta);
                const ny = Math.cos(phi);
                const nz = Math.sin(phi) * Math.sin(theta);
                const dent = i === wide ? dents[j * (wide + 1)] : dents[j * (wide + 1) + i];
                this.vertex(cx + nx * rx * dent, cy + ny * ry * dent, cz + nz * rz * dent, nx, ny, nz, i / wide, j / high, region, color);
            }
        }
        for (let j = 0; j < high; j++) {
            for (let i = 0; i < wide; i++) {
                const a = start + j * (wide + 1) + i;
                const b = a + wide + 1;
                this.index.push(a, a + 1, b, a + 1, b + 1, b);
            }
        }
    }

    // A rock: a lump with smooth bulges and ledges, lit by its real shape, its underside flat
    rock(cx, cy, cz, rx, ry, rz, region, seed, wide = 16, high = 10, tint = WHITE) {
        const random = rng(seed * 7919 + 3);
        const waves = [];
        for (let i = 0; i < 9; i++) {
            const size = i < 3 ? 1.6 : i < 6 ? 3.4 : 7;
            waves.push({x: (random() - 0.5) * size * 2, y: (random() - 0.5) * size * 2, z: (random() - 0.5) * size * 2, at: random() * 6.3, power: i < 3 ? 0.17 : i < 6 ? 0.08 : 0.03});
        }
        const radius = (x, y, z) => {
            let r = 1;
            for (const w of waves) {
                r += Math.sin(x * w.x + y * w.y + z * w.z + w.at) * w.power;
            }
            return r;
        };
        const place = (phi, theta) => {
            const x = Math.sin(phi) * Math.cos(theta);
            const y = Math.cos(phi);
            const z = Math.sin(phi) * Math.sin(theta);
            const r = radius(x, y, z);
            return new THREE.Vector3(x * r * rx, Math.max(y * r * ry, -0.25 * ry), z * r * rz);
        };
        const start = this.position.length / 3;
        const e = 0.03;
        for (let j = 0; j <= high; j++) {
            const phi = j / high * Math.PI;
            for (let i = 0; i <= wide; i++) {
                const theta = (i % wide) / wide * Math.PI * 2;
                const p = place(phi, theta);
                const n = new THREE.Vector3().crossVectors(
                    place(phi + e, theta).sub(place(phi - e, theta)),
                    place(phi, theta + e).sub(place(phi, theta - e))).normalize();
                if (n.dot(p) < 0) {
                    n.negate();
                }
                // At the very top and bottom there is no sideways to go by
                if (j === 0 || j === high || n.lengthSq() < 0.5) {
                    n.set(0, j > high / 2 ? -1 : 1, 0);
                }
                this.vertex(cx + p.x, cy + p.y, cz + p.z, n.x, n.y, n.z, i / wide, j / high, region, tint);
            }
        }
        for (let j = 0; j < high; j++) {
            for (let i = 0; i < wide; i++) {
                const a = start + j * (wide + 1) + i;
                const b = a + wide + 1;
                this.index.push(a, a + 1, b, a + 1, b + 1, b);
            }
        }
    }

    box(cx, cy, cz, sx, sy, sz, region = REGION.plain, color = WHITE) {
        const faces = [
            [[1, 0, 0], [0, 0, -1], [0, 1, 0]], [[-1, 0, 0], [0, 0, 1], [0, 1, 0]],
            [[0, 1, 0], [1, 0, 0], [0, 0, -1]], [[0, -1, 0], [1, 0, 0], [0, 0, 1]],
            [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [-1, 0, 0], [0, 1, 0]]
        ];
        for (const [n, u, v] of faces) {
            const i = this.position.length / 3;
            const center = [cx + n[0] * sx / 2, cy + n[1] * sy / 2, cz + n[2] * sz / 2];
            [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([a, b]) => {
                this.vertex(
                    center[0] + (u[0] * a * sx + v[0] * b * sx) / 2,
                    center[1] + (u[1] * a * sy + v[1] * b * sy) / 2,
                    center[2] + (u[2] * a * sz + v[2] * b * sz) / 2,
                    n[0], n[1], n[2], (a + 1) / 2, (b + 1) / 2, region, color);
            });
            this.index.push(i, i + 1, i + 2, i, i + 2, i + 3);
        }
    }

    geometry() {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(this.position, 3));
        g.setAttribute('normal', new THREE.Float32BufferAttribute(this.normal, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
        g.setAttribute('color', new THREE.Float32BufferAttribute(this.color, 3));
        g.setIndex(this.index);
        g.computeBoundingSphere();
        return g;
    }
}

export const WHITE = new THREE.Color(1, 1, 1);
export const color = hex => new THREE.Color(hex);
export const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

// Noise that repeats without a seam
function tiling(size, cells, seed) {
    const random = rng(seed);
    const lattice = new Float32Array(cells * cells);
    for (let i = 0; i < lattice.length; i++) {
        lattice[i] = random();
    }
    const out = new Float32Array(size * size);
    const smooth = t => t * t * (3 - 2 * t);
    for (let y = 0; y < size; y++) {
        const fy = y / size * cells;
        const iy = Math.floor(fy);
        const ty = smooth(fy - iy);
        for (let x = 0; x < size; x++) {
            const fx = x / size * cells;
            const ix = Math.floor(fx);
            const tx = smooth(fx - ix);
            const a = lattice[ix % cells + (iy % cells) * cells];
            const b = lattice[(ix + 1) % cells + (iy % cells) * cells];
            const c = lattice[ix % cells + ((iy + 1) % cells) * cells];
            const d = lattice[(ix + 1) % cells + ((iy + 1) % cells) * cells];
            out[x + y * size] = (a + (b - a) * tx) + ((c + (d - c) * tx) - (a + (b - a) * tx)) * ty;
        }
    }
    return out;
}

function layers(size, cells, octaves, seed) {
    const out = new Float32Array(size * size);
    let amp = 0.5;
    let total = 0;
    for (let o = 0; o < octaves; o++) {
        const layer = tiling(size, cells << o, seed + o);
        for (let i = 0; i < out.length; i++) {
            out[i] += layer[i] * amp;
        }
        total += amp;
        amp *= 0.55;
    }
    for (let i = 0; i < out.length; i++) {
        out[i] /= total;
    }
    return out;
}

function repeating(data, size) {
    const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;
    texture.anisotropy = 4;
    texture.needsUpdate = true;
    return texture;
}

// r: fine grain, g: larger patches, b: thin strokes like grass
function groundDetail() {
    const size = 256;
    const fine = layers(size, 32, 3, 11);
    const patches = layers(size, 8, 4, 21);
    const strokes = tiling(size, 64, 31);
    const data = new Uint8Array(size * size * 4);
    for (let i = 0; i < size * size; i++) {
        data[i * 4] = fine[i] * 255;
        data[i * 4 + 1] = patches[i] * 255;
        data[i * 4 + 2] = strokes[i] * 255;
        data[i * 4 + 3] = 255;
    }
    return repeating(data, size);
}

function waterNormals() {
    const size = 256;
    const height = layers(size, 8, 4, 51);
    const data = new Uint8Array(size * size * 4);
    const at = (x, y) => height[((x + size) % size) + ((y + size) % size) * size];
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const dx = (at(x + 1, y) - at(x - 1, y)) * 14;
            const dy = (at(x, y + 1) - at(x, y - 1)) * 14;
            const i = (x + y * size) * 4;
            data[i] = Math.max(0, Math.min(255, 128 + dx * 127));
            data[i + 1] = Math.max(0, Math.min(255, 128 + dy * 127));
            data[i + 2] = height[x + y * size] * 255;
            data[i + 3] = 255;
        }
    }
    return repeating(data, size);
}

function cloudNoise() {
    const size = 256;
    const height = layers(size, 4, 5, 71);
    const data = new Uint8Array(size * size * 4);
    for (let i = 0; i < size * size; i++) {
        const v = Math.max(0, Math.min(255, (height[i] - 0.22) * 1.9 * 255));
        data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = v;
        data[i * 4 + 3] = 255;
    }
    return repeating(data, size);
}

export function softDot(inner, outer) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const c = canvas.getContext('2d');
    const gradient = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, inner);
    gradient.addColorStop(0.5, outer);
    gradient.addColorStop(1, outer.replace(/[\d.]+\)$/, '0)'));
    c.fillStyle = gradient;
    c.fillRect(0, 0, 64, 64);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

// Shared by the materials: time and wind move the leaves
export const shared = {uTime: {value: 0}, uWind: {value: 0.35}};

// Light and shade from the picture itself: bark, rock and sand look raised, without a second picture
export const RELIEF = `
    #ifdef USE_MAP
        float reliefHeight = dot(sampledDiffuseColor.rgb, vec3(0.33));
        vec3 reliefX = dFdx(-vViewPosition);
        vec3 reliefY = dFdy(-vViewPosition);
        vec3 reliefA = cross(reliefY, normal);
        vec3 reliefB = cross(normal, reliefX);
        float reliefDet = dot(reliefX, reliefA);
        vec3 reliefGrad = sign(reliefDet) * (dFdx(reliefHeight) * reliefA + dFdy(reliefHeight) * reliefB);
        normal = normalize(abs(reliefDet) * normal - RELIEF_POWER * reliefGrad);
    #endif
`;

function ownNormals(shader, power) {
    shader.fragmentShader = shader.fragmentShader
        .replace('#include <normal_fragment_begin>', 'vec3 normal = normalize(vNormal); vec3 nonPerturbedNormal = normal;')
        .replace('#include <normal_fragment_maps>', RELIEF.replace('RELIEF_POWER', power));
}

// A material that is lit by the normals as given, seen from either side
export function keepNormals(material) {
    material.onBeforeCompile = shader => ownNormals(shader, '0.035');
    material.customProgramCacheKey = () => 'keepNormals';
    return material;
}

function withWind(material) {
    material.onBeforeCompile = shader => {
        shader.uniforms.uTime = shared.uTime;
        shader.uniforms.uWind = shared.uWind;
        shader.vertexShader = 'uniform float uTime; uniform float uWind;\n' + shader.vertexShader.replace('#include <begin_vertex>', `
            #include <begin_vertex>
            #ifdef USE_INSTANCING
                vec2 place = instanceMatrix[3].xz;
            #else
                vec2 place = vec2(0.0);
            #endif
            float sway = position.y * position.y * 0.0017 * uWind;
            transformed.x += sin(uTime * 1.25 + place.x * 0.31 + position.y * 0.3) * sway;
            transformed.z += cos(uTime * 1.05 + place.y * 0.27 + position.y * 0.2) * sway * 0.7;
            float flutter = min(position.y, 3.0) * 0.012 * uWind;
            transformed.y += sin(uTime * 3.1 + position.x * 2.3 + position.z * 1.9 + place.x) * flutter;
        `);
        // Lit from where the leaf "faces", also from behind: a leafy crown then looks round
        ownNormals(shader, '0.012');
    };
    material.customProgramCacheKey = () => 'wind';
    return material;
}

function loadPicture(url, isColor = true) {
    return new Promise((resolve, reject) => {
        new THREE.TextureLoader().load(url, texture => {
            if (isColor) {
                texture.colorSpace = THREE.SRGBColorSpace;
            }
            texture.generateMipmaps = true;
            texture.minFilter = THREE.LinearMipmapLinearFilter;
            texture.magFilter = THREE.LinearFilter;
            texture.anisotropy = 4;
            resolve(texture);
        }, undefined, () => reject(new Error('Could not load ' + url)));
    });
}

export async function makeArt(quality = 'medium') {
    const small = quality === 'low' ? '-small' : '';
    const [sheet, holes, sand, grass, jungle, mud, stone] = await Promise.all([
        loadPicture(`art/sheet${small}.webp`),
        loadPicture(`art/sheet-holes${small}.webp`, false),
        ...['sand', 'grass', 'jungle', 'mud', 'stone'].map(name => loadPicture(`art/ground-${name}.webp`))
    ]);
    const ground = {sand, grass, jungle, mud, stone};
    for (const texture of Object.values(ground)) {
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    }
    const flora = withWind(new THREE.MeshLambertMaterial({map: sheet, alphaMap: holes, vertexColors: true, alphaTest: 0.42, side: THREE.DoubleSide}));
    const solid = keepNormals(new THREE.MeshLambertMaterial({map: sheet, vertexColors: true, side: THREE.DoubleSide}));
    const oreGlow = new THREE.MeshLambertMaterial({map: sheet, vertexColors: true, side: THREE.DoubleSide});
    oreGlow.onBeforeCompile = shader => {
        ownNormals(shader, '0.035');
        // What is coloured in the rock gives light of its own
        shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', `
            totalEmissiveRadiance += diffuseColor.rgb * smoothstep(0.03, 0.2, diffuseColor.r - diffuseColor.b) * vec3(3.2, 2.1, 1.1);
        `);
    };
    oreGlow.customProgramCacheKey = () => 'oreGlow';
    return {sheet, holes, flora, solid, oreGlow, ground, detail: groundDetail(), water: waterNormals(), clouds: cloudNoise()};
}
