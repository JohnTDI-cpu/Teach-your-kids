"""
Teach Your Kids — Audio Generation Script (Edge TTS)
Uses Microsoft Edge TTS for high-quality, expressive, natural voices.
Outputs directly to MP3.

Usage:
    python generate_audio.py              # Generate all audio
    python generate_audio.py --lang pl    # Generate only Polish
    python generate_audio.py --dry-run    # Show texts without generating
"""

import os
import sys
import time
import asyncio
import argparse
from pathlib import Path
import edge_tts

sys.path.insert(0, os.path.dirname(__file__))
from content_data import get_all_audio_texts

OUTPUT_DIR = Path(__file__).parent.parent / "assets" / "audio"

# Highly expressive and natural neural voices
VOICES = {
    "pl": "pl-PL-ZofiaNeural",  # Warm, natural Polish female voice
    "en": "en-US-AnaNeural",    # Child-friendly, cheerful US English voice
}

async def generate_single_audio(text: str, output_path: Path, lang: str):
    """Generate a single MP3 audio file using Edge TTS."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    voice = VOICES[lang]
    communicate = edge_tts.Communicate(text, voice)
    
    await communicate.save(str(output_path))
    
    size_kb = output_path.stat().st_size / 1024
    print(f"  Saved: {output_path.name} ({size_kb:.0f} KB)")


async def async_main(args):
    all_audio = get_all_audio_texts()

    if args.lang != "all":
        all_audio = [a for a in all_audio if a["lang"] == args.lang]

    print(f"\n{'='*60}")
    print(f"Teach Your Kids — Audio Generator (Edge TTS)")
    print(f"{'='*60}")
    print(f"Language: {args.lang}")
    print(f"Total audio files: {len(all_audio)}")
    print(f"Output: {OUTPUT_DIR}")
    print(f"{'='*60}\n")

    if args.dry_run:
        for a in all_audio:
            print(f"[{a['id']}] ({a['lang']}) \"{a['text']}\"")
            print(f"  -> {a['filename']}")
        print(f"\nDRY RUN: {len(all_audio)} audio files would be generated.")
        return

    generated = 0
    skipped = 0
    errors = []

    for i, a in enumerate(all_audio):
        # Edge TTS saves directly to MP3, so we check the exact filename
        output_path = OUTPUT_DIR / a["filename"]

        if args.skip_existing and output_path.exists() and output_path.stat().st_size > 100:
            print(f"[{i+1}/{len(all_audio)}] SKIP (exists): {a['filename']}")
            skipped += 1
            continue

        print(f"\n[{i+1}/{len(all_audio)}] Generating: {a['id']}")
        print(f"  Text: \"{a['text']}\"")

        try:
            start = time.time()
            await generate_single_audio(a["text"], output_path, a["lang"])
            elapsed = time.time() - start
            print(f"  Time: {elapsed:.1f}s")
            generated += 1
        except Exception as e:
            print(f"  ERROR: {e}")
            errors.append({"id": a["id"], "error": str(e)})

    # Summary
    print(f"\n{'='*60}")
    print(f"DONE!")
    print(f"  Generated: {generated}")
    print(f"  Skipped:   {skipped}")
    print(f"  Errors:    {len(errors)}")
    if errors:
        print(f"\nErrors:")
        for e in errors:
            print(f"  [{e['id']}] {e['error']}")
    print(f"{'='*60}")

def main():
    parser = argparse.ArgumentParser(description="Generate educational audio files via Edge TTS")
    parser.add_argument("--lang", choices=["pl", "en", "all"], default="all",
                        help="Language to generate")
    parser.add_argument("--dry-run", action="store_true",
                        help="Show texts without generating")
    parser.add_argument("--skip-existing", action="store_true", default=False, # default to False to force regeneration!
                        help="Skip audio that already exists")
    args = parser.parse_args()

    asyncio.run(async_main(args))

if __name__ == "__main__":
    main()
