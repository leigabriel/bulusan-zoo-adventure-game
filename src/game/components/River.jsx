import * as THREE from 'three';

// The river stays east of the statue and habitats, then bends toward the south
// edge. Keeping the path data here makes terrain, art, and gameplay agree.
const RIVER_POINTS = [
    [-218, 112], [-178, 101], [-135, 108], [-92, 94], [-48, 101],
    [-4, 87], [42, 98], [88, 82], [132, 91], [176, 73], [218, 82]
].map(([x, z]) => new THREE.Vector2(x, z));
const RIVER_WIDTH = 7.2;
const BANK_BLEND = 3.8;
const SHORE_WIDTH = 1.6;
const CHANNEL_DEPTH = 2.2;
const WATER_CLEARANCE = 0.04;

const QUALITY_CONFIG = {
    low: { samples: 45, bankSegments: 2, ripples: false },
    medium: { samples: 90, bankSegments: 3, ripples: true },
    high: { samples: 160, bankSegments: 4, ripples: true }
};

let pathSamples = null;

function buildPathSamples() {
    if (pathSamples) return pathSamples;
    pathSamples = [];
    let distance = 0;
    const steps = 240;
    let previousPoint = sampleSmoothPath(0);
    pathSamples.push({ point: previousPoint, distance });
    for (let step = 1; step <= steps; step += 1) {
        const point = sampleSmoothPath(step / steps);
        distance += point.distanceTo(previousPoint);
        pathSamples.push({ point, distance });
        previousPoint = point;
    }
    return pathSamples;
}

function closestPathPoint(x, z) {
    const samples = buildPathSamples();
    let best = { distanceSq: Infinity, distance: 0, point: samples[0].point, tangent: new THREE.Vector2(1, 0) };
    for (let i = 0; i < samples.length - 1; i += 1) {
        const a = samples[i].point;
        const b = samples[i + 1].point;
        const line = b.clone().sub(a);
        const lengthSq = Math.max(line.lengthSq(), 0.0001);
        const t = THREE.MathUtils.clamp(new THREE.Vector2(x - a.x, z - a.y).dot(line) / lengthSq, 0, 1);
        const point = a.clone().addScaledVector(line, t);
        const distanceSq = point.distanceToSquared(new THREE.Vector2(x, z));
        if (distanceSq < best.distanceSq) {
            best = { distanceSq, distance: samples[i].distance + Math.sqrt(lengthSq) * t, point, tangent: line.normalize() };
        }
    }
    return best;
}

export function getRiverMetrics(x, z) {
    const nearest = closestPathPoint(x, z);
    const lateral = Math.sqrt(nearest.distanceSq);
    return { ...nearest, lateral, width: RIVER_WIDTH + Math.sin(nearest.distance * 0.035) * 0.7 };
}

export function getRiverTerrainOffset(x, z) {
    const metrics = getRiverMetrics(x, z);
    const edge = metrics.width + BANK_BLEND;
    if (metrics.lateral >= edge) return 0;

    const centerBlend = 1 - THREE.MathUtils.smoothstep(metrics.lateral, metrics.width, edge);

    // Add natural variation to the riverbed depth
    const bedNoise = (Math.sin(x * 0.4) * Math.cos(z * 0.4) * 0.2) +
                     (Math.sin(x * 0.1) * 0.15);

    return (-CHANNEL_DEPTH + bedNoise) * centerBlend;
}

export function isRiverArea(x, z, padding = 0) {
    const metrics = getRiverMetrics(x, z);
    return metrics.lateral < metrics.width + padding;
}

export function isLandAccessible(x, z, radius = 0) {
    return !isRiverArea(x, z, radius);
}

export function findAccessiblePosition(x, z, radius = 0) {
    if (isLandAccessible(x, z, radius)) return { x, z };
    const metrics = getRiverMetrics(x, z);
    const push = metrics.width + radius + 1.5;
    return { x: metrics.point.x + metrics.tangent.y * push, z: metrics.point.y - metrics.tangent.x * push };
}

