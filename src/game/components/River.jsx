import * as THREE from 'three';

// The river stays east of the statue and habitats, then bends toward the south
// edge. Keeping the path data here makes terrain, art, and gameplay agree.
const RIVER_POINTS = [
    [-218, 112], [-178, 101], [-135, 108], [-92, 94], [-48, 101],
    [-4, 87], [42, 98], [88, 82], [132, 91], [176, 73], [218, 82]
].map(([x, z]) => new THREE.Vector2(x, z));
const RIVER_WIDTH = 7.2;
const BANK_BLEND = 3.8;
const CHANNEL_DEPTH = 2.2;
const BRIDGE_S = 5;
const BRIDGE_HALF_LENGTH = 4.2;
const BRIDGE_HALF_WIDTH = RIVER_WIDTH + 2.3;
const BRIDGE_ARCH_HEIGHT = 0.9;

const QUALITY_CONFIG = {
    low: { samples: 30, bankSegments: 1, ripples: false },
    medium: { samples: 60, bankSegments: 2, ripples: true },
    high: { samples: 110, bankSegments: 3, ripples: true }
};

let pathSamples = null;

function buildPathSamples() {
    if (pathSamples) return pathSamples;
    pathSamples = [];
    let distance = 0;
    for (let i = 0; i < RIVER_POINTS.length - 1; i += 1) {
        const a = RIVER_POINTS[i];
        const b = RIVER_POINTS[i + 1];
        const length = a.distanceTo(b);
        const steps = Math.max(4, Math.ceil(length / 5));
        for (let step = 0; step < steps; step += 1) {
            const t = step / steps;
            const point = a.clone().lerp(b, t);
            pathSamples.push({ point, distance: distance + length * t });
        }
        distance += length;
    }
    pathSamples.push({ point: RIVER_POINTS[RIVER_POINTS.length - 1].clone(), distance });
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
    if (metrics.lateral >= edge || isBridgeArea(metrics)) return 0;

    const centerBlend = 1 - THREE.MathUtils.smoothstep(metrics.lateral, metrics.width, edge);

    // Add natural variation to the riverbed depth
    const bedNoise = (Math.sin(x * 0.4) * Math.cos(z * 0.4) * 0.2) +
                     (Math.sin(x * 0.1) * 0.15);

    return (-CHANNEL_DEPTH + bedNoise) * centerBlend;
}

function isBridgeArea(metrics) {
    const bridgeDistance = closestPathPoint(RIVER_POINTS[BRIDGE_S].x, RIVER_POINTS[BRIDGE_S].y).distance;
    return Math.abs(metrics.distance - bridgeDistance) < BRIDGE_HALF_LENGTH
        && metrics.lateral < RIVER_WIDTH + 2.5;
}

export function isRiverArea(x, z, padding = 0) {
    const metrics = getRiverMetrics(x, z);
    return metrics.lateral < metrics.width + padding && !isBridgeArea(metrics);
}

export function isLandAccessible(x, z, radius = 0) {
    return !isRiverArea(x, z, radius);
}

