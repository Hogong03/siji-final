"""
批量生成思迹项目所需的极简黑白 PNG 图标
24x24 网格，黑色线条，透明背景
"""
import os
from PIL import Image, ImageDraw

OUTPUT_DIR = r"C:\Users\c3798\Desktop\思迹\static\icons"
os.makedirs(OUTPUT_DIR, exist_ok=True)

SIZE = 48  # 2x for retina
STROKE = 3
COLOR = (0, 0, 0, 255)

def new_canvas():
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.line_width = STROKE
    return img, draw

def save(img, name):
    img.save(os.path.join(OUTPUT_DIR, f"{name}.png"))
    print(f"  [OK] {name}.png")

def draw_line(draw, coords, width=STROKE):
    draw.line(coords, fill=COLOR, width=width)

def draw_circle(draw, bbox, width=STROKE):
    draw.ellipse(bbox, outline=COLOR, width=width)

def draw_rect(draw, bbox, width=STROKE, radius=0):
    if radius > 0:
        draw.rounded_rectangle(bbox, outline=COLOR, width=width, radius=radius)
    else:
        draw.rectangle(bbox, outline=COLOR, width=width)

def draw_arc(draw, bbox, start, end, width=STROKE):
    draw.arc(bbox, start, end, fill=COLOR, width=width)

# ---- 图标绘制函数 ----

def icon_tip():
    img, d = new_canvas()
    # 灯泡圆 + 底座
    draw_circle(d, [12, 6, 36, 30])
    draw_line(d, [(18, 34), (18, 38)])
    draw_line(d, [(30, 34), (30, 38)])
    draw_line(d, [(16, 40), (32, 40)])
    save(img, "tip")

def icon_diary():
    img, d = new_canvas()
    # 书本
    draw_rect(d, [10, 6, 38, 42], radius=3)
    draw_line(d, [(24, 6), (24, 42)])
    save(img, "diary")

def icon_bill():
    img, d = new_canvas()
    draw_circle(d, [6, 6, 42, 42])
    draw_line(d, [(24, 12), (24, 16)])
    draw_line(d, [(24, 32), (24, 36)])
    draw_line(d, [(18, 20), (30, 20)])
    draw_line(d, [(18, 28), (30, 28)])
    save(img, "bill")

def icon_plan():
    img, d = new_canvas()
    draw_rect(d, [6, 6, 42, 42], radius=4)
    draw_line(d, [(18, 6), (18, 42)])
    draw_line(d, [(6, 18), (18, 18)])
    draw_line(d, [(6, 30), (18, 30)])
    save(img, "plan")

def icon_stats():
    img, d = new_canvas()
    draw_line(d, [(6, 6), (6, 42)])
    draw_line(d, [(6, 42), (42, 42)])
    draw_line(d, [(12, 36), (20, 24)])
    draw_line(d, [(20, 24), (28, 30)])
    draw_line(d, [(28, 30), (38, 14)])
    save(img, "stats")

def icon_search():
    img, d = new_canvas()
    draw_circle(d, [8, 8, 34, 34])
    draw_line(d, [(32, 32), (42, 42)])
    save(img, "search")

def icon_user():
    img, d = new_canvas()
    draw_circle(d, [16, 8, 32, 24])
    draw_arc(d, [8, 26, 40, 46], 180, 360)
    save(img, "user")

def icon_settings():
    img, d = new_canvas()
    draw_circle(d, [16, 16, 32, 32], width=3)
    # 齿轮齿 - 8 条短线
    import math
    cx, cy = 24, 24
    for i in range(8):
        angle = i * 45 * math.pi / 180
        x1 = cx + 10 * math.cos(angle)
        y1 = cy + 10 * math.sin(angle)
        x2 = cx + 16 * math.cos(angle)
        y2 = cy + 16 * math.sin(angle)
        draw_line(d, [(x1, y1), (x2, y2)], width=3)
    save(img, "settings")

