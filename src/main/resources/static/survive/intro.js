// The film parts: the plane crash, waking up on the beach, and the helicopter.
import * as THREE from './lib/three.module.min.js';
import {REGION, Shape, color, keepNormals, shared, softDot, v3} from './art.js';

const el = id => document.getElementById(id);
const ease = t => t * t * (3 - 2 * t);
const R = 1.95;
const CY = 0.95;
const LENGTH = 16;
const EYE = [-1.36, 1.14, 0.6];

function cabinTexture() {
    const W = 1024;
    const H = 2048;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const c = canvas.getContext('2d');
    const walls = c.createLinearGradient(0, 0, W, 0);
    walls.addColorStop(0, '#d9d4c8');
    walls.addColorStop(0.25, '#f0ece3');
    walls.addColorStop(0.5, '#d9d4c8');
    walls.addColorStop(0.75, '#a9a59a');
    walls.addColorStop(1, '#d9d4c8');
    c.fillStyle = walls;
    c.fillRect(0, 0, W, H);
    c.strokeStyle = 'rgba(70,65,55,0.35)';
    c.lineWidth = 2;
    for (let y = 0; y < H; y += 134) {
        c.beginPath();
        c.moveTo(0, y);
        c.lineTo(W, y);
        c.stroke();
    }
    // The windows are holes in this picture: the sky is drawn behind the cabin
    const uLeft = (Math.PI - 0.11) / (Math.PI * 2);
    const uRight = 0.11 / (Math.PI * 2);
    const spots = [];
    for (let z = -7.8; z < 8; z += 1.05) {
        const v = (z + LENGTH / 2) / LENGTH;
        spots.push([uLeft * W, (1 - v) * H], [uRight * W, (1 - v) * H]);
    }
    c.fillStyle = '#ffffff';
    for (const [x, y] of spots) {
        c.beginPath();
        c.ellipse(x, y, 34, 38, 0, 0, 7);
        c.fill();
    }
    c.globalCompositeOperation = 'destination-out';
    for (const [x, y] of spots) {
        c.beginPath();
        c.ellipse(x, y, 25, 28, 0, 0, 7);
        c.fill();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return texture;
}

function shellPart(material, z0, z1, phi0, phi1) {
    const positions = [];
    const uvs = [];
    const normals = [];
    const index = [];
    const rows = 12;
    const sides = 48;
    for (let j = 0; j <= rows; j++) {
        const z = z0 + (z1 - z0) * j / rows;
        for (let i = 0; i <= sides; i++) {
            const phi = phi0 + (phi1 - phi0) * i / sides;
            positions.push(R * Math.cos(phi), CY + R * Math.sin(phi), z);
            normals.push(-Math.cos(phi), -Math.sin(phi), 0);
            uvs.push(phi / (Math.PI * 2), (z + LENGTH / 2) / LENGTH);
        }
    }
    for (let j = 0; j < rows; j++) {
        for (let i = 0; i < sides; i++) {
            const a = j * (sides + 1) + i;
            const b = a + sides + 1;
            index.push(a, b, a + 1, a + 1, b, b + 1);
        }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(index);
    return new THREE.Mesh(g, material);
}

function drawDisplay(canvas, stage, altitude, flash) {
    const c = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    c.fillStyle = stage >= 2 && flash ? '#5e0808' : '#08121f';
    c.fillRect(0, 0, W, H);
    c.textAlign = 'center';
    const lines = [
        [['#7fc8ff', 'FLIGHT LI 418'], ['#ffffff', 'Clear skies ahead']],
        [['#ffc23a', '⚠ CAUTION'], ['#ffffff', 'Severe turbulence'], ['#ffffff', 'Fasten seatbelts']],
        [['#ff5040', '⚠ WARNING'], ['#ffffff', 'TORNADO AHEAD'], ['#ffc23a', 'Air currents severe']],
        [['#ff5040', '⚠ ENGINE FAILURE'], ['#ffffff', 'LOSS OF CABIN PRESSURE'], ['#ffc23a', 'Put on oxygen masks']],
        [['#ff5040', '⚠ PULL UP ⚠'], ['#ffffff', 'BRACE FOR IMPACT']]
    ][stage];
    lines.forEach(([color_, text], i) => {
        c.fillStyle = color_;
        c.font = `700 ${i === 0 ? 52 : 38}px Fredoka, sans-serif`;
        c.fillText(text, W / 2, 74 + i * 58);
    });
    c.fillStyle = stage >= 3 ? '#ff5040' : '#9fd5ff';
    c.font = '600 34px Fredoka, sans-serif';
    c.fillText('Altitude ' + Math.max(0, Math.round(altitude)).toLocaleString('en-US') + ' m', W / 2, H - 30);
}

// Plays the crash, then calls done
export class CrashScene {
    constructor(G, done) {
        this.G = G;
        this.done = done;
        this.t = 0;
        this.cues = [
            [0.2, () => this.say('')],
            [4.8, () => this.jolt()],
            [6, () => this.jolt()],
            [7.2, () => this.setStage(1)],
            [8, () => {
                G.audio.play('chime');
                this.say('Pilot: "Ladies and gentlemen, this is your captain. We have run into powerful air currents."');
            }],
            [11, () => this.say('Pilot: "There is a dangerous tornado nearby. Please return to your seats and fasten your seatbelts."')],
            [14.5, () => {
                this.say('');
                this.setStage(2);
                this.jolt();
            }],
            [16, () => this.jolt()],
            [18.2, () => {
                G.audio.play('boom');
                this.lightsOut = true;
                this.masks.visible = true;
                this.setStage(3);
            }],
            [19.6, () => this.say('Pilot: "We are in it! Hold on! Hold on!"')],
            [21.2, () => {
                this.say('');
                G.audio.play('gasp');
            }],
            [23, () => G.audio.play('gasp')],
            [26.6, () => this.breakWing()],
            [29.2, () => this.breakCabin()],
            [31.5, () => {
                this.setStage(4);
                this.say('Pilot: "Brace! Brace! Brace!"');
            }],
            [34.6, () => {
                this.say('');
                G.audio.play('impact');
                this.hold.stop();
                this.black = true;
            }]
        ];
        // time, turn, up or down, zoom, and where the head is: x, y, z
        this.poses = [
            [0, 1.66, -0.1, 62, ...EYE],
            [6.8, 1.66, -0.1, 62, ...EYE],
            [8.2, 0.3, 0.5, 66, ...EYE],
            [12.2, 0.28, 0.5, 66, ...EYE],
            [13.6, 1.68, -0.06, 58, ...EYE],
            [19, 1.7, -0.04, 58, ...EYE],
            [20.5, 0.02, -0.24, 44, ...EYE],
            [24.8, 0, -0.24, 40, ...EYE],
            [26, 1.68, -0.08, 56, ...EYE],
            [28.8, 1.7, -0.1, 56, ...EYE],
            [29.4, 2.95, -0.04, 70, -1.05, 1.52, 0.72],
            [31.2, 3.05, -0.02, 70, -1.05, 1.52, 0.72],
            [32.2, 1.66, -0.14, 64, ...EYE],
            [35, 1.66, -0.18, 72, ...EYE]
        ];
        this.build();
    }

    say(text) {
        const box = el('subtitle');
        box.hidden = !text;
        box.textContent = text;
    }

    jolt() {
        this.bump = 1;
        this.G.audio.play('rattle');
    }

    setStage(stage) {
        this.stage = stage;
        this.redraw(true);
    }

    redraw(force) {
        const flash = Math.floor(this.t * 3) % 2 === 0;
        if (force || flash !== this.lastFlash || this.stage >= 3) {
            this.lastFlash = flash;
            drawDisplay(this.displayCanvas, this.stage, this.altitude, flash);
            this.displayTexture.needsUpdate = true;
        }
    }

    build() {
        const {G} = this;
        this.stage = 0;
        this.altitude = 11200;
        this.storm = 0;
        this.camera = new THREE.PerspectiveCamera(62, 1, 0.04, 80000);
        this.camera.rotation.order = 'YXZ';
        this.camera.position.set(...EYE);

        // Outside
        this.sky = new THREE.Scene();
        this.outside = new THREE.Group();
        this.sky.add(this.outside);
        this.skyUniforms = {
            uStorm: {value: 0}, uFlash: {value: 0}
        };
        const dome = new THREE.Mesh(new THREE.SphereGeometry(30000, 24, 16), new THREE.ShaderMaterial({
            side: THREE.BackSide,
            depthWrite: false,
            uniforms: this.skyUniforms,
            vertexShader: 'varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
            fragmentShader: `
                uniform float uStorm; uniform float uFlash; varying vec3 vDir;
                void main() {
                    float h = clamp(vDir.y, -0.2, 1.0);
                    vec3 calm = mix(vec3(0.85, 0.92, 1.0), vec3(0.16, 0.42, 0.85), smoothstep(-0.05, 0.5, h));
                    vec3 dark = mix(vec3(0.26, 0.28, 0.27), vec3(0.06, 0.07, 0.09), smoothstep(-0.05, 0.5, h));
                    gl_FragColor = vec4(mix(calm, dark, uStorm) + uFlash, 1.0);
                    #include <colorspace_fragment>
                }`
        }));
        this.outside.add(dome);
        this.sun = new THREE.Sprite(new THREE.SpriteMaterial({map: softDot('rgba(255,255,240,1)', 'rgba(255,240,190,0.5)'), blending: THREE.AdditiveBlending, depthWrite: false}));
        this.sun.position.set(-9000, 7500, -3000);
        this.sun.scale.setScalar(5000);
        this.outside.add(this.sun);

        this.ocean = new THREE.Mesh(new THREE.CircleGeometry(40000, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({color: 0x0e4c78}));
        this.ocean.position.y = -3000;
        this.outside.add(this.ocean);
        const island = new THREE.Group();
        const beach = new THREE.Mesh(new THREE.CircleGeometry(780, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({color: 0xdcc98e}));
        const land = new THREE.Mesh(new THREE.CircleGeometry(690, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({color: 0x2f6a2e}));
        land.position.y = 1;
        island.add(beach, land);
        island.position.set(-1400, 2, -5200);
        this.ocean.add(island);

        const puff = softDot('rgba(255,255,255,0.95)', 'rgba(245,245,245,0.4)');
        this.cloudMaterial = new THREE.SpriteMaterial({map: puff, depthWrite: false, color: 0xffffff});
        this.clouds = [];
        for (let i = 0; i < 70; i++) {
            const cloud = new THREE.Sprite(this.cloudMaterial);
            this.placeCloud(cloud, true);
            this.outside.add(cloud);
            this.clouds.push(cloud);
        }

        // The tornado: a dark funnel, turning
        const profile = [];
        for (let i = 0; i <= 26; i++) {
            const t = i / 26;
            profile.push(new THREE.Vector2(44 + Math.pow(t, 2.1) * 2100, -3000 + t * 7600));
        }
        this.funnelUniforms = {uTime: {value: 0}, uClouds: {value: G.art.clouds}, uFlash: {value: 0}};
        this.funnel = new THREE.Mesh(new THREE.LatheGeometry(profile, 56), new THREE.ShaderMaterial({
            side: THREE.DoubleSide,
            uniforms: this.funnelUniforms,
            vertexShader: `
                uniform float uTime; varying vec2 vUv;
                void main() {
                    vUv = uv;
                    vec3 p = position;
                    float bend = sin(uv.y * 5.0 + uTime * 0.5) * 120.0 * (1.0 - uv.y);
                    p.x += bend;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
                }`,
            fragmentShader: `
                uniform float uTime; uniform sampler2D uClouds; uniform float uFlash; varying vec2 vUv;
                void main() {
                    vec2 a = vec2(vUv.x * 4.0 + vUv.y * 2.4 - uTime * 0.55, vUv.y * 1.8 - uTime * 0.08);
                    float streak = texture2D(uClouds, a).r * 0.7 + texture2D(uClouds, a * 2.7).r * 0.45;
                    vec3 color = mix(vec3(0.05, 0.055, 0.06), vec3(0.42, 0.42, 0.4), streak);
                    gl_FragColor = vec4(color + uFlash * 0.7, 1.0);
                    #include <colorspace_fragment>
                }`
        }));
        this.funnel.position.set(-5200, 0, -5200);
        this.outside.add(this.funnel);

        this.debris = [];
        const debrisMaterial = new THREE.MeshBasicMaterial({color: 0x2a2622, side: THREE.DoubleSide});
        const debrisGeometry = new THREE.PlaneGeometry(1, 1);
        for (let i = 0; i < 44; i++) {
            const mesh = new THREE.Mesh(debrisGeometry, debrisMaterial);
            mesh.visible = false;
            mesh.scale.setScalar(3 + Math.random() * 16);
            this.sky.add(mesh);
            this.debris.push({mesh, angle: Math.random() * 6.3, r: 30 + Math.random() * 230, y: -150 + Math.random() * 300, spin: Math.random() * 6});
        }

        // The wing outside the window. It is in the plane's frame, like the camera.
        this.wing = new THREE.Group();
        const inner = new Shape();
        const metal = color('#b8bcbe');
        const wingStrip = (s, x0, x1, chord0, chord1, y0, y1, z0, z1) => {
            s.box(0, 0, 0, 0, 0, 0);
            const i = s.position.length / 3;
            s.vertex(x0, y0, z0 - chord0 / 2, 0, 1, 0, 0, 0, REGION.plain, metal);
            s.vertex(x0, y0, z0 + chord0 / 2, 0, 1, 0, 1, 0, REGION.plain, metal);
            s.vertex(x1, y1, z1 + chord1 / 2, 0, 1, 0, 1, 1, REGION.plain, metal);
            s.vertex(x1, y1, z1 - chord1 / 2, 0, 1, 0, 0, 1, REGION.plain, metal);
            s.index.push(i, i + 1, i + 2, i, i + 2, i + 3);
        };
        wingStrip(inner, -1.9, -9, 5, 3.2, 0.05, 0.45, 0.4, 2.4);
        inner.tube([v3(-6, -0.2, 0.2), v3(-6, -0.45, 3.6)], [0.85, 0.7], 14, REGION.plain, color('#d0d3d4'));
        const outer = new Shape();
        wingStrip(outer, 0, -11, 3.2, 1.2, 0, 1.1, 0, 2.6);
        outer.card(v3(-11, 1.1, 2.1), v3(-11, 1.1, 3.1), v3(-11.3, 2.2, 3.6), v3(-11.3, 2.2, 3), REGION.plain, color('#1e5a8a'));
        this.artMaterial = keepNormals(new THREE.MeshLambertMaterial({map: G.art.sheet, vertexColors: true, side: THREE.DoubleSide}));
        const innerMesh = new THREE.Mesh(inner.geometry(), this.artMaterial);
        this.outerWing = new THREE.Mesh(outer.geometry(), this.artMaterial);
        this.outerWing.position.set(-9, 0.45, 2.4);
        this.wing.add(innerMesh, this.outerWing);
        this.sky.add(this.wing);
        const sunlight = new THREE.DirectionalLight(0xffffff, 2.4);
        sunlight.position.set(-1, 2, 0.5);
        this.skyAmbient = new THREE.AmbientLight(0xffffff, 1.2);
        this.skySun = sunlight;
        this.sky.add(sunlight, this.skyAmbient);

        const flame = softDot('rgba(255,235,170,1)', 'rgba(255,110,20,0.8)');
        const smoke = softDot('rgba(40,36,34,0.95)', 'rgba(30,28,26,0.6)');
        this.fire = [];
        for (let i = 0; i < 22; i++) {
            const sprite = new THREE.Sprite(new THREE.SpriteMaterial(i % 2
                ? {map: flame, blending: THREE.AdditiveBlending, depthWrite: false}
                : {map: smoke, depthWrite: false}));
            sprite.visible = false;
            this.sky.add(sprite);
            this.fire.push({sprite, age: Math.random(), hot: Boolean(i % 2)});
        }

        // Inside
        this.cabin = new THREE.Scene();
        const shell = keepNormals(new THREE.MeshLambertMaterial({map: cabinTexture(), alphaTest: 0.5, side: THREE.DoubleSide}));
        this.shell = shell;
        const SPLIT = 3.4;
        const CEIL_0 = -3.4;
        const CEIL_1 = -0.6;
        const top0 = Math.PI * 0.32;
        const top1 = Math.PI * 0.68;
        this.cabin.add(shellPart(shell, -LENGTH / 2, CEIL_0, 0, Math.PI * 2));
        this.cabin.add(shellPart(shell, CEIL_0, CEIL_1, top1, top0 + Math.PI * 2));
        this.cabin.add(shellPart(shell, CEIL_1, SPLIT, 0, Math.PI * 2));
        this.roofPiece = shellPart(shell, CEIL_0, CEIL_1, top0, top1);
        this.cabin.add(this.roofPiece);
        this.rear = new THREE.Group();
        this.rear.add(shellPart(shell, SPLIT, LENGTH / 2, 0, Math.PI * 2));
        this.cabin.add(this.rear);

        const s = new Shape();
        const rearShape = new Shape();
        const seatColor = color('#4a72b4');
        const head = color('#d8ad8c');
        const hair = [color('#2b2118'), color('#5a4028'), color('#8b8f92'), color('#c7a15a')];
        let n = 0;
        for (let z = -6.6; z < 7.6; z += 1.05) {
            const target = z > SPLIT ? rearShape : s;
            for (const x of [-1.32, -0.76, 0.76, 1.32]) {
                target.at(x, 0, z);
                target.box(0, 0.34, 0, 0.5, 0.14, 0.5, REGION.plain, seatColor);
                target.box(0, 0.85, 0.25, 0.5, 0.9, 0.12, REGION.plain, seatColor);
                n++;
                const own = x === -1.32 && Math.abs(z - 0.75) < 0.6;
                if (n % 3 !== 0 && !own && z < 0) {
                    target.blob(0, 1.2, 0.12, 0.11, 0.13, 0.12, n % 2 ? hair[n % 4] : head, REGION.plain, 7, 5);
                }
            }
        }
        s.at();
        rearShape.at();
        for (const side of [-1, 1]) {
            s.box(side * 1.3, 2.05, -2.3, 0.7, 0.42, 11.4, REGION.plain, color('#e6e2d8'));
            rearShape.box(side * 1.3, 2.05, 5.7, 0.7, 0.42, 4.6, REGION.plain, color('#e6e2d8'));
        }
        s.box(0, -0.25, -2.3, 4, 0.1, 11.4, REGION.plain, color('#4a4f5a'));
        rearShape.box(0, -0.25, 5.7, 4, 0.1, 4.6, REGION.plain, color('#4a4f5a'));
        s.box(0, 1.5, -7.4, 3.4, 3.4, 0.2, REGION.plain, color('#cfcbbf'));
        this.cabinMaterial = new THREE.MeshLambertMaterial({map: G.art.sheet, vertexColors: true});
        this.cabin.add(new THREE.Mesh(s.geometry(), this.cabinMaterial));
        this.rear.add(new THREE.Mesh(rearShape.geometry(), this.cabinMaterial));

        // The screen in the seat ahead
        this.displayCanvas = document.createElement('canvas');
        this.displayCanvas.width = 512;
        this.displayCanvas.height = 300;
        this.displayTexture = new THREE.CanvasTexture(this.displayCanvas);
        this.displayTexture.colorSpace = THREE.SRGBColorSpace;
        const display = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.235), new THREE.MeshBasicMaterial({map: this.displayTexture, toneMapped: false}));
        display.position.set(-1.32, 0.95, 0.025);
        this.cabin.add(display);
        const bezel = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.27), new THREE.MeshBasicMaterial({color: 0x101010}));
        bezel.position.set(-1.32, 0.95, 0.018);
        this.cabin.add(bezel);

        this.masks = new THREE.Group();
        this.masks.visible = false;
        const maskShape = new Shape();
        maskShape.tube([v3(0, 0, 0), v3(0, -0.55, 0)], [0.006, 0.006], 3, REGION.plain, color('#e8e4d8'));
        maskShape.blob(0, -0.6, 0, 0.07, 0.05, 0.07, color('#f0d040'), REGION.plain, 7, 4);
        const maskGeometry = maskShape.geometry();
        this.maskList = [];
        for (let z = -6.1; z < 3; z += 1.05) {
            for (const x of [-1.05, 1.05]) {
                const mask = new THREE.Mesh(maskGeometry, this.cabinMaterial);
                mask.position.set(x, 1.84, z);
                this.masks.add(mask);
                this.maskList.push(mask);
            }
        }
        this.cabin.add(this.masks);

        this.ambient = new THREE.AmbientLight(0xfff1dc, 0.95);
        this.lamp = new THREE.PointLight(0xfff0d8, 22, 18, 1.5);
        this.lamp.position.set(0, 2.2, -1);
        this.windowLight = new THREE.DirectionalLight(0xdfeeff, 1.1);
        this.windowLight.position.set(-2, 1, 0);
        this.cabin.add(this.ambient, this.lamp, this.windowLight);

        this.hold = G.audio.hold('cabin');
        this.redraw(true);
        G.hud.setHudVisible(false);
        el('skip').hidden = false;
        el('skip').onclick = () => this.end();
        G.renderer.setClearColor(0x000000);
    }

    placeCloud(cloud, anywhere) {
        const below = Math.random() < 0.6;
        const x = (Math.random() - 0.5) * 9000;
        cloud.position.set(x, below ? -700 - Math.random() * 900 : 500 + Math.random() * 1500, anywhere ? (Math.random() - 0.5) * 12000 : -6000);
        cloud.scale.setScalar(300 + Math.random() * 900);
    }

    breakWing() {
        this.G.audio.play('boom');
        this.bump = 2;
        this.wingLoose = {velocity: v3(-9, 7, 24), spin: v3(2.1, 1.3, 2.9)};
        this.burning = true;
    }

    breakCabin() {
        this.G.audio.play('boom');
        this.bump = 2.5;
        this.roofLoose = {velocity: v3(0.6, 14, 18), spin: v3(3, 1, 2)};
        this.rearLoose = {velocity: v3(1.5, -1.2, 11), spin: v3(0.5, 0.25, 0.9)};
        this.shakeWind = true;
    }

    pose() {
        const {poses, t} = this;
        let i = 0;
        while (i < poses.length - 2 && poses[i + 1][0] <= t) {
            i++;
        }
        const a = poses[i];
        const b = poses[i + 1];
        const k = ease(Math.max(0, Math.min(1, (t - a[0]) / (b[0] - a[0]))));
        return a.map((value, n) => value + (b[n] - value) * k).slice(1);
    }

    update(dt) {
        const {t, G} = this;
        this.t += dt;
        shared.uTime.value += dt;
        for (const cue of this.cues) {
            if (!cue.done && this.t >= cue[0]) {
                cue.done = true;
                cue[1]();
            }
        }
        if (this.black) {
            this.blackFor = (this.blackFor || 0) + dt;
            el('fade').style.transition = 'none';
            el('fade').style.opacity = 1;
            if (this.blackFor > 3.2) {
                this.end();
            }
            return;
        }

        const storm = ease(Math.max(0, Math.min(1, (t - 5) / 12)));
        this.storm = storm;
        this.hold.set(storm + (this.shakeWind ? 0.5 : 0));
        const uStorm = this.skyUniforms.uStorm;
        uStorm.value = storm;
        const inside = ease(Math.max(0, Math.min(1, (t - 12) / 7)));
        this.funnel.position.set(-5200 * (1 - inside) * (1 - inside), 0, -5200 * (1 - inside));
        this.funnelUniforms.uTime.value = t;
        const shade = 1 - storm * 0.78;
        this.cloudMaterial.color.setRGB(shade, shade, shade);
        this.skyAmbient.intensity = 1.25 - storm * 0.8;
        this.skySun.intensity = 2.6 - storm * 2.2;
        this.sun.material.opacity = 1 - storm;

        // Lightning, and the funnel's own light
        let flash = 0;
        if (t > 13 && Math.sin(t * 9.3) * Math.sin(t * 3.1) > 0.82) {
            flash = 0.5;
        }
        this.skyUniforms.uFlash.value = flash;
        this.funnelUniforms.uFlash.value = flash;

        // The plane's attitude moves the world outside
        const thrown = ease(Math.max(0, Math.min(1, (t - 17) / 6)));
        const dive = ease(Math.max(0, Math.min(1, (t - 30) / 4)));
        const roll = Math.sin(t * 0.85) * (0.02 + storm * 0.06 + thrown * 0.65) + (t > 27 ? (t - 27) * 0.09 : 0);
        const pitch = Math.sin(t * 1.3) * thrown * 0.22 + dive * 0.72;
        const spin = thrown * thrown * (t - 17) * 0.62;
        this.outside.rotation.set(pitch, spin, roll, 'YXZ');

        // Falling: the ocean comes up
        const fall = ease(Math.max(0, Math.min(1, (t - 26) / 8.6)));
        this.altitude = 11200 - fall * 11180 - Math.max(0, t - 18) * 120;
        this.ocean.position.y = -3000 + fall * 2960;
        this.redraw(false);

        for (const cloud of this.clouds) {
            cloud.position.z += dt * (620 + storm * 320);
            if (cloud.position.z > 6000) {
                this.placeCloud(cloud, false);
            }
        }
        const twist = inside > 0.97;
        this.debris.forEach(d => {
            d.mesh.visible = twist;
            if (twist) {
                d.angle += dt * (2 + 90 / d.r);
                d.mesh.position.set(Math.cos(d.angle) * d.r, d.y + Math.sin(t + d.angle) * 30, Math.sin(d.angle) * d.r);
                d.mesh.rotation.set(t * d.spin, t * d.spin * 0.7, 0);
            }
        });

        if (this.wingLoose) {
            const {velocity, spin: turn} = this.wingLoose;
            velocity.y -= dt * 8;
            this.outerWing.position.addScaledVector(velocity, dt);
            this.outerWing.rotation.x += turn.x * dt;
            this.outerWing.rotation.y += turn.y * dt;
            this.outerWing.rotation.z += turn.z * dt;
        }
        if (this.burning) {
            for (const f of this.fire) {
                f.age += dt * (f.hot ? 2.2 : 1.1);
                if (f.age > 1) {
                    f.age -= 1;
                }
                const sprite = f.sprite;
                sprite.visible = true;
                sprite.position.set(-8.8 - f.age * 0.5 + Math.sin(f.age * 40) * 0.2, 0.5 + f.age * (f.hot ? 0.7 : 1.4), 2.6 + f.age * (f.hot ? 7 : 28));
                sprite.scale.setScalar((f.hot ? 1.2 : 1.8) + f.age * (f.hot ? 2 : 8));
                sprite.material.opacity = 1 - f.age;
            }
        }
        if (this.roofLoose) {
            const {velocity, spin: turn} = this.roofLoose;
            this.roofPiece.position.addScaledVector(velocity, dt);
            this.roofPiece.rotation.x += turn.x * dt;
            this.roofPiece.rotation.z += turn.z * dt;
        }
        if (this.rearLoose) {
            const {velocity, spin: turn} = this.rearLoose;
            velocity.y -= dt * 3;
            this.rear.position.addScaledVector(velocity, dt);
            this.rear.rotation.x += turn.x * dt * 0.5;
            this.rear.rotation.y += turn.y * dt;
            this.rear.rotation.z += turn.z * dt;
        }

        // Light in the cabin
        if (this.lightsOut) {
            const flicker = Math.sin(t * 31) * Math.sin(t * 13) > 0.1 ? 1 : 0.2;
            this.lamp.color.setHex(0xff5a44);
            this.lamp.intensity = 7 * flicker;
            this.ambient.color.setHex(0xa88880);
            this.ambient.intensity = 0.8;
            this.windowLight.intensity = 0.2 + flash * 4;
        } else {
            this.ambient.intensity = 0.95 - storm * 0.3;
            this.lamp.intensity = 22 - storm * 7;
            this.windowLight.intensity = 1.1 - storm * 0.7 + flash * 4;
        }
        if (this.masks.visible) {
            this.maskList.forEach((mask, i) => {
                mask.rotation.x = Math.sin(t * 7 + i) * 0.5;
                mask.rotation.z = Math.sin(t * 5.4 + i * 2) * 0.4;
            });
        }

        // The camera, with everything shaking
        const [yaw, lookUp, fov, headX, headY, headZ] = this.pose();
        this.bump = Math.max(0, (this.bump || 0) - dt * 2.2);
        const shakeLevel = 0.0009 + storm * 0.008 + thrown * 0.018 + (this.rearLoose ? 0.016 : 0) + (this.bump || 0) * 0.018;
        const camera = this.camera;
        camera.rotation.set(
            lookUp + (Math.sin(t * 37) + Math.sin(t * 23.3)) * shakeLevel,
            yaw + (Math.sin(t * 31) + Math.sin(t * 19.7)) * shakeLevel,
            roll * 0.25 + Math.sin(t * 27) * shakeLevel);
        camera.position.set(
            headX + Math.sin(t * 29) * shakeLevel * 0.8,
            headY + Math.sin(t * 41) * shakeLevel * 0.8,
            headZ + Math.sin(t * 17) * shakeLevel * 0.5);
        camera.fov = fov;
        camera.aspect = G.aspect;
        camera.updateProjectionMatrix();

        const renderer = G.renderer;
        renderer.autoClear = false;
        renderer.clear();
        renderer.render(this.sky, camera);
        renderer.clearDepth();
        renderer.render(this.cabin, camera);
        renderer.autoClear = true;
    }

    end() {
        if (this.ended) {
            return;
        }
        this.ended = true;
        this.say('');
        el('skip').hidden = true;
        el('skip').onclick = null;
        if (!this.black) {
            this.hold.stop();
        }
        el('fade').style.transition = 'none';
        el('fade').style.opacity = 1;
        this.sky.traverse(disposeMesh);
        this.cabin.traverse(disposeMesh);
        this.done();
    }

    render() {}
}

function disposeMesh(object) {
    if (object.geometry) {
        object.geometry.dispose();
    }
}

// Waking up: everything is blurred and ringing, and slowly gets clear
export class WakeScene {
    constructor(G, done) {
        this.G = G;
        this.done = done;
        this.t = 0;
        this.duration = 13;
        this.canvas = el('view');
        this.ringing = G.audio.hold('tinnitus');
        this.ringing.set(1);
        this.silent = true;
        el('fade').style.transition = 'none';
        el('fade').style.opacity = 1;
        requestAnimationFrame(() => {
            el('fade').style.transition = 'opacity 1.6s';
            el('fade').style.opacity = 0;
        });
        el('skip').hidden = false;
        el('skip').onclick = () => {
            this.t = this.duration;
        };
    }

    update(dt) {
        const {G} = this;
        this.t += dt;
        const {t, duration} = this;
        G.tickView(dt);
        const clear = Math.min(1, t / 10);
        const blur = (1 - ease(clear)) * 15;
        this.canvas.style.filter = blur > 0.2 ? `blur(${blur.toFixed(1)}px)` : '';
        this.ringing.set(Math.max(0, 1 - t / 8.5));
        G.audio.quiet = t < 4;

        // Slow blinks that get shorter
        const blink = t < 2 ? 1 - t / 2 * 0.5 : Math.max(0, Math.sin(t * 1.3) ** 8 * (1 - t / 9)) + (t < 3 ? (3 - t) * 0.5 : 0);
        const lid = Math.max(0, Math.min(1, blink)) * 50;
        el('lid-top').style.height = lid + '%';
        el('lid-bottom').style.height = lid + '%';

        // Lying on the sand, slowly sitting up
        const up = ease(Math.max(0, Math.min(1, (t - 8.2) / 3.8)));
        const player = G.player;
        const camera = G.camera;
        const p = player.position;
        camera.position.set(p.x, p.y + 0.24 + up * 1.38, p.z);
        camera.rotation.order = 'YXZ';
        camera.rotation.set(0.5 * (1 - up) + Math.sin(t * 0.5) * 0.015, player.yaw + Math.sin(t * 0.37) * 0.04 * (1 - up), 1.15 * (1 - up));
        player.lookDir.set(0, 0, -1).applyEuler(camera.rotation);
        if (t >= duration) {
            this.end();
        }
        G.renderWorld();
    }

    end() {
        if (this.ended) {
            return;
        }
        this.ended = true;
        this.canvas.style.filter = '';
        el('lid-top').style.height = 0;
        el('lid-bottom').style.height = 0;
        el('skip').hidden = true;
        el('skip').onclick = null;
        el('fade').style.transition = 'opacity 0.7s';
        this.ringing.stop();
        this.G.audio.quiet = false;
        this.done();
    }
}

function helicopterShape() {
    const s = new Shape();
    const orange = color('#d9471c');
    const white = color('#eee9df');
    const glass = color('#27373f');
    s.blob(0, 0, 0, 1.25, 1.25, 2.6, orange, REGION.plain, 12, 8);
    s.blob(0, 0.2, -1.75, 1.05, 0.9, 1, glass, REGION.plain, 10, 6);
    s.box(0, -0.1, 0.2, 2.55, 0.5, 2.3, REGION.plain, white);
    s.tube([v3(0, 0.3, 2.2), v3(0, 0.8, 8.2)], [0.45, 0.16], 8, REGION.plain, orange);
    s.card(v3(0, 0.8, 7.4), v3(0, 0.8, 8.5), v3(0, 2.6, 9), v3(0, 2.6, 8.2), REGION.plain, white);
    s.box(0, 1.5, 0, 0.6, 0.5, 1.3, REGION.plain, color('#3a3a3a'));
    for (const x of [-1.3, 1.3]) {
        s.tube([v3(x, -1.85, -2), v3(x, -1.85, 2.2)], [0.07, 0.07], 5, REGION.plain, color('#2a2a2a'));
        for (const z of [-1, 1]) {
            s.tube([v3(x * 0.7, -0.9, z), v3(x, -1.85, z)], [0.05, 0.05], 4, REGION.plain, color('#2a2a2a'));
        }
    }
    return s;
}

export class Helicopter {
    constructor(G) {
        this.G = G;
        this.group = new THREE.Group();
        const material = keepNormals(new THREE.MeshLambertMaterial({vertexColors: true, map: G.art.sheet, side: THREE.DoubleSide}));
        const body = new THREE.Mesh(helicopterShape().geometry(), material);
        body.castShadow = true;
        this.group.add(body);
        const blades = new Shape();
        for (let i = 0; i < 4; i++) {
            const a = i * Math.PI / 2;
            const dx = Math.cos(a);
            const dz = Math.sin(a);
            blades.card(v3(-dz * 0.16, 0, dx * 0.16), v3(dz * 0.16, 0, -dx * 0.16),
                v3(dx * 6.4 + dz * 0.16, 0, dz * 6.4 - dx * 0.16), v3(dx * 6.4 - dz * 0.16, 0, dz * 6.4 + dx * 0.16), REGION.plain, color('#1a1a1a'), v3(0, 1, 0));
        }
        this.rotor = new THREE.Mesh(blades.geometry(), material);
        this.rotor.position.y = 1.95;
        this.group.add(this.rotor);
        const tail = new Shape();
        for (let i = 0; i < 2; i++) {
            const a = i * Math.PI / 2;
            tail.card(v3(0.28, Math.sin(a) * 1.2 - 0.1 * Math.cos(a), Math.cos(a) * 1.2 + 0.1 * Math.sin(a)), v3(0.28, Math.sin(a) * 1.2 + 0.1 * Math.cos(a), Math.cos(a) * 1.2 - 0.1 * Math.sin(a)),
                v3(0.28, -Math.sin(a) * 1.2 + 0.1 * Math.cos(a), -Math.cos(a) * 1.2 - 0.1 * Math.sin(a)), v3(0.28, -Math.sin(a) * 1.2 - 0.1 * Math.cos(a), -Math.cos(a) * 1.2 + 0.1 * Math.sin(a)), REGION.plain, color('#1a1a1a'), v3(1, 0, 0));
        }
        this.tailRotor = new THREE.Mesh(tail.geometry(), material);
        this.tailRotor.position.set(0, 1.5, 8.4);
        this.group.add(this.tailRotor);
        G.scene.add(this.group);
        this.sound = G.audio.hold('heli');
        this.position = this.group.position;
        this.heading = 0;
    }

    // Flies towards a point; true when there
    flyTo(target, speed, dt) {
        const to = new THREE.Vector3().subVectors(target, this.position);
        const distance = to.length();
        if (distance < 1) {
            return true;
        }
        const step = Math.min(distance, speed * dt);
        this.position.addScaledVector(to, step / distance);
        const flat = Math.hypot(to.x, to.z);
        if (flat > 1) {
            const wanted = Math.atan2(-to.x, -to.z);
            let diff = wanted - this.heading;
            diff = Math.atan2(Math.sin(diff), Math.cos(diff));
            this.heading += diff * Math.min(1, dt * 1.6);
        }
        this.group.rotation.set(-Math.min(0.22, speed * 0.008), this.heading, 0, 'YXZ');
        return false;
    }

    update(dt) {
        const {G} = this;
        this.rotor.rotation.y += dt * 26;
        this.tailRotor.rotation.x += dt * 38;
        const distance = this.position.distanceTo(G.camera.position);
        this.sound.set(Math.max(0, 1 - distance / 480));
    }

    remove() {
        this.sound.stop();
        this.G.scene.remove(this.group);
    }
}
