import * as THREE from 'three';

export function createScene(graphicsQuality) {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    applySceneQuality(scene, graphicsQuality || 'medium');
    return scene;
}

export function applySceneQuality(scene, quality) {
    const fogSettings = {
        low: { near: 60, far: 280 },
        medium: { near: 100, far: 450 },
        high: { near: 120, far: 600 }
    };
    const f = fogSettings[quality] || fogSettings.medium;
    scene.fog = new THREE.Fog(0xc8e4f0, f.near, f.far);
}

export function createCamera() {
    const camera = new THREE.PerspectiveCamera(
        65,
        window.innerWidth / window.innerHeight,
        0.5,
        700
    );
    camera.position.set(0, 5.5, 0);
    return camera;
}

function getQualityConfig(quality) {
    const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const dpr = window.devicePixelRatio;
    const configs = {
        low: {
            pixelRatio: Math.min(dpr, 0.75),
            antialias: false,
            shadows: false,
            toneMappingExposure: 1.0,
        },
        medium: {
            pixelRatio: isMobile ? Math.min(dpr, 1.0) : Math.min(dpr, 1.25),
            antialias: !isMobile && dpr <= 1.5,
            shadows: true,
            toneMappingExposure: 1.0,
        },
        high: {
            pixelRatio: Math.min(dpr, 2.0),
            antialias: true,
            shadows: true,
            toneMappingExposure: 1.1,
        },
    };
    return configs[quality] || configs.medium;
}

export function createRenderer(container, graphicsQuality) {
    const config = getQualityConfig(graphicsQuality || 'medium');

    const renderer = new THREE.WebGLRenderer({
        antialias: config.antialias,
        // Prefer the discrete/high-performance GPU when the platform offers one.
        powerPreference: 'high-performance',
        stencil: false,
        depth: true,
        alpha: false,
        preserveDrawingBuffer: false,
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(config.pixelRatio);

    renderer.shadowMap.enabled = config.shadows;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = config.toneMappingExposure;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    if (container) {
        container.appendChild(renderer.domElement);
    }

    return renderer;
}

export function applyRendererQuality(renderer, quality) {
    if (!renderer) return;
    const config = getQualityConfig(quality || 'medium');
    renderer.setPixelRatio(config.pixelRatio);
    renderer.shadowMap.enabled = config.shadows;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMappingExposure = config.toneMappingExposure;
}

export function createLighting(scene) {
    // Balanced ambient light to fill shadows softly
    const ambient = new THREE.AmbientLight(0xffffff, 0.65);
    scene.add(ambient);

    // Natural daylight sun (not overwhelmingly bright)
    const sun = new THREE.DirectionalLight(0xfff5e6, 1.4);
    sun.position.set(100, 150, 80);
    sun.castShadow = true;
    sun.shadow.mapSize.set(768, 768);
    sun.shadow.camera.near = 10;
    sun.shadow.camera.far = 500;
    sun.shadow.bias = -0.0002;
    scene.add(sun);

    const sunDisc = new THREE.Mesh(
        new THREE.SphereGeometry(14, 12, 8),
        new THREE.MeshBasicMaterial({ color: 0xfff3b0, fog: false })
    );
    sunDisc.position.set(-180, 190, -260);
    scene.add(sunDisc);

    const fill = new THREE.DirectionalLight(0xaaccff, 0.4);
    fill.position.set(-50, 50, -50);
    scene.add(fill);

    // Gentle bounce light from the ground and sky
    const hemisphere = new THREE.HemisphereLight(0xe6f5ff, 0x6a7556, 0.6);
    scene.add(hemisphere);

    return { ambient, sun, fill, hemisphere };
}
