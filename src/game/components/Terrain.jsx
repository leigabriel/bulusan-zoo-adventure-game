import * as THREE from 'three';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { getRiverTerrainOffset, isLandAccessible, getRiverMetrics } from './River.jsx';

const TREE_MODELS = ['Tree1', 'Tree2', 'Tree3', 'Tree4'];
const BUSH_MODELS = ['Bush1', 'Bush2', 'Bush3'];
const GRASS_MODELS = ['Grass1', 'Grass2', 'Grass3'];
const ROCK_MODELS = ['Rock1', 'Rock2', 'Rock3'];
const TERRAIN_SIZE = 500;
const TERRAIN_SEGMENTS = 140;
// The playable area ends before the perimeter forest begins. Keeping this in
// the terrain module lets movement, animals, and scenery use the same map edge.
export const PLAYABLE_BOUNDARY = 194;

const modelCache = new Map();

function disposeCachedObject(root) {
    root?.traverse((child) => {
        if (!child.isMesh) return;
        child.geometry?.dispose();
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((material) => {
            material?.map?.dispose();
            material?.normalMap?.dispose();
            material?.roughnessMap?.dispose();
            material?.metalnessMap?.dispose();
            material?.dispose();
        });
    });
}

export function releaseTerrainModelCache() {
    modelCache.forEach(disposeCachedObject);
    modelCache.clear();
}

export function getTerrainHeight(x, z) {
    // Broad, overlapping waves keep the low-poly terrain smooth while adding
    // enough variation to distinguish hills, valleys, and flatter areas.
    const broadHills = Math.sin(x * 0.009 + Math.cos(z * 0.007)) * 5.2;
    const rollingHills = Math.sin(x * 0.019) * 2.4 + Math.cos(z * 0.017 + 0.8) * 2.2;
    const softDetail = Math.sin(x * 0.032 + z * 0.021) * 0.65;
    const baseHeight = broadHills + rollingHills + softDetail;
    return baseHeight + getRiverTerrainOffset(x, z);
}

export function alignObjectToTerrain(object, terrainY, bounds = new THREE.Box3(), clearance = 0.02) {
    if (!object) return 0;

    object.updateMatrixWorld(true);
    bounds.setFromObject(object);
    const delta = terrainY + clearance - bounds.min.y;
    object.position.y += delta;
    object.updateMatrixWorld(true);
    return delta;
}

export function createTerrain(scene) {
    const terrainGeo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, TERRAIN_SEGMENTS, TERRAIN_SEGMENTS);
    const posAttr = terrainGeo.attributes.position;

    const colors = [];

    // Natural terrain colors
    const baseGreen = new THREE.Color(0x6a994e);
    const darkGreen = new THREE.Color(0x386641);
    const lightGreen = new THREE.Color(0xa7c957);
    const dirtBrown = new THREE.Color(0xa07148);
    const freshGrass = new THREE.Color(0x8cb369);

    for (let i = 0; i < posAttr.count; i++) {
        const x = posAttr.getX(i);
        const y = posAttr.getY(i);
        // PlaneGeometry is rotated to XZ world space, so local +Y maps to world -Z.
        const height = getTerrainHeight(x, -y);
        posAttr.setZ(i, height);

        const noise1 = Math.sin(x * 0.025) * Math.cos(y * 0.025);
        const noise2 = Math.sin(x * 0.06 + y * 0.04) * 0.4;
        const combinedNoise = noise1 + noise2 + (Math.random() * 0.06);

        let color = baseGreen.clone();

        if (height > 5) {
            color.lerp(lightGreen, Math.min(1, (height - 5) * 0.15));
        } else if (height < -2.5) {
            color.lerp(dirtBrown, Math.min(1, (-height - 2.5) * 0.15));
        }

        if (combinedNoise > 0.25) {
            color.lerp(freshGrass, (combinedNoise - 0.25) * 0.8);
        } else if (combinedNoise < -0.2) {
            color.lerp(darkGreen, Math.min(1, (-combinedNoise - 0.2) * 1.0));
        }

        colors.push(color.r, color.g, color.b);
    }

    terrainGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    terrainGeo.computeVertexNormals();

    const ground = new THREE.Mesh(
        terrainGeo,
        new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.9,
            metalness: 0.0,
            flatShading: false
        })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    return ground;
}

