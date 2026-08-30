import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';

import { createScene, createCamera, createRenderer, createLighting, applyRendererQuality, applySceneQuality } from './components/Scene.jsx';
import { createTerrain, createFence, createTigerEnclosure, loadTrees, loadBushes, loadRocks, createGrass, updateGrass, createClouds, getTerrainHeight, releaseTerrainModelCache, PLAYABLE_BOUNDARY } from './components/Terrain.jsx';
import { loadGLTFAnimals, loadAmbientBirds, releaseAnimalModelCache } from './components/Animals.jsx';
import { createRiver, updateRiver, updateRiverQuality, disposeRiver, getRiverMetrics, isLandAccessible, findAccessiblePosition, isRiverArea } from './components/River.jsx';
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
    PlayerDetailsModal,
    RotateDeviceOverlay,
    AnimalCaution,
    playGameButtonSfx
} from './ui/GameUI.jsx';
import { AnimalBookModal, CameraModeOverlay, CameraPreview } from './ui/ExplorationHUD.jsx';
import { LoadingScreen } from '../components/loading-screen.jsx';
import { cx } from './ui/UIComponents.jsx';

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
import { getPlayerModel, getPlayerProfile, PLAYER_PROFILE_CHANGE_EVENT } from './utils/playerProfile.js';

