"""
One-shot migration: rename every non-ASCII asset filename to an ASCII
slug, and rewrite content_data.py so its keys are ASCII as well.

Why this exists:
  Metro's asset registry on Android sometimes mangles non-ASCII paths
  during the bundle step — Cyrillic-named files end up unloadable at
  runtime, which made all 27 UK letter cards appear to "repeat" because
  audio + image lookups returned undefined.

After this script:
  - All filenames under app/assets/audio/ and app/assets/images/letters/
    are pure ASCII (letter + word transliterated).
  - content_data.py's LETTERS keys are ASCII slugs of the letter+word.
  - Display-side `letter` and `word` strings keep their original
    Polish/Cyrillic/diacritic characters — only the *paths* change.
"""
import os, re, sys, shutil, json
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
ASSETS = REPO / "app" / "assets"
sys.path.insert(0, str(REPO / "asset-gen"))

# --- transliteration table (covers Polish, German, Spanish, French, Italian
#     diacritics + full Ukrainian Cyrillic).
ASCII_MAP = {
    # Polish
    'ą':'a','ć':'c','ę':'e','ł':'l','ń':'n','ó':'o','ś':'s','ź':'z','ż':'z',
    'Ą':'A','Ć':'C','Ę':'E','Ł':'L','Ń':'N','Ó':'O','Ś':'S','Ź':'Z','Ż':'Z',
    # Western European
    'á':'a','à':'a','â':'a','ä':'a','ã':'a','å':'a',
    'Á':'A','À':'A','Â':'A','Ä':'A','Ã':'A','Å':'A',
    'é':'e','è':'e','ê':'e','ë':'e',
    'É':'E','È':'E','Ê':'E','Ë':'E',
    'í':'i','ì':'i','î':'i','ï':'i',
    'Í':'I','Ì':'I','Î':'I','Ï':'I',
    'ò':'o','ô':'o','ö':'o','õ':'o','ø':'o',
    'Ò':'O','Ô':'O','Ö':'O','Õ':'O','Ø':'O',
    'ú':'u','ù':'u','û':'u','ü':'u',
    'Ú':'U','Ù':'U','Û':'U','Ü':'U',
    'ñ':'n','Ñ':'N','ç':'c','Ç':'C','ß':'ss',
    # Ukrainian Cyrillic (BGN/PCGN simplified)
    'а':'a','б':'b','в':'v','г':'h','ґ':'g','д':'d','е':'e','є':'ie',
    'ж':'zh','з':'z','и':'y','і':'i','ї':'i','й':'i','к':'k','л':'l',
    'м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u',
    'ф':'f','х':'kh','ц':'ts','ч':'ch','ш':'sh','щ':'shch','ь':'',
    'ю':'iu','я':'ia',
    'А':'A','Б':'B','В':'V','Г':'H','Ґ':'G','Д':'D','Е':'E','Є':'Ie',
    'Ж':'Zh','З':'Z','И':'Y','І':'I','Ї':'I','Й':'I','К':'K','Л':'L',
    'М':'M','Н':'N','О':'O','П':'P','Р':'R','С':'S','Т':'T','У':'U',
    'Ф':'F','Х':'Kh','Ц':'Ts','Ч':'Ch','Ш':'Sh','Щ':'Shch','Ь':'',
    'Ю':'Iu','Я':'Ia',
}

def asciify(s: str) -> str:
    """Lower-case, ASCII-only slug. Anything that isn't [a-z0-9_] is dropped."""
    out = []
    for ch in s.lower():
        out.append(ASCII_MAP.get(ch, ch))
    s2 = ''.join(out)
    s2 = re.sub(r'[^a-z0-9_]+', '_', s2)
    s2 = re.sub(r'_+', '_', s2).strip('_')
    return s2


# --- import current LETTERS without re-executing the whole module
from content_data import LETTERS  # noqa: E402

def ascii_keys_for(items):
    """Return {original_key: new_ascii_key} where every value is a unique
    ASCII slug. Strategy: try `asciify(key)`; if it would collide, fall
    back to the word slug for both parties (`s` & `ś` → `salata` & `sliwka`)."""
    # Two-pass: gather candidates, then disambiguate any collisions.
    initial = {key: (asciify(key) or asciify(data['word']))
               for key, data in items.items()}
    # Group by candidate to find collisions.
    by_candidate: dict[str, list[str]] = {}
    for key, cand in initial.items():
        by_candidate.setdefault(cand, []).append(key)

    final = {}
    for cand, owners in by_candidate.items():
        if len(owners) == 1:
            final[owners[0]] = cand
        else:
            # Everyone in this bucket falls back to their word slug.
            for orig_key in owners:
                final[orig_key] = asciify(items[orig_key]['word'])
    return final


