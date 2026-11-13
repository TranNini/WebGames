// What is always there: the ground, the sea, the sky, the light of the day and the weather.
import * as THREE from './lib/three.module.min.js';
import {BIOME, CELL, GRID, WORLD_SIZE, smoothstep} from './world.js';
import {RELIEF, shared} from './art.js';

const CHUNK = 20;
const DEEPEST_SHOWN = -24;

function mixColor(out, a, b, t) {
    out[0] = a[0] + (b[0] - a[0]) * t;
    out[1] = a[1] + (b[1] - a[1]) * t;
    out[2] = a[2] + (b[2] - a[2]) * t;
}

function linear(hex) {
    const c = new THREE.Color(hex);
    return [c.r, c.g, c.b];
}

const CAVE_DARK = new THREE.Color(0.75, 0.8, 0.95);
const WET = linear('#c9b896');
const DEEP = linear('#6f9a93');
const SWAMP_TINT = linear('#b8b48a');

// What each point of the ground is made of: sand, grass, jungle floor, mud; stone is what is left
function groundLayers(world) {
    const size = GRID + 1;
    const tints = new Float32Array(size * size * 3);
    const layers = new Float32Array(size * size * 4);
    const tint = [1, 1, 1];
    for (let j = 0; j < size; j++) {
        for (let i = 0; i < size; i++) {
            const k = i + j * size;
            const h = world.heights[k];
            const biome = world.biomes[k];
            const n = Math.sin(i * 0.37 + j * 0.13) * 0.25 + Math.sin(i * 0.11 - j * 0.29) * 0.25 + 0.5;
            const mix = [0, 0, 0, 0];
            tint[0] = tint[1] = tint[2] = 1;
            if (biome === BIOME.CAVE) {
                // stone
            } else if (biome === BIOME.SWAMP || biome === BIOME.RIVER) {
                mix[3] = 1;
                if (biome === BIOME.SWAMP) {
                    mix[2] = n * 0.5;
                    mix[3] = 1 - n * 0.5;
                    tint[0] = SWAMP_TINT[0]; tint[1] = SWAMP_TINT[1]; tint[2] = SWAMP_TINT[2];
                }
            } else if (h < 0) {
                mix[0] = 1;
                mixColor(tint, DEEP, [1, 1, 1], smoothstep(-13, -1.5, h));
            } else if (biome === BIOME.BEACH) {
                mix[0] = 1;
                mixColor(tint, WET, [1, 1, 1], smoothstep(0.05, 0.75, h));
            } else if (biome === BIOME.MEADOW || biome === BIOME.ISLET) {
                mix[1] = 1;
                const dry = 0.85 + n * 0.25;
                tint[0] = dry; tint[1] = 0.95 + n * 0.08; tint[2] = 0.8 + (1 - n) * 0.2;
            } else {
                mix[2] = 1 - n * 0.25;
                mix[1] = n * 0.25;
            }
            tints.set(tint, k * 3);
            layers.set(mix, k * 4);
        }
    }
    // Soften the borders between them
    const soft = (values, width) => {
        const out = new Float32Array(values.length);
        for (let j = 0; j < size; j++) {
            for (let i = 0; i < size; i++) {
                let n = 0;
                const k = (i + j * size) * width;
                for (let y = Math.max(0, j - 1); y <= Math.min(GRID, j + 1); y++) {
                    for (let x = Math.max(0, i - 1); x <= Math.min(GRID, i + 1); x++) {
                        const m = (x + y * size) * width;
                        for (let c = 0; c < width; c++) {
                            out[k + c] += values[m + c];
                        }
                        n++;
                    }
                }
                for (let c = 0; c < width; c++) {
                    out[k + c] /= n;
                }
            }
        }
        return out;
    };
    return {tints: soft(tints, 3), layers: soft(layers, 4)};
}

const causticsUniforms = {uDay: {value: 1}};

