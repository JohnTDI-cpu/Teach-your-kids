"""
Teach Your Kids — Image Generation Script (ComfyUI API)
Uses FLUX 2 Klein 4B via ComfyUI API with local models from disk.
Designed for RTX 5060 (8GB VRAM).

Prerequisites:
    ComfyUI server must be running on http://127.0.0.1:8188
    Start with: python main.py --listen 127.0.0.1 --port 8188 --base-directory "C:\\Users\\mktel\\Documents\\ComfyUI"

Usage:
    python generate_images.py                    # Generate all images
    python generate_images.py --category animals # Generate only animals
    python generate_images.py --dry-run          # Show prompts without generating
"""

import os
import sys
import time
import json
import uuid
import urllib.request
import urllib.error
from pathlib import Path

sys.path.insert(0, os.path.dirname(__file__))
from content_data import get_all_image_prompts, IMAGE_CONFIG

OUTPUT_DIR = Path(__file__).parent.parent / "app" / "assets" / "images"
COMFYUI_URL = "http://127.0.0.1:8188"

# ComfyUI workflow template for FLUX 2 Klein
def build_workflow(prompt_text: str, seed: int, width: int = 768, height: int = 768, steps: int = 20):
    """Build a ComfyUI API workflow for FLUX 2 Klein image generation."""
    return {
        "3": {  # CLIPLoader — loads text encoder from disk
            "class_type": "CLIPLoader",
            "inputs": {
                "clip_name": "qwen_3_4b_fp4_flux2.safetensors",
                "type": "flux2",
            },
        },
        "5": {  # CLIPTextEncode — encodes our prompt
            "class_type": "CLIPTextEncode",
            "inputs": {
                "text": prompt_text,
                "clip": ["3", 0],
            },
        },
        "10": {  # UNETLoader — loads the diffusion model from disk
            "class_type": "UNETLoader",
            "inputs": {
                "unet_name": "flux-2-klein-4b-fp8.safetensors",
                "weight_dtype": "default",
            },
        },
        "11": {  # VAELoader — loads VAE from disk
            "class_type": "VAELoader",
            "inputs": {
                "vae_name": "flux2-vae.safetensors",
            },
        },
        "13": {  # EmptyLatentImage
            "class_type": "EmptyLatentImage",
            "inputs": {
                "width": width,
                "height": height,
                "batch_size": 1,
            },
        },
        "15": {  # KSampler
            "class_type": "KSampler",
            "inputs": {
                "model": ["10", 0],
                "positive": ["5", 0],
                "negative": ["16", 0],
                "latent_image": ["13", 0],
                "seed": seed,
                "steps": steps,
                "cfg": IMAGE_CONFIG["guidance_scale"],
                "sampler_name": "euler",
                "scheduler": "simple",
                "denoise": 1.0,
            },
        },
        "16": {  # Empty negative conditioning
            "class_type": "CLIPTextEncode",
            "inputs": {
                "text": "",
                "clip": ["3", 0],
            },
        },
        "17": {  # VAEDecode
            "class_type": "VAEDecode",
            "inputs": {
                "samples": ["15", 0],
                "vae": ["11", 0],
            },
        },
        "19": {  # SaveImage — save to ComfyUI output folder
            "class_type": "SaveImage",
            "inputs": {
                "images": ["17", 0],
                "filename_prefix": "teachyourkids",
            },
        },
    }


def queue_prompt(workflow: dict, client_id: str) -> str:
    """Submit a workflow to ComfyUI and return the prompt_id."""
    payload = json.dumps({"prompt": workflow, "client_id": client_id}).encode("utf-8")
    req = urllib.request.Request(
        f"{COMFYUI_URL}/prompt",
        data=payload,
        headers={"Content-Type": "application/json"},
    )
    resp = urllib.request.urlopen(req)
    result = json.loads(resp.read())
    return result["prompt_id"]


def wait_for_completion(prompt_id: str, timeout: int = 300) -> dict:
    """Poll ComfyUI history until the prompt is done."""
    start = time.time()
    while time.time() - start < timeout:
        try:
            resp = urllib.request.urlopen(f"{COMFYUI_URL}/history/{prompt_id}")
            history = json.loads(resp.read())
            if prompt_id in history:
                return history[prompt_id]
        except urllib.error.URLError:
            pass
        time.sleep(1)
    raise TimeoutError(f"Prompt {prompt_id} did not complete within {timeout}s")


