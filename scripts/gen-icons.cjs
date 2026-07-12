// Generate 7 missing PNG icons for 思迹 App
// Pure Node.js, no external dependencies — uses built-in zlib
const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'static', 'icons');
const SIZE = 24;

// ─── PNG primitives ───────────────────────────────────────────────
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
  const c = Buffer.alloc(4); c.writeUInt32BE(crc32(Buffer.concat([tb, data])), 0);
  return Buffer.concat([len, tb, data, c]);
}

// ─── Pixel canvas ──────────────────────────────────────────────────
class Canvas {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.data = Buffer.alloc(w * h * 4, 0);
  }
  set(x, y, r, g, b, a) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    this.data[i] = r; this.data[i+1] = g; this.data[i+2] = b; this.data[i+3] = a;
  }
  // Blend a pixel with alpha
  blend(x, y, r, g, b, a) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    const srcA = a / 255;
    const dstA = this.data[i+3] / 255;
    const outA = srcA + dstA * (1 - srcA);
    if (outA === 0) return;
    this.data[i]   = Math.round((r * srcA + this.data[i]   * dstA * (1 - srcA)) / outA);
    this.data[i+1] = Math.round((g * srcA + this.data[i+1] * dstA * (1 - srcA)) / outA);
    this.data[i+2] = Math.round((b * srcA + this.data[i+2] * dstA * (1 - srcA)) / outA);
    this.data[i+3] = Math.round(outA * 255);
  }
  // Anti-aliased line (Xiaolin Wu) — simplified: just draw with blending
  line(x0, y0, x1, y1, r, g, b, a, thick) {
    thick = thick || 1.6;
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    const steps = Math.max(dx, dy);
    if (steps === 0) { this.fillCircle(Math.round(x0), Math.round(y0), thick/2, r, g, b, a); return; }
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const cx = x0 + t * (x1 - x0), cy = y0 + t * (y1 - y0);
      this.fillCircle(Math.round(cx), Math.round(cy), thick / 2, r, g, b, a);
    }
  }
  fillCircle(cx, cy, radius, r, g, b, a) {
    const r2 = radius * radius;
    const x0 = Math.max(0, Math.floor(cx - radius));
    const x1 = Math.min(this.w - 1, Math.ceil(cx + radius));
    const y0 = Math.max(0, Math.floor(cy - radius));
    const y1 = Math.min(this.h - 1, Math.ceil(cy + radius));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const d2 = (x - cx) * (x - cx) + (y - cy) * (y - cy);
        if (d2 <= r2) {
          // Edge anti-aliasing
          const edge = r2 - d2;
          const aa = edge < 1 ? Math.round(a * edge) : a;
          this.blend(x, y, r, g, b, aa);
        }
      }
    }
  }
  strokeCircle(cx, cy, radius, thick, r, g, b, a) {
    const outer2 = (radius + thick/2) * (radius + thick/2);
    const inner2 = (radius - thick/2) * (radius - thick/2);
    const x0 = Math.max(0, Math.floor(cx - radius - thick));
    const x1 = Math.min(this.w - 1, Math.ceil(cx + radius + thick));
    const y0 = Math.max(0, Math.floor(cy - radius - thick));
    const y1 = Math.min(this.h - 1, Math.ceil(cy + radius + thick));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const d2 = (x - cx) * (x - cx) + (y - cy) * (y - cy);
        if (d2 <= outer2 && d2 >= inner2) {
          // Edge AA on both sides
          const outerEdge = Math.min(1, (outer2 - d2));
          const innerEdge = Math.min(1, (d2 - inner2));
          const aa = Math.round(a * Math.min(outerEdge, innerEdge));
          this.blend(x, y, r, g, b, aa || a);
        }
      }
    }
  }
  fillRect(x, y, w, h, r, g, b, a) {
    for (let dy = 0; dy < h; dy++)
      for (let dx = 0; dx < w; dx++)
        this.set(x + dx, y + dy, r, g, b, a);
  }
  strokeRect(x, y, w, h, thick, r, g, b, a) {
    this.fillRect(x, y, w, thick, r, g, b, a);
    this.fillRect(x, y + h - thick, w, thick, r, g, b, a);
    this.fillRect(x, y, thick, h, r, g, b, a);
    this.fillRect(x + w - thick, y, thick, h, r, g, b, a);
  }
  // Rounded rect (filled)
  fillRoundedRect(x, y, w, h, rx, ry, r, g, b, a) {
    rx = Math.min(rx, w/2); ry = Math.min(ry, h/2);
    // Center rect
    this.fillRect(x + rx, y, w - 2*rx, h, r, g, b, a);
    this.fillRect(x, y + ry, w, h - 2*ry, r, g, b, a);
    // Corner circles
    this.fillCircle(x + rx, y + ry, rx, r, g, b, a);
    this.fillCircle(x + w - rx - 1, y + ry, rx, r, g, b, a);
    this.fillCircle(x + rx, y + h - ry - 1, rx, r, g, b, a);
    this.fillCircle(x + w - rx - 1, y + h - ry - 1, rx, r, g, b, a);
  }
  // Rounded rect stroke
  strokeRoundedRect(x, y, w, h, rx, ry, thick, r, g, b, a) {
    rx = Math.min(rx, w/2); ry = Math.min(ry, h/2);
    const iw = w - 2*rx, ih = h - 2*ry;
    // Top/Bottom edges
    this.fillRect(x + rx, y, iw, thick, r, g, b, a);
    this.fillRect(x + rx, y + h - thick, iw, thick, r, g, b, a);
    this.fillRect(x, y + ry, thick, ih, r, g, b, a);
    this.fillRect(x + w - thick, y + ry, thick, ih, r, g, b, a);
    // Corner arcs
    this.strokeCircle(x + rx, y + ry, rx, thick, r, g, b, a);
    this.strokeCircle(x + w - rx - 1, y + ry, rx, thick, r, g, b, a);
    this.strokeCircle(x + rx, y + h - ry - 1, rx, thick, r, g, b, a);
    this.strokeCircle(x + w - rx - 1, y + h - ry - 1, rx, thick, r, g, b, a);
  }
}