export function buildTerrain(G) {
    const {world, art} = G;
    const size = GRID + 1;
    const {tints: allTints, layers} = groundLayers(world);
    const material = new THREE.MeshLambertMaterial({vertexColors: true});
    // MeshLambert gets a map only so that its shader has the parts needed; the ground picks its own pictures
    material.onBeforeCompile = shader => {
        shader.uniforms.uDetail = {value: art.detail};
        shader.uniforms.uWaterTex = {value: art.water};
        shader.uniforms.uTime = shared.uTime;
        shader.uniforms.uDay = causticsUniforms.uDay;
        for (const [name, texture] of Object.entries(art.ground)) {
            shader.uniforms['u_' + name] = {value: texture};
        }
        shader.vertexShader = 'attribute vec4 aLayers; varying vec4 vLayers; varying vec3 vPlace;\n' + shader.vertexShader.replace('#include <begin_vertex>', `
            #include <begin_vertex>
            vPlace = position;
            vLayers = aLayers;`);
        shader.fragmentShader = `uniform sampler2D uDetail; uniform sampler2D uWaterTex; uniform float uTime; uniform float uDay;
            uniform sampler2D u_sand; uniform sampler2D u_grass; uniform sampler2D u_jungle; uniform sampler2D u_mud; uniform sampler2D u_stone;
            varying vec4 vLayers; varying vec3 vPlace;\n` + shader.fragmentShader.replace('#include <color_fragment>', `
            #include <color_fragment>
            vec2 at = vPlace.xz;
            vec3 wide = texture2D(uDetail, at * 0.043).rgb;
            vec3 fine = texture2D(uDetail, at * 0.37).rgb;
            // Turned a little and at two sizes, so the pictures don't show a repeating pattern
            vec2 near = at * 0.17 + (wide.gr - 0.5) * 0.05;
            vec2 far = vec2(at.x * 0.8 - at.y * 0.6, at.x * 0.6 + at.y * 0.8) * 0.047;
            vec3 sandColor = mix(texture2D(u_sand, near).rgb, texture2D(u_sand, far).rgb, 0.45);
            vec3 grassColor = mix(texture2D(u_grass, near * 1.6).rgb, texture2D(u_grass, far).rgb, 0.4);
            vec3 jungleColor = mix(texture2D(u_jungle, near).rgb, texture2D(u_jungle, far * 1.5).rgb, 0.35);
            vec3 mudColor = texture2D(u_mud, near).rgb;
            vec3 stoneColor = texture2D(u_stone, near).rgb;
            // The borders wander with the noise
            vec4 w = vLayers * (0.35 + 1.3 * vec4(fine.g, wide.g, 1.0 - wide.g, fine.r));
            w = pow(w + 0.0001, vec4(2.0));
            float stoneShare = pow(max(0.0, 1.0 - dot(vLayers, vec4(1.0))), 2.0);
            float total = w.x + w.y + w.z + w.w + stoneShare;
            vec3 surface = (sandColor * w.x + grassColor * w.y + jungleColor * w.z + mudColor * w.w + stoneColor * stoneShare) / total;
            sampledDiffuseColor = vec4(surface, 1.0);
            diffuseColor.rgb *= surface * (0.82 + 0.36 * wide.g);
            // Damp sand along the waterline
            diffuseColor.rgb *= 1.0 - 0.3 * smoothstep(0.6, 0.05, vPlace.y) * smoothstep(-0.8, 0.0, vPlace.y);
            float c1 = texture2D(uWaterTex, at * 0.075 + uTime * vec2(0.011, 0.007)).b;
            float c2 = texture2D(uWaterTex, at * 0.11 - uTime * vec2(0.008, 0.012)).b;
            float caustic = pow(max(0.0, 1.0 - abs(c1 - c2) * 7.0), 5.0);
            diffuseColor.rgb += caustic * 0.26 * uDay * smoothstep(-0.1, -0.7, vPlace.y) * smoothstep(-22.0, -3.0, vPlace.y);
        `).replace('#include <normal_fragment_maps>', RELIEF.replace('#ifdef USE_MAP', '#if 1').replace('RELIEF_POWER', '0.05'))
            .replace('void main() {', 'void main() {\n    vec4 sampledDiffuseColor = vec4(1.0);');
    };

    const group = new THREE.Group();
    for (let cz = 0; cz < GRID / CHUNK; cz++) {
        for (let cx = 0; cx < GRID / CHUNK; cx++) {
            const count = CHUNK + 1;
            const positions = new Float32Array(count * count * 3);
            const normals = new Float32Array(count * count * 3);
            const tints = new Float32Array(count * count * 3);
            const made = new Float32Array(count * count * 4);
            let highest = -1e9;
            for (let j = 0; j < count; j++) {
                for (let i = 0; i < count; i++) {
                    const gi = cx * CHUNK + i;
                    const gj = cz * CHUNK + j;
                    const k = gi + gj * size;
                    const n = (i + j * count) * 3;
                    const h = world.heights[k];
                    highest = Math.max(highest, h);
                    positions[n] = (gi - GRID / 2) * CELL;
                    positions[n + 1] = h;
                    positions[n + 2] = (gj - GRID / 2) * CELL;
                    const left = world.heights[Math.max(0, gi - 1) + gj * size];
                    const right = world.heights[Math.min(GRID, gi + 1) + gj * size];
                    const up = world.heights[gi + Math.max(0, gj - 1) * size];
                    const down = world.heights[gi + Math.min(GRID, gj + 1) * size];
                    const nx = left - right;
                    const ny = 2 * CELL;
                    const nz = up - down;
                    const length = Math.hypot(nx, ny, nz);
                    normals[n] = nx / length;
                    normals[n + 1] = ny / length;
                    normals[n + 2] = nz / length;
                    tints[n] = allTints[k * 3];
                    tints[n + 1] = allTints[k * 3 + 1];
                    tints[n + 2] = allTints[k * 3 + 2];
                    made.set(layers.subarray(k * 4, k * 4 + 4), (i + j * count) * 4);
                }
            }
            if (highest < DEEPEST_SHOWN) {
                continue;
            }
            const index = [];
            for (let j = 0; j < CHUNK; j++) {
                for (let i = 0; i < CHUNK; i++) {
                    const a = i + j * count;
                    const b = a + 1;
                    const c = a + count;
                    const d = c + 1;
                    index.push(a, c, b, b, c, d);
                }
            }
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
            geometry.setAttribute('color', new THREE.BufferAttribute(tints, 3));
            geometry.setAttribute('aLayers', new THREE.BufferAttribute(made, 4));
            geometry.setIndex(index);
            geometry.computeBoundingSphere();
            const mesh = new THREE.Mesh(geometry, material);
            mesh.receiveShadow = true;
            mesh.userData = {cx, cz};
            group.add(mesh);
        }
    }
    G.scene.add(group);
    return group;
}

