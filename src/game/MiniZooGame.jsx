import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';

import { createScene, createCamera, createRenderer, createLighting, applyRendererQuality, applySceneQuality } from './components/Scene.jsx';
import { createTerrain, loadTrees, loadBushes, loadRocks, createGrass, createClouds, getTerrainHeight } from './components/Terrain.jsx';
import { loadGLTFAnimals } from './components/Animals.jsx';
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
    AnimalInfoModal,
    FeedingSuccessNotification,
    QuitModal,
    ResetTasksModal,
    Joystick,
    JumpButton,
    WelcomePopup,
    AllAnimalsCelebration,
    CertificateModal,
    NPCInteractionPrompt,
    NPCDialogueModal,
    RotateDeviceOverlay,
    playGameButtonSfx
} from './ui/GameUI.jsx';
import { LoadingScreen } from '../components/loading-screen.jsx';

import {
    getTasks,
    feedAnimal,
    isAnimalFed,
    markAnimalDiscovered,
    getCompletedTasksCount,
    getTotalTasks,
    resetAllFeedingTasks,
    getPlayerSession,
    savePlayerSession,
    getSettings
} from './utils/storage.js';
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
const STATUE_ENTRY_MESSAGE = 'Welcome to Bulusan Zootopia Adventure. Start your adventure at the Bulusan Statue!';
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
        message: 'Welcome to Bulusan Zootopia Adventure! I am Ranger Lino. Need help with the animals today?',
        choices: [
            { id: 'animals', label: 'Tell me about the animals.', nextId: 'animals' },
            { id: 'bulusan', label: 'What makes Bulusan special?', nextId: 'bulusan' },
            { id: 'tasks', label: 'How do I finish my zoo mission?', nextId: 'tasks' },
            { id: 'bye', label: 'Thanks, I will explore now.', close: true }
        ]
    },
    animals: {
        id: 'animals',
        message: 'Our animals need gentle care. If you see one nearby, feed it and check its details. Well-fed animals stay calm and happy.',
        choices: [
            { id: 'animals-more', label: 'Any tip for feeding all animals fast?', nextId: 'animalsMore' },
            { id: 'back', label: 'Back', nextId: 'root' }
        ]
    },
    animalsMore: {
        id: 'animalsMore',
        message: 'Follow the paths around the zoo and use your task list often. When all tasks are complete, you can claim your certificate.',
        choices: [
            { id: 'back', label: 'Back', nextId: 'root' }
        ]
    },
    bulusan: {
        id: 'bulusan',
        message: 'Bulusan is known for rich nature and wildlife around the forest area. This adventure teaches kids to protect local habitats.',
        choices: [
            { id: 'back', label: 'Back', nextId: 'root' }
        ]
    },
    tasks: {
        id: 'tasks',
        message: 'Your mission is simple: discover animals, feed each one, and track progress in My Tasks. Keep going until every animal is fed.',
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
    const angle = Math.random() * Math.PI * 2;
    const radius = THREE.MathUtils.lerp(STAFF_NPC_CONFIG.patrolRadiusMin, STAFF_NPC_CONFIG.patrolRadiusMax, Math.random());
    return {
        x: homeX + Math.cos(angle) * radius,
        z: homeZ + Math.sin(angle) * radius
    };
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

function isMusicEnabled() {
    try {
        const raw = localStorage.getItem('minizoo_settings');
        if (!raw) return true;
        const parsed = JSON.parse(raw);
        return parsed?.musicEnabled !== false;
    } catch {
        return true;
    }
}

function isSoundEnabled() {
    try {
        const raw = localStorage.getItem('minizoo_settings');
        if (!raw) return true;
        const parsed = JSON.parse(raw);
        return parsed?.soundEnabled !== false;
    } catch {
        return true;
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
    const loader = new GLTFLoader();
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
    const loader = new GLTFLoader();
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

    const welcomeTimerRef = useRef(null);
    const ambienceRef = useRef(null);
    const statueMessageTimerRef = useRef(null);
    const statueMessageHideRef = useRef(null);
    const isNearStatueRef = useRef(false);
    const hasShownStatueEntryRef = useRef(false);
    const soundEnabledRef = useRef(isSoundEnabled());
    const gameStartedRef = useRef(false);
    const cameraModeRef = useRef('first');
    const showNpcDialogueRef = useRef(false);
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
    const [showWelcome, setShowWelcome] = useState(false);
    const [selectedCharacterId, setSelectedCharacterId] = useState(() => getStoredCharacterId());
    const [cameraMode, setCameraMode] = useState('first');
    const [characterReady, setCharacterReady] = useState(false);
    const [showAllFedCelebration, setShowAllFedCelebration] = useState(false);
    const [showCertificate, setShowCertificate] = useState(false);
    const [showStatueGreeting, setShowStatueGreeting] = useState(false);
    const [nearbyStaff, setNearbyStaff] = useState(false);
    const [showNpcDialogue, setShowNpcDialogue] = useState(false);
    const [npcDialogueNodeId, setNpcDialogueNodeId] = useState('root');

    const [nearbyAnimal, setNearbyAnimal] = useState(null);
    const [selectedAnimal, setSelectedAnimal] = useState(null);
    const [animalModalPlacement, setAnimalModalPlacement] = useState('bottom');
    const [isCompactAnimalPopupDismissed, setIsCompactAnimalPopupDismissed] = useState(false);
    const [tasks, setTasks] = useState(getTasks());
    const [playerName, setPlayerName] = useState(() => getStoredPlayerName());

    const [feedingSuccess, setFeedingSuccess] = useState({ visible: false, animalName: '' });
    const allFedCelebratedRef = useRef(false);

    // Added obstacles array to state to hold tree/rock/bush positions
    const gameStateRef = useRef({
        keys: {}, yaw: 0, pitch: 0,
        mX: 0, mY: 0, sActive: false, lActive: false, lx: 0, ly: 0,
        velocityY: 0, isJumping: false, isGrounded: true,
        playerHeight: PLAYER_HEIGHT,
        playerMoveSpeed: 0,
        playerIsMoving: false,
        playerIsRunning: false,
        currentCameraMode: 'first',
        controlsEnabled: false,
        cameraControlLockedUntil: 0,
        animationId: null, scene: null, camera: null, renderer: null,
        animals: [], clouds: [], obstacles: [], animalObstacles: [], cleanup: null, initialized: false,
        playerAnchor: null,
        playerCharacter: null,
        playerCharacterBaseYOffset: 0,
        playerShadow: null,
        playerMixer: null,
        playerActions: {},
        currentPlayerAction: null,
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
        for (const animal of animals) {
            if (!animal.group) continue;
            const ap = animal.group.position;
            const dx = pos.x - ap.x;
            const dz = pos.z - ap.z;
            if (Math.sqrt(dx * dx + dz * dz) < 15) return animal;
        }
        return null;
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
            const audio = new Audio();
            audio.loop = true;
            audio.preload = 'auto';
            audio.volume = 1.0;
            audio.setAttribute('playsinline', 'true');
            ambienceRef.current = audio;
            ambienceLoadingRef.current = true;

            resolveAssetUrl('/audio/ambience.mp3')
                .then((assetUrl) => {
                    if (ambienceRef.current === audio) {
                        audio.src = assetUrl || '/audio/ambience.mp3';
                        ambienceLoadingRef.current = false;
                    }
                })
                .catch(() => {
                    if (ambienceRef.current === audio) {
                        audio.src = '/audio/ambience.mp3';
                        ambienceLoadingRef.current = false;
                    }
                });
        }
        return ambienceRef.current;
    }, []);

    const playAmbience = useCallback(async () => {
        if (!isMusicEnabled()) return;
        if (ambienceLoadingRef.current) return;
        const audio = getAmbience();
        if (!audio || !audio.src) return;
        if (!audio.paused) return;
        try {
            await audio.play();
        } catch {
            // Playback can fail before a user interaction; we'll retry on next allowed interaction.
        }
    }, [getAmbience]);

    const stopAmbience = useCallback((keepPosition = true) => {
        const audio = ambienceRef.current;
        if (!audio) return;
        audio.pause();
        if (!keepPosition) {
            audio.currentTime = 0;
        }
    }, []);

    const stopGameplaySounds = useCallback((keepMusicPosition = false) => {
        stopAmbience(keepMusicPosition);
        const state = gameStateRef.current;
        state.animals.forEach((animal) => {
            animal.stopSound?.(true);
        });
    }, [stopAmbience]);

    const clearStatueMessageTimers = useCallback(() => {
        if (statueMessageTimerRef.current) {
            clearTimeout(statueMessageTimerRef.current);
            statueMessageTimerRef.current = null;
        }
        if (statueMessageHideRef.current) {
            clearTimeout(statueMessageHideRef.current);
            statueMessageHideRef.current = null;
        }
    }, []);

    const showStatueEntryMessage = useCallback(() => {
        setShowStatueGreeting(true);
        if (statueMessageHideRef.current) {
            clearTimeout(statueMessageHideRef.current);
        }
        statueMessageHideRef.current = setTimeout(() => {
            setShowStatueGreeting(false);
            statueMessageHideRef.current = null;
        }, 3200);
    }, []);

    useEffect(() => {
        cameraModeRef.current = cameraMode;
        const state = gameStateRef.current;
        state.currentCameraMode = cameraMode;
        if (state.playerCharacter) {
            state.playerCharacter.visible = cameraMode !== 'first';
        }
    }, [cameraMode]);

    const cycleCameraMode = useCallback(() => {
        setCameraMode((prev) => (prev === 'first' ? 'third' : 'first'));
    }, []);

    const playPlayerAction = useCallback((name) => {
        const state = gameStateRef.current;
        const actions = state.playerActions || {};
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
        nextAction.play();
        state.currentPlayerAction = nextAction;
    }, []);

    const disposePlayerCharacter = useCallback(() => {
        const state = gameStateRef.current;
        if (state.playerMixer) {
            state.playerMixer.stopAllAction();
            state.playerMixer = null;
        }
        state.playerActions = {};
        state.currentPlayerAction = null;
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

            const loader = new GLTFLoader();
            const characterUrl = await resolveAssetUrl(`/models/characters/${characterOption.file}`);
            const gltf = await new Promise((resolve, reject) => {
                loader.load(characterUrl, resolve, undefined, reject);
            });

            const model = gltf.scene;
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
            state.controlsEnabled = true;

            setShowWelcome(true);
            if (welcomeTimerRef.current) {
                clearTimeout(welcomeTimerRef.current);
            }
            welcomeTimerRef.current = setTimeout(() => {
                setShowWelcome(false);
                welcomeTimerRef.current = null;
            }, 3000);
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
            addStatueLights(scene);
            setLoadProgress(15);

            const statuePromise = loadCenterStatue(scene, isMobile);
            const staffPromise = loadStaffNpc(scene, isMobile);

            const { loadPromise: treesP } = loadTrees(scene, isMobile ? 50 : 80);
            const { loadPromise: bushesP } = loadBushes(scene, isMobile ? 40 : 70);
            const { loadPromise: rocksP } = loadRocks(scene, isMobile ? 20 : 40);

            setLoadProgress(30);
            // Wait for all objects to load, and extract the resulting arrays!
            const [loadedTrees, loadedBushes, loadedRocks, statueResult, staffResult] = await Promise.all([treesP, bushesP, rocksP, statuePromise, staffPromise]);

            // Create collision obstacles based on the loaded meshes
            state.obstacles = [];
            loadedTrees.forEach(t => state.obstacles.push({ x: t.position.x, z: t.position.z, radius: t.scale.x * 0.8 }));
            loadedRocks.forEach(r => state.obstacles.push({ x: r.position.x, z: r.position.z, radius: r.scale.x * 1.1 }));
            loadedBushes.forEach(b => state.obstacles.push({ x: b.position.x, z: b.position.z, radius: b.scale.x * 0.6 }));
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

            const spawnX = hasResumePosition ? resumePosition.x : (STATUE_CENTER.x + PLAYER_START_OFFSET.x);
            const spawnZ = hasResumePosition ? resumePosition.z : (STATUE_CENTER.z + PLAYER_START_OFFSET.z);
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

            createGrass(scene, isMobile ? 260 : 900);
            setLoadProgress(55);

            // Pass the obstacles to the animals so they don't walk through them either!
            state.animals = await loadGLTFAnimals(scene, state.obstacles);
            setLoadProgress(80);

            state.clouds = createClouds(scene, isMobile ? 8 : 12);
            setLoadProgress(95);

            const handleMovement = createMovementHandler(state.playerAnchor, state);
            const desiredCameraPosition = new THREE.Vector3();
            const lookTarget = new THREE.Vector3();

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

                state.animalObstacles = state.animals
                    .filter(a => a?.group)
                    .map((a) => ({
                        x: a.group.position.x,
                        z: a.group.position.z,
                        radius: Math.max(1.15, a.radius ?? a.config?.collisionRadius ?? ((a.config?.scale ?? 1) * 0.7))
                    }));
                if (state.staffNpc) {
                    state.animalObstacles.push({
                        x: state.staffNpc.x,
                        z: state.staffNpc.z,
                        radius: state.staffNpc.obstacleRadius
                    });
                }

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
                    const facingOffset = cameraModeRef.current === 'third' ? Math.PI : 0;
                    const desiredCharacterYaw = state.yaw + facingOffset;
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
                    if (!state.playerIsMoving) {
                        playPlayerAction('idle');
                    } else {
                        playPlayerAction('walk');
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

                if (cameraModeRef.current === 'third' && state.playerAnchor) {
                    const followDistance = isMobile ? 5.6 : 7.0;
                    const followHeight = isMobile ? 3.0 : 3.5;
                    const pitchLift = Math.sin(-state.pitch) * 1.3;

                    desiredCameraPosition.set(
                        playerPosition.x + Math.sin(state.yaw) * followDistance,
                        playerPosition.y + followHeight + pitchLift,
                        playerPosition.z + Math.cos(state.yaw) * followDistance
                    );

                    const minCameraY = getTerrainHeight(desiredCameraPosition.x, desiredCameraPosition.z) + 1.4;
                    desiredCameraPosition.y = Math.max(desiredCameraPosition.y, minCameraY);

                    const cameraLerp = 1 - Math.exp(-8 * dt);
                    camera.position.lerp(desiredCameraPosition, cameraLerp);
                    lookTarget.set(playerPosition.x, playerPosition.y + 2.1, playerPosition.z);
                    camera.lookAt(lookTarget);
                } else if (state.playerAnchor) {
                    const minEyeY = getTerrainHeight(playerPosition.x, playerPosition.z)
                        + (state.playerHeight ?? PLAYER_HEIGHT)
                        + FIRST_PERSON_EYE_OFFSET;
                    camera.position.set(
                        playerPosition.x,
                        Math.max(playerPosition.y + FIRST_PERSON_EYE_OFFSET, minEyeY),
                        playerPosition.z
                    );
                    camera.rotation.set(state.pitch, state.yaw, 0, 'YXZ');
                }

                state.animals.forEach(a => {
                    if (a.group) {
                        const dist = playerPosition.distanceTo(a.group.position);
                        const updateRange = isMobile ? 130 : 200;
                        if (dist < updateRange) a.update(now * 0.001, dt);
                    }
                });

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
                            showStatueEntryMessage();
                        }
                    } else if (!nearStatue && isNearStatueRef.current) {
                        isNearStatueRef.current = false;
                    }
                }

                nearbyTimer += dt;
                if (nearbyTimer > nearbyInterval) {
                    nearbyTimer = 0;
                    setNearbyAnimal(checkNearbyAnimals(playerPosition, state.animals));
                }

                staffCheckTimer += dt;
                if (staffCheckTimer >= 0.2) {
                    staffCheckTimer = 0;
                    setNearbyStaff(checkNearbyStaff(playerPosition, state.staffNpc));
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
                clearStatueMessageTimers();
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
                    renderer.dispose();
                    if (containerRef.current && renderer.domElement) {
                        containerRef.current.removeChild(renderer.domElement);
                    }
                }
            };

            state.initialized = true;
            await new Promise(resolve => setTimeout(resolve, 300));
            setIsLoading(false);
        } catch (err) {
            console.error('Game init failed:', err);
            setIsLoading(false);
        }
    }, [checkNearbyAnimals, checkNearbyStaff, clearStatueMessageTimers, disposePlayerCharacter, playPlayerAction, showStatueEntryMessage]);

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

        hasShownStatueEntryRef.current = false;
        gameStartedRef.current = true;
        soundEnabledRef.current = isSoundEnabled();
        setPlayerName(getStoredPlayerName());
        setShowMenu(false);
        setGameStarted(true);
        setTasks(getTasks());
        setCameraMode(session.cameraMode);
        setSelectedCharacterId(storedCharacterOption?.id || null);
        setCharacterReady(false);
        setNearbyStaff(false);
        setShowNpcDialogue(false);
        setNpcDialogueNodeId('root');
        state.controlsEnabled = false;
        setShowWelcome(false);

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
        setTimeout(() => {
            if (gameStartedRef.current) playAmbience();
        }, 220);
    }, [playAmbience, handleSelectCharacter]);

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
    const handleMenuClick = useCallback(() => setSettingsOpen(true), []);
    const handleTasksClick = useCallback(() => setTasksOpen(true), []);
    const handleResetTasks = useCallback(() => {
        setShowResetTasksModal(true);
    }, []);
    const handleConfirmResetTasks = useCallback(() => {
        setShowResetTasksModal(false);
        resetAllFeedingTasks();
        setTasks(getTasks());
        allFedCelebratedRef.current = false;
        setShowAllFedCelebration(false);
        setShowCertificate(false);
        setFeedingSuccess({ visible: false, animalName: '' });
    }, []);
    const handleCancelResetTasks = useCallback(() => setShowResetTasksModal(false), []);
    const handleQuitRequest = useCallback(() => { setSettingsOpen(false); setShowQuitModal(true); }, []);
    const handleConfirmQuit = useCallback(() => {
        // Stop sounds
        stopGameplaySounds(false);

        // State cleanup - This will return the user to the Main Menu
        gameStartedRef.current = false;
        soundEnabledRef.current = false;
        hasShownStatueEntryRef.current = false;
        setShowQuitModal(false);
        setShowResetTasksModal(false);
        setSettingsOpen(false);
        setTasksOpen(false);
        setSelectedAnimal(null);
        setNearbyAnimal(null);
        setIsCompactAnimalPopupDismissed(false);
        setShowWelcome(false);
        setSelectedCharacterId(null);
        setCharacterReady(false);
        setCameraMode('first');
        setShowAllFedCelebration(false);
        setShowCertificate(false);
        setNearbyStaff(false);
        setShowNpcDialogue(false);
        setNpcDialogueNodeId('root');
        setGameStarted(false);
        setShowMenu(true);
    }, [stopGameplaySounds]);
    const handleCancelQuit = useCallback(() => setShowQuitModal(false), []);

    const handleViewDetails = useCallback(() => {
        if (!nearbyAnimal) return;
        const info = nearbyAnimal.getInfo ? nearbyAnimal.getInfo() : nearbyAnimal.config;
        markAnimalDiscovered(info.name);
        setSelectedAnimal(info);
        setIsCompactAnimalPopupDismissed(false);
        setAnimalModalPlacement('center');
    }, [nearbyAnimal]);

    const handleFeedAnimal = useCallback(() => {
        if (!nearbyAnimal) return;
        const info = nearbyAnimal.getInfo ? nearbyAnimal.getInfo() : nearbyAnimal.config;
        if (isSoundEnabled()) {
            nearbyAnimal.playSound?.();
        }
        markAnimalDiscovered(info.name);
        feedAnimal(info.name);
        setTasks(getTasks());
        setFeedingSuccess({ visible: true, animalName: info.name });
    }, [nearbyAnimal]);

    const handleFeedFromModal = useCallback(() => {
        if (!selectedAnimal) return;
        if (isSoundEnabled()) {
            const state = gameStateRef.current;
            const match = state.animals.find(a => {
                const info = a.getInfo ? a.getInfo() : a.config;
                return info?.name === selectedAnimal.name;
            });
            match?.playSound?.();
        }
        markAnimalDiscovered(selectedAnimal.name);
        feedAnimal(selectedAnimal.name);
        setTasks(getTasks());
        setFeedingSuccess({ visible: true, animalName: selectedAnimal.name });
        if (animalModalPlacement === 'center') {
            setAnimalModalPlacement('bottom');
            setSelectedAnimal(null);
            setIsCompactAnimalPopupDismissed(false);
        }
    }, [selectedAnimal, animalModalPlacement]);

    const handleHideFeedSuccess = useCallback(() => setFeedingSuccess({ visible: false, animalName: '' }), []);

    const openNpcDialogue = useCallback(() => {
        if (!nearbyStaff || !gameStarted || !characterReady) return;
        const state = gameStateRef.current;
        state.controlsEnabled = false;
        state.mX = 0;
        state.mY = 0;
        state.keys.w = false;
        state.keys.a = false;
        state.keys.s = false;
        state.keys.d = false;
        setNpcDialogueNodeId('root');
        setShowNpcDialogue(true);
    }, [nearbyStaff, gameStarted, characterReady]);

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

    const handleCloseAnimalModal = useCallback(() => {
        if (animalModalPlacement === 'center') {
            setAnimalModalPlacement('bottom');
            setSelectedAnimal(null);
            return;
        }
        setIsCompactAnimalPopupDismissed(true);
        setSelectedAnimal(null);
    }, [animalModalPlacement]);

    useEffect(() => {
        const info = nearbyAnimal ? (nearbyAnimal.getInfo ? nearbyAnimal.getInfo() : nearbyAnimal.config) : null;
        if (!info) {
            setTimeout(() => {
                setIsCompactAnimalPopupDismissed(false);
                setSelectedAnimal(null);
            }, 0);
            return;
        }
        if (animalModalPlacement !== 'center') {
            setTimeout(() => {
                setIsCompactAnimalPopupDismissed(false);
            }, 0);
        }
    }, [nearbyAnimal, animalModalPlacement]);

    useEffect(() => {
        const onKey = e => {
            const key = e.key.toLowerCase();
            if (key === 'e' && nearbyAnimal && gameStarted && characterReady) {
                const info = nearbyAnimal.getInfo ? nearbyAnimal.getInfo() : nearbyAnimal.config;
                markAnimalDiscovered(info.name);
                setSelectedAnimal(info);
                setAnimalModalPlacement('center');
                setIsCompactAnimalPopupDismissed(false);
            }
            else if ((key === 't' || key === 'e') && nearbyStaff && gameStarted && characterReady && !showNpcDialogue) {
                openNpcDialogue();
            }
            if (key === 'f' && nearbyAnimal && !selectedAnimal && gameStarted && characterReady) {
                const info = nearbyAnimal.getInfo ? nearbyAnimal.getInfo() : nearbyAnimal.config;
                if (isSoundEnabled()) {
                    nearbyAnimal.playSound?.();
                }
                markAnimalDiscovered(info.name);
                feedAnimal(info.name);
                setTasks(getTasks());
                setFeedingSuccess({ visible: true, animalName: info.name });
            }
            if (key === 'v' && gameStarted && characterReady) {
                cycleCameraMode();
            }
            if (key === 'escape') {
                if (showNpcDialogue) {
                    closeNpcDialogue();
                    return;
                }
                if (animalModalPlacement === 'center' && selectedAnimal) {
                    setAnimalModalPlacement('bottom');
                    setSelectedAnimal(null);
                }
                else if (nearbyAnimal) {
                    setIsCompactAnimalPopupDismissed(true);
                    setSelectedAnimal(null);
                }
                else if (settingsOpen) setSettingsOpen(false);
                else if (tasksOpen) setTasksOpen(false);
            }
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [nearbyAnimal, nearbyStaff, selectedAnimal, showNpcDialogue, gameStarted, settingsOpen, tasksOpen, animalModalPlacement, characterReady, cycleCameraMode, openNpcDialogue, closeNpcDialogue]);

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
            soundEnabledRef.current = isSoundEnabled();
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
            }
        };

        syncSoundEnabled();
        syncGraphicsAndFps();

        const onStorage = (e) => {
            if (!e || e.key === 'minizoo_settings' || e.key === null) {
                syncSoundEnabled();
                syncGraphicsAndFps();
            }
        };

        const onSettingsChanged = () => {
            syncSoundEnabled();
            syncGraphicsAndFps();
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
            clearStatueMessageTimers();
            isNearStatueRef.current = false;
            hasShownStatueEntryRef.current = false;
            setShowStatueGreeting(false);
            if (welcomeTimerRef.current) {
                clearTimeout(welcomeTimerRef.current);
                welcomeTimerRef.current = null;
            }
            gameStartedRef.current = false;
            soundEnabledRef.current = false;
            stopGameplaySounds(false);
            ambienceRef.current = null;
            setNearbyStaff(false);
            setShowNpcDialogue(false);
            setNpcDialogueNodeId('root');
            state.cleanup?.();
            releaseAssetObjectUrls();
        };
    }, [clearStatueMessageTimers, initGame, stopGameplaySounds]);

    useEffect(() => {
        showNpcDialogueRef.current = showNpcDialogue;
    }, [showNpcDialogue]);

    useEffect(() => {
        const state = gameStateRef.current;
        if (showNpcDialogue) {
            state.controlsEnabled = false;
            return;
        }

        if (gameStarted && characterReady) {
            state.controlsEnabled = true;
        }
    }, [showNpcDialogue, gameStarted, characterReady]);

    useEffect(() => {
        if (!gameStarted) return;

        const applyMusicState = () => {
            if (document.hidden) {
                stopAmbience(true);
                return;
            }
            if (isMusicEnabled()) {
                playAmbience();
            } else {
                stopAmbience(true);
            }
        };

        applyMusicState();

        const onSettingsChanged = () => {
            applyMusicState();
        };

        const onStorage = (e) => {
            if (!e || e.key === 'minizoo_settings' || e.key === null) {
                applyMusicState();
            }
        };

        const onVisibilityChange = () => {
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
    }, [gameStarted, playAmbience, stopAmbience]);

    const completedCount = getCompletedTasksCount();
    const totalCount = getTotalTasks();

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
    const compactAnimal = (!isCompactAnimalPopupDismissed && animalModalPlacement === 'bottom') ? nearbyAnimalInfo : null;
    const modalAnimal = animalModalPlacement === 'center' ? selectedAnimal : compactAnimal;
    const isModalAnimalFed = modalAnimal ? isAnimalFed(modalAnimal.name) : false;
    const npcDialogueNode = getStaffDialogueNode(npcDialogueNodeId);
    const canShowNpcPrompt = gameStarted
        && characterReady
        && nearbyStaff
        && !showNpcDialogue;

    return (
        <div className="relative h-dvh w-full overflow-hidden bg-linear-to-b from-sky-300 to-sky-100 touch-none overscroll-none">
            <RotateDeviceOverlay />
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
                    <WelcomePopup visible={showWelcome} message="Welcome, Explorer! Head to the Bulusan Statue and start your zoo tour." />
                    <WelcomePopup visible={showStatueGreeting} message={STATUE_ENTRY_MESSAGE} />
                    {characterReady && (
                        <button
                            data-ui-button="true"
                            type="button"
                            onClick={cycleCameraMode}
                            className={`camera-toggle-btn absolute right-1 sm:right-3 z-70 rounded-full border border-emerald-300/80 bg-linear-to-b from-white to-emerald-50 font-extrabold text-emerald-950 shadow-[0_10px_24px_-16px_rgba(5,46,22,0.5)] transition hover:to-emerald-100 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/80 ${isTouchDevice
                                ? 'top-[calc(env(safe-area-inset-top)+3.8rem)] px-2 py-1 text-[10px] sm:px-2.5 sm:py-1.5 sm:text-[11px]'
                                : 'top-[calc(env(safe-area-inset-top)+3.45rem)] px-3 py-2 text-xs'}`}
                            title="Toggle camera view (V)"
                        >
                            {cameraMode === 'first' ? '1st' : '3rd'}
                        </button>
                    )}
                    <GameHUD
                        playerName={playerName || 'Explorer'}
                        onMenuClick={handleMenuClick}
                        onTasksClick={handleTasksClick}
                        completedTasks={completedCount}
                        totalTasks={totalCount}
                        isTouchDevice={isTouchDevice}
                    />
                    <Joystick baseRef={baseRef} stickRef={stickRef} isTouchDevice={isTouchDevice} />
                    <JumpButton jumpRef={jumpRef} isTouchDevice={isTouchDevice} />
                    <SettingsPanel
                        isOpen={settingsOpen}
                        onClose={() => setSettingsOpen(false)}
                        onQuit={handleQuitRequest}
                        onResetTasks={handleResetTasks}
                    />
                    <TaskPanel isOpen={tasksOpen} onClose={() => setTasksOpen(false)} tasks={tasks} onTaskClick={() => setTasksOpen(false)} />
                    <AnimalInfoModal
                        animal={modalAnimal}
                        onClose={handleCloseAnimalModal}
                        onFeed={animalModalPlacement === 'center' ? handleFeedFromModal : handleFeedAnimal}
                        isFed={isModalAnimalFed}
                        placement={animalModalPlacement}
                        preview={animalModalPlacement === 'bottom'}
                        onView={handleViewDetails}
                    />
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
                    />
                    <FeedingSuccessNotification visible={feedingSuccess.visible} animalName={feedingSuccess.animalName} onHide={handleHideFeedSuccess} />
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