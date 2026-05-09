import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Animated,
  Easing,
  Image,
  TextInput,
  Alert,
  ImageBackground,
  useWindowDimensions,
  BackHandler,
} from 'react-native';
import { Audio, AVPlaybackStatus } from 'expo-av';
import { useFonts, Fredoka_500Medium, Fredoka_700Bold } from '@expo-google-fonts/fredoka';

import { AudioAssets, ImageAssets, MenuAssets } from './AssetMap';
import {
  CategoryId,
  PersistedState,
  loadState,
  saveState,
  ensureDirs,
  buildItemsForCategory,
  MergedItem,
} from './state';
import { AppProvider, useApp } from './AppContext';
import { PillButton } from './Buttons';
import { ParentApp } from './ParentApp';

/** Rainbow palette for falling letters. Yellow/orange dropped because the
 *  flashcard background is cream-yellow (#ffdb58) and they'd vanish into it. */
const RAINBOW = ['#E11D48', '#1D4ED8', '#9333EA', '#0891B2', '#16A34A', '#DB2777', '#7C3AED'];

/** App-wide font names — loaded by the root component. */
const FONT_BOLD = 'Fredoka_700Bold';
const FONT_MEDIUM = 'Fredoka_500Medium';

/* ============================================================
   Responsive hook — use inside any component that needs to adapt
   to screen size or rotation.
============================================================ */

export function useDevice() {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const short = Math.min(width, height);
  // Scale relative to 360dp short side; cap at 1.6 so tablet UI stays sane
  const scale = Math.min(short / 360, 1.6);
  const rs = (base: number, maxVal?: number) => {
    const v = Math.round(base * scale);
    return maxVal !== undefined ? Math.min(v, maxVal) : v;
  };
  return { width, height, isLandscape, short, scale, rs };
}

/* ============================================================
   Audio + image resolution helpers
============================================================ */

function resolveAudioSource(item: MergedItem): { source: any; key: string } | null {
  if (item.customAudioUri) {
    return { source: { uri: item.customAudioUri }, key: 'custom:' + item.customAudioUri };
  }
  if (item.builtinAudioKey && AudioAssets[item.builtinAudioKey]) {
    return { source: AudioAssets[item.builtinAudioKey], key: item.builtinAudioKey };
  }
  return null;
}

function resolveImageSource(item: MergedItem): any {
  if (!item.imageSource) return null;
  if (item.imageSource.__builtinImage) {
    return ImageAssets[item.imageSource.__builtinImage] ?? null;
  }
  return item.imageSource;
}

/* ============================================================
   FLASHCARD — child mode
============================================================ */

