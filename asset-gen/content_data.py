"""
Teach Your Kids — Content Data
All educational content definitions for image and audio generation.
"""

# =============================================================================
# COLORS (10 colors)
# No images needed — app displays full-screen color
# =============================================================================
COLORS = {
    "czerwony":     {"pl": "Czerwony",     "en": "Red",    "hex": "#FF0000"},
    "niebieski":    {"pl": "Niebieski",    "en": "Blue",   "hex": "#0066FF"},
    "zielony":      {"pl": "Zielony",      "en": "Green",  "hex": "#00CC00"},
    "zolty":        {"pl": "Żółty",        "en": "Yellow", "hex": "#FFD700"},
    "pomaranczowy": {"pl": "Pomarańczowy", "en": "Orange", "hex": "#FF8C00"},
    "fioletowy":    {"pl": "Fioletowy",    "en": "Purple", "hex": "#8B00FF"},
    "rozowy":       {"pl": "Różowy",       "en": "Pink",   "hex": "#FF69B4"},
    "bialy":        {"pl": "Biały",        "en": "White",  "hex": "#FFFFFF"},
    "czarny":       {"pl": "Czarny",       "en": "Black",  "hex": "#222222"},
    "brazowy":      {"pl": "Brązowy",      "en": "Brown",  "hex": "#8B4513"},
}

# =============================================================================
# LETTERS — Polish (only letters with well-known fruits/vegetables)
# RULE: letter must EXACTLY match the first letter of the word
# Skip letters without a clear, common fruit or vegetable
# =============================================================================
LETTERS_PL = {
    "a": {"letter": "A", "word": "Arbuz",       "desc": "watermelon, big round green striped fruit with red inside"},
    "b": {"letter": "B", "word": "Banan",       "desc": "banana, yellow curved tropical fruit"},
    "c": {"letter": "C", "word": "Cytryna",     "desc": "lemon, bright yellow oval citrus fruit"},
    "d": {"letter": "D", "word": "Dynia",       "desc": "pumpkin, large round orange vegetable"},
    "f": {"letter": "F", "word": "Fasola",      "desc": "green beans, long green string bean pods"},
    "g": {"letter": "G", "word": "Gruszka",     "desc": "pear, green yellow pear-shaped fruit"},
    "j": {"letter": "J", "word": "Jabłko",      "desc": "apple, round red and green fruit"},
    "k": {"letter": "K", "word": "Kiwi",        "desc": "kiwi fruit, small brown fuzzy oval fruit with green inside"},
    "m": {"letter": "M", "word": "Malina",      "desc": "raspberry, highly detailed fresh vibrant red raspberry with a small crisp green leaf"},
    "n": {"letter": "N", "word": "Nektarynka",  "desc": "nectarine, smooth round orange-red stone fruit"},
    "o": {"letter": "O", "word": "Ogórek",      "desc": "cucumber, long green vegetable"},
    "p": {"letter": "P", "word": "Pomidor",     "desc": "tomato, round red shiny vegetable"},
    "r": {"letter": "R", "word": "Rzodkiewka",  "desc": "radish, small round red root vegetable with white inside"},
    "s": {"letter": "S", "word": "Sałata",      "desc": "lettuce, fresh bright green crispy leafy head of lettuce"},
    "ś": {"letter": "Ś", "word": "Śliwka",      "desc": "plum, small oval purple-blue fruit"},
    "t": {"letter": "T", "word": "Truskawka",   "desc": "strawberry, red heart-shaped berry with seeds"},
    "w": {"letter": "W", "word": "Winogrono",   "desc": "grape, small round purple or green fruit in bunches"},
    "z": {"letter": "Z", "word": "Ziemniak",    "desc": "potato, highly detailed clean fresh raw brown potato, realistic appetizing texture"},
}
# Skipped: Ą, Ć, E, Ę, H, I, L, Ł, Ń, Ó, U, X, Y, Ź, Ż
# Reason: no commonly known fruit/vegetable starting with these letters