// The ground under the crowns of the trees is darker, also where no sun shadow is drawn
export function shadeTerrain(terrain, world, crowns) {
    const size = GRID + 1;
    const shade = new Float32Array(size * size);
    for (const {x, z, r} of crowns) {
        const gi = x / CELL + GRID / 2;
        const gj = z / CELL + GRID / 2;
        const reach = r / CELL;
        for (let j = Math.max(0, Math.floor(gj - reach)); j <= Math.min(GRID, Math.ceil(gj + reach)); j++) {
            for (let i = Math.max(0, Math.floor(gi - reach)); i <= Math.min(GRID, Math.ceil(gi + reach)); i++) {
                const d = Math.hypot(i - gi, j - gj) / reach;
                if (d < 1) {
                    shade[i + j * size] += (1 - d) * 0.42;
                }
            }
        }
    }
    for (const mesh of terrain.children) {
        const {cx, cz} = mesh.userData;
        const colors = mesh.geometry.attributes.color;
        const count = CHUNK + 1;
        for (let j = 0; j < count; j++) {
            for (let i = 0; i < count; i++) {
                const f = 1 - Math.min(0.34, shade[cx * CHUNK + i + (cz * CHUNK + j) * size]);
                const n = i + j * count;
                colors.setXYZ(n, colors.getX(n) * f, colors.getY(n) * f, colors.getZ(n) * f);
            }
        }
        colors.needsUpdate = true;
    }
}

const WATER_VERTEX = `
    varying vec3 vPlace;
    void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vPlace = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
    }`;

