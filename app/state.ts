/**
 * Persistent state for parent customizations.
 * Source-of-truth for: per-item voice recordings, custom items, category labels, PIN.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import contentData from './assets/content_data.json';

export type CategoryId = 'letters' | 'numbers' | 'animals' | 'colors';

export type Recording = {
  id: string;          // uuid
  uri: string;         // file:// path inside documentDirectory/recordings
  label?: string;      // optional name e.g. "Mama" / "Tata"
  createdAt: number;
};

export type ItemOverrides = {
  recordings: Recording[];
  selectedRecordingId: string | null;   // null → use default TTS
};

export type CustomItem = {
  id: string;                    // "custom_<uuid>"
  category: CategoryId;          // attaches to one of the built-in categories
  imageUri: string;              // file://
  label: string;                 // displayed text
  recordings: Recording[];
  selectedRecordingId: string | null;
  createdAt: number;
};

export type CategoryLabels = {
  letters: string;
  numbers: string;
  animals: string;
  colors: string;
};

export type PersistedState = {
  itemOverrides: Record<string, ItemOverrides>;
  customItems: CustomItem[];
  categoryLabels: CategoryLabels;
  pin: string;
  kioskEnabled: boolean;
};

const STORAGE_KEY = 'tyk_state_v1';

export const DEFAULT_LABELS: CategoryLabels = {
  letters: 'Literki',
  numbers: 'Cyfry',
  animals: 'Zwierzęta',
  colors: 'Kolory',
};

const DEFAULT_STATE: PersistedState = {
  itemOverrides: {},
  customItems: [],
  categoryLabels: DEFAULT_LABELS,
  pin: '1234',
  kioskEnabled: false,
};

export async function loadState(): Promise<PersistedState> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_STATE,
      ...parsed,
      categoryLabels: { ...DEFAULT_LABELS, ...(parsed.categoryLabels || {}) },
    };
  } catch (e) {
    console.warn('loadState failed, using defaults', e);
    return { ...DEFAULT_STATE };
  }
}

export async function saveState(state: PersistedState): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/**
 * Persistent dir for recordings + imported images.
 * expo-file-system in SDK 54 exposes Paths — but the legacy `documentDirectory`
 * still works. We resolve once on module load.
 */
const docDir = (FileSystem as any).documentDirectory ?? (FileSystem as any).Paths?.document?.uri ?? '';
export const RECORDINGS_DIR = docDir + 'recordings/';
export const IMAGES_DIR = docDir + 'custom_images/';

export async function ensureDirs(): Promise<void> {
  for (const dir of [RECORDINGS_DIR, IMAGES_DIR]) {
    try {
      const info = await FileSystem.getInfoAsync(dir);
      if (!info.exists) await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    } catch (e) {
      console.warn('ensureDirs', dir, e);
    }
  }
}

export function uuid(): string {
  return (
    Date.now().toString(36) +
    '_' +
    Math.random().toString(36).slice(2, 10)
  );
}

/* ---------- mutators ---------- */

export function getOverrides(state: PersistedState, itemId: string): ItemOverrides {
  return (
    state.itemOverrides[itemId] || { recordings: [], selectedRecordingId: null }
  );
}

export function upsertOverride(
  state: PersistedState,
  itemId: string,
  patch: Partial<ItemOverrides>,
): PersistedState {
  const cur = getOverrides(state, itemId);
  return {
    ...state,
    itemOverrides: {
      ...state.itemOverrides,
      [itemId]: { ...cur, ...patch },
    },
  };
}

export function addRecordingToBuiltin(
  state: PersistedState,
  itemId: string,
  rec: Recording,
  selectIfFirst = true,
): PersistedState {
  const cur = getOverrides(state, itemId);
  const recordings = [...cur.recordings, rec];
  const selectedRecordingId =
    cur.selectedRecordingId ?? (selectIfFirst ? rec.id : null);
  return upsertOverride(state, itemId, { recordings, selectedRecordingId });
}

export function removeRecordingFromBuiltin(
  state: PersistedState,
  itemId: string,
  recId: string,
): PersistedState {
  const cur = getOverrides(state, itemId);
  const recordings = cur.recordings.filter((r) => r.id !== recId);
  let selectedRecordingId = cur.selectedRecordingId;
  if (selectedRecordingId === recId) {
    selectedRecordingId = recordings[0]?.id ?? null;
  }
  return upsertOverride(state, itemId, { recordings, selectedRecordingId });
}

export function selectRecordingForBuiltin(
  state: PersistedState,
  itemId: string,
  recId: string | null,
): PersistedState {
  return upsertOverride(state, itemId, { selectedRecordingId: recId });
}

export function addCustomItem(
  state: PersistedState,
  item: CustomItem,
): PersistedState {
  return { ...state, customItems: [...state.customItems, item] };
}

export function updateCustomItem(
  state: PersistedState,
  id: string,
  patch: Partial<CustomItem>,
): PersistedState {
  return {
    ...state,
    customItems: state.customItems.map((it) =>
      it.id === id ? { ...it, ...patch } : it,
    ),
  };
}

export function removeCustomItem(
  state: PersistedState,
  id: string,
): PersistedState {
  return { ...state, customItems: state.customItems.filter((it) => it.id !== id) };
}

export function setCategoryLabel(
  state: PersistedState,
  cat: CategoryId,
  label: string,
): PersistedState {
  return { ...state, categoryLabels: { ...state.categoryLabels, [cat]: label } };
}

/* ---------- merged item view (built-in + custom) ---------- */

