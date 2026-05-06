import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Animated,
  Easing,
  Image,
  NativeModules,
  TextInput,
  Alert,
  ImageBackground,
  useWindowDimensions,
  BackHandler,
} from 'react-native';
import { Audio, AVPlaybackStatus } from 'expo-av';

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
import { ParentApp } from './ParentApp';

const { KioskModule } = NativeModules;

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

type FlashcardProps = {
  category: CategoryId;
  state: PersistedState;
  onBack: () => void;
};

function FlashcardGame({ category, state, onBack }: FlashcardProps) {
  const { width, height, isLandscape, rs } = useDevice();

  const items = useMemo(
    () => buildItemsForCategory(category, state, 'pl'),
    [category, state],
  );

  const [currentItem, setCurrentItem] = useState<MergedItem | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);
  const lastIndexRef = useRef<number>(-1);

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const wordsAnim = useRef<Animated.Value[]>([]).current;
  const lockShake = useRef(new Animated.Value(0)).current;
  const [words, setWords] = useState<string[]>([]);

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
      const newWords = newText.split(' ');
      setWords(newWords);
      wordsAnim.length = 0;
      newWords.forEach(() => wordsAnim.push(new Animated.Value(-200)));
      scaleAnim.setValue(0.5);
      Animated.spring(scaleAnim, { toValue: 1, friction: 4, useNativeDriver: true }).start();
      Animated.parallel(
        wordsAnim.map((anim, i) =>
          Animated.timing(anim, {
            toValue: 0,
            duration: 380,
            delay: i * 200,
            easing: Easing.bounce,
            useNativeDriver: true,
          }),
        ),
      ).start();
    },
    [scaleAnim, wordsAnim],
  );

  const playAudioFor = useCallback(async (item: MergedItem) => {
    if (soundRef.current) {
      try { await soundRef.current.unloadAsync(); } catch {}
      soundRef.current = null;
    }
    const resolved = resolveAudioSource(item);
    if (!resolved) { setIsAudioPlaying(false); return; }
    setIsAudioPlaying(true);
    try {
      const { sound } = await Audio.Sound.createAsync(resolved.source, { shouldPlay: true });
      soundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((status: AVPlaybackStatus) => {
        if (!status.isLoaded) {
          if ((status as any).error) setIsAudioPlaying(false);
          return;
        }
        if (status.didJustFinish) setIsAudioPlaying(false);
      });
    } catch (e) {
      console.warn('audio play error', e);
      setIsAudioPlaying(false);
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
        <Text style={styles.title}>Brak materiałów w tej kategorii.</Text>
        <TouchableOpacity style={styles.menuBtn} onPress={onBack}>
          <Text style={styles.menuBtnText}>Wróć</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isColor = currentItem.category === 'colors';
  const cardImage = resolveImageSource(currentItem);
  const containerBg = isColor ? currentItem.hex || '#ffdb58' : '#ffdb58';

  return (
    <View style={[styles.container, { backgroundColor: containerBg }]}>
      <TouchableOpacity style={styles.backBtn} onPress={onBack}>
        <Text style={styles.backBtnText}>↩ Wróć</Text>
      </TouchableOpacity>

      <View style={styles.textContainer} pointerEvents="none">
        {words.map((word, index) => (
          <Animated.Text
            key={index}
            style={[
              styles.fallingText,
              { fontSize: fallingFontSize },
              isColor && { color: '#ffffff', textShadowColor: 'rgba(0,0,0,0.6)' },
              { transform: [{ translateY: wordsAnim[index] || new Animated.Value(0) }] },
            ]}
          >
            {word}{' '}
          </Animated.Text>
        ))}
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
            <Text style={[styles.text, { fontSize: cardTextSize, color: '#ffffff', textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 8 }]}>
              {currentItem.primary}
            </Text>
          ) : cardImage ? (
            <Image source={cardImage} style={styles.image} resizeMode="contain" />
          ) : (
            <Text style={[styles.text, { fontSize: cardTextSize }]}>{currentItem.primary}</Text>
          )}
        </Animated.View>
      </TouchableOpacity>

      <View style={styles.gateBar} pointerEvents="none">
        {isAudioPlaying ? (
          <Text style={styles.gateText}>🔊 Słuchaj…</Text>
        ) : (
          <Text style={styles.gateTextReady}>👆 Stuknij — kolejny obrazek</Text>
        )}
      </View>
    </View>
  );
}

/* ============================================================
   CHILD MENU — category selection
============================================================ */