const WATER_FRAGMENT = `
    uniform sampler2D uNormals; uniform sampler2D uDepth; uniform float uTime; uniform float uChop; uniform float uSize;
    uniform vec3 uSunDir; uniform vec3 uSunColor; uniform vec3 uZenith; uniform vec3 uHorizon; uniform vec3 uFog; uniform float uFogDensity; uniform float uLight;
    varying vec3 vPlace;
    void main() {
        vec2 p = vPlace.xz;
        vec3 a = texture2D(uNormals, p * 0.021 + uTime * vec2(0.008, 0.005)).xyz * 2.0 - 1.0;
        vec3 b = texture2D(uNormals, p * 0.067 - uTime * vec2(0.013, 0.017)).xyz * 2.0 - 1.0;
        vec3 c = texture2D(uNormals, p * 0.23 + uTime * vec2(0.021, -0.016)).xyz * 2.0 - 1.0;
        vec3 n = normalize(vec3((a.x + b.x * 0.7 + c.x * 0.35) * uChop, 1.0, (a.y + b.y * 0.7 + c.y * 0.35) * uChop));
        vec3 toEye = cameraPosition - vPlace;
        float distance = length(toEye);
        vec3 v = toEye / distance;
        vec2 uv = p / uSize + 0.5;
        vec4 info = texture2D(uDepth, uv);
        float depth = info.r * 14.0;
        float murk = info.g;

        if (!gl_FrontFacing) {
            // Seen from below: light comes through right above, further out it mirrors the deep
            float up = pow(max(0.0, -v.y), 2.0);
            vec3 under = mix(vec3(0.02, 0.26, 0.34), vec3(0.72, 0.92, 0.95), up) * uLight;
            gl_FragColor = vec4(under, 0.92);
            #include <colorspace_fragment>
            return;
        }

        float inRiver = smoothstep(0.2, 0.4, murk);
        float inSwamp = smoothstep(0.7, 0.95, murk);
        vec3 shallow = mix(mix(vec3(0.05, 0.46, 0.44), vec3(0.05, 0.10, 0.06), inRiver), vec3(0.05, 0.05, 0.02), inSwamp);
        vec3 deep = mix(mix(vec3(0.004, 0.065, 0.17), vec3(0.012, 0.04, 0.03), inRiver), vec3(0.02, 0.025, 0.01), inSwamp);
        vec3 water = mix(shallow, deep, smoothstep(0.1, 8.5, depth)) * uLight;
        float fresnel = 0.03 + 0.97 * pow(1.0 - max(dot(n, v), 0.0), 4.0);
        vec3 r = reflect(-v, n);
        vec3 sky = mix(uHorizon, uZenith, pow(clamp(r.y * 1.5, 0.0, 1.0), 0.6));
        // Rivers and swamps mirror the trees along the bank more than the sky
        sky = mix(sky, vec3(0.02, 0.05, 0.025) * uLight, inRiver * smoothstep(0.7, 0.1, r.y) * 0.98);
        vec3 color = mix(water, sky, fresnel * mix(0.55, 0.7, inRiver));
        float glint = pow(max(dot(r, uSunDir), 0.0), 340.0);
        color += uSunColor * glint * 2.5;

        // Foam comes and goes along the shore
        float shore = smoothstep(0.55, 0.03, depth) * (1.0 - inRiver);
        float wave = sin(depth * 11.0 - uTime * 0.85 + a.z * 7.0);
        float foam = shore * smoothstep(0.3, 0.8, c.z * 0.5 + b.z * 0.5 + wave * 0.34);
        color = mix(color, vec3(0.92) * max(uLight, 0.1), foam * 0.8);

        float alpha = mix(mix(0.42, 0.72, inRiver), 1.0, smoothstep(0.0, mix(4.0, 1.2, inRiver), depth));
        alpha = max(alpha, foam);
        alpha = mix(alpha, 1.0, fresnel * mix(1.0, 0.5, inRiver));
        float fog = 1.0 - exp(-uFogDensity * uFogDensity * distance * distance);
        gl_FragColor = vec4(mix(color, uFog, fog), alpha);
        #include <colorspace_fragment>
    }`;