function FlashcardGame({ category, onBack }: { category: CategoryId; onBack: () => void }) {
  const { state, lang, t } = useApp();
  const { width, height, isLandscape, rs } = useDevice();

  const items = useMemo(
    () => buildItemsForCategory(category, state, lang),
    [category, state, lang],
  );

  const [currentItem, setCurrentItem] = useState<MergedItem | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);
  const audioFallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastIndexRef = useRef<number>(-1);

  const scaleAnim = useRef(new Animated.Value(1)).current;
  // Per-character (not per-word) animations for the falling letters effect.
  const charsAnim = useRef<{
    fall: Animated.Value; rot: Animated.Value;
  }[]>([]).current;
  const lockShake = useRef(new Animated.Value(0)).current;
  const [chars, setChars] = useState<string[]>([]);

  // Card dimensions adapt to orientation
  const cardW = isLandscape
    ? Math.min(width * 0.56, 560)
    : Math.min(width * 0.86, 460);
  const cardH = isLandscape
    ? Math.min(height * 0.64, 400)
    : Math.min(height * 0.46, 380);
  const fallingFontSize = rs(34, 46);
  const cardTextSize = rs(40, 54);

  const getRandomItem = useCallback((): MergedItem | null => {
    if (items.length === 0) return null;
    if (items.length === 1) return items[0];
    let idx = Math.floor(Math.random() * items.length);
    if (idx === lastIndexRef.current) idx = (idx + 1) % items.length;
    lastIndexRef.current = idx;
    return items[idx];
  }, [items]);

  const animateChange = useCallback(
    (newText: string) => {
      // Split into characters (preserving spaces). Each gets its own anim
      // value so they fall in slightly at different times like Sesame Street.
      const newChars = Array.from(newText);
      setChars(newChars);
      charsAnim.length = 0;
      newChars.forEach(() =>
        charsAnim.push({
          fall: new Animated.Value(-260),
          rot: new Animated.Value((Math.random() - 0.5) * 1.4), // -0.7..0.7 rad
        }),
      );

      // Card pops in on top of the falling letters
      scaleAnim.setValue(0.5);
      Animated.spring(scaleAnim, { toValue: 1, friction: 4, useNativeDriver: true }).start();

      // Stagger characters with a 60ms gap; each spring-bounces into place.
      const animations = newChars.flatMap((ch, i) => {
        if (ch === ' ') return [];
        return [
          Animated.spring(charsAnim[i].fall, {
            toValue: 0,
            friction: 5,
            tension: 90,
            delay: i * 60,
            useNativeDriver: true,
          }),
          Animated.spring(charsAnim[i].rot, {
            toValue: 0,
            friction: 5,
            tension: 90,
            delay: i * 60,
            useNativeDriver: true,
          }),
        ];
      });
      Animated.parallel(animations).start();
    },
    [scaleAnim, charsAnim],
  );

  const clearAudioFallback = () => {
    if (audioFallbackRef.current) {
      clearTimeout(audioFallbackRef.current);
      audioFallbackRef.current = null;
    }
  };

  const playAudioFor = useCallback(async (item: MergedItem) => {
    if (soundRef.current) {
      try { await soundRef.current.unloadAsync(); } catch {}
      soundRef.current = null;
    }
    clearAudioFallback();
    const resolved = resolveAudioSource(item);
    if (!resolved) { setIsAudioPlaying(false); return; }
    setIsAudioPlaying(true);
    try {
      const { sound } = await Audio.Sound.createAsync(resolved.source, { shouldPlay: true });
      soundRef.current = sound;
      // Watchdog: malformed mp3 / driver hiccup could mean didJustFinish
      // never fires. Release the gate after 9 s so the kid can move on.
      audioFallbackRef.current = setTimeout(() => {
        setIsAudioPlaying(false);
        audioFallbackRef.current = null;
      }, 9000);
      sound.setOnPlaybackStatusUpdate((status: AVPlaybackStatus) => {
        if (!status.isLoaded) {
          if ((status as any).error) { setIsAudioPlaying(false); clearAudioFallback(); }
          return;
        }
        if (status.didJustFinish) { setIsAudioPlaying(false); clearAudioFallback(); }
      });
    } catch (e) {
      console.warn('audio play error', e);
      setIsAudioPlaying(false);
      clearAudioFallback();
    }
  }, []);

  const pickNext = useCallback(() => {
    const next = getRandomItem();
    if (!next) return;
    setCurrentItem(next);
    animateChange(next.caption || next.primary);
    setTimeout(() => playAudioFor(next), 350);
  }, [getRandomItem, animateChange, playAudioFor]);

  useEffect(() => {
    pickNext();
    return () => {
      if (soundRef.current) { soundRef.current.unloadAsync().catch(() => {}); soundRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onCardPress = useCallback(() => {
    if (isAudioPlaying) {
      lockShake.setValue(0);
      Animated.sequence([
        Animated.timing(lockShake, { toValue: 8, duration: 60, useNativeDriver: true }),
        Animated.timing(lockShake, { toValue: -8, duration: 60, useNativeDriver: true }),
        Animated.timing(lockShake, { toValue: 6, duration: 60, useNativeDriver: true }),
        Animated.timing(lockShake, { toValue: -4, duration: 60, useNativeDriver: true }),
        Animated.timing(lockShake, { toValue: 0, duration: 60, useNativeDriver: true }),
      ]).start();
      return;
    }
    pickNext();
  }, [isAudioPlaying, pickNext, lockShake]);

  if (!currentItem) {
    return (
      <View style={[styles.container, { backgroundColor: '#ffdb58' }]}>
        <Text style={styles.title}>{t('no_items_in_cat')}</Text>
        <TouchableOpacity style={styles.menuBtn} onPress={onBack}>
          <Text style={styles.menuBtnText}>{t('back')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isColor = currentItem.category === 'colors';
  const cardImage = resolveImageSource(currentItem);
  // Background stays normal even for colors — the colour itself fills the card.
  const containerBg = '#ffdb58';

  return (
    <View style={[styles.container, { backgroundColor: containerBg }]}>
      <TouchableOpacity style={styles.backBtn} onPress={onBack}>
        <Text style={styles.backBtnText}>{t('back')}</Text>
      </TouchableOpacity>

      <View style={styles.textContainer} pointerEvents="none">
        {chars.map((ch, index) => {
          if (ch === ' ') return <Text key={index} style={[styles.fallingText, { fontSize: fallingFontSize }]}>{' '}</Text>;
          const a = charsAnim[index];
          // Skip animation values that haven't been initialised yet (initial render race)
          if (!a) {
            return (
              <Text key={index} style={[styles.fallingText, { fontSize: fallingFontSize }]}>
                {ch}
              </Text>
            );
          }
          // Rainbow letters everywhere — including the colour category.
          // The colour itself only fills the card now, the background is the
          // shared cream-yellow so letters stay legible with their shadow.
          const colorOverride = { color: RAINBOW[index % RAINBOW.length] };
          const rotate = a.rot.interpolate({
            inputRange: [-1, 1],
            outputRange: ['-30deg', '30deg'],
          });
          return (
            <Animated.Text
              key={index}
              style={[
                styles.fallingText,
                { fontSize: fallingFontSize },
                colorOverride,
                { transform: [{ translateY: a.fall }, { rotate }] },
              ]}
            >
              {ch}
            </Animated.Text>
          );
        })}
      </View>

      <TouchableOpacity
        style={styles.touchArea}
        activeOpacity={0.85}
        onPress={onCardPress}
      >
        <Animated.View
          style={[
            styles.card,
            { width: cardW, height: cardH },
            isColor && { backgroundColor: currentItem.hex || '#fff' },
            { transform: [{ scale: scaleAnim }, { translateX: lockShake }] },
          ]}
        >
          {isColor ? (
            // Pure colour swatch — the colour name already falls down at the top,
            // so we don't repeat it here. Just an empty rounded card filled with the hue.
            null
          ) : cardImage ? (
            <Image source={cardImage} style={styles.image} resizeMode="contain" />
          ) : (
            <Text style={[styles.text, { fontSize: cardTextSize }]}>{currentItem.primary}</Text>
          )}
        </Animated.View>
      </TouchableOpacity>

      <View style={styles.gateBar} pointerEvents="none">
        {isAudioPlaying ? (
          <Text style={styles.gateText}>{t('gate_listen')}</Text>
        ) : (
          <Text style={styles.gateTextReady}>{t('gate_tap')}</Text>
        )}
      </View>
    </View>
  );
}

/* ============================================================
   CHILD MENU — category selection
============================================================ */

const TILE_DEFS: { id: CategoryId; defaultIcon: string; color: string; menuAsset?: string }[] = [
  { id: 'letters', defaultIcon: 'A',  color: '#FF5722', menuAsset: 'bg_letters.webp' },
  { id: 'numbers', defaultIcon: '1',  color: '#2196F3', menuAsset: 'bg_numbers.webp' },
  { id: 'animals', defaultIcon: '🐾', color: '#4CAF50', menuAsset: 'bg_animals.webp' },
  { id: 'colors',  defaultIcon: '🎨', color: '#E91E63', menuAsset: 'bg_colors.webp' },
];

function ChildMenu({ onSelect, onBack }: { onSelect: (cat: CategoryId) => void; onBack: () => void }) {
  const { profile, t } = useApp();
  const { width, height, isLandscape, rs } = useDevice();
  const mainBg = MenuAssets['bg_main.webp'];

  // Tiles: 2 per row always; size adapts to orientation
  const tileW = isLandscape
    ? Math.min(width * 0.40, 380)
    : Math.min(width * 0.43, 340);
  const tileAspect = isLandscape ? 1.65 : 1.25;
  const tileH = tileW / tileAspect;
  const iconSize = rs(42, 54);
  const catTextSize = rs(18, 26);
  const titleSize = rs(20, 26);

  return (
    <ImageBackground
      source={mainBg ?? undefined}
      style={[styles.container, { backgroundColor: '#ffdb58' }]}
      resizeMode="cover"
    >
      <View style={styles.dimOverlay} />
      <TouchableOpacity style={styles.backBtn} onPress={onBack}>
        <Text style={styles.backBtnText}>{t('pin_exit_label')}</Text>
      </TouchableOpacity>

      <Text style={[styles.title, { fontSize: titleSize, color: '#fff', textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 8, marginBottom: 8 }]}>
        {t('child_title')}
      </Text>

      <View style={[styles.gridContainer, { gap: isLandscape ? 16 : 12 }]}>
        {TILE_DEFS.map((tile) => {
          const tileBg = tile.menuAsset ? MenuAssets[tile.menuAsset] : null;
          const label = profile.categoryLabels[tile.id];
          return (
            <TouchableOpacity
              key={tile.id}
              style={[styles.categoryBtn, { backgroundColor: tile.color, width: tileW, height: tileH }]}
              activeOpacity={0.85}
              onPress={() => onSelect(tile.id)}
            >
              {tileBg ? (
                <ImageBackground
                  source={tileBg}
                  style={styles.tileBg}
                  imageStyle={{ borderRadius: 24 }}
                  resizeMode="cover"
                >
                  <View style={styles.tileScrim} />
                  <Text style={[styles.categoryIcon, styles.tileText, { fontSize: iconSize }]}>{tile.defaultIcon}</Text>
                  <Text style={[styles.categoryText, styles.tileText, { fontSize: catTextSize }]}>{label}</Text>
                </ImageBackground>
              ) : (
                <View style={styles.tileBg}>
                  <Text style={[styles.categoryIcon, { fontSize: iconSize }]}>{tile.defaultIcon}</Text>
                  <Text style={[styles.categoryText, { fontSize: catTextSize }]}>{label}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </ImageBackground>
  );
}

/* ============================================================
   ROOT — navigation + PIN gate + state bootstrapping
============================================================ */

/* ============================================================
   ROOT — state loading + AppProvider
============================================================ */

export default function App() {
  const [state, setState] = useState<PersistedState | null>(null);
  const [fontsLoaded] = useFonts({ Fredoka_500Medium, Fredoka_700Bold });

  useEffect(() => {
    (async () => {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
        } as any);
      } catch {}
      try { await ensureDirs(); } catch {}
      const s = await loadState();
      setState(s);
    })();
  }, []);

  const persist = useCallback(async (next: PersistedState) => {
    setState(next);
    try { await saveState(next); } catch (e) { console.warn('saveState', e); }
  }, []);

  if (!state || !fontsLoaded) {
    return (
      <View style={[styles.container, { backgroundColor: '#ffdb58' }]}>
        <Text style={styles.title}>Loading…</Text>
      </View>
    );
  }

  return (
    <AppProvider state={state} persist={persist}>
      <RootScreens />
    </AppProvider>
  );
}

/* ============================================================
   ROOT SCREENS — navigation + PIN gate (inside AppProvider)
============================================================ */

function RootScreens() {
  const { state, t } = useApp();
  const { width, isLandscape, rs } = useDevice();

  const [screen, setScreen] = useState<'menu' | 'child_menu' | 'flashcard' | 'parent'>('menu');
  const [selectedCategory, setSelectedCategory] = useState<CategoryId>('animals');
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [targetScreenAfterPin, setTargetScreenAfterPin] =
    useState<'menu' | 'parent'>('menu');

  const handleExitChildModeRequest = useCallback(() => {
    setTargetScreenAfterPin('menu');
    setPinInput('');
    setShowPinDialog(true);
  }, []);

  // Hardware back button: blocked in child screens, used as in-app
  // navigation everywhere else.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (showPinDialog) { setShowPinDialog(false); setPinInput(''); return true; }
      if (screen === 'child_menu') { handleExitChildModeRequest(); return true; }
      if (screen === 'flashcard') { setScreen('child_menu'); return true; }
      if (screen === 'parent') { setScreen('menu'); return true; }
      return false; // root menu → allow system back to leave the app
    });
    return () => sub.remove();
  }, [screen, showPinDialog, handleExitChildModeRequest]);

  const handleEnterChildMode = () => setScreen('child_menu');

  const handleParentModeRequest = () => {
    setTargetScreenAfterPin('parent');
    setPinInput('');
    setShowPinDialog(true);
  };

  const verifyPinAndProceed = () => {
    if (pinInput === state.pin) {
      setShowPinDialog(false);
      setPinInput('');
      setScreen(targetScreenAfterPin);
    } else {
      Alert.alert(t('pin_wrong'), t('pin_wrong_msg'));
      setPinInput('');
    }
  };

  if (showPinDialog) {
    const dlgW = Math.min(width * 0.7, 420);
    return (
      <View style={[styles.container, { backgroundColor: '#ffdb58' }]}>
        <View style={[styles.pinDialog, { width: dlgW }]}>
          <Text style={[styles.pinTitle, { fontSize: rs(22, 28) }]}>{t('pin_title')}</Text>
          <Text style={styles.pinSubtitle}>{t('pin_subtitle')}</Text>
          <TextInput
            style={[styles.pinInput, { fontSize: rs(32, 40) }]}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={6}
            value={pinInput}
            onChangeText={setPinInput}
            autoFocus
          />
          <View style={styles.pinActions}>
            <PillButton color="gray"  size="md" label={t('cancel')} onPress={() => setShowPinDialog(false)} />
            <PillButton color="green" size="md" label={t('ok')}     onPress={verifyPinAndProceed} />
          </View>
        </View>
      </View>
    );
  }

  if (screen === 'child_menu') {
    return (
      <ChildMenu
        onSelect={(cat) => { setSelectedCategory(cat); setScreen('flashcard'); }}
        onBack={handleExitChildModeRequest}
      />
    );
  }

  if (screen === 'flashcard') {
    return (
      <FlashcardGame
        category={selectedCategory}
        onBack={() => setScreen('child_menu')}
      />
    );
  }

  if (screen === 'parent') {
    return <ParentApp onExit={() => setScreen('menu')} />;
  }

  // MAIN MENU
  const mainBg = MenuAssets['bg_main.webp'];
  const iconSize = rs(100, 130);
  const menuTitleSize = rs(24, 36);
  const menuSubSize = rs(14, 20);
  const btnTextSize = rs(18, 24);
  const menuDirection = isLandscape ? 'row' : 'column';

  return (
    <ImageBackground
      source={mainBg ?? undefined}
      style={[styles.container, { backgroundColor: '#ffdb58' }]}
      resizeMode="cover"
    >
      <View style={styles.dimOverlay} />
      <Text style={[styles.title, { fontSize: menuTitleSize, color: '#fff', textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 10 }]}>
        {t('main_welcome')}
      </Text>
      <Text style={[styles.subtitle, { fontSize: menuSubSize, color: '#fff', marginBottom: isLandscape ? 16 : 24 }]}>
        {t('main_who')}
      </Text>

      <View style={[styles.menuRow, { flexDirection: menuDirection, gap: isLandscape ? 28 : 20 }]}>
        <TouchableOpacity
          style={[styles.bigMenuBtn, { backgroundColor: '#4CAF50' }]}
          onPress={handleEnterChildMode}
          activeOpacity={0.85}
        >
          {MenuAssets['icon_child.webp'] ? (
            <Image
              source={MenuAssets['icon_child.webp']}
              style={[styles.bigMenuIcon, { width: iconSize, height: iconSize, borderRadius: iconSize / 2 }]}
              resizeMode="cover"
            />
          ) : (
            <Text style={[styles.bigMenuEmoji, { fontSize: rs(60, 80) }]}>👶</Text>
          )}
          <Text style={[styles.menuBtnText, { fontSize: btnTextSize }]}>{t('main_child')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.bigMenuBtn, { backgroundColor: '#2196F3' }]}
          onPress={handleParentModeRequest}
          activeOpacity={0.85}
        >
          {MenuAssets['icon_parent.webp'] ? (
            <Image
              source={MenuAssets['icon_parent.webp']}
              style={[styles.bigMenuIcon, { width: iconSize, height: iconSize, borderRadius: iconSize / 2 }]}
              resizeMode="cover"
            />
          ) : (
            <Text style={[styles.bigMenuEmoji, { fontSize: rs(60, 80) }]}>👩‍💻</Text>
          )}
          <Text style={[styles.menuBtnText, { fontSize: btnTextSize }]}>{t('main_parent')}</Text>
        </TouchableOpacity>
      </View>
    </ImageBackground>
  );
}

/* ============================================================
   STYLES
============================================================ */

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
  },
  dimOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  pinDialog: {
    backgroundColor: 'white',
    padding: 24,
    borderRadius: 20,
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    minWidth: 280,
  },
  pinTitle: { fontSize: 22, fontFamily: FONT_BOLD, color: '#333', marginBottom: 4 },
  pinSubtitle: { fontSize: 14, color: '#666', marginBottom: 16, fontFamily: FONT_MEDIUM },
  pinInput: {
    fontSize: 36,
    letterSpacing: 16,
    textAlign: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#333',
    width: '80%',
    marginBottom: 24,
    paddingVertical: 8,
    fontFamily: FONT_BOLD,
  },
  pinActions: { flexDirection: 'row', gap: 16, justifyContent: 'center', width: '100%' },
  title: { fontSize: 22, fontFamily: FONT_BOLD, color: '#333', marginBottom: 6, textAlign: 'center' },
  subtitle: { fontSize: 15, color: '#666', marginBottom: 20, textAlign: 'center', fontFamily: FONT_MEDIUM },
  menuRow: { flexDirection: 'row', gap: 24, flexWrap: 'wrap', justifyContent: 'center' },
  menuBtn: {
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 18,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    minWidth: 140,
    alignItems: 'center',
  },
  menuBtnText: { fontSize: 20, color: 'white', fontFamily: FONT_BOLD },
  bigMenuBtn: {
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 22,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    minWidth: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bigMenuIcon: {
    width: 110,
    height: 110,
    borderRadius: 55,
    marginBottom: 8,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.85)',
  },
  bigMenuEmoji: { fontSize: 64, marginBottom: 6, fontFamily: FONT_BOLD },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '92%',
    maxWidth: 900,
    justifyContent: 'center',
    gap: 14,
  },
  categoryBtn: {
    borderRadius: 24,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    overflow: 'hidden',
  },
  tileBg: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.22)',
    borderRadius: 24,
  },
  tileText: {
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 6,
  },
  categoryIcon: { fontSize: 46, fontFamily: FONT_BOLD, color: 'white', marginBottom: 6 },
  categoryText: { fontSize: 20, fontFamily: FONT_BOLD, color: 'white' },
  textContainer: {
    position: 'absolute',
    top: '7%',
    flexDirection: 'row',
    zIndex: 10,
    flexWrap: 'wrap',
    justifyContent: 'center',
    paddingHorizontal: 16,
    width: '100%',
  },
  fallingText: {
    fontSize: 36,
    fontFamily: FONT_BOLD,
    color: '#FF5733',
    textShadowColor: 'rgba(0, 0, 0, 0.25)',
    textShadowOffset: { width: 2, height: 3 },
    textShadowRadius: 6,
    marginHorizontal: 1,
  },
  touchArea: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: '4%',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
    padding: 16,
  },
  text: { fontSize: 42, fontFamily: FONT_BOLD, color: '#333', textAlign: 'center' },
  image: { width: '90%', height: '90%', borderRadius: 16 },
  backBtn: {
    position: 'absolute',
    top: 14,
    left: 14,
    backgroundColor: 'rgba(255,255,255,0.85)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    zIndex: 20,
  },
  backBtnText: { fontSize: 16, fontFamily: FONT_BOLD, color: '#333' },
  gateBar: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  gateText: {
    fontSize: 16,
    fontFamily: FONT_BOLD,
    color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 10,
    overflow: 'hidden',
  },
  gateTextReady: {
    fontSize: 15,
    fontFamily: FONT_BOLD,
    color: '#fff',
    backgroundColor: 'rgba(76,175,80,0.85)',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 10,
    overflow: 'hidden',
  },
});
