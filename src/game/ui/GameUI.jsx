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

const UI_DEFAULT_SETTINGS = {
    musicEnabled: true,
    soundEnabled: true,
    graphicsQuality: 'medium',
    fpsLimit: 60
};

function readSettings() {
    try {
        const raw = localStorage.getItem(SETTINGS_KEY);
        return raw ? { ...UI_DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...UI_DEFAULT_SETTINGS };
    } catch {
        return { ...UI_DEFAULT_SETTINGS };
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

function SelectRow({ label, description, options = [], value, onChange }) {
    return (
        <div className="flex min-h-11 w-full items-center justify-between rounded-2xl border border-emerald-200/80 bg-white px-4 py-3 shadow-[0_10px_24px_-20px_rgba(5,150,105,0.7)]">
            <span className="min-w-0">
                <span className="block truncate text-sm font-black tracking-wide text-emerald-950">{label}</span>
                <span className="mt-0.5 block text-xs font-semibold text-emerald-700/80">{description}</span>
            </span>
            <div className="flex shrink-0 gap-1" role="radiogroup">
                {options.map((opt) => {
                    const isSelected = value === opt.value;
                    return (
                        <button
                            key={opt.value}
                            type="button"
                            role="radio"
                            aria-checked={isSelected}
                            onClick={() => onChange(opt.value)}
                            className={cx(
                                'rounded-lg px-2.5 py-1 text-xs font-black uppercase tracking-wider transition',
                                isSelected
                                    ? 'bg-emerald-500 text-white shadow-sm'
                                    : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                            )}
                        >
                            {opt.label}
                        </button>
                    );
                })}
            </div>
        </div>
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

function Character3DPreview({ modelFile }) {
    const containerRef = useRef(null);

    useEffect(() => {
        if (!modelFile || !containerRef.current) return;

        const container = containerRef.current;
        let width = container.clientWidth || 300;
        let height = container.clientHeight || 400;

        const scene = new THREE.Scene();

        const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
        camera.position.set(2.4, 1.6, 3.2);
        camera.lookAt(0, 1.0, 0);

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
        let mixer = null;
        let idleAction = null;
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
                    const targetSize = 0.9;
                    const scale = maxDim > 0 ? targetSize / maxDim : 1;
                    modelGroup.scale.set(scale, scale, scale);
                    modelGroup.position.set(
                        -center.x * scale,
                        -center.y * scale + targetSize * 0.5,
                        -center.z * scale
                    );

                    scene.add(modelGroup);

                    if (gltf.animations && gltf.animations.length > 0) {
                        mixer = new THREE.AnimationMixer(modelGroup);
                        const actions = {};
                        gltf.animations.forEach((clip) => {
                            actions[clip.name.toLowerCase()] = mixer.clipAction(clip);
                        });
                        const actionEntries = Object.entries(actions);
                        idleAction = actionEntries.find(([name]) => /idle|stand|breath/.test(name))?.[1] || actionEntries[0]?.[1] || null;
                        if (idleAction) {
                            idleAction.enabled = true;
                            idleAction.setEffectiveWeight(1);
                            idleAction.play();
                        }
                    }

                    const clock = new THREE.Clock();
                    const animate = () => {
                        if (modelGroup) modelGroup.rotation.y += 0.004;
                        if (mixer && clock) mixer.update(clock.getDelta());
                        renderer.render(scene, camera);
                        animationId = requestAnimationFrame(animate);
                    };
                    animate();
                });
            })
            .catch(() => { });

        return () => {
            if (animationId) cancelAnimationFrame(animationId);
            if (mixer) {
                mixer.stopAllAction();
                mixer = null;
            }
            idleAction = null;
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

                <SelectRow
                    label="Graphics Quality"
                    description="Visual fidelity and performance"
                    options={[
                        { label: 'Low', value: 'low' },
                        { label: 'Medium', value: 'medium' },
                        { label: 'High', value: 'high' }
                    ]}
                    value={settings.graphicsQuality || 'medium'}
                    onChange={(val) => {
                        const next = { ...settings, graphicsQuality: val };
                        setSettings(next);
                        persistSettings(next);
                    }}
                />
                <SelectRow
                    label="FPS Limit"
                    description="Maximum frame rate"
                    options={[
                        { label: '24', value: 24 },
                        { label: '30', value: 30 },
                        { label: '60', value: 60 }
                    ]}
                    value={settings.fpsLimit ?? 60}
                    onChange={(val) => {
                        const next = { ...settings, fpsLimit: val };
                        setSettings(next);
                        persistSettings(next);
                    }}
                />

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
        <div className="fixed inset-0 z-120 flex flex-col bg-[#c6fe69] safe-area-inset">

            <div className="flex justify-between items-start p-4 sm:p-6">
                <div>
                    <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 uppercase tracking-wider">Character<br />Select</h1>
                    <p className="text-slate-800 font-semibold mt-1 text-sm sm:text-base">Select your character</p>
                </div>
                <div className="text-xl sm:text-3xl font-extrabold text-slate-900">
                    {selectedIndex + 1}/{characterOptions.length}
                </div>
            </div>

            <div className="flex-1 relative flex items-center justify-center overflow-hidden">
                <div className="flex items-center w-full max-w-7xl px-2 sm:px-4 justify-between h-full relative z-10">

                    <div className="hidden sm:flex flex-1 justify-end pr-12 opacity-40 hover:opacity-70 scale-90 transition-all">
                        {characterOptions[(selectedIndex - 1 + characterOptions.length) % characterOptions.length] && (
                            <div className="h-80 w-64 relative" onClick={handlePrev} style={{ cursor: 'pointer' }}>
                                <Character3DPreview modelFile={characterOptions[(selectedIndex - 1 + characterOptions.length) % characterOptions.length].file} />
                            </div>
                        )}
                    </div>

                    <div className="relative flex flex-col items-center shrink-0 w-full sm:w-auto px-2 sm:px-4">

                        <button onClick={handlePrev} className="absolute left-1 sm:-left-16 top-1/2 -translate-y-1/2 bg-white/50 p-1.5 sm:p-4 rounded-full shadow hover:bg-white active:scale-95 transition-transform z-30">
                            <svg className="w-5 h-5 sm:w-6 sm:h-6 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7"></path></svg>
                        </button>
                        <button onClick={handleNext} className="absolute right-1 sm:-right-16 top-1/2 -translate-y-1/2 bg-white/50 p-1.5 sm:p-4 rounded-full shadow hover:bg-white active:scale-95 transition-transform z-30">
                            <svg className="w-5 h-5 sm:w-6 sm:h-6 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7"></path></svg>
                        </button>

                        <div className="h-[28vh] sm:h-[40vh] w-full max-w-56 sm:max-w-70 relative flex items-center justify-center">
                            <div className="w-full h-full relative z-10">
                                {previewChar && <Character3DPreview modelFile={previewChar.file} />}
                            </div>
                        </div>

                        <div className="mt-3 sm:mt-4 bg-white/80 shadow-md backdrop-blur rounded-2xl px-6 sm:px-12 py-2 sm:py-3">
                            <h2 className="text-lg sm:text-2xl font-bold text-slate-900 text-center">{previewChar?.label}</h2>
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

            <div className="p-4 sm:p-6 flex justify-between items-end gap-3">
                <button
                    onClick={onClose}
                    className="bg-white text-slate-900 font-extrabold text-base sm:text-2xl py-2.5 sm:py-3 px-6 sm:px-12 rounded-2xl shadow-[0_6px_0_0_#cbd5e1] active:translate-y-1 active:shadow-none transition-all"
                >
                    BACK
                </button>

                <button
                    onClick={handleLaunch}
                    className="bg-slate-900 text-white font-extrabold text-base sm:text-2xl py-2.5 sm:py-3 px-6 sm:px-12 rounded-2xl shadow-[0_6px_0_0_#0f172a] active:translate-y-1 active:shadow-none transition-all relative"
                >
                    LAUNCH
                </button>
            </div>

        </div>
    );
}

/* ==========================================================================
   REDESIGNED MAIN MENU - REAL 3D BUTTONS & AESTHETIC BUSHES
   ========================================================================== */

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
        <div className="fixed inset-0 z-40 flex flex-col justify-between overflow-hidden bg-linear-to-b from-[#70e0ff] via-[#a2d2ff] to-[#c6fe69] font-['Qilka',sans-serif] select-none touch-none safe-area-inset p-2 sm:p-4">

            {/* ---------------- BACKGROUND JUNGLE SCENE & AESTHETIC BUSHES ---------------- */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
                {/* Soft Radial Sunburst Glow */}
                <div className="absolute -top-[15%] left-1/2 -translate-x-1/2 w-[120vw] h-[60vh] rounded-full bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.4)_0%,rgba(255,255,255,0)_70%)] animate-pulse" />

                {/* Animated Clouds */}
                <div className="absolute top-[5%] left-[6%] w-20 sm:w-36 h-6 sm:h-10 bg-white/70 rounded-full blur-[0.5px] animate-[kids-float_6s_ease-in-out_infinite]" />
                <div className="absolute top-[9%] right-[8%] w-28 sm:w-48 h-8 sm:h-12 bg-white/60 rounded-full blur-[0.5px] animate-[kids-float_8s_ease-in-out_infinite_1s]" />

                {/* Layered Background Hills */}
                <div className="absolute bottom-0 w-full h-[52%] bg-[#c6fe69] rounded-t-[100%] scale-[1.7] translate-y-1/3 shadow-[0_-12px_24px_rgba(0,0,0,0.06)]" />
                <div className="absolute bottom-0 w-full h-[36%] bg-[#70e000] rounded-t-[100%] scale-[1.4] translate-y-1/4 shadow-[0_-10px_20px_rgba(0,0,0,0.1)]" />
                <div className="absolute bottom-0 w-full h-[20%] bg-[#38b000] rounded-t-[100%] scale-[1.2] translate-y-1/4 shadow-[0_-8px_16px_rgba(0,0,0,0.12)]" />

                {/* --- AESTHETIC BUSHES & TROPICAL SHRUBS --- */}
                {/* Left Side Bush Cluster */}
                <div className="absolute bottom-[18%] -left-8 sm:-left-12 flex items-end opacity-95">
                    <div className="w-16 h-16 sm:w-28 sm:h-28 rounded-full bg-[#1b4332] -mr-6 -mb-2 shadow-inner" />
                    <div className="w-24 h-24 sm:w-40 sm:h-40 rounded-full bg-[#2d6a4f] -mr-8 border-t-4 border-[#c6fe69]/40 shadow-lg" />
                    <div className="w-18 h-18 sm:w-32 sm:h-32 rounded-full bg-[#52b788] border-t-4 border-white/40" />
                </div>

                {/* Right Side Bush Cluster */}
                <div className="absolute bottom-[18%] -right-8 sm:-right-12 flex items-end opacity-95">
                    <div className="w-20 h-20 sm:w-32 sm:h-32 rounded-full bg-[#52b788] -mr-6 border-t-4 border-white/40" />
                    <div className="w-28 h-28 sm:w-44 sm:h-44 rounded-full bg-[#2d6a4f] -mr-8 border-t-4 border-[#c6fe69]/40 shadow-lg" />
                    <div className="w-16 h-16 sm:w-28 sm:h-28 rounded-full bg-[#1b4332] -mb-2 shadow-inner" />
                </div>

                {/* Center Ridge Bush Accents */}
                <div className="absolute bottom-[14%] left-[22%] w-12 sm:w-20 h-10 sm:h-16 rounded-full bg-[#38b000] border-t-2 border-[#c6fe69] opacity-80" />
                <div className="absolute bottom-[15%] right-[24%] w-14 sm:w-22 h-11 sm:h-18 rounded-full bg-[#2d6a4f] border-t-2 border-[#52b788] opacity-80" />
            </div>

            {/* ---------------- TOP / WOODEN TITLE BANNER ---------------- */}
            <div className="relative z-10 w-full flex flex-col items-center shrink-0 pt-1 sm:pt-2">
                <WoodenTitle titlePart1="Bulusan" titlePart2="Mini Zoo" />

                {/* Character Selection Badge */}
                <button
                    type="button"
                    onClick={() => {
                        playGameButtonSfx('tap');
                        setCharSelectOpen(true);
                    }}
                    className="mt-1 sm:mt-2 group flex items-center gap-1.5 sm:gap-2 rounded-full bg-[#c6fe69] px-3.5 py-1 sm:px-5 sm:py-1.5 shadow-[0_6px_16px_rgba(0,0,0,0.18)] border-2 sm:border-3 border-white transition-transform hover:scale-105 active:scale-95"
                >
                    <span className="text-sm sm:text-base">🤠</span>
                    <span className="text-[11px] sm:text-xs font-black tracking-wide text-[#081c15]">
                        Character: <span className="text-[#1b4332]">{selectedChar ? selectedChar.label : 'Select'}</span>
                    </span>
                    <span className="ml-1 rounded-full bg-[#1b4332] px-2 py-0.5 text-[9px] sm:text-[10px] font-black uppercase text-[#c6fe69] shadow-sm group-hover:bg-[#081c15]">
                        Change
                    </span>
                </button>
            </div>

            {/* ---------------- CENTER / CIRCULAR 3D PLAY CTA BUTTON ---------------- */}
            <div className="relative z-10 flex-1 flex items-center justify-center min-h-0 my-1 sm:my-2">
                <MenuButton3D
                    color="pink"
                    icon={
                        <svg viewBox="0 0 24 24" fill="white" className="w-12 h-12 sm:w-18 sm:h-18 ml-1.5 drop-shadow-[0_4px_6px_rgba(0,0,0,0.3)]">
                            <path d="M8 5v14l11-7z" />
                        </svg>
                    }
                    onClick={handleStart}
                    disabled={starting}
                    isMain={true}
                />
            </div>

            {/* ---------------- BOTTOM / NAVIGATION DOCK ---------------- */}
            <div className="relative z-10 w-full shrink-0 pb-[env(safe-area-inset-bottom,0px)]">
                <div className="mx-auto max-w-xl flex items-center justify-around bg-[#081c15]/40 backdrop-blur-md border border-white/30 rounded-2xl sm:rounded-3xl px-2 py-2 sm:px-4 sm:py-3 shadow-[0_10px_28px_rgba(0,0,0,0.3)]">
                    <MenuButton3D
                        color="amber"
                        icon={
                            <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5 sm:w-7 sm:h-7 drop-shadow-md">
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 16h-2v-2h2v2zm1.07-7.75l-.9.92C12.45 11.9 12 12.5 12 14h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H7c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.04-.42 1.99-1.07 2.75z" />
                            </svg>
                        }
                        label="How to Play"
                        onClick={() => setHowToPlayOpen(true)}
                    />

                    <MenuButton3D
                        color="cyan"
                        icon={
                            <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5 sm:w-7 sm:h-7 drop-shadow-md">
                                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                            </svg>
                        }
                        label="Characters"
                        onClick={() => setCharSelectOpen(true)}
                    />

                    <MenuButton3D
                        color="lime"
                        icon={
                            <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5 sm:w-7 sm:h-7 drop-shadow-md">
                                <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.56-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.3-.06.63-.06.95s.02.64.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .43-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.49-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
                            </svg>
                        }
                        label="Settings"
                        onClick={() => setSettingsOpen(true)}
                    />

                    <MenuButton3D
                        color="rose"
                        icon={
                            <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5 sm:w-7 sm:h-7 drop-shadow-md">
                                <path d="M10.09 15.59L11.5 17l5-5-5-5-1.41 1.41L12.67 11H3v2h9.67l-2.58 2.59zM19 3H5c-1.11 0-2 .9-2 2v4h2V5h14v14H5v-4H3v4c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z" />
                            </svg>
                        }
                        label="Quit"
                        onClick={() => setShowExitConfirm(true)}
                    />
                </div>
            </div>

            {/* ---------------- MODALS & OVERLAYS ---------------- */}
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
                onConfirm={() => {
                    setShowExitConfirm(false);
                    if (typeof window !== 'undefined' && window.history.length > 1) {
                        window.history.back();
                    }
                }}
                onCancel={() => setShowExitConfirm(false)}
                title="Exit Game?"
                message="Are you sure you want to exit? Your progress will be safely saved!"
                confirmLabel="Exit"
                confirmVariant="danger"
            />
        </div>
    );
}

/* ==========================================================================
   REAL 3D EXTRUDED BUTTON COMPONENT
   ========================================================================== */

const MenuButton3D = ({ color = 'pink', onClick, icon, label, disabled, isMain = false }) => {
    const handlePress = (e) => {
        if (disabled) return;
        playGameButtonSfx(isMain ? 'confirm' : 'tap');
        if (onClick) onClick(e);
    };

    // Circular dimensions for buttons
    const sizeClasses = isMain
        ? 'w-24 h-24 sm:w-36 sm:h-36'
        : 'w-11 h-11 sm:w-16 sm:h-16';

    const colorVariants = {
        pink: {
            top: 'from-[#ff758f] via-[#e63946] to-[#a4133c]',
            base: 'bg-[#590d22]',
            border: 'border-white',
        },
        amber: {
            top: 'from-[#ffc300] via-[#ff924c] to-[#d97706]',
            base: 'bg-[#78350f]',
            border: 'border-white',
        },
        cyan: {
            top: 'from-[#70d6ff] via-[#3a86ff] to-[#1d3557]',
            base: 'bg-[#0f172a]',
            border: 'border-white',
        },
        lime: {
            top: 'from-[#d8ff7a] via-[#c6fe69] to-[#38b000]',
            base: 'bg-[#1b4332]',
            border: 'border-white',
        },
        rose: {
            top: 'from-[#ff8fa3] via-[#d90429] to-[#800f2f]',
            base: 'bg-[#38040e]',
            border: 'border-white',
        },
    };

    const variant = colorVariants[color] || colorVariants.pink;

    return (
        <div className="flex flex-col items-center gap-1 sm:gap-1.5 shrink-0">
            {/* Real 3D Button Container with Extruded Base + Cap */}
            <button
                type="button"
                onClick={handlePress}
                disabled={disabled}
                className={`relative group shrink-0 rounded-full cursor-pointer transition-transform duration-100 ease-out active:translate-y-1.5 sm:active:translate-y-2 hover:scale-105 disabled:opacity-50 ${sizeClasses}`}
            >
                {/* Extruded 3D Base Body (Depth Layer) */}
                <div
                    className={`absolute inset-0 translate-y-1.5 sm:translate-y-2 rounded-full border-b-2 border-black/40 ${variant.base}`}
                />

                {/* Beveled Top Cap Face */}
                <div
                    className={`relative w-full h-full rounded-full bg-linear-to-b border-[3px] sm:border-4 p-2 flex items-center justify-center shadow-[inset_0_3px_6px_rgba(255,255,255,0.7),inset_0_-8px_14px_rgba(0,0,0,0.4)] ${variant.top} ${variant.border}`}
                >
                    {/* Top Crescent Glass Highlight */}
                    <div className="absolute top-1 left-1/2 -translate-x-1/2 w-[70%] h-[35%] bg-linear-to-b from-white/50 to-transparent rounded-full blur-[0.5px] pointer-events-none" />

                    {/* Vector Icon */}
                    <div className="relative z-10 transition-transform group-hover:scale-110">
                        {icon}
                    </div>
                </div>
            </button>

            {/* Button Text Label */}
            {!isMain && label && (
                <span className="text-white/95 text-[9px] sm:text-xs font-extrabold tracking-wide drop-shadow-[0_1.5px_3px_rgba(0,0,0,0.9)] whitespace-nowrap">
                    {label}
                </span>
            )}
        </div>
    );
};

/* ==========================================================================
   CARVED WOODEN BANNER TITLE
   ========================================================================== */

const WoodenTitle = ({ titlePart1, titlePart2 }) => {
    return (
        <div className="relative flex flex-col items-center max-w-[85vw] sm:max-w-none">
            {/* Hanging Jungle Vines */}
            <div className="absolute -top-12 sm:-top-20 left-[15%] w-2.5 sm:w-3.5 h-14 sm:h-24 bg-[#1b4332] rounded-full z-0 flex flex-col items-center justify-between shadow-md">
                <div className="w-4 sm:w-6 h-2 sm:h-3 bg-[#c6fe69] rounded-full rotate-45 translate-x-1.5" />
                <div className="w-3 sm:w-5 h-1.5 sm:h-2.5 bg-[#c6fe69] rounded-full -rotate-45 -translate-x-1.5" />
            </div>
            <div className="absolute -top-12 sm:-top-20 right-[15%] w-2.5 sm:w-3.5 h-14 sm:h-24 bg-[#1b4332] rounded-full z-0 flex flex-col items-center justify-between shadow-md">
                <div className="w-3 sm:w-5 h-1.5 sm:h-2.5 bg-[#c6fe69] rounded-full rotate-45 translate-x-1.5" />
                <div className="w-4 sm:w-6 h-2 sm:h-3 bg-[#c6fe69] rounded-full -rotate-45 -translate-x-1.5" />
            </div>

            {/* Cedar Wooden Board */}
            <div className="relative z-10 bg-[#7f4f24] border-4 sm:border-[6px] border-t-[#a66a38] border-b-[#582f0e] border-x-[#6c3a11] rounded-xl sm:rounded-3xl shadow-[0_10px_24px_rgba(0,0,0,0.3)] px-4 py-1.5 sm:px-10 sm:py-4 text-center overflow-hidden">
                {/* Wood Grain Lines */}
                <div className="absolute top-[30%] left-0 w-full h-0.5 bg-[#3d2314]/30 rounded-full" />
                <div className="absolute top-[60%] left-0 w-full h-0.5 bg-[#3d2314]/30 rounded-full" />

                {/* Title Text */}
                <h1 className="relative z-20 flex flex-col items-center justify-center filter drop-shadow-[0_3px_5px_rgba(0,0,0,0.4)]">
                    <span
                        className="text-[1.6rem] sm:text-[3.2rem] leading-none font-black text-[#ffd166] tracking-wider"
                        style={{
                            WebkitTextStroke: '1px #ffffff',
                            textShadow: '0 2px 0 #9e2a2b, 0 4px 8px rgba(0,0,0,0.4)',
                        }}
                    >
                        {titlePart1}
                    </span>
                    <span
                        className="text-[1.2rem] sm:text-[2.4rem] leading-none font-black text-[#90e0ef] tracking-wide transform -rotate-2 mt-0.5 sm:mt-1"
                        style={{
                            WebkitTextStroke: '1px #ffffff',
                            textShadow: '0 2px 0 #1d3557, 0 3px 6px rgba(0,0,0,0.4)',
                        }}
                    >
                        {titlePart2}
                    </span>
                </h1>

                {/* Leaves in Accent #c6fe69 */}
                <div className="absolute -top-1.5 -left-1.5 text-[#c6fe69] drop-shadow-md rotate-45 scale-65 sm:scale-100">
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22L6.66 19.7C7.14 19.87 7.64 20 8 20C19 20 22 3 22 3C21 5 14 5.25 9 6.25C4 7.25 7.05 10.67 9.24 12.31C9.64 12.67 11.16 14.07 13.56 15.2C13.88 14 14.62 12.83 15.65 11.83C16.68 10.83 18 10 19.46 9.5C18.66 8.87 17.86 8.37 17 8Z" />
                    </svg>
                </div>
                <div className="absolute -bottom-1.5 -right-1.5 text-[#c6fe69] drop-shadow-md -rotate-45 scale-65 sm:scale-100">
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22L6.66 19.7C7.14 19.87 7.64 20 8 20C19 20 22 3 22 3C21 5 14 5.25 9 6.25C4 7.25 7.05 10.67 9.24 12.31C9.64 12.67 11.16 14.07 13.56 15.2C13.88 14 14.62 12.83 15.65 11.83C16.68 10.83 18 10 19.46 9.5C18.66 8.87 17.86 8.37 17 8Z" />
                    </svg>
                </div>
            </div>
        </div>
    );
};

export function GameHUD({ playerName, onMenuClick, onTasksClick, completedTasks, totalTasks, isTouchDevice = false }) {
    const menuIcon = 'https://cdn-icons-png.flaticon.com/128/10486/10486773.png';
    const taskIcon = 'https://cdn-icons-png.flaticon.com/128/9741/9741134.png';

    return (
        <div className="hud-top-layout pointer-events-none absolute inset-x-0 top-[calc(env(safe-area-inset-top)+0.55rem)] z-65 px-1 sm:px-4">
            <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-1 sm:gap-3">
                <div className="pointer-events-auto flex min-w-0 items-center gap-1 sm:gap-2">
                    <ActionButton
                        variant="primary"
                        size={isTouchDevice ? 'md' : 'sm'}
                        className="shrink-0 px-0! w-11!"
                        onClick={onMenuClick}
                        aria-label="Menu"
                        title="Menu"
                    >
                        <img src={menuIcon} alt="" draggable={false} className="h-5 w-5 sm:h-6 sm:w-6" />
                    </ActionButton>

                    <div className="hud-player-pill min-w-0 rounded-full border border-emerald-200/90 bg-white px-2 py-1 sm:px-3 sm:py-1.5 shadow-[0_8px_18px_-14px_rgba(5,46,22,0.55)]">
                        <p className="max-w-24 sm:max-w-52 truncate text-[11px] sm:text-sm font-black text-emerald-950">
                            {playerName || 'Explorer'}
                        </p>
                    </div>
                </div>

                <div className="pointer-events-auto">
                    <ActionButton
                        variant="secondary"
                        size={isTouchDevice ? 'md' : 'sm'}
                        className="gap-1 sm:gap-1.5"
                        onClick={onTasksClick}
                        aria-label="Tasks"
                        title="Tasks"
                    >
                        <img src={taskIcon} alt="" draggable={false} className="h-5 w-5 sm:h-6 sm:w-6" />
                        <span className="rounded-full bg-emerald-100 px-1 sm:px-1.5 py-0.5 text-[9px] sm:text-[10px] font-black text-emerald-900">
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
                    <SelectRow
                        label="Graphics Quality"
                        description="Visual fidelity and performance"
                        options={[
                            { label: 'Low', value: 'low' },
                            { label: 'Medium', value: 'medium' },
                            { label: 'High', value: 'high' }
                        ]}
                        value={settings.graphicsQuality || 'medium'}
                        onChange={(val) => update({ graphicsQuality: val })}
                    />
                    <SelectRow
                        label="FPS Limit"
                        description="Maximum frame rate"
                        options={[
                            { label: '24', value: 24 },
                            { label: '30', value: 30 },
                            { label: '60', value: 60 }
                        ]}
                        value={settings.fpsLimit ?? 60}
                        onChange={(val) => update({ fpsLimit: val })}
                    />

                    <hr className="border-slate-200" />

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
        <div className="pointer-events-none absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] z-75 flex justify-center px-3 sm:bottom-24">
            <SurfacePanel className="pointer-events-auto w-full max-w-sm p-2.5 sm:p-3" data-ui-panel="true">
                <p className="text-center text-[11px] sm:text-xs font-bold text-slate-600">Near {animalName || 'animal'}</p>
                <div className="mt-1.5 sm:mt-2 grid grid-cols-2 gap-1.5 sm:gap-2">
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
        <div className="pointer-events-none absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] z-75 flex justify-center px-3 sm:bottom-24">
            <SurfacePanel className="pointer-events-auto w-full max-w-sm p-2.5 sm:p-3" data-ui-panel="true">
                <p className="text-center text-[11px] sm:text-xs font-bold text-slate-600">Talk to {npcName}</p>
                {!isTouchDevice ? <p className="mt-1 text-center text-[11px] font-black uppercase tracking-[0.12em] text-amber-700">Press T to talk</p> : null}
                <ActionButton variant="warning" className="mt-1.5 sm:mt-2 w-full" onClick={onInteract}>
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
        <div className="pointer-events-none absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+0.8rem)] z-70 px-3 md:hidden">
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
        return (
            <div className="pointer-events-none absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] z-74 px-3">
                <SurfacePanel className="pointer-events-auto mx-auto max-w-lg p-2.5 sm:p-3" data-ui-panel="true">
                    <div className="flex items-start justify-between gap-2 sm:gap-3">
                        <div className="min-w-0">
                            <h3 className="truncate text-xs sm:text-sm font-black text-slate-900">{animal.name}</h3>
                            <p className="mt-0.5 line-clamp-2 text-[11px] sm:text-xs font-semibold leading-relaxed text-slate-600">{animal.description}</p>
                        </div>
                        <IconButton onClick={onClose} className="h-7 w-7 sm:h-8 sm:w-8 shrink-0">
                            <span className="text-xs font-black">x</span>
                        </IconButton>
                    </div>

                    <div className="mt-2 sm:mt-3 grid grid-cols-2 gap-1.5 sm:gap-2">
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
                className="pointer-events-auto grid h-28 w-28 place-items-center rounded-full border border-white/35 bg-slate-950/25 touch-none select-none backdrop-blur sm:h-28 sm:w-28"
            >
                <div ref={stickRef} className="h-12 w-12 rounded-full border border-white/50 bg-white/85 shadow sm:h-12 sm:w-12" />
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
                className="pointer-events-auto inline-flex h-16 w-16 items-center justify-center rounded-full border border-white/45 bg-amber-400/95 text-sm font-black uppercase tracking-[0.08em] text-slate-900 shadow-lg active:scale-95 sm:h-16 sm:w-16 sm:text-sm touch-manipulation"
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