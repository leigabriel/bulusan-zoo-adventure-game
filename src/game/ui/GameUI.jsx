/* eslint-disable react-refresh/only-export-components */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import gsap from 'gsap';
import { CustomEase } from 'gsap/CustomEase';
import { resolveAssetUrl } from '../utils/localAssets.js';
import { ActionButton, GameButton, IconButton, ModalShell, SideSheet, SurfacePanel, cx } from './UIComponents.jsx';

let sketchbookEaseRegistered = false;
function ensureSketchbookEase() {
    if (sketchbookEaseRegistered) return;
    sketchbookEaseRegistered = true;
    gsap.registerPlugin(CustomEase);
    CustomEase.create('sketchbookTurn', '.42,.05,.25,1');
}

const SETTINGS_KEY = 'minizoo_settings';
const SETTINGS_CHANGE_EVENT = 'minizoo-settings-changed';
const PLAYER_NAME_KEY = 'minizoo_player_name';
const PLAYER_NAME_CHANGE_EVENT = 'minizoo-player-name-changed';

const SFX_FILES = {
    tap: '/audio/click.mp3',
    feed: '/audio/feed.wav',
    confirm: '/audio/click.mp3',
    'task-complete': '/audio/finish-task.mp3',
    'page-turn': '/audio/book-page-turning.mp3',
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
    ambienceVolume: 1.0,
    musicVolume: 0.5,
    uiVolume: 1.0,
    sfxVolume: 1.0,
    graphicsQuality: 'medium',
    fpsLimit: 60,
    sensitivity: 1.0
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
        const settings = readSettings();
        return (settings.uiVolume ?? 1.0) > 0;
    } catch {
        return true;
    }
}

function getUIButtonAudioTemplate(kind = 'tap') {
    const src = SFX_FILES[kind] || SFX_FILES.tap;
    if (!uiAudioTemplates[src]) {
        const template = new Audio(src);
        template.preload = 'auto';
        template.volume = 0;
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
            onClick={onToggle}
            className={cx(
                "flex w-full items-center justify-between rounded-2xl border-2 px-4 py-3 transition-all active:translate-y-1 active:shadow-none",
                enabled
                    ? "border-emerald-100 bg-emerald-50 shadow-[0_4px_0_0_#d1fae5]"
                    : "border-slate-100 bg-slate-50 shadow-[0_4px_0_0_#f1f5f9]"
            )}
        >
            <div className="text-left">
                <span className={cx("block text-sm font-black uppercase tracking-wider", enabled ? "text-emerald-800" : "text-slate-500")}>
                    {label}
                </span>
                {description && <span className="block text-[10px] font-semibold text-slate-400">{description}</span>}
            </div>
            <div className={cx(
                "h-6 w-11 rounded-full p-1 transition-colors",
                enabled ? "bg-emerald-500" : "bg-slate-300"
            )}>
                <div className={cx(
                    "h-4 w-4 rounded-full bg-white transition-transform",
                    enabled ? "translate-x-5" : "translate-x-0"
                )} />
            </div>
        </button>
    );
}

function VolumeSliderRow({ label, description, value, onChange }) {
    return (
        <div className="flex w-full flex-col gap-2 rounded-2xl border-2 border-slate-100 bg-white p-4 shadow-sm">
            <div className="flex justify-between items-center px-1">
                <div className="text-left">
                    <span className="block text-sm font-black uppercase tracking-wider text-slate-800">{label}</span>
                    {description && <span className="block text-[10px] font-semibold text-slate-400">{description}</span>}
                </div>
                <span className="text-xs font-black text-emerald-600">{Math.round(value * 100)}%</span>
            </div>

            <div className="relative mt-1 h-8 flex items-center px-1">
                <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={value}
                    onChange={(e) => onChange(parseFloat(e.target.value))}
                    className="w-full h-3 rounded-full appearance-none bg-slate-100 cursor-pointer accent-emerald-500 [&::-webkit-slider-runnable-track]:h-3 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-emerald-500 [&::-webkit-slider-thumb]:border-4 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:-mt-1.5"
                />
            </div>
        </div>
    );
}