export type MergedItem = {
  id: string;
  category: CategoryId;
  isCustom: boolean;
  /** display label primary — e.g. "Krowa" or letter "A" */
  primary: string;
  /** display caption — e.g. "Krowa mówi Muuu!" or "A jak Arbuz" */
  caption: string;
  /** built-in image require() OR file:// uri for custom */
  imageSource: any;
  /** absolute file path for custom audio if a parent recording is selected */
  customAudioUri: string | null;
  /** built-in audio key (in AudioAssets) when no override is selected */
  builtinAudioKey: string | null;
  /** background color for color items */
  hex?: string;
  /** raw built-in record (for letters etc.) */
  raw?: any;
};

export function buildItemsForCategory(
  cat: CategoryId,
  state: PersistedState,
  language: 'pl' | 'en' = 'pl',
): MergedItem[] {
  const out: MergedItem[] = [];

  const pickAudio = (rec: any): string | null => {
    if (cat === 'letters') return rec.audio || null;
    return language === 'pl'
      ? rec.audio_pl || rec.audio || null
      : rec.audio_en || rec.audio || null;
  };

  const pickPrimary = (rec: any): string => {
    if (cat === 'letters') return rec.letter || '';
    return language === 'pl' ? rec.pl || rec.letter || '' : rec.en || rec.letter || '';
  };

  const pickCaption = (rec: any): string => {
    if (cat === 'animals') {
      return language === 'pl'
        ? `${rec.pl} mówi ${rec.sound_pl}`
        : `${rec.en} says ${rec.sound_en}`;
    }
    if (cat === 'letters') {
      return language === 'pl'
        ? `${rec.letter} jak ${rec.word}`
        : `${rec.letter} is for ${rec.word}`;
    }
    return language === 'pl' ? rec.pl || '' : rec.en || rec.pl || '';
  };

  // --- built-ins ---
  const sourceArr =
    cat === 'letters'
      ? language === 'pl'
        ? (contentData as any).letters_pl
        : (contentData as any).letters_en
      : (contentData as any)[cat] || [];

  for (const rec of sourceArr) {
    const ovr = state.itemOverrides[rec.id];
    const selectedRec = ovr?.recordings.find((r) => r.id === ovr.selectedRecordingId);
    out.push({
      id: rec.id,
      category: cat,
      isCustom: false,
      primary: pickPrimary(rec),
      caption: pickCaption(rec),
      imageSource: rec.filename ? { __builtinImage: rec.filename } : null,
      customAudioUri: selectedRec?.uri ?? null,
      builtinAudioKey: selectedRec ? null : pickAudio(rec),
      hex: rec.hex,
      raw: rec,
    });
  }

  // --- custom items ---
  for (const ci of state.customItems) {
    if (ci.category !== cat) continue;
    const sel = ci.recordings.find((r) => r.id === ci.selectedRecordingId);
    out.push({
      id: ci.id,
      category: cat,
      isCustom: true,
      primary: ci.label,
      caption: ci.label,
      imageSource: { uri: ci.imageUri },
      customAudioUri: sel?.uri ?? null,
      builtinAudioKey: null,
    });
  }

  return out;
}

/**
 * Find a recording by id across both built-in overrides and custom items.
 */
export function findRecording(
  state: PersistedState,
  itemId: string,
  recId: string,
): Recording | null {
  const isCustom = itemId.startsWith('custom_');
  if (isCustom) {
    const ci = state.customItems.find((c) => c.id === itemId);
    return ci?.recordings.find((r) => r.id === recId) ?? null;
  }
  return getOverrides(state, itemId).recordings.find((r) => r.id === recId) ?? null;
}

/** Mutator that handles both built-in and custom items uniformly. */
export function addRecording(
  state: PersistedState,
  itemId: string,
  rec: Recording,
): PersistedState {
  if (itemId.startsWith('custom_')) {
    return updateCustomItem(state, itemId, {
      recordings: [
        ...(state.customItems.find((c) => c.id === itemId)?.recordings ?? []),
        rec,
      ],
      selectedRecordingId:
        state.customItems.find((c) => c.id === itemId)?.selectedRecordingId ?? rec.id,
    });
  }
  return addRecordingToBuiltin(state, itemId, rec);
}

export function removeRecording(
  state: PersistedState,
  itemId: string,
  recId: string,
): PersistedState {
  if (itemId.startsWith('custom_')) {
    const ci = state.customItems.find((c) => c.id === itemId);
    if (!ci) return state;
    const recordings = ci.recordings.filter((r) => r.id !== recId);
    let selectedRecordingId = ci.selectedRecordingId;
    if (selectedRecordingId === recId) {
      selectedRecordingId = recordings[0]?.id ?? null;
    }
    return updateCustomItem(state, itemId, { recordings, selectedRecordingId });
  }
  return removeRecordingFromBuiltin(state, itemId, recId);
}

export function selectRecording(
  state: PersistedState,
  itemId: string,
  recId: string | null,
): PersistedState {
  if (itemId.startsWith('custom_')) {
    return updateCustomItem(state, itemId, { selectedRecordingId: recId });
  }
  return selectRecordingForBuiltin(state, itemId, recId);
}

export function getRecordingsFor(
  state: PersistedState,
  itemId: string,
): { recordings: Recording[]; selectedId: string | null } {
  if (itemId.startsWith('custom_')) {
    const ci = state.customItems.find((c) => c.id === itemId);
    return {
      recordings: ci?.recordings ?? [],
      selectedId: ci?.selectedRecordingId ?? null,
    };
  }
  const ovr = getOverrides(state, itemId);
  return { recordings: ovr.recordings, selectedId: ovr.selectedRecordingId };
}

/* ---------- file deletion helper ---------- */

export async function deleteFileQuietly(uri: string): Promise<void> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch (e) {
    // best-effort
  }
}
