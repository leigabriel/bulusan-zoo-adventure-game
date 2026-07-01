/* eslint-disable react-refresh/only-export-components */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { resolveAssetUrl } from '../utils/localAssets.js';
import { ActionButton, IconButton, ModalShell, SideSheet, SurfacePanel, cx } from './UIComponents.jsx';

const SETTINGS_KEY = 'minizoo_settings';
const SETTINGS_CHANGE_EVENT = 'minizoo-settings-changed';
const PLAYER_NAME_KEY = 'minizoo_player_name';
const PLAYER_NAME_CHANGE_EVENT = 'minizoo-player-name-changed';

const SFX_FILES = {
    tap: '/audio/click.mp3',
    feed: '/audio/feed.wav',
    confirm: '/audio/click.mp3',
    'task-complete': '/audio/finish-task.mp3',
};

const uiAudioTemplates = {};

function readPlayerName() {
    try {
        return (localStorage.getItem(PLAYER_NAME_KEY) || '').trim();
    } catch {
        return '';
    }
}

function savePlayerName(name) {
    const cleaned = String(name || '').trim().slice(0, 24);
    if (!cleaned) return '';

    try {
        localStorage.setItem(PLAYER_NAME_KEY, cleaned);
        window.dispatchEvent(new Event(PLAYER_NAME_CHANGE_EVENT));
    } catch {
    }

    return cleaned;
}

function readSettings() {
    try {
        const raw = localStorage.getItem(SETTINGS_KEY);
        return raw ? JSON.parse(raw) : { musicEnabled: true, soundEnabled: true };
    } catch {
        return { musicEnabled: true, soundEnabled: true };
    }
}

function persistSettings(updated) {
    try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
        window.dispatchEvent(new Event(SETTINGS_CHANGE_EVENT));
    } catch {
    }
}

function isUISoundEnabled() {
    try {
        return readSettings().soundEnabled !== false;
    } catch {
        return true;
    }
}

function getUIButtonAudioTemplate(kind = 'tap') {
    const src = SFX_FILES[kind] || SFX_FILES.tap;
    if (!uiAudioTemplates[src]) {
        const template = new Audio(src);
        template.preload = 'auto';
        uiAudioTemplates[src] = template;
        resolveAssetUrl(src).then((url) => {
            if (url) template.src = url;
        }).catch(() => { });
    }
    return uiAudioTemplates[src];
}

function useIsTouchDevice() {
    const [isTouch, setIsTouch] = useState(() => {
        if (typeof window === 'undefined') return false;
        return window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
    });

    useEffect(() => {
        const update = () => {
            setIsTouch(window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0);
        };

        window.addEventListener('resize', update);
        window.addEventListener('orientationchange', update);
        return () => {
            window.removeEventListener('resize', update);
            window.removeEventListener('orientationchange', update);
        };
    }, []);

    return isTouch;
}

function useFullscreen() {
    const [isFullscreen, setIsFullscreen] = useState(() => !!document.fullscreenElement);

    useEffect(() => {
        const onChange = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', onChange);
        return () => document.removeEventListener('fullscreenchange', onChange);
    }, []);

    const toggleFullscreen = useCallback(() => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => { });
            return;
        }
        document.exitFullscreen().catch(() => { });
    }, []);

    return { isFullscreen, toggleFullscreen };
}

async function requestLandscapeOrientation() {
    try {
        if (!document.fullscreenElement) {
            await document.documentElement.requestFullscreen();
        }
        if (screen.orientation && typeof screen.orientation.lock === 'function') {
            await screen.orientation.lock('landscape');
            return true;
        }
        return false;
    } catch {
        return false;
    }
}

function ToggleRow({ label, description, enabled, onToggle }) {
    return (
        <button
            type="button"
            data-ui-button="true"
            onClick={onToggle}
            className="flex min-h-11 w-full items-center justify-between rounded-2xl border border-emerald-200/80 bg-white px-4 py-3 text-left shadow-[0_10px_24px_-20px_rgba(5,150,105,0.7)] transition hover:border-emerald-300 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/80 focus-visible:ring-offset-1"
        >
            <span className="min-w-0">
                <span className="block truncate text-sm font-black tracking-wide text-emerald-950">{label}</span>
                <span className="mt-0.5 block text-xs font-semibold text-emerald-700/80">{description}</span>
            </span>

            <span
                className={cx(
                    'relative h-6 w-11 rounded-full transition',
                    enabled ? 'bg-emerald-500' : 'bg-emerald-200',
                )}
            >
                <span
                    className={cx(
                        'absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-[0_2px_8px_rgba(15,23,42,0.22)] transition-transform',
                        enabled ? 'translate-x-5' : 'translate-x-0',
                    )}
                />
            </span>
        </button>
    );
}

function ProgressChip({ completed, total, className = '' }) {
    return (
        <span className={cx('rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-black uppercase tracking-widest text-emerald-800', className)}>
            {completed}/{total} fed
        </span>
    );
}

function HowToPlayContent() {
    return (
        <div className="space-y-3 text-sm text-slate-700">
            <p className="font-semibold">Explore Bulusan Zootopia Adventure, feed each animal, and complete all tasks to unlock your certificate.</p>

            <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Movement</p>
                    <p className="mt-1 font-semibold">Desktop: W A S D, Mouse look, Space jump</p>
                    <p className="mt-1 font-semibold">Mobile: Joystick + Jump button</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Interactions</p>
                    <p className="mt-1 font-semibold">E = animal info, F = feed animal, T = talk to Ranger Lino, V = switch camera</p>
                </div>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                <p className="font-black text-emerald-800">Goal</p>
                <p className="mt-1 font-semibold text-emerald-900">Feed every animal listed in Tasks, then claim your completion certificate.</p>
            </div>
        </div>
    );
}