type ChildMenuProps = {
  state: PersistedState;
  onSelect: (cat: CategoryId) => void;
  onBack: () => void;
};

const TILE_DEFS: { id: CategoryId; defaultIcon: string; color: string; menuAsset?: string }[] = [
  { id: 'letters', defaultIcon: 'A',  color: '#FF5722', menuAsset: 'bg_letters.webp' },
  { id: 'numbers', defaultIcon: '1',  color: '#2196F3', menuAsset: 'bg_numbers.webp' },
  { id: 'animals', defaultIcon: '🐾', color: '#4CAF50', menuAsset: 'bg_animals.webp' },
  { id: 'colors',  defaultIcon: '🎨', color: '#E91E63', menuAsset: 'bg_colors.webp' },
];

function ChildMenu({ state, onSelect, onBack }: ChildMenuProps) {
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
        <Text style={styles.backBtnText}>↩ Wyjdź (PIN)</Text>
      </TouchableOpacity>

      <Text style={[styles.title, { fontSize: titleSize, color: '#fff', textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 8, marginBottom: 8 }]}>
        Czego się uczymy? 🎈
      </Text>

      <View style={[styles.gridContainer, { gap: isLandscape ? 16 : 12 }]}>
        {TILE_DEFS.map((t) => {
          const tileBg = t.menuAsset ? MenuAssets[t.menuAsset] : null;
          const label = state.categoryLabels[t.id];
          return (
            <TouchableOpacity
              key={t.id}
              style={[styles.categoryBtn, { backgroundColor: t.color, width: tileW, height: tileH }]}
              activeOpacity={0.85}
              onPress={() => onSelect(t.id)}
            >
              {tileBg ? (
                <ImageBackground
                  source={tileBg}
                  style={styles.tileBg}
                  imageStyle={{ borderRadius: 24 }}
                  resizeMode="cover"
                >
                  <View style={styles.tileScrim} />
                  <Text style={[styles.categoryIcon, styles.tileText, { fontSize: iconSize }]}>{t.defaultIcon}</Text>
                  <Text style={[styles.categoryText, styles.tileText, { fontSize: catTextSize }]}>{label}</Text>
                </ImageBackground>
              ) : (
                <View style={styles.tileBg}>
                  <Text style={[styles.categoryIcon, { fontSize: iconSize }]}>{t.defaultIcon}</Text>
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

export default function App() {
  const { width, height, isLandscape, rs } = useDevice();

  const [screen, setScreen] = useState<'menu' | 'child_menu' | 'flashcard' | 'parent'>('menu');
  const [selectedCategory, setSelectedCategory] = useState<CategoryId>('animals');
  const [state, setState] = useState<PersistedState | null>(null);
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [targetScreenAfterPin, setTargetScreenAfterPin] =
    useState<'menu' | 'parent'>('menu');

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

  // Hardware back button: block in child screens, intercept exit elsewhere.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (showPinDialog) { setShowPinDialog(false); setPinInput(''); return true; }
      if (screen === 'child_menu') { handleExitChildModeRequest(); return true; }
      if (screen === 'flashcard') { setScreen('child_menu'); return true; }
      if (screen === 'parent') { setScreen('menu'); return true; }
      return false; // root menu → allow normal back
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, showPinDialog]);

  // Kiosk auto-apply: locked everywhere except the parent panel.
  // No-op when state.kioskEnabled is false. Calling enableKioskMode while
  // already pinned is idempotent at the OS level.
  useEffect(() => {
    if (!state?.kioskEnabled || !KioskModule?.enableKioskMode) return;
    if (screen === 'parent' || showPinDialog) return;
    try {
      const r = KioskModule.enableKioskMode();
      if (r && typeof r.then === 'function') r.catch(() => {});
    } catch {}
  }, [state?.kioskEnabled, screen, showPinDialog]);

  const persist = useCallback(async (next: PersistedState) => {
    setState(next);
    try { await saveState(next); } catch (e) { console.warn('saveState', e); }
  }, []);

  const handleEnterChildMode = () => {
    if (state?.kioskEnabled && KioskModule?.enableKioskMode) {
      try {
        const r = KioskModule.enableKioskMode();
        if (r && typeof r.then === 'function') r.catch((e: any) => console.warn('kiosk enable failed', e));
      } catch (e) { console.warn('kiosk enable threw', e); }
    }
    setScreen('child_menu');
  };

  const handleExitChildModeRequest = () => {
    setTargetScreenAfterPin('menu');
    setPinInput('');
    setShowPinDialog(true);
  };

  const handleParentModeRequest = () => {
    setTargetScreenAfterPin('parent');
    setPinInput('');
    setShowPinDialog(true);
  };

  const verifyPinAndProceed = () => {
    if (!state) return;
    if (pinInput === state.pin) {
      setShowPinDialog(false);
      setPinInput('');
      if (KioskModule?.disableKioskMode) {
        try {
          const r = KioskModule.disableKioskMode();
          if (r && typeof r.then === 'function') r.catch(() => {});
        } catch {}
      }
      setScreen(targetScreenAfterPin);
    } else {
      Alert.alert('Błędny PIN', 'Spróbuj ponownie.');
      setPinInput('');
    }
  };

  if (!state) {
    return (
      <View style={[styles.container, { backgroundColor: '#ffdb58' }]}>
        <Text style={styles.title}>Wczytuję…</Text>
      </View>
    );
  }

  if (showPinDialog) {
    const dlgW = Math.min(width * 0.7, 420);
    return (
      <View style={[styles.container, { backgroundColor: '#ffdb58' }]}>
        <View style={[styles.pinDialog, { width: dlgW }]}>
          <Text style={[styles.pinTitle, { fontSize: rs(22, 28) }]}>Wpisz kod PIN rodzica</Text>
          <Text style={styles.pinSubtitle}>(Domyślny: 1234)</Text>
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
            <TouchableOpacity
              style={[styles.menuBtn, { backgroundColor: '#ccc', minWidth: 100, paddingVertical: 8 }]}
              onPress={() => setShowPinDialog(false)}
            >
              <Text style={[styles.menuBtnText, { color: '#333', fontSize: rs(16, 20) }]}>Anuluj</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.menuBtn, { backgroundColor: '#4CAF50', minWidth: 100, paddingVertical: 8 }]}
              onPress={verifyPinAndProceed}
            >
              <Text style={[styles.menuBtnText, { fontSize: rs(16, 20) }]}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  if (screen === 'child_menu') {
    return (
      <ChildMenu
        state={state}
        onSelect={(cat) => { setSelectedCategory(cat); setScreen('flashcard'); }}
        onBack={handleExitChildModeRequest}
      />
    );
  }

  if (screen === 'flashcard') {
    return (
      <FlashcardGame
        category={selectedCategory}
        state={state}
        onBack={() => setScreen('child_menu')}
      />
    );
  }

  if (screen === 'parent') {
    return <ParentApp state={state} persist={persist} onExit={() => setScreen('menu')} />;
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
        Witaj w Teach Your Kids! 🚀
      </Text>
      <Text style={[styles.subtitle, { fontSize: menuSubSize, color: '#fff', marginBottom: isLandscape ? 16 : 24 }]}>
        Kto korzysta z tabletu?
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
          <Text style={[styles.menuBtnText, { fontSize: btnTextSize }]}>Dziecko</Text>
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
          <Text style={[styles.menuBtnText, { fontSize: btnTextSize }]}>Rodzic</Text>
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
  pinTitle: { fontSize: 22, fontWeight: 'bold', color: '#333', marginBottom: 4 },
  pinSubtitle: { fontSize: 14, color: '#666', marginBottom: 16 },
  pinInput: {
    fontSize: 36,
    letterSpacing: 16,
    textAlign: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#333',
    width: '80%',
    marginBottom: 24,
    paddingVertical: 8,
  },
  pinActions: { flexDirection: 'row', gap: 16, justifyContent: 'center', width: '100%' },
  title: { fontSize: 22, fontWeight: 'bold', color: '#333', marginBottom: 6, textAlign: 'center' },
  subtitle: { fontSize: 15, color: '#666', marginBottom: 20, textAlign: 'center' },
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
  menuBtnText: { fontSize: 20, color: 'white', fontWeight: 'bold' },
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
  bigMenuEmoji: { fontSize: 64, marginBottom: 6 },
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
  categoryIcon: { fontSize: 46, fontWeight: 'bold', color: 'white', marginBottom: 6 },
  categoryText: { fontSize: 20, fontWeight: 'bold', color: 'white' },
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
    fontWeight: 'bold',
    color: '#FF5733',
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 5,
    marginHorizontal: 4,
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
  text: { fontSize: 42, fontWeight: 'bold', color: '#333', textAlign: 'center' },
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
  backBtnText: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  gateBar: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  gateText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 10,
    overflow: 'hidden',
  },
  gateTextReady: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#fff',
    backgroundColor: 'rgba(76,175,80,0.85)',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 10,
    overflow: 'hidden',
  },
});
