from PIL import Image
import os

os.chdir(r"C:\Users\c3798\Desktop\思迹")

icons = ['plan-v3', 'bill-v3', 'diary-v3', 'edit-v3', 'calendar-v3']
for name in icons:
    src = f'static/icons/{name}.png'
    img = Image.open(src).convert('RGBA')
    w, h = img.size
    px = img.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if r > 235 and g > 235 and b > 235:
                px[x, y] = (0, 0, 0, 0)
    img.save(src)
    dark = img.copy()
    dpx = dark.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = dpx[x, y]
            if a > 0:
                dpx[x, y] = (255, 255, 255, a)
    dark_name = name.replace('-v3', '-v3-dark')
    dark.save(f'static/icons/{dark_name}.png')
    print(f'OK {name} + {dark_name}')