export function getBridgeHeight(x, z, terrainHeight) {
    const metrics = getRiverMetrics(x, z);
    if (!isBridgeArea(metrics)) return terrainHeight;

    const across = THREE.MathUtils.clamp(metrics.lateral / BRIDGE_HALF_WIDTH, 0, 1);
    return terrainHeight + 0.04 + BRIDGE_ARCH_HEIGHT * (1 - across * across);
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
        const next = sampleSmoothPath(Math.min(1, t + 0.002));
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

function makeBridgeDeckGeometry(width, length, thickness, archHeight, lengthSegments = 4) {
    const positions = [];
    const indices = [];
    const acrossSegments = 8;
    const rowSize = acrossSegments + 1;

    for (let zIndex = 0; zIndex <= lengthSegments; zIndex += 1) {
        const z = (zIndex / lengthSegments - 0.5) * length;
        for (let xIndex = 0; xIndex <= acrossSegments; xIndex += 1) {
            const x = (xIndex / acrossSegments - 0.5) * width;
            const across = Math.abs(x) / (width / 2);
            const arch = archHeight * (1 - across * across);
            positions.push(x, thickness / 2 + arch, z);
        }
    }

    for (let zIndex = 0; zIndex < lengthSegments; zIndex += 1) {
        for (let xIndex = 0; xIndex < acrossSegments; xIndex += 1) {
            const a = zIndex * rowSize + xIndex;
            const b = a + 1;
            const c = a + rowSize;
            const d = c + 1;
            indices.push(a, c, b, b, c, d);
        }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
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
    if (quality === 'low') return new THREE.MeshBasicMaterial({ color: 0x20b9d0, transparent: true, opacity: 0.82, side: THREE.DoubleSide });
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

                gl_FragColor = vec4(color, 0.88);
            }`,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false
    });
}

function getWaterHeight(baseTerrainHeight, x, z) {
    // getTerrainHeight already contains the river cut. Remove that cut before
    // placing the surface, otherwise depth testing lets the terrain hide water.
    return baseTerrainHeight(x, z) - getRiverTerrainOffset(x, z) - 0.2;
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

    const bankHeightFn = (x, z, across, t) => {
        const groundLevel = waterHeight(x, z) + 0.2;
        const width = riverWidthAt(t);
        const totalWidth = width + BANK_BLEND;
        const lateral = Math.abs(across) * totalWidth;
        const edge = width + BANK_BLEND;
        const centerBlend = 1 - THREE.MathUtils.smoothstep(lateral, width, edge);
        return groundLevel - CHANNEL_DEPTH * centerBlend;
    };

    const banks = new THREE.Mesh(
        makeRibbonGeometry(config.samples, (t) => riverWidthAt(t) + BANK_BLEND, bankHeightFn, config.bankSegments + 1),
        bankMaterial
    );
    banks.renderOrder = 1;
    root.add(banks);

    const bridge = createBridge(baseTerrainHeight);
    root.add(bridge.object);
    scene.add(root);
    return { root, water, banks, bridge, quality, time: 0, baseTerrainHeight };
}

function createBridge(baseTerrainHeight) {
    const metrics = getRiverMetrics(RIVER_POINTS[BRIDGE_S].x, RIVER_POINTS[BRIDGE_S].y);
    const deckWidth = BRIDGE_HALF_WIDTH * 2;
    const deckLength = BRIDGE_HALF_LENGTH * 2;
    const deckHeight = 0.38;
    const bankHeight = baseTerrainHeight(metrics.point.x, metrics.point.y)
        - getRiverTerrainOffset(metrics.point.x, metrics.point.y);
    // Put the top of the deck just above the bank surface so the player walks
    // onto the bridge instead of floating above it or hitting a step.
    const y = bankHeight + 0.04 - deckHeight / 2;
    const group = new THREE.Group();
    group.name = 'RiverBridge';
    group.position.set(metrics.point.x, y, metrics.point.y);
    group.rotation.y = Math.atan2(metrics.tangent.x, metrics.tangent.y);
    const deck = new THREE.Mesh(
        makeBridgeDeckGeometry(deckWidth, deckLength, deckHeight, BRIDGE_ARCH_HEIGHT),
        new THREE.MeshStandardMaterial({ color: 0x9b5d31, roughness: 0.9, side: THREE.DoubleSide })
    );
    deck.castShadow = true;
    group.add(deck);
    const railMaterial = new THREE.MeshStandardMaterial({ color: 0x6f4327, roughness: 0.95 });
    [-1, 1].forEach((side) => {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.15, deckLength), railMaterial);
        rail.position.set(side * (RIVER_WIDTH + 1.65), 0.68, 0);
        group.add(rail);
    });
    const supports = [-(RIVER_WIDTH + 0.5), RIVER_WIDTH + 0.5].map((x) => {
        const support = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.1, deckLength - 0.8), railMaterial);
        support.position.set(x, -0.52, 0);
        group.add(support);
        return support;
    });
    const obstacles = [
        { x: metrics.point.x + metrics.tangent.y * (RIVER_WIDTH + 1.65), z: metrics.point.y - metrics.tangent.x * (RIVER_WIDTH + 1.65), radius: 0.8 },
        { x: metrics.point.x - metrics.tangent.y * (RIVER_WIDTH + 1.65), z: metrics.point.y + metrics.tangent.x * (RIVER_WIDTH + 1.65), radius: 0.8 }
    ];
    return { object: group, obstacles, supports };
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
    const bankHeightFn = (x, z, across, t) => {
        const groundLevel = getWaterHeight(river.baseTerrainHeight, x, z) + 0.2;
        const width = riverWidthAt(t);
        const totalWidth = width + BANK_BLEND;
        const lateral = Math.abs(across) * totalWidth;
        const edge = width + BANK_BLEND;
        const centerBlend = 1 - THREE.MathUtils.smoothstep(lateral, width, edge);
        return groundLevel - CHANNEL_DEPTH * centerBlend;
    };

    river.water.geometry = makeRibbonGeometry(next.samples, riverWidthAt, (x, z) => getWaterHeight(river.baseTerrainHeight, x, z), quality === 'high' ? 3 : 2);
    river.banks.geometry = makeRibbonGeometry(next.samples, (t) => riverWidthAt(t) + BANK_BLEND, bankHeightFn, next.bankSegments + 1);
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

export const RIVER_CONSTANTS = { width: RIVER_WIDTH, channelDepth: CHANNEL_DEPTH, bankBlend: BANK_BLEND };
