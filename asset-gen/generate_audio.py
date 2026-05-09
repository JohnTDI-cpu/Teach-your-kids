"""
Teach Your Kids — Audio Generation (multi-language)
Edge TTS + ffmpeg concat for animals.

For animal entries we generate two intermediate clips and stitch them:
  1) TTS lector intro: e.g. "Krowa mówi" / "The cow says" / "Die Kuh macht"
  2) The raw real animal recording (CC0) at assets/audio/animals/raw/<id>.mp3

The two are concatenated with a short silence in between so the kid hears
the parent-language label first, then the actual sound. If the raw file
is missing the script falls back to TTS-only and prints a warning.

Usage:
    python generate_audio.py                  # all languages, all entries
    python generate_audio.py --lang pl,en     # subset
    python generate_audio.py --kind animal    # only animals
    python generate_audio.py --skip-existing  # don't overwrite
    python generate_audio.py --dry-run        # show texts without generating
"""

import os
import sys
import time
import asyncio
import argparse
import shutil
import subprocess
import tempfile
from pathlib import Path

import edge_tts

sys.path.insert(0, os.path.dirname(__file__))
from content_data import get_all_audio_texts, EDGE_VOICES, LANGUAGES

OUTPUT_DIR = Path(__file__).parent.parent / "app" / "assets" / "audio"
RAW_ANIMAL_DIR = OUTPUT_DIR / "animals" / "raw"

# Short silence between lector intro and animal sound (milliseconds)
INTRO_TAIL_SILENCE_MS = 400


# ---------- TTS ----------

async def tts_to_mp3(text: str, voice: str, out_path: Path) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    communicate = edge_tts.Communicate(text, voice)
    await communicate.save(str(out_path))


# ---------- ffmpeg concat ----------

def concat_with_silence(intro_mp3: Path, raw_mp3: Path, out_path: Path, silence_ms: int) -> None:
    """Concatenate intro_mp3 + silence + raw_mp3 into out_path. Re-encodes to
    a uniform format so playback timing works on Android."""
    out_path.parent.mkdir(parents=True, exist_ok=True)
    # Build a complex filter that concatenates: [0:a] [silence] [1:a]
    # `aevalsrc=0` generates silence at the matching sample rate.
    # We re-encode everything to mp3 mono 44100Hz 128k for consistency.
    sil_s = silence_ms / 1000.0
    cmd = [
        "ffmpeg", "-y", "-loglevel", "error",
        "-i", str(intro_mp3),
        "-i", str(raw_mp3),
        "-filter_complex",
        f"aevalsrc=exprs=0:duration={sil_s}:sample_rate=44100[sil];"
        f"[0:a]aresample=44100,aformat=channel_layouts=mono[a0];"
        f"[1:a]aresample=44100,aformat=channel_layouts=mono[a1];"
        f"[a0][sil][a1]concat=n=3:v=0:a=1[out]",
        "-map", "[out]",
        "-acodec", "libmp3lame", "-b:a", "128k",
        str(out_path),
    ]
    subprocess.run(cmd, check=True)


# ---------- main ----------

async def process_entry(entry, args, stats):
    out_path = OUTPUT_DIR / entry["filename"]
    voice = EDGE_VOICES.get(entry["lang"])
    if not voice:
        print(f"  ! no voice for lang={entry['lang']}, skipping {entry['id']}")
        stats["errors"].append((entry["id"], "no voice"))
        return

    if args.skip_existing and out_path.exists() and out_path.stat().st_size > 200:
        stats["skipped"] += 1
        return

    print(f"[{entry['id']}] ({entry['lang']}, {entry['kind']}) \"{entry['text']}\"")

    try:
        if entry["kind"] == "animal":
            raw_path = OUTPUT_DIR.parent / "audio" / entry["raw_sound"]
            if not raw_path.exists():
                print(f"  ! missing raw sound {raw_path.name} — falling back to TTS-only")
                await tts_to_mp3(entry["text"], voice, out_path)
                stats["fallback"] += 1
                return
            with tempfile.TemporaryDirectory() as tmp:
                intro = Path(tmp) / "intro.mp3"
                await tts_to_mp3(entry["text"], voice, intro)
                concat_with_silence(intro, raw_path, out_path, INTRO_TAIL_SILENCE_MS)
            stats["concat"] += 1
        else:
            await tts_to_mp3(entry["text"], voice, out_path)
            stats["plain"] += 1
    except subprocess.CalledProcessError as e:
        print(f"  ! ffmpeg failed: {e}")
        stats["errors"].append((entry["id"], "ffmpeg"))
    except Exception as e:
        print(f"  ! TTS failed: {e}")
        stats["errors"].append((entry["id"], str(e)))


async def async_main(args):
    if not shutil.which("ffmpeg"):
        print("ERROR: ffmpeg not found in PATH; install it before running.")
        sys.exit(1)

    all_audio = get_all_audio_texts()

    if args.lang != "all":
        wanted = set(args.lang.split(","))
        all_audio = [a for a in all_audio if a["lang"] in wanted]
    if args.kind != "all":
        all_audio = [a for a in all_audio if a["kind"] == args.kind]

    print(f"\n{'='*60}")
    print(f"Teach Your Kids — Audio Generator (multi-lang)")
    print(f"{'='*60}")
    print(f"Languages: {args.lang}   Kind: {args.kind}")
    print(f"Total entries: {len(all_audio)}")
    print(f"Output: {OUTPUT_DIR}")
    print(f"Raw animal sounds dir: {RAW_ANIMAL_DIR}")
    print(f"{'='*60}\n")

    if args.dry_run:
        for a in all_audio[:30]:
            print(f"  [{a['id']}] ({a['lang']}, {a['kind']}) \"{a['text']}\"")
        if len(all_audio) > 30:
            print(f"  ... and {len(all_audio) - 30} more")
        return

    stats = {"plain": 0, "concat": 0, "fallback": 0, "skipped": 0, "errors": []}
    started = time.time()
    for entry in all_audio:
        await process_entry(entry, args, stats)
    elapsed = time.time() - started

    print(f"\n{'='*60}")
    print(f"DONE in {elapsed:.1f}s")
    print(f"  TTS-only:        {stats['plain']}")
    print(f"  TTS + concat:    {stats['concat']}")
    print(f"  Fallback (TTS):  {stats['fallback']}")
    print(f"  Skipped:         {stats['skipped']}")
    print(f"  Errors:          {len(stats['errors'])}")
    if stats["errors"]:
        print("\nErrors:")
        for eid, msg in stats["errors"][:20]:
            print(f"  [{eid}] {msg}")
    print(f"{'='*60}")


def main():
    parser = argparse.ArgumentParser(description="Generate TTS audio (with animal-sound concat) via Edge TTS + ffmpeg")
    parser.add_argument("--lang", default="all",
                        help=f"Comma-separated language codes ({','.join(LANGUAGES)}) or 'all'")
    parser.add_argument("--kind", choices=["all", "plain", "animal"], default="all",
                        help="Filter by entry kind")
    parser.add_argument("--dry-run", action="store_true",
                        help="Show texts without generating")
    parser.add_argument("--skip-existing", action="store_true",
                        help="Skip outputs that already exist (size > 200 bytes)")
    args = parser.parse_args()

    asyncio.run(async_main(args))


if __name__ == "__main__":
    main()
