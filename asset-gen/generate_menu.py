"""
Teach Your Kids — Menu / UI Graphics Generator (Qwen-Image via ComfyUI)

Generates background tiles for the child category menu, the main menu, and
parent/child icons using Qwen-Image (GGUF) + Lightning 8-step LoRA.

Prereqs:
    ComfyUI server running on http://127.0.0.1:8188 with the AMD launcher.
    Models present in ~/ComfyUI/models/{unet,text_encoders,vae,loras}.

Usage:
    python generate_menu.py
    python generate_menu.py --dry-run
"""

import os
import sys
import time
import json
import uuid
import urllib.request
import urllib.error
from pathlib import Path

OUTPUT_DIR = Path(__file__).resolve().parent.parent / "app" / "assets" / "menu"
COMFYUI_URL = "http://127.0.0.1:8188"

# Qwen-Image style prefix - keeps a consistent look across all tiles
QWEN_STYLE = (
    "playful children's educational illustration, soft 3D pixar style, "
    "bright cheerful pastel colors, rounded friendly shapes, soft studio lighting, "
    "warm and inviting, NO text, NO letters, NO words, NO numbers, "
    "centered composition with empty top space, high quality, 4k. "
)

NEG = "low quality, blurry, distorted, text, watermark, scary, dark, gloomy, ugly, deformed"

PROMPTS = [
    {
        "filename": "bg_letters.webp",
        "width": 1024,
        "height": 768,
        "prompt": QWEN_STYLE + (
            "A cheerful colorful giant ABC alphabet block on a soft sky-blue background, "
            "stacks of red blue yellow green wooden alphabet blocks, "
            "scattered colorful crayons, fluffy cotton clouds, sunlight rays, "
            "very child friendly, no readable text on blocks"
        ),
    },
    {
        "filename": "bg_numbers.webp",
        "width": 1024,
        "height": 768,
        "prompt": QWEN_STYLE + (
            "A row of large 3D shiny plastic numbers floating on a soft mint-green background, "
            "rainbow colors, sparkles, bouncy round forms, abacus with colorful beads in the corner, "
            "playful math vibes for toddlers"
        ),
    },
    {
        "filename": "bg_animals.webp",
        "width": 1024,
        "height": 768,
        "prompt": QWEN_STYLE + (
            "A friendly farm scene with a cute cow, a smiling pig and a fluffy sheep, "
            "rolling green hills, red barn in the distance, sunny day, butterflies, "
            "soft watercolor look, kawaii cute style with big eyes and happy expressions"
        ),
    },
    {
        "filename": "bg_colors.webp",
        "width": 1024,
        "height": 768,
        "prompt": QWEN_STYLE + (
            "A giant rainbow arc with paint splashes, "
            "tubes of red blue yellow green orange purple pink paint, "
            "big colorful palette, rainbow drops, white background with soft gradient, "
            "art studio for toddlers"
        ),
    },
    {
        "filename": "bg_main.webp",
        "width": 1280,
        "height": 768,
        "prompt": QWEN_STYLE + (
            "A bright happy classroom scene for toddlers, "
            "wide soft pastel landscape, sunny meadow with flowers, big rainbow, "
            "balloons floating, scattered toys: blocks, teddy bear, ball, "
            "warm welcoming atmosphere, plenty of empty sky for title text"
        ),
    },
    {
        "filename": "icon_child.webp",
        "width": 768,
        "height": 768,
        "prompt": QWEN_STYLE + (
            "A cute happy toddler face cartoon icon, big sparkling eyes, rosy cheeks, "
            "wearing a tiny rainbow cap, plain pastel mint background, kawaii style, "
            "round friendly composition"
        ),
    },
    {
        "filename": "icon_parent.webp",
        "width": 768,
        "height": 768,
        "prompt": QWEN_STYLE + (
            "A friendly cartoon parent icon, smiling adult face holding a little child's hand, "
            "warm pastel peach background, kawaii style, round friendly composition"
        ),
    },
    # ----- Pill buttons are *not* listed here. Qwen-Image kept producing
    # three separate pill shapes or insets on a wide canvas which Metro
    # stretched into a broken-looking button. The procedural renderer in
    # asset-gen/generate_pill_buttons.py replaces them — deterministic
    # aspect ratio, exact colour, runs in <1 second.
    #
    # Round icon buttons stay here because Qwen produces a single clean
    # circle reliably at 512×512.
    *[
        {
            "filename": f"btn_round_{name}.webp",
            "width": 512,
            "height": 512,
            "prompt": QWEN_STYLE + (
                f"A round 3D button, glossy plastic finish in {color_desc}, "
                "smooth circular edge, subtle highlight on top, soft drop shadow underneath, "
                "perfectly centered on pure white background, no text, no symbols, "
                "professional UI button asset"
            ),
        }
        for name, color_desc in [
            ("green", "vibrant kelly green"),
            ("blue",  "bright sky blue"),
            ("red",   "bright cherry red"),
            ("gray",  "soft warm light gray"),
        ]
    ],
]


