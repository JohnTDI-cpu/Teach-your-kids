import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Animated, Easing, Image, NativeModules, TextInput, Alert } from 'react-native';
import { Audio } from 'expo-av';
import * as ScreenOrientation from 'expo-screen-orientation';
import contentData from './assets/content_data.json';
import { AudioAssets, ImageAssets } from './AssetMap';

const { KioskModule } = NativeModules;

// ... keeping FlashcardGame untouched ...
// ==========================================
// EKRAN: FISZKI (Tryb Dziecko)
// ==========================================
function FlashcardGame({ category, onBack }) {
  const [currentItem, setCurrentItem] = useState(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [words, setWords] = useState<string[]>([]);
  
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const wordsAnim = useRef<Animated.Value[]>([]).current;

  // Prepare items based on selected category
  const items = React.useMemo(() => {
    switch(category) {
      case 'letters': return contentData.letters_pl;
      case 'numbers': return contentData.numbers;
      case 'animals': return contentData.animals;
      case 'colors': return contentData.colors;
      default: return contentData.animals;
    }
  }, [category]);

  const getRandomItem = () => {
    const randomIndex = Math.floor(Math.random() * items.length);
    return items[randomIndex];
  };

  useEffect(() => {
    pickNext();
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, []);

  const animateChange = (newText: string) => {
    const newWords = newText.split(' ');
    setWords(newWords);

    wordsAnim.length = 0;
    newWords.forEach(() => {
      wordsAnim.push(new Animated.Value(-200));
    });

    scaleAnim.setValue(0.5);
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 4,
      useNativeDriver: true,
    }).start();

    const wordAnimations = wordsAnim.map((anim, index) => {
      return Animated.timing(anim, {
        toValue: 0,
        duration: 400,
        delay: index * 400,
        easing: Easing.bounce,
        useNativeDriver: true,
      });
    });

    Animated.parallel(wordAnimations).start();
  };

  const playAudioFor = async (item) => {
    if (sound) {
      await sound.unloadAsync();
    }
    try {
      // By default use polish audio if available, else generic audio
      const audioFileName = item.audio_pl || item.audio || item.audio_en;
      const audioModule = AudioAssets[audioFileName];
      if (audioModule) {
        const { sound: newSound } = await Audio.Sound.createAsync(audioModule);
        setSound(newSound);
        await newSound.playAsync();
      } else {
        console.warn("Audio module not found in AssetMap for:", audioFileName);
      }
    } catch (error) {
      console.error("Audio play error", error);
    }
  };

  const pickNext = () => {
    const nextItem = getRandomItem();
    setCurrentItem(nextItem);
    
    let displayStr = "";
    if (nextItem.id.startsWith("letters_pl")) {
        displayStr = `${nextItem.letter} jak ${nextItem.word}`;
    } else if (nextItem.id.startsWith("letters_en")) {
        displayStr = `${nextItem.letter} is for ${nextItem.word}`;
    } else if (nextItem.id.startsWith("animals")) {
        displayStr = `${nextItem.pl} mówi ${nextItem.sound_pl}`;
    } else {
        displayStr = nextItem.pl || nextItem.text || nextItem.id;
    }
    
    animateChange(displayStr);
    setTimeout(() => { playAudioFor(nextItem); }, 600);
  };

  if (!currentItem) return <View style={styles.container}><Text>Ładowanie...</Text></View>;

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backBtn} onPress={onBack}>
        <Text style={styles.backBtnText}>↩ Wróć</Text>
      </TouchableOpacity>

      <View style={styles.textContainer}>
        {words.map((word, index) => (
          <Animated.Text 
            key={index} 
            style={[styles.fallingText, { transform: [{ translateY: wordsAnim[index] }] }]}
          >
            {word}{' '}
          </Animated.Text>
        ))}
      </View>

      <TouchableOpacity style={styles.touchArea} activeOpacity={0.8} onPress={pickNext}>
        <Animated.View style={[styles.card, { transform: [{ scale: scaleAnim }] }]}>
          {ImageAssets[currentItem.filename] ? (
            <React.Fragment>
              <Image source={ImageAssets[currentItem.filename]} style={styles.image} resizeMode="contain" />
              <Text style={styles.debug}>[MP3: {currentItem.filename}]</Text>
            </React.Fragment>
          ) : (
            <React.Fragment>
              {/* Temporary text until images are loaded fully */}
              <Text style={styles.text}>{currentItem.pl || currentItem.letter || currentItem.id}</Text>
              <Text style={styles.debug}>[GENEROWANIE GRAFIKI W TLE]</Text>
            </React.Fragment>
          )}
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
}

// ==========================================
// EKRAN: MENU DZIECKA (Wybór Kategorii)
// ==========================================
function ChildMenu({ onSelect, onBack }) {
  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backBtn} onPress={onBack}>
        <Text style={styles.backBtnText}>↩ Wyjdź (PIN)</Text>
      </TouchableOpacity>
      
      <Text style={styles.title}>Czego się uczymy? 🎈</Text>
      
      <View style={styles.gridContainer}>
        <TouchableOpacity style={[styles.categoryBtn, {backgroundColor: '#FF5722'}]} onPress={() => onSelect('letters')}>
          <Text style={styles.categoryIcon}>A</Text>
          <Text style={styles.categoryText}>Literki</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={[styles.categoryBtn, {backgroundColor: '#2196F3'}]} onPress={() => onSelect('numbers')}>
          <Text style={styles.categoryIcon}>1</Text>
          <Text style={styles.categoryText}>Cyfry</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={[styles.categoryBtn, {backgroundColor: '#4CAF50'}]} onPress={() => onSelect('animals')}>
          <Text style={styles.categoryIcon}>🐾</Text>
          <Text style={styles.categoryText}>Zwierzęta</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={[styles.categoryBtn, {backgroundColor: '#E91E63'}]} onPress={() => onSelect('colors')}>
          <Text style={styles.categoryIcon}>🎨</Text>
          <Text style={styles.categoryText}>Kolory</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}


