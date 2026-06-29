import * as THREE from 'three';

export function createScene() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.Fog(0xc8e4f0, 100, 450);
    return scene;
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

export function createRenderer(container) {
    const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const pixelRatio = isMobile ? Math.min(window.devicePixelRatio, 1.0) : Math.min(window.devicePixelRatio, 1.25);

    const renderer = new THREE.WebGLRenderer({
        antialias: !isMobile && window.devicePixelRatio <= 1.5,
        powerPreference: 'default',
        stencil: false,
        depth: true,
        alpha: false,
        preserveDrawingBuffer: false,
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(pixelRatio);

    renderer.shadowMap.enabled = false;

    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0; // Restored to default balanced exposure
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    if (container) {
        container.appendChild(renderer.domElement);
    }

    return renderer;
}

export function createLighting(scene) {
    // Balanced ambient light to fill shadows softly
    const ambient = new THREE.AmbientLight(0xffffff, 0.65);
    scene.add(ambient);

    // Natural daylight sun (not overwhelmingly bright)
    const sun = new THREE.DirectionalLight(0xfff5e6, 1.4);
    sun.position.set(100, 150, 80);
    sun.castShadow = false;
    scene.add(sun);

    const fill = new THREE.DirectionalLight(0xaaccff, 0.4);
    fill.position.set(-50, 50, -50);
    scene.add(fill);

    // Gentle bounce light from the ground and sky
    const hemisphere = new THREE.HemisphereLight(0xe6f5ff, 0x6a7556, 0.6);
    scene.add(hemisphere);

    return { ambient, sun, fill, hemisphere };
}