def icon_lock():
    img, d = new_canvas()
    draw_rect(d, [10, 22, 38, 42], radius=3)
    draw_arc(d, [14, 10, 34, 30], 180, 360)
    draw_circle(d, [22, 28, 26, 32], width=2)
    save(img, "lock")

def icon_sync():
    img, d = new_canvas()
    draw_arc(d, [8, 8, 40, 40], 300, 170)
    # 箭头
    draw_line(d, [(36, 10), (36, 16), (30, 16)])
    draw_arc(d, [8, 8, 40, 40], 120, 350)
    draw_line(d, [(12, 38), (12, 32), (18, 32)])
    save(img, "sync")

def icon_target():
    img, d = new_canvas()
    draw_circle(d, [4, 4, 44, 44])
    draw_circle(d, [12, 12, 36, 36])
    draw_circle(d, [20, 20, 28, 28])
    save(img, "target")

def icon_brain():
    img, d = new_canvas()
    draw_circle(d, [8, 8, 40, 40])
    draw_line(d, [(24, 14), (24, 34)])
    draw_arc(d, [8, 8, 24, 28], 270, 90)
    draw_arc(d, [24, 8, 40, 28], 270, 90)
    save(img, "brain")

def icon_device():
    img, d = new_canvas()
    draw_rect(d, [12, 4, 36, 44], radius=4)
    draw_line(d, [(20, 38), (28, 38)])
    save(img, "device")

def icon_calendar():
    img, d = new_canvas()
    draw_rect(d, [6, 8, 42, 42], radius=3)
    draw_line(d, [(14, 4), (14, 12)])
    draw_line(d, [(34, 4), (34, 12)])
    draw_line(d, [(6, 18), (42, 18)])
    save(img, "calendar")

def icon_trend():
    img, d = new_canvas()
    draw_line(d, [(6, 6), (6, 42)])
    draw_line(d, [(6, 42), (42, 42)])
    draw_line(d, [(12, 34), (20, 22), (28, 28), (38, 12)])
    save(img, "trend")

def icon_tag():
    img, d = new_canvas()
    # 标签形状
    draw_line(d, [(6, 6), (24, 6), (42, 24), (24, 42), (6, 24)])
    draw_circle(d, [30, 18, 34, 22], width=2)
    save(img, "tag")

def icon_bell():
    img, d = new_canvas()
    draw_arc(d, [10, 8, 38, 36], 180, 360)
    draw_line(d, [(10, 24), (10, 32), (38, 32), (38, 24)])
    draw_line(d, [(20, 36), (28, 36)])
    draw_circle(d, [22, 40, 26, 44], width=2)
    save(img, "bell")

def icon_clock():
    img, d = new_canvas()
    draw_circle(d, [6, 6, 42, 42])
    draw_line(d, [(24, 24), (24, 12)])
    draw_line(d, [(24, 24), (32, 28)])
    save(img, "clock")

def icon_check():
    img, d = new_canvas()
    draw_line(d, [(8, 24), (18, 34), (40, 12)], width=4)
    save(img, "check")

def icon_close():
    img, d = new_canvas()
    draw_line(d, [(12, 12), (36, 36)], width=4)
    draw_line(d, [(36, 12), (12, 36)], width=4)
    save(img, "close")

def icon_download():
    img, d = new_canvas()
    draw_line(d, [(24, 6), (24, 30)])
    draw_line(d, [(14, 22), (24, 32), (34, 22)])
    draw_line(d, [(8, 38), (40, 38)])
    save(img, "download")

def icon_mic():
    img, d = new_canvas()
    draw_rect(d, [18, 6, 30, 26], radius=6)
    draw_arc(d, [10, 14, 38, 38], 0, 180)
    draw_line(d, [(24, 38), (24, 44)])
    save(img, "mic")

def icon_export():
    img, d = new_canvas()
    draw_line(d, [(24, 30), (24, 6)])
    draw_line(d, [(14, 14), (24, 4), (34, 14)])
    draw_line(d, [(8, 38), (40, 38)])
    save(img, "export")

