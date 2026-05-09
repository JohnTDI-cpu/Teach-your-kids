"""
Teach Your Kids — Image Generation (Qwen-Image via ComfyUI / AMD)

Same pipeline as generate_menu.py: Qwen-Image GGUF + Lightning 8-step LoRA.
Reads jobs from content_data.get_all_image_prompts() (multi-language letters,
shared numbers, shared animals).

Prereqs:
    Start ComfyUI:  ~/ComfyUI/start_comfyui_amd.sh
    Models in ~/ComfyUI/models/{unet,text_encoders,vae,loras}.

Usage:
    python generate_images.py                            # all jobs (skip existing)
    python generate_images.py --category letters         # all letters across langs
    python generate_images.py --category letters --lang de,es,fr,it,uk
    python generate_images.py --category numbers
    python generate_images.py --category animals
    python generate_images.py --dry-run
"""

import os
import sys
import time
import json
import uuid
import argparse
import urllib.request
import urllib.error
from pathlib import Path

sys.path.insert(0, os.path.dirname(__file__))
from content_data import get_all_image_prompts, IMAGE_CONFIG, LANGUAGES

OUTPUT_DIR = Path(__file__).resolve().parent.parent / "app" / "assets" / "images"
COMFYUI_URL = "http://127.0.0.1:8188"

NEG = (
    "low quality, blurry, distorted, text, watermark, scary, dark, gloomy, ugly, deformed, "
    "multiple objects, hands, fingers"
)


def build_workflow(prompt: str, neg: str, width: int, height: int, seed: int, steps: int = 8, cfg: float = 1.0):
    """Qwen-Image GGUF + Lightning 8-step LoRA — identical to generate_menu.py
    so visual style stays consistent across menu graphics, letters, numbers,
    animals."""
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
            "inputs": {"images": ["10", 0], "filename_prefix": "tyk_img"},
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


def server_ok():
    try:
        with urllib.request.urlopen(f"{COMFYUI_URL}/system_stats", timeout=5) as r:
            d = json.loads(r.read())
            gpu = d.get("devices", [{}])[0].get("name", "?")
            print(f"ComfyUI: OK   GPU: {gpu}")
            return True
    except Exception as e:
        print(f"ComfyUI: NOT AVAILABLE ({e})")
        return False


def filter_jobs(prompts, category, langs):
    """Filter the master prompt list by category and language."""
    out = []
    for p in prompts:
        # job ids look like:
        #   letters_<lang>_<key>     numbers_<key>     animals_<key>
        if category != "all":
            if not p["id"].startswith(category):
                continue
        if langs and p["id"].startswith("letters_"):
            # letters_<lang>_<key>  — second segment is lang
            lang = p["id"].split("_", 2)[1]
            if lang not in langs:
                continue
        out.append(p)
    return out


def main():
    parser = argparse.ArgumentParser(description="Generate flashcard images via ComfyUI / Qwen-Image")
    parser.add_argument("--category", default="all",
                        choices=["all", "letters", "numbers", "animals"])
    parser.add_argument("--lang", default="all",
                        help=f"For category=letters: comma-separated codes ({','.join(LANGUAGES)}) or 'all'")
    parser.add_argument("--width", type=int, default=IMAGE_CONFIG.get("width", 768))
    parser.add_argument("--height", type=int, default=IMAGE_CONFIG.get("height", 768))
    parser.add_argument("--steps", type=int, default=IMAGE_CONFIG.get("steps", 8))
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--skip-existing", action="store_true", default=True,
                        help="Skip files that already exist (size > 1 KB)")
    parser.add_argument("--no-skip", dest="skip_existing", action="store_false",
                        help="Regenerate even when output exists")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    langs = None if args.lang == "all" else set(args.lang.split(","))
    all_prompts = get_all_image_prompts()
    jobs = filter_jobs(all_prompts, args.category, langs)

    print(f"\n{'='*60}")
    print(f"Teach Your Kids — Image Generator (Qwen-Image)")
    print(f"{'='*60}")
    print(f"Category: {args.category}   Langs: {args.lang}")
    print(f"Total jobs: {len(jobs)}   Output: {OUTPUT_DIR}")
    print(f"{args.width}x{args.height}, {args.steps} steps, base seed={args.seed}")
    print(f"{'='*60}\n")

    if args.dry_run:
        for p in jobs[:30]:
            print(f"[{p['id']}] -> {p['filename']}")
            print(f"  {p['prompt'][:120]}...")
        if len(jobs) > 30:
            print(f"\n(+{len(jobs) - 30} more)")
        return

    if not server_ok():
        sys.exit(1)

    client_id = str(uuid.uuid4())
    generated = skipped = 0
    errors = []
    started = time.time()

    for i, p in enumerate(jobs):
        out_path = OUTPUT_DIR / p["filename"]

        if args.skip_existing and out_path.exists() and out_path.stat().st_size > 1000:
            print(f"[{i+1}/{len(jobs)}] SKIP: {p['filename']}")
            skipped += 1
            continue

        print(f"\n[{i+1}/{len(jobs)}] {p['id']}")
        print(f"  -> {p['filename']}")
        try:
            t0 = time.time()
            wf = build_workflow(
                prompt=p["prompt"], neg=NEG,
                width=args.width, height=args.height,
                seed=args.seed + i, steps=args.steps,
            )
            pid = queue_prompt(wf, client_id)
            result = wait_for(pid, timeout=600)
            saved = False
            for _, node_out in result.get("outputs", {}).items():
                for img in node_out.get("images", []):
                    download(img["filename"], img.get("subfolder", ""), out_path)
                    saved = True
            if saved:
                size_kb = out_path.stat().st_size / 1024
                print(f"  Saved ({size_kb:.0f} KB) in {time.time()-t0:.1f}s")
                generated += 1
            else:
                errors.append((p["id"], "no image in output"))
        except Exception as e:
            print(f"  ERROR: {e}")
            errors.append((p["id"], str(e)))

    elapsed = time.time() - started
    print(f"\n{'='*60}")
    print(f"DONE in {elapsed/60:.1f} min")
    print(f"  Generated: {generated}")
    print(f"  Skipped:   {skipped}")
    print(f"  Errors:    {len(errors)}")
    if errors:
        print("\nErrors:")
        for eid, msg in errors[:20]:
            print(f"  [{eid}] {msg}")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