def build_workflow(prompt: str, neg: str, width: int, height: int, seed: int, steps: int = 8, cfg: float = 1.0):
    """Qwen-Image GGUF + Lightning 8-step LoRA workflow."""
    return {
        "1": {
            "class_type": "UnetLoaderGGUF",
            "inputs": {"unet_name": "qwen-image-2512-Q6_K.gguf"},
        },
        "2": {
            "class_type": "CLIPLoader",
            "inputs": {
                "clip_name": "qwen_2.5_vl_7b_fp8_scaled.safetensors",
                "type": "qwen_image",
            },
        },
        "3": {
            "class_type": "VAELoader",
            "inputs": {"vae_name": "qwen_image_vae.safetensors"},
        },
        "4": {
            "class_type": "LoraLoaderModelOnly",
            "inputs": {
                "model": ["1", 0],
                "lora_name": "Qwen-Image-Lightning-8steps-V2.0-bf16.safetensors",
                "strength_model": 1.0,
            },
        },
        "5": {
            "class_type": "ModelSamplingAuraFlow",
            "inputs": {"model": ["4", 0], "shift": 3.1},
        },
        "6": {
            "class_type": "CLIPTextEncode",
            "inputs": {"clip": ["2", 0], "text": prompt},
        },
        "7": {
            "class_type": "CLIPTextEncode",
            "inputs": {"clip": ["2", 0], "text": neg},
        },
        "8": {
            "class_type": "EmptyLatentImage",
            "inputs": {"width": width, "height": height, "batch_size": 1},
        },
        "9": {
            "class_type": "KSampler",
            "inputs": {
                "model": ["5", 0],
                "positive": ["6", 0],
                "negative": ["7", 0],
                "latent_image": ["8", 0],
                "seed": seed,
                "steps": steps,
                "cfg": cfg,
                "sampler_name": "euler",
                "scheduler": "simple",
                "denoise": 1.0,
            },
        },
        "10": {
            "class_type": "VAEDecode",
            "inputs": {"samples": ["9", 0], "vae": ["3", 0]},
        },
        "11": {
            "class_type": "SaveImage",
            "inputs": {"images": ["10", 0], "filename_prefix": "tyk_menu"},
        },
    }


def queue_prompt(workflow, client_id):
    payload = json.dumps({"prompt": workflow, "client_id": client_id}).encode()
    req = urllib.request.Request(
        f"{COMFYUI_URL}/prompt",
        data=payload,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())["prompt_id"]


def wait_for(prompt_id, timeout=600):
    start = time.time()
    while time.time() - start < timeout:
        try:
            with urllib.request.urlopen(f"{COMFYUI_URL}/history/{prompt_id}", timeout=10) as resp:
                hist = json.loads(resp.read())
                if prompt_id in hist:
                    return hist[prompt_id]
        except urllib.error.URLError:
            pass
        time.sleep(2)
    raise TimeoutError(f"prompt {prompt_id} timed out after {timeout}s")


def download(filename, subfolder, out_path):
    out_path.parent.mkdir(parents=True, exist_ok=True)
    url = f"{COMFYUI_URL}/view?filename={filename}&subfolder={subfolder}&type=output"
    urllib.request.urlretrieve(url, str(out_path))
    print(f"  Saved: {out_path.name} ({out_path.stat().st_size/1024:.0f} KB)")


def server_ok():
    try:
        with urllib.request.urlopen(f"{COMFYUI_URL}/system_stats", timeout=5) as r:
            json.loads(r.read())
            return True
    except Exception as e:
        print(f"  ComfyUI server not reachable: {e}")
        return False


def webpify(png_path: Path, webp_path: Path, quality: int = 88):
    """Convert downloaded PNG to WebP for smaller bundle. Falls back to copying if Pillow missing."""
    try:
        from PIL import Image
        img = Image.open(png_path)
        img.save(webp_path, "WEBP", quality=quality, method=6)
        png_path.unlink(missing_ok=True)
    except ImportError:
        # No Pillow — keep PNG and just rename
        png_path.rename(webp_path.with_suffix(".png"))


def main():
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--seed", type=int, default=4242)
    ap.add_argument("--only", help="Generate just one filename (e.g. bg_animals.webp)")
    args = ap.parse_args()

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    todo = PROMPTS
    if args.only:
        todo = [p for p in PROMPTS if p["filename"] == args.only]
        if not todo:
            print(f"No prompt for {args.only}"); sys.exit(1)

    print(f"\n{'='*60}\nMenu/UI generator (Qwen-Image Lightning 8-step)\n{'='*60}")
    print(f"Output: {OUTPUT_DIR}\nItems:  {len(todo)}\n")

    if args.dry_run:
        for p in todo:
            print(f"[{p['filename']}] {p['width']}x{p['height']}")
            print(f"  {p['prompt'][:140]}...\n")
        return

    if not server_ok():
        print("Start ComfyUI first.  Server expected at " + COMFYUI_URL)
        sys.exit(1)

    client_id = str(uuid.uuid4())
    for i, p in enumerate(todo):
        out_path = OUTPUT_DIR / p["filename"]
        if out_path.exists() and out_path.stat().st_size > 5000:
            print(f"[{i+1}/{len(todo)}] SKIP (exists): {p['filename']}")
            continue

        print(f"\n[{i+1}/{len(todo)}] Generating {p['filename']} ({p['width']}x{p['height']})")
        wf = build_workflow(
            prompt=p["prompt"],
            neg=NEG,
            width=p["width"],
            height=p["height"],
            seed=args.seed + i,
        )
        try:
            t0 = time.time()
            pid = queue_prompt(wf, client_id)
            print(f"  Queued: {pid[:8]}")
            res = wait_for(pid, timeout=900)
            outputs = res.get("outputs", {})
            for _, node_out in outputs.items():
                for img in node_out.get("images", []):
                    tmp_path = out_path.with_suffix(".png")
                    download(img["filename"], img.get("subfolder", ""), tmp_path)
                    webpify(tmp_path, out_path)
            print(f"  Time: {time.time()-t0:.1f}s")
        except Exception as e:
            print(f"  ERROR: {e}")

    print("\nDone.")


if __name__ == "__main__":
    main()
