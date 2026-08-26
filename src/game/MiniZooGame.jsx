import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';

import { createScene, createCamera, createRenderer, createLighting, applyRendererQuality, applySceneQuality } from './components/Scene.jsx';
import { createTerrain, createFence, createTigerEnclosure, loadTrees, loadBushes, loadRocks, createGrass, createClouds, getTerrainHeight, releaseTerrainModelCache, PLAYABLE_BOUNDARY } from './components/Terrain.jsx';
import { loadGLTFAnimals, loadAmbientBirds, releaseAnimalModelCache } from './components/Animals.jsx';
import { createRiver, updateRiver, updateRiverQuality, disposeRiver, isLandAccessible, findAccessiblePosition } from './components/River.jsx';
import { loadNewHouses } from './components/Structures.jsx';
import { createGLTFLoader } from './utils/gltfLoader.js';
import { applyHumanSkinColor } from './utils/characterMaterials.js';
import {
    createMovementHandler,
    setupKeyboardControls,
    setupTouchControls,
    setupMouseControls
} from './controls/Controls.jsx';

import {
    MainMenu,
    GameHUD,
    SettingsPanel,
    TaskPanel,
    HoldToFeedControl,
    FeedingSuccessNotification,
    QuitModal,
    ResetTasksModal,
    Joystick,
    JumpButton,
    AllAnimalsCelebration,
    CertificateModal,
    NPCInteractionPrompt,
    NPCDialogueModal,
    RotateDeviceOverlay,
    RunButton,
    AnimalCaution,
    playGameButtonSfx
} from './ui/GameUI.jsx';
import { AnimalBookModal, CameraPreview } from './ui/ExplorationHUD.jsx';
import { LoadingScreen } from '../components/loading-screen.jsx';

import {
    getTasks,
    feedAnimal,
    isAnimalFed,
    markAnimalDiscovered,
    resetAllFeedingTasks,
    getPlayerSession,
    savePlayerSession,
    getSettings,
    getProgress,
    getMissionProgress,
    saveMissionProgress
} from './utils/storage.js';
import { getAnimalBookEntry } from './data/animalMetadata.js';
import {
    ESSENTIAL_ASSET_PATHS,
    releaseAssetObjectUrls,
    resolveAssetUrl,
    warmupAssetStore
} from './utils/localAssets.js';

const PLAYER_HEIGHT = 0.2;
const PLAYER_CHARACTER_TARGET_HEIGHT = 1.6;
const FIRST_PERSON_EYE_OFFSET = 4.5;
const FIRST_PERSON_FOV = 70;
const THIRD_PERSON_FOV = 65;
const STATUE_CENTER = { x: 0, z: 0 };
const PLAYER_START_OFFSET = { x: 14, z: 10 };
const SETTINGS_CHANGE_EVENT = 'minizoo-settings-changed';
const PLAYER_NAME_KEY = 'minizoo_player_name';
const PLAYER_CHARACTER_KEY = 'minizoo_character_id';
const CHARACTER_OPTIONS = [
    { id: 'casual3_female', label: 'Casual Female', file: 'Casual3_Female.gltf', emoji: '🧭' },
    { id: 'casual3_male', label: 'Casual Male', file: 'Casual3_Male.gltf', emoji: '🦺' },
    { id: 'cowboy_female', label: 'Cowboy Female', file: 'Cowboy_Female.gltf', emoji: '🤠' },
    { id: 'cowboy_male', label: 'Cowboy Male', file: 'Cowboy_Male.gltf', emoji: '🏜️' },
    { id: 'kimono_female', label: 'Kimono Female', file: 'Kimono_Female.gltf', emoji: '🌸' },
    { id: 'kimono_male', label: 'Kimono Male', file: 'Kimono_Male.gltf', emoji: '🎎' }
];
const STAFF_NPC_CONFIG = {
    name: 'Ranger Lino',
    role: 'Bulusan Zootopia Adventure Staff',
    file: 'Cowboy_Male.gltf',
    position: { x: -20, z: 22 },
    interactionRadius: 12,
    obstacleRadius: 2.4,
    targetHeight: 1.75,
    patrolRadiusMin: 3.5,
    patrolRadiusMax: 8.5,
    moveSpeed: 0.8,
    turnSpeed: 4.2,
    stopDistance: 0.45,
    facingOffset: Math.PI
};
const STAFF_DIALOGUE_NODES = {
    root: {
        id: 'root',
        message: 'Hello, explorer! I am Ranger Lino, your Zoo Ranger guide. I can help you care for animals and finish your mission.',
        choices: [
            { id: 'mission', label: 'Current Mission', nextId: 'mission', icon: '★', accent: true },
            { id: 'animals', label: 'Learn About Animals', nextId: 'animals', icon: '🐾' },
            { id: 'bulusan', label: 'About Bulusan', nextId: 'bulusan', icon: '🌋' },
            { id: 'how', label: 'How to Play', nextId: 'how', icon: '🧭' },
            { id: 'bye', label: 'Goodbye', close: true, icon: '👋' }
        ]
    },
    animals: {
        id: 'animals',
        message: 'Meet the animals you have discovered. Choose an animal to learn a little more.',
        choices: [
            { id: 'back', label: 'Back', nextId: 'root' }
        ]
    },
    mission: { id: 'mission', message: 'Let us care for a horse and rabbit together. I will remind you what to do next.', choices: [{ id: 'back', label: 'Back', nextId: 'root' }] },
    bulusan: {
        id: 'bulusan',
        message: 'Bulusan is known for rich nature and wildlife around the forest area. This adventure teaches kids to protect local habitats.',
        choices: [
            { id: 'back', label: 'Back', nextId: 'root' }
        ]
    },
    how: {
        id: 'how',
        message: 'Walk with the joystick or WASD. Use Run and Jump when you need them. Walk near a gentle animal and hold Feed. Press T or E near me to talk.',
        choices: [
            { id: 'back', label: 'Back', nextId: 'root' }
        ]
    },
    tools: {
        id: 'tools',
        message: 'The book records animals you discover and shows their facts. The camera captures a view of your adventure so you can save or share a zoo photo. Your task progress is always available from the task list.',
        choices: [
            { id: 'back', label: 'Back', nextId: 'root' }
        ]
    }
};
let CONTACT_SHADOW_TEXTURE = null;

function getStaffDialogueNode(nodeId) {
    return STAFF_DIALOGUE_NODES[nodeId] || STAFF_DIALOGUE_NODES.root;
}

function chooseNextStaffPatrolTarget(homeX, homeZ) {
    for (let attempt = 0; attempt < 12; attempt += 1) {
        const angle = Math.random() * Math.PI * 2;
        const radius = THREE.MathUtils.lerp(STAFF_NPC_CONFIG.patrolRadiusMin, STAFF_NPC_CONFIG.patrolRadiusMax, Math.random());
        const target = { x: homeX + Math.cos(angle) * radius, z: homeZ + Math.sin(angle) * radius };
        if (Math.abs(target.x) <= PLAYABLE_BOUNDARY - STAFF_NPC_CONFIG.obstacleRadius
            && Math.abs(target.z) <= PLAYABLE_BOUNDARY - STAFF_NPC_CONFIG.obstacleRadius
            && isLandAccessible(target.x, target.z, STAFF_NPC_CONFIG.obstacleRadius)) return target;
    }
    return { x: homeX, z: homeZ };
}

function setStaffNpcAction(npc, actionName) {
    if (!npc?.actions) return;
    const nextAction = npc.actions[actionName];
    if (!nextAction || nextAction === npc.currentAction) return;

    if (npc.currentAction) {
        npc.currentAction.fadeOut(0.22);
    }

    nextAction.reset();
    nextAction.enabled = true;
    nextAction.setEffectiveWeight(1);
    nextAction.fadeIn(0.22);
    nextAction.play();
    npc.currentAction = nextAction;
}

