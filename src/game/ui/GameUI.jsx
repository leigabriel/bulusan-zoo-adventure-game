/* eslint-disable react-refresh/only-export-components */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import * as THREE from 'three';
import { resolveAssetUrl } from '../utils/localAssets.js';
import { ActionButton, GameButton, IconButton, ModalShell, PaginationControls, SurfacePanel, cx, useModalTransition } from './UIComponents.jsx';
import { createGLTFLoader } from '../utils/gltfLoader.js';
import { applyHumanSkinColor } from '../utils/characterMaterials.js';
import { ANIMAL_METADATA } from '../data/animalMetadata.js';
import { getPlayerProfile, isPlayerProfileComplete, PLAYER_GENDERS, savePlayerProfile } from '../utils/playerProfile.js';

const SETTINGS_KEY = 'minizoo_settings';
const SETTINGS_CHANGE_EVENT = 'minizoo-settings-changed';

const SFX_FILES = {
    tap: '/audio/click.mp3',
    feed: '/audio/feed.wav',
    confirm: '/audio/click.mp3',
    'task-complete': '/audio/finish-task.mp3',
    'page-turn': '/audio/book-page-turning.mp3',
    'task-list': '/audio/task-list-button.mp3',
};

const uiAudioTemplates = {};

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
            <div className="flex flex-wrap gap-2" role="radiogroup">
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
                                'min-w-24 flex-1 rounded-xl px-2 py-2 text-xs font-black uppercase tracking-wider transition-all',
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
    const [page, setPage] = useState(0);
    const usesTouchControls = Capacitor.isNativePlatform() || /android/i.test(navigator.userAgent || '');
    const pages = usesTouchControls
        ? [
            { label: 'Move', color: 'text-emerald-600', icon: '🕹️', iconClass: 'bg-emerald-100', text: 'Drag the joystick on the lower left. Your explorer runs automatically in the direction you move.' },
            { label: 'Look & Jump', color: 'text-amber-600', icon: '👆', iconClass: 'bg-amber-100', text: 'Swipe an open area to look around. Tap Jump on the lower right to clear obstacles.' },
            { label: 'Care & Explore', color: 'text-sky-600', icon: '🍎', iconClass: 'bg-sky-100', text: 'Approach an animal, then hold Feed. Use the book and camera buttons at the bottom of the screen.' },
            { label: 'Ranger & Goal', color: 'text-emerald-700', icon: '🏅', iconClass: 'bg-lime-100', text: 'Tap Talk near Ranger Lino. Feed every safe animal to earn your completion certificate.' },
        ]
        : [
            { label: 'Move & Look', color: 'text-emerald-600', icon: 'WASD', iconClass: 'bg-emerald-100 text-xs', text: 'Use W, A, S, and D to move. Hold the left mouse button and drag to look around. Your explorer runs automatically.' },
            { label: 'Jump & View', color: 'text-amber-600', icon: 'SPACE', iconClass: 'bg-amber-100 text-[9px]', text: 'Press Space to jump. Press V to switch between first-person and third-person views.' },
            { label: 'Interact', color: 'text-sky-600', icon: 'F / T', iconClass: 'bg-sky-100 text-xs', text: 'Hold F near an animal to feed it. Press T or E near Ranger Lino to talk.' },
            { label: 'Menus & Goal', color: 'text-emerald-700', icon: 'ESC', iconClass: 'bg-lime-100 text-xs', text: 'Press Escape to close open panels. Feed every safe animal to earn your completion certificate.' },
        ];
    const current = pages[page];

    return (
        <div className="flex min-h-64 flex-col gap-4 text-sm text-slate-700">
            <p className="font-semibold text-center italic">{usesTouchControls ? 'Android touch controls' : 'Desktop keyboard and mouse controls'}</p>
            <div className="flex flex-1 items-center rounded-2xl border-2 border-slate-100 bg-white p-4 shadow-sm sm:p-6">
                <div className="flex items-center gap-4">
                    <div className={cx('flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-2xl', current.iconClass)}>{current.icon}</div>
                    <div>
                        <p className={cx('mb-2 text-[10px] font-black uppercase tracking-[0.15em]', current.color)}>{current.label}</p>
                        <p className="font-bold leading-relaxed text-slate-800">{current.text}</p>
                    </div>
                </div>
            </div>
            <PaginationControls page={page} pageCount={pages.length} onPageChange={setPage} />
        </div>
    );
}