def build_rename_plan():
    """Compute (old_path, new_path) tuples for audio + images."""
    plan = []
    for lang, items in LETTERS.items():
        key_map = ascii_keys_for(items)
        for key, data in items.items():
            new_key = key_map[key]
            word_slug = asciify(data['word'])

            # audio: {lang}/letter_{key}.mp3
            old_audio = ASSETS / 'audio' / lang / f'letter_{key}.mp3'
            new_audio = ASSETS / 'audio' / lang / f'letter_{new_key}.mp3'
            if old_audio.exists() and old_audio != new_audio:
                plan.append((old_audio, new_audio))

            # image: letters/{lang}/{key}_{word.lower()}.webp
            old_word_in_fn = data['word'].lower().replace(' ', '_')
            old_image = ASSETS / 'images' / 'letters' / lang / f'{key}_{old_word_in_fn}.webp'
            # Drop redundant `_word` suffix when the new key already encodes it.
            new_name = new_key if new_key == word_slug else f'{new_key}_{word_slug}'
            new_image = ASSETS / 'images' / 'letters' / lang / f'{new_name}.webp'
            if old_image.exists() and old_image != new_image:
                plan.append((old_image, new_image))
    return plan


def rewrite_letters_section():
    """Rewrite the LETTERS = { ... } block in content_data.py so all keys
    are ASCII. We do this by re-emitting the dict in-place rather than
    fiddling with the source — every entry stays, only its key changes."""
    cd_path = REPO / 'asset-gen' / 'content_data.py'
    src = cd_path.read_text(encoding='utf-8')

    # Build the new LETTERS block as Python source.
    lines = ['LETTERS = {']
    for lang, items in LETTERS.items():
        key_map = ascii_keys_for(items)
        lines.append(f'    "{lang}": {{')
        for key, data in items.items():
            new_key = key_map[key]
            letter = data['letter'].replace('\\', '\\\\').replace('"', '\\"')
            word = data['word'].replace('\\', '\\\\').replace('"', '\\"')
            desc = data['desc'].replace('\\', '\\\\').replace('"', '\\"')
            lines.append(
                f'        "{new_key}": {{"letter": "{letter}", "word": "{word}", "desc": "{desc}"}},'
            )
        lines.append('    },')
    lines.append('}')
    new_block = '\n'.join(lines)

    # Replace the existing LETTERS = { ... } block. The previous block ends
    # at the line matching `^}\s*$` after a line starting with `LETTERS = {`.
    pattern = re.compile(r'^LETTERS = \{.*?^\}\s*$', re.MULTILINE | re.DOTALL)
    new_src, count = pattern.subn(new_block, src)
    if count != 1:
        raise SystemExit(f'Expected exactly 1 LETTERS block, found {count}')
    cd_path.write_text(new_src, encoding='utf-8')
    print(f'  rewrote LETTERS block in {cd_path}')


def rewrite_export_json_filename():
    """Replace `word.lower()` with an ASCII slug call so generated paths
    match what we renamed to. Keeps the original transformation contract
    elsewhere — only the filename word component changes."""
    ej_path = REPO / 'asset-gen' / 'export_json.py'
    src = ej_path.read_text(encoding='utf-8')
    needle = 'word_safe = v["word"].lower().replace(" ", "_")'
    if needle not in src:
        return
    src = src.replace(
        needle,
        '# ASCII-only filename — Metro choked on Cyrillic / diacritic paths.\n'
        '        word_safe = asciify(v["word"])',
    )
    # Make sure asciify is imported.
    if 'from content_data import' in src and ' asciify' not in src:
        src = src.replace(
            'from content_data import',
            'from content_data import asciify,'
            if 'from content_data import' in src and ',' not in src.split('from content_data import', 1)[1].split('\n', 1)[0]
            else 'from content_data import asciify,',
            1,
        )
    ej_path.write_text(src, encoding='utf-8')
    print(f'  patched filename slug in {ej_path}')


def main():
    plan = build_rename_plan()
    print(f'\n=== Rename plan: {len(plan)} files ===')
    for old, new in plan[:5]:
        print(f'  {old.relative_to(ASSETS)}  →  {new.relative_to(ASSETS)}')
    if len(plan) > 5:
        print(f'  …(+{len(plan)-5} more)')

    if '--dry-run' in sys.argv:
        return

    # Actually rename.
    for old, new in plan:
        new.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(old), str(new))
    print(f'  renamed {len(plan)} files')

    # Rewrite content_data.py LETTERS keys to ASCII.
    rewrite_letters_section()

    print('\n--- Done. Now run:')
    print('    python asset-gen/export_json.py')
    print('    python app/generate_asset_map.py')


if __name__ == '__main__':
    main()
