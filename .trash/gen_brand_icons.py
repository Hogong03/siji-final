"""
思迹 App — 品牌图标 + Agent 图标 生成器
生成高质量 64×64 PNG 图标
"""
from PIL import Image, ImageDraw, ImageFont
import math, os

OUT_DIR = r"C:\Users\c3798\Desktop\思迹\static\icons"
SIZE = 64
os.makedirs(OUT_DIR, exist_ok=True)

# ─── Colors ───────────────────────────────────────
class C:
    DS_BLUE   = (77, 107, 254)     # DeepSeek brand blue
    ZP_BLUE   = (56, 89, 255)      # 智谱 brand blue
    QW_PURPLE = (97, 93, 250)      # 通义千问 purple
    MS_BLACK  = (0, 0, 0)          # Kimi/Moonshot black
    OA_GREEN  = (16, 163, 127)     # OpenAI green accent
    WHITE     = (255, 255, 255)
    ZINC_900  = (24, 24, 27)       # #18181B
    ZINC_700  = (63, 63, 70)       # #3F3F46
    ZINC_400  = (161, 161, 170)    # #A1A1AA
    ZINC_200  = (228, 228, 231)    # #E4E4E7
    ZINC_100  = (244, 244, 245)    # #F4F4F5
    ZINC_50   = (250, 250, 250)    # #FAFAFA

def new_img(bg=C.WHITE):
    img = Image.new('RGBA', (SIZE, SIZE), bg + (0,) if bg is None else bg + (255,))
    return img, ImageDraw.Draw(img)

def save(name, img):
    path = os.path.join(OUT_DIR, f"{name}.png")
    img.save(path, 'PNG')
    sz = os.path.getsize(path)
    print(f"  OK {name}.png ({sz} bytes)")
    return path

def draw_circle(d, cx, cy, r, fill=None, width=0, outline=None):
    """Draw circle. width>0 means stroke, fill=None is transparent fill"""
    if outline and width:
        d.ellipse([cx-r, cy-r, cx+r, cy+r], fill=fill, outline=outline, width=width)
    elif width:
        d.ellipse([cx-r, cy-r, cx+r, cy+r], fill=fill, outline=fill, width=width)
    elif outline:
        d.ellipse([cx-r, cy-r, cx+r, cy+r], fill=fill, outline=outline, width=1)
    else:
        d.ellipse([cx-r, cy-r, cx+r, cy+r], fill=fill)

def draw_rounded_rect(d, xy, r, fill, outline=None, width=0):
    x1, y1, x2, y2 = xy
    d.rounded_rectangle([x1, y1, x2, y2], radius=r, fill=fill, outline=outline, width=width)

def draw_line(d, pt1, pt2, fill, width=2):
    d.line([pt1, pt2], fill=fill, width=width)

def polygon_centered(d, cx, cy, sides, radius, rotation, fill, outline=None, width=0):
    pts = []
    for i in range(sides):
        angle = rotation + 2 * math.pi * i / sides
        x = cx + radius * math.cos(angle)
        y = cy + radius * math.sin(angle)
        pts.append((x, y))
    d.polygon(pts, fill=fill, outline=outline, width=width)

# ═══════════════════════════════════════════════════
# 品牌 Logo 设计
# ═══════════════════════════════════════════════════

def logo_deepseek():
    """DeepSeek – stylized infinity/loop with brand blue"""
    img, d = new_img()
    cx, cy = SIZE/2, SIZE/2
    
    # Outer rounded square (brand blue)
    draw_rounded_rect(d, [8, 8, 56, 56], 12, C.DS_BLUE)
    
    # Inner white loop/knot shape (simplified infinity)
    # Left arc
    d.arc([16, 22, 32, 42], 90, -90, fill=C.WHITE, width=5)
    # Right arc  
    d.arc([32, 22, 48, 42], -90, 90, fill=C.WHITE, width=5)
    # Cross lines
    draw_line(d, (24, 22), (32, 22), C.WHITE, 5)
    draw_line(d, (32, 42), (40, 42), C.WHITE, 5)
    
    # Center dot
    draw_circle(d, cx, cy, 3, C.WHITE)
    return img

def logo_zhipu():
    """智谱GLM – document/page with blue accent"""
    img, d = new_img()
    
    # Document shape
    draw_rounded_rect(d, [10, 6, 54, 58], 6, C.WHITE, outline=C.ZP_BLUE, width=3)
    
    # Top header bar
    draw_rounded_rect(d, [10, 6, 54, 20], 6, C.ZP_BLUE)
    # Fix bottom corners of header
    d.rectangle([10, 14, 54, 20], fill=C.ZP_BLUE)
    
    # Text lines
    for i, (l, w) in enumerate([(27, 36), (27, 32), (27, 28)]):
        draw_rounded_rect(d, [18, l, 18 + w, l + 4], 2, C.ZINC_400)
    
    return img