function getContactShadowTexture() {
    if (CONTACT_SHADOW_TEXTURE) return CONTACT_SHADOW_TEXTURE;

    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(size / 2, size / 2, size * 0.08, size / 2, size / 2, size * 0.5);
    grad.addColorStop(0, 'rgba(0,0,0,0.55)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    CONTACT_SHADOW_TEXTURE = new THREE.CanvasTexture(canvas);
    CONTACT_SHADOW_TEXTURE.colorSpace = THREE.SRGBColorSpace;
    CONTACT_SHADOW_TEXTURE.needsUpdate = true;
    return CONTACT_SHADOW_TEXTURE;
}

function createContactShadow(size, opacity) {
    const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(size, size),
        new THREE.MeshBasicMaterial({
            map: getContactShadowTexture(),
            transparent: true,
            opacity,
            depthWrite: false,
            polygonOffset: true,
            polygonOffsetFactor: -1,
            polygonOffsetUnits: -1,
            toneMapped: false
        })
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.renderOrder = 1;
    return mesh;
}

function getAmbienceVolume() {
    try {
        const raw = localStorage.getItem('minizoo_settings');
        if (!raw) return 1.0;
        const parsed = JSON.parse(raw);
        return typeof parsed?.ambienceVolume === 'number' ? parsed.ambienceVolume : 1.0;
    } catch {
        return 1.0;
    }
}

function getMusicVolume() {
    try {
        const raw = localStorage.getItem('minizoo_settings');
        if (!raw) return 0.5;
        const parsed = JSON.parse(raw);
        return typeof parsed?.musicVolume === 'number' ? parsed.musicVolume : 0.5;
    } catch {
        return 0.5;
    }
}

function getSfxVolume() {
    try {
        const raw = localStorage.getItem('minizoo_settings');
        if (!raw) return 1.0;
        const parsed = JSON.parse(raw);
        return typeof parsed?.sfxVolume === 'number' ? parsed.sfxVolume : 1.0;
    } catch {
        return 1.0;
    }
}

function getUiVolume() {
    try {
        const raw = localStorage.getItem('minizoo_settings');
        if (!raw) return 1.0;
        const parsed = JSON.parse(raw);
        return typeof parsed?.uiVolume === 'number' ? parsed.uiVolume : 1.0;
    } catch {
        return 1.0;
    }
}

function getStoredPlayerName() {
    try {
        return (localStorage.getItem(PLAYER_NAME_KEY) || '').trim();
    } catch {
        return '';
    }
}

function getStoredCharacterId() {
    try {
        const stored = (localStorage.getItem(PLAYER_CHARACTER_KEY) || '').trim();
        return CHARACTER_OPTIONS.some((option) => option.id === stored) ? stored : null;
    } catch {
        return null;
    }
}

function saveStoredCharacterId(characterId) {
    try {
        localStorage.setItem(PLAYER_CHARACTER_KEY, characterId);
    } catch {
        // Ignore storage issues to avoid blocking gameplay.
    }
}

function addStatueLights(scene) {
    const key = new THREE.SpotLight(0xfff3d9, 1.2, 140, Math.PI / 5, 0.35, 1.2);
    key.position.set(24, 30, 18);
    key.target.position.set(STATUE_CENTER.x, 6, STATUE_CENTER.z);
    key.castShadow = false;

    const fill = new THREE.PointLight(0xd6e9ff, 0.5, 120, 2);
    fill.position.set(-18, 16, -12);

    scene.add(key);
    scene.add(key.target);
    scene.add(fill);
}

async function loadCenterStatue(scene, isMobile) {
    const loader = createGLTFLoader();
    const statueUrl = await resolveAssetUrl('/models/bulusanstatue.glb');
    return new Promise((resolve) => {
        loader.load(
            statueUrl,
            (gltf) => {
                const statue = gltf.scene;
                const terrainY = getTerrainHeight(STATUE_CENTER.x, STATUE_CENTER.z);
                statue.position.set(STATUE_CENTER.x, terrainY, STATUE_CENTER.z);

                statue.traverse((child) => {
                    if (!child.isMesh) return;
                    child.castShadow = false;
                    child.receiveShadow = false;

                    const toBasic = (mat) => {
                        if (!mat) return mat;
                        const basic = new THREE.MeshBasicMaterial();
                        if (mat.map) {
                            mat.map.colorSpace = THREE.SRGBColorSpace;
                            mat.map.needsUpdate = true;
                            basic.map = mat.map;
                        }
                        basic.side = mat.side;
                        basic.transparent = mat.transparent;
                        basic.alphaTest = mat.alphaTest;
                        mat.dispose();
                        return basic;
                    };

                    if (Array.isArray(child.material)) {
                        child.material = child.material.map(toBasic);
                    } else {
                        child.material = toBasic(child.material);
                    }
                });

                const initialBox = new THREE.Box3().setFromObject(statue);
                const initialSize = new THREE.Vector3();
                initialBox.getSize(initialSize);

                const targetHeight = isMobile ? 8 : 10;
                const currentHeight = Math.max(initialSize.y, 0.001);
                const scale = targetHeight / currentHeight;
                statue.scale.setScalar(scale);

                const fittedBox = new THREE.Box3().setFromObject(statue);
                statue.position.y += terrainY - fittedBox.min.y;

                scene.add(statue);

                const fittedSize = new THREE.Vector3();
                fittedBox.getSize(fittedSize);
                const collisionRadius = Math.max(3.5, Math.max(fittedSize.x, fittedSize.z) * 0.42);
                resolve({ statue, collisionRadius });
            },
            undefined,
            () => resolve(null)
        );
    });
}

async function loadStaffNpc(scene, isMobile) {
    const loader = createGLTFLoader();
    const staffUrl = await resolveAssetUrl(`/models/characters/${STAFF_NPC_CONFIG.file}`);
    return new Promise((resolve) => {
        loader.load(
            staffUrl,
            (gltf) => {
                const model = gltf.scene;
                model.traverse((child) => {
                    if (!child.isMesh) return;
                    child.castShadow = false;
                    child.receiveShadow = false;
                });

                const initialBox = new THREE.Box3().setFromObject(model);
                const initialSize = new THREE.Vector3();
                initialBox.getSize(initialSize);
                const sourceHeight = Math.max(initialSize.y, 0.001);
                const targetHeight = isMobile ? 1.6 : STAFF_NPC_CONFIG.targetHeight;
                const scale = THREE.MathUtils.clamp(targetHeight / sourceHeight, 0.02, 5);
                model.scale.multiplyScalar(scale);

                const terrainY = getTerrainHeight(STAFF_NPC_CONFIG.position.x, STAFF_NPC_CONFIG.position.z);
                const fittedBox = new THREE.Box3().setFromObject(model);
                const baseYOffset = -fittedBox.min.y;
                model.position.set(
                    STAFF_NPC_CONFIG.position.x,
                    terrainY + baseYOffset,
                    STAFF_NPC_CONFIG.position.z
                );
                model.rotation.y = Math.PI * 0.85;
                scene.add(model);

                const shadow = createContactShadow(2.1, 0.23);
                shadow.position.set(model.position.x, terrainY + 0.055, model.position.z);
                scene.add(shadow);

                let mixer = null;
                const actions = {};
                let idleAction = null;
                let walkAction = null;
                if (gltf.animations && gltf.animations.length > 0) {
                    mixer = new THREE.AnimationMixer(model);
                    gltf.animations.forEach((clip) => {
                        actions[clip.name.toLowerCase()] = mixer.clipAction(clip);
                    });

                    const actionList = Object.entries(actions);
                    idleAction = actionList.find(([name]) => /idle|stand|breath/.test(name))?.[1] || actionList[0]?.[1] || null;
                    walkAction = actionList.find(([name]) => /walk|jog|stride/.test(name))?.[1] || null;

                    if (idleAction) {
                        idleAction.enabled = true;
                        idleAction.setEffectiveWeight(1);
                        idleAction.play();
                    }
                }

                const initialTarget = chooseNextStaffPatrolTarget(STAFF_NPC_CONFIG.position.x, STAFF_NPC_CONFIG.position.z);

                resolve({
                    model,
                    shadow,
                    mixer,
                    actions: {
                        idle: idleAction,
                        walk: walkAction
                    },
                    currentAction: idleAction,
                    x: STAFF_NPC_CONFIG.position.x,
                    z: STAFF_NPC_CONFIG.position.z,
                    baseYOffset,
                    homeX: STAFF_NPC_CONFIG.position.x,
                    homeZ: STAFF_NPC_CONFIG.position.z,
                    targetX: initialTarget.x,
                    targetZ: initialTarget.z,
                    pauseUntil: performance.now() * 0.001 + 0.9,
                    moving: false,
                    moveSpeed: STAFF_NPC_CONFIG.moveSpeed,
                    turnSpeed: STAFF_NPC_CONFIG.turnSpeed,
                    stopDistance: STAFF_NPC_CONFIG.stopDistance,
                    facingOffset: STAFF_NPC_CONFIG.facingOffset,
                    interactionRadius: STAFF_NPC_CONFIG.interactionRadius,
                    obstacleRadius: STAFF_NPC_CONFIG.obstacleRadius,
                    name: STAFF_NPC_CONFIG.name,
                    role: STAFF_NPC_CONFIG.role
                });
            },
            undefined,
            () => resolve(null)
        );
    });
}

function MiniZooGame() {
    const containerRef = useRef(null);
    const stickRef = useRef(null);
    const baseRef = useRef(null);
    const jumpRef = useRef(null);

    const ambienceRef = useRef(null);
    const musicRef = useRef(null);
    const isNearStatueRef = useRef(false);
    const hasShownStatueEntryRef = useRef(false);
    const soundEnabledRef = useRef(getSfxVolume() > 0);
    const gameStartedRef = useRef(false);
    const cameraModeRef = useRef('third');
    const showNpcDialogueRef = useRef(false);
    const nearbyAnimalRef = useRef(null);
    const nearbyStaffRef = useRef(false);
    const lastTapRef = useRef(0);
    const graphicsQualityRef = useRef((getSettings().graphicsQuality || 'medium'));
    const fpsLimitRef = useRef((getSettings().fpsLimit || 60));

    const [isTouchDevice, setIsTouchDevice] = useState(() => {
        if (typeof window === 'undefined') return false;
        return 'ontouchstart' in window
            || navigator.maxTouchPoints > 0
            || window.matchMedia('(pointer: coarse)').matches;
    });

    const [isLoading, setIsLoading] = useState(true);
    const [_loadProgress, setLoadProgress] = useState(0);
    const [gameStarted, setGameStarted] = useState(false);
    const [showMenu, setShowMenu] = useState(true);

    const [settingsOpen, setSettingsOpen] = useState(false);
    const [tasksOpen, setTasksOpen] = useState(false);
    const [showQuitModal, setShowQuitModal] = useState(false);
    const [showResetTasksModal, setShowResetTasksModal] = useState(false);
    const [selectedCharacterId, setSelectedCharacterId] = useState(() => getStoredCharacterId());
    const [cameraMode, setCameraMode] = useState('third');
    const [characterReady, setCharacterReady] = useState(false);
    const [showAllFedCelebration, setShowAllFedCelebration] = useState(false);
    const [showCertificate, setShowCertificate] = useState(false);
    const [nearbyStaff, setNearbyStaff] = useState(false);
    const [showNpcDialogue, setShowNpcDialogue] = useState(false);
    const [npcDialogueNodeId, setNpcDialogueNodeId] = useState('root');
    const [bookOpen, setBookOpen] = useState(false);
    const bookOpenRef = useRef(false);
    const cameraTransitionRef = useRef({ active: false, startedAt: 0 });

    const [nearbyAnimal, setNearbyAnimal] = useState(null);
    const [tasks, setTasks] = useState(getTasks());
    const [missionProgress, setMissionProgress] = useState(() => getMissionProgress());
    const missionProgressRef = useRef(missionProgress);
    const [playerName, setPlayerName] = useState(() => getStoredPlayerName());

    const [feedingSuccess, setFeedingSuccess] = useState({ visible: false, animalName: '' });
    const [discoveredAnimals, setDiscoveredAnimals] = useState(() => [...new Set(getProgress().animalsDiscovered.map((name) => getAnimalBookEntry(name)?.name || name))]);
    const [photoPreview, setPhotoPreview] = useState('');
    const [cameraFlash, setCameraFlash] = useState(false);
    const [feedingProgress, setFeedingProgress] = useState(0);
    const [isFeeding, setIsFeeding] = useState(false);
    const allFedCelebratedRef = useRef(false);
    const feedingInProgressRef = useRef(null);
    const feedingTimerRef = useRef(null);
    const feedingFrameRef = useRef(null);
    const feedingStartedAtRef = useRef(0);

    // Added obstacles array to state to hold tree/rock/bush positions
    const gameStateRef = useRef({
        keys: {}, yaw: 0, pitch: 0,
        mX: 0, mY: 0, sActive: false, lActive: false, lx: 0, ly: 0,
        velocityY: 0, isJumping: false, isGrounded: true,
        sensitivity: getSettings().sensitivity || 1.0,
        playerHeight: PLAYER_HEIGHT,
        playerMoveSpeed: 0,
        playerIsMoving: false,
        playerIsRunning: false,
        currentCameraMode: 'third',
        controlsEnabled: false,
        cameraControlLockedUntil: 0,
        animationId: null, scene: null, camera: null, renderer: null,
        animals: [], ambientBirds: [], clouds: [], river: null, obstacles: [], animalObstacles: [], animalObstaclePool: [], cleanup: null, initialized: false,
        isLandAccessible,
        playerAnchor: null,
        playerCharacter: null,
        playerCharacterBaseYOffset: 0,
        playerCharacterBox: new THREE.Box3(),
        playerShadow: null,
        playerMixer: null,
        playerActions: {},
        currentPlayerAction: null,
        currentPlayerActionName: null,
        playerVictoryUntil: 0,
        staffNpc: null,
    });

    useEffect(() => {
        const check = () => {
            setIsTouchDevice(
                'ontouchstart' in window ||
                navigator.maxTouchPoints > 0 ||
                window.matchMedia('(pointer: coarse)').matches
            );
        };
        window.addEventListener('resize', check);
        window.addEventListener('orientationchange', check);
        return () => {
            window.removeEventListener('resize', check);
            window.removeEventListener('orientationchange', check);
        };
    }, []);

    useEffect(() => {
        // Seed IndexedDB with essential large assets on first visit.
        warmupAssetStore(ESSENTIAL_ASSET_PATHS).catch(() => { });
    }, []);

    useEffect(() => {
        if (!isTouchDevice) return;

        const handleTouchStart = (e) => {
            if (bookOpenRef.current) return;
            const now = performance.now();
            const elapsed = now - lastTapRef.current;
            if (elapsed < 300 && elapsed > 0) {
                e.preventDefault();
                if (!document.fullscreenElement) {
                    document.documentElement.requestFullscreen().catch(() => { });
                } else {
                    document.exitFullscreen().catch(() => { });
                }
                lastTapRef.current = 0;
            } else {
                lastTapRef.current = now;
            }
        };

        document.addEventListener('touchstart', handleTouchStart, { passive: false });
        return () => document.removeEventListener('touchstart', handleTouchStart);
    }, [isTouchDevice]);

    const checkNearbyAnimals = useCallback((playerPosition, animals) => {
        if (!playerPosition || !animals.length) return null;
        const pos = playerPosition;
        let nearest = null;
        let nearestDistSq = Infinity;
        for (const animal of animals) {
            if (!animal.group) continue;
            const ap = animal.group.position;
            const dx = pos.x - ap.x;
            const dz = pos.z - ap.z;
            const distSq = dx * dx + dz * dz;
            if (distSq < 15 * 15 && distSq < nearestDistSq) {
                nearest = animal;
                nearestDistSq = distSq;
            }
        }
        return nearest;
    }, []);

    const checkNearbyStaff = useCallback((playerPosition, staffNpc) => {
        if (!playerPosition || !staffNpc) return false;
        const dx = playerPosition.x - staffNpc.x;
        const dz = playerPosition.z - staffNpc.z;
        const distSq = dx * dx + dz * dz;
        return distSq <= (staffNpc.interactionRadius * staffNpc.interactionRadius);
    }, []);

    const ambienceLoadingRef = useRef(false);

    const getAmbience = useCallback(() => {
        if (!ambienceRef.current) {
            const fallbackPath = '/audio/ambience.mp3';
            const audio = new Audio(fallbackPath);
            audio.loop = true;
            audio.preload = 'auto';
            audio.volume = 1.0;
            audio.setAttribute('playsinline', 'true');
            ambienceRef.current = audio;
            ambienceLoadingRef.current = true;

            resolveAssetUrl(fallbackPath)
                .then((assetUrl) => {
                    if (ambienceRef.current === audio && assetUrl) {
                        audio.src = assetUrl;
                    }
                    ambienceLoadingRef.current = false;
                })
                .catch(() => {
                    ambienceLoadingRef.current = false;
                });
        }
        return ambienceRef.current;
    }, []);

    const musicLoadingRef = useRef(false);
    const getMusic = useCallback(() => {
        if (!musicRef.current) {
            const fallbackPath = '/audio/game-bg-music.mp3';
            const audio = new Audio(fallbackPath);
            audio.loop = true;
            audio.preload = 'auto';
            audio.volume = 0.5; // BG music usually slightly quieter
            audio.setAttribute('playsinline', 'true');
            musicRef.current = audio;
            musicLoadingRef.current = true;

            resolveAssetUrl(fallbackPath)
                .then((assetUrl) => {
                    if (musicRef.current === audio && assetUrl) {
                        audio.src = assetUrl;
                    }
                    musicLoadingRef.current = false;
                })
                .catch(() => {
                    musicLoadingRef.current = false;
                });
        }
        return musicRef.current;
    }, []);

    const playAmbience = useCallback(async () => {
        const vol = getAmbienceVolume();
        const audio = getAmbience();
        if (!audio || (!audio.src && !audio.currentSrc)) return;
        audio.volume = vol;
        if (vol <= 0) {
            audio.pause();
            return;
        }
        if (!audio.paused) return;
        try {
            await audio.play();
        } catch {
            // Playback can fail before a user interaction
        }
    }, [getAmbience]);

    const playMusic = useCallback(async () => {
        const vol = getMusicVolume();
        const audio = getMusic();
        if (!audio || (!audio.src && !audio.currentSrc)) return;
        audio.volume = vol;
        if (vol <= 0) {
            audio.pause();
            return;
        }
        if (!audio.paused) return;
        try {
            await audio.play();
        } catch {
            // Playback can fail
        }
    }, [getMusic]);

    const stopAmbience = useCallback((keepPosition = true) => {
        const audio = ambienceRef.current;
        if (!audio) return;
        audio.pause();
        if (!keepPosition) {
            audio.currentTime = 0;
        }
    }, []);

    const stopMusic = useCallback((keepPosition = true) => {
        const audio = musicRef.current;
        if (!audio) return;
        audio.pause();
        if (!keepPosition) {
            audio.currentTime = 0;
        }
    }, []);

    const stopGameplaySounds = useCallback((keepMusicPosition = false) => {
        stopAmbience(keepMusicPosition);
        stopMusic(keepMusicPosition);
        const state = gameStateRef.current;
        state.animals.forEach((animal) => {
            animal.stopSound?.(true);
        });
    }, [stopAmbience, stopMusic]);

    useEffect(() => {
        cameraModeRef.current = cameraMode;
        const state = gameStateRef.current;
        state.currentCameraMode = cameraMode;
        cameraTransitionRef.current = { active: true, startedAt: performance.now() };
        if (state.playerCharacter) {
            state.playerCharacter.visible = cameraMode !== 'first';
        }
    }, [cameraMode]);

    const cycleCameraMode = useCallback(() => {
        setCameraMode((prev) => (prev === 'first' ? 'third' : 'first'));
    }, []);

    const playPlayerAction = useCallback((name, options = {}) => {
        const state = gameStateRef.current;
        const actions = state.playerActions || {};
        if (state.currentPlayerActionName === name) return;
        const actionKeys = Object.keys(actions);
        if (actionKeys.length === 0) return;

        let nextAction = actions[name];
        if (!nextAction) {
            const walkKeys = actionKeys.filter(k => k.includes('walk') || k.includes('jog') || k.includes('move') || k.includes('strafe'));
            const idleKeys = actionKeys.filter(k => k.includes('idle') || k.includes('stand') || k.includes('breath'));

            if (name === 'walk' && walkKeys.length > 0) nextAction = actions[walkKeys[0]];
            else if (name === 'idle' && idleKeys.length > 0) nextAction = actions[idleKeys[0]];
            else nextAction = actions[actionKeys[0]];
        }

        if (!nextAction || nextAction === state.currentPlayerAction) return;

        if (state.currentPlayerAction) {
            state.currentPlayerAction.fadeOut(0.24);
        }
        nextAction.reset();
        // eslint-disable-next-line react-hooks/immutability
        nextAction.enabled = true;
        nextAction.setEffectiveWeight(1);
        nextAction.fadeIn(0.24);
        const isVictory = name === 'victory' || options.loopOnce;
        nextAction.setLoop(isVictory ? THREE.LoopOnce : THREE.LoopRepeat, isVictory ? 1 : Infinity);
        nextAction.clampWhenFinished = isVictory;
        nextAction.play();
        state.currentPlayerAction = nextAction;
        state.currentPlayerActionName = name;
        state.playerVictoryUntil = isVictory
            ? performance.now() + Math.max(0.1, nextAction.getClip().duration) * 1000
            : 0;
    }, []);

    const playVictoryAnimation = useCallback(() => {
        const state = gameStateRef.current;
        if (state.playerActions?.victory) {
            playPlayerAction('victory', { loopOnce: true });
        }
    }, [playPlayerAction]);

    const handleRunInput = useCallback((running) => {
        gameStateRef.current.keys.shift = running;
    }, []);

    const clearFeedingTimer = useCallback(() => {
        const wasFeeding = Boolean(feedingInProgressRef.current);
        if (feedingTimerRef.current) {
            clearTimeout(feedingTimerRef.current);
            feedingTimerRef.current = null;
        }
        if (feedingFrameRef.current) cancelAnimationFrame(feedingFrameRef.current);
        feedingFrameRef.current = null;
        feedingStartedAtRef.current = 0;
        feedingInProgressRef.current = null;
        if (wasFeeding) setFeedingProgress(0);
        setIsFeeding(false);
    }, []);

    const beginFeed = useCallback((animal, info) => {
        const missionAnimal = getAnimalBookEntry(info?.name)?.name || info?.name;
        if (!animal || !missionAnimal || feedingInProgressRef.current || !gameStartedRef.current || isAnimalFed(missionAnimal)) return;
        if (info.requiredItem && info.hasRequiredItem === false) return;

        feedingInProgressRef.current = missionAnimal;
        feedingStartedAtRef.current = performance.now();
        setIsFeeding(true);
        setFeedingProgress(0);
        const updateProgress = (now) => {
            if (feedingInProgressRef.current !== missionAnimal) return;
            const progress = Math.min(1, (now - feedingStartedAtRef.current) / 1500);
            setFeedingProgress(progress);
            if (progress < 1) {
                feedingFrameRef.current = requestAnimationFrame(updateProgress);
            }
        };
        feedingFrameRef.current = requestAnimationFrame(updateProgress);
        feedingTimerRef.current = setTimeout(() => {
            feedingTimerRef.current = null;
            if (!gameStartedRef.current || feedingInProgressRef.current !== missionAnimal) return;

            if (getSfxVolume() > 0) {
                animal.playSound?.();
            }
            playGameButtonSfx('feed');
            markAnimalDiscovered(missionAnimal);
            feedAnimal(missionAnimal);
            let nextMission = missionAnimal === 'Domestic Horse'
                ? saveMissionProgress({ fedHorse: true })
                : missionAnimal === 'Rabbit'
                    ? saveMissionProgress({ fedRabbit: true })
                    : getMissionProgress();
            if (nextMission.talkedToRanger && nextMission.fedHorse && nextMission.fedRabbit && !nextMission.rewardClaimed) {
                nextMission = saveMissionProgress({ rewardClaimed: true });
            }
            missionProgressRef.current = nextMission;
            setMissionProgress(nextMission);
            setTasks(getTasks());
            setFeedingSuccess({ visible: true, animalName: missionAnimal });
            playVictoryAnimation();
            animal.playAnimation?.('eat', { loopOnce: true });
            feedingInProgressRef.current = null;
            setIsFeeding(false);
            setFeedingProgress(1);
        }, 1500);
    }, [playVictoryAnimation]);

    const disposePlayerCharacter = useCallback(() => {
        const state = gameStateRef.current;
        if (state.playerMixer) {
            state.playerMixer.stopAllAction();
            state.playerMixer = null;
        }
        state.playerActions = {};
        state.currentPlayerAction = null;
        state.currentPlayerActionName = null;
        state.playerVictoryUntil = 0;
        if (state.playerShadow) {
            state.playerShadow.parent?.remove(state.playerShadow);
            state.playerShadow.geometry?.dispose();
            state.playerShadow.material?.dispose?.();
            state.playerShadow = null;
        }
        if (!state.playerCharacter) return;

        const model = state.playerCharacter;
        if (state.scene) {
            state.scene.remove(model);
        }
        model.traverse((child) => {
            if (!child.isMesh) return;
            child.geometry?.dispose();
            if (Array.isArray(child.material)) {
                child.material.forEach((m) => m?.dispose?.());
            } else {
                child.material?.dispose?.();
            }
        });
        state.playerCharacter = null;
    }, []);

    const handleSelectCharacter = useCallback(async (characterOption) => {
        const state = gameStateRef.current;
        if (!state.scene || !state.playerAnchor) return;

        state.controlsEnabled = false;
        setCharacterReady(false);

        try {
            disposePlayerCharacter();

            const loader = createGLTFLoader();
            const characterUrl = await resolveAssetUrl(`/models/characters/${characterOption.file}`);
            const gltf = await new Promise((resolve, reject) => {
                loader.load(characterUrl, resolve, undefined, reject);
            });

            const model = gltf.scene;
            applyHumanSkinColor(model);
            model.traverse((child) => {
                if (!child.isMesh) return;
                child.castShadow = false;
                child.receiveShadow = false;
                if (child.material) {
                    child.material.side = THREE.FrontSide;
                }
            });

            const baseBox = new THREE.Box3().setFromObject(model);
            const baseSize = new THREE.Vector3();
            baseBox.getSize(baseSize);
            const sourceHeight = Math.max(baseSize.y, 0.001);
            const targetHeight = PLAYER_CHARACTER_TARGET_HEIGHT;
            const fitScale = THREE.MathUtils.clamp(targetHeight / sourceHeight, 0.02, 5);
            model.scale.multiplyScalar(fitScale);

            const fittedBox = new THREE.Box3().setFromObject(model);
            state.playerCharacterBaseYOffset = -fittedBox.min.y;

            state.scene.add(model);
            state.playerCharacter = model;
            state.playerShadow = createContactShadow(2.2, 0.25);
            state.scene.add(state.playerShadow);

            if (gltf.animations && gltf.animations.length > 0) {
                const mixer = new THREE.AnimationMixer(model);
                state.playerMixer = mixer;
                state.playerActions = {};

                gltf.animations.forEach((clip) => {
                    const action = mixer.clipAction(clip);
                    action.enabled = true;
                    action.setEffectiveWeight(1);
                    state.playerActions[clip.name.toLowerCase()] = action;
                });

                state.currentPlayerAction = null;
                playPlayerAction('idle');
            }

            model.visible = cameraModeRef.current !== 'first';
            setSelectedCharacterId(characterOption.id);
            saveStoredCharacterId(characterOption.id);
            setCharacterReady(true);
            state.controlsEnabled = false;
        } catch (error) {
            console.error('Failed to load selected character:', error);
            state.controlsEnabled = false;
            setCharacterReady(false);
        }
    }, [disposePlayerCharacter, playPlayerAction]);

    const initGame = useCallback(async () => {
        const state = gameStateRef.current;
        if (state.initialized) return;

        const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

        try {
            const settings = getSettings();
            const quality = settings.graphicsQuality || 'medium';
            graphicsQualityRef.current = quality;

            const scene = createScene(quality); state.scene = scene;
            const camera = createCamera(); state.camera = camera;
            const renderer = createRenderer(containerRef.current, quality); state.renderer = renderer;

            createLighting(scene);
            createTerrain(scene);
            createFence(scene, quality);
            createTigerEnclosure(scene, quality);
            state.river = createRiver(scene, getTerrainHeight, quality);
            addStatueLights(scene);
            setLoadProgress(15);

            const statuePromise = loadCenterStatue(scene, isMobile);
            const staffPromise = loadStaffNpc(scene, isMobile);
            const housesPromise = loadNewHouses(scene);
            const birdsPromise = loadAmbientBirds(scene);

            const { loadPromise: treesP } = loadTrees(scene, isMobile ? 'mobile' : quality);
            const { loadPromise: bushesP } = loadBushes(scene, isMobile ? 40 : 70);
            const { loadPromise: rocksP } = loadRocks(scene, isMobile ? 20 : 40);

            setLoadProgress(30);
            // Wait for all objects to load, and extract the resulting arrays!
            const [loadedTrees, loadedBushes, loadedRocks, statueResult, staffResult, housesResult, loadedBirds] = await Promise.all([
                treesP,
                bushesP,
                rocksP,
                statuePromise,
                staffPromise,
                housesPromise,
                birdsPromise
            ]);
            state.ambientBirds = loadedBirds;

            // Create collision obstacles based on the loaded meshes
            state.obstacles = [];
            // Boundary trees stay outside PLAYABLE_BOUNDARY, so only interior
            // trees need gameplay collision checks.
            loadedTrees.filter(tree => !tree.outer).forEach(t => state.obstacles.push({ x: t.x, z: t.z, radius: t.radius }));
            loadedRocks.forEach(r => state.obstacles.push({ x: r.position.x, z: r.position.z, radius: r.scale.x * 1.1 }));
            loadedBushes.forEach(b => state.obstacles.push({ x: b.position.x, z: b.position.z, radius: b.scale.x * 0.6 }));

            if (housesResult) {
                housesResult.forEach(house => {
                    state.obstacles.push({
                        x: house.x,
                        z: house.z,
                        radius: house.radius
                    });
                });
            }

            if (statueResult) {
                state.obstacles.push({
                    x: STATUE_CENTER.x,
                    z: STATUE_CENTER.z,
                    radius: statueResult.collisionRadius
                });
            }
            if (staffResult) {
                state.staffNpc = staffResult;
                state.obstacles.push({
                    x: staffResult.x,
                    z: staffResult.z,
                    radius: staffResult.obstacleRadius
                });
            }

            const session = getPlayerSession();
            const resumePosition = session.position;
            const hasResumePosition = !!resumePosition;

            const spawnLimit = PLAYABLE_BOUNDARY - 1.5;
            const requestedSpawnX = THREE.MathUtils.clamp(
                hasResumePosition ? resumePosition.x : (STATUE_CENTER.x + PLAYER_START_OFFSET.x),
                -spawnLimit,
                spawnLimit
            );
            const requestedSpawnZ = THREE.MathUtils.clamp(
                hasResumePosition ? resumePosition.z : (STATUE_CENTER.z + PLAYER_START_OFFSET.z),
                -spawnLimit,
                spawnLimit
            );
            const safeSpawn = findAccessiblePosition(requestedSpawnX, requestedSpawnZ, 1.5);
            const spawnX = safeSpawn.x;
            const spawnZ = safeSpawn.z;
            const terrainY = getTerrainHeight(spawnX, spawnZ) + PLAYER_HEIGHT;
            const spawnY = hasResumePosition ? Math.max(resumePosition.y, terrainY) : terrainY;

            camera.position.set(spawnX, spawnY, spawnZ);

            const yawToCenter = Math.atan2(-(STATUE_CENTER.x - spawnX), -(STATUE_CENTER.z - spawnZ));
            const yaw = hasResumePosition ? session.yaw : yawToCenter;
            const pitch = hasResumePosition ? session.pitch : 0;

            state.yaw = yaw;
            state.pitch = pitch;
            camera.rotation.set(pitch, yaw, 0, 'YXZ');
            state.playerAnchor = new THREE.Object3D();
            state.playerAnchor.position.copy(camera.position);
            state.playerAnchor.rotation.copy(camera.rotation);
            state.currentCameraMode = cameraModeRef.current;
            state.controlsEnabled = false;

            await createGrass(scene, isMobile ? 260 : 900);
            setLoadProgress(55);

            const initialSfxVolume = getSfxVolume();
            // Pass the obstacles and initial volume to the animals
            state.animals = await loadGLTFAnimals(scene, state.obstacles, initialSfxVolume);
            setLoadProgress(80);

            state.clouds = createClouds(scene, isMobile ? 12 : 18);
            setLoadProgress(95);

            const handleMovement = createMovementHandler(state.playerAnchor, state);
            const desiredCameraPosition = new THREE.Vector3();
            const firstPersonCameraPosition = new THREE.Vector3();
            const lookTarget = new THREE.Vector3();
            const targetCameraQuaternion = new THREE.Quaternion();
            const previousCameraQuaternion = new THREE.Quaternion();
            const targetCameraEuler = new THREE.Euler(0, 0, 0, 'YXZ');
            let smoothedFollowY = camera.position.y;

            let lastRenderTime = performance.now();
            let nearbyTimer = 0;
            let ambientSoundTimer = 0;
            let statueCheckTimer = 0;
            let staffCheckTimer = 0;
            const nearbyInterval = isMobile ? 0.3 : 0.2;

            const animate = () => {
                state.animationId = requestAnimationFrame(animate);
                const now = performance.now();

                // FPS limiting
                const fpsLimit = fpsLimitRef.current || 60;
                const fpsInterval = 1000 / fpsLimit;
                const timeSinceLastRender = now - lastRenderTime;
                if (timeSinceLastRender < fpsInterval) {
                    return;
                }

                const dt = Math.min(timeSinceLastRender * 0.001, 0.1);
                lastRenderTime = now - (timeSinceLastRender % fpsInterval);

                // Reduce CPU usage while hidden.
                if (document.hidden) {
                    return;
                }

                // Reuse the obstacle objects instead of allocating an array and
                // object for every rendered frame.
                const animalObstacles = state.animalObstacles;
                const obstaclePool = state.animalObstaclePool;
                let obstacleCount = 0;
                state.animals.forEach((animal) => {
                    if (!animal?.group) return;
                    const obstacle = obstaclePool[obstacleCount] || (obstaclePool[obstacleCount] = {});
                    obstacle.x = animal.group.position.x;
                    obstacle.z = animal.group.position.z;
                    obstacle.radius = Math.max(1.15, animal.radius ?? animal.config?.collisionRadius ?? ((animal.config?.scale ?? 1) * 0.7));
                    animalObstacles[obstacleCount] = obstacle;
                    obstacleCount += 1;
                });
                if (state.staffNpc) {
                    const obstacle = obstaclePool[obstacleCount] || (obstaclePool[obstacleCount] = {});
                    obstacle.x = state.staffNpc.x;
                    obstacle.z = state.staffNpc.z;
                    obstacle.radius = state.staffNpc.obstacleRadius;
                    animalObstacles[obstacleCount] = obstacle;
                    obstacleCount += 1;
                }
                animalObstacles.length = obstacleCount;

                handleMovement();
                const playerPosition = state.playerAnchor ? state.playerAnchor.position : camera.position;

                if (state.playerCharacter) {
                    const characterGround = getTerrainHeight(playerPosition.x, playerPosition.z);
                    const jumpOffset = Math.max(
                        0,
                        playerPosition.y - (characterGround + (state.playerHeight ?? PLAYER_HEIGHT))
                    );
                    state.playerCharacter.position.set(
                        playerPosition.x,
                        characterGround + state.playerCharacterBaseYOffset + jumpOffset,
                        playerPosition.z
                    );
                    state.playerCharacterBox.setFromObject(state.playerCharacter);
                    const characterGroundingDelta = (characterGround + 0.02 + jumpOffset) - state.playerCharacterBox.min.y;
                    state.playerCharacter.position.y += characterGroundingDelta;
                    // Keep movement unchanged while showing the character's back in third person.
                    const desiredCharacterYaw = state.yaw + (cameraModeRef.current === 'third' ? Math.PI : 0);
                    const currentY = state.playerCharacter.rotation.y;
                    const angleDelta = Math.atan2(Math.sin(desiredCharacterYaw - currentY), Math.cos(desiredCharacterYaw - currentY));
                    state.playerCharacter.rotation.y += angleDelta * Math.min(1, dt * 10);

                    if (state.playerShadow) {
                        state.playerShadow.position.set(playerPosition.x, characterGround + 0.055, playerPosition.z);
                        state.playerShadow.visible = cameraModeRef.current === 'third';
                        const shadowOpacity = THREE.MathUtils.clamp(0.25 - jumpOffset * 0.1, 0.1, 0.25);
                        state.playerShadow.material.opacity = shadowOpacity;
                    }
                }

                if (state.playerMixer) {
                    const victoryPlaying = state.playerVictoryUntil > now;
                    if (!victoryPlaying) {
                        if (!state.playerIsMoving) {
                            playPlayerAction('idle');
                        } else if (state.playerIsRunning) {
                            playPlayerAction('run');
                        } else {
                            playPlayerAction('walk');
                        }
                    }
                    state.playerMixer.update(dt);
                }

                if (state.staffNpc?.mixer) {
                    state.staffNpc.mixer.update(dt);
                }

                if (state.staffNpc?.model) {
                    const npc = state.staffNpc;
                    const nowSeconds = now * 0.001;
                    const canMove = !showNpcDialogueRef.current;
                    const shouldPause = nowSeconds < npc.pauseUntil;

                    if (!canMove) {
                        npc.pauseUntil = nowSeconds + 0.2;
                        npc.moving = false;
                        setStaffNpcAction(npc, 'idle');
                    } else if (shouldPause) {
                        npc.moving = false;
                        setStaffNpcAction(npc, 'idle');
                    } else {
                        const dx = npc.targetX - npc.x;
                        const dz = npc.targetZ - npc.z;
                        const dist = Math.sqrt(dx * dx + dz * dz);

                        if (dist <= npc.stopDistance) {
                            npc.pauseUntil = nowSeconds + THREE.MathUtils.lerp(0.9, 2.2, Math.random());
                            const nextTarget = chooseNextStaffPatrolTarget(npc.homeX, npc.homeZ);
                            npc.targetX = nextTarget.x;
                            npc.targetZ = nextTarget.z;
                            npc.moving = false;
                            setStaffNpcAction(npc, 'idle');
                        } else {
                            npc.moving = true;
                            setStaffNpcAction(npc, 'walk');

                            const nx = dx / dist;
                            const nz = dz / dist;
                            const step = Math.min(dist, npc.moveSpeed * dt);
                            npc.x += nx * step;
                            npc.z += nz * step;
                            if (Math.abs(npc.x) > PLAYABLE_BOUNDARY - npc.obstacleRadius
                                || Math.abs(npc.z) > PLAYABLE_BOUNDARY - npc.obstacleRadius
                                || !isLandAccessible(npc.x, npc.z, npc.obstacleRadius)) {
                                npc.x -= nx * step;
                                npc.z -= nz * step;
                                const nextTarget = chooseNextStaffPatrolTarget(npc.homeX, npc.homeZ);
                                npc.targetX = nextTarget.x;
                                npc.targetZ = nextTarget.z;
                            }

                            const desiredYaw = Math.atan2(-nx, -nz) + npc.facingOffset;
                            const currentYaw = npc.model.rotation.y;
                            const yawDelta = Math.atan2(Math.sin(desiredYaw - currentYaw), Math.cos(desiredYaw - currentYaw));
                            npc.model.rotation.y += yawDelta * Math.min(1, npc.turnSpeed * dt);
                        }
                    }

                    const npcGround = getTerrainHeight(npc.x, npc.z);
                    npc.model.position.set(npc.x, npcGround + npc.baseYOffset, npc.z);
                    npc.shadow?.position.set(npc.x, npcGround + 0.055, npc.z);
                }

                const targetFov = cameraModeRef.current === 'first' ? FIRST_PERSON_FOV : THIRD_PERSON_FOV;
                if (Math.abs(camera.fov - targetFov) > 0.05) {
                    camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 10);
                    camera.updateProjectionMatrix();
                }

                const cameraTransition = cameraTransitionRef.current;
                const cameraTransitionProgress = cameraTransition.active
                    ? Math.min(1, (now - cameraTransition.startedAt) / 650)
                    : 1;
                const cameraTransitionBlend = cameraTransitionProgress < 0.5
                    ? 4 * cameraTransitionProgress ** 3
                    : 1 - ((-2 * cameraTransitionProgress + 2) ** 3) / 2;

                if (cameraModeRef.current === 'third' && state.playerAnchor) {
                    const followDistance = isMobile ? 5.6 : 7.0;
                    const followHeight = isMobile ? 3.0 : 3.5;
                    const pitchLift = Math.sin(-state.pitch) * 1.3;
                    const followYBlend = 1 - Math.exp(-10 * dt);
                    smoothedFollowY += (playerPosition.y - smoothedFollowY) * followYBlend;

                    desiredCameraPosition.set(
                        playerPosition.x + Math.sin(state.yaw) * followDistance,
                        smoothedFollowY + followHeight + pitchLift,
                        playerPosition.z + Math.cos(state.yaw) * followDistance
                    );

                    const minCameraY = getTerrainHeight(desiredCameraPosition.x, desiredCameraPosition.z) + 1.4;
                    desiredCameraPosition.y = Math.max(desiredCameraPosition.y, minCameraY);

                    const cameraLerp = 1 - Math.exp(-8 * dt);
                    camera.position.lerp(desiredCameraPosition, cameraLerp);
                    lookTarget.set(playerPosition.x, smoothedFollowY + 2.1, playerPosition.z);
                    previousCameraQuaternion.copy(camera.quaternion);
                    camera.lookAt(lookTarget);
                    if (cameraTransition.active) {
                        targetCameraQuaternion.copy(camera.quaternion);
                        camera.quaternion.copy(previousCameraQuaternion).slerp(targetCameraQuaternion, cameraTransitionBlend);
                    }
                } else if (state.playerAnchor) {
                    const minEyeY = getTerrainHeight(playerPosition.x, playerPosition.z)
                        + (state.playerHeight ?? PLAYER_HEIGHT)
                        + FIRST_PERSON_EYE_OFFSET;
                    firstPersonCameraPosition.set(
                        playerPosition.x,
                        Math.max(playerPosition.y + FIRST_PERSON_EYE_OFFSET, minEyeY),
                        playerPosition.z
                    );
                    targetCameraEuler.set(state.pitch, state.yaw, 0, 'YXZ');
                    targetCameraQuaternion.setFromEuler(targetCameraEuler);
                    if (cameraTransition.active) {
                        camera.position.lerp(firstPersonCameraPosition, 1 - Math.exp(-7 * dt));
                        camera.quaternion.slerp(targetCameraQuaternion, cameraTransitionBlend);
                    } else {
                        camera.position.copy(firstPersonCameraPosition);
                        camera.quaternion.copy(targetCameraQuaternion);
                    }
                }

                if (cameraTransition.active && cameraTransitionProgress >= 1) {
                    cameraTransition.active = false;
                }

                state.animals.forEach(a => {
                    if (a.group) {
                        const dx = playerPosition.x - a.group.position.x;
                        const dy = playerPosition.y - a.group.position.y;
                        const dz = playerPosition.z - a.group.position.z;
                        const distSq = dx * dx + dy * dy + dz * dz;
                        const updateRange = isMobile ? 130 : 200;
                        if (distSq < updateRange * updateRange) a.update(now * 0.001, dt);
                    }
                });
                state.ambientBirds.forEach((bird) => bird.update(now * 0.001, dt));

                // World animation continues while input is locked by the book overlay.
                updateRiver(state.river, dt, gameStartedRef.current);

                state.clouds.forEach(c => {
                    c.position.x += 0.02 * dt * 60;
                    if (c.position.x > 400) c.position.x = -400;
                });

                ambientSoundTimer += dt;
                if (ambientSoundTimer >= 0.35) {
                    ambientSoundTimer = 0;
                    if (gameStartedRef.current) {
                        const nowSeconds = now * 0.001;
                        const soundEnabled = soundEnabledRef.current;
                        state.animals.forEach((animal) => {
                            animal.maybePlayAmbientSound?.(nowSeconds, playerPosition, soundEnabled);
                        });
                    } else {
                        state.animals.forEach((animal) => {
                            animal.stopSound?.(true);
                        });
                    }
                }

                statueCheckTimer += dt;
                if (statueCheckTimer >= 0.2) {
                    statueCheckTimer = 0;
                    const dx = playerPosition.x - STATUE_CENTER.x;
                    const dz = playerPosition.z - STATUE_CENTER.z;
                    const nearStatue = (dx * dx + dz * dz) <= (26 * 26);

                    if (nearStatue && !isNearStatueRef.current) {
                        isNearStatueRef.current = true;
                        if (!hasShownStatueEntryRef.current) {
                            hasShownStatueEntryRef.current = true;
                        }
                    } else if (!nearStatue && isNearStatueRef.current) {
                        isNearStatueRef.current = false;
                    }
                }

                nearbyTimer += dt;
                if (nearbyTimer > nearbyInterval) {
                    nearbyTimer = 0;
                    const nextNearbyAnimal = checkNearbyAnimals(playerPosition, state.animals);
                    if (nextNearbyAnimal !== nearbyAnimalRef.current) {
                        nearbyAnimalRef.current = nextNearbyAnimal;
                        clearFeedingTimer();
                        if (nextNearbyAnimal) {
                            const info = nextNearbyAnimal.getInfo ? nextNearbyAnimal.getInfo() : nextNearbyAnimal.config;
                            if (info?.name) {
                                const discoveredName = getAnimalBookEntry(info.name)?.name || info.name;
                                const progress = markAnimalDiscovered(discoveredName);
                                setDiscoveredAnimals([...new Set(progress.animalsDiscovered.map((name) => getAnimalBookEntry(name)?.name || name))]);
                            }
                        }
                        setNearbyAnimal(nextNearbyAnimal);
                    }
                }

                staffCheckTimer += dt;
                if (staffCheckTimer >= 0.2) {
                    staffCheckTimer = 0;
                    const nextNearbyStaff = checkNearbyStaff(playerPosition, state.staffNpc);
                    if (nextNearbyStaff !== nearbyStaffRef.current) {
                        nearbyStaffRef.current = nextNearbyStaff;
                        setNearbyStaff(nextNearbyStaff);
                    }
                }

                renderer.render(scene, camera);
            };
            animate();

            setLoadProgress(100);

            const handleResize = () => {
                camera.aspect = window.innerWidth / window.innerHeight;
                camera.updateProjectionMatrix();
                renderer.setSize(window.innerWidth, window.innerHeight);
            };
            window.addEventListener('resize', handleResize);

            const cleanupKeyboard = setupKeyboardControls(state);
            const cleanupTouch = setupTouchControls(state, baseRef, stickRef, jumpRef);
            const cleanupMouse = setupMouseControls(state);

            state.cleanup = () => {
                state.initialized = false;
                if (state.animationId) cancelAnimationFrame(state.animationId);
                window.removeEventListener('resize', handleResize);
                cleanupKeyboard();
                cleanupTouch();
                cleanupMouse();
                state.animals.forEach(a => a.dispose?.());
                disposePlayerCharacter();
                if (state.staffNpc) {
                    state.staffNpc.shadow?.parent?.remove(state.staffNpc.shadow);
                    state.staffNpc.shadow?.geometry?.dispose?.();
                    state.staffNpc.shadow?.material?.dispose?.();
                    if (state.staffNpc.mixer) {
                        state.staffNpc.mixer.stopAllAction();
                    }
                    state.staffNpc.model?.traverse((child) => {
                        if (!child.isMesh) return;
                        child.geometry?.dispose?.();
                        if (Array.isArray(child.material)) {
                            child.material.forEach((m) => m?.dispose?.());
                        } else {
                            child.material?.dispose?.();
                        }
                    });
                    state.scene?.remove(state.staffNpc.model);
                    state.staffNpc = null;
                }
                if (renderer) {
                    const disposedGeometries = new Set();
                    const disposedMaterials = new Set();
                    state.scene?.traverse((child) => {
                        if (!child.isMesh) return;
                        if (child.geometry && !disposedGeometries.has(child.geometry)) {
                            disposedGeometries.add(child.geometry);
                            child.geometry.dispose();
                        }
                        const materials = Array.isArray(child.material) ? child.material : [child.material];
                        materials.forEach((material) => {
                            if (!material || disposedMaterials.has(material)) return;
                            disposedMaterials.add(material);
                            material.dispose();
                        });
                    });
                    releaseAnimalModelCache();
                    releaseTerrainModelCache();
                    disposeRiver(state.river);
                    state.river = null;
                    renderer.dispose();
                    if (containerRef.current && renderer.domElement) {
                        containerRef.current.removeChild(renderer.domElement);
                    }
                }
            };

            state.initialized = true;
            setIsLoading(false);
        } catch (err) {
            console.error('Game init failed:', err);
            setIsLoading(false);
        }
    }, [checkNearbyAnimals, checkNearbyStaff, clearFeedingTimer, disposePlayerCharacter, playPlayerAction]);

    const handleCharacterPicked = useCallback((characterOption) => {
        setSelectedCharacterId(characterOption.id);
        saveStoredCharacterId(characterOption.id);
    }, []);

    const handleStartGame = useCallback(() => {
        const state = gameStateRef.current;
        const session = getPlayerSession();
        const storedCharacterId = getStoredCharacterId();
        const storedCharacterOption = storedCharacterId
            ? CHARACTER_OPTIONS.find((option) => option.id === storedCharacterId)
            : null;

        gameStartedRef.current = true;
        nearbyAnimalRef.current = null;
        nearbyStaffRef.current = false;
        soundEnabledRef.current = getSfxVolume() > 0;
        setPlayerName(getStoredPlayerName());
        setShowMenu(false);
        setGameStarted(true);
        setTasks(getTasks());
        // Third person is the default exploration view.
        setCameraMode('third');
        setSelectedCharacterId(storedCharacterOption?.id || null);
        setCharacterReady(false);
        setNearbyStaff(false);
        setShowNpcDialogue(false);
        setNpcDialogueNodeId('root');
        state.controlsEnabled = false;

        if (storedCharacterOption) {
            // Auto-restore the previously selected character so replay starts immediately.
            setTimeout(() => {
                if (gameStartedRef.current) {
                    handleSelectCharacter(storedCharacterOption);
                }
            }, 0);
        } else {
            // Auto-select the first character as default so controls get enabled
            const defaultOption = CHARACTER_OPTIONS[0];
            if (defaultOption) {
                setTimeout(() => {
                    if (gameStartedRef.current) {
                        handleSelectCharacter(defaultOption);
                    }
                }, 0);
            }
        }

        playAmbience();
        playMusic();
        setTimeout(() => {
            if (gameStartedRef.current) {
                playAmbience();
                playMusic();
            }
        }, 220);
    }, [playAmbience, playMusic, handleSelectCharacter]);

    const saveSessionSnapshot = useCallback(() => {
        const state = gameStateRef.current;
        if (!state?.playerAnchor) return;
        const position = state.playerAnchor.position;

        savePlayerSession({
            position: { x: position.x, y: position.y, z: position.z },
            yaw: state.yaw,
            pitch: state.pitch,
            cameraMode: cameraModeRef.current,
            characterId: getStoredCharacterId()
        });
    }, []);
    const closeInterfaces = useCallback(() => {
        setSettingsOpen(false);
        setTasksOpen(false);
        setShowNpcDialogue(false);
        setBookOpen(false);
        setPhotoPreview('');
        clearFeedingTimer();
    }, [clearFeedingTimer]);
    const handleMenuClick = useCallback(() => { closeInterfaces(); setSettingsOpen(true); }, [closeInterfaces]);
    const handleTasksClick = useCallback(() => { closeInterfaces(); setTasksOpen(true); }, [closeInterfaces]);
    const captureScene = useCallback(() => {
        const state = gameStateRef.current;
        if (!state.renderer || !state.scene || !state.camera) return;
        try {
            const renderer = state.renderer;
            const width = renderer.domElement.width;
            const height = renderer.domElement.height;
            const target = new THREE.WebGLRenderTarget(width, height, { depthBuffer: true });
            renderer.setRenderTarget(target);
            renderer.render(state.scene, state.camera);
            const pixels = new Uint8Array(width * height * 4);
            renderer.readRenderTargetPixels(target, 0, 0, width, height, pixels);
            renderer.setRenderTarget(null);
            renderer.render(state.scene, state.camera);
            target.dispose();
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const context = canvas.getContext('2d');
            const image = context.createImageData(width, height);
            for (let row = 0; row < height; row += 1) {
                const source = (height - row - 1) * width * 4;
                image.data.set(pixels.subarray(source, source + width * 4), row * width * 4);
            }
            context.putImageData(image, 0, 0);
            setCameraFlash(true);
            window.setTimeout(() => setCameraFlash(false), 180);
            playGameButtonSfx('confirm');
            closeInterfaces();
            setPhotoPreview(canvas.toDataURL('image/png'));
        } catch (error) {
            console.error('Unable to capture game scene:', error);
            closeInterfaces();
        }
    }, [closeInterfaces]);
    const savePhoto = useCallback(() => {
        if (!photoPreview) return;
        const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const link = document.createElement('a');
        link.href = photoPreview;
        link.download = `bulusan-zoo-adventure-${stamp}.png`;
        link.click();
    }, [photoPreview]);
    const handleResetTasks = useCallback(() => {
        setShowResetTasksModal(true);
    }, []);
    const handleConfirmResetTasks = useCallback(() => {
        setShowResetTasksModal(false);
        clearFeedingTimer();
        resetAllFeedingTasks();
        setTasks(getTasks());
        allFedCelebratedRef.current = false;
        setShowAllFedCelebration(false);
        setShowCertificate(false);
        setFeedingSuccess({ visible: false, animalName: '' });
    }, [clearFeedingTimer]);
    const handleCancelResetTasks = useCallback(() => setShowResetTasksModal(false), []);
    const handleQuitRequest = useCallback(() => { setSettingsOpen(false); setShowQuitModal(true); }, []);
    const handleConfirmQuit = useCallback(() => {
        // Stop sounds
        stopGameplaySounds(false);
        clearFeedingTimer();

        // State cleanup - This will return the user to the Main Menu
        gameStartedRef.current = false;
        soundEnabledRef.current = false;
        hasShownStatueEntryRef.current = false;
        setShowQuitModal(false);
        setShowResetTasksModal(false);
        setSettingsOpen(false);
        setTasksOpen(false);
         setNearbyAnimal(null);
        setPhotoPreview('');
        setSelectedCharacterId(null);
        setCharacterReady(false);
         setCameraMode('third');
        setShowAllFedCelebration(false);
        setShowCertificate(false);
        setNearbyStaff(false);
        setShowNpcDialogue(false);
        setNpcDialogueNodeId('root');
        setBookOpen(false);
        setGameStarted(false);
        setShowMenu(true);
    }, [clearFeedingTimer, stopGameplaySounds]);
    const handleCancelQuit = useCallback(() => setShowQuitModal(false), []);

    const handleFeedAnimal = useCallback(() => {
        if (!nearbyAnimal) return;
        const info = nearbyAnimal.getInfo ? nearbyAnimal.getInfo() : nearbyAnimal.config;
        beginFeed(nearbyAnimal, info);
    }, [nearbyAnimal, beginFeed]);

    const handleHideFeedSuccess = useCallback(() => setFeedingSuccess({ visible: false, animalName: '' }), []);

    const openNpcDialogue = useCallback(() => {
        if (!nearbyStaff || !gameStarted || !characterReady) return;
        closeInterfaces();
        const state = gameStateRef.current;
        state.controlsEnabled = false;
        state.mX = 0;
        state.mY = 0;
        state.keys.w = false;
        state.keys.a = false;
        state.keys.s = false;
        state.keys.d = false;
        state.keys.shift = false;
        setNpcDialogueNodeId('root');
        setShowNpcDialogue(true);
        const nextMission = saveMissionProgress({ talkedToRanger: true });
        missionProgressRef.current = nextMission;
        setMissionProgress(nextMission);
    }, [closeInterfaces, nearbyStaff, gameStarted, characterReady]);

    const closeNpcDialogue = useCallback(() => {
        setShowNpcDialogue(false);
        const state = gameStateRef.current;
        if (gameStarted && characterReady) {
            state.controlsEnabled = true;
        }
    }, [gameStarted, characterReady]);

    const handleNpcChoice = useCallback((choice) => {
        if (!choice) return;
        if (choice.close) {
            closeNpcDialogue();
            return;
        }
        setNpcDialogueNodeId(choice.nextId || 'root');
    }, [closeNpcDialogue]);

    const openBook = useCallback(() => {
        if (!gameStarted || !characterReady) return;
        closeInterfaces();
        setCameraMode('first');
        const state = gameStateRef.current;
        state.controlsEnabled = false;
        state.mX = 0;
        state.mY = 0;
        state.keys.w = false;
        state.keys.a = false;
        state.keys.s = false;
        state.keys.d = false;
        state.keys.shift = false;
        setBookOpen(true);
    }, [closeInterfaces, gameStarted, characterReady]);

    const closeBook = useCallback(() => {
        setBookOpen(false);
        setCameraMode('third');
        const state = gameStateRef.current;
        if (gameStarted && characterReady) {
            state.controlsEnabled = true;
        }
    }, [gameStarted, characterReady]);

    useEffect(() => {
        bookOpenRef.current = bookOpen;
    }, [bookOpen]);

    useEffect(() => {
        const onKey = e => {
            const key = e.key.toLowerCase();
            if (bookOpen) return;
            if ((key === 't' || key === 'e') && nearbyStaff && gameStarted && characterReady && !showNpcDialogue) {
                openNpcDialogue();
            }
            if (key === 'f' && nearbyAnimal && gameStarted && characterReady && !settingsOpen && !tasksOpen && !showNpcDialogue) {
                const info = nearbyAnimal.getInfo ? nearbyAnimal.getInfo() : nearbyAnimal.config;
                beginFeed(nearbyAnimal, info);
            }
            if (key === 'v' && gameStarted && characterReady) {
                cycleCameraMode();
            }
            if (key === 'escape') {
                if (showNpcDialogue) {
                    closeNpcDialogue();
                    return;
                }
                if (settingsOpen) setSettingsOpen(false);
                else if (tasksOpen) setTasksOpen(false);
            }
        };
        document.addEventListener('keydown', onKey);
        const onKeyUp = e => { if (e.key.toLowerCase() === 'f') clearFeedingTimer(); };
        document.addEventListener('keyup', onKeyUp);
        return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('keyup', onKeyUp); };
    }, [nearbyAnimal, nearbyStaff, showNpcDialogue, gameStarted, settingsOpen, tasksOpen, characterReady, cycleCameraMode, openNpcDialogue, closeNpcDialogue, bookOpen, beginFeed, clearFeedingTimer]);

    useEffect(() => {
        gameStartedRef.current = gameStarted;
    }, [gameStarted]);

    useEffect(() => {
        if (!gameStarted) return;

        const intervalId = window.setInterval(() => {
            saveSessionSnapshot();
        }, 2500);

        const onVisibilityChange = () => {
            if (document.hidden) {
                saveSessionSnapshot();
            }
        };

        const onBeforeUnload = () => {
            saveSessionSnapshot();
        };

        document.addEventListener('visibilitychange', onVisibilityChange);
        window.addEventListener('beforeunload', onBeforeUnload);

        return () => {
            clearInterval(intervalId);
            document.removeEventListener('visibilitychange', onVisibilityChange);
            window.removeEventListener('beforeunload', onBeforeUnload);
        };
    }, [gameStarted, saveSessionSnapshot]);

    useEffect(() => {
        const syncPlayerName = () => setPlayerName(getStoredPlayerName());

        const onStorage = (event) => {
            if (!event || event.key === PLAYER_NAME_KEY || event.key === null) {
                syncPlayerName();
            }
        };

        syncPlayerName();
        window.addEventListener('storage', onStorage);
        window.addEventListener('minizoo-player-name-changed', syncPlayerName);

        return () => {
            window.removeEventListener('storage', onStorage);
            window.removeEventListener('minizoo-player-name-changed', syncPlayerName);
        };
    }, []);

    useEffect(() => {
        const syncSoundEnabled = () => {
            soundEnabledRef.current = getSfxVolume() > 0;
        };

        const syncGraphicsAndFps = () => {
            const settings = getSettings();
            const newQuality = settings.graphicsQuality || 'medium';
            const newFpsLimit = settings.fpsLimit || 60;

            const prevQuality = graphicsQualityRef.current;
            graphicsQualityRef.current = newQuality;
            fpsLimitRef.current = newFpsLimit;

            if (newQuality !== prevQuality) {
                const state = gameStateRef.current;
                if (state.renderer) {
                    applyRendererQuality(state.renderer, newQuality);
                }
                if (state.scene) {
                    applySceneQuality(state.scene, newQuality);
                }
                updateRiverQuality(state.river, newQuality);
            }
        };

        const syncSensitivity = () => {
            const settings = getSettings();
            if (gameStateRef.current) {
                gameStateRef.current.sensitivity = settings.sensitivity || 1.0;
            }
        };

        syncSoundEnabled();
        syncGraphicsAndFps();
        syncSensitivity();

        const onStorage = (e) => {
            if (!e || e.key === 'minizoo_settings' || e.key === null) {
                syncSoundEnabled();
                syncGraphicsAndFps();
                syncSensitivity();
            }
        };

        const onSettingsChanged = () => {
            syncSoundEnabled();
            syncGraphicsAndFps();
            syncSensitivity();

            // Sync animal SFX volume when settings change
            const sfxVol = getSfxVolume();
            if (gameStateRef.current?.animals) {
                gameStateRef.current.animals.forEach(a => a.updateVolume?.(sfxVol));
            }
        };

        window.addEventListener('storage', onStorage);
        window.addEventListener(SETTINGS_CHANGE_EVENT, onSettingsChanged);

        return () => {
            window.removeEventListener('storage', onStorage);
            window.removeEventListener(SETTINGS_CHANGE_EVENT, onSettingsChanged);
        };
    }, []);

    useEffect(() => {
        let mounted = true;
        const state = gameStateRef.current;
        const t = setTimeout(() => { if (mounted && containerRef.current) initGame(); }, 100);
        return () => {
            mounted = false;
            clearTimeout(t);
            isNearStatueRef.current = false;
            hasShownStatueEntryRef.current = false;
            gameStartedRef.current = false;
            nearbyAnimalRef.current = null;
            nearbyStaffRef.current = false;
            soundEnabledRef.current = false;
            stopGameplaySounds(false);
            ambienceRef.current = null;
            setNearbyStaff(false);
            setShowNpcDialogue(false);
            setNpcDialogueNodeId('root');
            state.cleanup?.();
            releaseAssetObjectUrls();
        };
    }, [clearFeedingTimer, initGame, stopGameplaySounds]);

    useEffect(() => {
        showNpcDialogueRef.current = showNpcDialogue;
    }, [showNpcDialogue]);

    useEffect(() => {
        const state = gameStateRef.current;
        if (showNpcDialogue || bookOpen) {
            state.controlsEnabled = false;
            return;
        }

        if (gameStarted && characterReady) {
            state.controlsEnabled = true;
        }
    }, [showNpcDialogue, bookOpen, gameStarted, characterReady]);

    useEffect(() => {
        if (!gameStarted) return;

        const applyMusicState = () => {
            if (document.hidden) {
                stopAmbience(true);
                stopMusic(true);
                return;
            }

            const ambVol = getAmbienceVolume();
            const musVol = getMusicVolume();

            if (ambVol > 0) {
                playAmbience();
            } else {
                stopAmbience(true);
            }

            if (musVol > 0) {
                playMusic();
            } else {
                stopMusic(true);
            }
        };

        applyMusicState();

        const onSettingsChanged = () => {
            applyMusicState();
            soundEnabledRef.current = getSfxVolume() > 0;
        };

        const onStorage = (e) => {
            if (!e || e.key === 'minizoo_settings' || e.key === null) {
                applyMusicState();
                soundEnabledRef.current = getSfxVolume() > 0;
            }
        };

        const onVisibilityChange = () => {
            if (document.hidden) clearFeedingTimer();
            applyMusicState();
        };

        window.addEventListener('storage', onStorage);
        window.addEventListener(SETTINGS_CHANGE_EVENT, onSettingsChanged);
        document.addEventListener('visibilitychange', onVisibilityChange);

        return () => {
            window.removeEventListener('storage', onStorage);
            window.removeEventListener(SETTINGS_CHANGE_EVENT, onSettingsChanged);
            document.removeEventListener('visibilitychange', onVisibilityChange);
            stopAmbience(true);
        };
    }, [gameStarted, playAmbience, stopAmbience, clearFeedingTimer]);

    const completedCount = tasks.reduce((count, task) => count + (task.completed ? 1 : 0), 0);
    const totalCount = tasks.length;

    useEffect(() => {
        if (!gameStarted) {
            allFedCelebratedRef.current = false;
            return;
        }

        if (totalCount <= 0) return;

        const allFedNow = completedCount === totalCount;
        if (!allFedNow || allFedCelebratedRef.current) return;

        allFedCelebratedRef.current = true;
        playGameButtonSfx('task-complete');
        setShowAllFedCelebration(true);
    }, [completedCount, gameStarted, totalCount]);

    useEffect(() => {
        const onDocClick = (e) => {
            const target = e.target;
            if (!(target instanceof Element)) return;
            if (!target.closest('button, [data-ui-button="true"]')) return;
            if (target.closest('[data-sfx-self="true"]')) return;
            playGameButtonSfx('tap');
        };

        document.addEventListener('click', onDocClick, true);
        return () => {
            document.removeEventListener('click', onDocClick, true);
        };
    }, []);

    const nearbyAnimalInfo = nearbyAnimal ? (nearbyAnimal.getInfo ? nearbyAnimal.getInfo() : nearbyAnimal.config) : null;
    const nearbyAnimalFed = nearbyAnimalInfo ? isAnimalFed(nearbyAnimalInfo.name) : false;
    const isDangerousAnimalNearby = Boolean(nearbyAnimalInfo?.dangerous);
    const feedingBlocked = isDangerousAnimalNearby || Boolean(nearbyAnimalInfo?.requiredItem && nearbyAnimalInfo.hasRequiredItem === false);
    const interfaceOpen = settingsOpen || tasksOpen || showNpcDialogue || bookOpen || photoPreview || showQuitModal || showResetTasksModal || showAllFedCelebration || showCertificate;

    useEffect(() => {
        if (interfaceOpen || document.hidden) clearFeedingTimer();
    }, [interfaceOpen, clearFeedingTimer]);
    const missionSteps = [
        { title: 'Talk to Ranger Lino', objective: 'Say hello and get your ranger mission.', done: missionProgress.talkedToRanger, icon: '👋' },
        { title: 'Feed the horse', objective: 'Find the friendly horse and hold Feed.', done: missionProgress.fedHorse, icon: '🐴' },
        { title: 'Feed the rabbit', objective: 'Find either rabbit and hold Feed for a gentle snack.', done: missionProgress.fedRabbit, icon: '🐇' }
    ];
    const missionComplete = missionSteps.every((step) => step.done);
    const npcDialogueNode = npcDialogueNodeId === 'mission'
        ? { ...getStaffDialogueNode('mission'), message: missionComplete ? 'You did it! The horse and rabbit are cared for. Your ranger reward is safe in your progress.' : 'Here is your ranger trail. Complete each step in order, and I will keep your progress safe.' }
        : getStaffDialogueNode(npcDialogueNodeId);
    const canShowNpcPrompt = gameStarted
        && characterReady
        && nearbyStaff
        && !nearbyAnimal
        && !showNpcDialogue;

    return (
        <div className="relative h-dvh w-full overflow-hidden bg-linear-to-b from-sky-300 to-sky-100 touch-none overscroll-none">
            <RotateDeviceOverlay />
            {cameraFlash ? <div className="pointer-events-none fixed inset-0 z-130 bg-white" aria-hidden="true" /> : null}
            <div ref={containerRef} className="absolute inset-0" />
            {isLoading && <LoadingScreen />}
            {!isLoading && showMenu && (
                <MainMenu
                    onStart={handleStartGame}
                    isVisible={showMenu}
                    characterOptions={CHARACTER_OPTIONS}
                    selectedCharacterId={selectedCharacterId}
                    onCharacterPicked={handleCharacterPicked}
                />
            )}
            {gameStarted && (
                <>
                     <GameHUD
                        playerName={playerName || 'Explorer'}
                         onMenuClick={handleMenuClick}
                         onTasksClick={handleTasksClick}
                         onBook={openBook}
                         onCamera={captureScene}
                        completedTasks={completedCount}
                        totalTasks={totalCount}
                        isTouchDevice={isTouchDevice}
                    />
                     {!interfaceOpen ? <Joystick baseRef={baseRef} stickRef={stickRef} isTouchDevice={isTouchDevice} /> : null}
                      {!interfaceOpen ? <RunButton isTouchDevice={isTouchDevice} onRunStart={() => handleRunInput(true)} onRunEnd={() => handleRunInput(false)} /> : null}
                      {!interfaceOpen ? <JumpButton jumpRef={jumpRef} isTouchDevice={isTouchDevice} /> : null}
                     <HoldToFeedControl
                         visible={Boolean(nearbyAnimal && !isDangerousAnimalNearby && gameStarted && characterReady && !interfaceOpen)}
                         animalName={nearbyAnimalInfo?.name}
                         progress={nearbyAnimalFed ? 1 : feedingProgress}
                         isHolding={isFeeding}
                        completed={nearbyAnimalFed}
                        disabled={feedingBlocked}
                        message={feedingBlocked ? `Find a ${nearbyAnimalInfo.requiredItem} first` : ''}
                         onStart={handleFeedAnimal}
                         onEnd={clearFeedingTimer}
                      />
                      <AnimalCaution visible={isDangerousAnimalNearby && gameStarted && characterReady && !interfaceOpen} />
                    <AnimalBookModal
                        isOpen={bookOpen}
                        onClose={closeBook}
                        discoveredAnimals={discoveredAnimals}
                        fedAnimals={tasks.reduce((result, task) => ({ ...result, [task.animalName]: task.completed }), {})}
                        onPageTurn={() => playGameButtonSfx('page-turn')}
                    />
                    <SettingsPanel
                        isOpen={settingsOpen}
                        onClose={() => setSettingsOpen(false)}
                        onQuit={handleQuitRequest}
                        onResetTasks={handleResetTasks}
                        cameraMode={cameraMode}
                        onCameraModeChange={(mode) => setCameraMode(mode)}
                    />
                    <TaskPanel isOpen={tasksOpen} onClose={() => setTasksOpen(false)} tasks={tasks} onTaskClick={() => setTasksOpen(false)} />
                    <NPCInteractionPrompt
                        visible={canShowNpcPrompt}
                        onInteract={openNpcDialogue}
                        npcName={STAFF_NPC_CONFIG.name}
                        isTouchDevice={isTouchDevice}
                    />
                    <NPCDialogueModal
                        isOpen={showNpcDialogue}
                        onClose={closeNpcDialogue}
                        npcName={STAFF_NPC_CONFIG.name}
                        npcRole={STAFF_NPC_CONFIG.role}
                        message={npcDialogueNode.message}
                        choices={npcDialogueNode.choices}
                        onSelectChoice={handleNpcChoice}
                        missionSteps={missionSteps}
                        animalEntries={discoveredAnimals.map((name) => getAnimalBookEntry(name)).filter(Boolean)}
                        onOpenAnimalBook={() => { closeNpcDialogue(); openBook(); }}
                    />
                     <FeedingSuccessNotification visible={feedingSuccess.visible} animalName={feedingSuccess.animalName} onHide={handleHideFeedSuccess} />
                    <CameraPreview dataUrl={photoPreview} onSave={savePhoto} onRetake={() => { setPhotoPreview(''); captureScene(); }} onClose={() => setPhotoPreview('')} />
                </>
            )}
            <QuitModal isOpen={showQuitModal} onConfirm={handleConfirmQuit} onCancel={handleCancelQuit} />
            <AllAnimalsCelebration
                visible={showAllFedCelebration}
                onClose={() => setShowAllFedCelebration(false)}
                onViewCertificate={() => {
                    setShowAllFedCelebration(false);
                    setShowCertificate(true);
                }}
            />
            <ResetTasksModal
                isOpen={showResetTasksModal}
                onConfirm={handleConfirmResetTasks}
                onCancel={handleCancelResetTasks}
            />
            <CertificateModal
                isOpen={showCertificate}
                onClose={() => setShowCertificate(false)}
                playerName={playerName || 'Explorer'}
                totalAnimals={totalCount}
            />
        </div>
    );
}

export default MiniZooGame;