# =============================================================================
# LETTERS — English (only letters with well-known fruits/vegetables)
# =============================================================================
LETTERS_EN = {
    "a": {"letter": "A", "word": "Apple",       "desc": "apple, round red and green fruit"},
    "b": {"letter": "B", "word": "Banana",      "desc": "banana, yellow curved tropical fruit"},
    "c": {"letter": "C", "word": "Carrot",      "desc": "carrot, long orange root vegetable"},
    "d": {"letter": "D", "word": "Date",        "desc": "date fruit, small brown oval dried fruit"},
    "e": {"letter": "E", "word": "Eggplant",    "desc": "eggplant, large purple oval vegetable"},
    "f": {"letter": "F", "word": "Fig",         "desc": "fig, ripe purple fig cut in half showing red inside"},
    "g": {"letter": "G", "word": "Grape",       "desc": "grape, small round purple fruit in bunches"},
    "k": {"letter": "K", "word": "Kiwi",        "desc": "kiwi fruit, small brown fuzzy oval fruit with green inside"},
    "l": {"letter": "L", "word": "Lemon",       "desc": "lemon, bright yellow oval citrus fruit"},
    "m": {"letter": "M", "word": "Mango",       "desc": "mango, large oval tropical fruit, yellow-orange"},
    "n": {"letter": "N", "word": "Nectarine",   "desc": "nectarine, smooth round orange-red stone fruit"},
    "o": {"letter": "O", "word": "Orange",      "desc": "orange, round citrus fruit, bright orange color"},
    "p": {"letter": "P", "word": "Peach",       "desc": "peach, round fuzzy orange-pink stone fruit"},
    "r": {"letter": "R", "word": "Raspberry",   "desc": "raspberry, highly detailed fresh vibrant red raspberry with a small crisp green leaf"},
    "s": {"letter": "S", "word": "Strawberry",  "desc": "strawberry, red heart-shaped berry with seeds"},
    "t": {"letter": "T", "word": "Tomato",      "desc": "tomato, round red shiny vegetable"},
    "w": {"letter": "W", "word": "Watermelon",  "desc": "watermelon, big round green striped fruit with red inside"},
    "z": {"letter": "Z", "word": "Zucchini",    "desc": "zucchini, long green summer squash vegetable"},
}
# Skipped: H, I, J, Q, U, V, X, Y
# Reason: no very common, child-friendly fruit/vegetable

# =============================================================================
# NUMBERS (0-9)
# Images: large colorful cartoon digit
# =============================================================================
NUMBERS = {
    "0":  {"pl": "Zero",     "en": "Zero",  "desc": "the digit 0"},
    "1":  {"pl": "Jeden",    "en": "One",   "desc": "the digit 1"},
    "2":  {"pl": "Dwa",      "en": "Two",   "desc": "the digit 2"},
    "3":  {"pl": "Trzy",     "en": "Three", "desc": "the digit 3"},
    "4":  {"pl": "Cztery",   "en": "Four",  "desc": "the digit 4"},
    "5":  {"pl": "Pięć",     "en": "Five",  "desc": "the digit 5"},
    "6":  {"pl": "Sześć",    "en": "Six",   "desc": "the digit 6"},
    "7":  {"pl": "Siedem",   "en": "Seven", "desc": "the digit 7"},
    "8":  {"pl": "Osiem",    "en": "Eight", "desc": "the digit 8"},
    "9":  {"pl": "Dziewięć", "en": "Nine",  "desc": "the digit 9"},
}

# =============================================================================
# ANIMALS (18 domestic & farm animals)
# =============================================================================
ANIMALS = {
    "krowa":         {"pl": "Krowa",          "en": "Cow",        "sound_pl": "Muuu!",              "sound_en": "Moo!",                "desc": "cow, black and white spotted farm cow"},
    "kot":           {"pl": "Kot",            "en": "Cat",        "sound_pl": "Miau!",              "sound_en": "Meow!",               "desc": "cat, cute fluffy orange tabby kitten"},
    "pies":          {"pl": "Pies",           "en": "Dog",        "sound_pl": "Hau hau!",           "sound_en": "Woof woof!",          "desc": "dog, friendly golden retriever puppy"},
    "kura":          {"pl": "Kura",           "en": "Chicken",    "sound_pl": "Ko ko ko!",          "sound_en": "Cluck cluck!",        "desc": "chicken, brown hen with red comb"},
    "kogut":         {"pl": "Kogut",          "en": "Rooster",    "sound_pl": "Kukuryku!",          "sound_en": "Cock-a-doodle-doo!",  "desc": "rooster, colorful rooster with big red comb and tail feathers"},
    "kaczka":        {"pl": "Kaczka",         "en": "Duck",       "sound_pl": "Kwa kwa!",           "sound_en": "Quack quack!",        "desc": "duck, white and yellow duck on water"},
    "kon":           {"pl": "Koń",            "en": "Horse",      "sound_pl": "Ihaha!",             "sound_en": "Neigh!",              "desc": "horse, brown horse with dark mane"},
    "swinia":        {"pl": "Świnia",         "en": "Pig",        "sound_pl": "Chrum chrum!",       "sound_en": "Oink oink!",          "desc": "pig, pink round piglet with curly tail"},
    "owca":          {"pl": "Owca",           "en": "Sheep",      "sound_pl": "Bee!",               "sound_en": "Baa!",                "desc": "sheep, fluffy white woolly sheep"},
    "koza":          {"pl": "Koza",           "en": "Goat",       "sound_pl": "Mee!",               "sound_en": "Meh!",                "desc": "goat, white goat with small horns and beard"},
    "osiol":         {"pl": "Osioł",          "en": "Donkey",     "sound_pl": "Iaa!",               "sound_en": "Hee-haw!",            "desc": "donkey, grey donkey with big ears"},
}

