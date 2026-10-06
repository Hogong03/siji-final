from PIL import Image
import os

os.chdir(r"C:\Users\c3798\Desktop\思迹")

icons = ['plan-v3', 'bill-v3', 'diary-v3', 'edit-v3', 'calendar-v3']
PAD = 80  # 保留少量边距

for name in icons:
    for suffix in ['', '-dark']:
        path = f'static/icons/{name}{suffix}.png'
        if not os.path.exists(path):
            continue
        img = Image.open(path).convert('RGBA')
        bbox = img.getbbox()  # 非透明区域
        if bbox:
            l, t, r, b = bbox
            l = max(0, l - PAD)
            t = max(0, t - PAD)
            r = min(img.width, r + PAD)
            b = min(img.height, b + PAD)
            cropped = img.crop((l, t, r, b))
            # 居中放回 1024x1024
            canvas = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
            ox = (1024 - cropped.width) // 2
            oy = (1024 - cropped.height) // 2
            canvas.paste(cropped, (ox, oy), cropped)
            canvas.save(path)
            print(f'OK {os.path.basename(path)}: {img.size} -> cropped to content')