const PLAYER_HEIGHT = 0.2;
const PLAYER_CHARACTER_TARGET_HEIGHT = 1.5;
const FIRST_PERSON_EYE_OFFSET = 4.5;
const FIRST_PERSON_FOV = 70;
const THIRD_PERSON_FOV = 70;
const STATUE_CENTER = { x: 0, z: 0 };
const PLAYER_START_OFFSET = { x: 14, z: 10 };
const SETTINGS_CHANGE_EVENT = 'minizoo-settings-changed';
const STAFF_NPC_CONFIGS = [{
    id: 'lino', name: 'Ranger Lino', role: 'Zoo Mission Guide', file: 'ranger-lino.gltf', position: { x: -20, z: 22 },
    interactionRadius: 6.5,
    obstacleRadius: 2.4,
    targetHeight: 1.75,
    patrolRadiusMin: 3.5,
    patrolRadiusMax: 8.5,
    moveSpeed: 0.8,
    turnSpeed: 4.2,
    stopDistance: 0.45,
    facingOffset: Math.PI,
}, {
    id: 'lina', name: 'Ranger Lina', role: 'Zoo Care Ranger', file: 'ranger-lina.gltf', position: { x: 22, z: 18 },
    interactionRadius: 6.5, obstacleRadius: 2.4, targetHeight: 1.75,
    patrolRadiusMin: 3.5, patrolRadiusMax: 8.5, moveSpeed: 0.75,
    turnSpeed: 4.2, stopDistance: 0.45, facingOffset: Math.PI,
}];
const LINO_DIALOGUE_NODES = {
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
        message: 'Move with WASD on desktop or the joystick on mobile. Your explorer runs automatically. Use Jump when needed, move near a gentle animal, and hold Feed. Press T or E near me to talk.',
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
const LINA_DIALOGUE_NODES = {
    root: {
        id: 'root',
        message: 'Hi! I am Ranger Lina. I am taking a little walk around the zoo. How is your adventure going?',
        choices: [
            { id: 'day', label: 'How Is Your Day?', nextId: 'day', icon: '☀' },
            { id: 'favorite', label: 'Favorite Animal', nextId: 'favorite', icon: '♥' },
            { id: 'tip', label: 'A Quick Tip', nextId: 'tip', icon: '✦' },
            { id: 'bye', label: 'See You Later', close: true, icon: '👋' },
        ],
    },
    day: { id: 'day', message: 'It is a lovely day to be outside. I have been checking the paths and saying hello to every animal I pass.', choices: [{ id: 'back', label: 'Back', nextId: 'root' }] },
    favorite: { id: 'favorite', message: 'I really enjoy watching the alpacas. They are calm, curious, and always look ready for a photo!', choices: [{ id: 'back', label: 'Back', nextId: 'root' }] },
    tip: { id: 'tip', message: 'Take your time and look around. The animal book remembers every friend you discover along the way.', choices: [{ id: 'back', label: 'Back', nextId: 'root' }] },
};
let CONTACT_SHADOW_TEXTURE = null;

function getStaffDialogueNode(staffId, nodeId) {
    const nodes = staffId === 'lina' ? LINA_DIALOGUE_NODES : LINO_DIALOGUE_NODES;
    return nodes[nodeId] || nodes.root;
}

function chooseNextStaffPatrolTarget(config, homeX, homeZ) {
    for (let attempt = 0; attempt < 12; attempt += 1) {
        const angle = Math.random() * Math.PI * 2;
        const radius = THREE.MathUtils.lerp(config.patrolRadiusMin, config.patrolRadiusMax, Math.random());
        const target = { x: homeX + Math.cos(angle) * radius, z: homeZ + Math.sin(angle) * radius };
        if (Math.abs(target.x) <= PLAYABLE_BOUNDARY - config.obstacleRadius
            && Math.abs(target.z) <= PLAYABLE_BOUNDARY - config.obstacleRadius
            && isLandAccessible(target.x, target.z, config.obstacleRadius)) return target;
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

let SMOKE_PUFF_TEXTURE = null;
function getSmokePuffTexture() {
    if (SMOKE_PUFF_TEXTURE) return SMOKE_PUFF_TEXTURE;
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, size, size);

    function drawCartoonCircularPuff(ox, oy, fillStyle, strokeStyle, strokeWidth) {
        ctx.fillStyle = fillStyle;
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = strokeWidth;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        const mainRadius = 48;
        const outerRadius = 40;
        const count = 7;
        const circles = [{ x: ox, y: oy, r: mainRadius }];

        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;
            const dist = 34;
            circles.push({
                x: ox + Math.cos(angle) * dist,
                y: oy + Math.sin(angle) * dist,
                r: outerRadius
            });
        }

        if (strokeWidth > 0) {
            ctx.beginPath();
            circles.forEach((c) => {
                ctx.moveTo(c.x + c.r, c.y);
                ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
            });
            ctx.stroke();
        }

        circles.forEach((c) => {
            ctx.beginPath();
            ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    const cx = size / 2;
    const cy = size / 2;
    // Outer bold cartoon stroke (slate gray outline)
    drawCartoonCircularPuff(cx, cy, '#ffffff', 'rgba(100, 116, 139, 0.75)', 12);
    // Inner solid white fill
    drawCartoonCircularPuff(cx, cy, '#ffffff', '#ffffff', 0);

    SMOKE_PUFF_TEXTURE = new THREE.CanvasTexture(canvas);
    SMOKE_PUFF_TEXTURE.colorSpace = THREE.SRGBColorSpace;
    SMOKE_PUFF_TEXTURE.needsUpdate = true;
    return SMOKE_PUFF_TEXTURE;
}

function createRunSmokeSystem(scene) {
    const poolSize = 20;
    const puffs = [];
    const geometry = new THREE.PlaneGeometry(1.85, 1.85);
    const texture = getSmokePuffTexture();

    for (let i = 0; i < poolSize; i++) {
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            opacity: 0,
            depthWrite: false,
            toneMapped: false
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.visible = false;
        mesh.renderOrder = 4;
        scene.add(mesh);
        puffs.push({ mesh, material, life: 0, maxLife: 0.4, initialScale: 1, active: false });
    }

    let spawnTimer = 0;

    return {
        update: (dt, playerPos, isRunning, camera) => {
            if (isRunning) {
                spawnTimer += dt;
                if (spawnTimer >= 0.065) {
                    spawnTimer = 0;
                    const puff = puffs.find((p) => !p.active);
                    if (puff) {
                        const inRiver = isRiverArea(playerPos.x, playerPos.z, 0.4);
                        puff.active = true;
                        puff.life = 0;
                        puff.maxLife = inRiver ? (0.28 + Math.random() * 0.18) : (0.35 + Math.random() * 0.2);
                        puff.initialScale = inRiver ? (0.85 + Math.random() * 0.4) : (0.75 + Math.random() * 0.45);
                        puff.mesh.position.set(
                            playerPos.x + (Math.random() - 0.5) * 0.4,
                            playerPos.y + (inRiver ? 0.08 : 0.2),
                            playerPos.z + (Math.random() - 0.5) * 0.4
                        );
                        puff.mesh.scale.setScalar(0.2);
                        puff.mesh.visible = true;
                        puff.material.opacity = 0.95;

                        if (inRiver) {
                            // Cartoon splash blue tint when running at/in the river
                            puff.material.color.set('#38bdf8');
                        } else {
                            // Classic white cartoon smoke puff on land
                            puff.material.color.set('#ffffff');
                        }
                    }
                }
            }

            puffs.forEach((puff) => {
                if (!puff.active) return;
                puff.life += dt;
                const progress = puff.life / puff.maxLife;
                if (progress >= 1) {
                    puff.active = false;
                    puff.mesh.visible = false;
                    return;
                }
                const popScale = Math.sin(Math.min(1, progress * 2.2) * Math.PI * 0.5);
                const currentScale = (puff.initialScale + progress * 1.35) * popScale;
                puff.mesh.scale.setScalar(currentScale);
                puff.mesh.position.y += dt * 0.95;

                puff.material.opacity = progress > 0.45 ? ((1 - progress) / 0.55) * 0.9 : 0.9;

                if (camera) {
                    puff.mesh.quaternion.copy(camera.quaternion);
                }
            });
        },
        dispose: () => {
            puffs.forEach((puff) => {
                scene.remove(puff.mesh);
                puff.material.dispose();
            });
            geometry.dispose();
        }
    };
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

function getStoredPlayerName() {
    return getPlayerProfile().name;
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

async function loadStaffNpc(scene, isMobile, config) {
    const loader = createGLTFLoader();
    const staffUrl = await resolveAssetUrl(`/models/characters/${config.file}`);
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
                const targetHeight = isMobile ? 1.6 : config.targetHeight;
                const scale = THREE.MathUtils.clamp(targetHeight / sourceHeight, 0.02, 5);
                model.scale.multiplyScalar(scale);

                const terrainY = getTerrainHeight(config.position.x, config.position.z);
                const fittedBox = new THREE.Box3().setFromObject(model);
                const baseYOffset = -fittedBox.min.y;
                model.position.set(
                    config.position.x,
                    terrainY + baseYOffset,
                    config.position.z
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

                const initialTarget = chooseNextStaffPatrolTarget(config, config.position.x, config.position.z);

                resolve({
                    model,
                    shadow,
                    mixer,
                    actions: {
                        idle: idleAction,
                        walk: walkAction
                    },
                    currentAction: idleAction,
                    id: config.id,
                    config,
                    x: config.position.x,
                    z: config.position.z,
                    baseYOffset,
                    homeX: config.position.x,
                    homeZ: config.position.z,
                    targetX: initialTarget.x,
                    targetZ: initialTarget.z,
                    pauseUntil: performance.now() * 0.001 + 0.9,
                    moving: false,
                    moveSpeed: config.moveSpeed,
                    turnSpeed: config.turnSpeed,
                    stopDistance: config.stopDistance,
                    facingOffset: config.facingOffset,
                    interactionRadius: config.interactionRadius,
                    obstacleRadius: config.obstacleRadius,
                    name: config.name,
                    role: config.role
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
    const preCameraModeRef = useRef('third');
    const showNpcDialogueRef = useRef(false);
    const nearbyAnimalRef = useRef(null);
    const nearbyStaffRef = useRef(null);
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

    const isEnteringGameRef = useRef(false);
    const [isEnteringGame, setIsEnteringGame] = useState(false);
    const [enterFadeActive, setEnterFadeActive] = useState(false);

    const [settingsOpen, setSettingsOpen] = useState(false);
    const [tasksOpen, setTasksOpen] = useState(false);
    const [showQuitModal, setShowQuitModal] = useState(false);
    const [showResetTasksModal, setShowResetTasksModal] = useState(false);
    const [playerGender, setPlayerGender] = useState(() => getPlayerProfile().gender);
    const [playerDetailsOpen, setPlayerDetailsOpen] = useState(false);
    const [cameraMode, setCameraMode] = useState('third');
    const [characterReady, setCharacterReady] = useState(false);
    const [showAllFedCelebration, setShowAllFedCelebration] = useState(false);
    const [showCertificate, setShowCertificate] = useState(false);
    const [nearbyStaff, setNearbyStaff] = useState(null);
    const [activeStaff, setActiveStaff] = useState(null);
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
    const [isCameraModeOpen, setIsCameraModeOpen] = useState(false);
    const [cameraFlash, setCameraFlash] = useState(false);
    const [feedingProgress, setFeedingProgress] = useState(0);
    const [isFeeding, setIsFeeding] = useState(false);
    const allFedCelebratedRef = useRef(false);
    const feedingInProgressRef = useRef(null);
    const feedingTimerRef = useRef(null);
    const feedingFrameRef = useRef(null);
    const feedingStartedAtRef = useRef(0);
    const modalOpen = settingsOpen || playerDetailsOpen || tasksOpen || showNpcDialogue || bookOpen || photoPreview || showQuitModal || showResetTasksModal || showAllFedCelebration || showCertificate;
    const interfaceOpen = modalOpen || isCameraModeOpen;

    // Added obstacles array to state to hold tree/rock/bush positions
    const gameStateRef = useRef({
        keys: {}, yaw: 0, pitch: 0,
        mX: 0, mY: 0, sActive: false, lActive: false, lx: 0, ly: 0,
        velocityY: 0, isJumping: false, isGrounded: true,
        sensitivity: getSettings().sensitivity || 1.0,
        playerHeight: PLAYER_HEIGHT,
        playerMoveSpeed: 0,
        playerIsMoving: false,
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
        staffNpcs: [],
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
            const animalRadius = animal.radius || animal.config?.collisionRadius || 1.2;
            const maxInteractDist = Math.max(5.5, animalRadius + 2.5);
            const maxInteractDistSq = maxInteractDist * maxInteractDist;
            if (distSq <= maxInteractDistSq && distSq < nearestDistSq) {
                nearest = animal;
                nearestDistSq = distSq;
            }
        }
        return nearest;
    }, []);

    const checkNearbyStaff = useCallback((playerPosition, staffNpcs) => {
        if (!playerPosition || !staffNpcs?.length) return null;
        let nearest = null;
        let nearestDistance = Infinity;
        staffNpcs.forEach((staffNpc) => {
            const dx = playerPosition.x - staffNpc.x;
            const dz = playerPosition.z - staffNpc.z;
            const distance = dx * dx + dz * dz;
            const closeRadiusSq = (staffNpc.interactionRadius || 6.5) ** 2;
            if (distance <= closeRadiusSq && distance < nearestDistance) {
                nearest = staffNpc;
                nearestDistance = distance;
            }
        });
        return nearest;
    }, []);

    const ambienceLoadingRef = useRef(false);
    const birdChirpingRef = useRef(null);
    const riverAudioRef = useRef(null);
    const runAudioRef = useRef(null);

    const getRunAudio = useCallback(() => {
        if (!runAudioRef.current) {
            const fallbackPath = '/audio/running-effect-sound.mp3';
            const audio = new Audio(fallbackPath);
            audio.loop = true;
            audio.preload = 'auto';
            audio.volume = getSfxVolume() * 1.0;
            audio.setAttribute('playsinline', 'true');
            runAudioRef.current = audio;

            resolveAssetUrl(fallbackPath).then((assetUrl) => {
                if (runAudioRef.current === audio && assetUrl && audio.paused) {
                    audio.src = assetUrl;
                }
            }).catch(() => {});
        }
        return runAudioRef.current;
    }, []);

    const getRiverAudio = useCallback(() => {
        if (!riverAudioRef.current) {
            const fallbackPath = '/audio/water-river.mp3';
            const audio = new Audio(fallbackPath);
            audio.loop = true;
            audio.preload = 'auto';
            audio.volume = 0;
            audio.setAttribute('playsinline', 'true');
            riverAudioRef.current = audio;

            resolveAssetUrl(fallbackPath).then((assetUrl) => {
                if (riverAudioRef.current === audio && assetUrl && audio.paused) {
                    audio.src = assetUrl;
                }
            }).catch(() => {});
        }
        return riverAudioRef.current;
    }, []);

    const getBirdChirping = useCallback(() => {
        if (!birdChirpingRef.current) {
            const fallbackPath = '/audio/bird-chirping.mp3';
            const audio = new Audio(fallbackPath);
            audio.loop = true;
            audio.preload = 'auto';
            audio.volume = getAmbienceVolume() * 0.75;
            audio.setAttribute('playsinline', 'true');
            birdChirpingRef.current = audio;

            resolveAssetUrl(fallbackPath).then((assetUrl) => {
                if (birdChirpingRef.current === audio && assetUrl && audio.paused) {
                    audio.src = assetUrl;
                }
            }).catch(() => {});
        }
        return birdChirpingRef.current;
    }, []);

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
                    if (ambienceRef.current === audio && assetUrl && audio.paused) {
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
                    if (musicRef.current === audio && assetUrl && audio.paused) {
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
        if (audio && (audio.src || audio.currentSrc)) {
            audio.volume = vol;
            if (vol <= 0) {
                audio.pause();
            } else if (audio.paused) {
                try { await audio.play(); } catch {}
            }
        }
        const birdAudio = getBirdChirping();
        if (birdAudio && (birdAudio.src || birdAudio.currentSrc)) {
            birdAudio.volume = vol * 0.75;
            if (vol <= 0) {
                birdAudio.pause();
            } else if (birdAudio.paused) {
                try { await birdAudio.play(); } catch {}
            }
        }
    }, [getAmbience, getBirdChirping]);

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
        if (audio) {
            audio.pause();
            if (!keepPosition) audio.currentTime = 0;
        }
        if (birdChirpingRef.current) {
            birdChirpingRef.current.pause();
            if (!keepPosition) birdChirpingRef.current.currentTime = 0;
        }
        if (riverAudioRef.current) {
            riverAudioRef.current.pause();
            if (!keepPosition) riverAudioRef.current.currentTime = 0;
        }
        if (runAudioRef.current) {
            runAudioRef.current.pause();
            if (!keepPosition) runAudioRef.current.currentTime = 0;
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
            const runKeys = actionKeys.filter(k => k.includes('run') || k.includes('sprint') || k.includes('jog'));
            const walkKeys = actionKeys.filter(k => k.includes('walk') || k.includes('move') || k.includes('strafe'));
            const idleKeys = actionKeys.filter(k => k.includes('idle') || k.includes('stand') || k.includes('breath'));

            if (name === 'run' && runKeys.length > 0) nextAction = actions[runKeys[0]];
            else if (name === 'run' && walkKeys.length > 0) nextAction = actions[walkKeys[0]];
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
            state.playerShadow = createContactShadow(1.7, 0.25);
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
            setPlayerGender(characterOption.id);
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
            const staffPromise = Promise.all(STAFF_NPC_CONFIGS.map((config) => loadStaffNpc(scene, isMobile, config)));
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
            state.staffNpcs = staffResult.filter(Boolean);

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

            state.grass = await createGrass(scene, isMobile ? 1200 : 2500);
            setLoadProgress(55);

            const initialSfxVolume = getSfxVolume();
            // Pass the obstacles and initial volume to the animals
            state.animals = await loadGLTFAnimals(scene, state.obstacles, initialSfxVolume);
            setLoadProgress(80);

            state.clouds = createClouds(scene, isMobile ? 12 : 18);
            setLoadProgress(95);

            const handleMovement = createMovementHandler(state.playerAnchor, state);
            const smokeSystem = createRunSmokeSystem(scene);
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
                state.staffNpcs.forEach((staffNpc) => {
                    const obstacle = obstaclePool[obstacleCount] || (obstaclePool[obstacleCount] = {});
                    obstacle.x = staffNpc.x;
                    obstacle.z = staffNpc.z;
                    obstacle.radius = staffNpc.obstacleRadius;
                    animalObstacles[obstacleCount] = obstacle;
                    obstacleCount += 1;
                });
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
                        } else {
                            playPlayerAction('run');
                        }
                    }
                    state.playerMixer.update(dt);
                }

                if (state.playerCharacter) {
                    smokeSystem.update(dt, state.playerCharacter.position, state.playerIsMoving && state.isGrounded, camera);
                }

                state.staffNpcs.forEach((npc) => {
                    npc.mixer?.update(dt);
                    if (!npc.model) return;
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
                            const nextTarget = chooseNextStaffPatrolTarget(npc.config, npc.homeX, npc.homeZ);
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
                                const nextTarget = chooseNextStaffPatrolTarget(npc.config, npc.homeX, npc.homeZ);
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
                });

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
                    lookTarget.set(playerPosition.x, smoothedFollowY + 1.85, playerPosition.z);
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

                const sfxVol = getSfxVolume();
                state.animals.forEach(a => {
                    if (a.group) {
                        const dx = playerPosition.x - a.group.position.x;
                        const dy = playerPosition.y - a.group.position.y;
                        const dz = playerPosition.z - a.group.position.z;
                        const distSq = dx * dx + dy * dy + dz * dz;
                        const updateRange = isMobile ? 130 : 200;
                        if (distSq < updateRange * updateRange) {
                            a.update(now * 0.001, dt, playerPosition, soundEnabledRef.current ? sfxVol : 0);
                        }
                    }
                });
                state.ambientBirds.forEach((bird) => bird.update(now * 0.001, dt));

                // World animation continues while input is locked by the book overlay.
                updateRiver(state.river, dt, gameStartedRef.current);
                updateGrass(state.grass, now * 0.001);

                const riverAudio = getRiverAudio();
                if (riverAudio) {
                    const ambVol = getAmbienceVolume();
                    if (ambVol > 0 && playerPosition && gameStartedRef.current) {
                        const riverMetrics = getRiverMetrics(playerPosition.x, playerPosition.z);
                        const distToRiver = riverMetrics.lateral;
                        const riverProx = THREE.MathUtils.clamp(1 - distToRiver / 55, 0, 1);
                        riverAudio.volume = ambVol * riverProx * 0.85;
                        if (riverProx > 0.02 && riverAudio.paused) {
                            try { riverAudio.play().catch(() => {}); } catch {}
                        } else if (riverProx <= 0.02 && !riverAudio.paused) {
                            riverAudio.pause();
                        }
                    } else if (!riverAudio.paused) {
                        riverAudio.pause();
                    }
                }

                const runAudio = getRunAudio();
                if (runAudio) {
                    const isRunning = state.playerIsMoving && state.isGrounded && soundEnabledRef.current && gameStartedRef.current && !document.hidden;
                    const sfxVol = getSfxVolume();
                    if (isRunning && sfxVol > 0) {
                        runAudio.volume = sfxVol * 1.0;
                        if (runAudio.paused) {
                            try { runAudio.play().catch(() => {}); } catch {}
                        }
                    } else if (!runAudio.paused) {
                        runAudio.pause();
                    }
                }

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
                    const nextNearbyStaff = checkNearbyStaff(playerPosition, state.staffNpcs);
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
                smokeSystem.dispose();
                state.animals.forEach(a => a.dispose?.());
                disposePlayerCharacter();
                state.staffNpcs.forEach((staffNpc) => {
                    staffNpc.shadow?.parent?.remove(staffNpc.shadow);
                    staffNpc.shadow?.geometry?.dispose?.();
                    staffNpc.shadow?.material?.dispose?.();
                    staffNpc.mixer?.stopAllAction();
                    staffNpc.model?.traverse((child) => {
                        if (!child.isMesh) return;
                        child.geometry?.dispose?.();
                        if (Array.isArray(child.material)) {
                            child.material.forEach((m) => m?.dispose?.());
                        } else {
                            child.material?.dispose?.();
                        }
                    });
                    state.scene?.remove(staffNpc.model);
                });
                state.staffNpcs = [];
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

    const handleStartGame = useCallback(() => {
        if (isEnteringGameRef.current) return;
        isEnteringGameRef.current = true;
        setIsEnteringGame(true);

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                setEnterFadeActive(true);
            });
        });

        setTimeout(() => {
            const state = gameStateRef.current;
            const profile = getPlayerProfile();
            const characterOption = getPlayerModel(profile.gender);

            gameStartedRef.current = true;
            nearbyAnimalRef.current = null;
            nearbyStaffRef.current = null;
            soundEnabledRef.current = getSfxVolume() > 0;
            setPlayerName(profile.name);
            setShowMenu(false);
            setGameStarted(true);
            setTasks(getTasks());
            // Third person is the default exploration view.
            setCameraMode('third');
            setPlayerGender(profile.gender);
            setCharacterReady(false);
            setNearbyStaff(null);
            setShowNpcDialogue(false);
            setNpcDialogueNodeId('root');
            state.controlsEnabled = false;

            if (characterOption) {
                handleSelectCharacter(characterOption);
            }

            playAmbience();
            playMusic();

            setTimeout(() => {
                setEnterFadeActive(false);
                setTimeout(() => {
                    setIsEnteringGame(false);
                    isEnteringGameRef.current = false;
                    state.controlsEnabled = true;
                }, 400);
            }, 250);
        }, 380);
    }, [playAmbience, playMusic, handleSelectCharacter]);

    const handleProfileSaved = useCallback((profile) => {
        setPlayerName(profile.name);
        setPlayerGender(profile.gender);
        if (gameStartedRef.current && profile.gender !== playerGender) {
            const characterOption = getPlayerModel(profile.gender);
            if (characterOption) handleSelectCharacter(characterOption);
        }
    }, [handleSelectCharacter, playerGender]);

    const saveSessionSnapshot = useCallback(() => {
        const state = gameStateRef.current;
        if (!state?.playerAnchor) return;
        const position = state.playerAnchor.position;

        savePlayerSession({
            position: { x: position.x, y: position.y, z: position.z },
            yaw: state.yaw,
            pitch: state.pitch,
            cameraMode: cameraModeRef.current,
        });
    }, []);
    const closeInterfaces = useCallback(() => {
        setSettingsOpen(false);
        setTasksOpen(false);
        setShowNpcDialogue(false);
        setBookOpen(false);
        setPhotoPreview('');
        if (isCameraModeOpen) {
            setIsCameraModeOpen(false);
            setCameraMode(preCameraModeRef.current || 'third');
        }
        clearFeedingTimer();
    }, [clearFeedingTimer, isCameraModeOpen]);
    const handleMenuClick = useCallback(() => { closeInterfaces(); setSettingsOpen(true); }, [closeInterfaces]);
    const handleTasksClick = useCallback(() => {
        closeInterfaces();
        playGameButtonSfx('task-list');
        setTasksOpen(true);
    }, [closeInterfaces]);
    const handleOpenCameraView = useCallback(() => {
        closeInterfaces();
        playGameButtonSfx('confirm');
        preCameraModeRef.current = cameraModeRef.current;
        setCameraMode('first');
        setIsCameraModeOpen(true);
        const state = gameStateRef.current;
        if (state) state.controlsEnabled = true;
    }, [closeInterfaces]);
    const handleCloseCameraView = useCallback(() => {
        setIsCameraModeOpen(false);
        setCameraMode(preCameraModeRef.current || 'third');
    }, []);
    const handleCapturePhoto = useCallback(() => {
        const state = gameStateRef.current;
        if (!state.renderer || !state.scene || !state.camera) return;
        try {
            const renderer = state.renderer;
            renderer.render(state.scene, state.camera);
            const dataUrl = renderer.domElement.toDataURL('image/png');

            setCameraFlash(true);
            window.setTimeout(() => setCameraFlash(false), 180);
            playGameButtonSfx('confirm');

            setIsCameraModeOpen(false);
            setCameraMode(preCameraModeRef.current || 'third');
            setPhotoPreview(dataUrl);
        } catch (error) {
            console.error('Unable to capture game scene:', error);
            setIsCameraModeOpen(false);
            setCameraMode(preCameraModeRef.current || 'third');
        }
    }, []);
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
        setCharacterReady(false);
         setCameraMode('third');
        setShowAllFedCelebration(false);
        setShowCertificate(false);
        setNearbyStaff(null);
        setActiveStaff(null);
        setShowNpcDialogue(false);
        setNpcDialogueNodeId('root');
        setBookOpen(false);
        setGameStarted(false);
        setShowMenu(true);
        playMusic();
    }, [clearFeedingTimer, playMusic, stopGameplaySounds]);
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
        setActiveStaff(nearbyStaff);
        setNpcDialogueNodeId('root');
        setShowNpcDialogue(true);
        if (nearbyStaff.id === 'lino') {
            const nextMission = saveMissionProgress({ talkedToRanger: true });
            missionProgressRef.current = nextMission;
            setMissionProgress(nextMission);
        }
    }, [closeInterfaces, nearbyStaff, gameStarted, characterReady]);

    const closeNpcDialogue = useCallback(() => {
        setShowNpcDialogue(false);
        setActiveStaff(null);
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
        const state = gameStateRef.current;
        state.controlsEnabled = false;
        state.mX = 0;
        state.mY = 0;
        state.keys.w = false;
        state.keys.a = false;
        state.keys.s = false;
        state.keys.d = false;
        setBookOpen(true);
    }, [closeInterfaces, gameStarted, characterReady]);

    const closeBook = useCallback(() => {
        setBookOpen(false);
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
        const syncProfile = () => {
            const profile = getPlayerProfile();
            setPlayerName(profile.name);
            setPlayerGender(profile.gender);
        };
        syncProfile();
        window.addEventListener('storage', syncProfile);
        window.addEventListener(PLAYER_PROFILE_CHANGE_EVENT, syncProfile);
        return () => {
            window.removeEventListener('storage', syncProfile);
            window.removeEventListener(PLAYER_PROFILE_CHANGE_EVENT, syncProfile);
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
            nearbyStaffRef.current = null;
            soundEnabledRef.current = false;
            stopGameplaySounds(false);
            ambienceRef.current = null;
        setNearbyStaff(null);
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
        if (modalOpen) {
            state.controlsEnabled = false;
            return;
        }

        if (gameStarted && characterReady) {
            state.controlsEnabled = true;
        }
    }, [modalOpen, gameStarted, characterReady]);

    useEffect(() => {
        if (!gameStarted && !showMenu) return;

        const applyMusicState = () => {
            if (document.hidden) {
                stopAmbience(true);
                stopMusic(true);
                return;
            }

            const ambVol = getAmbienceVolume();
            const musVol = getMusicVolume();

            if (gameStarted && ambVol > 0) {
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
    }, [gameStarted, showMenu, playAmbience, playMusic, stopAmbience, stopMusic, clearFeedingTimer]);

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
    useEffect(() => {
        if (interfaceOpen || document.hidden) clearFeedingTimer();
    }, [interfaceOpen, clearFeedingTimer]);
    const missionSteps = [
        { title: 'Talk to Ranger Lino', objective: 'Say hello and get your ranger mission.', done: missionProgress.talkedToRanger, icon: '👋' },
        { title: 'Feed the horse', objective: 'Find the friendly horse and hold Feed.', done: missionProgress.fedHorse, icon: '🐴' },
        { title: 'Feed the rabbit', objective: 'Find a rabbit and hold Feed for a gentle snack.', done: missionProgress.fedRabbit, icon: '🐇' }
    ];
    const missionComplete = missionSteps.every((step) => step.done);
    const npcDialogueNode = activeStaff?.id === 'lino' && npcDialogueNodeId === 'mission'
        ? { ...getStaffDialogueNode('lino', 'mission'), message: missionComplete ? 'You did it! The horse and rabbit are cared for. Your ranger reward is safe in your progress.' : 'Here is your ranger trail. Complete each step in order, and I will keep your progress safe.' }
        : getStaffDialogueNode(activeStaff?.id, npcDialogueNodeId);
    const canShowNpcPrompt = gameStarted
        && characterReady
        && nearbyStaff
        && !showNpcDialogue;

    return (
        <div className="relative h-dvh w-full overflow-hidden bg-linear-to-b from-sky-300 to-sky-100 touch-none overscroll-none">
            <RotateDeviceOverlay />
            {cameraFlash ? <div className="pointer-events-none fixed inset-0 z-130 bg-white" aria-hidden="true" /> : null}
            {isEnteringGame && (
                <div
                    className={cx(
                        "fixed inset-0 z-140 pointer-events-none bg-linear-to-b from-[#70e0ff] via-[#38bdf8] to-[#16684a] transition-opacity duration-400 ease-in-out",
                        enterFadeActive ? "opacity-100" : "opacity-0"
                    )}
                    aria-hidden="true"
                />
            )}
            <div ref={containerRef} className="absolute inset-0" />
            {isLoading && <LoadingScreen />}
            {!isLoading && showMenu && (
                <MainMenu
                    onStart={handleStartGame}
                    onMenuInteraction={playMusic}
                    isVisible={showMenu}
                    onProfileSaved={handleProfileSaved}
                />
            )}
            {gameStarted && (
                <>
                    {!isCameraModeOpen ? (
                        <GameHUD
                            playerName={playerName || 'Explorer'}
                            onMenuClick={handleMenuClick}
                            onPlayerDetails={() => setPlayerDetailsOpen(true)}
                            onTasksClick={handleTasksClick}
                            onBook={openBook}
                            onCamera={handleOpenCameraView}
                            completedTasks={completedCount}
                            totalTasks={totalCount}
                            isTouchDevice={isTouchDevice}
                        />
                    ) : null}
                     {!interfaceOpen ? <Joystick baseRef={baseRef} stickRef={stickRef} isTouchDevice={isTouchDevice} /> : null}
                      {!interfaceOpen ? <JumpButton jumpRef={jumpRef} isTouchDevice={isTouchDevice} /> : null}
                     <HoldToFeedControl
                         visible={Boolean(nearbyAnimal && !nearbyStaff && !isDangerousAnimalNearby && gameStarted && characterReady && !interfaceOpen)}
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
                    <TaskPanel
                        isOpen={tasksOpen}
                        onClose={() => setTasksOpen(false)}
                        tasks={tasks}
                        onTaskClick={() => setTasksOpen(false)}
                        onResetTasks={handleResetTasks}
                    />
                    <NPCInteractionPrompt
                        visible={canShowNpcPrompt}
                        onInteract={openNpcDialogue}
                        npcName={nearbyStaff?.name}
                        isTouchDevice={isTouchDevice}
                    />
                    <NPCDialogueModal
                        isOpen={showNpcDialogue}
                        onClose={closeNpcDialogue}
                        npcName={activeStaff?.name}
                        npcRole={activeStaff?.role}
                        message={npcDialogueNode.message}
                        choices={npcDialogueNode.choices}
                        onSelectChoice={handleNpcChoice}
                        missionSteps={activeStaff?.id === 'lino' ? missionSteps : []}
                        animalEntries={activeStaff?.id === 'lino' && npcDialogueNodeId === 'animals' ? discoveredAnimals.map((name) => getAnimalBookEntry(name)).filter(Boolean) : []}
                        onOpenAnimalBook={() => { closeNpcDialogue(); openBook(); }}
                    />
                    <PlayerDetailsModal isOpen={playerDetailsOpen} onClose={() => setPlayerDetailsOpen(false)} onSave={handleProfileSaved} />
                     <FeedingSuccessNotification visible={feedingSuccess.visible} animalName={feedingSuccess.animalName} onHide={handleHideFeedSuccess} />
                    <CameraModeOverlay isOpen={isCameraModeOpen} onClose={handleCloseCameraView} onCapture={handleCapturePhoto} />
                    <CameraPreview dataUrl={photoPreview} onSave={savePhoto} onRetake={() => { setPhotoPreview(''); handleOpenCameraView(); }} onClose={() => setPhotoPreview('')} />
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