function ConfirmModal({
    isOpen,
    onConfirm,
    onCancel,
    title,
    message,
    confirmLabel,
    confirmVariant = 'danger',
}) {
    return (
        <ModalShell isOpen={isOpen} onClose={onCancel} title={title} size="sm">
            <p className="text-sm font-semibold leading-relaxed text-slate-600">{message}</p>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <ActionButton variant="secondary" onClick={onCancel}>Cancel</ActionButton>
                <ActionButton variant={confirmVariant} onClick={onConfirm}>{confirmLabel}</ActionButton>
            </div>
        </ModalShell>
    );
}

export function playGameButtonSfx(kind = 'tap') {
    if (!isUISoundEnabled()) return;

    try {
        const template = getUIButtonAudioTemplate(kind);
        const src = template.currentSrc || template.src || SFX_FILES[kind] || SFX_FILES.tap;
        const audio = new Audio(src);
        audio.volume = kind === 'feed' || kind === 'task-complete' || kind === 'confirm' ? 1 : 0.9;
        const playPromise = audio.play();
        if (playPromise && typeof playPromise.catch === 'function') {
            playPromise.catch(() => { });
        }
    } catch {
    }
}

export function LoadingScreen({ progress = 0 }) {
    const safeProgress = Number.isFinite(progress) ? Math.max(0, Math.min(100, progress)) : 0;
    const fillStyle = {
        clipPath: `inset(${100 - safeProgress}% 0 0 0)`,
    };

    return (
        <div className="absolute inset-0 z-50 overflow-hidden" style={{ backgroundImage: "url('/bg.webp')", backgroundSize: 'cover', backgroundPosition: 'center' }}>
            <div className="absolute inset-0 z-0" aria-hidden="true">
                <div className="absolute right-[6%] top-1/2 -translate-y-1/2 opacity-15 max-sm:scale-75">
                    <svg viewBox="0 0 70 70" width="90" height="90">
                        <circle cx="20" cy="50" r="10" fill="none" stroke="black" strokeWidth="3.5" />
                        <circle cx="50" cy="20" r="10" fill="none" stroke="black" strokeWidth="3.5" />
                        <circle cx="20" cy="-10" r="10" fill="none" stroke="black" strokeWidth="3.5" />
                        <circle cx="-10" cy="20" r="10" fill="none" stroke="black" strokeWidth="3.5" />
                    </svg>
                </div>

                <div className="absolute bottom-[10%] left-[18%] opacity-15 max-sm:hidden">
                    <svg viewBox="0 0 60 60" width="70" height="70">
                        <circle cx="30" cy="30" r="27" fill="none" stroke="black" strokeWidth="3" />
                        <circle cx="30" cy="30" r="12" fill="none" stroke="black" strokeWidth="3" />
                        <circle cx="30" cy="30" r="3" fill="black" />
                    </svg>
                </div>

                <div className="absolute bottom-[10%] right-[18%] opacity-15 max-sm:hidden">
                    <svg viewBox="0 0 60 60" width="70" height="70">
                        <circle cx="30" cy="30" r="27" fill="none" stroke="black" strokeWidth="3" />
                        <circle cx="30" cy="30" r="12" fill="none" stroke="black" strokeWidth="3" />
                        <circle cx="30" cy="30" r="3" fill="black" />
                    </svg>
                </div>

                <div className="absolute top-[10%] left-[22%] opacity-15 max-sm:hidden">
                    <svg viewBox="0 0 60 16" width="80" height="22">
                        <rect x="0" y="0" width="60" height="16" rx="8" fill="none" stroke="black" strokeWidth="3" />
                    </svg>
                </div>

                <div className="absolute top-[10%] right-[22%] opacity-15 max-sm:hidden">
                    <svg viewBox="0 0 60 16" width="80" height="22">
                        <rect x="0" y="0" width="60" height="16" rx="8" fill="none" stroke="black" strokeWidth="3" />
                    </svg>
                </div>
            </div>

            <div className="relative z-10 flex h-full items-center justify-center px-4 py-5">
                <div className="flex items-center justify-center" aria-hidden="true">
                    <div className="relative h-40 w-36">
                        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 160 180" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <g stroke="black" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M55 85 C46 50 28 18 22 2 C20 0 32 0 38 8 C48 26 54 52 62 74" />
                                <path d="M105 85 C114 50 132 18 138 2 C140 0 128 0 122 8 C112 26 106 52 98 74" />
                                <path d="M50 78 C30 80 18 105 22 128 C26 150 52 156 80 156 C108 156 134 150 138 128 C142 105 130 80 110 78 C102 74 93 70 80 70 C67 70 58 74 50 78 Z" />
                            </g>
                        </svg>

                        <div className="loader-deer-fill absolute inset-0 h-full w-full" style={fillStyle}>
                            <svg className="h-full w-full" viewBox="0 0 160 180" xmlns="http://www.w3.org/2000/svg">
                                <g fill="white" stroke="none">
                                    <path d="M50 78 C30 80 18 105 22 128 C26 150 52 156 80 156 C108 156 134 150 138 128 C142 105 130 80 110 78 C102 74 93 70 80 70 C67 70 58 74 50 78 Z" />
                                </g>
                                <g stroke="white" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none">
                                    <path d="M55 85 C46 50 28 18 22 2 C20 0 32 0 38 8 C48 26 54 52 62 74" />
                                    <path d="M105 85 C114 50 132 18 138 2 C140 0 128 0 122 8 C112 26 106 52 98 74" />
                                </g>
                            </svg>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function Character3DPreview({ modelFile }) {
    const containerRef = useRef(null);

    useEffect(() => {
        if (!modelFile || !containerRef.current) return;

        const container = containerRef.current;
        let width = container.clientWidth || 300;
        let height = container.clientHeight || 400;

        const scene = new THREE.Scene();

        const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 100);
        camera.position.set(2.4, 1.2, 3.2);
        camera.lookAt(0, 0.4, 0);

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.setSize(width, height);
        container.appendChild(renderer.domElement);

        const ambient = new THREE.AmbientLight(0xffffff, 0.7);
        scene.add(ambient);
        const key = new THREE.DirectionalLight(0xffffff, 1.2);
        key.position.set(3, 5, 4);
        scene.add(key);
        const fill = new THREE.DirectionalLight(0xffffff, 0.4);
        fill.position.set(-3, 1, -2);
        scene.add(fill);

        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                width = entry.contentBoxSize?.[0]?.inlineSize || entry.contentRect.width || width;
                height = entry.contentBoxSize?.[0]?.blockSize || entry.contentRect.height || height;
                camera.aspect = width / height;
                camera.updateProjectionMatrix();
                renderer.setSize(width, height);
            }
        });
        resizeObserver.observe(container);

        let modelGroup = null;
        let animationId = null;

        resolveAssetUrl(`/models/characters/${modelFile}`)
            .then((url) => {
                if (!url) return;
                const loader = new GLTFLoader();
                loader.load(url, (gltf) => {
                    modelGroup = gltf.scene;

                    const box = new THREE.Box3().setFromObject(modelGroup);
                    const center = box.getCenter(new THREE.Vector3());
                    const size = box.getSize(new THREE.Vector3());
                    const maxDim = Math.max(size.x, size.y, size.z);
                    const scale = maxDim > 0 ? 1.2 / maxDim : 1;
                    modelGroup.scale.set(scale, scale, scale);
                    modelGroup.position.set(
                        -center.x * scale,
                        -center.y * scale + 0.6,
                        -center.z * scale
                    );

                    scene.add(modelGroup);

                    const animate = () => {
                        if (modelGroup) modelGroup.rotation.y += 0.012;
                        renderer.render(scene, camera);
                        animationId = requestAnimationFrame(animate);
                    };
                    animate();
                });
            })
            .catch(() => { });

        return () => {
            if (animationId) cancelAnimationFrame(animationId);
            resizeObserver.disconnect();
            renderer.dispose();
            if (container.contains(renderer.domElement)) {
                container.removeChild(renderer.domElement);
            }
            if (modelGroup) scene.remove(modelGroup);
        };
    }, [modelFile]);

    return (
        <div
            ref={containerRef}
            className="h-full w-full"
        />
    );
}

