"""
Teach Your Kids — Content Data (multi-language)

Single source of truth for letters, numbers, colors and animals across
the 7 languages we support. Per-language fields below; image/sound files
are shared across languages where it makes sense (one cow image and one
real cow moo are reused for every language — only the spoken label changes).

Add a new language by adding its code to LANGUAGES, populating the
LETTERS_<lang>, COLOR / NUMBER / ANIMAL "labels" entries, and adding
TEMPLATES[lang] + EDGE_VOICES[lang].
"""

# =============================================================================
# Languages we ship audio + labels for
# =============================================================================
LANGUAGES = ["pl", "en", "de", "es", "fr", "it", "uk"]

# Edge-TTS neural voices — picked for warmth / kid-friendliness
EDGE_VOICES = {
    "pl": "pl-PL-ZofiaNeural",
    "en": "en-US-AnaNeural",          # only Cartoon/Cute voice in the catalogue
    "de": "de-DE-KatjaNeural",
    "es": "es-MX-DaliaNeural",        # Mexican Spanish — more melodic for kids
    "fr": "fr-FR-EloiseNeural",
    "it": "it-IT-IsabellaNeural",
    "uk": "uk-UA-PolinaNeural",
}

# Sentence templates per language. {x} placeholders are filled at gen time.
TEMPLATES = {
    "pl": {"letter": "{letter} jak {word}", "animal_intro": "{animal} mówi"},
    "en": {"letter": "{letter} is for {word}", "animal_intro": "The {animal} says"},
    "de": {"letter": "{letter} wie {word}", "animal_intro": "{animal} macht"},
    "es": {"letter": "{letter} de {word}", "animal_intro": "{animal} dice"},
    "fr": {"letter": "{letter} comme {word}", "animal_intro": "{animal} fait"},
    "it": {"letter": "{letter} come {word}", "animal_intro": "{animal} fa"},
    "uk": {"letter": "{letter} як {word}", "animal_intro": "{animal} говорить"},
}

# =============================================================================
# COLORS — image-less category (app fills the screen with hex)
# =============================================================================
COLORS = {
    "czerwony":     {"hex": "#FF0000", "labels": {"pl": "Czerwony",     "en": "Red",    "de": "Rot",     "es": "Rojo",     "fr": "Rouge",   "it": "Rosso",     "uk": "Червоний"}},
    "niebieski":    {"hex": "#0066FF", "labels": {"pl": "Niebieski",    "en": "Blue",   "de": "Blau",    "es": "Azul",     "fr": "Bleu",    "it": "Blu",       "uk": "Синій"}},
    "zielony":      {"hex": "#00CC00", "labels": {"pl": "Zielony",      "en": "Green",  "de": "Grün",    "es": "Verde",    "fr": "Vert",    "it": "Verde",     "uk": "Зелений"}},
    "zolty":        {"hex": "#FFD700", "labels": {"pl": "Żółty",        "en": "Yellow", "de": "Gelb",    "es": "Amarillo", "fr": "Jaune",   "it": "Giallo",    "uk": "Жовтий"}},
    "pomaranczowy": {"hex": "#FF8C00", "labels": {"pl": "Pomarańczowy", "en": "Orange", "de": "Orange",  "es": "Naranja",  "fr": "Orange",  "it": "Arancione", "uk": "Помаранчевий"}},
    "fioletowy":    {"hex": "#8B00FF", "labels": {"pl": "Fioletowy",    "en": "Purple", "de": "Lila",    "es": "Morado",   "fr": "Violet",  "it": "Viola",     "uk": "Фіолетовий"}},
    "rozowy":       {"hex": "#FF69B4", "labels": {"pl": "Różowy",       "en": "Pink",   "de": "Rosa",    "es": "Rosa",     "fr": "Rose",    "it": "Rosa",      "uk": "Рожевий"}},
    "bialy":        {"hex": "#FFFFFF", "labels": {"pl": "Biały",        "en": "White",  "de": "Weiß",    "es": "Blanco",   "fr": "Blanc",   "it": "Bianco",    "uk": "Білий"}},
    "czarny":       {"hex": "#222222", "labels": {"pl": "Czarny",       "en": "Black",  "de": "Schwarz", "es": "Negro",    "fr": "Noir",    "it": "Nero",      "uk": "Чорний"}},
    "brazowy":      {"hex": "#8B4513", "labels": {"pl": "Brązowy",      "en": "Brown",  "de": "Braun",   "es": "Marrón",   "fr": "Marron",  "it": "Marrone",   "uk": "Коричневий"}},
}