async function loadOBJModel(name, basePath, modelType = 'default') {
    const key = basePath + name;
    if (modelCache.has(key)) {
        return modelCache.get(key).clone();
    }

    return new Promise((resolve) => {
        const mtlLoader = new MTLLoader();
        mtlLoader.setPath(basePath);
        mtlLoader.load(`${name}.mtl`, (materials) => {
            materials.preload();

            const objLoader = new OBJLoader();
            objLoader.setMaterials(materials);
            objLoader.setPath(basePath);
            objLoader.load(`${name}.obj`, (object) => {
                object.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = false;
                        child.receiveShadow = false;

                        if (child.material) {
                            const mats = Array.isArray(child.material) ? child.material : [child.material];
                            const fixedMats = mats.map(mat => {
                                const newColor = new THREE.Color();
                                let roughness = 0.8;
                                const matName = mat.name ? mat.name.toLowerCase() : '';

                                // --- GUARANTEED NATURAL HEX COLORS ---
                                if (modelType === 'rock') {
                                    newColor.setHex(0x75726c); // Natural, medium-grey stone (no longer white!)
                                    roughness = 0.95;
                                }
                                else if (modelType === 'grass') {
                                    newColor.setHex(0x559c38); // Lush, vibrant grass green
                                    roughness = 0.9;
                                }
                                else if (modelType === 'tree' || modelType === 'bush') {
                                    // If the material is specifically for the trunk/wood
                                    if (matName.includes('tree') || matName.includes('bark') || matName.includes('trunk')) {
                                        newColor.setHex(0x66452f); // Warm natural wood/bark brown
                                    } else {
                                        newColor.setHex(0x4a8f2f); // Beautiful, natural leaf green (no longer dark!)
                                    }
                                    roughness = 0.85;
                                }

                                // If the object happens to use image textures instead of solid colors, 
                                // set the base color to white so the texture is perfectly visible.
                                if (mat.map) {
                                    newColor.setHex(0xffffff);
                                }

                                const newMat = new THREE.MeshStandardMaterial({
                                    color: newColor,
                                    map: mat.map,
                                    transparent: mat.transparent,
                                    opacity: mat.opacity,
                                    alphaTest: mat.alphaTest || 0.3,
                                    side: THREE.DoubleSide,
                                    roughness: roughness,
                                    metalness: 0.0
                                });

                                 if (newMat.map) {
                                     newMat.map.colorSpace = THREE.SRGBColorSpace;
                                 }

                                 // The replacement material reuses the maps, so
                                 // release only the obsolete material wrapper.
                                 mat.dispose();

                                 return newMat;
                            });
                            child.material = Array.isArray(child.material) ? fixedMats : fixedMats[0];
                        }
                    }
                });

                modelCache.set(key, object);
                resolve(object.clone());
            }, undefined, () => resolve(null));
        }, undefined, () => resolve(null));
    });
}