function SettingsModal({ isOpen, onClose }) {
    const [settings, setSettings] = useState(() => readSettings());
    const [playerName, setPlayerName] = useState(() => readPlayerName());
    const { isFullscreen, toggleFullscreen } = useFullscreen();

    const toggle = useCallback((key) => {
        const next = { ...settings, [key]: settings[key] === false };
        setSettings(next);
        persistSettings(next);
    }, [settings]);

    const handleSaveName = useCallback(() => {
        savePlayerName(playerName);
    }, [playerName]);

    if (!isOpen) return null;

    return (
        <ModalShell isOpen={isOpen} onClose={onClose} title="Settings" size="sm">
            <div className="space-y-4">
                <div>
                    <label className="block text-xs font-black uppercase tracking-[0.12em] text-slate-500" htmlFor="settings-player-name">
                        Player Name
                    </label>
                    <div className="mt-1 flex gap-2">
                        <input
                            id="settings-player-name"
                            type="text"
                            maxLength={24}
                            value={playerName}
                            onChange={(e) => setPlayerName(e.target.value)}
                            onBlur={handleSaveName}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveName();
                            }}
                            className="block min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-800 outline-none ring-0 transition focus:border-emerald-400"
                            placeholder="Your name"
                        />
                        <ActionButton variant="primary" size="sm" onClick={handleSaveName}>
                            Save
                        </ActionButton>
                    </div>
                </div>

                <hr className="border-slate-200" />

                <ToggleRow
                    label="Music"
                    description="Background soundtrack"
                    enabled={settings.musicEnabled !== false}
                    onToggle={() => toggle('musicEnabled')}
                />
                <ToggleRow
                    label="Sound"
                    description="Button and animal sounds"
                    enabled={settings.soundEnabled !== false}
                    onToggle={() => toggle('soundEnabled')}
                />
                {typeof toggleFullscreen === 'function' && (
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <ActionButton variant="secondary" onClick={toggleFullscreen}>
                            {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                        </ActionButton>
                    </div>
                )}
            </div>
        </ModalShell>
    );
}

