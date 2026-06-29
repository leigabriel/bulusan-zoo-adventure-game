/* eslint-disable react-refresh/only-export-components */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { resolveAssetUrl } from '../utils/localAssets.js';
import { ActionButton, IconButton, ModalShell, SideSheet, SurfacePanel, cx } from './UIComponents.jsx';

const SETTINGS_KEY = 'minizoo_settings';
const SETTINGS_CHANGE_EVENT = 'minizoo-settings-changed';
const PLAYER_NAME_KEY = 'minizoo_player_name';
const PLAYER_NAME_CHANGE_EVENT = 'minizoo-player-name-changed';
const LOADING_DEER_GIF_PATH = '/icons/running-deer.gif';

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
        // Ignore storage failures and continue.
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
        // Keep gameplay running even if storage is unavailable.
    }
}

function isUISoundEnabled() {
    try {
        return readSettings().soundEnabled !== false;
    } catch {
        return true;
    }
}

async function preloadAudio(src, template) {
    try {
        const assetUrl = await resolveAssetUrl(src);
        if (assetUrl) {
            template.src = assetUrl;
        }
    } catch {
        // Ignore asset fallback failures.
    }
}

function getUIButtonAudioTemplate(kind = 'tap') {
    const src = SFX_FILES[kind] || SFX_FILES.tap;
    if (!uiAudioTemplates[src]) {
        const template = new Audio(src);
        template.preload = 'auto';
        preloadAudio(src, template);
        uiAudioTemplates[src] = template;
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
        const clone = template.cloneNode(true);
        clone.volume = kind === 'feed' || kind === 'task-complete' || kind === 'confirm' ? 1 : 0.9;
        const playPromise = clone.play();
        if (playPromise && typeof playPromise.catch === 'function') {
            playPromise.catch(() => { });
        }
    } catch {
        // Ignore browser playback restrictions.
    }
}

export function LoadingScreen({ progress = 0 }) {
    const safeProgress = Number.isFinite(progress) ? Math.max(0, Math.min(100, progress)) : 0;
    const deerPosition = Math.max(4, Math.min(96, safeProgress));
    const [gifUnavailable, setGifUnavailable] = useState(false);

    return (
        <div className="absolute inset-0 z-50 overflow-hidden">
            <div className="relative z-10 flex h-full items-center justify-center px-4 py-5">
                <div className="w-[min(26rem,94vw)]">
                    <div className="relative h-20">
                        <div
                            className="loader-deer-runner"
                            style={{ left: `calc(${deerPosition}% - 1.8rem)` }}
                            aria-hidden="true"
                        >
                            {!gifUnavailable ? (
                                <img
                                    src={LOADING_DEER_GIF_PATH}
                                    alt=""
                                    className="loader-deer-gif"
                                    draggable="false"
                                    onError={() => setGifUnavailable(true)}
                                />
                            ) : (
                                <span className="loader-deer-fallback">🦌</span>
                            )}
                        </div>
                    </div>

                    <div className="relative h-3.5 w-full overflow-hidden rounded-full bg-emerald-100/80 shadow-[inset_0_1px_3px_rgba(5,46,22,0.16)]">
                        <div
                            className="relative h-full rounded-full bg-linear-to-r from-emerald-400 via-emerald-500 to-lime-400 transition-[width] duration-400 ease-out"
                            style={{ width: `${safeProgress}%` }}
                        >
                            <span className="loader-progress-orb" aria-hidden="true" />
                        </div>
                    </div>
                    <span className="sr-only">Loading {Math.round(safeProgress)} percent</span>
                </div>
            </div>
        </div>
    );
}