function CreditsContent() {
    const [page, setPage] = useState(0);
    const modelCredits = [
        ['Rabbit', 'Tiko', 'https://sketchfab.com/3d-models/rabbit-caba07ca532947858ab66b65879cc105', 'CC-BY-4.0'],
        ['Realsitic Monkey', 'TdoubleU8', 'https://sketchfab.com/3d-models/realsitic-monkey-50e4b1da03494429b1265fc095f2c530', 'CC-BY-4.0'],
        ['Tiger', 'Blender Artist', 'https://sketchfab.com/3d-models/tiger-67bbedd727a047869ef7c7b608445484', 'CC-BY-4.0'],
        ['African ostrich (Revised version)', 'Андрей', 'https://sketchfab.com/3d-models/african-ostrich-revised-version-0999e676453e4562a7777cd006125738', 'CC-BY-4.0'],
        ['Birds', 'Zacxophone', 'https://sketchfab.com/3d-models/birds-3a9bb97be78944f9bffc23fb25c2154e', 'Sketchfab Standard'],
        ['Low Poly Bird (Animated)', 'Charlie Tinley', 'https://sketchfab.com/3d-models/low-poly-bird-animated-82ada91f0ac64ab595fbc3dc994a3590', 'CC-BY-4.0'],
    ];
    const pageCount = 1 + Math.ceil(modelCredits.length / 2);
    const visibleCredits = page === 0 ? [] : modelCredits.slice((page - 1) * 2, (page - 1) * 2 + 2);

    return (
        <div className="flex min-h-72 flex-col gap-3 text-center text-sm text-slate-700">
            <div className="flex-1 space-y-2 text-left">
                {page === 0 ? (
                    <div className="grid h-full content-center gap-4 text-center">
                        <p className="font-semibold italic">Character and environment assets provided by Quaternius.</p>
                        <a href="https://quaternius.com/" target="_blank" rel="noreferrer" className="mx-auto inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-500 px-6 text-sm font-black uppercase tracking-wider text-white shadow-[0_4px_0_0_#065f46] transition-all active:translate-y-1 active:shadow-none">
                            Quaternius Link
                        </a>
                        <p className="text-xs font-semibold text-slate-500">Additional animal model licenses are listed on the following pages.</p>
                    </div>
                ) : (
                    <><h3 className="text-center text-xs font-black uppercase tracking-widest text-emerald-800">Animal Model Licenses</h3><p className="text-center text-xs font-semibold text-slate-500">CC-BY-4.0 models require author credit. The Birds model uses the Sketchfab Standard license.</p></>
                )}
                {visibleCredits.map(([title, author, source, license]) => (
                    <div key={source} className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                        <p className="font-black text-slate-800">{title}</p>
                        <p className="text-xs font-semibold">By {author} | {license}</p>
                        <a href={source} target="_blank" rel="noreferrer" className="mt-2 inline-flex min-h-9 items-center justify-center rounded-lg bg-emerald-500 px-4 text-[10px] font-black uppercase tracking-wider text-white shadow-[0_3px_0_0_#065f46] transition-all active:translate-y-0.5 active:shadow-none">Link</a>
                    </div>
                ))}
            </div>
            <PaginationControls page={page} pageCount={pageCount} onPageChange={setPage} />
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
        audio.volume = (kind === 'feed' || kind === 'task-complete' || kind === 'confirm' || kind === 'task-list') ? volume : volume * 0.85;
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
            const fov = camera.fov * (Math.PI / 180);
            const aspect = Math.max(width / height, 0.1);
            const targetHeight = 1.65;
            const baseDistance = (targetHeight * 0.68) / Math.tan(fov / 2);
            const narrowScreenAdjustment = aspect < 0.7 ? 0.7 / aspect : 1;
            camera.position.set(0, targetHeight * 0.52, baseDistance * narrowScreenAdjustment);
            camera.lookAt(0, targetHeight * 0.5, 0);
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

                    // Every preview uses the same world-space height and camera framing.
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

                    mixer?.update(0.1);
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

function SettingsModal({ isOpen, onClose, onQuit, cameraMode, onCameraModeChange, inGame = false }) {
    const [settings, setSettings] = useState(() => readSettings());
    const [activeSection, setActiveSection] = useState(null);

    const handleVolumeChange = (key, val) => {
        const next = { ...settings, [key]: val };
        setSettings(next);
        persistSettings(next);
    };

    const updateSetting = (key, value) => {
        const next = { ...settings, [key]: value };
        setSettings(next);
        persistSettings(next);
    };

    const sectionTitles = {
        graphics: 'Graphics',
        audio: 'Audio',
        sensitivity: 'Sensitivity',
        perspective: 'View Perspective',
    };

    if (activeSection) {
        return (
            <ModalShell isOpen={isOpen && Boolean(activeSection)} onClose={() => setActiveSection(null)} title={sectionTitles[activeSection]} size="md">
                <div className="flex min-h-52 flex-col gap-4">
                    <ActionButton variant="secondary" size="sm" className="self-start" onClick={() => setActiveSection(null)}>
                        <span aria-hidden="true">&lsaquo;</span> Settings
                    </ActionButton>

                    {activeSection === 'graphics' ? (
                        <div className="grid flex-1 content-center gap-4 sm:grid-cols-2">
                            <SelectRow
                                label="Graphics Quality"
                                options={[
                                    { label: 'Low', value: 'low' },
                                    { label: 'Medium', value: 'medium' },
                                    { label: 'High', value: 'high' },
                                ]}
                                value={settings.graphicsQuality || 'medium'}
                                onChange={(value) => updateSetting('graphicsQuality', value)}
                            />
                            <SelectRow
                                label="FPS Limit"
                                options={[
                                    { label: '30', value: 30 },
                                    { label: '60', value: 60 },
                                    { label: '120', value: 120 },
                                ]}
                                value={settings.fpsLimit ?? 60}
                                onChange={(value) => updateSetting('fpsLimit', value)}
                            />
                        </div>
                    ) : null}

                    {activeSection === 'audio' ? (
                        <div className="grid flex-1 content-center gap-3 sm:grid-cols-2">
                            <VolumeSliderRow label="Music" description="Background" value={settings.musicVolume ?? 0.5} onChange={(value) => handleVolumeChange('musicVolume', value)} />
                            <VolumeSliderRow label="Ambience" description="Nature" value={settings.ambienceVolume ?? 1} onChange={(value) => handleVolumeChange('ambienceVolume', value)} />
                            <VolumeSliderRow label="SFX" description="Animals" value={settings.sfxVolume ?? 1} onChange={(value) => handleVolumeChange('sfxVolume', value)} />
                            <VolumeSliderRow label="UI" description="Buttons" value={settings.uiVolume ?? 1} onChange={(value) => handleVolumeChange('uiVolume', value)} />
                        </div>
                    ) : null}

                    {activeSection === 'sensitivity' ? (
                        <div className="grid flex-1 content-center">
                            <SelectRow
                                label="Look Sensitivity"
                                options={[
                                    { label: 'Slow', value: 0.5 },
                                    { label: 'Normal', value: 1 },
                                    { label: 'Fast', value: 1.8 },
                                ]}
                                value={settings.sensitivity ?? 1}
                                onChange={(value) => updateSetting('sensitivity', value)}
                            />
                        </div>
                    ) : null}

                    {activeSection === 'perspective' ? (
                        <div className="grid flex-1 content-center">
                            <SelectRow
                                label="Camera View"
                                options={[
                                    { label: 'First Person', value: 'first' },
                                    { label: 'Third Person', value: 'third' },
                                ]}
                                value={cameraMode || settings.cameraMode || 'third'}
                                onChange={(value) => {
                                    updateSetting('cameraMode', value);
                                    onCameraModeChange?.(value);
                                }}
                            />
                        </div>
                    ) : null}
                </div>
            </ModalShell>
        );
    }

    const categories = [
        ...(inGame ? [{ id: 'resume', label: 'Resume', className: 'bg-emerald-500 text-white shadow-[0_5px_0_0_#065f46]' }] : []),
        { id: 'graphics', label: 'Graphics', className: 'bg-sky-500 text-white shadow-[0_5px_0_0_#075985]' },
        { id: 'audio', label: 'Audio', className: 'bg-violet-500 text-white shadow-[0_5px_0_0_#5b21b6]' },
        { id: 'sensitivity', label: 'Sensitivity', className: 'bg-amber-400 text-amber-950 shadow-[0_5px_0_0_#92400e]' },
        { id: 'perspective', label: 'View Perspective', className: 'bg-teal-500 text-white shadow-[0_5px_0_0_#115e59]' },
        ...(inGame && onQuit ? [{ id: 'quit', label: 'Quit Game', className: 'bg-rose-500 text-white shadow-[0_5px_0_0_#9f1239]' }] : []),
    ];

    return (
        <ModalShell isOpen={isOpen && !activeSection} onClose={onClose} title="Game Settings" size="md">
            <div className="space-y-4">
                <div className="flex flex-col gap-3.5 w-full">
                    {categories.map((category) => (
                        <button
                            key={category.id}
                            type="button"
                            onClick={() => {
                                if (category.id === 'resume') onClose();
                                else if (category.id === 'quit') onQuit?.();
                                else setActiveSection(category.id);
                            }}
                            className={cx(
                                'flex w-full min-h-13 items-center justify-center rounded-2xl px-5 py-3 text-center font-black uppercase tracking-wider text-sm sm:text-base transition-all active:translate-y-1 active:shadow-none',
                                category.className
                            )}
                        >
                            <span>{category.label}</span>
                        </button>
                    ))}
                </div>
            </div>
        </ModalShell>
    );
}

export function PlayerDetailsModal({ isOpen, onClose, onSave, required = false }) {
    const storedProfile = getPlayerProfile();
    const [name, setName] = useState(storedProfile.name);
    const [gender, setGender] = useState(storedProfile.gender);
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const submit = () => {
        const profile = savePlayerProfile({ name, gender });
        if (!profile) {
            setError('Enter your IGN and choose a gender.');
            return;
        }
        playGameButtonSfx('confirm');
        onSave?.(profile);
        onClose?.();
    };

    return (
        <ModalShell isOpen={true} onClose={onClose} closeOnBackdrop={!required} showClose={!required} title={storedProfile.name ? 'Player Details' : 'Welcome, Explorer!'} size="md">
            <div className="space-y-4">
                <div>
                    <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700" htmlFor="player-ign">In-game Name</label>
                    <input id="player-ign" type="text" maxLength={24} value={name} onChange={(event) => { setName(event.target.value); setError(''); }} className="block w-full rounded-xl border-2 border-emerald-100 bg-emerald-50 px-4 py-3 text-base font-black text-slate-800 outline-none focus:border-emerald-400 focus:bg-white" placeholder="Enter your IGN" autoFocus />
                </div>
                <fieldset>
                    <legend className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">Gender</legend>
                    <div className="flex flex-col gap-3 w-full">
                        {PLAYER_GENDERS.map((option) => (
                            <button
                                key={option.id}
                                type="button"
                                aria-pressed={gender === option.id}
                                onClick={() => { setGender(option.id); setError(''); }}
                                className={cx(
                                    'flex w-full min-h-12 items-center justify-center rounded-2xl px-4 py-3 text-sm font-black uppercase tracking-wider transition-all active:translate-y-1 active:shadow-none',
                                    option.id === 'boy' ? 'bg-sky-500 text-white shadow-[0_5px_0_0_#075985]' : 'bg-rose-400 text-white shadow-[0_5px_0_0_#9f1239]',
                                    gender === option.id && 'ring-4 ring-emerald-950/80 ring-offset-2'
                                )}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                </fieldset>
                {error ? <p className="text-center text-xs font-black text-rose-600" role="alert">{error}</p> : null}
                <ActionButton className="w-full" size="lg" onClick={submit}>Save Player</ActionButton>
            </div>
        </ModalShell>
    );
}

// REDESIGNED MAIN MENU - REAL 3D BUTTONS & AESTHETIC BUSHES

export function MainMenu({ onStart, onMenuInteraction, onProfileSaved, isVisible }) {
 const [starting, setStarting] = useState(false);
 const [howToPlayOpen, setHowToPlayOpen] = useState(false);
    const [creditsOpen, setCreditsOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [playerDetailsOpen, setPlayerDetailsOpen] = useState(false);
    const [profileRequired, setProfileRequired] = useState(false);
    const startAfterProfileRef = useRef(false);
    const [showExitConfirm, setShowExitConfirm] = useState(false);

    useEffect(() => {
        let listenerHandle = null;
        const setupBack = async () => {
            try {
                listenerHandle = await CapacitorApp.addListener('backButton', () => {
                    if (showExitConfirm) {
                        setShowExitConfirm(false);
                        return;
                    }
                    if (howToPlayOpen) {
                        setHowToPlayOpen(false);
                        return;
                    }
                    if (creditsOpen) {
                        setCreditsOpen(false);
                        return;
                    }
                    if (settingsOpen) {
                        setSettingsOpen(false);
                        return;
                    }
                    if (playerDetailsOpen) {
                        setPlayerDetailsOpen(false);
                        return;
                    }
                    setShowExitConfirm(true);
                });
            } catch {
            }
        };
        setupBack();
        return () => {
            if (listenerHandle) {
                listenerHandle.remove();
            }
        };
    }, [showExitConfirm, howToPlayOpen, creditsOpen, settingsOpen, playerDetailsOpen]);

    const handleStart = useCallback(() => {
        if (!isPlayerProfileComplete()) {
            startAfterProfileRef.current = true;
            setProfileRequired(true);
            setPlayerDetailsOpen(true);
            return;
        }
        playGameButtonSfx('confirm');
        setStarting(true);
        onStart();
    }, [onStart]);

    const handleProfileSaved = useCallback((profile) => {
        onProfileSaved?.(profile);
        if (startAfterProfileRef.current) {
            startAfterProfileRef.current = false;
            setStarting(true);
            onStart();
        }
    }, [onProfileSaved, onStart]);

    if (!isVisible) return null;

    return (
        <div
            onPointerDownCapture={onMenuInteraction}
            className={cx(
                "fixed inset-0 z-40 flex flex-col items-center justify-between overflow-hidden font-['Qilka',sans-serif] select-none touch-none bg-emerald-900 transition-all duration-400 ease-in-out py-3 sm:py-6 px-4",
                starting ? "opacity-0 scale-105 pointer-events-none" : "opacity-100 scale-100"
            )}
        >
            {/* Background Hills and Sky */}
            <div className="absolute -inset-x-20 inset-y-0 z-0 bg-gradient-to-b from-[#70e0ff] via-[#a2d2ff] to-[#c6fe69] pointer-events-none" aria-hidden="true">
                <div className="absolute -top-[15%] left-1/2 -translate-x-1/2 w-[120vw] h-[60vh] rounded-full bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.4)_0%,rgba(255,255,255,0)_70%)] animate-pulse" />

                {/* Floating Clouds */}
                <div className="absolute top-[5%] left-[6%] w-20 sm:w-36 h-6 sm:h-10 bg-white/70 rounded-full blur-[0.5px] animate-[kids-float_6s_ease-in-out_infinite]" />
                <div className="absolute top-[9%] right-[8%] w-28 sm:w-48 h-8 sm:h-12 bg-white/60 rounded-full blur-[0.5px] animate-[kids-float_8s_ease-in-out_infinite_1s]" />

                {/* Rolling Green Hills */}
                <div className="absolute bottom-0 w-full h-[42%] bg-[#c6fe69] rounded-t-[100%] scale-[1.7] translate-y-1/3 shadow-[0_-12px_24px_rgba(0,0,0,0.05)]" />
                <div className="absolute bottom-0 w-full h-[27%] bg-[#70e000] rounded-t-[100%] scale-[1.4] translate-y-1/4 shadow-[0_-10px_20px_rgba(0,0,0,0.05)]" />
                <div className="absolute bottom-0 w-full h-[14%] bg-[#38b000] rounded-t-[100%] scale-[1.2] translate-y-1/4 shadow-[0_-8px_16px_rgba(0,0,0,0.05)]" />
            </div>

            {/* Main Interface Content Container */}
            <div className="relative z-30 flex h-full w-full max-w-xl flex-col items-center justify-center pointer-events-auto safe-area-inset py-1 sm:py-2">

                {/* 1. TOP TITLE BANNER */}
                <div className="w-full flex justify-center pt-0 shrink-0 transform scale-[0.65] sm:scale-85 md:scale-100 origin-top">
                    <WoodenTitle titlePart1="Bulusan" titlePart2="Zootopia Adventure Game" />
                </div>

                {/* 2. CENTER STACKED PRIMARY ACTION BUTTONS */}
                <div className="w-full max-w-xs sm:max-w-sm flex flex-col items-center gap-1.5 sm:gap-3 my-auto py-0.5">

                    {/* PLAY GAME */}
                    <button
                        type="button"
                        onClick={handleStart}
                        disabled={starting}
                        className="group flex items-center justify-center gap-2.5 sm:gap-3.5 px-4 py-1.5 sm:py-2 transition-transform hover:scale-105 active:scale-95 cursor-pointer disabled:opacity-50"
                    >
                        <img src="/ui-buttons/play-button.png" alt="Play" className="h-8 w-8 sm:h-11 sm:w-11 object-contain drop-shadow-md group-hover:scale-110 transition-transform" />
                        <span className="text-lg sm:text-2xl font-black uppercase tracking-widest text-slate-800 drop-shadow-[0_2px_4px_rgba(255,255,255,0.9)]">
                            PLAY GAME
                        </span>
                    </button>

                    {/* SETTINGS */}
                    <button
                        type="button"
                        onClick={() => setSettingsOpen(true)}
                        className="group flex items-center justify-center gap-2.5 sm:gap-3.5 px-4 py-1.5 sm:py-2 transition-transform hover:scale-105 active:scale-95 cursor-pointer"
                    >
                        <img src="/ui-buttons/settings-button.png" alt="Settings" className="h-8 w-8 sm:h-11 sm:w-11 object-contain drop-shadow-md group-hover:scale-110 transition-transform" />
                        <span className="text-lg sm:text-2xl font-black uppercase tracking-widest text-slate-800 drop-shadow-[0_2px_4px_rgba(255,255,255,0.9)]">
                            SETTINGS
                        </span>
                    </button>

                    {/* QUIT */}
                    <button
                        type="button"
                        onClick={() => setShowExitConfirm(true)}
                        className="group flex items-center justify-center gap-2.5 sm:gap-3.5 px-4 py-1.5 sm:py-2 transition-transform hover:scale-105 active:scale-95 cursor-pointer"
                    >
                        <img src="/ui-buttons/quit-button.png" alt="Quit" className="h-8 w-8 sm:h-11 sm:w-11 object-contain drop-shadow-md group-hover:scale-110 transition-transform" />
                        <span className="text-lg sm:text-2xl font-black uppercase tracking-widest text-slate-800 drop-shadow-[0_2px_4px_rgba(255,255,255,0.9)]">
                            QUIT
                        </span>
                    </button>
                </div>
            </div>

            {/* BOTTOM BAR: LEFT = 3 UI BUTTONS (GUIDE, PLAYER, CREDITS), RIGHT = VERSION ONLY */}
            <div className="pointer-events-auto absolute inset-x-3 sm:inset-x-6 bottom-[calc(env(safe-area-inset-bottom)+0.35rem)] z-40 flex items-end justify-between">
                {/* 3 UI BUTTONS IN BOTTOM LEFT */}
                <div className="flex items-center gap-2.5 sm:gap-4">
                    {/* HOW TO PLAY / GUIDE */}
                    <button
                        type="button"
                        onClick={() => setHowToPlayOpen(true)}
                        className="group relative flex flex-col items-center gap-0.5 cursor-pointer transition-transform active:scale-90"
                        title="How To Play"
                    >
                        <img src="/ui-buttons/how-to-play-button.png" alt="How To Play" className="h-8 w-8 sm:h-11 sm:w-11 object-contain group-hover:scale-110 transition-transform drop-shadow-md" />
                        <span className="text-[8px] sm:text-[11px] font-black uppercase tracking-wider text-emerald-950 drop-shadow-xs">
                            Guide
                        </span>
                    </button>

                    {/* PLAYER DETAILS */}
                    <button
                        type="button"
                        onClick={() => { setProfileRequired(false); setPlayerDetailsOpen(true); }}
                        className="group relative flex flex-col items-center gap-0.5 cursor-pointer transition-transform active:scale-90"
                        title="Player Details"
                    >
                        <img src="/ui-buttons/character-button.png" alt="Player Details" className="h-8 w-8 sm:h-11 sm:w-11 object-contain group-hover:scale-110 transition-transform drop-shadow-md" />
                        <span className="text-[8px] sm:text-[11px] font-black uppercase tracking-wider text-emerald-950 drop-shadow-xs">
                            Player
                        </span>
                    </button>

                    {/* CREDITS */}
                    <button
                        type="button"
                        onClick={() => setCreditsOpen(true)}
                        className="group relative flex flex-col items-center gap-0.5 cursor-pointer transition-transform active:scale-90"
                        title="Credits"
                    >
                        <img src="/ui-buttons/credit-button.png" alt="Credits" className="h-8 w-8 sm:h-11 sm:w-11 object-contain group-hover:scale-110 transition-transform drop-shadow-md" />
                        <span className="text-[8px] sm:text-[11px] font-black uppercase tracking-wider text-emerald-950 drop-shadow-xs">
                            Credits
                        </span>
                    </button>
                </div>

                {/* VERSION ONLY IN BOTTOM RIGHT */}
                <div className="pb-0.5 text-[9px] sm:text-[11px] font-black uppercase tracking-widest text-emerald-950 drop-shadow-xs">
                    <span>VERSION 1.0</span>
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

            {playerDetailsOpen ? <PlayerDetailsModal isOpen={true} required={profileRequired} onClose={() => setPlayerDetailsOpen(false)} onSave={handleProfileSaved} /> : null}

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

// CARVED WOODEN BANNER TITLE

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

export function GameHUD({ playerName, onMenuClick, onPlayerDetails, onTasksClick, onBook, onCamera }) {
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

                    <button type="button" onClick={onPlayerDetails} aria-label="Edit player details" className="hud-player-pill flex min-w-0 items-center gap-2 rounded-2xl border-2 border-white/50 bg-emerald-950/80 px-3 py-1.5 text-left backdrop-blur-md shadow-xl transition-transform active:scale-95 sm:px-4 sm:py-2">
                        <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                        <p className="max-w-20 sm:max-w-50 truncate text-[10px] sm:text-xs font-black uppercase tracking-widest text-white">
                            {playerName || 'Explorer'}
                        </p>
                    </button>
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
                        data-sfx-self="true"
                    >
                        <img src={taskIcon} alt="" className="h-full w-full object-contain group-hover:scale-110 transition-transform" />
                    </button>
                </div>
            </div>
        </div>
    );
}

export function SettingsPanel({ isOpen, onClose, onQuit, cameraMode, onCameraModeChange }) {
    return (
        <SettingsModal
            isOpen={isOpen}
            inGame={true}
            onClose={onClose}
            onQuit={onQuit}
            cameraMode={cameraMode}
            onCameraModeChange={onCameraModeChange}
        />
    );
}

export function TaskPanel({ isOpen, onClose, tasks = [], onTaskClick, onResetTasks }) {
    const { mounted, active } = useModalTransition(isOpen, 300);
    const [page, setPage] = useState(0);
    const [showResetConfirm, setShowResetConfirm] = useState(false);

    // 3 items per page for clean mobile android visibility
    const pageSize = 3;
    const completedCount = tasks.filter((task) => task.completed).length;
    const progressPercent = (completedCount / (tasks.length || 1)) * 100;
    const pageCount = Math.max(1, Math.ceil(tasks.length / pageSize));
    const currentPage = Math.min(page, pageCount - 1);
    const visibleTasks = tasks.slice(currentPage * pageSize, currentPage * pageSize + pageSize);

    if (!mounted) return null;

    return (
        <div className="fixed inset-0 z-110 flex items-start justify-end p-2 sm:p-4 pt-[calc(env(safe-area-inset-top)+0.5rem)] pr-[max(0.5rem,env(safe-area-inset-right))] pointer-events-none" data-ui-modal="true" role="dialog" aria-modal="true" aria-label="Zoo task checklist">
            {/* Backdrop Fade */}
            <button
                type="button"
                className={cx(
                    'pointer-events-auto fixed inset-0 bg-slate-950/40 backdrop-blur-sm transition-opacity duration-300 ease-out',
                    active ? 'opacity-100' : 'opacity-0'
                )}
                onClick={onClose}
                aria-label="Close task checklist"
            />

            {/* Banner Style Top-Right Container (Fits screen bounds) */}
            <section
                className={cx(
                    'pointer-events-auto relative flex flex-col w-full max-w-sm sm:max-w-lg max-h-[calc(100dvh-1.5rem)] overflow-hidden rounded-2xl border-3 border-amber-950/80 bg-[#fffef0] text-slate-800 shadow-[0_20px_50px_rgba(0,0,0,0.45)] transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] transform origin-top-right',
                    active ? 'translate-y-0 opacity-100 scale-100' : '-translate-y-full opacity-0 scale-95'
                )}
            >
                {/* Hanging Banner Header Plaque */}
                <header className="relative shrink-0 bg-gradient-to-r from-amber-800 via-amber-700 to-amber-800 text-amber-50 p-2.5 sm:p-3.5 border-b-2 border-amber-950 flex items-center justify-between shadow-md">
                    <div className="flex items-center gap-2">
                        <img src="/ui-buttons/task-list-button.png" alt="Tasks" className="h-7 w-7 sm:h-8 sm:w-8 object-contain shrink-0" />
                        <div>
                            <h2 className="text-sm sm:text-base font-black uppercase tracking-wider drop-shadow-sm text-amber-100">
                                Zoo Checklist
                            </h2>
                            <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-amber-200/80">
                                Feed every zoo friend
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="rounded-xl border border-amber-400/50 bg-amber-950/70 px-2 py-0.5 sm:px-2.5 sm:py-1 text-[11px] sm:text-xs font-black text-amber-300 shadow-inner">
                            {completedCount} / {tasks.length}
                        </span>
                        <button
                            type="button"
                            onClick={onClose}
                            aria-label="Close checklist"
                            className="inline-flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-rose-500 hover:bg-rose-600 text-white font-black text-base sm:text-lg shadow-[0_3px_0_0_#9f1239] transition-transform active:scale-95 cursor-pointer"
                        >
                            &times;
                        </button>
                    </div>
                </header>

                {/* Banner Body Content (Scrollable if height constrained) */}
                <div className="p-2.5 sm:p-4 overflow-y-auto flex-1 flex flex-col justify-between">
                    <div>
                        {/* Progress Bar */}
                        <div className="relative h-2 shrink-0 overflow-hidden rounded-full bg-amber-200/60 border border-amber-300">
                            <div
                                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-[width] duration-500 shadow-sm"
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>

                        {/* Task Items List (3 items max per page) */}
                        <ol className="mt-2.5 grid auto-rows-fr gap-2">
                            {visibleTasks.map((task, index) => (
                                <li key={task.id}>
                                    <button
                                        type="button"
                                        onClick={() => onTaskClick?.(task)}
                                        className={cx(
                                            'flex h-full min-h-10 w-full items-center gap-2.5 rounded-xl border-2 px-2.5 py-1.5 text-left transition-all hover:bg-amber-100/60 active:scale-[0.99]',
                                            task.completed
                                                ? 'border-emerald-300 bg-emerald-50/60 text-slate-400'
                                                : 'border-amber-200/80 bg-white shadow-sm hover:border-amber-400'
                                        )}
                                    >
                                        <span className={cx(
                                            'flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 text-[11px] font-black transition-colors',
                                            task.completed ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-amber-400 bg-amber-50 text-amber-900'
                                        )}>
                                            {task.completed ? '✓' : currentPage * pageSize + index + 1}
                                        </span>
                                        <span className={cx('min-w-0 flex-1 text-xs font-black leading-tight sm:text-sm text-slate-800', task.completed && 'line-through opacity-60')}>
                                            {task.name}
                                        </span>
                                        <span className={cx(
                                            'shrink-0 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border',
                                            task.completed
                                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                                : 'bg-amber-100 text-amber-800 border-amber-300'
                                        )}>
                                            {task.completed ? 'Done' : 'Feed'}
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ol>
                    </div>

                    <div className="mt-2.5 flex flex-col gap-1.5 shrink-0 pt-2 border-t border-amber-200">
                        <PaginationControls page={currentPage} pageCount={pageCount} onPageChange={setPage} />
                        {onResetTasks ? (
                            <ActionButton
                                variant="warning"
                                size="sm"
                                className="w-full mt-0.5 h-8 sm:h-9 text-[11px] tracking-wider"
                                onClick={() => setShowResetConfirm(true)}
                            >
                                Reset Progress
                            </ActionButton>
                        ) : null}
                    </div>
                </div>
            </section>

            {showResetConfirm ? (
                <ResetTasksModal
                    isOpen={true}
                    onConfirm={() => {
                        setShowResetConfirm(false);
                        onResetTasks?.();
                    }}
                    onCancel={() => setShowResetConfirm(false)}
                />
            ) : null}
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

export function NPCDialogueModal({ isOpen, onClose, npcName, npcRole, message, choices = [], onSelectChoice, missionSteps = [], animalEntries = [], onOpenAnimalBook }) {
    const [transitioning, setTransitioning] = useState(false);
    const [animalPage, setAnimalPage] = useState(0);
    const [pressedChoice, setPressedChoice] = useState(null);
    const transitioningRef = useRef(false);
    const lastMessage = `${message}|${choices.map((choice) => choice.id).join(',')}`;

    useEffect(() => {
        if (!isOpen) return undefined;
        transitioningRef.current = true;
        const timer = window.setTimeout(() => {
            transitioningRef.current = false;
            setTransitioning(false);
            setAnimalPage(0);
            setPressedChoice(null);
        }, 260);
        return () => window.clearTimeout(timer);
    }, [isOpen, lastMessage]);

    if (!isOpen) return null;
    const isAnimalPage = choices.length === 1 && choices[0]?.id === 'back' && animalEntries.length > 0;
    const selectedAnimal = animalEntries[animalPage] || null;
    const choose = (choice) => {
        if (transitioning || transitioningRef.current) return;
        setPressedChoice(choice.id);
        onSelectChoice?.(choice);
    };

    const isLina = (npcName || '').toLowerCase().includes('lina');
    const avatarEmoji = isLina ? '👩‍🌾' : '🤠';
    const roleBadge = npcRole || (isLina ? 'Zoo Botanist' : 'Zoo Ranger');
    const isMultiChoice = choices.length > 3;

    return (
        <div
            className="fixed inset-0 z-120 flex items-center justify-center bg-slate-950/40 p-2 sm:p-5 backdrop-blur-md"
            role="dialog"
            aria-modal="true"
            aria-label="Ranger Guide"
        >
            <div
                className={cx(
                    'relative flex w-full max-w-lg max-h-[calc(100dvh-1rem)] flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white/95 shadow-2xl transition-all duration-300 my-auto',
                    transitioning && 'opacity-80 scale-98'
                )}
            >
                {/* Clean Header */}
                <header className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-slate-50/70 px-3.5 py-2.5 sm:px-6 sm:py-3.5">
                    <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-2xl border border-emerald-200/80 bg-emerald-50 text-xl sm:text-2xl shadow-xs" aria-hidden="true">
                            <span>{avatarEmoji}</span>
                        </div>
                        <div className="min-w-0">
                            <span className="inline-block rounded-full bg-emerald-100/80 px-2 py-0.5 text-[9px] sm:text-[10px] font-extrabold uppercase tracking-widest text-emerald-800">
                                {roleBadge}
                            </span>
                            <h2 className="text-sm font-black text-slate-900 leading-tight sm:text-lg">
                                {npcName || 'Ranger Lino'}
                            </h2>
                        </div>
                    </div>
                    <button
                        type="button"
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 active:scale-95 transition-all cursor-pointer"
                        onClick={onClose}
                        aria-label="Close"
                    >
                        <span className="text-lg font-black leading-none">&times;</span>
                    </button>
                </header>

                {/* Content Body (Scrollable on mobile landscape) */}
                <div className="flex flex-col gap-2.5 sm:gap-3 p-3 sm:p-5 overflow-y-auto flex-1 min-h-0">
                    {/* Speech Box */}
                    <div className="relative rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 shadow-xs">
                        <p className="text-xs sm:text-sm font-semibold leading-relaxed text-slate-800">
                            {message}
                        </p>
                    </div>

                    {/* Mission Goals View */}
                    {choices.some((choice) => choice.id === 'back') && missionSteps.length > 0 && !isAnimalPage ? (
                        <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-3 sm:p-4">
                            <div className="flex items-center justify-between gap-2 mb-2">
                                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-600">
                                    Mission Progress
                                </span>
                                <span className="text-xs font-bold text-emerald-700">
                                    {missionSteps.filter((step) => step.done).length} of {missionSteps.length} Done
                                </span>
                            </div>
                            <div className="grid gap-2 sm:grid-cols-2">
                                {missionSteps.map((step, index) => (
                                    <div
                                        key={step.title}
                                        className={cx(
                                            'flex items-center gap-2.5 rounded-xl border p-2.5 text-xs font-medium transition-all',
                                            step.done
                                                ? 'border-emerald-200 bg-emerald-50/70 text-emerald-950'
                                                : 'border-slate-200 bg-white text-slate-700'
                                        )}
                                    >
                                        <span className={cx('flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold', step.done ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-600')}>
                                            {step.done ? '✓' : index + 1}
                                        </span>
                                        <div className="min-w-0 flex-1 leading-tight">
                                            <p className="font-bold text-slate-900">{step.title}</p>
                                            <p className="text-[10px] text-slate-500 truncate">{step.objective}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : null}

                    {/* Animal Browser View */}
                    {isAnimalPage ? (
                        <div className="flex flex-col gap-2.5">
                            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4">
                                {selectedAnimal ? (
                                    <>
                                        <div className="flex items-center gap-3">
                                            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white border border-slate-200/80 text-2xl shadow-xs">
                                                {selectedAnimal.emoji}
                                            </span>
                                            <div>
                                                <h3 className="text-base font-bold text-slate-900 leading-tight">{selectedAnimal.name}</h3>
                                                <p className="text-[11px] font-medium italic text-slate-500">{selectedAnimal.scientific}</p>
                                            </div>
                                        </div>
                                        <div className="mt-3 text-xs font-normal leading-relaxed text-slate-700 space-y-1">
                                            <p><span className="font-semibold text-slate-900">Habitat:</span> {selectedAnimal.habitat}</p>
                                            <p><span className="font-semibold text-slate-900">Diet:</span> {selectedAnimal.diet}</p>
                                            <p><span className="font-semibold text-slate-900">Fun Fact:</span> {selectedAnimal.fact}</p>
                                        </div>
                                        <button type="button" className="mt-2.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800 underline" onClick={onOpenAnimalBook}>
                                            Open in Animal Book
                                        </button>
                                    </>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-4 text-center text-slate-500">
                                        <span className="text-3xl">🐾</span>
                                        <p className="text-xs font-medium mt-1">No animals discovered yet.</p>
                                    </div>
                                )}
                            </div>
                            <PaginationControls page={animalPage} pageCount={animalEntries.length} onPageChange={setAnimalPage} />
                        </div>
                    ) : null}

                    {/* 3D Styled Talk Buttons - Vertically Aligned Column */}
                    {!isAnimalPage ? (
                        <div className="flex flex-col gap-2.5 sm:gap-3 w-full">
                            {choices.map((choice, index) => {
                                const isAccent = choice.accent;
                                return (
                                    <button
                                        type="button"
                                        key={choice.id}
                                        disabled={transitioning}
                                        onClick={() => choose(choice)}
                                        className={cx(
                                            'group relative flex min-h-[3.25rem] w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-xs sm:text-sm font-black transition-all cursor-pointer active:translate-y-1 active:shadow-none',
                                            isAccent
                                                ? 'bg-gradient-to-b from-emerald-400 to-emerald-600 hover:from-emerald-300 hover:to-emerald-500 text-white border-2 border-emerald-300/80 shadow-[0_4px_0_0_#065f46]'
                                                : 'bg-gradient-to-b from-amber-100 via-amber-50 to-amber-200 hover:from-amber-200 hover:to-amber-300 text-amber-950 border-2 border-amber-300/90 shadow-[0_4px_0_0_#92400e]',
                                            pressedChoice === choice.id && 'scale-[0.98]'
                                        )}
                                    >
                                        <div className="flex items-center gap-3 min-w-0 flex-1">
                                            <span className={cx(
                                                'flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border text-xs font-black shadow-xs',
                                                isAccent
                                                    ? 'bg-emerald-700/40 border-emerald-300/50 text-white'
                                                    : 'bg-amber-200/80 border-amber-400/80 text-amber-900'
                                            )}>
                                                {choice.icon || index + 1}
                                            </span>
                                            <span className="min-w-0 flex-1 text-left leading-tight tracking-wide font-black">
                                                {choice.label}
                                            </span>
                                        </div>

                                        <span className={cx(
                                            'shrink-0 text-base font-black transition-transform group-hover:translate-x-0.5',
                                            isAccent ? 'text-emerald-100' : 'text-amber-800'
                                        )}>
                                            ➜
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    ) : null}
                </div>

                {/* 3D Styled Footer Buttons */}
                <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-200/80 bg-slate-50/80 px-4 py-3 sm:px-6">
                    <button
                        type="button"
                        className="rounded-xl bg-gradient-to-b from-slate-100 to-slate-200 hover:from-slate-200 hover:to-slate-300 text-slate-800 border border-slate-300 px-4 py-2 text-xs font-black tracking-wider uppercase shadow-[0_3px_0_0_#64748b] active:shadow-none active:translate-y-0.5 transition-all cursor-pointer"
                        disabled={transitioning}
                        onClick={() => choose({ id: 'back', nextId: 'root' })}
                    >
                        ← Back
                    </button>
                    <button
                        type="button"
                        className="rounded-xl bg-gradient-to-b from-rose-500 to-rose-600 hover:from-rose-400 hover:to-rose-500 text-white border border-rose-300 px-5 py-2 text-xs font-black tracking-wider uppercase shadow-[0_3px_0_0_#9f1239] active:shadow-none active:translate-y-0.5 transition-all cursor-pointer"
                        onClick={onClose}
                    >
                        Close
                    </button>
                </footer>
            </div>
        </div>
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

    const handlePressStart = (event) => {
        if (disabled || completed) return;
        event.preventDefault();
        event.stopPropagation();
        try {
            event.currentTarget?.setPointerCapture?.(event.pointerId);
        } catch {}
        onStart?.();
    };

    const handlePressEnd = (event) => {
        event.preventDefault();
        event.stopPropagation();
        onEnd?.();
    };

    return (
        <div className="pointer-events-none absolute bottom-[calc(env(safe-area-inset-bottom)+5.2rem)] right-2.5 z-70 flex flex-col items-center sm:right-4 sm:bottom-24">
            <div className="mb-1.5 flex w-auto max-w-48 flex-col items-center justify-center rounded-2xl border-2 border-emerald-200/80 bg-emerald-950/90 px-3 py-1 text-center text-white shadow-xl backdrop-blur-md">
                <span className="text-[11px] font-black uppercase tracking-wider text-amber-300">
                    {animalName ? `${animalName}` : 'Animal'}
                </span>
                <span className="text-[10px] font-extrabold uppercase tracking-wide text-emerald-100">
                    {label}
                </span>
                {message ? <span className="mt-0.5 text-[9px] font-medium leading-snug text-slate-200">{message}</span> : null}
            </div>
            <button
                type="button"
                data-ui-button="true"
                aria-label={`${label}${animalName ? ` ${animalName}` : ''}`}
                onContextMenu={(e) => e.preventDefault()}
                onPointerDown={handlePressStart}
                onPointerUp={handlePressEnd}
                onPointerCancel={handlePressEnd}
                onTouchStart={handlePressStart}
                onTouchEnd={handlePressEnd}
                onTouchCancel={handlePressEnd}
                className={cx(
                    'pointer-events-auto relative grid h-20 w-20 place-items-center rounded-full border-4 border-white/80 shadow-2xl touch-none select-none transition-transform active:scale-95 sm:h-24 sm:w-24 cursor-pointer',
                    completed ? 'bg-emerald-500' : disabled ? 'bg-slate-400 opacity-70' : 'bg-emerald-950/90',
                )}
            >
                <span
                    className="absolute -inset-1 rounded-full"
                    style={{ background: `conic-gradient(${completed ? '#22c55e' : '#facc15'} ${percentage}%, rgba(255,255,255,.25) ${percentage}% 100%)`, zIndex: 0 }}
                    aria-hidden="true"
                />
                <span className="absolute inset-1 rounded-full bg-emerald-950/90" aria-hidden="true" />
                {completed ? <span className="relative z-10 text-3xl font-black text-white">✓</span> : <img className="relative z-10 h-10 w-10 sm:h-12 sm:w-12 pointer-events-none" src="/ui-buttons/feed-button.png" alt="" />}
            </button>
        </div>
    );
}

export function AnimalCaution({ visible }) {
    if (!visible) return null;

    return (
        <div className="pointer-events-none absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+5.2rem)] z-70 flex justify-center px-3 sm:bottom-24">
            <div className="rounded-2xl border-2 border-red-200 bg-red-950/90 px-4 py-2 text-center text-white shadow-xl">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-amber-300">Caution: Dangerous Animal</p>
                <p className="mt-1 text-[11px] font-bold">Please avoid contact with the tiger. Do not feed it.</p>
            </div>
        </div>
    );
}

const ANIMAL_BOOK_ENTRIES = ANIMAL_METADATA;

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
    return null;
}
