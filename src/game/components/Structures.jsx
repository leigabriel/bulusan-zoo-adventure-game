import * as THREE from 'three';
import { getTerrainHeight } from './Terrain.jsx';
import { resolveAssetUrl } from '../utils/localAssets.js';
import { createGLTFLoader } from '../utils/gltfLoader.js';

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
            const color = mat.color || new THREE.Color(0xffffff);
            const isTooDark = color.r < 0.1 && color.g < 0.1 && color.b < 0.1;

            // If we have a texture map, we usually want the base color to be white
            // so the texture appears with its natural colors.
            let finalColor = color;
            if (mat.map) {
                finalColor = new THREE.Color(0xffffff);
            } else if (isTooDark) {
                finalColor = new THREE.Color(0x8b5e3c); // Fallback wood brown
            }

            const newMat = new THREE.MeshStandardMaterial({
                color: finalColor,
                map: mat.map,
                normalMap: mat.normalMap,
                roughness: mat.map ? 1.0 : 0.8, // More roughness for wood texture
                metalness: 0.0,
                side: THREE.DoubleSide
            });

            if (newMat.map) {
                newMat.map.colorSpace = THREE.SRGBColorSpace;
                newMat.map.needsUpdate = true;
            }

            // Subtle emissive only if there's NO map and it was too dark
            if (isTooDark && !mat.map) {
                newMat.emissive = new THREE.Color(0x221100);
                newMat.emissiveIntensity = 0.05;
            }

            newMat.transparent = mat.transparent || false;
            newMat.opacity = mat.opacity ?? 1;
            mat.dispose();

            return newMat;
        });

        child.material = Array.isArray(child.material) ? newMaterials : newMaterials[0];
    }
}

/**
 * Loads the new low-poly house models
 */
async function loadGLTFStructure(scene, path, name, x, z, scale = 1.0, rotationY = 0) {
    try {
        const url = await resolveAssetUrl(`${path}${name}`);
        const loader = createGLTFLoader();

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
    ];

    const promises = houseConfigs.map(cfg =>
        loadGLTFStructure(scene, cfg.path, cfg.file, cfg.x, cfg.z, cfg.scale, cfg.rotation)
    );

    const results = await Promise.all(promises);
    return results.filter(r => r !== null);
}