# =============================================================================
# NUMBERS 0–9 (shared image, per-language label spoken by lector)
# =============================================================================
NUMBERS = {
    "0": {"desc": "the digit 0", "labels": {"pl": "Zero",     "en": "Zero",  "de": "Null",   "es": "Cero",   "fr": "Zéro",   "it": "Zero",    "uk": "Нуль"}},
    "1": {"desc": "the digit 1", "labels": {"pl": "Jeden",    "en": "One",   "de": "Eins",   "es": "Uno",    "fr": "Un",     "it": "Uno",     "uk": "Один"}},
    "2": {"desc": "the digit 2", "labels": {"pl": "Dwa",      "en": "Two",   "de": "Zwei",   "es": "Dos",    "fr": "Deux",   "it": "Due",     "uk": "Два"}},
    "3": {"desc": "the digit 3", "labels": {"pl": "Trzy",     "en": "Three", "de": "Drei",   "es": "Tres",   "fr": "Trois",  "it": "Tre",     "uk": "Три"}},
    "4": {"desc": "the digit 4", "labels": {"pl": "Cztery",   "en": "Four",  "de": "Vier",   "es": "Cuatro", "fr": "Quatre", "it": "Quattro", "uk": "Чотири"}},
    "5": {"desc": "the digit 5", "labels": {"pl": "Pięć",     "en": "Five",  "de": "Fünf",   "es": "Cinco",  "fr": "Cinq",   "it": "Cinque",  "uk": "П'ять"}},
    "6": {"desc": "the digit 6", "labels": {"pl": "Sześć",    "en": "Six",   "de": "Sechs",  "es": "Seis",   "fr": "Six",    "it": "Sei",     "uk": "Шість"}},
    "7": {"desc": "the digit 7", "labels": {"pl": "Siedem",   "en": "Seven", "de": "Sieben", "es": "Siete",  "fr": "Sept",   "it": "Sette",   "uk": "Сім"}},
    "8": {"desc": "the digit 8", "labels": {"pl": "Osiem",    "en": "Eight", "de": "Acht",   "es": "Ocho",   "fr": "Huit",   "it": "Otto",    "uk": "Вісім"}},
    "9": {"desc": "the digit 9", "labels": {"pl": "Dziewięć", "en": "Nine",  "de": "Neun",   "es": "Nueve",  "fr": "Neuf",   "it": "Nove",    "uk": "Дев'ять"}},
}

