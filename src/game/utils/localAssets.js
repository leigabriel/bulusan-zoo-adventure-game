const DB_NAME = 'minizoo-assets';
const STORE_NAME = 'assets';
const DB_VERSION = 1;

const objectUrlCache = new Map();
const pendingAssetRequests = new Map();
let dbPromise = null;

const CHARACTER_MODELS = [
  'Casual3_Female.gltf',
  'Casual3_Male.gltf',
  'Cowboy_Female.gltf',
  'Cowboy_Male.gltf',
  'Kimono_Female.gltf',
  'Kimono_Male.gltf',
];

const ANIMAL_MODELS = [
  'Alpaca.gltf',
  'Bull.gltf',
  'Cow.gltf',
  'Deer.gltf',
  'Donkey.gltf',
  'Fox.gltf',
  'Horse.gltf',
  'monkey/scene.gltf',
  'ostrich/scene.gltf',
  'rabbit/scene.gltf',
  'Stag.gltf',
  'tiger/scene.gltf',
];

const ANIMAL_MODEL_DEPENDENCIES = [
  '/models/animals/monkey/scene.bin',
  '/models/animals/monkey/textures/material_diffuse.png',
  '/models/animals/monkey/textures/material_specularGlossiness.png',
  '/models/animals/ostrich/scene.bin',
  '/models/animals/ostrich/textures/material_baseColor.png',
  '/models/animals/ostrich/textures/defaultMat_baseColor.png',
  '/models/animals/ostrich/textures/defaultMat_normal.png',
  '/models/animals/ostrich/textures/defaultMat_metallicRoughness.png',
  '/models/animals/ostrich/textures/defaultMat_specularf0.png',
  '/models/animals/rabbit/scene.bin',
  '/models/animals/tiger/scene.bin',
  '/models/animals/tiger/textures/Tiger_Default_baseColor.png',
];

const AUDIO_ASSETS = [
  '/audio/alpaca.mp3',
  '/audio/ambience.mp3',
  '/audio/book-page-turning.mp3',
  '/audio/bull.wav',
  '/audio/click.mp3',
  '/audio/cow.mp3',
  '/audio/deer.mp3',
  '/audio/donkey.mp3',
  '/audio/feed.wav',
  '/audio/finish-task.mp3',
  '/audio/fox.mp3',
  '/audio/game-bg-music.mp3',
  '/audio/horse.mp3',
  '/audio/redd.mp3',
];

const STRUCTURE_ASSETS = [
];

export const ESSENTIAL_ASSET_PATHS = [
  '/models/bulusanstatue.glb',
  ...AUDIO_ASSETS,
  ...STRUCTURE_ASSETS,
  ...CHARACTER_MODELS.map((file) => `/models/characters/${file}`),
  ...ANIMAL_MODELS.map((file) => `/models/animals/${file}`),
  ...ANIMAL_MODEL_DEPENDENCIES,
];

function normalizeAssetPath(path) {
  if (typeof path !== 'string') return '';
  return path.startsWith('/') ? path : `/${path}`;
}

function hasIndexedDB() {
  return typeof indexedDB !== 'undefined';
}

function openAssetDb() {
  if (!hasIndexedDB()) return Promise.resolve(null);
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });

  return dbPromise;
}

async function readBlobFromDb(path) {
  const db = await openAssetDb();
  if (!db) return null;

  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(path);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => resolve(null);
  });
}

async function writeBlobToDb(path, blob) {
  const db = await openAssetDb();
  if (!db) return;

  await new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(blob, path);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
    tx.onabort = () => resolve();
  });
}

function toObjectUrl(path, blob) {
  const cached = objectUrlCache.get(path);
  if (cached) return cached;

  const objectUrl = URL.createObjectURL(blob);
  objectUrlCache.set(path, objectUrl);
  return objectUrl;
}

async function fetchAndPersist(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to fetch asset: ${path}`);
  }
  const blob = await response.blob();
  await writeBlobToDb(path, blob);
  return blob;
}

export async function resolveAssetUrl(path) {
  const normalizedPath = normalizeAssetPath(path);
  if (!normalizedPath) return path;

  // Don't use object URLs for models with relative dependencies (textures, bins).
  // Returning the original path allows Three.js to resolve relative assets correctly.
  // The Service Worker handles the actual caching/offline support.
  const isModel = /\.(?:gltf|glb|obj|mtl|bin)$/i.test(normalizedPath);
  if (isModel) return normalizedPath;

  const pending = pendingAssetRequests.get(normalizedPath);
  if (pending) return pending;

    const request = (async () => {
      try {
        const existingBlob = await readBlobFromDb(normalizedPath);
        if (existingBlob) return toObjectUrl(normalizedPath, existingBlob);

        const fetchedBlob = await fetchAndPersist(normalizedPath);
        return toObjectUrl(normalizedPath, fetchedBlob);
      } catch {
        return normalizedPath;
      } finally {
        pendingAssetRequests.delete(normalizedPath);
      }
    })();
    pendingAssetRequests.set(normalizedPath, request);
    return request;
}

export async function warmupAssetStore(paths = ESSENTIAL_ASSET_PATHS, onProgress) {
  if (!Array.isArray(paths) || paths.length === 0) return;

  let completed = 0;
  const concurrency = 4;
  for (let i = 0; i < paths.length; i += concurrency) {
    const batch = paths.slice(i, i + concurrency);
    await Promise.all(batch.map(async (path) => {
      await resolveAssetUrl(path);
      completed += 1;
      if (typeof onProgress === 'function') onProgress(completed / paths.length, path);
    }));
  }
}

export function releaseAssetObjectUrls() {
  for (const objectUrl of objectUrlCache.values()) {
    URL.revokeObjectURL(objectUrl);
  }
  objectUrlCache.clear();
  pendingAssetRequests.clear();
}
