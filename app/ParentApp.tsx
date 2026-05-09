/**
 * ParentApp — full parent panel: per-item voice recording editor,
 * add custom flashcard, rename category labels.
 */
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  Alert,
  Image,
  ScrollView,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { Audio, AVPlaybackStatus } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';

/**
 * High-quality voice recording options — 44.1 kHz mono AAC at 128 kbps.
 * Mono is plenty for a parent's voice and avoids extra bandwidth/processing.
 */
function buildRecordingOptions(): any {
  const A: any = Audio as any;
  return {
    isMeteringEnabled: true,
    android: {
      extension: '.m4a',
      outputFormat: A.AndroidOutputFormat?.MPEG_4 ?? 2,
      audioEncoder: A.AndroidAudioEncoder?.AAC ?? 3,
      sampleRate: 44100,
      numberOfChannels: 1,
      bitRate: 128000,
    },
    ios: {
      extension: '.m4a',
      outputFormat: A.IOSOutputFormat?.MPEG4AAC ?? 'aac ',
      audioQuality: A.IOSAudioQuality?.HIGH ?? 0x60,
      sampleRate: 44100,
      numberOfChannels: 1,
      bitRate: 128000,
      linearPCMBitDepth: 16,
      linearPCMIsBigEndian: false,
      linearPCMIsFloat: false,
    },
    web: { mimeType: 'audio/webm', bitsPerSecond: 128000 },
  };
}

import { AudioAssets, ImageAssets } from './AssetMap';
import {
  CategoryId,
  PersistedState,
  buildItemsForCategory,
  MergedItem,
  Recording,
  uuid,
  RECORDINGS_DIR,
  IMAGES_DIR,
  addRecording,
  removeRecording,
  selectRecording,
  addCustomItem,
  removeCustomItem,
  setCategoryLabel,
  getRecordingsFor,
  deleteFileQuietly,
  setItemImage,
  setItemLabel,
  setItemCaption,
  deleteItem,
  unhideItem,
  resetItemToDefault,
  setLanguage,
  SUPPORTED_LANGUAGES,
  LanguageCode,
} from './state';
import { styles as appStyles, useDevice } from './App';

type ParentScreen =
  | { kind: 'home' }
  | { kind: 'category'; cat: CategoryId }
  | { kind: 'item'; itemId: string; cat: CategoryId }
  | { kind: 'add'; cat: CategoryId | null }
  | { kind: 'settings' };

type Props = {
  state: PersistedState;
  persist: (next: PersistedState) => Promise<void>;
  onExit: () => void;
};

const CATS: { id: CategoryId; emoji: string; color: string }[] = [
  { id: 'letters', emoji: 'A',  color: '#FF5722' },
  { id: 'numbers', emoji: '1',  color: '#2196F3' },
  { id: 'animals', emoji: '🐾', color: '#4CAF50' },
  { id: 'colors',  emoji: '🎨', color: '#E91E63' },
];