# =============================================================================
# ANIMALS — image + raw sound (real CC0 recording) shared across languages
# Drop CC0 recordings into  assets/audio/animals/raw/<id>.mp3
# generate_audio.py will produce: TTS "<Animal> says:" + the raw sound concatenated.
# =============================================================================
ANIMALS = {
    "krowa":  {"image": "krowa.webp",  "sound": "krowa.mp3",  "desc": "cow, black and white spotted farm cow",
               "labels": {"pl": "Krowa",  "en": "Cow",     "de": "Die Kuh",       "es": "La vaca",   "fr": "La vache",   "it": "La mucca",     "uk": "Корова"}},
    "kot":    {"image": "kot.webp",    "sound": "kot.mp3",    "desc": "cat, cute fluffy orange tabby kitten",
               "labels": {"pl": "Kot",    "en": "Cat",     "de": "Die Katze",     "es": "El gato",   "fr": "Le chat",    "it": "Il gatto",     "uk": "Кіт"}},
    "pies":   {"image": "pies.webp",   "sound": "pies.mp3",   "desc": "dog, friendly golden retriever puppy",
               "labels": {"pl": "Pies",   "en": "Dog",     "de": "Der Hund",      "es": "El perro",  "fr": "Le chien",   "it": "Il cane",      "uk": "Пес"}},
    "kura":   {"image": "kura.webp",   "sound": "kura.mp3",   "desc": "chicken, brown hen with red comb",
               "labels": {"pl": "Kura",   "en": "Chicken", "de": "Das Huhn",      "es": "La gallina","fr": "La poule",   "it": "La gallina",   "uk": "Курка"}},
    "kogut":  {"image": "kogut.webp",  "sound": "kogut.mp3",  "desc": "rooster, colorful rooster with big red comb and tail feathers",
               "labels": {"pl": "Kogut",  "en": "Rooster", "de": "Der Hahn",      "es": "El gallo",  "fr": "Le coq",     "it": "Il gallo",     "uk": "Півень"}},
    "kaczka": {"image": "kaczka.webp", "sound": "kaczka.mp3", "desc": "duck, white and yellow duck on water",
               "labels": {"pl": "Kaczka", "en": "Duck",    "de": "Die Ente",      "es": "El pato",   "fr": "Le canard",  "it": "L'anatra",     "uk": "Качка"}},
    "kon":    {"image": "kon.webp",    "sound": "kon.mp3",    "desc": "horse, brown horse with dark mane",
               "labels": {"pl": "Koń",    "en": "Horse",   "de": "Das Pferd",     "es": "El caballo","fr": "Le cheval",  "it": "Il cavallo",   "uk": "Кінь"}},
    "swinia": {"image": "swinia.webp", "sound": "swinia.mp3", "desc": "pig, pink round piglet with curly tail",
               "labels": {"pl": "Świnia", "en": "Pig",     "de": "Das Schwein",   "es": "El cerdo",  "fr": "Le cochon",  "it": "Il maiale",    "uk": "Свиня"}},
    "owca":   {"image": "owca.webp",   "sound": "owca.mp3",   "desc": "sheep, fluffy white woolly sheep",
               "labels": {"pl": "Owca",   "en": "Sheep",   "de": "Das Schaf",     "es": "La oveja",  "fr": "Le mouton",  "it": "La pecora",    "uk": "Вівця"}},
    "koza":   {"image": "koza.webp",   "sound": "koza.mp3",   "desc": "goat, white goat with small horns and beard",
               "labels": {"pl": "Koza",   "en": "Goat",    "de": "Die Ziege",     "es": "La cabra",  "fr": "La chèvre",  "it": "La capra",     "uk": "Коза"}},
    "osiol":  {"image": "osiol.webp",  "sound": "osiol.mp3",  "desc": "donkey, grey donkey with big ears",
               "labels": {"pl": "Osioł",  "en": "Donkey",  "de": "Der Esel",      "es": "El burro",  "fr": "L'âne",      "it": "L'asino",      "uk": "Осел"}},
}

