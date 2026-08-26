/* eslint-disable react-refresh/only-export-components */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import * as THREE from 'three';
import { resolveAssetUrl } from '../utils/localAssets.js';
import { ActionButton, GameButton, IconButton, ModalShell, SideSheet, SurfacePanel, cx } from './UIComponents.jsx';
import { createGLTFLoader } from '../utils/gltfLoader.js';
import { applyHumanSkinColor } from '../utils/characterMaterials.js';

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

function CreditsContent() {
    const modelCredits = [
        ['Rabbit', 'Tiko', 'https://sketchfab.com/3d-models/rabbit-caba07ca532947858ab66b65879cc105', 'CC-BY-4.0'],
        ['Realsitic Monkey', 'TdoubleU8', 'https://sketchfab.com/3d-models/realsitic-monkey-50e4b1da03494429b1265fc095f2c530', 'CC-BY-4.0'],
        ['Tiger', 'Blender Artist', 'https://sketchfab.com/3d-models/tiger-67bbedd727a047869ef7c7b608445484', 'CC-BY-4.0'],
        ['African ostrich (Revised version)', 'Андрей', 'https://sketchfab.com/3d-models/african-ostrich-revised-version-0999e676453e4562a7777cd006125738', 'CC-BY-4.0'],
        ['Birds', 'Zacxophone', 'https://sketchfab.com/3d-models/birds-3a9bb97be78944f9bffc23fb25c2154e', 'Sketchfab Standard'],
        ['Low Poly Bird (Animated)', 'Charlie Tinley', 'https://sketchfab.com/3d-models/low-poly-bird-animated-82ada91f0ac64ab595fbc3dc994a3590', 'CC-BY-4.0'],
    ];

    return (
        <div className="space-y-4 text-center text-sm text-slate-700">
            <p className="font-semibold italic">Character and environment assets provided by Quaternius.</p>
            <a
                href="https://quaternius.com/"
                target="_blank"
                rel="noreferrer"
                className="block rounded-2xl border-2 border-slate-100 bg-white p-4 font-black text-emerald-800 shadow-sm underline decoration-emerald-300 underline-offset-4 transition-colors hover:bg-emerald-50"
            >
                Quaternius<br />
                <span className="text-xs font-bold normal-case tracking-normal">https://quaternius.com/</span>
            </a>
            <div className="space-y-2 text-left">
                <h3 className="text-center text-xs font-black uppercase tracking-widest text-emerald-800">Animal Model Licenses</h3>
                <p className="text-center text-xs font-semibold text-slate-500">
                    CC-BY-4.0 models require author credit and allow commercial use. The Birds model is under the Sketchfab Standard license and is used under its basic restrictions.
                </p>
                {modelCredits.map(([title, author, source, license]) => (
                    <div key={source} className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                        <p className="font-black text-slate-800">{title}</p>
                        <p className="text-xs font-semibold">By {author} | {license}</p>
                        <a href={source} target="_blank" rel="noreferrer" className="break-all text-xs text-emerald-700 underline">{source}</a>
                    </div>
                ))}
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
        let disposed = false;
        let width = container.clientWidth || 300;
        let height = container.clientHeight || 400;

        const scene = new THREE.Scene();

        const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
        // Initial position, will be updated by fitCamera
        camera.position.set(0, 1.0, 5.0);

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.0;
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

        let modelGroup = null;

        const fitCamera = () => {
            if (!modelGroup) return;
            const box = new THREE.Box3().setFromObject(modelGroup);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());

            const fov = camera.fov * (Math.PI / 180);
            let distance = Math.abs(size.y / Math.tan(fov / 2));

            // Fit both the height and width, including portrait mobile screens.
            const aspect = Math.max(width / height, 0.1);
            const verticalDistance = (size.y * 0.5) / Math.tan(fov / 2);
            const horizontalFov = 2 * Math.atan(Math.tan(fov / 2) * aspect);
            const horizontalDistance = (Math.max(size.x, size.z) * 0.5) / Math.tan(horizontalFov / 2);
            distance = Math.max(verticalDistance, horizontalDistance);

            // Leave room for the model's idle pose and rotation. This keeps
            // hats, hands, and feet inside the frame on portrait screens too.
                    camera.position.set(0, center.y + size.y * 0.03, distance * 3.1);
                    camera.lookAt(center.x, center.y + size.y * 0.08, center.z);
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
                if (!url || disposed) return;
                const loader = createGLTFLoader();
                loader.load(url, (gltf) => {
                    if (disposed) {
                        gltf.scene.traverse((child) => {
                            if (!child.isMesh) return;
                            child.geometry?.dispose();
                            const materials = Array.isArray(child.material) ? child.material : [child.material];
                            materials.forEach((material) => material?.dispose());
                        });
                        return;
                    }
                    modelGroup = gltf.scene;

            applyHumanSkinColor(modelGroup);

            // Normalize model size and center its pivot for the preview camera.
            const box = new THREE.Box3().setFromObject(modelGroup);
                    const size = box.getSize(new THREE.Vector3());
                    const targetHeight = 1.65;
            const scale = targetHeight / Math.max(size.y, 0.001);
            modelGroup.scale.set(scale, scale, scale);
            const fittedBox = new THREE.Box3().setFromObject(modelGroup);
            const fittedCenter = fittedBox.getCenter(new THREE.Vector3());
            modelGroup.position.x -= fittedCenter.x;
            modelGroup.position.z -= fittedCenter.z;
            modelGroup.position.y -= fittedBox.min.y;

                    if (gltf.animations && gltf.animations.length > 0) {
                        mixer = new THREE.AnimationMixer(modelGroup);
                        const actions = {};
                        gltf.animations.forEach((clip) => {
                            actions[clip.name.toLowerCase()] = mixer.clipAction(clip);
                        });
                        const actionEntries = Object.entries(actions);
                        idleAction = actions.idle || actionEntries.find(([name]) => /idle|stand|breath/.test(name))?.[1] || actionEntries[0]?.[1] || null;
                        if (idleAction) {
                            idleAction.enabled = true;
                            idleAction.setEffectiveWeight(1);
                            idleAction.play();
                        }
                    }

                    // Fit after applying the idle pose so animated limbs do not clip the preview.
                    mixer?.update(0.1);
                    const posedBox = new THREE.Box3().setFromObject(modelGroup);
                    const posedCenter = posedBox.getCenter(new THREE.Vector3());
                    modelGroup.position.x -= posedCenter.x;
                    modelGroup.position.z -= posedCenter.z;
                    modelGroup.position.y -= posedBox.min.y;
                    scene.add(modelGroup);
                    fitCamera();

                    const clock = new THREE.Clock();
                    const animate = () => {
                        if (disposed) return;
                        if (modelGroup) modelGroup.rotation.y += 0.004;
                        if (mixer && clock) mixer.update(clock.getDelta());
                        renderer.render(scene, camera);
                        animationId = requestAnimationFrame(animate);
                    };
                    animate();
                }, undefined, () => { });
            })
            .catch(() => { });

        return () => {
            disposed = true;
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
            if (modelGroup) {
                modelGroup.traverse((child) => {
                    if (!child.isMesh) return;
                    child.geometry?.dispose();
                    const materials = Array.isArray(child.material) ? child.material : [child.material];
                    materials.forEach((material) => material?.dispose());
                });
            }
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
                                { label: '60', value: 60 },
                                { label: '120', value: 120 }
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
                {/* 3D Character Stage */}
                <div className="flex-1 min-h-0 w-full max-w-6xl relative flex items-center justify-center">

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

                    <div className="w-full h-full min-h-0 relative z-10 flex items-center justify-center overflow-hidden">
                        {previewChar && <Character3DPreview modelFile={previewChar.file} />}
                    </div>
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
    const [creditsOpen, setCreditsOpen] = useState(false);
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
        onStart();
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
                    <WoodenTitle titlePart1="Bulusan" titlePart2="Zootopia Adventure Game" />
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
                            onClick={() => setCreditsOpen(true)}
                            className="group relative w-12 h-12 sm:w-20 sm:h-20 transition-all active:scale-90"
                            title="Credits"
                        >
                            <img src="/ui-buttons/credit-button.png" alt="Credits" className="w-full h-full object-contain group-hover:scale-110 transition-transform" />
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

            <ModalShell isOpen={creditsOpen} onClose={() => setCreditsOpen(false)} title="Credits" size="md">
                <CreditsContent />
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

            <div className="pointer-events-none absolute inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.35rem)] z-40 flex justify-between text-[8px] font-black uppercase tracking-[0.18em] text-emerald-950/70 sm:inset-x-6 sm:bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:text-[10px]">
                <span>2026</span>
                <span>Version 5.3.0</span>
            </div>
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

export function GameHUD({ playerName, onMenuClick, onTasksClick, onBook, onCamera, completedTasks, totalTasks, isTouchDevice = false }) {
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

                <div className="pointer-events-auto fixed bottom-[calc(env(safe-area-inset-bottom)+0.55rem)] left-1/2 z-65 flex -translate-x-1/2 items-center gap-0.5 rounded-2xl border-2 border-amber-200 bg-[#fff8df]/95 p-0.5 shadow-lg backdrop-blur-sm sm:gap-1 sm:p-1" data-ui-hud="true" aria-label="Exploration tools">
                    <button type="button" onClick={onBook} className="group flex h-11 w-11 items-center justify-center rounded-xl hover:bg-amber-100 active:scale-95" aria-label="Open Animal Book" data-ui-button="true">
                        <img src="/ui-buttons/book-button.png" alt="" className="h-10 w-10 object-contain" />
                    </button>
                    <button type="button" onClick={onCamera} className="group flex h-11 w-11 items-center justify-center rounded-xl hover:bg-amber-100 active:scale-95" aria-label="Take a photo" data-ui-button="true">
                        <img src="/ui-buttons/camera-button.png" alt="" className="h-10 w-10 object-contain" />
                    </button>
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
                <div className="relative overflow-hidden rounded-3xl border-2 border-emerald-300 bg-linear-to-br from-emerald-950 via-emerald-800 to-teal-700 p-4 text-white shadow-[0_8px_0_0_#a7f3d0]">
                    <div className="pointer-events-none absolute -right-5 -top-7 text-6xl opacity-20">★</div>
                    <div className="relative flex items-center justify-between gap-2 mb-2">
                        <div>
                            <span className="block text-[10px] font-black uppercase tracking-widest text-emerald-300">Zoo Mission</span>
                            <span className="text-sm font-black">Feed every friend!</span>
                        </div>
                        <span className="rounded-full bg-lime-300 px-3 py-1 text-sm font-black text-emerald-950 shadow-sm">{completedCount} / {tasks.length}</span>
                    </div>
                    <div className="h-3 w-full overflow-hidden rounded-full border border-white/20 bg-emerald-950/50">
                        <div
                            className="h-full rounded-full bg-linear-to-r from-lime-300 to-amber-300 transition-all duration-500 ease-out shadow-[0_0_12px_rgba(253,224,71,0.65)]"
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                </div>

                <div className="space-y-3" data-ui-scrollable="true">
                    {tasks.map((task, index) => (
                        <button
                            key={task.id}
                            type="button"
                            data-ui-button="true"
                            onClick={() => onTaskClick?.(task)}
                            className={cx(
                                'group relative flex w-full items-center justify-between gap-3 overflow-hidden rounded-2xl border-2 px-3 py-3 text-left transition-all active:scale-[0.98] hover:-translate-y-0.5',
                                task.completed
                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800 shadow-[0_4px_0_0_#d1fae5]'
                                    : 'border-slate-100 bg-white text-slate-800 shadow-[0_4px_0_0_#f1f5f9] hover:border-amber-200 hover:bg-amber-50',
                            )}
                        >
                            <div className="flex min-w-0 items-center gap-3">
                                <div className={cx(
                                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl text-sm font-black shadow-inner",
                                    task.completed ? "bg-emerald-500 text-white" : "bg-amber-100 text-amber-700"
                                )}>
                                    {task.completed ? '✓' : index + 1}
                                </div>
                                <span className="truncate text-sm font-black tracking-tight sm:text-base">{task.name}</span>
                            </div>
                            <span className={cx(
                                "shrink-0 rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-widest",
                                task.completed ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                            )}>
                                {task.completed ? 'Done!' : 'Feed'}
                            </span>
                        </button>
                    ))}
                </div>
            </div>
        </SideSheet>
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
                <p className="text-xs font-black uppercase tracking-[0.12em] text-emerald-700">Animal fed successfully</p>
                <p className="text-sm font-bold text-emerald-900">{animalName || 'Animal'} is happy!</p>
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

export function RunButton({ isTouchDevice, onRunStart, onRunEnd }) {
    const detectedTouch = useIsTouchDevice();
    const isTouch = typeof isTouchDevice === 'boolean' ? isTouchDevice : detectedTouch;
    if (!isTouch) return null;

    return (
        <div className="pointer-events-none absolute bottom-[calc(env(safe-area-inset-bottom)+6.8rem)] right-2.5 z-70 sm:right-3">
            <button
                type="button"
                aria-label="Hold to run"
                onPointerDown={(event) => {
                    event.preventDefault();
                    event.currentTarget.setPointerCapture?.(event.pointerId);
                    onRunStart?.();
                }}
                onPointerUp={onRunEnd}
                onPointerCancel={onRunEnd}
                onPointerLeave={onRunEnd}
                className="pointer-events-auto inline-flex h-14 w-14 items-center justify-center rounded-full border border-white/45 bg-emerald-500/95 text-xs font-black uppercase tracking-[0.08em] text-white shadow-lg active:scale-95 sm:h-14 sm:w-14 touch-none select-none"
            >
                Run
            </button>
        </div>
    );
}

export function HoldToFeedControl({
    visible,
    animalName,
    progress = 0,
    isHolding = false,
    completed = false,
    disabled = false,
    message = '',
    onStart,
    onEnd,
}) {
    if (!visible) return null;

    const percentage = Math.round(Math.max(0, Math.min(1, progress)) * 100);
    const label = completed ? 'Fed!' : disabled ? 'Need food' : isHolding ? 'Feeding...' : 'Hold to Feed';

    return (
        <div className="pointer-events-none absolute bottom-[calc(env(safe-area-inset-bottom)+13.8rem)] right-2.5 z-70 flex w-28 flex-col items-center sm:right-3 sm:bottom-52">
            <button
                type="button"
                aria-label={`${label}${animalName ? ` ${animalName}` : ''}`}
                disabled={disabled || completed}
                onPointerDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    event.currentTarget.setPointerCapture?.(event.pointerId);
                    onStart?.();
                }}
                onPointerUp={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onEnd?.();
                }}
                onPointerCancel={onEnd}
                className={cx(
                    'pointer-events-auto relative grid h-24 w-24 place-items-center rounded-full border-4 border-white/70 shadow-xl touch-none select-none transition-transform active:scale-95 sm:h-28 sm:w-28',
                    completed ? 'bg-emerald-500' : disabled ? 'bg-slate-400' : 'bg-emerald-950/80',
                )}
            >
                <span
                    className="absolute inset-[-4px] rounded-full"
                    style={{ background: `conic-gradient(${completed ? '#22c55e' : '#facc15'} ${percentage}%, rgba(255,255,255,.25) ${percentage}% 100%)`, zIndex: 0 }}
                    aria-hidden="true"
                />
                <span className="absolute inset-[5px] rounded-full bg-emerald-950/90" aria-hidden="true" />
                {completed ? <span className="relative z-10 text-4xl font-black text-white">✓</span> : <img className="relative z-10 h-12 w-12 sm:h-14 sm:w-14" src="/ui-buttons/feed-button.png" alt="" />}
            </button>
            <span className="mt-1 rounded-full bg-emerald-950/85 px-2 py-1 text-center text-[9px] font-black uppercase tracking-wide text-white shadow-lg">{label}</span>
            {message ? <span className="mt-1 max-w-28 text-center text-[10px] font-black leading-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,.9)]">{message}</span> : null}
        </div>
    );
}