export function MainMenu({ onStart, isVisible, onPlayerNameSaved }) {
    const isTouch = useIsTouchDevice();
    const { isFullscreen, toggleFullscreen } = useFullscreen();
    const [starting, setStarting] = useState(false);
    const [settings, setSettings] = useState(() => readSettings());
    const [howToPlayOpen, setHowToPlayOpen] = useState(false);
    const [playerNameInput, setPlayerNameInput] = useState(() => readPlayerName());
    const [nameModalOpen, setNameModalOpen] = useState(() => !readPlayerName());

    const saveSettings = useCallback((updates) => {
        const next = { ...settings, ...updates };
        setSettings(next);
        persistSettings(next);
    }, [settings]);

    const handleStart = useCallback(() => {
        playGameButtonSfx('confirm');
        setStarting(true);
        window.setTimeout(onStart, 380);
    }, [onStart]);

    const handleSavePlayerName = useCallback(() => {
        const saved = savePlayerName(playerNameInput);
        if (!saved) return;
        onPlayerNameSaved?.(saved);
        setPlayerNameInput(saved);
        setNameModalOpen(false);
    }, [playerNameInput, onPlayerNameSaved]);

    const closeNameModal = useCallback(() => {
        const existing = readPlayerName();
        setNameModalOpen(!existing);
    }, []);

    const canStart = !starting && !!readPlayerName();

    if (!isVisible) return null;

    return (
        <div className="absolute inset-0 z-40 overflow-hidden">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,rgba(16,185,129,0.16),rgba(16,185,129,0)_42%),radial-gradient(circle_at_86%_82%,rgba(163,230,53,0.18),rgba(163,230,53,0)_44%)]" />

            <div className="relative z-10 flex h-full items-center justify-center p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-[calc(env(safe-area-inset-top)+1rem)] sm:p-6">
                <SurfacePanel className="w-full max-w-xl p-5 sm:p-7" data-ui-panel="true">
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700/85">Bulusan, Calapan City, Oriental Mindoro</p>
                    <h1 className="mt-3 text-4xl font-black leading-none tracking-[0.02em] text-emerald-950 sm:text-6xl">Bulusan Zootopia</h1>
                    <p className="mt-2 text-sm font-bold tracking-wide text-emerald-900/75 sm:text-base">A calm wildlife adventure made for kids</p>

                    <div className="mx-auto mt-6 w-full max-w-md space-y-3">
                        <ActionButton
                            variant="primary"
                            size="lg"
                            className="w-full"
                            onClick={handleStart}
                            disabled={!canStart}
                        >
                            {starting ? 'Starting...' : 'Start Adventure'}
                        </ActionButton>

                        <div className="grid gap-2 sm:grid-cols-2">
                            <ToggleRow
                                label="Music"
                                description="Background soundtrack"
                                enabled={settings.musicEnabled !== false}
                                onToggle={() => saveSettings({ musicEnabled: settings.musicEnabled === false })}
                            />
                            <ToggleRow
                                label="Sound"
                                description="Button and animal sounds"
                                enabled={settings.soundEnabled !== false}
                                onToggle={() => saveSettings({ soundEnabled: settings.soundEnabled === false })}
                            />
                        </div>

                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <ActionButton variant="secondary" onClick={() => setHowToPlayOpen(true)}>How To Play</ActionButton>
                            <ActionButton variant="secondary" onClick={toggleFullscreen}>
                                {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                            </ActionButton>
                        </div>

                        <p className="text-center text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-900/60">
                            {isTouch ? 'Touch controls active' : 'Keyboard and mouse active'}
                        </p>
                    </div>
                </SurfacePanel>
            </div>

            <ModalShell isOpen={nameModalOpen} onClose={closeNameModal} title="Set Your Player Name" size="sm">
                <p className="text-sm font-semibold text-slate-600">Enter your name to start exploring the zoo. This is saved on your device.</p>

                <label className="mt-3 block text-left text-xs font-black uppercase tracking-[0.12em] text-slate-500" htmlFor="player-name-input">
                    Player Name
                </label>
                <input
                    id="player-name-input"
                    type="text"
                    maxLength={24}
                    value={playerNameInput}
                    autoFocus
                    onChange={(e) => setPlayerNameInput(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            handleSavePlayerName();
                        }
                    }}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-800 outline-none ring-0 transition focus:border-emerald-400"
                    placeholder="Type your name"
                />

                <div className="mt-4 flex justify-end">
                    <ActionButton variant="primary" onClick={handleSavePlayerName} disabled={!playerNameInput.trim()}>
                        Save Name
                    </ActionButton>
                </div>
            </ModalShell>

            <ModalShell isOpen={howToPlayOpen} onClose={() => setHowToPlayOpen(false)} title="How To Play" size="md">
                <HowToPlayContent />
            </ModalShell>
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
                            <h3 className="truncate text-sm font-black text-slate-900">{animal.emoji || '🐾'} {animal.name}</h3>
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
                <p className="text-4xl">🎉🐾🏆</p>
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
