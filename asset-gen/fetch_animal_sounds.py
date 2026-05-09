"""
Generate cartoon-style animal SFX via ElevenLabs Sound Effects API.

Why this beats stock libraries:
  Free SFX libraries (Mixkit, Wikimedia, Freesound) are dominated by real
  farm/wild recordings. Even after pitch-shifting + repeating, they still
  sound "adult". ElevenLabs SFX takes a text prompt and synthesizes
  unmistakably kid-show audio — "cartoon duck saying quack quack quack,
  playful" gets you exactly that.

  Cost: free tier is 10k chars/month. We use ~1k chars per full run.

API:
    POST https://api.elevenlabs.io/v1/sound-generation
    Headers: xi-api-key: <key>, Content-Type: application/json
    Body:    { "text": <prompt>, "duration_seconds": <0.5..22>,
               "prompt_influence": 0.0..1.0 }
    Response: audio/mpeg (mp3 bytes)

Auth:
    Read from env ELEVENLABS_API_KEY. The key is *never* persisted to
    disk — neither in this script nor in SOURCES.txt — so committing
    the repo doesn't leak it.

Usage:
    $env:ELEVENLABS_API_KEY = "sk_..."          # PowerShell
    py asset-gen/fetch_animal_sounds.py          # all animals
    py asset-gen/fetch_animal_sounds.py kaczka kot   # subset
"""
import os, sys, json, time, urllib.request, urllib.error, subprocess, tempfile
from pathlib import Path

OUT_DIR = Path(__file__).parent.parent / "app" / "assets" / "audio" / "animals" / "raw"
OUT_DIR.mkdir(parents=True, exist_ok=True)

API_URL = "https://api.elevenlabs.io/v1/sound-generation"

# Each prompt is engineered for a specific kid-show vibe:
#  - explicitly mention "cartoon" + "children's TV / animated show"
#  - repeat the onomatopoeia 2-3 times so the model produces multiple
#    vocalizations rather than a single naturalistic call
#  - keep duration short (kid attention span between flashcards)
#  - prompt_influence 0.55 — high enough to lock to the prompt, low enough
#    that the model still produces something musical rather than literal
PROMPTS = {
    "krowa":  ("Cute cartoon cow saying moo moo, friendly children's animated TV show, warm gentle voice, single happy cow",
               3.0),
    "kot":    ("Cute cartoon kitten meowing meow meow meow, playful, children's animated show, soft and adorable",
               2.5),
    "pies":   ("Cartoon dog barking loudly woof woof woof, multiple clear sharp friendly barks, happy energetic dog, children's animated TV show",
               3.0),
    "kura":   ("Cute cartoon hen clucking cluck cluck cluck, friendly farm, children's animated show",
               3.0),
    "kogut":  ("Cheerful cartoon rooster crowing cock-a-doodle-doo, sunny morning, children's animated TV show",
               3.0),
    "kaczka": ("Cute cartoon duck quacking quack quack quack, playful and bouncy, children's animated TV show",
               2.5),
    "kon":    ("Cute cartoon horse neighing whinny hee-hee-hee, friendly pony, children's animated TV show",
               3.0),
    "swinia": ("Adorable cartoon pink piglet snorting oink oink oink, cute baby pig, bouncy happy, children's animated TV show",
               3.0),
    "owca":   ("Cute cartoon sheep bleating baa baa baa, gentle fluffy, children's animated TV show",
               2.5),
    "koza":   ("Cute cartoon baby goat bleating maa maa maa, playful, children's animated TV show",
               2.5),
    "osiol":  ("Cute cartoon donkey braying hee-haw hee-haw, friendly, children's animated TV show",
               3.0),
}

PROMPT_INFLUENCE = 0.55


def get_api_key():
    key = os.environ.get("ELEVENLABS_API_KEY", "").strip()
    if not key:
        print("ERROR: set ELEVENLABS_API_KEY env var. e.g.")
        print("  PowerShell:  $env:ELEVENLABS_API_KEY = \"sk_...\"")
        print("  bash:        export ELEVENLABS_API_KEY=sk_...")
        sys.exit(2)
    return key