export function AnimalCaution({ visible }) {
    if (!visible) return null;

    return (
        <div className="pointer-events-none absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+13.8rem)] z-70 flex justify-center px-3 sm:bottom-52">
            <div className="rounded-2xl border-2 border-red-200 bg-red-950/90 px-4 py-2 text-center text-white shadow-xl">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-amber-300">Caution: Dangerous Animal</p>
                <p className="mt-1 text-[11px] font-bold">Please avoid contact with the tiger. Do not feed it.</p>
            </div>
        </div>
    );
}

const ANIMAL_BOOK_ENTRIES = [
    { name: 'White-tailed Deer', scientific: 'Odocoileus virginianus', file: 'Deer.gltf', habitat: 'Forest edges', diet: 'Leaves, grass, and berries', behavior: 'Alert and gentle', status: 'Least Concern', fact: 'Its white tail warns the herd of danger.', description: 'A graceful forest friend that helps keep plants growing in balance.' },
    { name: 'Domestic Horse', scientific: 'Equus caballus', file: 'Horse.gltf', habitat: 'Open grassland', diet: 'Grass, hay, and grains', behavior: 'Social and curious', status: 'Domesticated', fact: 'Horses can sleep standing up.', description: 'A strong, kind companion that loves wide spaces and caring people.' },
    { name: 'Ostrich', scientific: 'Struthio camelus', file: 'ostrich/scene.gltf', habitat: 'Dry grassland', diet: 'Plants and small insects', behavior: 'Fast runner', status: 'Least Concern', fact: 'It is the world’s largest living bird.', description: 'A tall bird with powerful legs and a very speedy run.' },
    { name: 'Donkey', scientific: 'Equus asinus', file: 'Donkey.gltf', habitat: 'Grassland and farms', diet: 'Grass and hay', behavior: 'Patient and hardworking', status: 'Domesticated', fact: 'Long ears help donkeys stay cool.', description: 'A sure-footed helper with a calm and friendly nature.' },
    { name: 'Domestic Cow', scientific: 'Bos taurus', file: 'Cow.gltf', habitat: 'Pastures and farms', diet: 'Grass and hay', behavior: 'Gentle herd animal', status: 'Domesticated', fact: 'Cows have excellent memories.', description: 'A peaceful grazer that enjoys living with its herd.' },
    { name: 'Alpaca', scientific: 'Vicugna pacos', file: 'Alpaca.gltf', habitat: 'Mountain grasslands', diet: 'Grass and plants', behavior: 'Quiet and social', status: 'Domesticated', fact: 'Its fleece is soft and warm.', description: 'A fluffy animal from the Andes with a gentle personality.' },
    { name: 'Red Deer Stag', scientific: 'Cervus elaphus', file: 'Stag.gltf', habitat: 'Woodlands', diet: 'Plants and grasses', behavior: 'Protective and alert', status: 'Least Concern', fact: 'A stag grows a new set of antlers each year.', description: 'A majestic deer whose antlers show how healthy it is.' },
    { name: 'Bull', scientific: 'Bos taurus', file: 'Bull.gltf', habitat: 'Grassland and farms', diet: 'Grass and hay', behavior: 'Strong and watchful', status: 'Domesticated', fact: 'Bulls can recognize familiar faces.', description: 'A powerful bovine that deserves space, patience, and care.' },
    { name: 'Forest Monkey', scientific: 'Macaca fascicularis', file: 'monkey/scene.gltf', habitat: 'Tropical forest', diet: 'Fruit, seeds, and insects', behavior: 'Playful and clever', status: 'Least Concern', fact: 'Monkeys use many different calls to communicate.', description: 'A clever climber that helps spread seeds through the forest.' },
    { name: 'Rabbit', scientific: 'Oryctolagus cuniculus', file: 'rabbit/scene.gltf', habitat: 'Meadows and woodland edges', diet: 'Grass, herbs, and vegetables', behavior: 'Quiet and quick', status: 'Least Concern', fact: 'A rabbit’s teeth keep growing throughout its life.', description: 'A small, speedy friend with a twitching nose and soft fur.' },
    { name: 'Bengal Tiger', scientific: 'Panthera tigris tigris', file: 'tiger/scene.gltf', habitat: 'Forests and grasslands', diet: 'Meat', behavior: 'Solitary and stealthy', status: 'Endangered', fact: 'Every tiger has a unique stripe pattern.', description: 'A magnificent big cat that needs protected forests to survive.' },
];