def icon_moon():
    img, d = new_canvas()
    draw_arc(d, [6, 6, 42, 42], 210, 330)
    draw_arc(d, [14, 6, 42, 42], 180, 360)
    save(img, "moon")

def icon_sun():
    img, d = new_canvas()
    draw_circle(d, [16, 16, 32, 32])
    # 射线
    for angle in range(0, 360, 45):
        import math
        rad = angle * math.pi / 180
        x1 = 24 + 12 * math.cos(rad)
        y1 = 24 + 12 * math.sin(rad)
        x2 = 24 + 18 * math.cos(rad)
        y2 = 24 + 18 * math.sin(rad)
        draw_line(d, [(x1, y1), (x2, y2)])
    save(img, "sun")

def icon_shield():
    img, d = new_canvas()
    d.polygon([(24, 4), (40, 12), (40, 26), (24, 42), (8, 26), (8, 12)], outline=COLOR, width=STROKE)
    draw_line(d, [(16, 24), (22, 30), (34, 16)])
    save(img, "shield")

def icon_globe():
    img, d = new_canvas()
    draw_circle(d, [6, 6, 42, 42])
    draw_line(d, [(6, 24), (42, 24)])
    draw_arc(d, [6, 6, 42, 42], 200, 340)
    draw_arc(d, [6, 6, 42, 42], 20, 160)
    save(img, "globe")

def icon_plus():
    img, d = new_canvas()
    draw_line(d, [(24, 8), (24, 40)], width=4)
    draw_line(d, [(8, 24), (40, 24)], width=4)
    save(img, "plus")

def icon_star():
    img, d = new_canvas()
    import math
    points = []
    for i in range(10):
        angle = -90 + i * 36
        rad = angle * math.pi / 180
        r = 18 if i % 2 == 0 else 8
        points.append((24 + r * math.cos(rad), 24 + r * math.sin(rad)))
    d.polygon(points, outline=COLOR, width=STROKE)
    save(img, "star")

def icon_info():
    img, d = new_canvas()
    draw_circle(d, [6, 6, 42, 42])
    draw_line(d, [(24, 20), (24, 32)])
    draw_circle(d, [22, 12, 26, 16], width=2)
    save(img, "info")

def icon_copy():
    img, d = new_canvas()
    draw_rect(d, [14, 14, 42, 42], radius=3)
    draw_line(d, [(14, 18), (6, 18), (6, 42), (30, 42), (30, 34)])
    save(img, "copy")

def icon_edit():
    img, d = new_canvas()
    draw_line(d, [(28, 6), (42, 20)])
    draw_line(d, [(10, 38), (6, 42), (10, 38), (28, 20)])
    draw_line(d, [(6, 42), (10, 38)])
    save(img, "edit")

def icon_trash():
    img, d = new_canvas()
    draw_line(d, [(8, 10), (40, 10)])
    draw_line(d, [(14, 10), (14, 6), (34, 6), (34, 10)])
    draw_rect(d, [12, 10, 36, 42], radius=2)
    draw_line(d, [(20, 16), (20, 38)])
    draw_line(d, [(28, 16), (28, 38)])
    save(img, "trash")

def icon_arrow_down():
    img, d = new_canvas()
    draw_line(d, [(12, 18), (24, 30), (36, 18)], width=4)
    save(img, "arrow-down")

def icon_arrow_up():
    img, d = new_canvas()
    draw_line(d, [(12, 30), (24, 18), (36, 30)], width=4)
    save(img, "arrow-up")

def icon_arrow_left():
    img, d = new_canvas()
    draw_line(d, [(30, 12), (18, 24), (30, 36)], width=4)
    save(img, "arrow-left")

def icon_arrow_right():
    img, d = new_canvas()
    draw_line(d, [(18, 12), (30, 24), (18, 36)], width=4)
    save(img, "arrow-right")

def icon_chevron_down():
    img, d = new_canvas()
    draw_line(d, [(12, 18), (24, 30), (36, 18)], width=3)
    save(img, "chevron-down")

