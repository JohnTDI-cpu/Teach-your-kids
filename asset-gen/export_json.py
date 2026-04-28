import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from content_data import ANIMALS, LETTERS_PL, LETTERS_EN, NUMBERS, COLORS

data = {
    "animals": [],
    "letters_pl": [],
    "letters_en": [],
    "numbers": [],
    "colors": []
}

for k, v in ANIMALS.items():
    data["animals"].append({
        "id": f"animals_{k}",
        "filename": f"animals/{k}.webp",
        "audio_pl": f"pl/animal_{k}.mp3",
        "audio_en": f"en/animal_{k}.mp3",
        **v
    })

for k, v in LETTERS_PL.items():
    data["letters_pl"].append({
        "id": f"letters_pl_{k}",
        "filename": f"letters/pl/{k}_{v['word'].lower()}.webp",
        "audio": f"pl/letter_{k}.mp3",
        **v
    })

for k, v in LETTERS_EN.items():
    data["letters_en"].append({
        "id": f"letters_en_{k}",
        "filename": f"letters/en/{k}_{v['word'].lower()}.webp",
        "audio": f"en/letter_{k}.mp3",
        **v
    })

for k, v in NUMBERS.items():
    data["numbers"].append({
        "id": f"numbers_{k}",
        "filename": f"numbers/{k}.webp",
        "audio_pl": f"pl/number_{k}.mp3",
        "audio_en": f"en/number_{k}.mp3",
        **v
    })

for k, v in COLORS.items():
    data["colors"].append({
        "id": f"colors_{k}",
        "audio_pl": f"pl/color_{k}.mp3",
        "audio_en": f"en/color_{k}.mp3",
        **v
    })

output_path = os.path.join(os.path.dirname(__file__), "..", "app", "assets", "content_data.json")
with open(output_path, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
print("Exported JSON successfully.")
