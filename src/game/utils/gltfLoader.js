import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const SPECULAR_GLOSSINESS_EXTENSION = 'KHR_materials_pbrSpecularGlossiness';

// Three.js removed this legacy extension from GLTFLoader, while some of the
// existing downloadable models still declare it as required.
export function createGLTFLoader() {
    const loader = new GLTFLoader();
    loader.register((parser) => ({
        name: SPECULAR_GLOSSINESS_EXTENSION,
        extendMaterialParams(materialIndex, materialParams) {
            const material = parser.json.materials?.[materialIndex];
            const extension = material?.extensions?.[SPECULAR_GLOSSINESS_EXTENSION];
            if (!extension) return Promise.resolve();

            const pending = [];
            const diffuseFactor = extension.diffuseFactor || [1, 1, 1, 1];
            materialParams.color = new THREE.Color().setRGB(
                diffuseFactor[0],
                diffuseFactor[1],
                diffuseFactor[2],
                THREE.LinearSRGBColorSpace
            );
            materialParams.opacity = diffuseFactor[3];
            materialParams.metalness = 0;
            materialParams.roughness = extension.glossinessFactor === undefined
                ? 1
                : 1 - extension.glossinessFactor;

            if (extension.diffuseTexture !== undefined) {
                pending.push(parser.assignTexture(materialParams, 'map', extension.diffuseTexture, THREE.SRGBColorSpace));
            }

            return Promise.all(pending);
        }
    }));
    return loader;
}
