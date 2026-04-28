import os

app_dir = r'c:\Users\mktel\Desktop\Teach your kids\app'
audio_dir = os.path.join(app_dir, 'assets', 'audio')
images_dir = os.path.join(app_dir, 'assets', 'images')

lines = ['// Auto-generated Asset Map']

# --- Audio ---
lines.append('export const AudioAssets: Record<string, any> = {')
audio_count = 0
if os.path.exists(audio_dir):
    for root, _, files in os.walk(audio_dir):
        for file in files:
            if file.endswith('.mp3'):
                rel_dir = os.path.relpath(root, app_dir).replace('\\', '/')
                full_rel_path = f'./{rel_dir}/{file}'
                key = f'{os.path.basename(root)}/{file}'
                lines.append(f'  "{key}": require("{full_rel_path}"),')
                audio_count += 1
lines.append('};')

# --- Images ---
lines.append('\nexport const ImageAssets: Record<string, any> = {')
image_count = 0
if os.path.exists(images_dir):
    for root, _, files in os.walk(images_dir):
        for file in files:
            if file.endswith('.webp'):
                rel_dir = os.path.relpath(root, app_dir).replace('\\', '/')
                full_rel_path = f'./{rel_dir}/{file}'
                
                # Image keys usually map to the contentData filenames, e.g. "letters/pl/a_arbuz.webp"
                # We need to construct a key that matches the JSON "filename" field exactly.
                parts = os.path.relpath(root, images_dir).split(os.sep)
                if parts[0] == '.':
                    key = file
                else:
                    key = '/'.join(parts) + '/' + file
                
                lines.append(f'  "{key}": require("{full_rel_path}"),')
                image_count += 1
lines.append('};')

output_path = os.path.join(app_dir, 'AssetMap.ts')
with open(output_path, 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines))
    
print(f'AssetMap.ts generated with {audio_count} MP3 files and {image_count} WebP files.')
