/**
 * Persistent state for parent customizations.
 * Source-of-truth for: per-item voice recordings, custom items, category labels, PIN.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import contentData from './assets/content_data.json';

export type CategoryId = 'letters' | 'numbers' | 'animals' | 'colors';
export type LanguageCode = 'pl' | 'en' | 'de' | 'es' | 'fr' | 'it' | 'uk';

export const SUPPORTED_LANGUAGES: { code: LanguageCode; flag: string; name: string }[] = [
  { code: 'pl', flag: '🇵🇱', name: 'Polski' },
  { code: 'en', flag: '🇬🇧', name: 'English' },
  { code: 'de', flag: '🇩🇪', name: 'Deutsch' },
  { code: 'es', flag: '🇪🇸', name: 'Español' },
  { code: 'fr', flag: '🇫🇷', name: 'Français' },
  { code: 'it', flag: '🇮🇹', name: 'Italiano' },
  { code: 'uk', flag: '🇺🇦', name: 'Українська' },
];

export type Recording = {
  id: string;          // uuid
  uri: string;         // file:// path inside documentDirectory/recordings
  label?: string;      // optional name e.g. "Mama" / "Tata"
  createdAt: number;
};

export type ItemOverrides = {
  recordings: Recording[];
  selectedRecordingId: string | null;   // null → use default TTS
  imageUri?: string | null;             // file:// override for built-in image
  customLabel?: string | null;          // override primary text
  customCaption?: string | null;        // override caption
  hidden?: boolean;                     // hide built-in item from child mode
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
  language: LanguageCode;
};

const STORAGE_KEY = 'tyk_state_v1';

export const DEFAULT_LABELS: CategoryLabels = {
  letters: 'Literki',
  numbers: 'Cyfry',
  animals: 'Zwierzęta',
  colors: 'Kolory',
};

/** Caption template for letter items (e.g. "A jak Arbuz" / "A is for Apple"). */
export const LETTER_TEMPLATES: Record<LanguageCode, (l: string, w: string) => string> = {
  pl: (l, w) => `${l} jak ${w}`,
  en: (l, w) => `${l} is for ${w}`,
  de: (l, w) => `${l} wie ${w}`,
  es: (l, w) => `${l} de ${w}`,
  fr: (l, w) => `${l} comme ${w}`,
  it: (l, w) => `${l} come ${w}`,
  uk: (l, w) => `${l} як ${w}`,
};

/** "Krowa mówi" / "The cow says" — used as caption under the animal image. */
export const ANIMAL_INTRO_TEMPLATES: Record<LanguageCode, (animal: string) => string> = {
  pl: (a) => `${a} mówi`,
  en: (a) => `The ${a.toLowerCase()} says`,
  de: (a) => `${a} macht`,
  es: (a) => `${a} dice`,
  fr: (a) => `${a} fait`,
  it: (a) => `${a} fa`,
  uk: (a) => `${a} говорить`,
};

/** Per-language category names shown in the child menu. */
export const CATEGORY_LABELS_BY_LANG: Record<LanguageCode, CategoryLabels> = {
  pl: { letters: 'Literki',  numbers: 'Cyfry',   animals: 'Zwierzęta', colors: 'Kolory' },
  en: { letters: 'Letters',  numbers: 'Numbers', animals: 'Animals',   colors: 'Colors' },
  de: { letters: 'Buchstaben', numbers: 'Zahlen', animals: 'Tiere',    colors: 'Farben' },
  es: { letters: 'Letras',   numbers: 'Números', animals: 'Animales',  colors: 'Colores' },
  fr: { letters: 'Lettres',  numbers: 'Chiffres', animals: 'Animaux',  colors: 'Couleurs' },
  it: { letters: 'Lettere',  numbers: 'Numeri',  animals: 'Animali',   colors: 'Colori' },
  uk: { letters: 'Літери',   numbers: 'Цифри',   animals: 'Тварини',   colors: 'Кольори' },
};