def icon_chevron_right():
    img, d = new_canvas()
    draw_line(d, [(18, 12), (30, 24), (18, 36)], width=3)
    save(img, "chevron-right")

def icon_menu():
    img, d = new_canvas()
    draw_line(d, [(8, 14), (40, 14)], width=3)
    draw_line(d, [(8, 24), (40, 24)], width=3)
    draw_line(d, [(8, 34), (40, 34)], width=3)
    save(img, "menu")

def icon_more_h():
    img, d = new_canvas()
    draw_circle(d, [10, 22, 14, 26], width=2)
    draw_circle(d, [22, 22, 26, 26], width=2)
    draw_circle(d, [34, 22, 38, 26], width=2)
    save(img, "more-h")

def icon_eye():
    img, d = new_canvas()
    # 眼睛轮廓
    d.polygon([(6, 24), (18, 12), (30, 12), (42, 24), (30, 36), (18, 36)], outline=COLOR, width=STROKE)
    draw_circle(d, [18, 18, 30, 30])
    save(img, "eye")

def icon_eye_off():
    img, d = new_canvas()
    d.polygon([(6, 24), (18, 12), (30, 12), (42, 24), (30, 36), (18, 36)], outline=COLOR, width=STROKE)
    draw_line(d, [(10, 10), (38, 38)])
    save(img, "eye-off")

def icon_heart():
    img, d = new_canvas()
    d.polygon([(24, 40), (6, 22), (6, 14), (14, 8), (24, 18), (34, 8), (42, 14), (42, 22)], outline=COLOR, width=STROKE)
    save(img, "heart")

def icon_filter():
    img, d = new_canvas()
    d.polygon([(6, 8), (42, 8), (28, 26), (28, 40), (20, 40), (20, 26)], outline=COLOR, width=STROKE)
    save(img, "filter")

def icon_refresh():
    img, d = new_canvas()
    draw_arc(d, [8, 8, 40, 40], 300, 200)
    draw_line(d, [(36, 8), (36, 14), (30, 14)])
    draw_line(d, [(12, 40), (12, 34), (18, 34)])
    save(img, "refresh")

def icon_save():
    img, d = new_canvas()
    draw_rect(d, [8, 6, 40, 42], radius=3)
    draw_rect(d, [14, 6, (40-3), 18])  # top notch
    draw_rect(d, [16, 24, 32, 42])  # bottom box
    save(img, "save")

def icon_ai():
    img, d = new_canvas()
    # 机器人头
    draw_rect(d, [10, 12, 38, 36], radius=4)
    draw_line(d, [(24, 6), (24, 12)])
    draw_circle(d, [22, 4, 26, 8], width=2)
    draw_circle(d, [16, 20, 20, 24], width=2)  # 左眼
    draw_circle(d, [28, 20, 32, 24], width=2)  # 右眼
    draw_line(d, [(18, 30), (30, 30)])  # 嘴
    save(img, "ai")

def icon_x():
    img, d = new_canvas()
    draw_line(d, [(12, 12), (36, 36)], width=4)
    draw_line(d, [(36, 12), (12, 36)], width=4)
    save(img, "x")

def icon_palette():
    img, d = new_canvas()
    draw_circle(d, [6, 6, 42, 42])
    draw_circle(d, [16, 14, 20, 18], width=2)
    draw_circle(d, [28, 14, 32, 18], width=2)
    draw_circle(d, [14, 26, 18, 30], width=2)
    draw_circle(d, [28, 26, 32, 30], width=2)
    save(img, "palette")

def icon_mail():
    img, d = new_canvas()
    draw_rect(d, [6, 10, 42, 38], radius=3)
    draw_line(d, [(6, 10), (24, 26), (42, 10)])
    save(img, "mail")

def icon_book():
    img, d = new_canvas()
    draw_rect(d, [8, 6, (42-0), 42], radius=3)
    draw_line(d, [(24, 6), (24, 42)])
    save(img, "book")