# =============================================================================
# LETTERS — per-language alphabet → word mappings
# Each language has its OWN list of (letter, word) pairs because:
#   - alphabets differ (Polish has Ś, German has Ü, Ukrainian uses Cyrillic)
#   - letter→word mapping is by FIRST LETTER, so words are completely different
# Words chosen: common, recognisable to a 2–4 year old, image-friendly.
# =============================================================================
LETTERS = {
    "pl": {
        "a": {"letter": "A", "word": "Arbuz", "desc": "watermelon, big round green striped fruit with red inside"},
        "b": {"letter": "B", "word": "Banan", "desc": "banana, yellow curved tropical fruit"},
        "c": {"letter": "C", "word": "Cytryna", "desc": "lemon, bright yellow oval citrus fruit"},
        "d": {"letter": "D", "word": "Dynia", "desc": "pumpkin, large round orange vegetable"},
        "f": {"letter": "F", "word": "Fasola", "desc": "green beans, long green string bean pods"},
        "g": {"letter": "G", "word": "Gruszka", "desc": "pear, green yellow pear-shaped fruit"},
        "j": {"letter": "J", "word": "Jabłko", "desc": "apple, round red and green fruit"},
        "k": {"letter": "K", "word": "Kiwi", "desc": "kiwi fruit, small brown fuzzy oval fruit with green inside"},
        "m": {"letter": "M", "word": "Malina", "desc": "raspberry, fresh vibrant red raspberry with a small crisp green leaf"},
        "n": {"letter": "N", "word": "Nektarynka", "desc": "nectarine, smooth round orange-red stone fruit"},
        "o": {"letter": "O", "word": "Ogórek", "desc": "cucumber, long green vegetable"},
        "p": {"letter": "P", "word": "Pomidor", "desc": "tomato, round red shiny vegetable"},
        "r": {"letter": "R", "word": "Rzodkiewka", "desc": "radish, small round red root vegetable with white inside"},
        "salata": {"letter": "S", "word": "Sałata", "desc": "lettuce, fresh bright green crispy leafy head of lettuce"},
        "sliwka": {"letter": "Ś", "word": "Śliwka", "desc": "plum, small oval purple-blue fruit"},
        "t": {"letter": "T", "word": "Truskawka", "desc": "strawberry, red heart-shaped berry with seeds"},
        "w": {"letter": "W", "word": "Winogrono", "desc": "grape, small round purple or green fruit in bunches"},
        "z": {"letter": "Z", "word": "Ziemniak", "desc": "potato, fresh raw brown potato"},
    },
    "en": {
        "a": {"letter": "A", "word": "Apple", "desc": "apple, round red and green fruit"},
        "b": {"letter": "B", "word": "Banana", "desc": "banana, yellow curved tropical fruit"},
        "c": {"letter": "C", "word": "Carrot", "desc": "carrot, long orange root vegetable"},
        "d": {"letter": "D", "word": "Date", "desc": "date fruit, small brown oval dried fruit"},
        "e": {"letter": "E", "word": "Eggplant", "desc": "eggplant, large purple oval vegetable"},
        "f": {"letter": "F", "word": "Fig", "desc": "fig, ripe purple fig cut in half showing red inside"},
        "g": {"letter": "G", "word": "Grape", "desc": "grape, small round purple fruit in bunches"},
        "k": {"letter": "K", "word": "Kiwi", "desc": "kiwi fruit, small brown fuzzy oval fruit with green inside"},
        "l": {"letter": "L", "word": "Lemon", "desc": "lemon, bright yellow oval citrus fruit"},
        "m": {"letter": "M", "word": "Mango", "desc": "mango, large oval tropical fruit, yellow-orange"},
        "n": {"letter": "N", "word": "Nectarine", "desc": "nectarine, smooth round orange-red stone fruit"},
        "o": {"letter": "O", "word": "Orange", "desc": "orange, round citrus fruit, bright orange color"},
        "p": {"letter": "P", "word": "Peach", "desc": "peach, round fuzzy orange-pink stone fruit"},
        "r": {"letter": "R", "word": "Raspberry", "desc": "raspberry, fresh vibrant red raspberry with a small crisp green leaf"},
        "s": {"letter": "S", "word": "Strawberry", "desc": "strawberry, red heart-shaped berry with seeds"},
        "t": {"letter": "T", "word": "Tomato", "desc": "tomato, round red shiny vegetable"},
        "w": {"letter": "W", "word": "Watermelon", "desc": "watermelon, big round green striped fruit with red inside"},
        "z": {"letter": "Z", "word": "Zucchini", "desc": "zucchini, long green summer squash vegetable"},
    },
    "de": {
        "a": {"letter": "A", "word": "Apfel", "desc": "apple, round red and green fruit"},
        "b": {"letter": "B", "word": "Banane", "desc": "banana, yellow curved tropical fruit"},
        "c": {"letter": "C", "word": "Champignon", "desc": "white button mushroom, with a smooth round cap"},
        "d": {"letter": "D", "word": "Dattel", "desc": "date fruit, small brown oval dried fruit"},
        "e": {"letter": "E", "word": "Erdbeere", "desc": "strawberry, red heart-shaped berry with seeds"},
        "f": {"letter": "F", "word": "Feige", "desc": "fig, ripe purple fig cut in half showing red inside"},
        "g": {"letter": "G", "word": "Gurke", "desc": "cucumber, long green vegetable"},
        "h": {"letter": "H", "word": "Himbeere", "desc": "raspberry, fresh vibrant red raspberry"},
        "k": {"letter": "K", "word": "Kirsche", "desc": "cherry, two red cherries on a stem with green leaf"},
        "l": {"letter": "L", "word": "Limette", "desc": "lime, bright green oval citrus fruit"},
        "m": {"letter": "M", "word": "Mango", "desc": "mango, large oval tropical fruit, yellow-orange"},
        "n": {"letter": "N", "word": "Nuss", "desc": "walnut, round wrinkly brown nut"},
        "o": {"letter": "O", "word": "Orange", "desc": "orange, round citrus fruit, bright orange color"},
        "p": {"letter": "P", "word": "Pflaume", "desc": "plum, small oval purple-blue fruit"},
        "r": {"letter": "R", "word": "Rote Bete", "desc": "beetroot, round red-purple root vegetable"},
        "s": {"letter": "S", "word": "Salat", "desc": "lettuce, fresh bright green crispy leafy head of lettuce"},
        "t": {"letter": "T", "word": "Tomate", "desc": "tomato, round red shiny vegetable"},
        "w": {"letter": "W", "word": "Weintraube", "desc": "grape, small round purple fruit in bunches"},
        "z": {"letter": "Z", "word": "Zitrone", "desc": "lemon, bright yellow oval citrus fruit"},
    },
    "es": {
        "a": {"letter": "A", "word": "Aguacate", "desc": "avocado, dark green oval fruit cut in half showing pit"},
        "b": {"letter": "B", "word": "Banana", "desc": "banana, yellow curved tropical fruit"},
        "c": {"letter": "C", "word": "Cereza", "desc": "cherry, two red cherries on a stem with green leaf"},
        "d": {"letter": "D", "word": "Durazno", "desc": "peach, round fuzzy orange-pink stone fruit"},
        "e": {"letter": "E", "word": "Espinaca", "desc": "spinach, fresh dark green leafy vegetable"},
        "f": {"letter": "F", "word": "Fresa", "desc": "strawberry, red heart-shaped berry with seeds"},
        "g": {"letter": "G", "word": "Granada", "desc": "pomegranate, round red fruit cut in half showing red seeds"},
        "h": {"letter": "H", "word": "Higo", "desc": "fig, ripe purple fig cut in half showing red inside"},
        "k": {"letter": "K", "word": "Kiwi", "desc": "kiwi fruit, small brown fuzzy oval fruit with green inside"},
        "l": {"letter": "L", "word": "Limón", "desc": "lemon, bright yellow oval citrus fruit"},
        "m": {"letter": "M", "word": "Manzana", "desc": "apple, round red and green fruit"},
        "n": {"letter": "N", "word": "Naranja", "desc": "orange, round citrus fruit, bright orange color"},
        "p": {"letter": "P", "word": "Pera", "desc": "pear, green yellow pear-shaped fruit"},
        "r": {"letter": "R", "word": "Rábano", "desc": "radish, small round red root vegetable with white inside"},
        "s": {"letter": "S", "word": "Sandía", "desc": "watermelon, big round green striped fruit with red inside"},
        "t": {"letter": "T", "word": "Tomate", "desc": "tomato, round red shiny vegetable"},
        "u": {"letter": "U", "word": "Uva", "desc": "grape, small round purple fruit in bunches"},
        "z": {"letter": "Z", "word": "Zanahoria", "desc": "carrot, long orange root vegetable"},
    },
    "fr": {
        "a": {"letter": "A", "word": "Ananas", "desc": "pineapple, large yellow tropical fruit with green spiky leaves"},
        "b": {"letter": "B", "word": "Banane", "desc": "banana, yellow curved tropical fruit"},
        "c": {"letter": "C", "word": "Cerise", "desc": "cherry, two red cherries on a stem with green leaf"},
        "d": {"letter": "D", "word": "Datte", "desc": "date fruit, small brown oval dried fruit"},
        "e": {"letter": "E", "word": "Épinard", "desc": "spinach, fresh dark green leafy vegetable"},
        "f": {"letter": "F", "word": "Fraise", "desc": "strawberry, red heart-shaped berry with seeds"},
        "g": {"letter": "G", "word": "Grenade", "desc": "pomegranate, round red fruit cut in half showing red seeds"},
        "h": {"letter": "H", "word": "Haricot", "desc": "green beans, long green string bean pods"},
        "k": {"letter": "K", "word": "Kiwi", "desc": "kiwi fruit, small brown fuzzy oval fruit with green inside"},
        "l": {"letter": "L", "word": "Laitue", "desc": "lettuce, fresh bright green crispy leafy head of lettuce"},
        "m": {"letter": "M", "word": "Mangue", "desc": "mango, large oval tropical fruit, yellow-orange"},
        "n": {"letter": "N", "word": "Noix", "desc": "walnut, round wrinkly brown nut"},
        "o": {"letter": "O", "word": "Orange", "desc": "orange, round citrus fruit, bright orange color"},
        "p": {"letter": "P", "word": "Pomme", "desc": "apple, round red and green fruit"},
        "r": {"letter": "R", "word": "Raisin", "desc": "grape, small round purple fruit in bunches"},
        "s": {"letter": "S", "word": "Salade", "desc": "lettuce, fresh bright green crispy leafy head of lettuce"},
        "t": {"letter": "T", "word": "Tomate", "desc": "tomato, round red shiny vegetable"},
        "v": {"letter": "V", "word": "Vinaigrette", "desc": "olive oil, glass bottle of golden olive oil"},
    },
    "it": {
        "a": {"letter": "A", "word": "Anguria", "desc": "watermelon, big round green striped fruit with red inside"},
        "b": {"letter": "B", "word": "Banana", "desc": "banana, yellow curved tropical fruit"},
        "c": {"letter": "C", "word": "Ciliegia", "desc": "cherry, two red cherries on a stem with green leaf"},
        "d": {"letter": "D", "word": "Datteri", "desc": "date fruit, small brown oval dried fruit"},
        "e": {"letter": "E", "word": "Edamame", "desc": "edamame, fresh green soybean pods"},
        "f": {"letter": "F", "word": "Fragola", "desc": "strawberry, red heart-shaped berry with seeds"},
        "g": {"letter": "G", "word": "Gelato", "desc": "ice cream cone, vanilla scoops in a waffle cone"},
        "i": {"letter": "I", "word": "Insalata", "desc": "salad, fresh bright green crispy leafy head of lettuce"},
        "k": {"letter": "K", "word": "Kiwi", "desc": "kiwi fruit, small brown fuzzy oval fruit with green inside"},
        "l": {"letter": "L", "word": "Limone", "desc": "lemon, bright yellow oval citrus fruit"},
        "m": {"letter": "M", "word": "Mela", "desc": "apple, round red and green fruit"},
        "n": {"letter": "N", "word": "Nocciola", "desc": "hazelnut, small round brown nut with shell"},
        "o": {"letter": "O", "word": "Oliva", "desc": "olive, single shiny black olive on a small green leaf"},
        "p": {"letter": "P", "word": "Pera", "desc": "pear, green yellow pear-shaped fruit"},
        "r": {"letter": "R", "word": "Rapa", "desc": "turnip, round white-purple root vegetable"},
        "s": {"letter": "S", "word": "Susina", "desc": "plum, small oval purple-blue fruit"},
        "t": {"letter": "T", "word": "Tomate", "desc": "tomato, round red shiny vegetable"},
        "u": {"letter": "U", "word": "Uva", "desc": "grape, small round purple fruit in bunches"},
        "z": {"letter": "Z", "word": "Zucca", "desc": "pumpkin, large round orange vegetable"},
    },
    "uk": {
        "a": {"letter": "А", "word": "Авокадо", "desc": "avocado, dark green oval fruit cut in half showing pit"},
        "b": {"letter": "Б", "word": "Банан", "desc": "banana, yellow curved tropical fruit"},
        "v": {"letter": "В", "word": "Вишня", "desc": "sour cherry, two red cherries on a stem with green leaf"},
        "h": {"letter": "Г", "word": "Гарбуз", "desc": "pumpkin, large round orange vegetable"},
        "g": {"letter": "Ґ", "word": "Ґудзик", "desc": "button, single colorful round button on white"},
        "d": {"letter": "Д", "word": "Диня", "desc": "honeydew melon, oval pale green melon"},
        "e": {"letter": "Е", "word": "Еклер", "desc": "eclair, chocolate-glazed pastry on a plate"},
        "zh": {"letter": "Ж", "word": "Жолудь", "desc": "acorn, single brown acorn with cap"},
        "z": {"letter": "З", "word": "Зелень", "desc": "fresh herbs, dill and parsley bunch"},
        "y": {"letter": "И", "word": "Ириска", "desc": "toffee candy, golden-brown wrapped toffee"},
        "i": {"letter": "І", "word": "Інжир", "desc": "fig, ripe purple fig cut in half showing red inside"},
        "k": {"letter": "К", "word": "Кавун", "desc": "watermelon, big round green striped fruit with red inside"},
        "l": {"letter": "Л", "word": "Лимон", "desc": "lemon, bright yellow oval citrus fruit"},
        "m": {"letter": "М", "word": "Морква", "desc": "carrot, long orange root vegetable"},
        "n": {"letter": "Н", "word": "Ніж", "desc": "kid-safe knife, plastic toy knife"},
        "o": {"letter": "О", "word": "Огірок", "desc": "cucumber, long green vegetable"},
        "p": {"letter": "П", "word": "Полуниця", "desc": "strawberry, red heart-shaped berry with seeds"},
        "r": {"letter": "Р", "word": "Редиска", "desc": "radish, small round red root vegetable with white inside"},
        "s": {"letter": "С", "word": "Слива", "desc": "plum, small oval purple-blue fruit"},
        "t": {"letter": "Т", "word": "Томат", "desc": "tomato, round red shiny vegetable"},
        "u": {"letter": "У", "word": "Урюк", "desc": "dried apricot, orange-brown dried apricot"},
        "f": {"letter": "Ф", "word": "Фініки", "desc": "date fruit, small brown oval dried fruit"},
        "kh": {"letter": "Х", "word": "Хліб", "desc": "bread, golden round loaf of bread"},
        "ts": {"letter": "Ц", "word": "Цибуля", "desc": "onion, round papery brown onion"},
        "ch": {"letter": "Ч", "word": "Часник", "desc": "garlic, single white garlic bulb"},
        "sh": {"letter": "Ш", "word": "Шоколад", "desc": "chocolate bar, dark chocolate bar broken in pieces"},
        "ia": {"letter": "Я", "word": "Яблуко", "desc": "apple, round red and green fruit"},
    },
}
# Languages whose letters fall back to a placeholder (FR has no Z/W in core kid words; tweak as needed)
def get_letters_for(lang):
    return LETTERS.get(lang, {})