export function loadTrees(scene, quality = 'medium') {
    const trees = [];
    const promises = TREE_MODELS.map(name => loadOBJModel(name, '/models/natures/', 'tree'));

    const loadPromise = Promise.all(promises).then(models => {
        const validModels = models.filter(m => m !== null);
        if (validModels.length === 0) return trees;

        const budgets = { mobile: 55, low: 110, medium: 220, high: 340 };
        const budget = budgets[quality] || budgets.medium;

        // Random sampling avoids the artificial perimeter rows. The outermost
        // terrain band is intentionally less likely to receive a tree so the
        // fence remains readable from every direction.
        const clearings = [
            { x: 0, z: 0, radius: 78 },
            { x: 105, z: -80, radius: 34 },
            { x: 120, z: 90, radius: 42 },
            { x: -42, z: 58, radius: 28 },
            { x: -26, z: 70, radius: 28 },
            { x: -20, z: 22, radius: 22 },
            { x: -125, z: -115, radius: 28 },
            { x: 145, z: -155, radius: 38 },
            { x: -145, z: -155, radius: 38 },
        ];
        const selected = [];
        let attempts = 0;
        while (selected.length < budget && attempts < budget * 35) {
            attempts += 1;
            const x = THREE.MathUtils.randFloat(-235, 235);
            const z = THREE.MathUtils.randFloat(-235, 235);
            const edgeDistance = 235 - Math.max(Math.abs(x), Math.abs(z));
            if (edgeDistance < 28 && Math.random() < 0.72) continue;
            if (!isLandAccessible(x, z, 3.5)) continue;
            if (clearings.some((clearing) => (x - clearing.x) ** 2 + (z - clearing.z) ** 2 < clearing.radius ** 2)) continue;
            if (selected.some((tree) => (x - tree.x) ** 2 + (z - tree.z) ** 2 < 8 ** 2)) continue;
            selected.push({
                x,
                z,
                outer: Math.abs(x) > PLAYABLE_BOUNDARY || Math.abs(z) > PLAYABLE_BOUNDARY,
                scale: 1.6 + Math.random() * 2.3,
                rotation: Math.random() * Math.PI * 2
            });
        }
        const grouped = validModels.map(() => []);
        selected.forEach((placement) => grouped[Math.floor(Math.random() * grouped.length)].push(placement));

        validModels.forEach((baseModel, modelIndex) => {
            const modelBounds = new THREE.Box3().setFromObject(baseModel);
            const baseMinY = modelBounds.min.y;
            const modelPlacements = grouped[modelIndex];
            baseModel.updateMatrixWorld(true);

            baseModel.traverse((sourceMesh) => {
                if (!sourceMesh.isMesh || modelPlacements.length === 0) return;
                const batch = new THREE.InstancedMesh(sourceMesh.geometry, sourceMesh.material, modelPlacements.length);
                batch.instanceMatrix.setUsage(THREE.StaticDrawUsage);
                batch.castShadow = false;
                batch.receiveShadow = false;
                const childMatrix = sourceMesh.matrixWorld.clone();
                const rootMatrix = new THREE.Matrix4();
                const rotation = new THREE.Matrix4();
                const scaleMatrix = new THREE.Matrix4();
                modelPlacements.forEach((placement, index) => {
                    const terrainY = getTerrainHeight(placement.x, placement.z);
                    rootMatrix.makeTranslation(placement.x, terrainY - baseMinY * placement.scale, placement.z);
                    rotation.makeRotationY(placement.rotation);
                    scaleMatrix.makeScale(placement.scale, placement.scale, placement.scale);
                    batch.setMatrixAt(index, rootMatrix.clone().multiply(rotation).multiply(scaleMatrix).multiply(childMatrix));
                });
                batch.instanceMatrix.needsUpdate = true;
                batch.computeBoundingSphere();
                scene.add(batch);
            });
            modelPlacements.forEach((placement) => {
                trees.push({ x: placement.x, z: placement.z, outer: placement.outer, radius: placement.scale * 0.8 });
            });
        });
        return trees;
    });

    return { trees, loadPromise };
}

export function createFence(scene, quality = 'medium') {
    const fence = new THREE.Group();
    const boundary = PLAYABLE_BOUNDARY;
    const postSpacing = quality === 'low' ? 16 : 12;
    const postCountPerSide = Math.ceil((boundary * 2) / postSpacing) + 1;
    const postGeometry = new THREE.BoxGeometry(0.9, 5.5, 0.9);
    const railGeometry = new THREE.BoxGeometry(1, 0.42, 0.42);
    const material = new THREE.MeshStandardMaterial({ color: 0x8b5a32, roughness: 0.9 });
    const posts = new THREE.InstancedMesh(postGeometry, material, postCountPerSide * 4);
    const rails = new THREE.InstancedMesh(railGeometry, material, (postCountPerSide - 1) * 4 * 2);
    const postMatrix = new THREE.Matrix4();
    const railMatrix = new THREE.Matrix4();
    const rotation = new THREE.Matrix4();
    const scale = new THREE.Matrix4();
    let postIndex = 0;
    let railIndex = 0;

    for (let side = 0; side < 4; side += 1) {
        const horizontal = side > 1;
        const fixed = side % 2 === 0 ? -boundary : boundary;
        for (let i = 0; i < postCountPerSide; i += 1) {
            const along = -boundary + (i / (postCountPerSide - 1)) * boundary * 2;
            const x = horizontal ? along : fixed;
            const z = horizontal ? fixed : along;
            postMatrix.makeTranslation(x, getTerrainHeight(x, z) + 2.75, z);
            posts.setMatrixAt(postIndex++, postMatrix);

            if (i === postCountPerSide - 1) continue;
            const nextAlong = -boundary + ((i + 1) / (postCountPerSide - 1)) * boundary * 2;
            const nextX = horizontal ? nextAlong : fixed;
            const nextZ = horizontal ? fixed : nextAlong;
            const midX = (x + nextX) * 0.5;
            const midZ = (z + nextZ) * 0.5;
            const length = Math.abs(nextAlong - along);
            for (const height of [1.7, 3.4]) {
                railMatrix.makeTranslation(midX, (getTerrainHeight(x, z) + getTerrainHeight(nextX, nextZ)) * 0.5 + height, midZ);
                rotation.makeRotationY(horizontal ? 0 : Math.PI / 2);
                scale.makeScale(length, 1, 1);
                rails.setMatrixAt(railIndex++, railMatrix.clone().multiply(rotation).multiply(scale));
            }
        }
    }

    posts.instanceMatrix.needsUpdate = true;
    rails.instanceMatrix.needsUpdate = true;
    posts.computeBoundingSphere();
    rails.computeBoundingSphere();
    posts.castShadow = quality !== 'low';
    rails.castShadow = quality !== 'low';
    fence.add(posts, rails);
    scene.add(fence);
    return fence;
}

