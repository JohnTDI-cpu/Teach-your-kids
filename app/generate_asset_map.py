#!/usr/bin/env python3
"""Auto-generate AssetMap.ts by walking app/assets/.

Produces three exports:
  - AudioAssets   (./assets/audio/**/*.mp3)
  - ImageAssets   (./assets/images/**/*.webp)
  - MenuAssets    (./assets/menu/**/*.webp|.png)

Run from anywhere — paths are resolved relative to this file.
"""
import os

THIS_DIR = os.path.dirname(os.path.abspath(__file__))
APP_DIR = THIS_DIR  # this file lives next to App.tsx

AUDIO_DIR = os.path.join(APP_DIR, 'assets', 'audio')
IMAGES_DIR = os.path.join(APP_DIR, 'assets', 'images')
MENU_DIR = os.path.join(APP_DIR, 'assets', 'menu')


def collect_audio():
    out = []
    if not os.path.isdir(AUDIO_DIR):
        return out
    for root, _, files in os.walk(AUDIO_DIR):
        for f in files:
            if f.endswith('.mp3'):
                sub = os.path.basename(root)
                key = f'{sub}/{f}'
                rel_path = f'./assets/audio/{sub}/{f}'
                out.append((key, rel_path))
    return sorted(out)


def collect_images():
    out = []
    if not os.path.isdir(IMAGES_DIR):
        return out
    for root, _, files in os.walk(IMAGES_DIR):
        for f in files:
            if not f.endswith('.webp'):
                continue
            rel = os.path.relpath(root, IMAGES_DIR).replace(os.sep, '/')
            if rel == '.':
                key = f
                rel_path = f'./assets/images/{f}'
            else:
                key = f'{rel}/{f}'
                rel_path = f'./assets/images/{rel}/{f}'
            out.append((key, rel_path))
    return sorted(out)


def collect_menu():
    out = []
    if not os.path.isdir(MENU_DIR):
        return out
    for f in sorted(os.listdir(MENU_DIR)):
        if f.endswith(('.webp', '.png')):
            out.append((f, f'./assets/menu/{f}'))
    return out


def main():
    audio = collect_audio()
    images = collect_images()
    menu = collect_menu()

    lines = [
        '// Auto-generated Asset Map - do not edit by hand.',
        '// Regenerate with: python3 generate_asset_map.py',
        '',
        'export const AudioAssets: Record<string, any> = {',
    ]
    for k, p in audio:
        lines.append(f'  "{k}": require("{p}"),')
    lines.append('};')
    lines.append('')
    lines.append('export const ImageAssets: Record<string, any> = {')
    for k, p in images:
        lines.append(f'  "{k}": require("{p}"),')
    lines.append('};')
    lines.append('')
    lines.append('export const MenuAssets: Record<string, any> = {')
    for k, p in menu:
        lines.append(f'  "{k}": require("{p}"),')
    lines.append('};')
    lines.append('')

    out_path = os.path.join(APP_DIR, 'AssetMap.ts')
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))

    print(f'Wrote AssetMap.ts: {len(audio)} audio, {len(images)} images, {len(menu)} menu')


if __name__ == '__main__':
    main()
