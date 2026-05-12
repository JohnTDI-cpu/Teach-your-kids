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
  currentProfile,
} from './state';
import { useApp } from './AppContext';
import { PillButton, RoundButton } from './Buttons';
import { styles as appStyles, useDevice } from './App';

type ParentScreen =
  | { kind: 'home' }
  | { kind: 'category'; cat: CategoryId }
  | { kind: 'item'; itemId: string; cat: CategoryId }
  | { kind: 'add'; cat: CategoryId | null }
  | { kind: 'settings' };

const CATS: { id: CategoryId; emoji: string; color: string }[] = [
  { id: 'letters', emoji: 'A',  color: '#FF5722' },
  { id: 'numbers', emoji: '1',  color: '#2196F3' },
  { id: 'animals', emoji: '🐾', color: '#4CAF50' },
  { id: 'colors',  emoji: '🎨', color: '#E91E63' },
];

export function ParentApp({ onExit }: { onExit: () => void }) {
  const { state, lang, profile, t, tn } = useApp();
  const { width, height, isLandscape, rs } = useDevice();
  const [screen, setScreen] = useState<ParentScreen>({ kind: 'home' });

  if (screen.kind === 'category') {
    return (
      <CategoryView
        cat={screen.cat}
        onBack={() => setScreen({ kind: 'home' })}
        onOpenItem={(itemId) => setScreen({ kind: 'item', itemId, cat: screen.cat })}
        onAddCustom={() => setScreen({ kind: 'add', cat: screen.cat })}
      />
    );
  }
  if (screen.kind === 'item') {
    return (
      <ItemEditor
        itemId={screen.itemId}
        cat={screen.cat}
        onBack={() => setScreen({ kind: 'category', cat: screen.cat })}
      />
    );
  }
  if (screen.kind === 'add') {
    return (
      <AddCustomItem
        defaultCat={screen.cat}
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
      <Settings onBack={() => setScreen({ kind: 'home' })} />
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
        <Text style={appStyles.backBtnText}>{t('exit')}</Text>
      </TouchableOpacity>

      <Text style={[appStyles.title, { fontSize: rs(18, 24) }]}>{t('parent_title')}</Text>
      <Text style={[appStyles.subtitle, { fontSize: rs(12, 15) }]}>
        {t('parent_subtitle')}
      </Text>

      <View style={[appStyles.gridContainer, { gap: isLandscape ? 16 : 12 }]}>
        {CATS.map((c) => {
          const label = profile.categoryLabels[c.id];
          const count = buildItemsForCategory(c.id, state, lang).length;
          return (
            <TouchableOpacity
              key={c.id}
              style={[appStyles.categoryBtn, { backgroundColor: c.color, width: tileW, height: tileH }]}
              onPress={() => setScreen({ kind: 'category', cat: c.id })}
            >
              <View style={appStyles.tileBg}>
                <Text style={[appStyles.categoryIcon, { fontSize: iconSize }]}>{c.emoji}</Text>
                <Text style={[appStyles.categoryText, { fontSize: catTextSize }]}>{label}</Text>
                <Text style={{ color: '#fff', fontSize: rs(12, 15) }}>{tn('count_items', { n: count })}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={{ flexDirection: 'row', gap: 14, marginTop: 18, flexWrap: 'wrap', justifyContent: 'center' }}>
        <PillButton color="orange" label={t('parent_settings')} size="md" onPress={() => setScreen({ kind: 'settings' })} />
        <PillButton color="purple" label={t('add_custom_full')} size="md" onPress={() => setScreen({ kind: 'add', cat: null })} />
      </View>
    </View>
  );
}

/* ============================================================
   CATEGORY VIEW — list items, tap one to edit recordings
============================================================ */

function CategoryView({
  cat,
  onBack,
  onOpenItem,
  onAddCustom,
}: {
  cat: CategoryId;
  onBack: () => void;
  onOpenItem: (itemId: string) => void;
  onAddCustom: () => void;
}) {
  const { state, persist, lang, profile, t } = useApp();
  const { rs } = useDevice();
  const items = useMemo(() => buildItemsForCategory(cat, state, lang, { includeHidden: true }), [cat, state, lang]);
  const label = profile.categoryLabels[cat];

  const onLongPressDelete = useCallback(
    (item: MergedItem) => {
      if (!item.isCustom) return;
      Alert.alert(
        t('delete_custom_title'),
        t('delete_custom_msg'),
        [
          { text: t('cancel'), style: 'cancel' },
          {
            text: t('delete_recording_btn'),
            style: 'destructive',
            onPress: async () => {
              const ci = profile.customItems.find((c) => c.id === item.id);
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
        <Text style={appStyles.backBtnText}>{t('back')}</Text>
      </TouchableOpacity>

      <Text style={[appStyles.title, { marginTop: 60, fontSize: rs(18, 24) }]}>{label}</Text>

      <ScrollView contentContainerStyle={parentStyles.gridScroll}>
        <TouchableOpacity
          style={[parentStyles.gridCell, { backgroundColor: '#9C27B0', width: cellSize, height: cellSize + 20 }]}
          onPress={onAddCustom}
        >
          <Text style={{ fontSize: Math.min(cellSize * 0.35, 54), color: '#fff' }}>➕</Text>
          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>{t('add_custom_short')}</Text>
        </TouchableOpacity>

        {items.map((it) => {
          const { recordings, selectedId } = getRecordingsFor(state, it.id);
          const hasCustom = !!selectedId;
          const isHidden = !it.isCustom && !!profile.itemOverrides[it.id]?.hidden;
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
                {isHidden && <Text style={parentStyles.badgeHidden}>{t('badge_hidden')}</Text>}
                {hasCustom && <Text style={parentStyles.badgeMine}>{t('badge_my_voice')}</Text>}
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
  onBack,
}: {
  itemId: string;
  cat: CategoryId;
  onBack: () => void;
}) {
  const { state, persist, lang, profile, t, tn } = useApp();
  const item = useMemo(() => {
    const all = buildItemsForCategory(cat, state, lang, { includeHidden: true });
    return all.find((x) => x.id === itemId);
  }, [cat, state, lang, itemId]);

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
  const ovr = !isCustom ? profile.itemOverrides[itemId] : undefined;
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
      Alert.alert(t('no_permission_camera_short'), t('no_permission_gallery'));
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
      Alert.alert(t('no_permission_camera_short'), t('no_permission_camera'));
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
      isCustom ? t('delete_custom_title') : t('hide_builtin_title'),
      isCustom
        ? t('delete_custom_msg')
        : t('hide_builtin_msg'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: isCustom ? t('delete_recording_btn') : t('hide_btn'),
          style: 'destructive',
          onPress: async () => {
            if (isCustom) {
              const ci = profile.customItems.find((c) => c.id === itemId);
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
    Alert.alert(t('reset_to_default_title'), t('reset_to_default_msg'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('reset_to_default_btn'),
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
        Alert.alert(t('no_permission_camera_short'), t('no_permission_mic'));
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
      Alert.alert(t('recording_error'), String(e?.message || e));
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
      Alert.alert(t('error_generic'), String(e?.message || e));
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
      Alert.alert(t('delete_recording_title'), r.label || '', [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete_recording_btn'),
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
          <Text style={appStyles.backBtnText}>{t('back')}</Text>
        </TouchableOpacity>
        <Text style={appStyles.title}>{t('item_not_found')}</Text>
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
        <Text style={appStyles.backBtnText}>{t('back')}</Text>
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
            <PillButton color="blue"   size="sm" label={t('image_change_gallery')} onPress={pickImage} />
            <PillButton color="purple" size="sm" label={t('image_change_camera')}  onPress={takePhoto} />
            {hasImageOverride && (
              <PillButton color="gray" size="sm" label={t('image_reset_default')} onPress={resetImage} />
            )}
          </View>
        )}

        {/* Text editing — label always; caption only for built-ins */}
        <Text style={parentStyles.fieldLabel}>{t('text_label_field')}</Text>
        <TextInput
          style={[parentStyles.textInput, { width: '100%', maxWidth: 600 }]}
          value={labelDraft}
          onChangeText={setLabelDraft}
          onBlur={flushLabel}
          maxLength={60}
        />
        {!isCustom && cat !== 'colors' && (
          <>
            <Text style={parentStyles.fieldLabel}>{t('caption_full_field')}</Text>
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
            <Text style={parentStyles.recName}>{t('tts_voice_label')}</Text>
            <View style={parentStyles.recButtons}>
              <RoundButton
                color="blue" size={42}
                label={playingId === 'builtin' ? '⏸' : '▶'}
                onPress={playBuiltin}
              />
              <PillButton
                color={!selectedId ? 'green' : 'gray'} size="sm"
                label={!selectedId ? t('selected') : t('select')}
                onPress={() => onSelect(null)}
              />
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
                {tn('your_recordings', { n: recordings.length })}
                {selectedId && recordings.find((r) => r.id === selectedId)
                  ? ` · ${recordings.find((r) => r.id === selectedId)!.label}`
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
                      <RoundButton
                        color="blue" size={42}
                        label={playing ? '⏸' : '▶'}
                        onPress={() => playRecording(r)}
                      />
                      <PillButton
                        color={isSel ? 'green' : 'gray'}
                        size="sm"
                        label={isSel ? t('selected') : t('select')}
                        onPress={() => onSelect(r.id)}
                      />
                      <RoundButton
                        color="red" size={42}
                        label="🗑"
                        onPress={() => onDelete(r)}
                      />
                    </View>
                  </View>
                );
              })}
          </>
        )}

        {/* Record button */}
        <PillButton
          color={isRecording ? 'red' : 'green'}
          size="lg"
          label={isRecording ? tn('record_stop', { s: recElapsed }) : t('record_new_variant')}
          onPress={isRecording ? stopRecording : startRecording}
          style={{ marginTop: 16 }}
        />

        {/* Danger zone */}
        <View style={parentStyles.dangerZone}>
          {!isCustom && (hasImageOverride || hasLabelOverride || recordings.length > 0 || isHidden) && (
            <PillButton color="gray" size="md" label={`${t('restore')} ${t('reset_to_default_btn')}`}
              onPress={onResetDefault} style={{ minWidth: 200 }} />
          )}
          {isHidden ? (
            <PillButton color="green" size="md" label={t('show_again')}
              onPress={async () => { await persist(unhideItem(state, itemId)); }}
              style={{ minWidth: 200 }} />
          ) : (
            <PillButton color="red" size="md"
              label={isCustom ? t('delete_card') : t('hide_card')}
              onPress={onDeleteItem} style={{ minWidth: 200 }} />
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
  onBack,
}: {
  defaultCat: CategoryId | null;
  onBack: () => void;
}) {
  const { state, persist, lang, profile, t, tn } = useApp();
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
      Alert.alert(t('no_permission_camera_short'), t('no_permission_gallery'));
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
      Alert.alert(t('no_permission_camera_short'), t('no_permission_camera'));
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
        Alert.alert(t('no_permission_camera_short'), t('no_permission_mic'));
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
      Alert.alert(t('recording_error'), String(e?.message || e));
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
      Alert.alert(t('error_generic'), String(e?.message || e));
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
      Alert.alert(t('no_image_selected'), t('no_image_selected_msg'));
      return;
    }
    if (!label.trim()) {
      Alert.alert(t('no_caption'), t('no_caption_msg'));
      return;
    }
    if (recordings.length === 0) {
      Alert.alert(
        t('no_recording'),
        t('no_recording_msg'),
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
        <Text style={appStyles.backBtnText}>{t('back')}</Text>
      </TouchableOpacity>

      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 68 }}>
        <Text style={[appStyles.title, { fontSize: 20 }]}>{t('add_custom_title')}</Text>

        {/* Image */}
        <View style={[parentStyles.heroCard, { height: 160 }]}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={parentStyles.heroImg} resizeMode="contain" />
          ) : (
            <Text style={{ color: '#999', fontSize: 16 }}>{t('no_image')}</Text>
          )}
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16 }}>
          <PillButton color="blue"   size="md" label={t('pick_gallery')} onPress={pickImage} />
          <PillButton color="purple" size="md" label={t('take_photo')}   onPress={takePhoto} />
        </View>

        {/* Label */}
        <Text style={parentStyles.fieldLabel}>{t('caption_field')}</Text>
        <TextInput
          style={parentStyles.textInput}
          value={label}
          onChangeText={setLabel}
          placeholder={t('caption_placeholder')}
          maxLength={40}
        />

        {/* Category picker */}
        <Text style={parentStyles.fieldLabel}>{t('category_field')}</Text>
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
                {c.emoji} {profile.categoryLabels[c.id]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Recordings — collapsible */}
        <Text style={parentStyles.fieldLabel}>{t('recordings_field')}</Text>
        {recordings.length > 0 && (
          <>
            <TouchableOpacity
              style={parentStyles.expandHeader}
              onPress={() => setVariantsExpanded((v) => !v)}
              activeOpacity={0.7}
            >
              <Text style={parentStyles.expandHeaderText}>
                {recordings.length === 1
                  ? tn('recordings_summary_one', { n: recordings.length })
                  : tn('recordings_summary_many', { n: recordings.length })}
                {selectedId && recordings.find((r) => r.id === selectedId)
                  ? ` · ${recordings.find((r) => r.id === selectedId)!.label}`
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
                    <RoundButton color="blue" size={42}
                      label={playingId === r.id ? '⏸' : '▶'}
                      onPress={() => playRec(r)}
                    />
                    <PillButton
                      color={selectedId === r.id ? 'green' : 'gray'}
                      size="sm"
                      label={selectedId === r.id ? t('selected') : t('select')}
                      onPress={() => setSelectedId(r.id)}
                    />
                    <RoundButton color="red" size={42}
                      label="🗑"
                      onPress={async () => {
                        await deleteFileQuietly(r.uri);
                        setRecordings((rs) => rs.filter((x) => x.id !== r.id));
                        setSelectedId((cur) =>
                          cur === r.id
                            ? recordings.find((x) => x.id !== r.id)?.id ?? null
                            : cur,
                        );
                      }}
                    />
                  </View>
                </View>
              ))}
          </>
        )}
        <PillButton
          color={isRecording ? 'red' : 'green'} size="lg"
          label={isRecording ? tn('record_stop', { s: recElapsed }) : t('record_new_variant')}
          onPress={isRecording ? stopRecording : startRecording}
          style={{ marginTop: 16 }}
        />

        {/* Save */}
        {busy ? (
          <ActivityIndicator color="#FF9800" style={{ marginTop: 20 }} />
        ) : (
          <PillButton color="orange" size="lg" label={t('save_card')}
            onPress={onSave} style={{ marginTop: 20, alignSelf: 'center' }} />
        )}
      </ScrollView>
    </View>
  );
}

/* ============================================================
   SETTINGS — rename categories + kiosk lock + PIN
============================================================ */

function Settings({ onBack }: { onBack: () => void }) {
  const { state, persist, profile, t } = useApp();
  const [labels, setLabels] = useState({ ...profile.categoryLabels });
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
        <Text style={appStyles.backBtnText}>{t('back')}</Text>
      </TouchableOpacity>

      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 68 }}>
        <Text style={[appStyles.title, { fontSize: 20 }]}>{t('settings_title')}</Text>

        {/* Language picker */}
        <Text style={parentStyles.fieldLabel}>{t('settings_language')}</Text>
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
            {t('settings_language_warn')}
          </Text>
        )}

        {/* PIN */}
        <Text style={parentStyles.fieldLabel}>{t('settings_pin_label')}</Text>
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
          {t('settings_categories_label')}
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

        <PillButton color="green" size="lg" label={t('save')}
          onPress={onSave} style={{ alignSelf: 'center', marginTop: 24 }} />
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