function encode(canvas) {
  // Build raw pixel rows with filter byte
  const raw = Buffer.alloc(canvas.h * (1 + canvas.w * 4));
  for (let y = 0; y < canvas.h; y++) {
    const ro = y * (1 + canvas.w * 4);
    raw[ro] = 0; // filter: None
    canvas.data.copy(raw, ro + 1, y * canvas.w * 4, (y + 1) * canvas.w * 4);
  }
  return raw;
}

function writePNG(filePath, canvas) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(canvas.w, 0);
  ihdrData.writeUInt32BE(canvas.h, 4);
  ihdrData[8] = 8;  // bit depth
  ihdrData[9] = 6;  // color type: RGBA
  const compressed = zlib.deflateSync(encode(canvas));
  fs.writeFileSync(filePath,
    Buffer.concat([sig, chunk('IHDR', ihdrData), chunk('IDAT', compressed), chunk('IEND', Buffer.alloc(0))])
  );
  console.log(`  ✓ ${path.basename(filePath)} (${canvas.w}x${canvas.h})`);
}

// ─── Icon definitions ─────────────────────────────────────────────
function drawIcon(draw) {
  const c = new Canvas(SIZE, SIZE);
  draw(c);
  return c;
}

// Colors
const BLACK = [0, 0, 0, 255];
const WHITE = [255, 255, 255, 255];
const GRAY = [100, 100, 100, 255];