const DEFAULT_STATE: PersistedState = {
  itemOverrides: {},
  customItems: [],
  categoryLabels: DEFAULT_LABELS,
  pin: '1234',
  kioskEnabled: true,
  language: 'pl',
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

/** Switch UI/audio language. Resets category labels to that language's
 *  defaults (parent can re-edit afterwards). */
export function setLanguage(state: PersistedState, language: LanguageCode): PersistedState {
  const labels = CATEGORY_LABELS_BY_LANG[language] || DEFAULT_LABELS;
  return { ...state, language, categoryLabels: { ...labels } };
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

/**
 * Build merged items for a category in the requested language.
 *
 * The bundled content_data.json now exposes a multi-language schema:
 *   letters: { pl: [...], en: [...], de: [...], ... }
 *   numbers/colors/animals: each entry has `audio: {pl, en, ...}` and
 *   `labels: {pl, en, ...}`.
 *
 * For letters we honour the per-language list (alphabet differs per lang).
 * For numbers/colors/animals the entries are shared across languages —
 * only the audio/label changes.
 */
export function buildItemsForCategory(
  cat: CategoryId,
  state: PersistedState,
  language: LanguageCode = 'pl',
  options: { includeHidden?: boolean } = {},
): MergedItem[] {
  const out: MergedItem[] = [];

  const pickLabel = (rec: any, fallback?: string): string => {
    if (rec?.labels?.[language]) return rec.labels[language];
    if (rec?.labels?.pl) return rec.labels.pl;
    return fallback ?? '';
  };

  // For letters we read content_data.letters[lang]; for everything else
  // a single shared array.
  let sourceArr: any[] = [];
  if (cat === 'letters') {
    const letters = (contentData as any).letters || {};
    sourceArr = letters[language] || letters.pl || [];
  } else {
    sourceArr = (contentData as any)[cat] || [];
  }

  const pickAudioKey = (rec: any): string | null => {
    if (cat === 'letters') return rec.audio || null;
    if (rec.audio && typeof rec.audio === 'object') {
      return rec.audio[language] || rec.audio.pl || null;
    }
    return rec.audio || null;
  };

  const pickPrimary = (rec: any): string => {
    if (cat === 'letters') return rec.letter || '';
    if (cat === 'numbers') return rec.id?.replace('numbers_', '') || pickLabel(rec);
    return pickLabel(rec);
  };

  const pickCaption = (rec: any): string => {
    if (cat === 'letters') {
      const t = LETTER_TEMPLATES[language] || LETTER_TEMPLATES.pl;
      return t(rec.letter, rec.word);
    }
    if (cat === 'animals') {
      const t = ANIMAL_INTRO_TEMPLATES[language] || ANIMAL_INTRO_TEMPLATES.pl;
      return t(pickLabel(rec));
    }
    return pickLabel(rec);
  };

  for (const rec of sourceArr) {
    const ovr = state.itemOverrides[rec.id];
    if (ovr?.hidden && !options.includeHidden) continue;
    const selectedRec = ovr?.recordings.find((r) => r.id === ovr.selectedRecordingId);
    const imageSource = ovr?.imageUri
      ? { uri: ovr.imageUri }
      : rec.filename ? { __builtinImage: rec.filename } : null;
    out.push({
      id: rec.id,
      category: cat,
      isCustom: false,
      primary: ovr?.customLabel?.trim() || pickPrimary(rec),
      caption: ovr?.customCaption?.trim() || pickCaption(rec),
      imageSource,
      customAudioUri: selectedRec?.uri ?? null,
      builtinAudioKey: selectedRec ? null : pickAudioKey(rec),
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

/** Set/clear image override for either built-in or custom item. */
export function setItemImage(
  state: PersistedState,
  itemId: string,
  uri: string | null,
): PersistedState {
  if (itemId.startsWith('custom_')) {
    return updateCustomItem(state, itemId, { imageUri: uri ?? '' });
  }
  return upsertOverride(state, itemId, { imageUri: uri });
}

/** Set/clear primary label override (custom items always have a label). */
export function setItemLabel(
  state: PersistedState,
  itemId: string,
  label: string | null,
): PersistedState {
  if (itemId.startsWith('custom_')) {
    return updateCustomItem(state, itemId, { label: label ?? '' });
  }
  return upsertOverride(state, itemId, { customLabel: label });
}

/** Set/clear caption override (only built-ins have separate captions). */
export function setItemCaption(
  state: PersistedState,
  itemId: string,
  caption: string | null,
): PersistedState {
  if (itemId.startsWith('custom_')) return state;
  return upsertOverride(state, itemId, { customCaption: caption });
}

/** Hide built-in (or fully delete custom) item from rotation. */
export function deleteItem(
  state: PersistedState,
  itemId: string,
): PersistedState {
  if (itemId.startsWith('custom_')) return removeCustomItem(state, itemId);
  return upsertOverride(state, itemId, { hidden: true });
}

/** Restore a built-in item that was previously hidden. */
export function unhideItem(
  state: PersistedState,
  itemId: string,
): PersistedState {
  if (itemId.startsWith('custom_')) return state;
  return upsertOverride(state, itemId, { hidden: false });
}

/** Restore built-in to its default (clears all overrides). */
export function resetItemToDefault(
  state: PersistedState,
  itemId: string,
): PersistedState {
  if (itemId.startsWith('custom_')) return state;
  const next = { ...state.itemOverrides };
  delete next[itemId];
  return { ...state, itemOverrides: next };
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