# =============================================================================
# IMAGE STYLE PREFIXES — unchanged
# =============================================================================
IMAGE_STYLE_PREFIX = (
    "A single centered object on a plain solid white background, "
    "children's educational flashcard illustration, "
    "flat vector art style, thick black outlines, "
    "soft pastel color palette (baby blue, mint green, peach, lavender, butter yellow), "
    "rounded friendly shapes, kawaii cute style with big eyes and happy expression, "
    "simple minimal composition, no shadows, no gradients, no texture, "
    "no text, no letters, no words, no numbers, "
    "consistent flat digital illustration, high quality, 2D. "
)

FRUIT_VEG_STYLE_PREFIX = (
    "A single centered object on a plain solid white background, "
    "high quality educational illustration, "
    "highly detailed 3D cartoon pixar style, soft studio lighting, "
    "vibrant and playful colors, highly recognizable but slightly stylized and animated looking, "
    "NO eyes, NO mouth, NO face, NO kawaii elements, "
    "clean minimal composition, subtle natural shadows, "
    "no text, no letters, no words, no numbers, "
    "professional digital art, 8k resolution. "
)

NUMBER_STYLE_PREFIX = (
    "A single centered huge object on a plain solid white background, "
    "high quality educational illustration, "
    "bold 3D cartoon style, soft studio lighting, "
    "vibrant colorful shiny plastic material, highly recognizable, "
    "NO eyes, NO mouth, NO face, NO stars, NO kawaii elements, "
    "clean minimal composition, subtle drop shadow, "
    "no extra text, no words, "
    "professional digital art, 8k resolution. "
)

