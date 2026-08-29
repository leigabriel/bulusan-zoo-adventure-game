export const PLAYER_PROFILE_CHANGE_EVENT = 'minizoo-player-profile-changed';

const PLAYER_NAME_KEY = 'minizoo_player_name';
const PLAYER_GENDER_KEY = 'minizoo_player_gender';
const LEGACY_CHARACTER_KEY = 'minizoo_character_id';

export const PLAYER_GENDERS = [
    { id: 'boy', label: 'Boy', file: 'boy-character.gltf' },
    { id: 'girl', label: 'Girl', file: 'girl-character.gltf' },
];

export function getPlayerProfile() {
    try {
        const name = (localStorage.getItem(PLAYER_NAME_KEY) || '').trim();
        let gender = (localStorage.getItem(PLAYER_GENDER_KEY) || '').trim();

        if (!PLAYER_GENDERS.some((option) => option.id === gender)) {
            const legacyId = (localStorage.getItem(LEGACY_CHARACTER_KEY) || '').toLowerCase();
            gender = legacyId.includes('female') ? 'girl' : legacyId.includes('male') ? 'boy' : '';
            if (gender) localStorage.setItem(PLAYER_GENDER_KEY, gender);
        }

        return { name, gender };
    } catch {
        return { name: '', gender: '' };
    }
}

export function isPlayerProfileComplete(profile = getPlayerProfile()) {
    return Boolean(profile.name && PLAYER_GENDERS.some((option) => option.id === profile.gender));
}

export function savePlayerProfile(profile) {
    const name = String(profile?.name || '').trim().slice(0, 24);
    const gender = PLAYER_GENDERS.some((option) => option.id === profile?.gender) ? profile.gender : '';
    if (!name || !gender) return null;

    try {
        localStorage.setItem(PLAYER_NAME_KEY, name);
        localStorage.setItem(PLAYER_GENDER_KEY, gender);
        localStorage.removeItem(LEGACY_CHARACTER_KEY);
        window.dispatchEvent(new CustomEvent(PLAYER_PROFILE_CHANGE_EVENT, { detail: { name, gender } }));
        return { name, gender };
    } catch {
        return null;
    }
}

export function getPlayerModel(gender) {
    return PLAYER_GENDERS.find((option) => option.id === gender) || null;
}