export function ParentApp({ state, persist, onExit }: Props) {
  const { width, height, isLandscape, rs } = useDevice();
  const [screen, setScreen] = useState<ParentScreen>({ kind: 'home' });

  if (screen.kind === 'category') {
    return (
      <CategoryView
        cat={screen.cat}
        state={state}
        onBack={() => setScreen({ kind: 'home' })}
        onOpenItem={(itemId) => setScreen({ kind: 'item', itemId, cat: screen.cat })}
        onAddCustom={() => setScreen({ kind: 'add', cat: screen.cat })}
        persist={persist}
      />
    );
  }
  if (screen.kind === 'item') {
    return (
      <ItemEditor
        itemId={screen.itemId}
        cat={screen.cat}
        state={state}
        persist={persist}
        onBack={() => setScreen({ kind: 'category', cat: screen.cat })}
      />
    );
  }
  if (screen.kind === 'add') {
    return (
      <AddCustomItem
        defaultCat={screen.cat}
        state={state}
        persist={persist}
        onBack={() =>
          screen.cat
            ? setScreen({ kind: 'category', cat: screen.cat })
            : setScreen({ kind: 'home' })
        }
      />
    );
  }
  if (screen.kind === 'settings') {
    return (
      <Settings
        state={state}
        persist={persist}
        onBack={() => setScreen({ kind: 'home' })}
      />
    );
  }

  // HOME
  const tileW = isLandscape ? Math.min(width * 0.40, 360) : Math.min(width * 0.43, 320);
  const tileH = tileW / (isLandscape ? 1.6 : 1.25);
  const iconSize = rs(38, 50);
  const catTextSize = rs(16, 22);

  return (
    <View style={[appStyles.container, { backgroundColor: '#f3f4f6' }]}>
      <TouchableOpacity style={appStyles.backBtn} onPress={onExit}>
        <Text style={appStyles.backBtnText}>↩ Wyjdź</Text>
      </TouchableOpacity>

      <Text style={[appStyles.title, { fontSize: rs(18, 24) }]}>Panel Rodzica 👩‍💻</Text>
      <Text style={[appStyles.subtitle, { fontSize: rs(12, 15) }]}>
        Wybierz kategorię żeby nagrać własny głos do każdego obrazka.
      </Text>

      <View style={[appStyles.gridContainer, { gap: isLandscape ? 16 : 12 }]}>
        {CATS.map((c) => {
          const label = state.categoryLabels[c.id];
          const count = buildItemsForCategory(c.id, state, state.language).length;
          return (
            <TouchableOpacity
              key={c.id}
              style={[appStyles.categoryBtn, { backgroundColor: c.color, width: tileW, height: tileH }]}
              onPress={() => setScreen({ kind: 'category', cat: c.id })}
            >
              <View style={appStyles.tileBg}>
                <Text style={[appStyles.categoryIcon, { fontSize: iconSize }]}>{c.emoji}</Text>
                <Text style={[appStyles.categoryText, { fontSize: catTextSize }]}>{label}</Text>
                <Text style={{ color: '#fff', fontSize: rs(12, 15) }}>{count} obrazków</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={{ flexDirection: 'row', gap: 14, marginTop: 18, flexWrap: 'wrap', justifyContent: 'center' }}>
        <TouchableOpacity
          style={[appStyles.menuBtn, { backgroundColor: '#FF9800', paddingVertical: 10, paddingHorizontal: 20 }]}
          onPress={() => setScreen({ kind: 'settings' })}
        >
          <Text style={[appStyles.menuBtnText, { fontSize: rs(15, 20) }]}>⚙️ Ustawienia</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[appStyles.menuBtn, { backgroundColor: '#9C27B0', paddingVertical: 10, paddingHorizontal: 20 }]}
          onPress={() => setScreen({ kind: 'add', cat: null })}
        >
          <Text style={[appStyles.menuBtnText, { fontSize: rs(15, 20) }]}>➕ Dodaj swój</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ============================================================
   CATEGORY VIEW — list items, tap one to edit recordings
============================================================ */

function CategoryView({
  cat,
  state,
  persist,
  onBack,
  onOpenItem,
  onAddCustom,
}: {
  cat: CategoryId;
  state: PersistedState;
  persist: (s: PersistedState) => Promise<void>;
  onBack: () => void;
  onOpenItem: (itemId: string) => void;
  onAddCustom: () => void;
}) {
  const { rs } = useDevice();
  const items = useMemo(() => buildItemsForCategory(cat, state, state.language, { includeHidden: true }), [cat, state]);
  const label = state.categoryLabels[cat];

  const onLongPressDelete = useCallback(
    (item: MergedItem) => {
      if (!item.isCustom) return;
      Alert.alert(
        'Usunąć?',
        `Usunąć "${item.primary}" wraz ze wszystkimi nagraniami?`,
        [
          { text: 'Anuluj', style: 'cancel' },
          {
            text: 'Usuń',
            style: 'destructive',
            onPress: async () => {
              const ci = state.customItems.find((c) => c.id === item.id);
              if (ci) {
                await deleteFileQuietly(ci.imageUri);
                for (const r of ci.recordings) await deleteFileQuietly(r.uri);
              }
              await persist(removeCustomItem(state, item.id));
            },
          },
        ],
      );
    },
    [state, persist],
  );

  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const cols = isLandscape ? Math.floor(width / 160) : Math.floor(width / 150);
  const cellSize = Math.min(Math.floor((width - 32 - (cols - 1) * 12) / cols), 160);

  return (
    <View style={[appStyles.container, { backgroundColor: '#f3f4f6', alignItems: 'stretch' }]}>
      <TouchableOpacity style={appStyles.backBtn} onPress={onBack}>
        <Text style={appStyles.backBtnText}>↩ Wróć</Text>
      </TouchableOpacity>

      <Text style={[appStyles.title, { marginTop: 60, fontSize: rs(18, 24) }]}>{label}</Text>

      <ScrollView contentContainerStyle={parentStyles.gridScroll}>
        <TouchableOpacity
          style={[parentStyles.gridCell, { backgroundColor: '#9C27B0', width: cellSize, height: cellSize + 20 }]}
          onPress={onAddCustom}
        >
          <Text style={{ fontSize: Math.min(cellSize * 0.35, 54), color: '#fff' }}>➕</Text>
          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>Dodaj swój</Text>
        </TouchableOpacity>

        {items.map((it) => {
          const { recordings, selectedId } = getRecordingsFor(state, it.id);
          const hasCustom = !!selectedId;
          const isHidden = !it.isCustom && !!state.itemOverrides[it.id]?.hidden;
          const img =
            it.imageSource?.__builtinImage
              ? ImageAssets[it.imageSource.__builtinImage]
              : it.imageSource;
          return (
            <TouchableOpacity
              key={it.id}
              style={[
                parentStyles.gridCell,
                { width: cellSize, height: cellSize + 20 },
                cat === 'colors' && { backgroundColor: it.hex || '#ccc' },
                isHidden && { opacity: 0.4 },
              ]}
              onPress={() => onOpenItem(it.id)}
              onLongPress={() => onLongPressDelete(it)}
            >
              {cat === 'colors' ? (
                <Text
                  style={{
                    color: '#fff',
                    fontSize: 22,
                    fontWeight: 'bold',
                    textShadowColor: 'rgba(0,0,0,0.6)',
                    textShadowRadius: 4,
                  }}
                >
                  {it.primary}
                </Text>
              ) : img ? (
                <Image source={img} style={parentStyles.thumb} resizeMode="contain" />
              ) : (
                <Text style={{ fontSize: 32, fontWeight: 'bold' }}>{it.primary}</Text>
              )}
              <Text style={parentStyles.cellCaption} numberOfLines={1}>
                {it.primary}
              </Text>
              <View style={parentStyles.badgeRow}>
                {isHidden && <Text style={parentStyles.badgeHidden}>🙈 ukryta</Text>}
                {hasCustom && <Text style={parentStyles.badgeMine}>🎙 mój głos</Text>}
                {recordings.length > 0 && (
                  <Text style={parentStyles.badgeCount}>{recordings.length}</Text>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

/* ============================================================
   ITEM EDITOR — list/record/play/delete/select recording variants
============================================================ */

function ItemEditor({
  itemId,
  cat,
  state,
  persist,
  onBack,
}: {
  itemId: string;
  cat: CategoryId;
  state: PersistedState;
  persist: (s: PersistedState) => Promise<void>;
  onBack: () => void;
}) {
  const item = useMemo(() => {
    const all = buildItemsForCategory(cat, state, state.language, { includeHidden: true });
    return all.find((x) => x.id === itemId);
  }, [cat, state, itemId]);

  const { recordings, selectedId } = getRecordingsFor(state, itemId);

  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recElapsed, setRecElapsed] = useState(0);
  const recTimerRef = useRef<any>(null);

  const [playingId, setPlayingId] = useState<string | null>(null);
  const playSoundRef = useRef<Audio.Sound | null>(null);
  const [variantsExpanded, setVariantsExpanded] = useState(false);

  // Text-edit local state — synced to current item, flushed on blur
  const [labelDraft, setLabelDraft] = useState(item?.primary ?? '');
  const [captionDraft, setCaptionDraft] = useState(item?.caption ?? '');
  useEffect(() => {
    setLabelDraft(item?.primary ?? '');
    setCaptionDraft(item?.caption ?? '');
  }, [item?.primary, item?.caption]);

  const isCustom = itemId.startsWith('custom_');
  const ovr = !isCustom ? state.itemOverrides[itemId] : undefined;
  const hasImageOverride = !isCustom && !!ovr?.imageUri;
  const hasLabelOverride = !isCustom && !!(ovr?.customLabel || ovr?.customCaption);
  const isHidden = !isCustom && !!ovr?.hidden;

  useEffect(() => {
    return () => {
      if (recording) recording.stopAndUnloadAsync().catch(() => {});
      if (playSoundRef.current) playSoundRef.current.unloadAsync().catch(() => {});
      if (recTimerRef.current) clearInterval(recTimerRef.current);
    };
  }, [recording]);

  const pickImage = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Brak dostępu', 'Włącz uprawnienia do galerii.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (result.canceled || !result.assets?.[0]) return;
    const src = result.assets[0].uri;
    const ext = src.split('.').pop()?.split('?')[0] || 'jpg';
    const dest = `${IMAGES_DIR}img_${uuid()}.${ext}`;
    try {
      await FileSystem.copyAsync({ from: src, to: dest });
      // delete previous override file if any
      if (hasImageOverride && ovr?.imageUri) await deleteFileQuietly(ovr.imageUri);
      await persist(setItemImage(state, itemId, dest));
    } catch (e) {
      console.warn('pickImage', e);
    }
  }, [state, persist, itemId, hasImageOverride, ovr?.imageUri]);

  const takePhoto = useCallback(async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Brak dostępu', 'Włącz uprawnienia do aparatu.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.85,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (result.canceled || !result.assets?.[0]) return;
    const src = result.assets[0].uri;
    const ext = src.split('.').pop()?.split('?')[0] || 'jpg';
    const dest = `${IMAGES_DIR}img_${uuid()}.${ext}`;
    try {
      await FileSystem.copyAsync({ from: src, to: dest });
      if (hasImageOverride && ovr?.imageUri) await deleteFileQuietly(ovr.imageUri);
      await persist(setItemImage(state, itemId, dest));
    } catch (e) {
      console.warn('takePhoto', e);
    }
  }, [state, persist, itemId, hasImageOverride, ovr?.imageUri]);

  const resetImage = useCallback(async () => {
    if (!hasImageOverride) return;
    if (ovr?.imageUri) await deleteFileQuietly(ovr.imageUri);
    await persist(setItemImage(state, itemId, null));
  }, [state, persist, itemId, hasImageOverride, ovr?.imageUri]);

  const flushLabel = useCallback(async () => {
    const v = labelDraft.trim();
    if (v === (item?.primary ?? '')) return;
    await persist(setItemLabel(state, itemId, v || null));
  }, [labelDraft, item?.primary, state, persist, itemId]);

  const flushCaption = useCallback(async () => {
    if (isCustom) return;
    const v = captionDraft.trim();
    if (v === (item?.caption ?? '')) return;
    await persist(setItemCaption(state, itemId, v || null));
  }, [captionDraft, item?.caption, isCustom, state, persist, itemId]);

  const onDeleteItem = useCallback(() => {
    Alert.alert(
      isCustom ? 'Usunąć fiszkę?' : 'Ukryć tę fiszkę?',
      isCustom
        ? 'Fiszka i wszystkie nagrania zostaną usunięte na stałe.'
        : 'Fiszka zniknie z trybu dziecka. Możesz ją przywrócić wracając do domyślnych.',
      [
        { text: 'Anuluj', style: 'cancel' },
        {
          text: isCustom ? 'Usuń' : 'Ukryj',
          style: 'destructive',
          onPress: async () => {
            if (isCustom) {
              const ci = state.customItems.find((c) => c.id === itemId);
              if (ci) {
                await deleteFileQuietly(ci.imageUri);
                for (const r of ci.recordings) await deleteFileQuietly(r.uri);
              }
            }
            await persist(deleteItem(state, itemId));
            onBack();
          },
        },
      ],
    );
  }, [isCustom, state, persist, itemId, onBack]);

  const onResetDefault = useCallback(() => {
    Alert.alert('Przywrócić oryginał?', 'Usuwa zmiany obrazka, podpisu i nagrań.', [
      { text: 'Anuluj', style: 'cancel' },
      {
        text: 'Przywróć',
        onPress: async () => {
          if (ovr?.imageUri) await deleteFileQuietly(ovr.imageUri);
          for (const r of ovr?.recordings ?? []) await deleteFileQuietly(r.uri);
          await persist(resetItemToDefault(state, itemId));
        },
      },
    ]);
  }, [state, persist, itemId, ovr]);

  const startRecording = useCallback(async () => {
    try {
      // Free audio focus first — any playback would block the mic.
      if (playSoundRef.current) {
        try { await playSoundRef.current.unloadAsync(); } catch {}
        playSoundRef.current = null;
        setPlayingId(null);
      }

      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Brak dostępu', 'Włącz uprawnienie do mikrofonu w ustawieniach.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
        interruptionModeAndroid: 1,
        interruptionModeIOS: 1,
      } as any);

      const rec = await Audio.Recording.createAsync(
        buildRecordingOptions(),
      );
      setRecording(rec.recording);
      setIsRecording(true);
      setRecElapsed(0);
      recTimerRef.current = setInterval(() => setRecElapsed((s) => s + 1), 1000);
    } catch (e: any) {
      console.error('startRecording error', e);
      Alert.alert('Błąd nagrywania', String(e?.message || e));
    }
  }, []);

  const stopRecording = useCallback(async () => {
    if (!recording) return;
    try {
      if (recTimerRef.current) clearInterval(recTimerRef.current);
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      setIsRecording(false);
      if (!uri) return;

      // Move to persistent dir
      const id = uuid();
      const ext = uri.split('.').pop() || 'm4a';
      const dest = `${RECORDINGS_DIR}${itemId}_${id}.${ext}`;
      try {
        await FileSystem.moveAsync({ from: uri, to: dest });
      } catch {
        await FileSystem.copyAsync({ from: uri, to: dest });
      }

      // Restore audio mode for playback
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
        } as any);
      } catch {}

      const rec: Recording = {
        id,
        uri: dest,
        createdAt: Date.now(),
        label: `Nagranie ${recordings.length + 1}`,
      };
      await persist(addRecording(state, itemId, rec));
      setVariantsExpanded(true);
    } catch (e: any) {
      console.error('stopRecording error', e);
      Alert.alert('Błąd', String(e?.message || e));
    }
  }, [recording, itemId, recordings.length, state, persist]);

  const playRecording = useCallback(async (r: Recording) => {
    try {
      if (playSoundRef.current) {
        await playSoundRef.current.unloadAsync();
        playSoundRef.current = null;
      }
      setPlayingId(r.id);
      const { sound } = await Audio.Sound.createAsync({ uri: r.uri }, { shouldPlay: true });
      playSoundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((s: AVPlaybackStatus) => {
        if (s.isLoaded && s.didJustFinish) {
          setPlayingId(null);
          sound.unloadAsync().catch(() => {});
          if (playSoundRef.current === sound) playSoundRef.current = null;
        }
      });
    } catch (e) {
      console.warn(e);
      setPlayingId(null);
    }
  }, []);

  const playBuiltin = useCallback(async () => {
    if (!item?.builtinAudioKey) return;
    const src = AudioAssets[item.builtinAudioKey];
    if (!src) return;
    try {
      if (playSoundRef.current) {
        await playSoundRef.current.unloadAsync();
        playSoundRef.current = null;
      }
      setPlayingId('builtin');
      const { sound } = await Audio.Sound.createAsync(src, { shouldPlay: true });
      playSoundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((s: AVPlaybackStatus) => {
        if (s.isLoaded && s.didJustFinish) {
          setPlayingId(null);
          sound.unloadAsync().catch(() => {});
          if (playSoundRef.current === sound) playSoundRef.current = null;
        }
      });
    } catch (e) {
      console.warn(e);
      setPlayingId(null);
    }
  }, [item]);

  const onDelete = useCallback(
    (r: Recording) => {
      Alert.alert('Usunąć nagranie?', r.label || 'Nagranie', [
        { text: 'Anuluj', style: 'cancel' },
        {
          text: 'Usuń',
          style: 'destructive',
          onPress: async () => {
            await deleteFileQuietly(r.uri);
            await persist(removeRecording(state, itemId, r.id));
          },
        },
      ]);
    },
    [state, persist, itemId],
  );

  const onSelect = useCallback(
    async (recId: string | null) => {
      await persist(selectRecording(state, itemId, recId));
    },
    [state, persist, itemId],
  );

  const { width, height, isLandscape, rs } = useDevice();
  const heroH = isLandscape ? Math.min(height * 0.42, 180) : Math.min(height * 0.28, 220);

  if (!item) {
    return (
      <View style={[appStyles.container, { backgroundColor: '#f3f4f6' }]}>
        <TouchableOpacity style={appStyles.backBtn} onPress={onBack}>
          <Text style={appStyles.backBtnText}>↩ Wróć</Text>
        </TouchableOpacity>
        <Text style={appStyles.title}>Nie znaleziono.</Text>
      </View>
    );
  }

  const img =
    item.imageSource?.__builtinImage
      ? ImageAssets[item.imageSource.__builtinImage]
      : item.imageSource;

  return (
    <View style={[appStyles.container, { backgroundColor: '#f3f4f6', alignItems: 'stretch' }]}>
      <TouchableOpacity style={appStyles.backBtn} onPress={onBack}>
        <Text style={appStyles.backBtnText}>↩ Wróć</Text>
      </TouchableOpacity>

      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 70, alignItems: 'center' }}>
        <View style={[parentStyles.heroCard, { height: heroH }, cat === 'colors' && { backgroundColor: item.hex || '#fff' }]}>
          {cat === 'colors' ? (
            <Text style={[appStyles.text, { color: '#fff', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 6 }]}>
              {item.primary}
            </Text>
          ) : img ? (
            <Image source={img} style={parentStyles.heroImg} resizeMode="contain" />
          ) : (
            <Text style={appStyles.text}>{item.primary}</Text>
          )}
          {hasImageOverride && (
            <Text style={parentStyles.overrideTag}>🖼 zmieniony</Text>
          )}
        </View>

        {/* Image controls — hidden for color items (they have no image) */}
        {cat !== 'colors' && (
          <View style={parentStyles.imgActions}>
            <TouchableOpacity style={[parentStyles.smallBtn, { backgroundColor: '#2196F3' }]} onPress={pickImage}>
              <Text style={parentStyles.smallBtnText}>📷 Galeria</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[parentStyles.smallBtn, { backgroundColor: '#673AB7' }]} onPress={takePhoto}>
              <Text style={parentStyles.smallBtnText}>📸 Aparat</Text>
            </TouchableOpacity>
            {hasImageOverride && (
              <TouchableOpacity style={[parentStyles.smallBtn, { backgroundColor: '#9E9E9E' }]} onPress={resetImage}>
                <Text style={parentStyles.smallBtnText}>↺ Oryginał</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Text editing — label always; caption only for built-ins */}
        <Text style={parentStyles.fieldLabel}>Tekst (co dziecko zobaczy):</Text>
        <TextInput
          style={[parentStyles.textInput, { width: '100%', maxWidth: 600 }]}
          value={labelDraft}
          onChangeText={setLabelDraft}
          onBlur={flushLabel}
          maxLength={60}
        />
        {!isCustom && cat !== 'colors' && (
          <>
            <Text style={parentStyles.fieldLabel}>Podpis (pełne zdanie):</Text>
            <TextInput
              style={[parentStyles.textInput, { width: '100%', maxWidth: 600 }]}
              value={captionDraft}
              onChangeText={setCaptionDraft}
              onBlur={flushCaption}
              maxLength={120}
            />
          </>
        )}

        {/* Built-in audio row */}
        {item.builtinAudioKey && (
          <View style={parentStyles.recRow}>
            <Text style={parentStyles.recName}>🤖 Domyślny głos (TTS)</Text>
            <View style={parentStyles.recButtons}>
              <TouchableOpacity style={parentStyles.iconBtn} onPress={playBuiltin}>
                <Text style={parentStyles.iconBtnText}>
                  {playingId === 'builtin' ? '⏸' : '▶'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[parentStyles.iconBtn, !selectedId && parentStyles.iconBtnSelected]}
                onPress={() => onSelect(null)}
              >
                <Text style={[parentStyles.iconBtnText, !selectedId && { color: '#fff' }]}>
                  {!selectedId ? '✓ wybrane' : 'wybierz'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Recordings — collapsible */}
        {recordings.length > 0 && (
          <>
            <TouchableOpacity
              style={parentStyles.expandHeader}
              onPress={() => setVariantsExpanded((v) => !v)}
              activeOpacity={0.7}
            >
              <Text style={parentStyles.expandHeaderText}>
                🎙 Twoje nagrania ({recordings.length})
                {selectedId && recordings.find((r) => r.id === selectedId)
                  ? ` · aktywne: ${recordings.find((r) => r.id === selectedId)!.label}`
                  : ''}
              </Text>
              <Text style={parentStyles.expandChevron}>{variantsExpanded ? '▾' : '▸'}</Text>
            </TouchableOpacity>

            {variantsExpanded &&
              recordings.map((r) => {
                const isSel = r.id === selectedId;
                const playing = playingId === r.id;
                return (
                  <View key={r.id} style={parentStyles.recRow}>
                    <Text style={parentStyles.recName} numberOfLines={1}>
                      🎙 {r.label}
                    </Text>
                    <View style={parentStyles.recButtons}>
                      <TouchableOpacity
                        style={parentStyles.iconBtn}
                        onPress={() => playRecording(r)}
                      >
                        <Text style={parentStyles.iconBtnText}>{playing ? '⏸' : '▶'}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          parentStyles.iconBtn,
                          isSel && parentStyles.iconBtnSelected,
                        ]}
                        onPress={() => onSelect(r.id)}
                      >
                        <Text
                          style={[
                            parentStyles.iconBtnText,
                            isSel && { color: '#fff' },
                          ]}
                        >
                          {isSel ? '✓ wybrane' : 'wybierz'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[parentStyles.iconBtn, parentStyles.deleteBtn]}
                        onPress={() => onDelete(r)}
                      >
                        <Text style={[parentStyles.iconBtnText, { color: '#fff' }]}>
                          🗑
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
          </>
        )}

        {/* Record button */}
        <TouchableOpacity
          style={[
            parentStyles.recordBtn,
            { backgroundColor: isRecording ? '#D32F2F' : '#4CAF50' },
          ]}
          onPress={isRecording ? stopRecording : startRecording}
        >
          <Text style={parentStyles.recordBtnText}>
            {isRecording ? `⏹ Zatrzymaj (${recElapsed}s)` : '🎙 Nagraj nowy wariant'}
          </Text>
        </TouchableOpacity>

        {/* Danger zone */}
        <View style={parentStyles.dangerZone}>
          {!isCustom && (hasImageOverride || hasLabelOverride || recordings.length > 0 || isHidden) && (
            <TouchableOpacity
              style={[parentStyles.smallBtn, { backgroundColor: '#9E9E9E', minWidth: 200 }]}
              onPress={onResetDefault}
            >
              <Text style={parentStyles.smallBtnText}>↺ Przywróć oryginał</Text>
            </TouchableOpacity>
          )}
          {isHidden ? (
            <TouchableOpacity
              style={[parentStyles.smallBtn, { backgroundColor: '#4CAF50', minWidth: 200 }]}
              onPress={async () => { await persist(unhideItem(state, itemId)); }}
            >
              <Text style={parentStyles.smallBtnText}>👁 Pokaż ponownie</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[parentStyles.smallBtn, { backgroundColor: '#D32F2F', minWidth: 200 }]}
              onPress={onDeleteItem}
            >
              <Text style={parentStyles.smallBtnText}>
                🗑 {isCustom ? 'Usuń fiszkę' : 'Ukryj fiszkę'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

/* ============================================================
   ADD CUSTOM ITEM — image picker + caption + record + category
============================================================ */

function AddCustomItem({
  defaultCat,
  state,
  persist,
  onBack,
}: {
  defaultCat: CategoryId | null;
  state: PersistedState;
  persist: (s: PersistedState) => Promise<void>;
  onBack: () => void;
}) {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [cat, setCat] = useState<CategoryId>(defaultCat || 'animals');

  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recElapsed, setRecElapsed] = useState(0);
  const recTimerRef = useRef<any>(null);

  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [playingId, setPlayingId] = useState<string | null>(null);
  const playSoundRef = useRef<Audio.Sound | null>(null);

  const [busy, setBusy] = useState(false);
  const [variantsExpanded, setVariantsExpanded] = useState(false);

  useEffect(() => {
    return () => {
      if (recording) recording.stopAndUnloadAsync().catch(() => {});
      if (playSoundRef.current) playSoundRef.current.unloadAsync().catch(() => {});
      if (recTimerRef.current) clearInterval(recTimerRef.current);
    };
  }, [recording]);

  const pickImage = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Brak dostępu', 'Włącz uprawnienia do galerii.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (result.canceled || !result.assets?.[0]) return;
    const src = result.assets[0].uri;

    // Persist file inside app's document dir so it survives reboots
    const ext = src.split('.').pop()?.split('?')[0] || 'jpg';
    const dest = `${IMAGES_DIR}img_${uuid()}.${ext}`;
    try {
      await FileSystem.copyAsync({ from: src, to: dest });
      setImageUri(dest);
    } catch (e) {
      console.warn(e);
      setImageUri(src);
    }
  }, []);

  const takePhoto = useCallback(async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Brak dostępu', 'Włącz uprawnienia do aparatu.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.85,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (result.canceled || !result.assets?.[0]) return;
    const src = result.assets[0].uri;
    const ext = src.split('.').pop()?.split('?')[0] || 'jpg';
    const dest = `${IMAGES_DIR}img_${uuid()}.${ext}`;
    try {
      await FileSystem.copyAsync({ from: src, to: dest });
      setImageUri(dest);
    } catch (e) {
      setImageUri(src);
    }
  }, []);

  const startRecording = useCallback(async () => {
    try {
      if (playSoundRef.current) {
        try { await playSoundRef.current.unloadAsync(); } catch {}
        playSoundRef.current = null;
        setPlayingId(null);
      }
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Brak dostępu', 'Włącz uprawnienie do mikrofonu.');
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
        interruptionModeAndroid: 1,
        interruptionModeIOS: 1,
      } as any);
      const rec = await Audio.Recording.createAsync(buildRecordingOptions());
      setRecording(rec.recording);
      setIsRecording(true);
      setRecElapsed(0);
      recTimerRef.current = setInterval(() => setRecElapsed((s) => s + 1), 1000);
    } catch (e: any) {
      console.error('startRecording error', e);
      Alert.alert('Błąd nagrywania', String(e?.message || e));
    }
  }, []);

  const stopRecording = useCallback(async () => {
    if (!recording) return;
    try {
      if (recTimerRef.current) clearInterval(recTimerRef.current);
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      setIsRecording(false);
      if (!uri) return;

      const id = uuid();
      const ext = uri.split('.').pop() || 'm4a';
      const dest = `${RECORDINGS_DIR}new_${id}.${ext}`;
      try {
        await FileSystem.moveAsync({ from: uri, to: dest });
      } catch {
        await FileSystem.copyAsync({ from: uri, to: dest });
      }
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
        } as any);
      } catch {}
      const rec: Recording = {
        id,
        uri: dest,
        createdAt: Date.now(),
        label: `Nagranie ${recordings.length + 1}`,
      };
      setRecordings((rs) => [...rs, rec]);
      setSelectedId((cur) => cur ?? id);
      setVariantsExpanded(true);
    } catch (e: any) {
      console.error('stopRecording error', e);
      Alert.alert('Błąd', String(e?.message || e));
    }
  }, [recording, recordings.length]);

  const playRec = useCallback(async (r: Recording) => {
    try {
      if (playSoundRef.current) {
        await playSoundRef.current.unloadAsync();
        playSoundRef.current = null;
      }
      setPlayingId(r.id);
      const { sound } = await Audio.Sound.createAsync({ uri: r.uri }, { shouldPlay: true });
      playSoundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((s: AVPlaybackStatus) => {
        if (s.isLoaded && s.didJustFinish) {
          setPlayingId(null);
          sound.unloadAsync().catch(() => {});
          if (playSoundRef.current === sound) playSoundRef.current = null;
        }
      });
    } catch (e) {
      console.warn(e);
      setPlayingId(null);
    }
  }, []);

  const onSave = useCallback(async () => {
    if (!imageUri) {
      Alert.alert('Brakuje zdjęcia', 'Wybierz zdjęcie z galerii lub zrób własne.');
      return;
    }
    if (!label.trim()) {
      Alert.alert('Brakuje podpisu', 'Wpisz słowo które dziecko ma usłyszeć.');
      return;
    }
    if (recordings.length === 0) {
      Alert.alert(
        'Brakuje nagrania',
        'Nagraj swój głos żeby było co odtworzyć w trybie dziecka.',
      );
      return;
    }
    setBusy(true);
    try {
      const item = {
        id: 'custom_' + uuid(),
        category: cat,
        imageUri,
        label: label.trim(),
        recordings,
        selectedRecordingId: selectedId || recordings[0].id,
        createdAt: Date.now(),
      };
      await persist(addCustomItem(state, item));
      onBack();
    } finally {
      setBusy(false);
    }
  }, [imageUri, label, recordings, selectedId, cat, state, persist, onBack]);

  return (
    <View style={[appStyles.container, { backgroundColor: '#f3f4f6', alignItems: 'stretch' }]}>
      <TouchableOpacity style={appStyles.backBtn} onPress={onBack}>
        <Text style={appStyles.backBtnText}>↩ Wróć</Text>
      </TouchableOpacity>

      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 68 }}>
        <Text style={[appStyles.title, { fontSize: 20 }]}>Dodaj swoją fiszkę</Text>

        {/* Image */}
        <View style={[parentStyles.heroCard, { height: 160 }]}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={parentStyles.heroImg} resizeMode="contain" />
          ) : (
            <Text style={{ color: '#999', fontSize: 16 }}>Brak zdjęcia</Text>
          )}
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16 }}>
          <TouchableOpacity style={[appStyles.menuBtn, { backgroundColor: '#2196F3', minWidth: 0 }]} onPress={pickImage}>
            <Text style={appStyles.menuBtnText}>📷 Galeria</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[appStyles.menuBtn, { backgroundColor: '#673AB7', minWidth: 0 }]} onPress={takePhoto}>
            <Text style={appStyles.menuBtnText}>📸 Zdjęcie</Text>
          </TouchableOpacity>
        </View>

        {/* Label */}
        <Text style={parentStyles.fieldLabel}>Podpis (co dziecko usłyszy):</Text>
        <TextInput
          style={parentStyles.textInput}
          value={label}
          onChangeText={setLabel}
          placeholder="np. Babcia / Auto / Tata"
          maxLength={40}
        />

        {/* Category picker */}
        <Text style={parentStyles.fieldLabel}>Kategoria:</Text>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {CATS.map((c) => (
            <TouchableOpacity
              key={c.id}
              style={[
                parentStyles.catChip,
                cat === c.id && { backgroundColor: c.color, borderColor: c.color },
              ]}
              onPress={() => setCat(c.id)}
            >
              <Text style={[parentStyles.catChipText, cat === c.id && { color: '#fff' }]}>
                {c.emoji} {state.categoryLabels[c.id]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Recordings — collapsible */}
        <Text style={parentStyles.fieldLabel}>Nagrania:</Text>
        {recordings.length > 0 && (
          <>
            <TouchableOpacity
              style={parentStyles.expandHeader}
              onPress={() => setVariantsExpanded((v) => !v)}
              activeOpacity={0.7}
            >
              <Text style={parentStyles.expandHeaderText}>
                🎙 {recordings.length} nagran
                {recordings.length === 1 ? 'ie' : 'ia'}
                {selectedId && recordings.find((r) => r.id === selectedId)
                  ? ` · aktywne: ${recordings.find((r) => r.id === selectedId)!.label}`
                  : ''}
              </Text>
              <Text style={parentStyles.expandChevron}>{variantsExpanded ? '▾' : '▸'}</Text>
            </TouchableOpacity>

            {variantsExpanded &&
              recordings.map((r) => (
                <View key={r.id} style={parentStyles.recRow}>
                  <Text style={parentStyles.recName} numberOfLines={1}>
                    🎙 {r.label}
                  </Text>
                  <View style={parentStyles.recButtons}>
                    <TouchableOpacity
                      style={parentStyles.iconBtn}
                      onPress={() => playRec(r)}
                    >
                      <Text style={parentStyles.iconBtnText}>
                        {playingId === r.id ? '⏸' : '▶'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        parentStyles.iconBtn,
                        selectedId === r.id && parentStyles.iconBtnSelected,
                      ]}
                      onPress={() => setSelectedId(r.id)}
                    >
                      <Text
                        style={[
                          parentStyles.iconBtnText,
                          selectedId === r.id && { color: '#fff' },
                        ]}
                      >
                        {selectedId === r.id ? '✓ wybrane' : 'wybierz'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[parentStyles.iconBtn, parentStyles.deleteBtn]}
                      onPress={async () => {
                        await deleteFileQuietly(r.uri);
                        setRecordings((rs) => rs.filter((x) => x.id !== r.id));
                        setSelectedId((cur) =>
                          cur === r.id
                            ? recordings.find((x) => x.id !== r.id)?.id ?? null
                            : cur,
                        );
                      }}
                    >
                      <Text style={[parentStyles.iconBtnText, { color: '#fff' }]}>🗑</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
          </>
        )}
        <TouchableOpacity
          style={[
            parentStyles.recordBtn,
            { backgroundColor: isRecording ? '#D32F2F' : '#4CAF50' },
          ]}
          onPress={isRecording ? stopRecording : startRecording}
        >
          <Text style={parentStyles.recordBtnText}>
            {isRecording ? `⏹ Zatrzymaj (${recElapsed}s)` : '🎙 Nagraj wariant'}
          </Text>
        </TouchableOpacity>

        {/* Save */}
        <TouchableOpacity
          style={[
            appStyles.menuBtn,
            { backgroundColor: '#FF9800', marginTop: 20, alignSelf: 'center' },
          ]}
          onPress={onSave}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={appStyles.menuBtnText}>💾 Zapisz fiszkę</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

/* ============================================================
   SETTINGS — rename categories + kiosk lock + PIN
============================================================ */

function Settings({
  state,
  persist,
  onBack,
}: {
  state: PersistedState;
  persist: (s: PersistedState) => Promise<void>;
  onBack: () => void;
}) {
  const [labels, setLabels] = useState({ ...state.categoryLabels });
  const [pin, setPin] = useState(state.pin);
  const [language, setLanguageState] = useState<LanguageCode>(state.language);

  const onSave = async () => {
    let next = state;
    if (language !== state.language) {
      next = setLanguage(next, language);
      // setLanguage already reset categoryLabels to lang defaults; keep them.
    } else {
      (Object.keys(labels) as CategoryId[]).forEach((cat) => {
        const v = (labels[cat] || '').trim();
        if (v) next = setCategoryLabel(next, cat, v);
      });
    }
    next = { ...next, pin: pin.trim() || '1234' };
    await persist(next);
    onBack();
  };

  return (
    <View style={[appStyles.container, { backgroundColor: '#f3f4f6', alignItems: 'stretch' }]}>
      <TouchableOpacity style={appStyles.backBtn} onPress={onBack}>
        <Text style={appStyles.backBtnText}>↩ Wróć</Text>
      </TouchableOpacity>

      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 68 }}>
        <Text style={[appStyles.title, { fontSize: 20 }]}>Ustawienia</Text>

        {/* Language picker */}
        <Text style={parentStyles.fieldLabel}>🌐 Język aplikacji</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {SUPPORTED_LANGUAGES.map((l) => {
            const sel = l.code === language;
            return (
              <TouchableOpacity
                key={l.code}
                style={[
                  parentStyles.catChip,
                  sel && { backgroundColor: '#2196F3', borderColor: '#2196F3' },
                ]}
                onPress={() => setLanguageState(l.code)}
              >
                <Text style={[parentStyles.catChipText, sel && { color: '#fff' }]}>
                  {l.flag}  {l.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {language !== state.language && (
          <Text style={{ color: '#FF9800', fontSize: 13, marginTop: 6 }}>
            ⚠️ Zmiana języka zresetuje nazwy kategorii do ustawień języka.
          </Text>
        )}

        {/* PIN */}
        <Text style={parentStyles.fieldLabel}>🔑 Kod PIN rodzica</Text>
        <TextInput
          style={parentStyles.textInput}
          value={pin}
          onChangeText={setPin}
          placeholder="1234"
          keyboardType="number-pad"
          maxLength={6}
          secureTextEntry
        />

        {/* Category names */}
        <Text style={[parentStyles.fieldLabel, { marginTop: 28 }]}>
          ✏️ Nazwy kategorii
        </Text>
        {CATS.map((c) => (
          <View key={c.id} style={{ marginBottom: 12 }}>
            <Text style={[parentStyles.fieldLabel, { fontSize: 14, color: '#666' }]}>
              {c.emoji} {c.id}
            </Text>
            <TextInput
              style={parentStyles.textInput}
              value={labels[c.id]}
              onChangeText={(v) => setLabels((l) => ({ ...l, [c.id]: v }))}
              maxLength={32}
            />
          </View>
        ))}

        <TouchableOpacity
          style={[
            appStyles.menuBtn,
            { backgroundColor: '#4CAF50', alignSelf: 'center', marginTop: 24 },
          ]}
          onPress={onSave}
        >
          <Text style={appStyles.menuBtnText}>💾 Zapisz</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const parentStyles = StyleSheet.create({
  gridScroll: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    padding: 16,
    gap: 12,
  },
  gridCell: {
    width: 140,
    height: 160,
    backgroundColor: '#fff',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 5,
    padding: 8,
    margin: 4,
  },
  thumb: { width: '85%', height: 95, borderRadius: 10 },
  cellCaption: { marginTop: 4, fontSize: 14, fontWeight: '600', color: '#333' },
  badgeRow: { position: 'absolute', top: 6, right: 6, flexDirection: 'row', gap: 4 },
  badgeMine: {
    fontSize: 11,
    color: '#fff',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
    fontWeight: 'bold',
  },
  badgeHidden: {
    fontSize: 11,
    color: '#fff',
    backgroundColor: '#9E9E9E',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
    fontWeight: 'bold',
  },
  badgeCount: {
    fontSize: 12,
    color: '#fff',
    backgroundColor: '#FF9800',
    width: 22,
    height: 22,
    textAlign: 'center',
    lineHeight: 22,
    borderRadius: 11,
    overflow: 'hidden',
    fontWeight: 'bold',
  },
  heroCard: {
    width: '90%',
    maxWidth: 400,
    height: 220,
    backgroundColor: '#fff',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    alignSelf: 'center',
    marginBottom: 12,
  },
  heroImg: { width: '90%', height: '90%', borderRadius: 16 },
  recRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  recName: { fontSize: 18, fontWeight: '600', color: '#333', flex: 1 },
  recButtons: { flexDirection: 'row', gap: 6 },
  iconBtn: {
    backgroundColor: '#eee',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    minWidth: 50,
    alignItems: 'center',
  },
  iconBtnText: { fontSize: 16, fontWeight: '600', color: '#333' },
  iconBtnSelected: { backgroundColor: '#4CAF50' },
  deleteBtn: { backgroundColor: '#D32F2F' },
  recordBtn: {
    alignSelf: 'center',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 30,
    elevation: 5,
    marginTop: 16,
    minWidth: 240,
    alignItems: 'center',
  },
  recordBtnText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  fieldLabel: { fontSize: 18, fontWeight: '600', color: '#333', marginTop: 16, marginBottom: 6 },
  textInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 18,
  },
  catChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#ccc',
    backgroundColor: '#fff',
  },
  catChipText: { fontSize: 16, fontWeight: '600', color: '#333' },
  expandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  expandHeaderText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  expandChevron: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#666',
    marginLeft: 8,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  switchTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 4 },
  switchSub: { fontSize: 13, color: '#666', lineHeight: 18 },
  switchKnob: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#eee',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  imgActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    marginBottom: 4,
  },
  smallBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: 'center',
    elevation: 2,
  },
  smallBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  overrideTag: {
    position: 'absolute',
    top: 6,
    right: 8,
    fontSize: 11,
    color: '#fff',
    backgroundColor: 'rgba(33,150,243,0.85)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
    fontWeight: 'bold',
  },
  dangerZone: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    width: '100%',
  },
});