export function loadBushes(scene, count = 100) {
    const bushes = [];
    const promises = BUSH_MODELS.map(name => loadOBJModel(name, '/models/natures/', 'bush'));

    const loadPromise = Promise.all(promises).then(models => {
        const validModels = models.filter(m => m !== null);
        if (validModels.length === 0) return bushes;

        for (let i = 0; i < count; i++) {
            const baseModel = validModels[Math.floor(Math.random() * validModels.length)];
            const bush = baseModel.clone();

            const scale = 1.0 + Math.random() * 1.5;
            bush.scale.setScalar(scale);

            const angle = Math.random() * Math.PI * 2;
            const radius = 30 + Math.random() * 160;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;
            if (!isLandAccessible(x, z, 2)) continue;
            const h = getTerrainHeight(x, z);

            bush.position.set(x, h, z);
            bush.rotation.y = Math.random() * Math.PI * 2;
            alignObjectToTerrain(bush, h);

            scene.add(bush);
            bushes.push(bush);
        }
        return bushes;
    });

    return { bushes, loadPromise };
}

export function loadRocks(scene, count = 40) {
    const rocks = [];
    const promises = ROCK_MODELS.map(name => loadOBJModel(name, '/models/natures/', 'rock'));

    const loadPromise = Promise.all(promises).then(models => {
        const validModels = models.filter(m => m !== null);
        if (validModels.length === 0) return rocks;

        const outcroppings = [
            { x: 60, z: 30, count: 5, radius: 10 },
            { x: -70, z: -40, count: 6, radius: 12 },
            { x: 30, z: -80, count: 4, radius: 8 },
        ];

        outcroppings.forEach(patch => {
            for (let i = 0; i < patch.count; i++) {
                const baseModel = validModels[Math.floor(Math.random() * validModels.length)];
                const rock = baseModel.clone();
                const scale = 1.5 + Math.random() * 2.0;
                rock.scale.setScalar(scale);

                const angle = Math.random() * Math.PI * 2;
                const r = Math.random() * patch.radius;
                const x = patch.x + Math.cos(angle) * r;
                const z = patch.z + Math.sin(angle) * r;
                if (!isLandAccessible(x, z, 2)) continue;
                const h = getTerrainHeight(x, z);

                rock.position.set(x, h, z);
                rock.rotation.y = Math.random() * Math.PI * 2;
                rock.rotation.x = (Math.random() - 0.5) * 0.5;
                rock.rotation.z = (Math.random() - 0.5) * 0.5;
                alignObjectToTerrain(rock, h);

                scene.add(rock);
                rocks.push(rock);
            }
        });

        // --- RIVER BANK ROCKS ---
        const riverSamples = 20;
        const riverPoints = [
            [-218, 112], [-178, 101], [-135, 108], [-92, 94], [-48, 101],
            [-4, 87], [42, 98], [88, 82], [132, 91], [176, 73], [218, 82]
        ];

        for (let i = 0; i < riverSamples; i++) {
            const baseModel = validModels[Math.floor(Math.random() * validModels.length)];
            const rock = baseModel.clone();

            // Random point along the river path
            const segment = Math.floor(Math.random() * (riverPoints.length - 1));
            const t = Math.random();
            const p1 = riverPoints[segment];
            const p2 = riverPoints[segment + 1];

            const rx = p1[0] + (p2[0] - p1[0]) * t;
            const rz = p1[1] + (p2[1] - p1[1]) * t;

            const metrics = getRiverMetrics(rx, rz);
            const side = Math.random() > 0.5 ? 1 : -1;
            const push = metrics.width + 0.8 + Math.random() * 1.5;

            const x = rx + metrics.tangent.y * push * side;
            const z = rz - metrics.tangent.x * push * side;

            const h = getTerrainHeight(x, z);
            const scale = 1.2 + Math.random() * 1.8;
            rock.scale.setScalar(scale);
            rock.position.set(x, h - 0.2, z); // Embed slightly
            rock.rotation.y = Math.random() * Math.PI * 2;
            rock.rotation.x = (Math.random() - 0.5) * 0.8;
            alignObjectToTerrain(rock, h);

            scene.add(rock);
            rocks.push(rock);
        }

        const remaining = count - rocks.length;
        for (let i = 0; i < remaining; i++) {
            const baseModel = validModels[Math.floor(Math.random() * validModels.length)];
            const rock = baseModel.clone();
            const scale = 1.0 + Math.random() * 1.5;
            rock.scale.setScalar(scale);

            const angle = Math.random() * Math.PI * 2;
            const radius = 20 + Math.random() * 180;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;
            if (!isLandAccessible(x, z, 2)) continue;
            const h = getTerrainHeight(x, z);

            rock.position.set(x, h, z);
            rock.rotation.y = Math.random() * Math.PI * 2;
            rock.rotation.x = (Math.random() - 0.5) * 0.5;
            rock.rotation.z = (Math.random() - 0.5) * 0.5;
            alignObjectToTerrain(rock, h);

            scene.add(rock);
            rocks.push(rock);
        }
        return rocks;
    });

    return { rocks, loadPromise };
}