export function buildWater(G) {
    const {world, art} = G;
    const size = GRID + 1;
    const data = new Uint8Array(size * size * 4);
    for (let i = 0; i < size * size; i++) {
        data[i * 4] = Math.min(255, Math.max(0, -world.heights[i] / 14 * 255));
        data[i * 4 + 1] = world.murk[i];
        data[i * 4 + 3] = 255;
    }
    const depth = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    depth.magFilter = depth.minFilter = THREE.LinearFilter;
    depth.needsUpdate = true;
    const uniforms = {
        uNormals: {value: art.water}, uDepth: {value: depth}, uTime: shared.uTime, uChop: {value: 0.32}, uSize: {value: WORLD_SIZE},
        uSunDir: {value: new THREE.Vector3(0, 1, 0)}, uSunColor: {value: new THREE.Color()},
        uZenith: {value: new THREE.Color()}, uHorizon: {value: new THREE.Color()}, uFog: {value: new THREE.Color()},
        uFogDensity: {value: 0.002}, uLight: {value: 1}
    };
    const material = new THREE.ShaderMaterial({
        vertexShader: WATER_VERTEX, fragmentShader: WATER_FRAGMENT, uniforms, transparent: true, depthWrite: false, side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(5000, 5000).rotateX(-Math.PI / 2), material);
    mesh.renderOrder = 2;
    G.scene.add(mesh);
    return {mesh, uniforms};
}

const SKY_VERTEX = `
    varying vec3 vDir;
    void main() {
        vDir = position;
        vec4 p = projectionMatrix * mat4(mat3(viewMatrix)) * vec4(position, 1.0);
        gl_Position = p.xyww;
    }`;

const SKY_FRAGMENT = `
    uniform sampler2D uClouds; uniform vec3 uSunDir; uniform vec3 uZenith; uniform vec3 uHorizon; uniform vec3 uSunColor; uniform vec3 uCloudLit; uniform vec3 uCloudDark;
    uniform float uCover; uniform float uStars; uniform float uTime; uniform float uFlash; uniform vec3 uMoonDir; uniform float uSunShow;
    varying vec3 vDir;
    float hash(vec3 p) { return fract(sin(dot(p, vec3(12.98, 78.23, 37.71))) * 43758.5453); }
    void main() {
        vec3 d = normalize(vDir);
        float h = max(d.y, 0.0);
        vec3 color = mix(uHorizon, uZenith, pow(h, 0.5));
        float sun = max(dot(d, uSunDir), 0.0);
        color += uSunColor * (pow(sun, 6.0) * 0.16 + pow(sun, 64.0) * 0.3) * uSunShow;
        color += uSunColor * smoothstep(0.9993, 0.9997, sun) * 6.0 * uSunShow;
        if (uStars > 0.01) {
            vec3 cell = floor(d * 170.0);
            float star = step(0.9975, hash(cell));
            color += vec3(star) * (0.5 + 0.5 * hash(cell + 1.0)) * uStars * smoothstep(0.02, 0.18, d.y);
            float moon = max(dot(d, uMoonDir), 0.0);
            color += vec3(0.9, 0.92, 1.0) * (smoothstep(0.9994, 0.9996, moon) * 1.6 + pow(moon, 90.0) * 0.1) * uStars;
        }
        if (d.y > 0.0) {
            vec2 uv = d.xz / (d.y + 0.14) * 0.13;
            vec2 drift = uTime * vec2(0.0035, 0.0018);
            float c = texture2D(uClouds, uv + drift).r * 0.6
                    + texture2D(uClouds, uv * 2.9 - drift * 0.6).r * 0.28
                    + texture2D(uClouds, uv * 7.3 + drift * 0.4).r * 0.12;
            float edge = 1.0 - uCover;
            float amount = smoothstep(edge, edge + 0.16, c) * smoothstep(0.0, 0.1, d.y);
            // Thick parts and the side away from the sun are in shade
            vec2 towardSun = uSunDir.xz * 0.035;
            float behind = texture2D(uClouds, uv + drift + towardSun).r * 0.6 + texture2D(uClouds, uv * 2.9 - drift * 0.6 + towardSun * 2.9).r * 0.4;
            float lit = clamp(0.62 + (c - behind) * 3.2 - smoothstep(edge + 0.1, edge + 0.42, c) * 0.34, 0.0, 1.0);
            vec3 cloud = mix(uCloudDark, uCloudLit, lit);
            cloud += uSunColor * pow(sun, 8.0) * 0.32 * uSunShow;
            color = mix(color, cloud, amount);
        }
        color += vec3(uFlash);
        gl_FragColor = vec4(color, 1.0);
        #include <colorspace_fragment>
    }`;

function buildSky(G) {
    const uniforms = {
        uClouds: {value: G.art.clouds}, uSunDir: {value: new THREE.Vector3(0, 1, 0)}, uMoonDir: {value: new THREE.Vector3(0, 1, 0)},
        uZenith: {value: new THREE.Color()}, uHorizon: {value: new THREE.Color()}, uSunColor: {value: new THREE.Color()},
        uCloudLit: {value: new THREE.Color()}, uCloudDark: {value: new THREE.Color()}, uCover: {value: 0.3}, uStars: {value: 0},
        uTime: shared.uTime, uFlash: {value: 0}, uSunShow: {value: 1}
    };
    const material = new THREE.ShaderMaterial({
        vertexShader: SKY_VERTEX, fragmentShader: SKY_FRAGMENT, uniforms, side: THREE.BackSide, depthWrite: false, depthTest: true
    });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(10, 24, 14), material);
    mesh.frustumCulled = false;
    mesh.renderOrder = -10;
    G.scene.add(mesh);
    return {mesh, uniforms};
}

function buildRain(G) {
    const count = G.quality === 'low' ? 500 : 1400;
    const seeds = new Float32Array(count * 2 * 4);
    const ends = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
        const seed = [Math.random() * 44, Math.random() * 26, Math.random() * 44, Math.random()];
        for (let k = 0; k < 2; k++) {
            seeds.set(seed, (i * 2 + k) * 4);
            ends[i * 2 + k] = k;
        }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 2 * 3), 3));
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
    geometry.setAttribute('aEnd', new THREE.BufferAttribute(ends, 1));
    const material = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: {uTime: shared.uTime, uRain: {value: 0}, uSlant: {value: new THREE.Vector2(0, 0)}, uCam: {value: new THREE.Vector3()}, uLight: {value: 1}},
        vertexShader: `
            attribute vec4 aSeed; attribute float aEnd;
            uniform float uTime; uniform float uRain; uniform vec2 uSlant; uniform vec3 uCam;
            varying float vShow;
            void main() {
                vShow = step(aSeed.w, uRain);
                float fall = mod(aSeed.y - uTime * 21.0, 26.0);
                vec2 drift = mod(aSeed.xz + uSlant * uTime - uCam.xz, 44.0) - 22.0;
                vec3 p = vec3(uCam.x + drift.x, uCam.y + fall - 8.0, uCam.z + drift.y);
                p += vec3(uSlant.x, 21.0, uSlant.y) * aEnd * 0.045;
                gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
            }`,
        fragmentShader: `
            uniform float uLight; varying float vShow;
            void main() {
                if (vShow < 0.5) discard;
                gl_FragColor = vec4(vec3(0.75, 0.8, 0.86) * uLight, 0.42);
            }`
    });
    const lines = new THREE.LineSegments(geometry, material);
    lines.frustumCulled = false;
    lines.renderOrder = 3;
    lines.visible = false;
    G.scene.add(lines);
    return lines;
}

