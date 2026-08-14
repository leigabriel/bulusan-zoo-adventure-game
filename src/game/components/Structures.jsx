import * as THREE from 'three';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { getTerrainHeight } from './Terrain.jsx';
import { resolveAssetUrl } from '../utils/localAssets.js';

/**
 * Enhanced material fix to prevent models from appearing black
 */
function fixMaterial(child) {
    if (!child.isMesh) return;

    child.castShadow = true;
    child.receiveShadow = true;

    if (child.material) {
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        const newMaterials = materials.map(mat => {
            // Check if material is too dark or pure black
            const color = mat.color;
            const isBlack = color.r === 0 && color.g === 0 && color.b === 0;

            // Create a standard material that responds better to lighting
            const newMat = new THREE.MeshStandardMaterial({
                color: isBlack ? new THREE.Color(0x8b5e3c) : color, // Use wood brown if black
                map: mat.map,
                normalMap: mat.normalMap,
                roughness: 0.8,
                metalness: 0.1,
                side: THREE.DoubleSide
            });

            if (newMat.map) newMat.map.colorSpace = THREE.SRGBColorSpace;
            return newMat;
        });

        child.material = Array.isArray(child.material) ? newMaterials : newMaterials[0];
    }
}

export async function loadWatchTower(scene, x = 45, z = 45, scale = 2.5) {
    const basePath = '/models/watch-tower/';
    const modelName = 'wooden watch tower2';

    try {
        const mtlUrl = await resolveAssetUrl(`${basePath}${modelName}.mtl`);
        const objUrl = await resolveAssetUrl(`${basePath}${modelName}.obj`);

        return new Promise((resolve) => {
            const mtlLoader = new MTLLoader();
            mtlLoader.load(mtlUrl, (materials) => {
                materials.preload();

                const objLoader = new OBJLoader();
                objLoader.setMaterials(materials);
                objLoader.load(objUrl, (object) => {
                    object.traverse(fixMaterial);

                    const terrainY = getTerrainHeight(x, z);
                    // Sink the tower slightly into the ground to prevent floating on slopes
                    object.position.set(x, terrainY - (0.4 * scale), z);
                    object.scale.setScalar(scale);

                    scene.add(object);

                    const platformHeight = terrainY + (6.5 * scale);
                    const platformRadius = 2.5 * scale;

                    resolve({
                        object,
                        x,
                        z,
                        radius: 1.5 * scale,
                        isTower: true,
                        platformY: platformHeight,
                        platformRadius: platformRadius
                    });
                }, undefined, () => resolve(null));
            }, undefined, () => resolve(null));
        });
    } catch (error) {
        console.error('Error loading watch tower:', error);
        return null;
    }
}

export async function loadMultipleTowers(scene) {
    const towerConfigs = [
        { x: 45, z: 45, scale: 2.5 },
        { x: -80, z: 90, scale: 2.8 },
        { x: 120, z: -40, scale: 2.4 }
    ];

    const promises = towerConfigs.map(cfg => loadWatchTower(scene, cfg.x, cfg.z, cfg.scale));
    const results = await Promise.all(promises);
    return results.filter(r => r !== null);
}

/**
 * Loads the new low-poly house models
 */
async function loadGLTFStructure(scene, path, name, x, z, scale = 1.0, rotationY = 0) {
    try {
        const url = await resolveAssetUrl(`${path}${name}`);
        const loader = new GLTFLoader();

        return new Promise((resolve) => {
            loader.load(url, (gltf) => {
                const model = gltf.scene;
                model.traverse(fixMaterial);

                const terrainY = getTerrainHeight(x, z);
                model.position.set(x, terrainY, z);
                model.scale.setScalar(scale);
                model.rotation.y = rotationY;

                scene.add(model);

                // Estimate collision radius based on scale
                const box = new THREE.Box3().setFromObject(model);
                const size = box.getSize(new THREE.Vector3());
                const radius = Math.max(size.x, size.z) * 0.45;

                resolve({ object: model, x, z, radius });
            }, undefined, () => resolve(null));
        });
    } catch (e) {
        console.error(`Failed to load house: ${name}`, e);
        return null;
    }
}

export async function loadNewHouses(scene) {
    const houseConfigs = [
        {
            path: '/models/low_poly_home_2/',
            file: 'scene.gltf',
            x: -120, z: -100,
            scale: 12.0, // Fixed: Scale was way too small (0.05)
            rotation: Math.PI / 4
        },
        {
            path: '/models/low_poly_medieval_house/',
            file: 'scene.gltf',
            x: 130, z: 100,
            scale: 5.5,
            rotation: -Math.PI / 3
        }
    ];

    const promises = houseConfigs.map(cfg =>
        loadGLTFStructure(scene, cfg.path, cfg.file, cfg.x, cfg.z, cfg.scale, cfg.rotation)
    );

    const results = await Promise.all(promises);
    return results.filter(r => r !== null);
}