function makeRibbonGeometry(samples, width, heightFn, segments = 1) {
    const positions = [];
    const uvs = [];
    const indices = [];
    for (let i = 0; i <= samples; i += 1) {
        const t = i / samples;
        const point = sampleSmoothPath(t);
        const next = t < 1 ? sampleSmoothPath(t + 0.002) : sampleSmoothPath(t - 0.002);
        const tangent = next.clone().sub(point).normalize();
        const side = new THREE.Vector2(-tangent.y, tangent.x);
        const rowWidth = typeof width === 'function' ? width(t, point) : width;
        for (let row = 0; row <= segments; row += 1) {
            const across = row / segments * 2 - 1;
            const p = point.clone().addScaledVector(side, across * rowWidth);
            positions.push(p.x, heightFn(p.x, p.y, across, t), p.y);
            uvs.push(t * 8, row / segments);
        }
    }
    const rowSize = segments + 1;
    for (let i = 0; i < samples; i += 1) {
        for (let row = 0; row < segments; row += 1) {
            const a = i * rowSize + row;
            const b = a + 1;
            const c = a + rowSize;
            const d = c + 1;
            indices.push(a, c, b, b, c, d);
        }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
}

function sampleSmoothPath(t) {
    const scaled = THREE.MathUtils.clamp(t, 0, 1) * (RIVER_POINTS.length - 1);
    const index = Math.min(RIVER_POINTS.length - 2, Math.floor(scaled));
    const local = scaled - index;
    const p0 = RIVER_POINTS[Math.max(0, index - 1)];
    const p1 = RIVER_POINTS[index];
    const p2 = RIVER_POINTS[index + 1];
    const p3 = RIVER_POINTS[Math.min(RIVER_POINTS.length - 1, index + 2)];
    const t2 = local * local;
    const t3 = t2 * local;
    return new THREE.Vector2(
        0.5 * ((2 * p1.x) + (-p0.x + p2.x) * local + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        0.5 * ((2 * p1.y) + (-p0.y + p2.y) * local + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3)
    );
}

function createWaterMaterial(quality) {
    if (quality === 'low') return new THREE.MeshBasicMaterial({ color: 0x20b9d0, side: THREE.DoubleSide });
    return new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            uStrength: { value: quality === 'high' ? 1 : 0.65 },
            uColorBlue: { value: new THREE.Color(0x0a6b9e) },
            uColorTurquoise: { value: new THREE.Color(0x20b9d0) }
        },
        vertexShader: `
            uniform float uTime;
            uniform float uStrength;
            varying vec2 vUv;
            varying float vDepth;
            void main(){
                vUv = uv;
                vec3 p = position;
                float wave = sin(uv.x * 18.0 + uTime * 1.8) * 0.04 * uStrength;
                p.y += wave;
                vDepth = wave;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
            }`,
        fragmentShader: `
            uniform float uTime;
            uniform vec3 uColorBlue;
            uniform vec3 uColorTurquoise;
            varying vec2 vUv;
            varying float vDepth;
            void main(){
                float ripple = sin(vUv.x * 35.0 + uTime * 2.5) + sin(vUv.x * 18.0 - vUv.y * 12.0 + uTime * 1.5);
                float edgeMask = smoothstep(0.0, 0.15, vUv.y) * smoothstep(1.0, 0.85, vUv.y);

                vec3 color = mix(uColorBlue, uColorTurquoise, 0.5 + 0.2 * sin(vUv.x * 10.0 + uTime));
                color += ripple * 0.02 * edgeMask;

                // Foam highlights at edges
                float foam = (1.0 - edgeMask) * 0.12 * (0.5 + 0.5 * sin(uTime * 3.0 + vUv.x * 50.0));
                color += foam;

                 gl_FragColor = vec4(color, 1.0);
             }`,
        transparent: false,
        side: THREE.DoubleSide,
        depthWrite: true
    });
}