const icons = {

  'briefcase': drawIcon(c => {
    // Briefcase body
    c.strokeRoundedRect(3, 11, 18, 10, 2, 2, 1.8, ...BLACK);
    // Handle
    c.strokeRoundedRect(8, 4, 8, 7, 2, 2, 1.8, ...BLACK);
    // Horizontal line cross the middle
    c.line(9, 16, 15, 16, ...BLACK, 1.4);
  }),

  'dumbbell': drawIcon(c => {
    // Bar
    c.fillRect(4, 10, 16, 4, ...BLACK);
    // Left weight
    c.fillRect(1, 5, 4, 14, ...BLACK);
    c.fillRect(2, 5, 2, 14, ...WHITE);
    // Right weight
    c.fillRect(19, 5, 4, 14, ...BLACK);
    c.fillRect(20, 5, 2, 14, ...WHITE);
  }),

  'provider-ds': drawIcon(c => {
    // DeepSeek: rotated square / diamond + crosshair
    c.fillRoundedRect(5, 5, 14, 14, 3, 3, ...BLACK);
    // Inner cross
    c.fillRect(10, 7, 4, 10, ...WHITE);
    c.fillRect(7, 10, 10, 4, ...WHITE);
    // Center dot
    c.fillCircle(12, 12, 2, ...BLACK);
  }),

  'provider-oa': drawIcon(c => {
    // OpenAI: hexagon-like flower pattern
    c.strokeCircle(12, 12, 8, 1.6, ...BLACK);
    // Spiral/loop pattern
    c.fillCircle(12, 12, 3, ...BLACK);
    // Three dots around
    c.fillCircle(12, 6, 1.5, ...BLACK);
    c.fillCircle(17.2, 9, 1.5, ...BLACK);
    c.fillCircle(17.2, 15, 1.5, ...BLACK);
    c.fillCircle(12, 18, 1.5, ...BLACK);
    c.fillCircle(6.8, 15, 1.5, ...BLACK);
    c.fillCircle(6.8, 9, 1.5, ...BLACK);
  }),

  'provider-ms': drawIcon(c => {
    // Moonshot: crescent moon
    c.fillCircle(12, 12, 9, ...BLACK);
    // Cut out crescent shape
    c.fillCircle(15.5, 9.5, 6.5, ...WHITE);
  }),

  'provider-zg': drawIcon(c => {
    // 智谱: Document with text lines
    c.strokeRoundedRect(4, 2, 16, 20, 2, 2, 1.6, ...BLACK);
    // Fold corner
    c.line(14, 2, 14, 7, ...BLACK, 1.4);
    c.line(14, 7, 20, 7, ...BLACK, 1.4);
    // Text lines
    c.fillRect(7, 10, 10, 2, ...BLACK);
    c.fillRect(7, 14, 7, 2, ...BLACK);
    c.fillRect(7, 18, 4, 2, ...BLACK);
  }),

  'camera': drawIcon(c => {
    // Camera body
    c.strokeRoundedRect(3, 7, 18, 15, 3, 3, 1.8, ...BLACK);
    // Lens outer
    c.strokeCircle(12, 14.5, 5.5, 1.8, ...BLACK);
    // Lens inner
    c.strokeCircle(12, 14.5, 3, 1.4, ...BLACK);
    // Flash
    c.fillRect(8, 3, 8, 3, ...BLACK);
    // Flash top curve
    c.fillRoundedRect(9, 1.5, 6, 2, 2, 2, ...BLACK);
  }),

  'provider-qw': drawIcon(c => {
    // 通义千问: Interlocking rings / yin-yang simplified
    const r = 7;
    // Main circle
    c.strokeCircle(12, 12, r, 1.8, ...BLACK);
    // S-curve divider
    c.line(12, 5, 12, 19, ...BLACK, 1.8);
    // Top half fill
    for (let y = 5; y < 12; y++) {
      const dx = Math.sqrt(r * r - (y - 12) * (y - 12));
      for (let x = Math.ceil(12 - dx); x <= 12; x++) {
        c.blend(x, y, ...BLACK);
      }
    }
    // Bottom half fill (right side)
    for (let y = 12; y < 19; y++) {
      const dx = Math.sqrt(r * r - (y - 12) * (y - 12));
      for (let x = 12; x <= Math.floor(12 + dx); x++) {
        c.blend(x, y, ...BLACK);
      }
    }
    // Small dots: top white, bottom black
    c.fillCircle(12, 8.5, 1.8, ...WHITE);
    c.fillCircle(12, 15.5, 1.8, ...BLACK);
  }),
};

// ─── Generate ─────────────────────────────────────────────────────
console.log('Generating icons to:', OUT_DIR);
fs.mkdirSync(OUT_DIR, { recursive: true });

for (const [name, canvas] of Object.entries(icons)) {
  writePNG(path.join(OUT_DIR, `${name}.png`), canvas);
}

console.log(`\nDone! Generated ${Object.keys(icons).length} PNG icons.`);
