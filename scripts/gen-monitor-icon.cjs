// 一次性生成 monitor-v2.png / monitor-v2-dark.png（4.10.4 外观弹框「跟随系统」图标）
// 与 gen-icons.cjs 同一套 Canvas 原语；规格对齐既有 v2 图标：96×96 RGBA、描边 8px（24 网格 ×4 的 2px）
// Lucide monitor 几何：rect(2,3 → 22,17, rx2) + 底座线 (8,21 → 16,21)，×4 缩放
const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'static', 'icons');
const SIZE = 96;

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let j = 0; j < 8; j++) c = (c & 1) ? ((c >>> 1) ^ 0xEDB88320) : (c >>> 1);
  }
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const tb = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([tb, data])), 0);
  return Buffer.concat([len, tb, data, crcBuf]);
}
class Canvas {
  constructor(w, h) { this.w = w; this.h = h; this.data = Buffer.alloc(w * h * 4, 0); }
  blend(x, y, r, g, b, a) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (Math.round(y) * this.w + Math.round(x)) * 4;
    const pa = this.data[i + 3] / 255, na = a / 255;
    const oa = na + pa * (1 - na);
    if (oa === 0) return;
    this.data[i] = Math.round((r * na + this.data[i] * pa * (1 - na)) / oa);
    this.data[i + 1] = Math.round((g * na + this.data[i + 1] * pa * (1 - na)) / oa);
    this.data[i + 2] = Math.round((b * na + this.data[i + 2] * pa * (1 - na)) / oa);
    this.data[i + 3] = Math.round(oa * 255);
  }
  // 实心圆盘（描边用圆刷沿路径刷）
  fillCircle(cx, cy, r, col) {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const dx = x - cx, dy = y - cy;
        if (dx * dx + dy * dy <= r * r) this.blend(x, y, ...col);
      }
    }
  }
  line(x1, y1, x2, y2, w, col) {
    const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1), 1) * 2;
    for (let i = 0; i <= steps; i++) {
      this.fillCircle(x1 + ((x2 - x1) * i) / steps, y1 + ((y2 - y1) * i) / steps, w / 2, col);
    }
  }
  // 圆角矩形描边
  rectOutline(x, y, w, h, r, sw, col) {
    this.line(x + r, y, x + w - r, y, sw, col);
    this.line(x + r, y + h, x + w - r, y + h, sw, col);
    this.line(x, y + r, x, y + h - r, sw, col);
    this.line(x + w, y + r, x + w, y + h - r, sw, col);
    // 四个圆角
    const corners = [[x + r, y + r, 180, 270], [x + w - r, y + r, 270, 360], [x + w - r, y + h - r, 0, 90], [x + r, y + h - r, 90, 180]];
    for (const [cx, cy, a0, a1] of corners) {
      const steps = 24;
      for (let i = 0; i <= steps; i++) {
        const a = ((a0 + ((a1 - a0) * i) / steps) * Math.PI) / 180;
        this.fillCircle(cx + r * Math.cos(a), cy + r * Math.sin(a), sw / 2, col);
      }
    }
  }
  writePNG(file) {
    const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(this.w, 0); ihdr.writeUInt32BE(this.h, 4);
    ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
    const raw = Buffer.alloc((this.w * 4 + 1) * this.h);
    for (let y = 0; y < this.h; y++) {
      raw[y * (this.w * 4 + 1)] = 0; // filter 0
      this.data.copy(raw, y * (this.w * 4 + 1) + 1, y * this.w * 4, (y + 1) * this.w * 4);
    }
    const idat = zlib.deflateSync(raw, { level: 9 });
    fs.writeFileSync(file, Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]));
  }
}

const DRAW = 4; // 24 网格 ×4
function drawMonitor(color) {
  const c = new Canvas(SIZE, SIZE);
  const sw = 2 * DRAW; // 描边 8px
  // 屏幕：rect(2,3 → 22,17) rx2 → ×4: (8,12) w=80 h=56 rx=8
  c.rectOutline(2 * DRAW, 3 * DRAW, 20 * DRAW, 14 * DRAW, 2 * DRAW, sw, color);
  // 底座线：M8 21 h16 → ×4: (32,84) → (64,84)
  c.line(8 * DRAW, 21 * DRAW, 16 * DRAW, 21 * DRAW, sw, color);
  return c;
}

const OUT = path.join(OUT_DIR, 'monitor-v2.png');
const OUT_DARK = path.join(OUT_DIR, 'monitor-v2-dark.png');
drawMonitor([0x18, 0x18, 0x1B, 255]).writePNG(OUT);   // 浅色：Zinc-900
drawMonitor([0xF4, 0xF4, 0xF5, 255]).writePNG(OUT_DARK); // 深色：Zinc-50
console.log('generated:', OUT, OUT_DARK);