function getWaterHeight(baseTerrainHeight, x, z) {
    // The player stands on the riverbed returned by getTerrainHeight. Keep the
    // water just above that same surface so it cannot float above or submerge
    // the character while crossing the river.
    return baseTerrainHeight(x, z) + WATER_CLEARANCE;
}

export function createRiver(scene, baseTerrainHeight, quality = 'medium') {
    const config = QUALITY_CONFIG[quality] || QUALITY_CONFIG.medium;
    const riverWidthAt = (t) => RIVER_WIDTH + Math.sin(t * buildPathSamples()[buildPathSamples().length - 1].distance * 0.035) * 0.7;
    const root = new THREE.Group();
    root.name = 'CartoonRiver';
    const waterHeight = (x, z) => getWaterHeight(baseTerrainHeight, x, z);
    const water = new THREE.Mesh(makeRibbonGeometry(config.samples, riverWidthAt, waterHeight, quality === 'high' ? 3 : 2), createWaterMaterial(quality));
    water.renderOrder = 2;
    root.add(water);

    const bankMaterial = new THREE.MeshStandardMaterial({ color: 0xba945d, roughness: 0.9, side: THREE.DoubleSide });

    const bankHeightFn = (x, z) => baseTerrainHeight(x, z) + 0.015;

    const banks = new THREE.Mesh(
        makeRibbonGeometry(config.samples, (t) => riverWidthAt(t) + SHORE_WIDTH, bankHeightFn, config.bankSegments + 1),
        bankMaterial
    );
    banks.renderOrder = 1;
    root.add(banks);

    scene.add(root);
    return { root, water, banks, quality, time: 0, baseTerrainHeight };
}

export function updateRiver(river, dt, active = true) {
    if (!river || !active || document.hidden) return;
    river.time += Math.min(dt, 0.1);
    if (river.water.material.uniforms?.uTime) river.water.material.uniforms.uTime.value = river.time;
}

export function updateRiverQuality(river, quality) {
    if (!river) return;
    const next = QUALITY_CONFIG[quality] || QUALITY_CONFIG.medium;
    const old = river.water.material;
    const oldWaterGeometry = river.water.geometry;
    const oldBankGeometry = river.banks.geometry;
    const riverWidthAt = (t) => RIVER_WIDTH + Math.sin(t * buildPathSamples()[buildPathSamples().length - 1].distance * 0.035) * 0.7;
    const bankHeightFn = (x, z) => river.baseTerrainHeight(x, z) + 0.015;

    river.water.geometry = makeRibbonGeometry(next.samples, riverWidthAt, (x, z) => getWaterHeight(river.baseTerrainHeight, x, z), quality === 'high' ? 3 : 2);
    river.banks.geometry = makeRibbonGeometry(next.samples, (t) => riverWidthAt(t) + SHORE_WIDTH, bankHeightFn, next.bankSegments + 1);
    oldWaterGeometry.dispose();
    oldBankGeometry.dispose();
    if (quality === 'low' && old.isShaderMaterial) {
        river.water.material = createWaterMaterial('low');
        old.dispose();
    } else if (quality !== 'low' && !old.isShaderMaterial) {
        river.water.material = createWaterMaterial(quality);
        old.dispose();
    } else if (old.uniforms?.uStrength) old.uniforms.uStrength.value = quality === 'high' ? 1 : 0.65;
    river.quality = quality;
}

export function disposeRiver(river) {
    if (!river) return;
    river.root?.traverse((child) => {
        child.geometry?.dispose?.();
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((material) => material?.dispose?.());
    });
    river.root?.parent?.remove(river.root);
}

export const RIVER_CONSTANTS = {
    width: RIVER_WIDTH,
    channelDepth: CHANNEL_DEPTH,
    bankBlend: BANK_BLEND,
    shoreWidth: SHORE_WIDTH,
    waterClearance: WATER_CLEARANCE
};