def logo_qwen():
    """通义千问 – stylized Q/ring in brand purple"""
    img, d = new_img()
    cx, cy = SIZE/2, SIZE/2
    
    # Large ring
    draw_circle(d, cx, cy, 21, None, outline=C.QW_PURPLE, width=4)
    
    # Inner filled ring (top half)
    draw_circle(d, cx, cy, 14, C.QW_PURPLE)
    # Cut out bottom-left quarter to make it look like a "Q"
    d.pieslice([cx-14, cy-14, cx+14, cy+14], 225, 315, fill=C.WHITE)
    
    # Tail of Q
    draw_line(d, (cx+6, cy+8), (cx+14, cy+18), C.QW_PURPLE, 4)
    
    return img

def logo_moonshot():
    """Moonshot/Kimi – crescent moon + star in black"""
    img, d = new_img()
    cx, cy = SIZE/2, SIZE/2
    
    # Full circle
    draw_circle(d, cx, cy, 20, C.MS_BLACK)
    # Cut out with offset circle to create crescent
    draw_circle(d, cx+8, cy-4, 14, C.WHITE)
    
    # Small star
    star_cx, star_cy = cx+9, cy-12
    polygon_centered(d, star_cx, star_cy, 4, 5, math.pi/4, C.MS_BLACK)
    
    return img

def logo_openai():
    """OpenAI – hexagonal flower/bloom mark in black + green"""
    img, d = new_img()
    cx, cy = SIZE/2, SIZE/2
    
    # Six interlocking petal shapes (simplified OpenAI bloom)
    for i in range(6):
        angle = math.pi / 3 * i
        px = cx + 14 * math.cos(angle)
        py = cy + 14 * math.sin(angle)
        draw_circle(d, px, py, 7, C.MS_BLACK)
    
    # Center dot
    draw_circle(d, cx, cy, 4, C.OA_GREEN)
    
    return img

# ═══════════════════════════════════════════════════
# Agent 类型图标（Zinc 黑灰阶风格）
# ═══════════════════════════════════════════════════

def agent_icon(name, draw_fn):
    img, d = new_img(C.ZINC_50)
    # Draw on 48×48 area centered in 64×64 canvas
    draw_fn(d, 32, 32, 48)
    save(f"agent-{name}", img)

def icon_circle_bg(d, cx, cy, size, fill_inner=None):
    """Helper: draw circle background"""
    r = size // 2
    if fill_inner:
        draw_circle(d, cx, cy, r, fill_inner, width=1)
    else:
        draw_circle(d, cx, cy, r, C.ZINC_100, width=1)

# ── Agent: 思迹助手 (default) ──
img, d = new_img(C.ZINC_50)
cx, cy = 32, 32
# Friendly chat bubble shape
draw_rounded_rect(d, [8, 10, 56, 46], 14, C.ZINC_900)
# Tail of bubble
d.polygon([(40, 46), (46, 56), (34, 46)], fill=C.ZINC_900)
# "AI" text lines inside
draw_rounded_rect(d, [18, 20, 46, 27], 3, C.WHITE)
draw_rounded_rect(d, [18, 32, 38, 39], 3, C.WHITE)
save("agent-siji", img)

# ── Agent: 职场参谋 ──
img, d = new_img(C.ZINC_50)
cx, cy = 32, 32
# Briefcase body
draw_rounded_rect(d, [8, 22, 56, 54], 6, C.ZINC_900)
# Handle
draw_rounded_rect(d, [22, 10, 42, 24], 6, C.ZINC_900)
# Middle clasp
draw_rounded_rect(d, [27, 34, 37, 40], 2, C.ZINC_200)
# Horizontal line
draw_line(d, (10, 40), (54, 40), C.ZINC_200, 1)
save("agent-workplace", img)

# ── Agent: 情感顾问 ──
img, d = new_img(C.ZINC_50)
cx, cy = 32, 32
# Heart shape (two circles + triangle)
draw_circle(d, 23, 26, 10, C.ZINC_900)
draw_circle(d, 41, 26, 10, C.ZINC_900)
d.polygon([(13, 28), (51, 28), (32, 55)], fill=C.ZINC_900)
# Inner highlight
draw_circle(d, 19, 22, 3, C.WHITE)
save("agent-relationship", img)