def generate(prompt, duration_s, api_key):
    body = json.dumps({
        "text": prompt,
        "duration_seconds": duration_s,
        "prompt_influence": PROMPT_INFLUENCE,
    }).encode("utf-8")
    req = urllib.request.Request(
        API_URL,
        data=body,
        headers={
            "xi-api-key": api_key,
            "Content-Type": "application/json",
            "Accept": "audio/mpeg",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return r.read()
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace")
        raise RuntimeError(f"HTTP {e.code}: {body}") from e


def normalize_mp3(src, dst):
    """Loudness-normalize and re-encode to mono 44.1kHz 128k mp3 so all
    animal clips sit at the same level when played back."""
    cmd = ["ffmpeg", "-y", "-loglevel", "error",
           "-i", str(src),
           "-af", "loudnorm=I=-14:TP=-1.5:LRA=11",
           "-ac", "1", "-ar", "44100",
           "-acodec", "libmp3lame", "-b:a", "128k",
           str(dst)]
    subprocess.run(cmd, check=True)


def fetch_one(animal_id, prompt, duration_s, api_key):
    """Returns (ok, sources_line). The caller is responsible for writing
    sources_line into SOURCES.txt — this lets partial runs update only the
    targeted rows."""
    print(f"\n--- {animal_id} ({duration_s}s) ---")
    print(f"  prompt: {prompt[:90]}{'...' if len(prompt) > 90 else ''}")
    try:
        audio = generate(prompt, duration_s, api_key)
        with tempfile.TemporaryDirectory() as tmp:
            tmp = Path(tmp)
            raw = tmp / "raw.mp3"
            raw.write_bytes(audio)
            out = OUT_DIR / f"{animal_id}.mp3"
            normalize_mp3(raw, out)
        line = f"{animal_id}\t{duration_s}s\t{prompt}"
        print(f"  -> saved {out.name} ({out.stat().st_size}B)")
        return True, line
    except Exception as e:
        print(f"  ! failed: {e}")
        return False, ""


SOURCES_HEADER = (
    "# Generated via ElevenLabs Sound Effects API.\n"
    "# License: standard ElevenLabs paid/free tier — generated audio is\n"
    "# yours to use commercially. https://elevenlabs.io/sound-effects\n"
    f"# prompt_influence={PROMPT_INFLUENCE}\n"
    "# id\tduration\tprompt\n"
)


def read_sources(path):
    """Return existing entries as {id: line} so we can update individual
    rows during partial regenerations without losing the rest."""
    if not path.exists():
        return {}
    out = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line or line.startswith("#"):
            continue
        aid = line.split("\t", 1)[0]
        out[aid] = line
    return out


def write_sources(path, entries):
    body = SOURCES_HEADER + "\n".join(entries[k] for k in PROMPTS if k in entries) + "\n"
    path.write_text(body, encoding="utf-8")


def main():
    api_key = get_api_key()
    targets = sys.argv[1:] or list(PROMPTS.keys())
    full_run = not sys.argv[1:]

    sources_path = OUT_DIR / "SOURCES.txt"
    # Full run starts fresh; partial run preserves rows for animals we
    # aren't regenerating so the file stays in sync with raw/*.mp3.
    entries = {} if full_run else read_sources(sources_path)

    succeeded = 0
    for a in targets:
        if a not in PROMPTS:
            print(f"unknown animal id: {a}")
            continue
        prompt, duration_s = PROMPTS[a]
        ok, line = fetch_one(a, prompt, duration_s, api_key)
        if ok:
            entries[a] = line
            succeeded += 1
        # Be polite to the API.
        time.sleep(0.4)

    write_sources(sources_path, entries)
    print(f"\nDone. {succeeded}/{len(targets)} sounds saved to {OUT_DIR}")


if __name__ == "__main__":
    main()