export function createGrass(scene, count = 2500) {
    const grass = [];
    const promises = GRASS_MODELS.map(name => loadOBJModel(name, '/models/natures/', 'grass'));

    return Promise.all(promises).then(async (models) => {
        const validModels = models.filter(m => m !== null);

        if (validModels.length > 0) {
            for (let i = 0; i < count; i++) {
                const baseModel = validModels[Math.floor(Math.random() * validModels.length)];
                const grassClump = baseModel.clone();

                // Slightly larger and more varied scale
                const scale = 1.2 + Math.random() * 2.2;
                grassClump.scale.setScalar(scale);

                // Spread evenly across the ENTIRE terrain map
                const angle = Math.random() * Math.PI * 2;
                const r = Math.pow(Math.random(), 0.5) * 235; // Keep grass within the 500x500 terrain.
                 const x = Math.cos(angle) * r;
                 const z = Math.sin(angle) * r;
                 if (!isLandAccessible(x, z, 0.8)) continue;
                 const h = getTerrainHeight(x, z);

                grassClump.position.set(x, h, z);

                // Randomize rotation and add slight tilt for a wild/windy look
                grassClump.rotation.y = Math.random() * Math.PI * 2;
                grassClump.rotation.x = (Math.random() - 0.5) * 0.3;
                grassClump.rotation.z = (Math.random() - 0.5) * 0.3;
                alignObjectToTerrain(grassClump, h, new THREE.Box3(), 0);

                scene.add(grassClump);
                grass.push(grassClump);

                // Yield during bulk cloning so the loading screen and browser stay responsive.
                if (i > 0 && i % 40 === 0) {
                    await new Promise(resolve => requestAnimationFrame(resolve));
                }
            }
        }
        return grass;
    });
}

export function createClouds(scene, count = 18) {
    const clouds = [];
    const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.7,
        fog: false
    });

    const puffGeometry = new THREE.DodecahedronGeometry(1, 0);
    for (let i = 0; i < count; i++) {
        const group = new THREE.Group();
        const numPuffs = 4 + Math.floor(Math.random() * 4);

        for (let j = 0; j < numPuffs; j++) {
            const size = 4 + Math.random() * 5;
            const mesh = new THREE.Mesh(puffGeometry, mat);
            mesh.position.set(
                j * 6 + Math.random() * 2,
                Math.random() * 3,
                Math.random() * 5
            );
            mesh.scale.set(
                size * (1.2 + Math.random() * 0.8),
                size * (0.55 + Math.random() * 0.2),
                size * (0.8 + Math.random() * 0.45)
            );
            group.add(mesh);
        }

        group.position.set(
            (Math.random() - 0.5) * 600,
            60 + Math.random() * 35,
            (Math.random() - 0.5) * 600
        );
        scene.add(group);
        clouds.push(group);
    }

    return clouds;
}