export function AnimalBookModal({ isOpen, onClose, discoveredAnimals = [], fedAnimals = {} }) {
    const [page, setPage] = useState(0);
    const [turning, setTurning] = useState(false);
    const modelHostRef = useRef(null);
    const modelResourcesRef = useRef(null);
    const turnTimerRef = useRef(null);
    const moveRef = useRef(null);
    const pageCount = ANIMAL_BOOK_ENTRIES.length + 2;
    const entry = page > 1 ? ANIMAL_BOOK_ENTRIES[page - 2] : null;
    const unlocked = entry ? discoveredAnimals.includes(entry.name) : true;

    const move = useCallback((delta) => {
        if (turning) return;
        const next = Math.max(0, Math.min(pageCount - 1, page + delta));
        if (next === page) return;
        setTurning(true);
        playGameButtonSfx('page-turn');
        turnTimerRef.current = window.setTimeout(() => { setPage(next); setTurning(false); turnTimerRef.current = null; }, 420);
    }, [page, pageCount, turning]);
    useEffect(() => {
        moveRef.current = move;
    }, [move]);

    useEffect(() => {
        if (!isOpen || !entry || !unlocked || !modelHostRef.current) return undefined;
        const host = modelHostRef.current;
        const width = Math.max(160, host.clientWidth);
        const height = Math.max(130, host.clientHeight);
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 100);
        camera.position.set(0, 0.8, 4.2);
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
        renderer.setSize(width, height);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        host.replaceChildren(renderer.domElement);
        scene.add(new THREE.HemisphereLight(0xfff3d0, 0x355c4b, 2.2));
        const key = new THREE.DirectionalLight(0xffffff, 2.5);
        key.position.set(3, 4, 5);
        scene.add(key);
        let mounted = true;
        let animationFrame;
        const loader = createGLTFLoader();
        loader.load(`/models/animals/${entry.file}`, (gltf) => {
            if (!mounted) return;
            const model = gltf.scene;
            model.scale.setScalar(entry.file.includes('scene.gltf') ? 1.1 : 1);
            model.position.y = -1;
            scene.add(model);
            modelResourcesRef.current = { model, gltf };
        }, undefined, () => {});
        const animate = () => {
            if (!mounted) return;
            animationFrame = requestAnimationFrame(animate);
            const model = modelResourcesRef.current?.model;
            if (model && model.parent === scene) model.rotation.y += 0.006;
            renderer.render(scene, camera);
        };
        animate();
        return () => {
            mounted = false;
            cancelAnimationFrame(animationFrame);
            const resources = modelResourcesRef.current;
            resources?.model?.traverse((child) => {
                if (!child.isMesh) return;
                child.geometry?.dispose();
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                materials.forEach((material) => { material?.map?.dispose?.(); material?.dispose?.(); });
            });
            modelResourcesRef.current = null;
            scene.clear();
            renderer.dispose();
            renderer.forceContextLoss?.();
            renderer.domElement.remove();
        };
    }, [isOpen, entry, unlocked]);

    useEffect(() => {
        if (!isOpen) return undefined;
        const onKeyDown = (event) => {
            if (event.key === 'ArrowLeft') moveRef.current?.(-1);
            if (event.key === 'ArrowRight') moveRef.current?.(1);
        };
        const onTouchStart = (event) => { modelHostRef.current._bookTouchX = event.touches[0].clientX; };
        const onTouchEnd = (event) => {
            const start = modelHostRef.current?._bookTouchX;
            const end = event.changedTouches[0].clientX;
            if (Number.isFinite(start) && Math.abs(end - start) > 35) moveRef.current?.(end < start ? 1 : -1);
        };
        window.addEventListener('keydown', onKeyDown);
        const host = modelHostRef.current;
        host?.addEventListener('touchstart', onTouchStart, { passive: true });
        host?.addEventListener('touchend', onTouchEnd, { passive: true });
        return () => { window.removeEventListener('keydown', onKeyDown); host?.removeEventListener('touchstart', onTouchStart); host?.removeEventListener('touchend', onTouchEnd); if (turnTimerRef.current) window.clearTimeout(turnTimerRef.current); };
    }, [isOpen]);

    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-120 flex items-center justify-center bg-emerald-950/55 p-2 pt-[calc(env(safe-area-inset-top)+0.5rem)] pb-[calc(env(safe-area-inset-bottom)+0.5rem)]" data-ui-modal="true">
            <div className="relative flex h-[min(92dvh,38rem)] w-full max-w-5xl flex-col rounded-3xl border-8 border-[#653b1d] bg-[#8a542b] p-2 shadow-2xl sm:p-4">
                <button type="button" onClick={onClose} aria-label="Close Animal Book" className="absolute right-2 top-2 z-10 h-11 w-11 rounded-full bg-white text-2xl font-black text-slate-900 shadow-lg">&times;</button>
                <div className="mb-2 flex items-center justify-between px-2 text-white sm:px-4"><h2 className="text-lg font-black uppercase tracking-wider sm:text-2xl">Animal Book</h2><span className="text-xs font-black">{page + 1} / {pageCount}</span></div>
                <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl bg-[#f8e8bb] p-2 shadow-inner sm:p-5">
                    <div className="grid h-full min-h-0 grid-cols-2 gap-1 rounded-lg border-4 border-[#c89a58] bg-[#fff8df] p-2 shadow-[inset_0_0_18px_rgba(93,54,20,.22)] sm:gap-3 sm:p-5">
                        <div className="flex min-h-0 flex-col border-r-2 border-[#d2b477] pr-2 sm:pr-4">
                            {entry ? <><p className="text-[10px] font-black uppercase tracking-widest text-amber-700">Explorer notes</p><h3 className="mt-1 text-base font-black text-emerald-900 sm:text-2xl">{unlocked ? entry.name : '???'}</h3><p className="text-[10px] font-bold italic text-slate-500 sm:text-xs">{unlocked ? entry.scientific : 'Unknown species'}</p><div ref={modelHostRef} className="my-2 min-h-25 flex-1 rounded-xl bg-emerald-100/60 sm:min-h-40">{!unlocked ? <div className="grid h-full place-items-center text-7xl opacity-25 grayscale">{entry.name === 'Rabbit' ? '🐇' : '🐾'}</div> : null}</div>{unlocked ? <p className="text-[11px] font-semibold leading-snug text-slate-700 sm:text-sm">{entry.description}</p> : <p className="text-center text-xs font-black text-slate-600">Discover this animal to unlock</p>}</> : <div className="flex h-full flex-col justify-center text-center"><p className="text-4xl">{page === 0 ? '🌋' : '🏅'}</p><h3 className="mt-2 text-xl font-black text-emerald-900">{page === 0 ? 'Bulusan Zoo' : 'Zoo Ranger Achievement'}</h3><p className="mt-3 text-xs font-semibold leading-relaxed text-slate-700 sm:text-sm">{page === 0 ? 'A place to explore, care for animals, and protect the living world around Bulusan.' : 'Every discovery and every gentle feeding makes you a better Zoo Ranger.'}</p></div>}
                        </div>
                        <div className="min-h-0 overflow-y-auto pl-2 sm:pl-4">{entry && unlocked ? <div className="space-y-2 text-[10px] text-slate-700 sm:space-y-3 sm:text-sm"><p><b>Habitat:</b> {entry.habitat}</p><p><b>Diet:</b> {entry.diet}</p><p><b>Behavior:</b> {entry.behavior}</p><p><b>Conservation:</b> {entry.status}</p><p><b>Fun fact:</b> {entry.fact}</p><div className="rounded-xl bg-emerald-100 p-2 font-black text-emerald-900">{fedAnimals[entry.name] ? 'Fed successfully' : 'Not fed yet'}</div></div> : <p className="text-xs font-semibold leading-relaxed text-slate-600">Turn the page to meet another Bulusan animal.</p>}</div>
                    </div>
                </div>
                <div className="mt-2 flex justify-between gap-2"><ActionButton size="sm" variant="secondary" disabled={turning || page === 0} onClick={() => move(-1)}>Previous</ActionButton><ActionButton size="sm" variant="primary" disabled={turning || page === pageCount - 1} onClick={() => move(1)}>Next</ActionButton></div>
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