function CharacterSelectModal({ isOpen, onClose, characterOptions, selectedCharacterId, onSelect }) {
    const [selectedIndex, setSelectedIndex] = useState(() => {
        const index = characterOptions.findIndex((c) => c.id === selectedCharacterId);
        return index !== -1 ? index : 0;
    });

    useEffect(() => {
        if (isOpen) {
            const index = characterOptions.findIndex((c) => c.id === selectedCharacterId);
            if (index !== -1) setSelectedIndex(index);
        }
    }, [isOpen, selectedCharacterId, characterOptions]);

    if (!isOpen) return null;

    const previewChar = characterOptions[selectedIndex];

    const handleNext = () => {
        setSelectedIndex((prev) => (prev + 1) % characterOptions.length);
    };

    const handlePrev = () => {
        setSelectedIndex((prev) => (prev - 1 + characterOptions.length) % characterOptions.length);
    };

    const handleLaunch = () => {
        onSelect(previewChar);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-120 flex flex-col bg-[#c6fe69]">

            <div className="flex justify-between items-start p-6">
                <div>
                    <h1 className="text-4xl font-extrabold text-slate-900 uppercase tracking-wider">Character<br />Select</h1>
                    <p className="text-slate-800 font-semibold mt-1">Select your character</p>
                </div>
                <div className="text-3xl font-extrabold text-slate-900">
                    {selectedIndex + 1}/{characterOptions.length}
                </div>
            </div>

            <div className="flex-1 relative flex items-center justify-center overflow-hidden">
                <div className="flex items-center w-full max-w-7xl px-4 justify-between h-full relative z-10">

                    <div className="hidden sm:flex flex-1 justify-end pr-12 opacity-40 hover:opacity-70 scale-90 transition-all">
                        {characterOptions[(selectedIndex - 1 + characterOptions.length) % characterOptions.length] && (
                            <div className="h-80 w-64 relative" onClick={handlePrev} style={{ cursor: 'pointer' }}>
                                <Character3DPreview modelFile={characterOptions[(selectedIndex - 1 + characterOptions.length) % characterOptions.length].file} />
                            </div>
                        )}
                    </div>

                    <div className="relative flex flex-col items-center shrink-0 w-full sm:w-auto px-4">

                        <button onClick={handlePrev} className="absolute left-0 sm:-left-16 top-1/2 -translate-y-1/2 bg-white/50 p-2 sm:p-4 rounded-full shadow hover:bg-white active:scale-95 transition-transform z-30">
                            <svg className="w-6 h-6 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7"></path></svg>
                        </button>
                        <button onClick={handleNext} className="absolute right-0 sm:-right-16 top-1/2 -translate-y-1/2 bg-white/50 p-2 sm:p-4 rounded-full shadow hover:bg-white active:scale-95 transition-transform z-30">
                            <svg className="w-6 h-6 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7"></path></svg>
                        </button>

                        <div className="h-[50vh] sm:h-128 w-full max-w-[320px] sm:w-104 relative flex items-center justify-center">
                            <div className="w-full h-full relative z-10 scale-125 sm:scale-150">
                                {previewChar && <Character3DPreview modelFile={previewChar.file} />}
                            </div>
                        </div>

                        <div className="mt-4 bg-white/80 shadow-md backdrop-blur rounded-2xl px-12 py-3">
                            <h2 className="text-2xl font-bold text-slate-900 text-center">{previewChar?.label}</h2>
                        </div>

                    </div>

                    <div className="hidden sm:flex flex-1 justify-start pl-12 opacity-40 hover:opacity-70 scale-90 transition-all">
                        {characterOptions[(selectedIndex + 1) % characterOptions.length] && (
                            <div className="h-80 w-64 relative" onClick={handleNext} style={{ cursor: 'pointer' }}>
                                <Character3DPreview modelFile={characterOptions[(selectedIndex + 1) % characterOptions.length].file} />
                            </div>
                        )}
                    </div>

                </div>
            </div>

            <div className="p-6 flex justify-between items-end">
                <button
                    onClick={onClose}
                    className="bg-white text-slate-900 font-extrabold text-xl sm:text-2xl py-3 px-8 sm:px-12 rounded-2xl shadow-[0_6px_0_0_#cbd5e1] active:translate-y-1 active:shadow-none transition-all"
                >
                    BACK
                </button>

                <button
                    onClick={handleLaunch}
                    className="bg-slate-900 text-white font-extrabold text-xl sm:text-2xl py-3 px-8 sm:px-12 rounded-2xl shadow-[0_6px_0_0_#0f172a] active:translate-y-1 active:shadow-none transition-all relative"
                >
                    LAUNCH
                </button>
            </div>

        </div>
    );
}

export function MainMenu({ onStart, isVisible, characterOptions = [], selectedCharacterId, onCharacterPicked }) {
    const [starting, setStarting] = useState(false);
    const [howToPlayOpen, setHowToPlayOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [charSelectOpen, setCharSelectOpen] = useState(false);
    const [showExitConfirm, setShowExitConfirm] = useState(false);

    const handleStart = useCallback(() => {
        if (!readPlayerName()) {
            setSettingsOpen(true);
            return;
        }
        playGameButtonSfx('confirm');
        setStarting(true);
        window.setTimeout(onStart, 380);
    }, [onStart]);

    const selectedChar = characterOptions.find((c) => c.id === selectedCharacterId);

    if (!isVisible) return null;

    return (
        <div className="absolute inset-0 z-40 overflow-hidden bg-linear-to-brrom-sky-300 via-emerald-200 to-amber-200">
            <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
                <div className="absolute -left-10 -top-10 h-40 w-40 rounded-full bg-white/15" />
                <div className="absolute -right-6 -bottom-6 h-52 w-52 rounded-full bg-amber-300/20" />
                <div className="absolute left-1/4 top-1/3 h-20 w-20 rounded-full bg-emerald-300/20" />
                <div className="absolute right-1/4 bottom-1/4 h-16 w-16 rounded-full bg-sky-300/25" />
                <div className="absolute left-[8%] top-[15%] h-8 w-8 rounded-full bg-amber-200/30" />
                <div className="absolute right-[12%] top-[10%] h-10 w-10 rounded-full bg-emerald-200/25" />
            </div>

            <div className="relative z-10 flex h-full items-center justify-center p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-[calc(env(safe-area-inset-top)+1rem)] sm:p-6">
                <div className="w-full max-w-xs sm:max-w-sm">
                    <div className="mb-5 text-center sm:mb-6">
                        <h1 className="text-3xl font-black leading-tight text-slate-800 drop-shadow-[0_2px_4px_rgba(255,255,255,0.5)] sm:text-5xl">
                            Bulusan Zootopia
                        </h1>
                        <p className="mt-1 text-[11px] font-bold tracking-wide text-slate-700/80 sm:text-sm">
                            A calm wildlife adventure for kids
                        </p>
                    </div>

                    {selectedChar && (
                        <div className="mb-4 flex items-center justify-center gap-2 rounded-2xl bg-white/70 px-3 py-2 text-center shadow-[0_4px_12px_rgba(0,0,0,0.06)] backdrop-blur-sm">
                            <span className="text-xs font-extrabold text-slate-700">Character: {selectedChar.label}</span>
                        </div>
                    )}

                    <div className="space-y-2.5 sm:space-y-3">
                        <button
                            type="button"
                            onClick={handleStart}
                            disabled={starting}
                            className="flex w-full cursor-pointer items-center justify-center rounded-2xl bg-linear-to-b from-emerald-400 to-emerald-600 py-3.5 text-sm font-extrabold tracking-wide text-white shadow-[0_7px_0_0_#047857] transition-all duration-75 hover:brightness-110 active:translate-y-1.25 active:shadow-[0_2px_0_0_#047857] disabled:pointer-events-none disabled:opacity-60 sm:py-3.5 sm:text-base"
                        >
                            {starting ? 'Starting...' : 'Start Adventure'}
                        </button>

                        <button
                            type="button"
                            onClick={() => setCharSelectOpen(true)}
                            className="flex w-full cursor-pointer items-center justify-center rounded-2xl bg-linear-to-b from-violet-400 to-violet-600 py-3.5 text-sm font-extrabold tracking-wide text-white shadow-[0_7px_0_0_#6d28d9] transition-all duration-75 hover:brightness-110 active:translate-y-1.25 active:shadow-[0_2px_0_0_#6d28d9] sm:py-3.5 sm:text-base"
                        >
                            Characters
                        </button>

                        <button
                            type="button"
                            onClick={() => setSettingsOpen(true)}
                            className="flex w-full cursor-pointer items-center justify-center rounded-2xl bg-linear-to-b from-amber-400 to-amber-600 py-3.5 text-sm font-extrabold tracking-wide text-white shadow-[0_7px_0_0_#d97706] transition-all duration-75 hover:brightness-110 active:translate-y-1.25 active:shadow-[0_2px_0_0_#d97706] sm:py-3.5 sm:text-base"
                        >
                            Settings
                        </button>

                        <button
                            type="button"
                            onClick={() => setHowToPlayOpen(true)}
                            className="flex w-full cursor-pointer items-center justify-center rounded-2xl bg-linear-to-b from-pink-400 to-pink-600 py-3.5 text-sm font-extrabold tracking-wide text-white shadow-[0_7px_0_0_#db2777] transition-all duration-75 hover:brightness-110 active:translate-y-1.25 active:shadow-[0_2px_0_0_#db2777] sm:py-3.5 sm:text-base"
                        >
                            How to Play
                        </button>

                        <button
                            type="button"
                            onClick={() => setShowExitConfirm(true)}
                            className="flex w-full cursor-pointer items-center justify-center rounded-2xl bg-linear-to-b from-rose-400 to-rose-600 py-3.5 text-sm font-extrabold tracking-wide text-white shadow-[0_7px_0_0_#e11d48] transition-all duration-75 hover:brightness-110 active:translate-y-1.25 active:shadow-[0_2px_0_0_#e11d48] sm:py-3.5 sm:text-base"
                        >
                            Exit
                        </button>
                    </div>

                    {readPlayerName() && (
                        <p className="mt-4 text-center text-xs font-bold text-slate-600/80">
                            Player: {readPlayerName()}
                        </p>
                    )}
                </div>
            </div>

            <ModalShell isOpen={howToPlayOpen} onClose={() => setHowToPlayOpen(false)} title="How To Play" size="md">
                <HowToPlayContent />
            </ModalShell>

            <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />

            <CharacterSelectModal
                isOpen={charSelectOpen}
                onClose={() => setCharSelectOpen(false)}
                characterOptions={characterOptions}
                selectedCharacterId={selectedCharacterId}
                onSelect={onCharacterPicked}
            />

            <ConfirmModal
                isOpen={showExitConfirm}
                onConfirm={() => { setShowExitConfirm(false); }}
                onCancel={() => setShowExitConfirm(false)}
                title="Exit Game?"
                message="Come back anytime to continue your zoo adventure!"
                confirmLabel="OK"
                confirmVariant="primary"
            />
        </div>
    );
}

export function GameHUD({ playerName, onMenuClick, onTasksClick, completedTasks, totalTasks, isTouchDevice = false }) {
    return (
        <div className="hud-top-layout pointer-events-none absolute inset-x-0 top-[calc(env(safe-area-inset-top)+0.55rem)] z-65 px-2 sm:px-4">
            <div className="mx-auto grid w-full max-w-5xl grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-3">
                <div className="pointer-events-auto justify-self-start">
                    <div className="hud-player-pill min-w-0 rounded-full border border-emerald-200/90 bg-white px-3 py-1.5 shadow-[0_8px_18px_-14px_rgba(5,46,22,0.55)]">
                        <p className="max-w-40 truncate text-sm font-black text-emerald-950 sm:max-w-52">
                            {playerName || 'Explorer'}
                        </p>
                    </div>
                </div>

                <ActionButton
                    variant="primary"
                    size={isTouchDevice ? 'md' : 'sm'}
                    className="pointer-events-auto min-w-20"
                    onClick={onMenuClick}
                >
                    Menu
                </ActionButton>

                <div className="pointer-events-auto justify-self-end">
                    <ActionButton
                        variant="secondary"
                        size={isTouchDevice ? 'md' : 'sm'}
                        className="min-w-24 gap-1.5"
                        onClick={onTasksClick}
                    >
                        <span>Tasks</span>
                        <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-black text-emerald-900">
                            {completedTasks}/{Math.max(1, totalTasks)}
                        </span>
                    </ActionButton>
                </div>
            </div>
        </div>
    );
}

export function SettingsPanel({ isOpen, onClose, onQuit, onResetTasks }) {
    const [, setSettingsVersion] = useState(0);
    const settings = readSettings();
    const { isFullscreen, toggleFullscreen } = useFullscreen();
    const [howToPlayOpen, setHowToPlayOpen] = useState(false);
    const [orientationFeedback, setOrientationFeedback] = useState('');

    const update = useCallback((updates) => {
        const next = { ...readSettings(), ...updates };
        persistSettings(next);
        setSettingsVersion((value) => value + 1);
    }, []);

    const handleLandscapeMode = useCallback(async () => {
        const locked = await requestLandscapeOrientation();
        setOrientationFeedback(
            locked
                ? 'Landscape mode enabled.'
                : 'Landscape lock is not available on this browser/device.'
        );
    }, []);

    return (
        <>
            <ModalShell isOpen={isOpen} onClose={onClose} title="Game Menu" size="sm">
                <div className="space-y-3">
                    <ToggleRow
                        label="Music"
                        description="Enable background soundtrack"
                        enabled={settings.musicEnabled !== false}
                        onToggle={() => update({ musicEnabled: settings.musicEnabled === false })}
                    />
                    <ToggleRow
                        label="Sound"
                        description="Enable click and feedback sounds"
                        enabled={settings.soundEnabled !== false}
                        onToggle={() => update({ soundEnabled: settings.soundEnabled === false })}
                    />

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <ActionButton variant="secondary" onClick={toggleFullscreen}>
                            {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                        </ActionButton>
                        <ActionButton variant="secondary" onClick={handleLandscapeMode}>
                            Landscape
                        </ActionButton>
                    </div>

                    <ActionButton variant="secondary" className="w-full" onClick={() => setHowToPlayOpen(true)}>
                        How To Play
                    </ActionButton>

                    <ActionButton variant="warning" className="w-full" onClick={onResetTasks}>
                        Reset Tasks
                    </ActionButton>

                    <ActionButton variant="danger" className="w-full" onClick={onQuit}>
                        Quit Game
                    </ActionButton>

                    {orientationFeedback ? (
                        <p className="text-center text-xs font-semibold text-slate-500">{orientationFeedback}</p>
                    ) : null}
                </div>
            </ModalShell>

            <ModalShell isOpen={howToPlayOpen} onClose={() => setHowToPlayOpen(false)} title="How To Play" size="md">
                <HowToPlayContent />
            </ModalShell>
        </>
    );
}

export function TaskPanel({ isOpen, onClose, tasks = [], onTaskClick }) {
    const completedCount = tasks.filter((task) => task.completed).length;

    return (
        <SideSheet isOpen={isOpen} onClose={onClose} title="My Tasks" side="right">
            <div className="space-y-3">
                <SurfacePanel className="p-3">
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Progress</span>
                        <ProgressChip completed={completedCount} total={tasks.length || 1} />
                    </div>
                    <progress
                        max={tasks.length || 1}
                        value={completedCount}
                        className="mt-2 h-2 w-full overflow-hidden rounded-full"
                    />
                </SurfacePanel>

                <div className="space-y-2" data-ui-scrollable="true">
                    {tasks.map((task) => (
                        <button
                            key={task.id}
                            type="button"
                            data-ui-button="true"
                            onClick={() => onTaskClick?.(task)}
                            className={cx(
                                'flex w-full items-start justify-between gap-3 rounded-xl border px-3 py-2 text-left transition',
                                task.completed
                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                    : 'border-slate-200 bg-white text-slate-800 hover:border-amber-300 hover:bg-amber-50',
                            )}
                        >
                            <span className="text-sm font-bold">{task.name}</span>
                            <span className="mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-widest">
                                {task.completed ? 'Done' : 'Pending'}
                            </span>
                        </button>
                    ))}
                </div>
            </div>
        </SideSheet>
    );
}

export function InteractionPrompt({ visible, onFeed, onViewDetails, animalName, isTouchDevice }) {
    if (!visible) return null;

    return (
        <div className="pointer-events-none absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+5.4rem)] z-75 flex justify-center px-3 sm:bottom-24">
            <SurfacePanel className="pointer-events-auto w-full max-w-sm p-3" data-ui-panel="true">
                <p className="text-center text-xs font-bold text-slate-600">Near {animalName || 'animal'}</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                    <ActionButton variant="primary" size="sm" onClick={onFeed}>{isTouchDevice ? 'Feed' : 'Feed (F)'}</ActionButton>
                    <ActionButton variant="secondary" size="sm" onClick={onViewDetails}>{isTouchDevice ? 'Info' : 'Info (E)'}</ActionButton>
                </div>
            </SurfacePanel>
        </div>
    );
}

export function NPCInteractionPrompt({ visible, onInteract, npcName = 'Zoo Staff', isTouchDevice }) {
    if (!visible) return null;

    return (
        <div className="pointer-events-none absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+5.4rem)] z-75 flex justify-center px-3 sm:bottom-24">
            <SurfacePanel className="pointer-events-auto w-full max-w-sm p-3" data-ui-panel="true">
                <p className="text-center text-xs font-bold text-slate-600">Talk to {npcName}</p>
                {!isTouchDevice ? <p className="mt-1 text-center text-[11px] font-black uppercase tracking-[0.12em] text-amber-700">Press T to talk</p> : null}
                <ActionButton variant="warning" className="mt-2 w-full" onClick={onInteract}>
                    {isTouchDevice ? 'Talk' : 'Talk (T)'}
                </ActionButton>
            </SurfacePanel>
        </div>
    );
}

export function NPCDialogueModal({ isOpen, onClose, npcName, npcRole, message, choices = [], onSelectChoice }) {
    return (
        <ModalShell isOpen={isOpen} onClose={onClose} title={npcName || 'Ranger'} size="md">
            {npcRole ? <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">{npcRole}</p> : null}
            <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-700">{message}</p>

            <div className="mt-4 grid gap-2">
                {choices.map((choice) => (
                    <ActionButton
                        key={choice.id}
                        variant="secondary"
                        className="justify-start"
                        onClick={() => onSelectChoice?.(choice)}
                    >
                        {choice.label}
                    </ActionButton>
                ))}
            </div>
        </ModalShell>
    );
}

export function MobileInteractionButtons({ visible, onFeed, onViewDetails }) {
    if (!visible) return null;

    return (
        <div className="pointer-events-none absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+1.2rem)] z-70 px-3 md:hidden">
            <SurfacePanel className="pointer-events-auto mx-auto flex max-w-sm gap-2 p-2" data-ui-panel="true">
                <ActionButton variant="primary" size="sm" className="flex-1" onClick={onFeed}>Feed</ActionButton>
                <ActionButton variant="secondary" size="sm" className="flex-1" onClick={onViewDetails}>View</ActionButton>
            </SurfacePanel>
        </div>
    );
}

export function AnimalInfoModal({
    animal,
    onClose,
    onFeed,
    isFed,
    placement = 'center',
    preview = false,
    onView,
    bottomOffset,
}) {
    if (!animal) return null;

    const isCompact = placement === 'bottom' || preview;

    if (isCompact) {
        const compactBottomClass = String(bottomOffset || '').includes('132') ? 'bottom-28' : 'bottom-20';

        return (
            <div className={cx('pointer-events-none absolute inset-x-0 z-74 px-3', compactBottomClass)}>
                <SurfacePanel className="pointer-events-auto mx-auto max-w-lg p-3" data-ui-panel="true">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <h3 className="truncate text-sm font-black text-slate-900">{animal.name}</h3>
                            <p className="mt-0.5 line-clamp-2 text-xs font-semibold leading-relaxed text-slate-600">{animal.description}</p>
                        </div>
                        <IconButton onClick={onClose} className="h-8 w-8">
                            <span className="text-xs font-black">x</span>
                        </IconButton>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                        <ActionButton variant="secondary" size="sm" onClick={onView}>Details</ActionButton>
                        <ActionButton variant={isFed ? 'secondary' : 'primary'} size="sm" onClick={onFeed} disabled={isFed}>
                            {isFed ? 'Already Fed' : 'Feed'}
                        </ActionButton>
                    </div>
                </SurfacePanel>
            </div>
        );
    }

    return (
        <ModalShell isOpen={!!animal} onClose={onClose} title={animal.name} size="md">
            <div className="space-y-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-black uppercase tracking-widest text-slate-500">Species</p>
                    <p className="mt-1 text-sm font-bold text-slate-800">{animal.species || 'Unknown species'}</p>
                </div>

                <p className="text-sm font-semibold leading-relaxed text-slate-700">{animal.description || 'No description available yet.'}</p>

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <ActionButton variant="secondary" onClick={onClose}>Close</ActionButton>
                    <ActionButton variant={isFed ? 'secondary' : 'primary'} onClick={onFeed} disabled={isFed}>
                        {isFed ? 'Already Fed' : 'Feed Animal'}
                    </ActionButton>
                </div>
            </div>
        </ModalShell>
    );
}

export function FeedingSuccessNotification({ visible, animalName, onHide }) {
    useEffect(() => {
        if (!visible) return undefined;
        const id = window.setTimeout(() => onHide?.(), 1900);
        return () => window.clearTimeout(id);
    }, [visible, onHide]);

    if (!visible) return null;

    return (
        <div className="pointer-events-none absolute inset-x-0 top-[calc(env(safe-area-inset-top)+0.75rem)] z-90 flex justify-center px-3">
            <SurfacePanel className="kids-slide-up rounded-full border-emerald-200 bg-emerald-50 px-4 py-2 text-center">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-emerald-700">Task Complete</p>
                <p className="text-sm font-bold text-emerald-900">You fed {animalName || 'an animal'}!</p>
            </SurfacePanel>
        </div>
    );
}

export function AllAnimalsCelebration({ visible, onClose, onViewCertificate }) {
    return (
        <ModalShell isOpen={visible} onClose={onClose} title="All Animals Are Fed!" size="md">
            <div className="space-y-3 text-center">
                <p className="text-sm font-semibold text-slate-700">Great work, explorer. Every animal in Bulusan Zootopia Adventure has been cared for.</p>
                <div className="grid gap-2 sm:grid-cols-2">
                    <ActionButton variant="secondary" onClick={onClose}>Continue Exploring</ActionButton>
                    <ActionButton variant="primary" onClick={onViewCertificate}>View Certificate</ActionButton>
                </div>
            </div>
        </ModalShell>
    );
}

export function CertificateModal({ isOpen, onClose, playerName = 'Explorer', totalAnimals = 0 }) {
    const today = useMemo(() => new Date().toLocaleDateString(), []);

    return (
        <ModalShell isOpen={isOpen} onClose={onClose} title="Certificate Of Completion" size="lg">
            <div className="rounded-2xl border-2 border-amber-300 bg-linear-to-br from-amber-50 to-orange-50 p-5 text-center shadow-inner">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-700">Bulusan Zootopia Adventure</p>
                <h3 className="mt-2 text-2xl font-black text-slate-900">Awarded To</h3>
                <p className="mt-2 text-xl font-black text-emerald-700">{playerName}</p>
                <p className="mt-3 text-sm font-semibold text-slate-700">
                    For feeding all {totalAnimals} animals and completing the zoo mission.
                </p>
                <p className="mt-4 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Issued {today}</p>
            </div>

            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <ActionButton variant="secondary" onClick={onClose}>Close</ActionButton>
                <ActionButton variant="primary" onClick={() => window.print()}>Save / Print</ActionButton>
            </div>
        </ModalShell>
    );
}

export function QuitModal({ isOpen, onConfirm, onCancel }) {
    return (
        <ConfirmModal
            isOpen={isOpen}
            onConfirm={onConfirm}
            onCancel={onCancel}
            title="Quit Game?"
            message="You can always return and continue feeding tasks from where you left off."
            confirmLabel="Quit"
            confirmVariant="danger"
        />
    );
}

export function ResetTasksModal({ isOpen, onConfirm, onCancel }) {
    return (
        <ConfirmModal
            isOpen={isOpen}
            onConfirm={onConfirm}
            onCancel={onCancel}
            title="Reset All Tasks?"
            message="This clears your feeding progress for every animal and cannot be undone."
            confirmLabel="Reset"
            confirmVariant="warning"
        />
    );
}

export function WelcomePopup({ visible, message }) {
    if (!visible) return null;

    return (
        <div className="pointer-events-none absolute inset-x-0 top-[calc(env(safe-area-inset-top)+0.75rem)] z-85 flex justify-center px-3">
            <SurfacePanel className="welcome-fade rounded-full px-4 py-2 text-center">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-700">Welcome</p>
                <p className="text-sm font-bold text-slate-900">{message}</p>
            </SurfacePanel>
        </div>
    );
}

export function Joystick({ baseRef, stickRef, isTouchDevice }) {
    const detectedTouch = useIsTouchDevice();
    const isTouch = typeof isTouchDevice === 'boolean' ? isTouchDevice : detectedTouch;
    if (!isTouch) return null;

    return (
        <div className="pointer-events-none absolute bottom-[calc(env(safe-area-inset-bottom)+0.7rem)] left-2.5 z-70 sm:left-3">
            <div
                ref={baseRef}
                className="pointer-events-auto grid h-24 w-24 place-items-center rounded-full border border-white/35 bg-slate-950/25 touch-none select-none backdrop-blur sm:h-28 sm:w-28"
            >
                <div ref={stickRef} className="h-10 w-10 rounded-full border border-white/50 bg-white/85 shadow sm:h-12 sm:w-12" />
            </div>
        </div>
    );
}

export function JumpButton({ jumpRef, isTouchDevice }) {
    const detectedTouch = useIsTouchDevice();
    const isTouch = typeof isTouchDevice === 'boolean' ? isTouchDevice : detectedTouch;
    if (!isTouch) return null;

    return (
        <div className="pointer-events-none absolute bottom-[calc(env(safe-area-inset-bottom)+0.7rem)] right-2.5 z-70 sm:right-3">
            <button
                ref={jumpRef}
                type="button"
                data-ui-button="true"
                className="pointer-events-auto inline-flex h-14 w-14 items-center justify-center rounded-full border border-white/45 bg-amber-400/95 text-xs font-black uppercase tracking-[0.08em] text-slate-900 shadow-lg active:scale-95 sm:h-16 sm:w-16 sm:text-sm"
            >
                Jump
            </button>
        </div>
    );
}

export function CameraSystem() {
    return null;
}

export function BottomHotbar({ gameStarted, completedTasks, totalTasks, onMenuClick, onTasksClick }) {
    if (!gameStarted) return null;

    return (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-72 px-3 pb-[calc(env(safe-area-inset-bottom)+0.55rem)] md:hidden">
            <SurfacePanel className="pointer-events-auto p-2" data-ui-panel="true">
                <div className="flex items-center gap-2">
                    <ActionButton variant="secondary" size="sm" className="flex-1" onClick={onMenuClick}>Menu</ActionButton>
                    <ActionButton variant="warning" size="sm" className="flex-1" onClick={onTasksClick}>Tasks</ActionButton>
                    <ProgressChip completed={completedTasks} total={totalTasks} className="shrink-0" />
                </div>
            </SurfacePanel>
        </div>
    );
}

export function GameUI() {
    return null;
}

export function BackButton() {
    return null;
}

export function BackModal({ onConfirm, onCancel }) {
    return <QuitModal isOpen={true} onConfirm={onConfirm} onCancel={onCancel} />;
}

export function PreGameScreen({ onStart }) {
    return <MainMenu onStart={onStart} isVisible={true} />;
}

export function AnimalInfoPanel({ animal, onClose }) {
    if (!animal) return null;
    return <AnimalInfoModal animal={animal} onClose={onClose} onFeed={() => { }} isFed={false} />;
}

export function InteractPrompt({ visible }) {
    return (
        <InteractionPrompt
            visible={visible}
            onFeed={() => { }}
            onViewDetails={() => { }}
            animalName="Animal"
            isTouchDevice={false}
        />
    );
}

export function RotateDeviceOverlay() {
    const [needsRotation, setNeedsRotation] = useState(() => {
        try {
            const ua = navigator.userAgent || '';
            if (!/android|iphone|ipad|ipod/i.test(ua)) return false;
            return window.matchMedia('(orientation: portrait)').matches;
        } catch {
            return false;
        }
    });

    const isMobileRef = useRef(false);

    useEffect(() => {
        const ua = navigator.userAgent || '';
        const isMobile = /android|iphone|ipad|ipod/i.test(ua);
        isMobileRef.current = isMobile;

        if (!isMobile) return;

        const tryLockLandscape = async () => {
            try {
                if (screen.orientation && typeof screen.orientation.lock === 'function') {
                    await screen.orientation.lock('landscape');
                    setNeedsRotation(false);
                    return;
                }
            } catch {
                // Orientation lock not supported
            }
            try {
                const isPortrait = window.matchMedia('(orientation: portrait)').matches;
                setNeedsRotation(isPortrait);
            } catch {
                setNeedsRotation(false);
            }
        };
        tryLockLandscape();

        let mql;
        const onOrientationChange = (e) => {
            if (isMobileRef.current) {
                setNeedsRotation(e.matches);
            }
        };

        try {
            mql = window.matchMedia('(orientation: portrait)');
            if (mql.addEventListener) {
                mql.addEventListener('change', onOrientationChange);
            }
        } catch {
            // matchMedia not supported
        }

        return () => {
            if (mql?.removeEventListener) {
                mql.removeEventListener('change', onOrientationChange);
            }
        };
    }, []);

    if (!needsRotation) return null;

    return (
        <div className="fixed inset-0 z-9999 flex flex-col items-center justify-center bg-[#1a1a2e] text-white p-8">
            <svg
                className="w-20 h-20 mb-6 animate-rotate-phone"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <rect x="5" y="1" width="14" height="22" rx="2" ry="2" />
                <line x1="5" y1="17" x2="19" y2="17" />
            </svg>
            <h2 className="text-2xl font-black mb-2">Rotate Your Device</h2>
            <p className="text-sm font-semibold text-slate-300 text-center max-w-xs">
                Please rotate your device to landscape mode for the best experience.
            </p>
        </div>
    );
}