# ── Agent: 求职教练 ──
img, d = new_img(C.ZINC_50)
cx, cy = 32, 32
# Target/bullseye
draw_circle(d, cx, cy, 20, C.ZINC_100, width=1)
draw_circle(d, cx, cy, 13, C.ZINC_900, width=2)
draw_circle(d, cx, cy, 6, C.ZINC_900, width=2)
draw_circle(d, cx, cy, 2, C.ZINC_900)
# Arrow through target (upper right)
draw_line(d, (cx+18, cy-18), (cx+6, cy), C.ZINC_900, 3)
# Arrowhead
pts = [(cx+18, cy-18), (cx+12, cy-20), (cx+14, cy-13)]
d.polygon(pts, fill=C.ZINC_900)
save("agent-career", img)

# ── Template: 心理咨询师 ──
img, d = new_img(C.ZINC_50)
cx, cy = 32, 32
# Brain silhouette (simplified)
draw_rounded_rect(d, [12, 8, 52, 48], 22, C.ZINC_900)
# Brain fold lines
draw_line(d, (22, 16), (22, 44), C.WHITE, 3)
draw_line(d, (32, 12), (32, 44), C.WHITE, 3)
draw_line(d, (42, 16), (42, 44), C.WHITE, 3)
# Horizontal connector
draw_line(d, (16, 28), (48, 28), C.WHITE, 3)
# Brain stem
d.rectangle([28, 48, 36, 56], fill=C.ZINC_900)
save("agent-psychologist", img)

# ── Template: 健身教练 ──
img, d = new_img(C.ZINC_50)
# Dumbbell
bar_y = 28
d.rectangle([10, bar_y-3, 54, bar_y+3], fill=C.ZINC_900)
# Left weight
d.rounded_rectangle([5, 12, 16, 44], radius=4, fill=C.ZINC_900)
draw_rounded_rect(d, [7, 14, 14, 42], 2, C.WHITE)
# Right weight
d.rounded_rectangle([48, 12, 59, 44], radius=4, fill=C.ZINC_900)
draw_rounded_rect(d, [50, 14, 57, 42], 2, C.WHITE)
save("agent-fitness", img)

# ── Template: 财务顾问 ──
img, d = new_img(C.ZINC_50)
cx, cy = 32, 32
# Circle with ¥ symbol
draw_circle(d, cx, cy, 20, C.ZINC_900)
# ¥ symbol in white (simplified)
d.rectangle([22, 18, 42, 21], fill=C.WHITE)  # top bar
d.line([32, 18, 32, 46], fill=C.WHITE, width=4)
d.line([22, 28, 42, 28], fill=C.WHITE, width=4)
d.line([24, 34, 28, 42], fill=C.WHITE, width=3)
d.line([40, 34, 36, 42], fill=C.WHITE, width=3)
save("agent-finance", img)

# ── Template: 学习伙伴 ──
img, d = new_img(C.ZINC_50)
# Open book
# Left page
d.rounded_rectangle([8, 10, 30, 54], radius=4, fill=C.ZINC_900)
# Right page
d.rounded_rectangle([34, 10, 56, 54], radius=4, fill=C.ZINC_900)
# Spine highlight
d.rectangle([30, 10, 34, 54], fill=C.ZINC_700)
# Page lines left
for y in [16, 22, 28, 34, 40]:
    d.rectangle([13, y, 27, y+2], fill=C.ZINC_200)
# Page lines right
for y in [16, 22, 28]:
    d.rectangle([37, y, 53, y+2], fill=C.ZINC_200)
# Bookmark
d.rectangle([32, 10, 34, 22], fill=C.ZINC_400)
save("agent-study", img)

# ── Template: 极简助手 ──
img, d = new_img(C.ZINC_50)
cx, cy = 32, 32
# Single clean diamond shape
draw_circle(d, cx, cy, 18, C.ZINC_900)
# Minimalist center dot
draw_circle(d, cx, cy, 5, C.WHITE)
# Subtle ring
draw_circle(d, cx, cy, 10, C.WHITE, width=1)
save("agent-minimal", img)

# ── Agent: Custom/generic ──
img, d = new_img(C.ZINC_50)
cx, cy = 32, 32
draw_circle(d, cx, cy, 18, C.ZINC_200, width=1)
# Plus sign in center
draw_rounded_rect(d, [cx-6, cy-1.5, cx+6, cy+1.5], 1, C.ZINC_400)
draw_rounded_rect(d, [cx-1.5, cy-6, cx+1.5, cy+6], 1, C.ZINC_400)
save("agent-custom", img)

# ═══════════════════════════════════════════════════
# 保存 Logo + Agent 图标
# ═══════════════════════════════════════════════════

print("\n=== Brand Logos ===")
save("provider-ds", logo_deepseek())
save("provider-zg", logo_zhipu())
save("provider-qw", logo_qwen())
save("provider-ms", logo_moonshot())
save("provider-oa", logo_openai())

print("\nDone - All brand logos + agent icons generated")