def icon_smile():
    img, d = new_canvas()
    draw_circle(d, [6, 6, 42, 42])
    draw_circle(d, [16, 18, 20, 22], width=2)
    draw_circle(d, [28, 18, 32, 22], width=2)
    draw_arc(d, [14, 20, 34, 36], 0, 180)
    save(img, "smile")

def icon_sparkle():
    img, d = new_canvas()
    # 四角星
    import math
    points = []
    for i in range(8):
        angle = -90 + i * 45
        rad = angle * math.pi / 180
        r = 18 if i % 2 == 0 else 6
        points.append((24 + r * math.cos(rad), 24 + r * math.sin(rad)))
    d.polygon(points, outline=COLOR, width=STROKE)
    save(img, "sparkle")

def icon_fire():
    img, d = new_canvas()
    # 火焰形状
    d.polygon([(24, 4), (32, 16), (36, 24), (32, 36), (24, 42), (16, 36), (12, 24), (16, 16)], outline=COLOR, width=STROKE)
    save(img, "fire")

def icon_home():
    img, d = new_canvas()
    d.polygon([(6, 22), (24, 6), (42, 22), (42, 42), (6, 42)], outline=COLOR, width=STROKE)
    draw_rect(d, [18, 28, 30, 42])
    save(img, "home")

def icon_pin():
    img, d = new_canvas()
    d.polygon([(24, 4), (36, 16), (30, 22), (24, 42), (18, 22), (12, 16)], outline=COLOR, width=STROKE)
    draw_circle(d, [20, 14, 28, 22])
    save(img, "pin")

def icon_chat_bubble():
    img, d = new_canvas()
    d.polygon([(6, 8), (42, 8), (42, 32), (20, 32), (10, 42), (10, 32), (6, 32)], outline=COLOR, width=STROKE)
    save(img, "chat-bubble")

def icon_voice_wave():
    img, d = new_canvas()
    d.polygon([(4, 18), (14, 18), (22, 10), (22, 38), (14, 30), (4, 30)], outline=COLOR, width=STROKE)
    draw_arc(d, [24, 16, 36, 32], 300, 60)
    draw_arc(d, [24, 10, 42, 38], 300, 60)
    save(img, "voice-wave")

def icon_music():
    img, d = new_canvas()
    draw_line(d, [(14, 36), (14, 10), (36, 6), (36, 30)])
    draw_circle(d, [10, 34, 18, 42], width=3)
    draw_circle(d, [32, 28, 40, 36], width=3)
    save(img, "music")

def icon_unlock():
    img, d = new_canvas()
    draw_rect(d, [10, 22, 38, 42], radius=3)
    draw_arc(d, [14, 8, 34, 28], 180, 360)
    save(img, "unlock")

# ---- 批量生成 ----
ICONS = [
    icon_tip, icon_diary, icon_bill, icon_plan, icon_stats,
    icon_search, icon_user, icon_settings, icon_lock, icon_sync,
    icon_target, icon_brain, icon_device, icon_calendar, icon_trend,
    icon_tag, icon_bell, icon_clock, icon_check, icon_close,
    icon_download, icon_mic, icon_export, icon_moon, icon_sun,
    icon_shield, icon_globe, icon_plus, icon_star, icon_info,
    icon_copy, icon_edit, icon_trash, icon_arrow_down, icon_arrow_up,
    icon_arrow_left, icon_arrow_right, icon_chevron_down, icon_chevron_right,
    icon_menu, icon_more_h, icon_eye, icon_eye_off, icon_heart,
    icon_filter, icon_refresh, icon_save, icon_ai, icon_x,
    icon_palette, icon_mail, icon_book, icon_smile, icon_sparkle,
    icon_fire, icon_home, icon_pin, icon_chat_bubble, icon_voice_wave,
    icon_music, icon_unlock
]

print(f"Generating {len(ICONS)} icons to {OUTPUT_DIR}...")
for fn in ICONS:
    fn()
print(f"\nDone! {len(ICONS)} icons generated.")