// hour, zenith, horizon, sun color, sun strength, light from the sky
const DAY = [
    [0, '#050a1c', '#0d1529', '#a4b8e4', 0.75, 0.62],
    [4.6, '#050a1c', '#0d1529', '#a4b8e4', 0.75, 0.62],
    [5.6, '#1b2c58', '#8c5b5a', '#ffae80', 0.3, 0.5],
    [6.6, '#4b80c2', '#ffc792', '#ffcf9f', 1.7, 1.0],
    [8.6, '#2f7cd8', '#bfe2f2', '#fff2dc', 2.8, 1.3],
    [16.5, '#2f7cd8', '#c5e3f0', '#fff2dc', 2.8, 1.3],
    [18, '#3f6fb8', '#ffd09a', '#ffc58a', 2.0, 1.05],
    [19, '#2a3d78', '#e8744c', '#ff8a55', 0.55, 0.65],
    [20, '#0e1636', '#2b2140', '#a4b8e4', 0.7, 0.62],
    [24, '#050a1c', '#0d1529', '#a4b8e4', 0.75, 0.62]
].map(([hour, zenith, horizon, sun, strength, hemi]) => ({hour, zenith: new THREE.Color(zenith), horizon: new THREE.Color(horizon), sun: new THREE.Color(sun), strength, hemi}));

export const WEATHERS = {
    clear: {name: 'Sunshine', icon: '☀️', cover: 0.3, over: 0, rain: 0, fog: 0.0021, wind: 0.32, temp: 0, chop: 0.28},
    cloudy: {name: 'Cloudy', icon: '⛅', cover: 0.62, over: 0.34, rain: 0, fog: 0.0027, wind: 0.55, temp: -1, chop: 0.36},
    rain: {name: 'Rain', icon: '🌧️', cover: 0.9, over: 0.72, rain: 0.55, fog: 0.0062, wind: 0.8, temp: -4, chop: 0.5},
    thunder: {name: 'Thunderstorm', icon: '⛈️', cover: 0.97, over: 0.9, rain: 0.85, fog: 0.008, wind: 1.3, temp: -5, chop: 0.75, bolts: true},
    fog: {name: 'Fog', icon: '🌫️', cover: 0.72, over: 0.56, rain: 0, fog: 0.024, wind: 0.14, temp: -3, chop: 0.2},
    storm: {name: 'Storm', icon: '🌀', cover: 1, over: 1, rain: 1, fog: 0.012, wind: 2.2, temp: -7, chop: 1.1, bolts: true}
};
const CHANCES = [['clear', 38], ['cloudy', 24], ['rain', 16], ['fog', 9], ['thunder', 9], ['storm', 4]];

export class Environment {
    constructor(G) {
        this.G = G;
        this.sun = new THREE.DirectionalLight(0xffffff, 3);
        this.sun.castShadow = G.quality !== 'low';
        const size = G.quality === 'high' ? 2048 : 1536;
        this.sun.shadow.mapSize.set(size, size);
        Object.assign(this.sun.shadow.camera, {left: -42, right: 42, top: 42, bottom: -42, near: 1, far: 320});
        this.sun.shadow.bias = -0.0006;
        this.sun.shadow.normalBias = 0.04;
        this.sun.shadow.autoUpdate = false;
        this.hemi = new THREE.HemisphereLight(0xffffff, 0x4a4a30, 1.2);
        G.scene.add(this.sun, this.sun.target, this.hemi);
        G.scene.fog = new THREE.FogExp2(0xbfe2f2, 0.002);
        this.sky = buildSky(G);
        this.water = buildWater(G);
        this.rainLines = buildRain(G);
        this.state = {cover: 0.3, over: 0, rain: 0, fog: 0.0021, wind: 0.32, temp: 0, chop: 0.28};
        this.weather = {kind: 'clear', until: 34};
        this.flash = 0;
        this.nextBolt = 8;
        this.indoor = 0;
        this.underwater = false;
        this.frame = 0;
        this.zenith = new THREE.Color();
        this.horizon = new THREE.Color();
        this.sunColor = new THREE.Color();
        this.direction = new THREE.Vector3();
        this.sunShadowAt = new THREE.Vector3(1e9, 0, 0);
    }

