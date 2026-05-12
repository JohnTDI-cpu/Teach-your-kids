# Publikacja w Google Play Store

## Co już zrobione w repo

- Package ID: `com.johntdi.teachyourkids` (niezmienne po pierwszym uploadzie)
- Upload keystore: `app/android/keystores/release.jks` (gitignored)
- Hasła w `app/android/keystore.properties` (gitignored)
- Release build: signed, R8 minify + shrink włączone
- `language splits` wyłączone — wszystkie 7 języków w każdym installu
- versionCode: `1` / versionName: `1.0.0`
- AAB: `app/android/app/build/outputs/bundle/release/app-release.aab`

## Co MUSISZ zachować bezpiecznie

| Plik | Co | Co się stanie po utracie |
|---|---|---|
| `app/android/keystores/release.jks` | Upload key Play | Play App Signing pozwala zresetować — utrata mniej krytyczna niż klasyczny keystore, ale i tak utrata = kontakt z Google + procedura odzyskiwania |
| `app/android/keystore.properties` | Hasło do keystore | Bez tego nie zbudujesz nowej wersji |

**Sugestia**: skopiuj oba pliki na **2 nośniki offline** (np. zaszyfrowany USB + Drive zaszyfrowany hasłem). To jak klucz do mieszkania — zgubisz, nie odzyskasz mieszkania.

## Krok-po-kroku w Play Console

### 1. Utwórz aplikację
- https://play.google.com/console → **Create app**
- Default language: Polish (pl)
- App name: `Teach Your Kids` (max 30 znaków, widoczne w sklepie)
- Free / Paid: Free
- Declarations: tick "It's an app" + "It's free" + "Acknowledge Play policies"

### 2. Designed for Families program (WAŻNE — apka dla dzieci)
- Po utworzeniu wejdź w **Policy → App content**
- W **Target audience**:
  - Target age groups: `Ages 5 and under` (lub `6-8` jeśli kierujesz starsze)
  - Confirm: apka kieruje do dzieci → Play wprowadzi specjalne restrykcje (brak ads tracking, content moderation, etc.)
- Sign up for **Teacher Approved** (opcjonalnie, daje znaczek "polecane dla dzieci")

### 3. Privacy Policy (OBOWIĄZKOWE bo masz RECORD_AUDIO + CAMERA + READ_MEDIA_IMAGES)
- Musisz mieć URL z polityką prywatności
- Najszybciej: GitHub Pages z `PRIVACY.md` w repo
- W treści jasno: nie wysyłasz nic na serwer, dane lokalnie na urządzeniu
- Wzór wyśle Ci dowolny generator privacy policy dla apek dziecięcych (np. termly.io, freeprivacypolicy.com)

### 4. App content questionnaire
- **Privacy policy**: link do polityki
- **Ads**: No (nie masz reklam)
- **App access**: All functionality available without account
- **Content rating**: wypełnij kwestionariusz → wyjdzie `Everyone`
- **Target audience**: dzieci (j.w.)
- **Data safety**: deklarujesz co zbierasz (nic poza recordings/photos lokalnie na urządzeniu)
- **News app**: No
- **COVID-19 contact tracing**: No
- **Government apps**: No
- **Financial features**: No

### 5. Store listing
- **App name**: Teach Your Kids
- **Short description** (max 80 znaków): np. "Fiszki dla maluchów: litery, cyfry, kolory, zwierzęta. 7 języków, własny głos rodzica."
- **Full description** (max 4000): rozpisz funkcje
- **App icon** (512x512 PNG): masz w `app/assets/icon.png` — zweryfikuj rozmiar
- **Feature graphic** (1024x500 PNG): trzeba zrobić — bez tego nie da się publikować
- **Screenshots** (min 2, do 8): masz w `screenshots/` — sprawdź czy w 16:9 lub innym wymaganym formacie
- **App category**: Education
- **Tags**: dodaj relevant (toddler, flashcards, learning, ...)

### 6. Upload AAB
- **Production → Create new release**
- Wgraj `app/android/app/build/outputs/bundle/release/app-release.aab`
- Play App Signing: zaakceptuj że Google zarządza signing key (zalecane)
- Release notes (po polsku): np. "Pierwsza wersja: 7 języków, fiszki literek/cyfr/zwierząt/kolorów, własny głos rodzica."

### 7. Review + publikacja
- Pierwszy przegląd: 1-7 dni
- Statusy: In review → Approved → Live (po kilku godzinach od approval)

## Następne wersje

Po każdej zmianie kodu:
1. Bump `versionCode` w `app/android/app/build.gradle` (np. 1 → 2)
2. Opcjonalnie bump `versionName` (np. "1.0.0" → "1.0.1")
3. `./gradlew bundleRelease` produkuje nowy AAB
4. Upload do **Production → Create new release**

## Testowanie AAB lokalnie

AAB to nie APK — nie zainstalujesz go bezpośrednio. Trzy opcje:

### Opcja A: bundletool (CLI, najprostsze)
```bash
# pobierz bundletool
wget https://github.com/google/bundletool/releases/latest/download/bundletool-all-1.18.1.jar -O bundletool.jar

# wygeneruj uniwersalny APK do testu
java -jar bundletool.jar build-apks \
  --bundle=app/android/app/build/outputs/bundle/release/app-release.aab \
  --output=test.apks --mode=universal \
  --ks=app/android/keystores/release.jks --ks-pass=pass:HASLO \
  --ks-key-alias=teachyourkids --key-pass=pass:HASLO

# zainstaluj na podłączonym urządzeniu
java -jar bundletool.jar install-apks --apks=test.apks
```

### Opcja B: Internal testing track w Play Console
- Upload AAB do Internal testing
- Dodaj swoje konto Google jako tester
- Zainstaluj przez link Play (jak normalna apka)

## Pliki w repo

- `app/android/app/build.gradle` — release signingConfig + R8
- `app/android/.gitignore` — wyklucza keystores/ + keystore.properties
- `app/android/keystore.properties` — **NIE COMMITUJE SIĘ**, lokalne hasła
- `app/android/keystores/release.jks` — **NIE COMMITUJE SIĘ**, klucz

Wszystko działa: `git clone` na nową maszynę → trzeba odtworzyć tylko te 2 pliki z backupu.