function SelectRow({ label, options = [], value, onChange }) {
    return (
        <div className="flex w-full flex-col gap-2 rounded-2xl border-2 border-slate-100 bg-white p-3 shadow-sm">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 px-1">
                {label}
            </span>
            <div className="flex gap-2" role="radiogroup">
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
                                'flex-1 rounded-xl py-2 text-xs font-black uppercase tracking-wider transition-all',
                                isSelected
                                    ? 'bg-emerald-500 text-white shadow-[0_4px_0_0_#065f46]'
                                    : 'bg-emerald-50 text-emerald-700 shadow-[0_4px_0_0_#d1fae5] hover:bg-emerald-100'
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
        <div className="space-y-4 text-sm text-slate-700">
            <p className="font-semibold text-center italic">Explore Bulusan Zootopia Adventure, feed the animals, and complete your zoo mission!</p>

            <div className="grid gap-3">
                <div className="rounded-2xl border-2 border-slate-100 bg-white p-4 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-[0.15em] text-emerald-600 mb-2">How to Move</p>
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0">🕹️</div>
                        <p className="font-bold text-slate-800 leading-tight">Use the Joystick on the left to walk around the zoo.</p>
                    </div>
                </div>

                <div className="rounded-2xl border-2 border-slate-100 bg-white p-4 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-[0.15em] text-amber-600 mb-2">How to Jump</p>
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">🦘</div>
                        <p className="font-bold text-slate-800 leading-tight">Tap the Jump button on the right to leap over obstacles.</p>
                    </div>
                </div>

                <div className="rounded-2xl border-2 border-slate-100 bg-white p-4 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-[0.15em] text-sky-600 mb-2">Interactions</p>
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-sky-100 flex items-center justify-center shrink-0">🍎</div>
                        <p className="font-bold text-slate-800 leading-tight">Walk near an animal to see the Feed and Info buttons.</p>
                    </div>
                </div>
            </div>

            <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-4 text-center">
                <p className="font-black text-emerald-800 uppercase tracking-widest text-xs">Your Goal</p>
                <p className="mt-1 font-bold text-emerald-900 leading-snug">Feed every animal to unlock your completion certificate!</p>
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
    const settings = readSettings();
    const volume = settings.uiVolume ?? 1.0;
    if (volume <= 0) return;

    try {
        const template = getUIButtonAudioTemplate(kind);
        const finalSrc = template.currentSrc || template.src || SFX_FILES[kind] || SFX_FILES.tap;
        if (!finalSrc) return;

        const audio = new Audio(finalSrc);
        audio.volume = (kind === 'feed' || kind === 'task-complete' || kind === 'confirm') ? volume : volume * 0.85;
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
        // Initial position, will be updated by fitCamera
        camera.position.set(0, 1.0, 5.0);

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.setSize(width, height);
        container.appendChild(renderer.domElement);

        const ambient = new THREE.AmbientLight(0xffffff, 1.5);
        scene.add(ambient);
        const key = new THREE.DirectionalLight(0xffffff, 2.5);
        key.position.set(5, 5, 5);
        scene.add(key);
        const fill = new THREE.DirectionalLight(0xffffff, 1.2);
        fill.position.set(-5, 2, -3);
        scene.add(fill);

        // Add a stage disc
        const stageGeom = new THREE.CylinderGeometry(1.2, 1.2, 0.1, 32);
        const stageMat = new THREE.MeshStandardMaterial({ color: 0x065f46, roughness: 0.5 });
        const stage = new THREE.Mesh(stageGeom, stageMat);
        stage.position.y = -0.05;
        scene.add(stage);

        let modelGroup = null;

        const fitCamera = () => {
            if (!modelGroup) return;
            const box = new THREE.Box3().setFromObject(modelGroup);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());

            const fov = camera.fov * (Math.PI / 180);
            let distance = Math.abs(size.y / Math.tan(fov / 2));

            // Adjust for aspect ratio
            const aspect = width / height;
            if (aspect < 1) {
                distance = distance / aspect;
            }

            camera.position.set(0, center.y + size.y * 0.05, distance * 1.2);
            camera.lookAt(center.x, center.y + size.y * 0.05, center.z);
            camera.updateProjectionMatrix();
        };

        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                width = entry.contentBoxSize?.[0]?.inlineSize || entry.contentRect.width || width;
                height = entry.contentBoxSize?.[0]?.blockSize || entry.contentRect.height || height;
                camera.aspect = width / height;
                camera.updateProjectionMatrix();
                renderer.setSize(width, height);
                fitCamera();
            }
        });
        resizeObserver.observe(container);

        let mixer = null;
        let idleAction = null;
        let animationId = null;

        resolveAssetUrl(`/models/characters/${modelFile}`)
            .then((url) => {
                if (!url) return;
                const loader = new GLTFLoader();
                loader.load(url, (gltf) => {
                    modelGroup = gltf.scene;

                    // Normalize model size
                    const box = new THREE.Box3().setFromObject(modelGroup);
                    const size = box.getSize(new THREE.Vector3());
                    const maxDim = Math.max(size.x, size.y, size.z);
                    const scale = 2.0 / maxDim; // Fixed size normalization
                    modelGroup.scale.set(scale, scale, scale);

                    scene.add(modelGroup);
                    fitCamera();

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

function SettingsModal({ isOpen, onClose, onQuit, onResetTasks, showNameInput = true, cameraMode, onCameraModeChange }) {
    const [settings, setSettings] = useState(() => readSettings());
    const [playerName, setPlayerName] = useState(() => readPlayerName());
    const [showAudioSubSettings, setShowAudioSubSettings] = useState(false);
    const [howToPlayOpen, setHowToPlayOpen] = useState(false);

    const toggle = useCallback((key) => {
        const next = { ...settings, [key]: settings[key] === false };
        setSettings(next);
        persistSettings(next);
    }, [settings]);

    const handleSaveName = useCallback(() => {
        savePlayerName(playerName);
    }, [playerName]);

    const handleVolumeChange = (key, val) => {
        const next = { ...settings, [key]: val };
        setSettings(next);
        persistSettings(next);
    };

    if (!isOpen) return null;

    return (
        <>
            <ModalShell isOpen={isOpen} onClose={onClose} title="Game Settings" size="md">
                <div className="space-y-6">
                    <div className="grid gap-4 sm:grid-cols-2">
                        {showNameInput && (
                            <div className="rounded-2xl border-2 border-slate-100 bg-white p-4 shadow-sm sm:col-span-2">
                                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2" htmlFor="settings-player-name">
                                    Player Name
                                </label>
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
                                    className="block w-full rounded-xl border-2 border-slate-100 bg-slate-50 px-4 py-3 text-base font-black text-slate-800 outline-none transition focus:border-emerald-400 focus:bg-white"
                                    placeholder="Your name"
                                />
                            </div>
                        )}

                        <SelectRow
                            label="Graphics"
                            options={[
                                { label: 'Low', value: 'low' },
                                { label: 'Med', value: 'medium' },
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
                            options={[
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

                        <div className="sm:col-span-2">
                            <SelectRow
                                label="View Perspective"
                                options={[
                                    { label: 'First Person', value: 'first' },
                                    { label: 'Third Person', value: 'third' }
                                ]}
                                value={cameraMode}
                                onChange={onCameraModeChange}
                            />
                        </div>

                        <div className="sm:col-span-2">
                            <SelectRow
                                label="Look Sensitivity"
                                options={[
                                    { label: 'Slow', value: 0.5 },
                                    { label: 'Normal', value: 1.0 },
                                    { label: 'Fast', value: 1.8 }
                                ]}
                                value={settings.sensitivity ?? 1.0}
                                onChange={(val) => {
                                    const next = { ...settings, sensitivity: val };
                                    setSettings(next);
                                    persistSettings(next);
                                }}
                            />
                        </div>
                    </div>

                    <div className="space-y-3">
                        <button
                            type="button"
                            onClick={() => setShowAudioSubSettings(!showAudioSubSettings)}
                            className="flex w-full items-center justify-between rounded-2xl border-2 border-slate-100 bg-white px-4 py-3 shadow-sm transition-all active:translate-y-px"
                        >
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Audio Settings</span>
                            <span className={cx("text-xl transition-transform duration-200", showAudioSubSettings ? "rotate-180" : "")}>
                                {showAudioSubSettings ? '−' : '+'}
                            </span>
                        </button>

                        {showAudioSubSettings && (
                            <div className="grid grid-cols-1 gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
                                <VolumeSliderRow
                                    label="Music"
                                    description="Background"
                                    value={settings.musicVolume ?? 0.5}
                                    onChange={(v) => handleVolumeChange('musicVolume', v)}
                                />
                                <VolumeSliderRow
                                    label="Ambience"
                                    description="Nature"
                                    value={settings.ambienceVolume ?? 1.0}
                                    onChange={(v) => handleVolumeChange('ambienceVolume', v)}
                                />
                                <VolumeSliderRow
                                    label="SFX"
                                    description="Animals"
                                    value={settings.sfxVolume ?? 1.0}
                                    onChange={(v) => handleVolumeChange('sfxVolume', v)}
                                />
                                <VolumeSliderRow
                                    label="UI"
                                    description="Buttons"
                                    value={settings.uiVolume ?? 1.0}
                                    onChange={(v) => handleVolumeChange('uiVolume', v)}
                                />
                            </div>
                        )}
                    </div>

                    <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 border-t-2 border-slate-50">
                        {onResetTasks && (
                            <ActionButton variant="warning" className="h-14 text-base" onClick={onResetTasks}>
                                Reset Progress
                            </ActionButton>
                        )}

                        {onQuit && (
                            <ActionButton variant="danger" className="h-14 text-base" onClick={onQuit}>
                                Quit Game
                            </ActionButton>
                        )}
                    </div>
                </div>
            </ModalShell>
        </>
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
        playGameButtonSfx('tap');
        setSelectedIndex((prev) => (prev + 1) % characterOptions.length);
    };

    const handlePrev = () => {
        playGameButtonSfx('tap');
        setSelectedIndex((prev) => (prev - 1 + characterOptions.length) % characterOptions.length);
    };

    const handleLaunch = () => {
        playGameButtonSfx('confirm');
        onSelect(previewChar);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-125 flex flex-col bg-linear-to-b from-[#c6fe69] to-[#70e000] safe-area-inset font-['Qilka',sans-serif] overflow-hidden">

            {/* --- TOP BAR --- */}
            <div className="flex justify-between items-center p-4 sm:p-8 shrink-0 relative z-30">
                <div className="flex flex-col">
                    <h1 className="text-xl sm:text-4xl font-black text-emerald-950 uppercase leading-none tracking-tight">
                        Select Your Hero
                    </h1>
                </div>
                <div className="bg-emerald-950 text-[#c6fe69] px-4 py-1 rounded-full text-sm sm:text-xl font-black shadow-lg">
                    {selectedIndex + 1} / {characterOptions.length}
                </div>
            </div>

            {/* --- MAIN SELECTION AREA --- */}
            <div className="flex-1 relative flex flex-col items-center justify-center min-h-0">
                {/* Radial Stage Effect */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.4)_0%,transparent_75%)] pointer-events-none" />

                {/* 3D Character Stage */}
                <div className="flex-1 w-full max-w-6xl relative flex items-center justify-center">

                    {/* Navigation - Floating - Smaller Buttons */}
                    <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-between px-4 sm:px-12 z-40 pointer-events-none">
                        <button
                            onClick={handlePrev}
                            className="pointer-events-auto bg-white/95 backdrop-blur-md text-slate-900 w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center shadow-[0_4px_0_0_#cbd5e1] active:translate-y-0.5 active:shadow-none transition-all hover:bg-white"
                        >
                            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M15 19l-7-7 7-7"></path></svg>
                        </button>

                        <button
                            onClick={handleNext}
                            className="pointer-events-auto bg-white/95 backdrop-blur-md text-slate-900 w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center shadow-[0_4px_0_0_#cbd5e1] active:translate-y-0.5 active:shadow-none transition-all hover:bg-white"
                        >
                            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M9 5l7 7-7 7"></path></svg>
                        </button>
                    </div>

                    <div className="w-full h-full relative z-10 flex items-center justify-center overflow-visible scale-110 sm:scale-125">
                        {previewChar && <Character3DPreview modelFile={previewChar.file} />}
                    </div>
                </div>

                {/* Character Name Badge - More subtle and cleaner */}
                <div className="mb-6 sm:mb-8 bg-emerald-950/90 text-white px-6 py-1.5 rounded-full shadow-xl border border-emerald-400/20 z-30 shrink-0 backdrop-blur-sm">
                    <h2 className="text-sm sm:text-base font-black uppercase tracking-[0.2em]">{previewChar?.label}</h2>
                </div>
            </div>

            {/* --- FOOTER ACTIONS --- */}
            <div className="p-4 sm:p-8 flex items-center justify-between gap-4 shrink-0 bg-white/10 backdrop-blur-md border-t border-emerald-950/10">
                <GameButton
                    onClick={onClose}
                    color="slate"
                    size="lg"
                    className="flex-1 sm:flex-none sm:min-w-48 text-sm sm:text-lg"
                >
                    BACK
                </GameButton>

                <GameButton
                    onClick={handleLaunch}
                    color="dark"
                    size="lg"
                    className="flex-1 sm:flex-none sm:min-w-64 text-sm sm:text-lg"
                >
                    <div className="flex items-center justify-center gap-2">
                        <span className="hidden sm:inline">START EXPLORING</span>
                        <span className="sm:hidden">START</span>
                        <span className="text-xl">🚀</span>
                    </div>
                </GameButton>
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
        <div className="fixed inset-0 z-40 flex flex-col items-center overflow-hidden font-['Qilka',sans-serif] select-none touch-none bg-emerald-900">
            {/* ---------------- BACKGROUND DECORATION (FILLS EVERYTHING) ---------------- */}
            <div className="absolute -inset-x-20 inset-y-0 z-0 bg-linear-to-b from-[#70e0ff] via-[#a2d2ff] to-[#c6fe69] pointer-events-none" aria-hidden="true">
                <div className="absolute -top-[15%] left-1/2 -translate-x-1/2 w-[120vw] h-[60vh] rounded-full bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.4)_0%,rgba(255,255,255,0)_70%)] animate-pulse" />

                {/* Clouds */}
                <div className="absolute top-[5%] left-[6%] w-20 sm:w-36 h-6 sm:h-10 bg-white/70 rounded-full blur-[0.5px] animate-[kids-float_6s_ease-in-out_infinite]" />
                <div className="absolute top-[9%] right-[8%] w-28 sm:w-48 h-8 sm:h-12 bg-white/60 rounded-full blur-[0.5px] animate-[kids-float_8s_ease-in-out_infinite_1s]" />

                <div className="absolute bottom-0 w-full h-[40%] bg-[#c6fe69] rounded-t-[100%] scale-[1.7] translate-y-1/3 shadow-[0_-12px_24px_rgba(0,0,0,0.05)]" />
                <div className="absolute bottom-0 w-full h-[25%] bg-[#70e000] rounded-t-[100%] scale-[1.4] translate-y-1/4 shadow-[0_-10px_20px_rgba(0,0,0,0.05)]" />
                <div className="absolute bottom-0 w-full h-[12%] bg-[#38b000] rounded-t-[100%] scale-[1.2] translate-y-1/4 shadow-[0_-8px_16px_rgba(0,0,0,0.05)]" />
            </div>

            {/* ---------------- MAIN CONTENT WRAPPER (RESPECTS SAFE AREA) ---------------- */}
            <div className="relative z-30 flex h-full w-full flex-col items-center justify-between p-3 sm:p-6 safe-area-inset">

                {/* --- TOP SECTION: TITLE --- */}
                <div className="w-full flex flex-col items-center pt-0 shrink-0 scale-[0.4] sm:scale-90 md:scale-110 origin-top mb-2 sm:mb-4">
                    <WoodenTitle titlePart1="Bulusan" titlePart2="Zoo Adventure" />
                </div>

                {/* --- SPACER / CENTER AREA --- */}
                <div className="flex-1 min-h-0 flex items-center justify-center py-1">
                    {/* PRIMARY PLAY BUTTON */}
                    <button
                        onClick={handleStart}
                        disabled={starting}
                        className="group relative w-full max-w-25 sm:max-w-30 transition-all active:scale-95 disabled:opacity-50"
                    >
                        <img
                            src="/ui-buttons/play-button.png"
                            alt="PLAY NOW"
                            className="w-full h-auto drop-shadow-xl group-hover:scale-105 transition-transform animate-bounce-subtle"
                        />
                    </button>
                </div>

                {/* --- BOTTOM SECTION: NAVIGATION --- */}
                <div className="w-full max-w-2xl shrink-0 pb-1 sm:pb-4">
                    <div className="flex items-center justify-center gap-3 sm:gap-6 px-2">
                        <button
                            onClick={() => setHowToPlayOpen(true)}
                            className="group relative w-12 h-12 sm:w-20 sm:h-20 transition-all active:scale-90"
                            title="Guide"
                        >
                            <img src="/ui-buttons/how-to-play-button.png" alt="Guide" className="w-full h-full object-contain group-hover:scale-110 transition-transform" />
                        </button>

                        <button
                            onClick={() => setCharSelectOpen(true)}
                            className="group relative w-12 h-12 sm:w-20 sm:h-20 transition-all active:scale-90"
                            title="Characters"
                        >
                            <img src="/ui-buttons/character-button.png" alt="Characters" className="w-full h-full object-contain group-hover:scale-110 transition-transform" />
                        </button>

                        <button
                            onClick={() => setSettingsOpen(true)}
                            className="group relative w-12 h-12 sm:w-20 sm:h-20 transition-all active:scale-90"
                            title="Settings"
                        >
                            <img src="/ui-buttons/settings-button.png" alt="Settings" className="w-full h-full object-contain group-hover:scale-110 transition-transform" />
                        </button>

                        <button
                            onClick={() => setShowExitConfirm(true)}
                            className="group relative w-12 h-12 sm:w-20 sm:h-20 transition-all active:scale-90"
                            title="Quit"
                        >
                            <img src="/ui-buttons/quit-button.png" alt="Quit" className="w-full h-full object-contain group-hover:scale-110 transition-transform" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Modals */}
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
                    if (Capacitor.isNativePlatform()) {
                        try {
                            CapacitorApp.exitApp();
                        } catch (e) {
                            console.error("Error exiting app:", e);
                            if (window.navigator && window.navigator.app && window.navigator.app.exitApp) {
                                window.navigator.app.exitApp();
                            }
                        }
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
   CARVED WOODEN BANNER TITLE
   ========================================================================== */

const WoodenTitle = ({ titlePart1, titlePart2, className = '' }) => {
    return (
        <div className={cx("relative flex flex-col items-center select-none", className)}>
            {/* Wooden Ropes - Long enough to hang from the top of the screen regardless of scale */}
            <div className="absolute -top-250 left-1/4 w-1 sm:w-1.5 h-255 bg-[#3d2314] rounded-full z-0 opacity-90 shadow-sm" />
            <div className="absolute -top-250 right-1/4 w-1 sm:w-1.5 h-255 bg-[#3d2314] rounded-full z-0 opacity-90 shadow-sm" />

            {/* Cedar Wooden Board */}
            <div className="relative z-10 bg-linear-to-b from-[#7f4f24] to-[#582f0e] border-4 sm:border-[6px] border-[#6c3a11] rounded-2xl sm:rounded-3xl shadow-[0_8px_0_0_#3d2314] px-6 py-2 sm:px-12 sm:py-4 text-center overflow-hidden">
                {/* Wood Grain Pattern (CSS) */}
                <div className="absolute inset-0 opacity-10 pointer-events-none"
                     style={{ backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 20px, rgba(0,0,0,0.5) 20px, rgba(0,0,0,0.5) 21px)' }} />

                {/* Title Text */}
                <h1 className="relative z-20 flex flex-col items-center justify-center">
                    <span
                        className="text-2xl sm:text-5xl leading-none font-black text-[#ffd166] tracking-tight uppercase"
                        style={{
                            WebkitTextStroke: '1px #ffffff',
                            textShadow: '0 3px 0 #9e2a2b, 0 6px 12px rgba(0,0,0,0.5)',
                        }}
                    >
                        {titlePart1}
                    </span>
                    <span
                        className="text-lg sm:text-3xl leading-none font-black text-[#90e0ef] tracking-wide uppercase mt-0.5 sm:mt-1"
                        style={{
                            WebkitTextStroke: '1px #ffffff',
                            textShadow: '0 2px 0 #1d3557, 0 4px 8px rgba(0,0,0,0.5)',
                        }}
                    >
                        {titlePart2}
                    </span>
                </h1>
            </div>
        </div>
    );
};

export function GameHUD({ playerName, onMenuClick, onTasksClick, completedTasks, totalTasks, isTouchDevice = false }) {
    const menuIcon = '/ui-buttons/settings-button.png';
    const taskIcon = '/ui-buttons/task-list-button.png';

    return (
        <div className="hud-top-layout pointer-events-none absolute inset-x-0 top-[calc(env(safe-area-inset-top)+0.55rem)] z-65 px-1 sm:px-4 select-none">
            <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-1 sm:gap-3">

                {/* Left Side: Player & Menu */}
                <div className="pointer-events-auto flex min-w-0 items-center gap-1.5 sm:gap-3" data-ui-hud="true">
                    <button
                        onClick={onMenuClick}
                        className="group flex h-10 w-10 sm:h-14 sm:w-14 items-center justify-center transition-all active:scale-95"
                        aria-label="Menu"
                        data-ui-button="true"
                    >
                        <img src={menuIcon} alt="" className="h-full w-full object-contain group-hover:scale-110 transition-transform" />
                    </button>

                    <div className="hud-player-pill flex min-w-0 items-center gap-2 rounded-2xl border-2 border-white/50 bg-emerald-950/80 px-3 py-1.5 sm:px-4 sm:py-2 backdrop-blur-md shadow-xl">
                        <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                        <p className="max-w-20 sm:max-w-50 truncate text-[10px] sm:text-xs font-black uppercase tracking-widest text-white">
                            {playerName || 'Explorer'}
                        </p>
                    </div>
                </div>

                {/* Right Side: Tasks */}
                <div className="pointer-events-auto flex items-center gap-1.5 sm:gap-3" data-ui-hud="true">
                    <button
                        onClick={onTasksClick}
                        className="group flex h-10 w-10 sm:h-14 sm:w-14 items-center justify-center transition-all active:scale-95"
                        aria-label="Tasks"
                        data-ui-button="true"
                    >
                        <img src={taskIcon} alt="" className="h-full w-full object-contain group-hover:scale-110 transition-transform" />
                    </button>
                </div>
            </div>
        </div>
    );
}

export function SettingsPanel({ isOpen, onClose, onQuit, onResetTasks, cameraMode, onCameraModeChange }) {
    return (
        <SettingsModal
            isOpen={isOpen}
            onClose={onClose}
            onQuit={onQuit}
            onResetTasks={onResetTasks}
            showNameInput={false}
            cameraMode={cameraMode}
            onCameraModeChange={onCameraModeChange}
        />
    );
}

export function TaskPanel({ isOpen, onClose, tasks = [], onTaskClick }) {
    const completedCount = tasks.filter((task) => task.completed).length;
    const progressPercent = (completedCount / (tasks.length || 1)) * 100;

    return (
        <SideSheet isOpen={isOpen} onClose={onClose} title="Zoo Missions" side="right">
            <div className="space-y-4">
                <div className="rounded-2xl bg-emerald-950 p-4 text-white shadow-xl">
                    <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Total Progress</span>
                        <span className="text-sm font-black">{completedCount} / {tasks.length}</span>
                    </div>
                    <div className="h-3 w-full bg-emerald-900/50 rounded-full overflow-hidden border border-white/10">
                        <div
                            className="h-full bg-linear-to-r from-emerald-500 to-lime-400 transition-all duration-500 ease-out shadow-[0_0_12px_rgba(52,211,153,0.5)]"
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                </div>

                <div className="space-y-3" data-ui-scrollable="true">
                    {tasks.map((task) => (
                        <button
                            key={task.id}
                            type="button"
                            data-ui-button="true"
                            onClick={() => onTaskClick?.(task)}
                            className={cx(
                                'group flex w-full items-center justify-between gap-3 rounded-2xl border-2 px-4 py-3 text-left transition-all active:scale-[0.98]',
                                task.completed
                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800 shadow-[0_4px_0_0_#d1fae5]'
                                    : 'border-slate-100 bg-white text-slate-800 shadow-[0_4px_0_0_#f1f5f9] hover:border-amber-200 hover:bg-amber-50',
                            )}
                        >
                            <div className="flex items-center gap-3">
                                <div className={cx(
                                    "w-8 h-8 rounded-full flex items-center justify-center text-lg shadow-inner",
                                    task.completed ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-400"
                                )}>
                                    {task.completed ? '✓' : '•'}
                                </div>
                                <span className="text-sm sm:text-base font-black tracking-tight">{task.name}</span>
                            </div>
                            <span className={cx(
                                "shrink-0 rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-widest",
                                task.completed ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                            )}>
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
        <div className="pointer-events-none absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+6.5rem)] z-75 flex justify-center px-3 sm:bottom-28">
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
        <div className="pointer-events-none absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+6.5rem)] z-75 flex justify-center px-3 sm:bottom-28">
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
            <div className="pointer-events-none absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+6.5rem)] z-74 px-3 sm:bottom-28">
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
                <div
                    ref={stickRef}
                    className="h-12 w-12 rounded-full border border-white/50 bg-white/85 shadow sm:h-12 sm:w-12 transition-transform duration-150 ease-out"
                />
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

export const BOOK_PAGES = [
  { src: "/book/kyoto-performing-arts.png", title: "Kyoto Performing Arts Hall" },
  { src: "/book/kyoto.png", title: "Kyoto Garden Museum" },
  { src: "/book/castle.png", title: "Western Castle" },
  { src: "/book/taipei-market.png", title: "Taipei Night Market" },
  { src: "/book/osaka.png", title: "Osaka Castle" },
  { src: "/book/tokyo-museum.png", title: "Tokyo National Museum" },
];

export function SketchbookModal({ isOpen, onClose }) {
  const bookRef = useRef(null);
  const pageRef = useRef(null);
  const captionRef = useRef(null);
  const flipTweenRef = useRef(null);
  const currentPageRef = useRef(0);
  const introPlayingRef = useRef(false);

  const pages = BOOK_PAGES;

  const halfImage = (pageIndex, side) =>
    `<img src="${pages[pageIndex].src}" class="${side}">`;

  const showPage = (pageIndex) => {
    currentPageRef.current = pageIndex;
    if (pageRef.current) {
      pageRef.current.innerHTML = `
        <div class="half left">${halfImage(pageIndex, "left")}</div>
        <div class="half right">${halfImage(pageIndex, "right")}</div>`;
    }
  };

  const setCaption = (title) => {
    if (captionRef.current) {
      captionRef.current.textContent = title;
      gsap.fromTo(captionRef.current, { opacity: 0 }, { opacity: 1, duration: 0.4, overwrite: "auto" });
    }
  };

  const turn = (direction, duration = 0.85, ease = "pageTurn", onDone) => {
    if (flipTweenRef.current && flipTweenRef.current.isActive()) {
      flipTweenRef.current.progress(1);
    }

    playGameButtonSfx('page-turn');

    const goingNext = direction === "next";
    const targetPage = (currentPageRef.current + (goingNext ? 1 : -1) + pages.length) % pages.length;

    const liftSide = goingNext ? "right" : "left";
    const landSide = goingNext ? "left" : "right";

    if (bookRef.current) {
      bookRef.current.insertAdjacentHTML("beforeend", `
        <div class="turn">
          <div class="half ${liftSide}">${halfImage(targetPage, liftSide)}</div>
          <div class="flap ${goingNext ? "next" : "prev"}">
            <div class="face">${halfImage(currentPageRef.current, liftSide)}</div>
            <div class="face back">${halfImage(targetPage, landSide)}</div>
          </div>
        </div>`);

      setCaption(pages[targetPage].title);

      flipTweenRef.current = gsap.to(bookRef.current.querySelector(".flap"), {
        rotationY: goingNext ? -180 : 180,
        transformOrigin: goingNext ? "left center" : "right center",
        duration: duration,
        ease: ease,
        onComplete() {
          showPage(targetPage);
          const turnEl = bookRef.current?.querySelector(".turn");
          if (turnEl) turnEl.remove();
          if (onDone) onDone();
        }
      });
    }
  };

  const riffle = (step = 0) => {
    if (!introPlayingRef.current || step >= pages.length) {
      introPlayingRef.current = false;
      if (bookRef.current) bookRef.current.classList.remove("blur-light", "blur-heavy");
      return;
    }

    const bell = Math.sin(Math.PI * step / (pages.length - 1));
    if (bookRef.current) {
      bookRef.current.classList.toggle("blur-light", bell > 0.25 && bell <= 0.6);
      bookRef.current.classList.toggle("blur-heavy", bell > 0.6);
    }

    turn("next", 0.2 - 0.15 * bell, "none", () => riffle(step + 1));
  };

  const navigate = (direction) => {
    introPlayingRef.current = false;
    turn(direction);
  };

  useEffect(() => {
    if (!isOpen) return;

    gsap.registerPlugin(CustomEase);
    if (!gsap.parseEase("pageTurn")) {
      CustomEase.create("pageTurn", ".42,.05,.25,1");
    }

    showPage(0);
    setCaption(pages[0].title);

    const introTimer = gsap.delayedCall(0.2, () => {
      introPlayingRef.current = true;
      riffle();
    });

    const onKeyDown = (event) => {
      if (event.key === "ArrowRight") navigate("next");
      if (event.key === "ArrowLeft") navigate("prev");
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      introTimer.kill();
      if (flipTweenRef.current) flipTweenRef.current.kill();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="sketchbook-overlay">
      <button className="sketchbook-close-btn" onClick={onClose}>&times;</button>

      <h1>Sketchbook</h1>

      <svg width="0" height="0" aria-hidden="true" style={{ position: 'absolute' }}>
        <filter id="motion-blur-light"><feGaussianBlur stdDeviation="5 0" /></filter>
        <filter id="motion-blur-heavy"><feGaussianBlur stdDeviation="14 0" /></filter>
      </svg>

      <div className="stage">
        <button className="arrow" onClick={() => navigate("prev")}>‹</button>
        <div
          className="book"
          ref={bookRef}
          onClick={(e) => {
            const rect = bookRef.current.getBoundingClientRect();
            const x = e.clientX - rect.left;
            navigate(x < rect.width / 2 ? "prev" : "next");
          }}
        >
          <div className="page" ref={pageRef}></div>
        </div>
        <button className="arrow" onClick={() => navigate("next")}>›</button>
      </div>

      <p className="caption" ref={captionRef}></p>
    </div>
  );
}

export function Hotbar({ onOpenBook, bookOpen = false }) {
    const slots = useMemo(() => [
        {
            id: 'book',
            label: 'Book',
            icon: '📖',
            title: 'Open the sketchbook',
            enabled: true,
            active: bookOpen,
            onClick: onOpenBook,
        },
        {
            id: 'feed',
            label: 'Feed',
            icon: '🍎',
            title: 'Feed animals (coming soon)',
            enabled: false,
            active: false,
            onClick: null,
        },
        {
            id: 'camera',
            label: 'Camera',
            icon: '📷',
            title: 'Camera (coming soon)',
            enabled: false,
            active: false,
            onClick: null,
        },
    ], [onOpenBook, bookOpen]);

    return (
        <div className="pointer-events-none absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+0.6rem)] z-72 flex justify-center px-1 select-none">
            <div className="pointer-events-auto flex items-center gap-1.5 sm:gap-2 rounded-2xl border-2 border-white/40 bg-slate-950/55 p-1.5 sm:p-2 shadow-[0_8px_24px_rgba(0,0,0,0.35)] backdrop-blur-md" data-ui-hud="true">
                {slots.map((slot) => (
                    <button
                        key={slot.id}
                        type="button"
                        data-ui-button={slot.enabled ? 'true' : undefined}
                        onClick={slot.enabled ? slot.onClick : undefined}
                        disabled={!slot.enabled}
                        title={slot.title}
                        aria-label={slot.label}
                        aria-disabled={!slot.enabled}
                        className={cx('hotbar-slot', slot.active && 'is-active')}
                    >
                        <span className="hotbar-icon" aria-hidden="true">{slot.icon}</span>
                        <span className="hotbar-label">{slot.label}</span>
                    </button>
                ))}
            </div>
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