// ==========================================
// GŁÓWNA APLIKACJA (Nawigacja)
// ==========================================
export default function App() {
  const [screen, setScreen] = useState('menu');
  const [selectedCategory, setSelectedCategory] = useState('animals');
  
  // PIN system state
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const CORRECT_PIN = '1234'; // Hardcoded for now
  const [targetScreenAfterPin, setTargetScreenAfterPin] = useState('menu');

  useEffect(() => {
    async function lockOrientation() {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    }
    lockOrientation();
  }, []);

  const handleEnterChildMode = () => {
    if (KioskModule && KioskModule.enableKioskMode) {
      KioskModule.enableKioskMode();
    }
    setScreen('child_menu');
  };

  const handleExitChildModeRequest = () => {
    // Show PIN dialog instead of directly exiting
    setTargetScreenAfterPin('menu');
    setPinInput('');
    setShowPinDialog(true);
  };

  const verifyPinAndProceed = () => {
    if (pinInput === CORRECT_PIN) {
      setShowPinDialog(false);
      setPinInput('');
      
      // If we are exiting child mode, disable kiosk mode
      if (KioskModule && KioskModule.disableKioskMode) {
        KioskModule.disableKioskMode();
      }
      setScreen(targetScreenAfterPin);
    } else {
      Alert.alert('Błędny PIN', 'Spróbuj ponownie.');
      setPinInput('');
    }
  };

  const handleParentModeRequest = () => {
    setTargetScreenAfterPin('parent');
    setPinInput('');
    setShowPinDialog(true);
  };

  if (showPinDialog) {
    return (
      <View style={styles.container}>
        <View style={styles.pinDialog}>
          <Text style={styles.pinTitle}>Wpisz kod PIN rodzica</Text>
          <Text style={styles.pinSubtitle}>(Domyślny: 1234)</Text>
          <TextInput 
            style={styles.pinInput}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={4}
            value={pinInput}
            onChangeText={setPinInput}
            autoFocus
          />
          <View style={styles.pinActions}>
            <TouchableOpacity style={[styles.menuBtn, {backgroundColor: '#ccc', minWidth: 120, paddingVertical: 10}]} onPress={() => setShowPinDialog(false)}>
              <Text style={[styles.menuBtnText, {color: '#333', fontSize: 20}]}>Anuluj</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.menuBtn, {backgroundColor: '#4CAF50', minWidth: 120, paddingVertical: 10}]} onPress={verifyPinAndProceed}>
              <Text style={[styles.menuBtnText, {fontSize: 20}]}>OK</Text>
            </TouchableOpacity>
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
    return <FlashcardGame category={selectedCategory} onBack={() => setScreen('child_menu')} />;
  }

  if (screen === 'parent') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Panel Rodzica 👩‍💻</Text>
        <Text style={styles.subtitle}>Tu w przyszłości będą ustawienia i blokada PIN.</Text>
        <TouchableOpacity style={styles.menuBtn} onPress={() => setScreen('menu')}>
          <Text style={styles.menuBtnText}>Wróć do Menu</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // DOMYŚLNY EKRAN: MENU
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Witaj w Teach Your Kids! 🚀</Text>
      <Text style={styles.subtitle}>Kto korzysta z tabletu?</Text>
      
      <View style={styles.menuRow}>
        <TouchableOpacity style={[styles.menuBtn, { backgroundColor: '#4CAF50' }]} onPress={handleEnterChildMode}>
          <Text style={styles.menuBtnText}>👶 Dziecko</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={[styles.menuBtn, { backgroundColor: '#2196F3' }]} onPress={handleParentModeRequest}>
          <Text style={styles.menuBtnText}>👩‍💻 Rodzic</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffdb58',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
  },
  // PIN Dialog styles
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
  pinTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  pinSubtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
  },
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
  pinActions: {
    flexDirection: 'row',
    gap: 20,
    justifyContent: 'center',
    width: '100%',
  },
  // Menu styles
  title: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 24,
    color: '#666',
    marginBottom: 30,
    textAlign: 'center',
  },
  menuRow: {
    flexDirection: 'row',
    gap: 30,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
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
  menuBtnText: {
    fontSize: 28,
    color: 'white',
    fontWeight: 'bold',
  },
  // Child Categories Grid
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '80%',
    maxWidth: 800,
    justifyContent: 'center',
    gap: 20,
  },
  categoryBtn: {
    width: '40%',
    aspectRatio: 1.5,
    minWidth: 200,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  categoryIcon: {
    fontSize: 60,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 10,
  },
  categoryText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
  },
  // Flashcard styles
  textContainer: {
    position: 'absolute',
    top: '10%',
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
    maxHeight: 400,
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
  text: {
    fontSize: 50,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  image: {
    width: '90%',
    height: '90%',
    borderRadius: 20,
  },
  debug: {
    fontSize: 16,
    color: '#aaa',
    position: 'absolute',
    bottom: 20,
  },
  backBtn: {
    position: 'absolute',
    top: 20,
    left: 20,
    backgroundColor: 'rgba(255,255,255,0.7)',
    padding: 15,
    borderRadius: 15,
    zIndex: 20,
  },
  backBtnText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  }
});