IMAGE_CONFIG = {
    # Qwen-Image GGUF + Lightning 8-step LoRA — same pipeline as menu graphics
    "unet": "qwen-image-2512-Q6_K.gguf",
    "clip": "qwen_2.5_vl_7b_fp8_scaled.safetensors",
    "vae":  "qwen_image_vae.safetensors",
    "lora": "Qwen-Image-Lightning-8steps-V2.0-bf16.safetensors",
    "width": 768,
    "height": 768,
    "steps": 8,
    "guidance_scale": 1.0,  # Lightning LoRA wants very low CFG
    "output_format": "webp",
    "webp_quality": 90,
}


# =============================================================================
# Asset enumeration helpers — used by generate_audio.py and generate_images.py
# =============================================================================
def get_all_audio_texts():
    """All TTS jobs across all languages. Each entry has:
       - id: stable identifier
       - filename: relative path under assets/audio/
       - text: text for TTS
       - lang: language code (drives voice selection)
       - kind: 'plain' (TTS only) or 'animal' (TTS intro + concat with raw sound)
       - raw_sound: only for kind='animal' — path under assets/audio/animals/raw/
    """
    audio = []

    # Colors
    for key, data in COLORS.items():
        for lang in LANGUAGES:
            label = data["labels"].get(lang)
            if not label:
                continue
            audio.append({
                "id": f"color_{lang}_{key}",
                "filename": f"{lang}/color_{key}.mp3",
                "text": label,
                "lang": lang,
                "kind": "plain",
            })

    # Numbers
    for key, data in NUMBERS.items():
        for lang in LANGUAGES:
            label = data["labels"].get(lang)
            if not label:
                continue
            audio.append({
                "id": f"number_{lang}_{key}",
                "filename": f"{lang}/number_{key}.mp3",
                "text": label,
                "lang": lang,
                "kind": "plain",
            })

    # Letters — uses TEMPLATES[lang]['letter']
    for lang, items in LETTERS.items():
        tmpl = TEMPLATES.get(lang, {}).get("letter", "{letter} {word}")
        for key, d in items.items():
            audio.append({
                "id": f"letter_{lang}_{key}",
                "filename": f"{lang}/letter_{key}.mp3",
                "text": tmpl.format(letter=d["letter"], word=d["word"]),
                "lang": lang,
                "kind": "plain",
            })

    # Animals — TTS intro + concat with raw recording
    for key, data in ANIMALS.items():
        raw_path = f"animals/raw/{data['sound']}"
        for lang in LANGUAGES:
            label = data["labels"].get(lang)
            if not label:
                continue
            tmpl = TEMPLATES.get(lang, {}).get("animal_intro", "{animal}")
            audio.append({
                "id": f"animal_{lang}_{key}",
                "filename": f"{lang}/animal_{key}.mp3",
                "text": tmpl.format(animal=label),
                "lang": lang,
                "kind": "animal",
                "raw_sound": raw_path,
            })

    return audio


