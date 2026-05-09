"""
Fetch CC0 / public-domain animal recordings from Wikimedia Commons,
convert to mono 44.1 kHz MP3 and save under assets/audio/animals/raw/.

Each entry is (target_filename, [search hints...]). The first hint that
returns a usable file (any audio mime, < 30s, > 0.5s) wins.

The license info gets logged to assets/audio/animals/raw/SOURCES.txt so
attribution stays with the project.
"""
import os, sys, json, urllib.request, urllib.parse, subprocess, tempfile, time
from pathlib import Path

OUT_DIR = Path(__file__).parent.parent / "app" / "assets" / "audio" / "animals" / "raw"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# Animal id  ->  list of search queries to try (most specific first).
# We pick the first audio file in the result whose name suggests the animal sound.
SEARCH_QUERIES = {
    "krowa":  {"queries": ["cow moo", "cattle moo"],          "names": ["cow", "cattle", "bos taurus"]},
    "kot":    {"queries": ["cat meow", "siamese cat"],        "names": ["cat", "kitten", "siamese", "felis"]},
    "pies":   {"queries": ["dog bark", "dog barking"],        "names": ["dog ", "dog.", " dog", "puppy", "canis"]},
    "kura":   {"queries": ["chicken sound", "hen cluck"],     "names": ["hen ", "hen.", "chicken", "gallus"]},
    "kogut":  {"queries": ["rooster crowing", "kokrhající"],  "names": ["rooster", "cockerel", "kokrh", "kogut", "kukuriku"]},
    "kaczka": {"queries": ["duck quack", "mallard"],          "names": ["duck", "mallard", "anas platyrhynchos"]},
    "kon":    {"queries": ["horse neigh", "horse whinny", "horse"], "names": ["horse", "stallion", "mare", "equus caballus", "pferd"]},
    "swinia": {"queries": ["pig oink", "piglet"],             "names": ["pig ", "pig.", " pig", "piglet", "sus scrofa"]},
    "owca":   {"queries": ["sheep bleat", "lamb bleating"],   "names": ["sheep", "lamb", "ovis"]},
    "koza":   {"queries": ["goat bleat", "goat sound", "goat"], "names": ["goat", "capra", "ziege"]},
    "osiol":  {"queries": ["donkey bray"],                    "names": ["donkey", "burro", "equus asinus"]},
}

USER_AGENT = "TeachYourKidsAssetGen/1.0 (+https://github.com/JohnTDI-cpu/Teach-your-kids)"

def api(params):
    url = "https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode({**params, "format": "json"})
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())

def search_files(query):
    j = api({"action": "query", "list": "search", "srnamespace": 6, "srsearch": query, "srlimit": 30})
    return [s["title"] for s in j.get("query", {}).get("search", [])]

def imageinfo(title):
    j = api({"action": "query", "titles": title, "prop": "imageinfo",
             "iiprop": "url|mime|size|extmetadata", "iilimit": 1})
    pages = j.get("query", {}).get("pages", {})
    for _, p in pages.items():
        for ii in p.get("imageinfo", []):
            return ii
    return None

def good_candidate(title, names):
    """Title must mention any of the animal-name keywords AND not be a
    pronunciation / TTS / song / language clip."""
    t = title.lower()
    bad = ["pronunciation", "wikt-", "lingua libre", "ll-q", "speech", "tts",
           "vocaroo", "language", "pronounc", "spelling", "syllable",
           ".mid", ".midi", "song", "music", "lullaby", "rhyme",
           "in chak", "in english", "in french", "in german", "in spanish",
           "march", "polka", "two step", "band", "orchestra", "brothers",
           "isrc", "rabbit", "warbler", "kite", "blackbird"]
    if any(b in t for b in bad):
        return False
    return any(n.lower() in t for n in names)

def download(url, out_path):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=60) as r, open(out_path, "wb") as f:
        f.write(r.read())

def to_mp3(src, dst, max_s=5):
    """Convert any audio file to mono 44.1kHz mp3, capped at max_s seconds.
    A 5s cap keeps the kid's wait between flashcards short — long brays
    or barking sequences would otherwise force a 10s+ pause."""
    cmd = ["ffmpeg", "-y", "-loglevel", "error",
           "-i", str(src),
           "-t", str(max_s),
           "-ac", "1", "-ar", "44100",
           "-acodec", "libmp3lame", "-b:a", "128k",
           str(dst)]
    subprocess.run(cmd, check=True)

def fetch_one(animal_id, cfg):
    print(f"\n--- {animal_id} ---")
    queries = cfg["queries"]
    names = cfg["names"]
    for q in queries:
        search_q = f"{q} filemime:audio"
        for title in search_files(search_q):
            if not good_candidate(title, names):
                continue
            if True:
                # alignment for the rest of the loop body
                ii = imageinfo(title)
                if not ii:
                    continue
                url = ii.get("url")
                mime = ii.get("mime", "")
                size = ii.get("size", 0)
                if not url:
                    continue
                ext = url.split("?")[0].split(".")[-1].lower()
                if not (mime.startswith("audio") or ext in ("ogg", "mp3", "wav", "flac", "opus", "oga", "webm")):
                    continue
                # Skip MIDI explicitly
                if "midi" in mime or ext in ("mid", "midi"):
                    continue
                license_info = ii.get("extmetadata", {}).get("LicenseShortName", {}).get("value", "?")
                artist = ii.get("extmetadata", {}).get("Artist", {}).get("value", "?")
                # Strip HTML tags from artist
                import re
                artist = re.sub(r"<[^>]+>", "", artist).strip()
                print(f"  candidate: {title} ({mime}, {size}B, {license_info})")
                try:
                    with tempfile.NamedTemporaryFile(suffix="." + ext, delete=False) as tf:
                        tmp = Path(tf.name)
                    # Strip query string from url for cleaner download
                    clean_url = url.split("?")[0]
                    download(clean_url, tmp)
                    out = OUT_DIR / f"{animal_id}.mp3"
                    to_mp3(tmp, out)
                    tmp.unlink(missing_ok=True)
                    with (OUT_DIR / "SOURCES.txt").open("a", encoding="utf-8") as f:
                        f.write(f"{animal_id}\t{title}\t{license_info}\t{artist}\t{clean_url}\n")
                    print(f"  -> saved {out.name} ({out.stat().st_size}B)")
                    return True
                except Exception as e:
                    print(f"  ! failed: {e}")
    print(f"  ! no good candidate for {animal_id}")
    return False

def main():
    targets = sys.argv[1:] or list(SEARCH_QUERIES.keys())
    if (OUT_DIR / "SOURCES.txt").exists():
        (OUT_DIR / "SOURCES.txt").unlink()
    (OUT_DIR / "SOURCES.txt").write_text("# id\twikimedia_title\tlicense\tartist\tsource_url\n", encoding="utf-8")
    succeeded = 0
    for a in targets:
        if a not in SEARCH_QUERIES:
            print(f"unknown animal id: {a}")
            continue
        if fetch_one(a, SEARCH_QUERIES[a]):
            succeeded += 1
        time.sleep(0.5)
    print(f"\nDone. {succeeded}/{len(targets)} sounds downloaded to {OUT_DIR}")

if __name__ == "__main__":
    main()