    get hour() {
        return ((this.G.clock % 24) + 24) % 24;
    }

    get isNight() {
        return this.hour >= 19.5 || this.hour < 5.5;
    }

    get kind() {
        return WEATHERS[this.weather.kind];
    }

    get rain() {
        return this.state.rain;
    }

    get tempDelta() {
        return this.state.temp;
    }

    pickWeather() {
        const total = CHANCES.reduce((sum, [, n]) => sum + n, 0);
        let roll = Math.random() * total;
        let kind = 'clear';
        for (const [name, n] of CHANCES) {
            roll -= n;
            if (roll <= 0) {
                kind = name;
                break;
            }
        }
        const hours = kind === 'storm' ? 2 + Math.random() * 3 : 2.5 + Math.random() * 6;
        const before = this.weather.kind;
        this.weather = {kind, until: this.G.clock + hours};
        if (before !== kind && (kind === 'storm' || kind === 'thunder')) {
            this.G.notify(kind === 'storm' ? 'A storm is coming. Find shelter.' : 'Thunder in the distance.');
        }
    }

    setWeather(kind, hours = 5) {
        this.weather = {kind, until: this.G.clock + hours};
    }

    // After sleeping: the sky doesn't take time to catch up
    settle() {
        Object.assign(this.state, this.pickTargets());
    }

    pickTargets() {
        const {cover, over, rain, fog, wind, temp, chop} = this.kind;
        return {cover, over, rain, fog, wind, temp, chop};
    }

