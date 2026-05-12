"""
Export content_data.py → app/assets/content_data.json (multi-language).

Output structure (consumed by app/state.ts buildItemsForCategory):
  {
    "languages": ["pl","en","de","es","fr","it","uk"],
    "letters": {
      "pl": [{id, filename, audio, letter, word, desc}, ...],
      "en": [...], ...
    },
    "numbers": [{id, filename, audio:{pl,en,de,...}, labels:{pl,en,...}}, ...],
    "colors":  [{id, hex, audio:{...}, labels:{...}}, ...],
    "animals": [{id, filename, audio:{...}, labels:{...}}, ...]
  }
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from content_data import ANIMALS, LETTERS, NUMBERS, COLORS, LANGUAGES
from migrate_ascii_filenames import asciify

data = {
    "languages": LANGUAGES,
    "letters": {},
    "numbers": [],
    "colors": [],
    "animals": [],
}

# Letters — per-language list (alphabet differs per language)
for lang, items in LETTERS.items():
    out = []
    for k, v in items.items():
        # ASCII-only filename — Metro mangled paths with Cyrillic /
        # Polish/Spanish/French diacritic chars at bundle time, which made
        # all UK letter cards behave as if they shared the same asset.
        word_safe = asciify(v["word"])
        # When the key already equals the word slug (collision-disambiguated
        # entries like PL "sliwka"), don't append it twice.
        fn = k if k == word_safe else f"{k}_{word_safe}"
        out.append({
            "id": f"letters_{lang}_{k}",
            "filename": f"letters/{lang}/{fn}.webp",
            "audio": f"{lang}/letter_{k}.mp3",
            "letter": v["letter"],
            "word": v["word"],
            "desc": v["desc"],
        })
    data["letters"][lang] = out

# Numbers — shared image, per-language audio + label
for k, v in NUMBERS.items():
    data["numbers"].append({
        "id": f"numbers_{k}",
        "filename": f"numbers/{k}.webp",
        "audio": {lang: f"{lang}/number_{k}.mp3" for lang in LANGUAGES},
        "labels": v["labels"],
        "desc": v.get("desc", ""),
    })

# Colors — no image, per-language audio + label
for k, v in COLORS.items():
    data["colors"].append({
        "id": f"colors_{k}",
        "hex": v["hex"],
        "audio": {lang: f"{lang}/color_{k}.mp3" for lang in LANGUAGES},
        "labels": v["labels"],
    })

# Animals — shared image + per-language audio (TTS intro + real sound)
for k, v in ANIMALS.items():
    data["animals"].append({
        "id": f"animals_{k}",
        "filename": f"animals/{k}.webp",
        "audio": {lang: f"{lang}/animal_{k}.mp3" for lang in LANGUAGES},
        "labels": v["labels"],
        "desc": v.get("desc", ""),
    })

output_path = os.path.join(os.path.dirname(__file__), "..", "app", "assets", "content_data.json")
os.makedirs(os.path.dirname(output_path), exist_ok=True)
with open(output_path, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print(f"Exported: {output_path}")
print(f"  languages: {len(data['languages'])}")
print(f"  letters by lang: { {l: len(items) for l, items in data['letters'].items()} }")
print(f"  numbers: {len(data['numbers'])}")
print(f"  colors:  {len(data['colors'])}")
print(f"  animals: {len(data['animals'])}")
