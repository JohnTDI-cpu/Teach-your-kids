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
  StatusBar as RNStatusBar,
  ImageBackground,
} from 'react-native';
import { Audio, AVPlaybackStatus } from 'expo-av';
import * as ScreenOrientation from 'expo-screen-orientation';

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
   Audio gating helper — resolves a MergedItem to a playable
   source and returns a promise that resolves when playback ends.
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
  return item.imageSource; // { uri: 'file://...' } for custom
}

/* ============================================================
   FLASHCARD — child mode. Audio gating: tap to advance is disabled
   until current sound has finished playing.
============================================================ */

type FlashcardProps = {
  category: CategoryId;
  state: PersistedState;
  onBack: () => void;
};

function FlashcardGame({ category, state, onBack }: FlashcardProps) {
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

  // Pick a different item than previous one if possible
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
    // Always unload any previous sound
    if (soundRef.current) {
      try {
        await soundRef.current.unloadAsync();
      } catch {}
      soundRef.current = null;
    }

    const resolved = resolveAudioSource(item);
    if (!resolved) {
      // No audio at all → nothing to wait for; flag as "ready immediately"
      setIsAudioPlaying(false);
      return;
    }

    setIsAudioPlaying(true);
    try {
      const { sound } = await Audio.Sound.createAsync(
        resolved.source,
        { shouldPlay: true },
      );
      soundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((status: AVPlaybackStatus) => {
        if (!status.isLoaded) {
          if ((status as any).error) setIsAudioPlaying(false);
          return;
        }
        if (status.didJustFinish) {
          setIsAudioPlaying(false);
        }
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

    let displayStr = next.caption || next.primary;
    animateChange(displayStr);

    // small delay so animation starts before audio
    setTimeout(() => {
      playAudioFor(next);
    }, 350);
  }, [getRandomItem, animateChange, playAudioFor]);

  // First load
  useEffect(() => {
    pickNext();
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onCardPress = useCallback(() => {
    if (isAudioPlaying) {
      // Visual hint: tiny shake. Do NOT advance.
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
            isColor && { backgroundColor: currentItem.hex || '#fff' },
            {
              transform: [
                { scale: scaleAnim },
                { translateX: lockShake },
              ],
            },
          ]}
        >
          {isColor ? (
            <Text style={[styles.text, { color: '#ffffff', textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 8 }]}>
              {currentItem.primary}
            </Text>
          ) : cardImage ? (
            <Image source={cardImage} style={styles.image} resizeMode="contain" />
          ) : (
            <Text style={styles.text}>{currentItem.primary}</Text>
          )}
        </Animated.View>
      </TouchableOpacity>

      {/* Audio gating indicator */}
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
   CHILD MENU — uses MenuAssets (Qwen-generated tiles when present)
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
  const mainBg = MenuAssets['bg_main.webp'];
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

      <Text style={[styles.title, { color: '#fff', textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 8 }]}>
        Czego się uczymy? 🎈
      </Text>

      <View style={styles.gridContainer}>
        {TILE_DEFS.map((t) => {
          const tileBg = t.menuAsset ? MenuAssets[t.menuAsset] : null;
          const label = state.categoryLabels[t.id];
          return (
            <TouchableOpacity
              key={t.id}
              style={[styles.categoryBtn, { backgroundColor: t.color }]}
              activeOpacity={0.85}
              onPress={() => onSelect(t.id)}
            >
              {tileBg ? (
                <ImageBackground
                  source={tileBg}
                  style={styles.tileBg}
                  imageStyle={{ borderRadius: 30 }}
                  resizeMode="cover"
                >
                  <View style={styles.tileScrim} />
                  <Text style={[styles.categoryIcon, styles.tileText]}>{t.defaultIcon}</Text>
                  <Text style={[styles.categoryText, styles.tileText]}>{label}</Text>
                </ImageBackground>
              ) : (
                <View style={styles.tileBg}>
                  <Text style={styles.categoryIcon}>{t.defaultIcon}</Text>
                  <Text style={styles.categoryText}>{label}</Text>
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
  const [screen, setScreen] = useState<'menu' | 'child_menu' | 'flashcard' | 'parent'>('menu');
  const [selectedCategory, setSelectedCategory] = useState<CategoryId>('animals');

  const [state, setState] = useState<PersistedState | null>(null);

  const [showPinDialog, setShowPinDialog] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [targetScreenAfterPin, setTargetScreenAfterPin] =
    useState<'menu' | 'parent'>('menu');

  // Bootstrap state + landscape lock
  useEffect(() => {
    (async () => {
      try {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      } catch {}
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
        } as any);
      } catch {}
      try {
        await ensureDirs();
      } catch {}
      const s = await loadState();
      setState(s);
    })();
  }, []);

  const persist = useCallback(async (next: PersistedState) => {
    setState(next);
    try {
      await saveState(next);
    } catch (e) {
      console.warn('saveState', e);
    }
  }, []);

  const handleEnterChildMode = () => {
    if (state?.kioskEnabled && KioskModule?.enableKioskMode) {
      try {
        const r = KioskModule.enableKioskMode();
        if (r && typeof r.then === 'function') {
          r.catch((e: any) => console.warn('kiosk enable failed', e));
        }
      } catch (e) {
        console.warn('kiosk enable threw', e);
      }
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
      // Always lift kiosk before showing the parent panel or going back
      // to the main menu, so the parent regains the system controls.
      if (KioskModule?.disableKioskMode) {
        try {
          const r = KioskModule.disableKioskMode();
          if (r && typeof r.then === 'function') {
            r.catch(() => {});
          }
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
    return (
      <View style={[styles.container, { backgroundColor: '#ffdb58' }]}>
        <View style={styles.pinDialog}>
          <Text style={styles.pinTitle}>Wpisz kod PIN rodzica</Text>
          <Text style={styles.pinSubtitle}>(Domyślny: 1234)</Text>
          <TextInput
            style={styles.pinInput}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={6}
            value={pinInput}
            onChangeText={setPinInput}
            autoFocus
          />
          <View style={styles.pinActions}>
            <TouchableOpacity
              style={[styles.menuBtn, { backgroundColor: '#ccc', minWidth: 120, paddingVertical: 10 }]}
              onPress={() => setShowPinDialog(false)}
            >
              <Text style={[styles.menuBtnText, { color: '#333', fontSize: 20 }]}>Anuluj</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.menuBtn, { backgroundColor: '#4CAF50', minWidth: 120, paddingVertical: 10 }]}
              onPress={verifyPinAndProceed}
            >
              <Text style={[styles.menuBtnText, { fontSize: 20 }]}>OK</Text>
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
        onSelect={(cat) => {
          setSelectedCategory(cat);
          setScreen('flashcard');
        }}
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
    return (
      <ParentApp
        state={state}
        persist={persist}
        onExit={() => setScreen('menu')}
      />
    );
  }

  // DEFAULT: main menu
  const mainBg = MenuAssets['bg_main.webp'];
  return (
    <ImageBackground
      source={mainBg ?? undefined}
      style={[styles.container, { backgroundColor: '#ffdb58' }]}
      resizeMode="cover"
    >
      <View style={styles.dimOverlay} />
      <Text style={[styles.title, { color: '#fff', textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 10 }]}>
        Witaj w Teach Your Kids! 🚀
      </Text>
      <Text style={[styles.subtitle, { color: '#fff' }]}>Kto korzysta z tabletu?</Text>

      <View style={styles.menuRow}>
        <TouchableOpacity
          style={[styles.bigMenuBtn, { backgroundColor: '#4CAF50' }]}
          onPress={handleEnterChildMode}
          activeOpacity={0.85}
        >
          {MenuAssets['icon_child.webp'] ? (
            <Image source={MenuAssets['icon_child.webp']} style={styles.bigMenuIcon} resizeMode="cover" />
          ) : (
            <Text style={styles.bigMenuEmoji}>👶</Text>
          )}
          <Text style={styles.menuBtnText}>Dziecko</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.bigMenuBtn, { backgroundColor: '#2196F3' }]}
          onPress={handleParentModeRequest}
          activeOpacity={0.85}
        >
          {MenuAssets['icon_parent.webp'] ? (
            <Image source={MenuAssets['icon_parent.webp']} style={styles.bigMenuIcon} resizeMode="cover" />
          ) : (
            <Text style={styles.bigMenuEmoji}>👩‍💻</Text>
          )}
          <Text style={styles.menuBtnText}>Rodzic</Text>
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
    padding: 30,
    borderRadius: 20,
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    width: '50%',
    minWidth: 350,
  },
  pinTitle: { fontSize: 28, fontWeight: 'bold', color: '#333', marginBottom: 5 },
  pinSubtitle: { fontSize: 16, color: '#666', marginBottom: 20 },
  pinInput: {
    fontSize: 40,
    letterSpacing: 20,
    textAlign: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#333',
    width: '80%',
    marginBottom: 30,
    paddingVertical: 10,
  },
  pinActions: { flexDirection: 'row', gap: 20, justifyContent: 'center', width: '100%' },
  title: { fontSize: 40, fontWeight: 'bold', color: '#333', marginBottom: 10, textAlign: 'center' },
  subtitle: { fontSize: 24, color: '#666', marginBottom: 30, textAlign: 'center' },
  menuRow: { flexDirection: 'row', gap: 30, flexWrap: 'wrap', justifyContent: 'center' },
  menuBtn: {
    paddingVertical: 20,
    paddingHorizontal: 40,
    borderRadius: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    minWidth: 200,
    alignItems: 'center',
  },
  menuBtnText: { fontSize: 28, color: 'white', fontWeight: 'bold' },
  bigMenuBtn: {
    paddingTop: 16,
    paddingBottom: 16,
    paddingHorizontal: 28,
    borderRadius: 24,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    minWidth: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bigMenuIcon: {
    width: 140,
    height: 140,
    borderRadius: 70,
    marginBottom: 10,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.85)',
  },
  bigMenuEmoji: { fontSize: 80, marginBottom: 8 },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '90%',
    maxWidth: 900,
    justifyContent: 'center',
    gap: 20,
  },
  categoryBtn: {
    width: '40%',
    aspectRatio: 1.5,
    minWidth: 220,
    borderRadius: 30,
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
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 30,
  },
  tileText: {
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 6,
  },
  categoryIcon: { fontSize: 60, fontWeight: 'bold', color: 'white', marginBottom: 10 },
  categoryText: { fontSize: 28, fontWeight: 'bold', color: 'white' },
  textContainer: {
    position: 'absolute',
    top: '8%',
    flexDirection: 'row',
    zIndex: 10,
    flexWrap: 'wrap',
    justifyContent: 'center',
    paddingHorizontal: 20,
    width: '100%',
  },
  fallingText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FF5733',
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 5,
    marginHorizontal: 5,
  },
  touchArea: {
    flex: 1,
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: '5%',
  },
  card: {
    width: '70%',
    height: '60%',
    maxWidth: 600,
    maxHeight: 420,
    backgroundColor: '#fff',
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
    padding: 20,
  },
  text: { fontSize: 56, fontWeight: 'bold', color: '#333', textAlign: 'center' },
  image: { width: '90%', height: '90%', borderRadius: 20 },
  backBtn: {
    position: 'absolute',
    top: 20,
    left: 20,
    backgroundColor: 'rgba(255,255,255,0.85)',
    padding: 15,
    borderRadius: 15,
    zIndex: 20,
  },
  backBtnText: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  gateBar: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  gateText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 12,
    overflow: 'hidden',
  },
  gateTextReady: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    backgroundColor: 'rgba(76,175,80,0.85)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 12,
    overflow: 'hidden',
  },
});