    update(dt, realDt) {
        const {G, state} = this;
        if (G.clock > this.weather.until) {
            this.pickWeather();
        }
        const target = this.pickTargets();
        const speed = Math.min(1, realDt * 0.09);
        for (const key of Object.keys(target)) {
            state[key] += (target[key] - state[key]) * speed;
        }
        shared.uWind.value = state.wind;

        const camera = G.camera;
        const hour = this.hour;
        let i = 0;
        while (i < DAY.length - 2 && DAY[i + 1].hour <= hour) {
            i++;
        }
        const a = DAY[i];
        const b = DAY[i + 1];
        const t = (hour - a.hour) / (b.hour - a.hour);
        this.zenith.copy(a.zenith).lerp(b.zenith, t);
        this.horizon.copy(a.horizon).lerp(b.horizon, t);
        this.sunColor.copy(a.sun).lerp(b.sun, t);
        let strength = a.strength + (b.strength - a.strength) * t;
        let hemi = a.hemi + (b.hemi - a.hemi) * t;

        const dayTime = hour >= 5.6 && hour < 19.4;
        const angle = dayTime ? (hour - 6) / 13 * Math.PI : ((hour + 5) % 24) / 10.5 * Math.PI;
        this.direction.set(Math.cos(angle), Math.max(0.1, Math.sin(angle)), 0.28).normalize();
        const sunAngle = (hour - 6) / 13 * Math.PI;
        const moonAngle = ((hour + 5) % 24) / 10.5 * Math.PI;

        // Clouds grey everything and take the sun away
        const grey = this.horizon.r * 0.3 + this.horizon.g * 0.59 + this.horizon.b * 0.11;
        const dark = 1 - state.over * 0.68;
        this.horizon.lerp(new THREE.Color(grey, grey, grey * 1.04), state.over * 0.9).multiplyScalar(dark);
        const greyZ = this.zenith.r * 0.3 + this.zenith.g * 0.59 + this.zenith.b * 0.11;
        this.zenith.lerp(new THREE.Color(greyZ * 1.05, greyZ * 1.05, greyZ * 1.15), state.over * 0.85).multiplyScalar(dark * 0.92);
        strength *= 1 - state.over * 0.86;
        hemi *= 1 - state.over * 0.36;

        this.flash = Math.max(0, this.flash - realDt * 6);
        if (this.kind.bolts && !this.underwater) {
            this.nextBolt -= realDt;
            if (this.nextBolt <= 0) {
                this.nextBolt = 5 + Math.random() * (this.weather.kind === 'storm' ? 12 : 24);
                this.flash = 1;
                G.audio.thunder(0.35 + Math.random() * 2.2);
            }
        }

        const below = Boolean(G.player && G.player.underground);
        const underwaterTarget = !below && camera.position.y < -0.02;
        this.underwater = underwaterTarget;
        this.indoor += ((below ? 1 : 0) - this.indoor) * Math.min(1, realDt * 1.6);
        const lightScale = 1 - 0.86 * this.indoor;

        this.sun.color.copy(this.sunColor);
        this.sun.intensity = strength * (1 - this.indoor);
        const outside = hemi * (1 + 0.85 * smoothstep(0.6, 1.3, hemi)) + this.flash * 1.9 + 0.35 * smoothstep(0.75, 0.62, hemi);
        // Below the ground it is the same by day and by night: nearly dark
        this.hemi.intensity = outside + (0.09 - outside) * this.indoor;
        this.hemi.color.copy(this.zenith).lerp(this.horizon, 0.55).multiplyScalar(1.3).addScalar(0.1).lerp(CAVE_DARK, this.indoor);
        const view = this.sun.target.position;
        const px = Math.round(camera.position.x / 6) * 6;
        const pz = Math.round(camera.position.z / 6) * 6;
        view.set(px, 0, pz);
        this.sun.position.set(px + this.direction.x * 140, this.direction.y * 140, pz + this.direction.z * 140);
        this.sun.target.updateMatrixWorld();
        this.frame++;
        if (this.sun.castShadow && !below && this.frame % G.shadowEvery === 0) {
            this.sun.shadow.needsUpdate = true;
        }

        const fog = G.scene.fog;
        if (this.underwater) {
            const deep = Math.min(1, -camera.position.y / 14);
            fog.color.setRGB(0.02 + hemi * 0.04 * (1 - deep), 0.2 * hemi * (1 - deep * 0.6) + 0.03, 0.3 * hemi * (1 - deep * 0.5) + 0.05);
            fog.density = 0.055;
        } else {
            fog.color.copy(this.horizon).lerp(this.zenith, 0.12);
            fog.color.lerp(new THREE.Color(0.01, 0.01, 0.01), this.indoor * 0.9);
            fog.density = state.fog * (1 - this.indoor) + this.indoor * 0.024;
        }

        const sky = this.sky.uniforms;
        sky.uSunDir.value.set(Math.cos(sunAngle), Math.sin(sunAngle), 0.28).normalize();
        sky.uMoonDir.value.set(Math.cos(moonAngle), Math.sin(moonAngle), 0.28).normalize();
        sky.uZenith.value.copy(this.zenith);
        sky.uHorizon.value.copy(this.horizon);
        sky.uSunColor.value.copy(this.sunColor);
        sky.uSunShow.value = (1 - state.over * 0.95) * smoothstep(-0.06, 0.04, sky.uSunDir.value.y);
        sky.uCover.value = state.cover;
        sky.uStars.value = smoothstep(0.35, 0.05, hemi - 0.55) * (1 - state.over) * (hour > 19 || hour < 6 ? 1 : 0);
        const cloudLight = Math.min(1.1, 0.05 + Math.max(0, hemi - 0.6) * 1.3 + strength * 0.06) * (1 - state.over * 0.5);
        sky.uCloudLit.value.setRGB(cloudLight, cloudLight, cloudLight).lerp(this.sunColor, 0.14);
        sky.uCloudDark.value.setRGB(cloudLight * 0.52, cloudLight * 0.56, cloudLight * 0.64);
        sky.uFlash.value = this.flash * 0.65;
        this.sky.mesh.position.copy(camera.position);

        const water = this.water.uniforms;
        water.uSunDir.value.copy(sky.uSunDir.value.y > 0 ? sky.uSunDir.value : sky.uMoonDir.value);
        water.uSunColor.value.copy(this.sunColor).multiplyScalar(1 - state.over * 0.9);
        water.uZenith.value.copy(this.zenith);
        water.uHorizon.value.copy(this.horizon);
        water.uFog.value.copy(fog.color);
        water.uFogDensity.value = this.underwater ? 0.03 : fog.density;
        water.uLight.value = Math.min(1.1, 0.1 + strength * strength * 0.1 + Math.max(0, hemi - 0.6) * 0.35 + this.flash * 0.5);
        water.uChop.value = state.chop;
        causticsUniforms.uDay.value = strength * 0.35;

        const rain = this.rainLines;
        rain.visible = state.rain > 0.02 && !this.underwater && this.indoor < 0.5;
        if (rain.visible) {
            rain.material.uniforms.uRain.value = state.rain;
            rain.material.uniforms.uSlant.value.set(state.wind * 3.2, state.wind * 1.6);
            rain.material.uniforms.uCam.value.copy(camera.position);
            rain.material.uniforms.uLight.value = Math.min(1, 0.2 + hemi * 0.7);
        }
    }
}
