/**
 * Local Storage Utility for Mini Zoo Game
 * Handles all client-side persistence
 */

const STORAGE_KEYS = {
    SETTINGS: 'minizoo_settings',
    PROGRESS: 'minizoo_progress',
    FEEDING_STATUS: 'minizoo_feeding'
};

// Default values
const DEFAULT_SETTINGS = {
    ambienceVolume: 1.0,
    musicVolume: 0.5,
    uiVolume: 1.0,
    sfxVolume: 1.0,
    graphicsQuality: 'medium',
    fpsLimit: 60,
    sensitivity: 1.0
};

const DEFAULT_PROGRESS = {
    animalsDiscovered: [],
    totalAnimalsViewed: 0,
    lastPlayed: null,
    lastKnownPosition: null,
    lastYaw: 0,
    lastPitch: 0,
    lastCameraMode: 'third',
    lastCharacterId: null
};

function isFiniteNumber(value) {
    return Number.isFinite(value);
}

function normalizePosition(position) {
    if (!position || typeof position !== 'object') return null;
    const { x, y, z } = position;
    if (!isFiniteNumber(x) || !isFiniteNumber(y) || !isFiniteNumber(z)) return null;
    return { x, y, z };
}

function normalizeCameraMode(mode) {
    return mode === 'third' ? 'third' : 'first';
}

/**
 * Safe JSON parse with fallback
 */
function safeParse(json, fallback) {
    try {
        return json ? JSON.parse(json) : fallback;
    } catch {
        return fallback;
    }
}

/**
 * Settings Management
 */
export function getSettings() {
    const stored = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    return { ...DEFAULT_SETTINGS, ...safeParse(stored, {}) };
}

export function saveSettings(settings) {
    const current = getSettings();
    const updated = { ...current, ...settings };
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
    return updated;
}

export function setVolume(key, value) {
    const next = {};
    next[key] = Math.max(0, Math.min(1, value));
    return saveSettings(next);
}

export function toggleMusic() {
    const settings = getSettings();
    return setVolume('musicVolume', settings.musicVolume > 0 ? 0 : 0.5);
}

export function setGraphicsQuality(quality) {
    if (!['low', 'medium', 'high'].includes(quality)) return getSettings();
    return saveSettings({ graphicsQuality: quality });
}

export function setFpsLimit(fps) {
    const valid = [24, 30, 60, 120];
    if (!valid.includes(fps)) return getSettings();
    return saveSettings({ fpsLimit: fps });
}

/**
 * Progress Management
 */
export function getProgress() {
    const stored = localStorage.getItem(STORAGE_KEYS.PROGRESS);
    return { ...DEFAULT_PROGRESS, ...safeParse(stored, {}) };
}

export function getDiscoveredAnimals() {
    return getProgress().animalsDiscovered;
}

export function saveProgress(progress) {
    const current = getProgress();
    const updated = { ...current, ...progress, lastPlayed: Date.now() };
    localStorage.setItem(STORAGE_KEYS.PROGRESS, JSON.stringify(updated));
    return updated;
}

export function getPlayerSession() {
    const progress = getProgress();
    return {
        position: normalizePosition(progress.lastKnownPosition),
        yaw: isFiniteNumber(progress.lastYaw) ? progress.lastYaw : 0,
        pitch: isFiniteNumber(progress.lastPitch) ? progress.lastPitch : 0,
        cameraMode: normalizeCameraMode(progress.lastCameraMode),
        characterId: typeof progress.lastCharacterId === 'string' ? progress.lastCharacterId : null
    };
}

export function savePlayerSession(session) {
    if (!session || typeof session !== 'object') return getProgress();

    const updates = {};
    if ('position' in session) {
        updates.lastKnownPosition = normalizePosition(session.position);
    }
    if (isFiniteNumber(session.yaw)) {
        updates.lastYaw = session.yaw;
    }
    if (isFiniteNumber(session.pitch)) {
        updates.lastPitch = session.pitch;
    }
    if ('cameraMode' in session) {
        updates.lastCameraMode = normalizeCameraMode(session.cameraMode);
    }
    if ('characterId' in session) {
        updates.lastCharacterId = typeof session.characterId === 'string' ? session.characterId : null;
    }

    return saveProgress(updates);
}

export function markAnimalDiscovered(animalName) {
    const progress = getProgress();
    if (!progress.animalsDiscovered.includes(animalName)) {
        progress.animalsDiscovered = [...progress.animalsDiscovered, animalName];
        progress.totalAnimalsViewed++;
        saveProgress(progress);
    }
    return progress;
}

/**
 * Feeding Status Management
 */
export function getFeedingStatus() {
    const stored = localStorage.getItem(STORAGE_KEYS.FEEDING_STATUS);
    return safeParse(stored, {});
}

export function saveFeedingStatus(status) {
    localStorage.setItem(STORAGE_KEYS.FEEDING_STATUS, JSON.stringify(status));
    return status;
}

export function feedAnimal(animalName) {
    const status = getFeedingStatus();
    const animalStatus = status[animalName] || { fed: false, lastFed: null, feedCount: 0 };
    
    status[animalName] = {
        fed: true,
        lastFed: Date.now(),
        feedCount: animalStatus.feedCount + 1
    };
    
    saveFeedingStatus(status);
    return status;
}

export function isAnimalFed(animalName) {
    const status = getFeedingStatus();
    return status[animalName]?.fed || false;
}

export function resetDailyFeeding() {
    // Reset all feeding status (could be called daily)
    const status = getFeedingStatus();
    Object.keys(status).forEach(key => {
        status[key].fed = false;
    });
    saveFeedingStatus(status);
    return status;
}

export function resetAllFeedingTasks() {
    localStorage.removeItem(STORAGE_KEYS.FEEDING_STATUS);
    return {};
}

/**
 * Get all tasks with completion status
 */
export function getTasks() {
    const feedingStatus = getFeedingStatus();
    
    // Define all animal feeding tasks
    const animalNames = [
        'White-tailed Deer', 'Domestic Horse',
        'Donkey', 'Domestic Cow', 'Alpaca', 'Ostrich',
        'Red Deer Stag', 'Bull', 'Forest Monkey',
        'Rabbit (Idle)', 'Rabbit (Walk)', 'Bengal Tiger'
    ];
    
    return animalNames.map(name => ({
        id: name.toLowerCase().replace(/\s+/g, '_'),
        name: `Feed the ${name}`,
        animalName: name,
        completed: feedingStatus[name]?.fed || false,
        feedCount: feedingStatus[name]?.feedCount || 0
    }));
}

export function getCompletedTasksCount() {
    const tasks = getTasks();
    return tasks.filter(t => t.completed).length;
}

export function getTotalTasks() {
    return getTasks().length;
}

/**
 * Clear all stored data
 */
export function clearAllData() {
    Object.values(STORAGE_KEYS).forEach(key => {
        localStorage.removeItem(key);
    });
}