def download_image(filename: str, subfolder: str, output_path: Path):
    """Download a generated image from ComfyUI server."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    url = f"{COMFYUI_URL}/view?filename={filename}&subfolder={subfolder}&type=output"
    urllib.request.urlretrieve(url, str(output_path))
    
    size_kb = output_path.stat().st_size / 1024
    print(f"  Saved: {output_path.name} ({size_kb:.0f} KB)")


def check_server():
    """Check if ComfyUI server is running."""
    try:
        resp = urllib.request.urlopen(f"{COMFYUI_URL}/system_stats", timeout=5)
        data = json.loads(resp.read())
        gpu = data.get("devices", [{}])[0].get("name", "unknown")
        print(f"  ComfyUI server: OK")
        print(f"  GPU: {gpu}")
        return True
    except Exception as e:
        print(f"  ComfyUI server: NOT AVAILABLE ({e})")
        print(f"  Start it with:")
        print(f'    python main.py --listen 127.0.0.1 --port 8188 --base-directory "C:\\Users\\mktel\\Documents\\ComfyUI"')
        return False


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Generate educational images via ComfyUI API")
    parser.add_argument("--category", choices=["letters_pl", "letters_en", "numbers", "animals", "all"],
                        default="all", help="Category to generate")
    parser.add_argument("--dry-run", action="store_true", help="Show prompts without generating")
    parser.add_argument("--seed", type=int, default=42, help="Random seed for reproducibility")
    parser.add_argument("--skip-existing", action="store_true", default=True,
                        help="Skip images that already exist")
    args = parser.parse_args()

    all_prompts = get_all_image_prompts()

    if args.category != "all":
        all_prompts = [p for p in all_prompts if p["id"].startswith(args.category)]

    print(f"\n{'='*60}")
    print(f"Teach Your Kids — Image Generator (ComfyUI API)")
    print(f"{'='*60}")
    print(f"Category: {args.category}")
    print(f"Total images: {len(all_prompts)}")
    print(f"Output: {OUTPUT_DIR}")
    print(f"Seed: {args.seed}")
    print(f"{'='*60}\n")

    if args.dry_run:
        for p in all_prompts:
            print(f"[{p['id']}]")
            print(f"  File: {p['filename']}")
            print(f"  Prompt: {p['prompt'][:120]}...")
            print()
        print(f"DRY RUN: {len(all_prompts)} images would be generated.")
        return

    if not check_server():
        sys.exit(1)

    client_id = str(uuid.uuid4())
    generated = 0
    skipped = 0
    errors = []

    for i, p in enumerate(all_prompts):
        output_path = OUTPUT_DIR / p["filename"]

        if args.skip_existing and output_path.exists() and output_path.stat().st_size > 1000:
            print(f"[{i+1}/{len(all_prompts)}] SKIP (exists): {p['filename']}")
            skipped += 1
            continue

        print(f"\n[{i+1}/{len(all_prompts)}] Generating: {p['id']}")
        print(f"  Prompt: {p['prompt'][:100]}...")

        try:
            start = time.time()

            workflow = build_workflow(
                prompt_text=p["prompt"],
                seed=args.seed + i,
                width=IMAGE_CONFIG["width"],
                height=IMAGE_CONFIG["height"],
                steps=IMAGE_CONFIG["steps"],
            )

            prompt_id = queue_prompt(workflow, client_id)
            print(f"  Queued: {prompt_id[:8]}...")

            result = wait_for_completion(prompt_id, timeout=300)

            # Extract generated image info from result
            outputs = result.get("outputs", {})
            for node_id, node_output in outputs.items():
                if "images" in node_output:
                    for img_info in node_output["images"]:
                        download_image(
                            filename=img_info["filename"],
                            subfolder=img_info.get("subfolder", ""),
                            output_path=output_path,
                        )

            elapsed = time.time() - start
            print(f"  Time: {elapsed:.1f}s")
            generated += 1

        except Exception as e:
            import traceback
            print(f"  ERROR: {e}")
            traceback.print_exc()
            errors.append({"id": p["id"], "error": str(e)})

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


if __name__ == "__main__":
    main()
