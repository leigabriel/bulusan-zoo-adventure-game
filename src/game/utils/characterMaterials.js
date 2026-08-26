import * as THREE from 'three';

const HUMAN_SKIN_COLOR = new THREE.Color(0xc9825b);

export function applyHumanSkinColor(root) {
    root?.traverse((child) => {
        if (!child.isMesh || !child.material) return;
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((material) => {
            const materialName = String(material?.name || '').toLowerCase();
            if (!material || (!materialName.includes('skin') && !materialName.includes('face'))) return;
            material.color?.copy(HUMAN_SKIN_COLOR);
            material.emissive?.set(0x000000);
            material.emissiveIntensity = 0;
            material.roughness = Math.max(material.roughness ?? 0.5, 0.7);
        });
    });
}