def get_all_image_prompts():
    """All image-generation jobs. Images are SHARED across languages."""
    prompts = []

    # Letters per-language (different objects per language so images differ)
    for lang, items in LETTERS.items():
        for key, d in items.items():
            prompts.append({
                "id": f"letters_{lang}_{key}",
                "filename": f"letters/{lang}/{key}_{d['word'].lower().replace(' ', '_')}.webp",
                "prompt": FRUIT_VEG_STYLE_PREFIX + f"A single {d['desc']}, accurate and appealing to small children",
            })

    # Numbers — shared
    for key, d in NUMBERS.items():
        prompts.append({
            "id": f"numbers_{key}",
            "filename": f"numbers/{key}.webp",
            "prompt": NUMBER_STYLE_PREFIX + f"A large colorful cartoon {d['desc']}, playful and fun, bright cheerful colors",
        })

    # Animals — shared
    for key, d in ANIMALS.items():
        prompts.append({
            "id": f"animals_{key}",
            "filename": f"animals/{key}.webp",
            "prompt": IMAGE_STYLE_PREFIX + f"A friendly {d['desc']}, happy expression, suitable for very young children",
        })

    return prompts


if __name__ == "__main__":
    audio = get_all_audio_texts()
    prompts = get_all_image_prompts()
    print(f"Languages: {len(LANGUAGES)} ({', '.join(LANGUAGES)})")
    print(f"Audio entries: {len(audio)}")
    print(f"Image prompts: {len(prompts)}")
    by_lang = {}
    for a in audio:
        by_lang.setdefault(a["lang"], 0)
        by_lang[a["lang"]] += 1
    print("\nAudio per language:")
    for lang, n in sorted(by_lang.items()):
        print(f"  {lang}: {n}")
    print("\nLetter counts per language:")
    for lang, items in LETTERS.items():
        print(f"  {lang}: {len(items)} letters")