# =============================================================================
# IMAGE GENERATION CONFIG
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
    "model_path": "black-forest-labs/FLUX.2-klein-4B",
    "local_checkpoint": r"C:\Users\mktel\Documents\ComfyUI\models\diffusion_models\flux-2-klein-4b-fp8.safetensors",
    "text_encoder": r"C:\Users\mktel\Documents\ComfyUI\models\text_encoders\qwen_3_4b_fp4_flux2.safetensors",
    "vae": r"C:\Users\mktel\Documents\ComfyUI\models\vae\flux2-vae.safetensors",
    "width": 768,
    "height": 768,
    "steps": 20,
    "guidance_scale": 3.5,
    "output_format": "webp",
    "webp_quality": 90,
}

# =============================================================================
# TTS CONFIG
# =============================================================================
TTS_CONFIG = {
    "pl_model": "pl_PL-gosia-medium",
    "en_model": "en_US-lessac-medium",
    "sample_rate": 22050,
    "output_format": "mp3",
}


def get_all_image_prompts():
    """Generate all image prompts for batch generation."""
    prompts = []

    # Letters PL
    for key, data in LETTERS_PL.items():
        prompts.append({
            "id": f"letters_pl_{key}",
            "filename": f"letters/pl/{key}_{data['word'].lower()}.webp",
            "prompt": FRUIT_VEG_STYLE_PREFIX + f"A single {data['desc']}, accurate and appealing to small children",
        })

    # Letters EN
    for key, data in LETTERS_EN.items():
        prompts.append({
            "id": f"letters_en_{key}",
            "filename": f"letters/en/{key}_{data['word'].lower()}.webp",
            "prompt": FRUIT_VEG_STYLE_PREFIX + f"A single {data['desc']}, accurate and appealing to small children",
        })

    # Numbers
    for key, data in NUMBERS.items():
        prompts.append({
            "id": f"numbers_{key}",
            "filename": f"numbers/{key}.webp",
            "prompt": NUMBER_STYLE_PREFIX + f"A large colorful cartoon {data['desc']}, playful and fun, bright cheerful colors",
        })

    # Animals
    for key, data in ANIMALS.items():
        prompts.append({
            "id": f"animals_{key}",
            "filename": f"animals/{key}.webp",
            "prompt": IMAGE_STYLE_PREFIX + f"A friendly {data['desc']}, happy expression, suitable for very young children",
        })

    return prompts


def get_all_audio_texts():
    """Generate all TTS text entries for batch audio generation."""
    audio = []

    # Colors
    for key, data in COLORS.items():
        audio.append({"id": f"color_pl_{key}", "filename": f"pl/color_{key}.mp3", "text": data["pl"], "lang": "pl"})
        audio.append({"id": f"color_en_{key}", "filename": f"en/color_{key}.mp3", "text": data["en"], "lang": "en"})

    # Letters PL: "A jak Arbuz"
    for key, data in LETTERS_PL.items():
        audio.append({
            "id": f"letter_pl_{key}",
            "filename": f"pl/letter_{key}.mp3",
            "text": f"{data['letter']} jak {data['word']}",
            "lang": "pl",
        })

    # Letters EN: "A is for Apple"
    for key, data in LETTERS_EN.items():
        audio.append({
            "id": f"letter_en_{key}",
            "filename": f"en/letter_{key}.mp3",
            "text": f"{data['letter']} is for {data['word']}",
            "lang": "en",
        })

    # Numbers
    for key, data in NUMBERS.items():
        audio.append({"id": f"number_pl_{key}", "filename": f"pl/number_{key}.mp3", "text": data["pl"], "lang": "pl"})
        audio.append({"id": f"number_en_{key}", "filename": f"en/number_{key}.mp3", "text": data["en"], "lang": "en"})

    # Animals: "Krowa mówi: Muuu!" / "The cow says: Moo!"
    for key, data in ANIMALS.items():
        audio.append({
            "id": f"animal_pl_{key}",
            "filename": f"pl/animal_{key}.mp3",
            "text": f"{data['pl']} mówi: {data['sound_pl']}",
            "lang": "pl",
        })
        audio.append({
            "id": f"animal_en_{key}",
            "filename": f"en/animal_{key}.mp3",
            "text": f"The {data['en'].lower()} says: {data['sound_en']}",
            "lang": "en",
        })

    return audio


if __name__ == "__main__":
    prompts = get_all_image_prompts()
    audio = get_all_audio_texts()
    print(f"Total image prompts: {len(prompts)}")
    print(f"Total audio entries: {len(audio)}")
    print(f"\n--- Image categories ---")
    print(f"  Letters PL: {len(LETTERS_PL)}")
    print(f"  Letters EN: {len(LETTERS_EN)}")
    print(f"  Numbers:    {len(NUMBERS)}")
    print(f"  Animals:    {len(ANIMALS)}")
    print(f"\n--- Sample prompts ---")
    for p in prompts[:3]:
        print(f"  [{p['id']}] {p['prompt'][:80]}...")
    print(f"\n--- Sample audio ---")
    for a in audio[:6]:
        print(f"  [{a['id']}] ({a['lang']}) \"{a['text']}\"")
