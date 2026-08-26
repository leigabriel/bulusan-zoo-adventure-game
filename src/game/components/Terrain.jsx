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

export function loadTrees(scene, count = 120) {
    const trees = [];
    const promises = TREE_MODELS.map(name => loadOBJModel(name, '/models/natures/', 'tree'));

    const loadPromise = Promise.all(promises).then(models => {
        const validModels = models.filter(m => m !== null);
        if (validModels.length === 0) return trees;

        // Reuse the fixed tree budget between an edge ring and a middle forest
        // band so density improves without increasing draw calls.
        const edgeTreeCount = Math.ceil(count * 0.75);
        const forestSectors = 14;
        for (let i = 0; i < count; i++) {
            const baseModel = validModels[Math.floor(Math.random() * validModels.length)];
            const tree = baseModel.clone();
            const scale = 2.5 + Math.random() * 2.5;
            tree.scale.setScalar(scale);

            const isEdgeTree = i < edgeTreeCount;
            const angle = isEdgeTree
                ? (Math.floor(i / Math.ceil(edgeTreeCount / forestSectors)) / forestSectors) * Math.PI * 2 + (Math.random() - 0.5) * 0.28
                : Math.random() * Math.PI * 2;
            const radius = isEdgeTree
                ? 175 + Math.random() * 50
                : 55 + Math.random() * 125;
             const x = Math.cos(angle) * radius;
             const z = Math.sin(angle) * radius;
             if (!isLandAccessible(x, z, 3)) continue;
             const h = getTerrainHeight(x, z);

            tree.position.set(x, h, z);
            tree.rotation.y = Math.random() * Math.PI * 2;
            alignObjectToTerrain(tree, h);

            scene.add(tree);
            trees.push(tree);
        }
        return trees;
    });

    return { trees, loadPromise };
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

