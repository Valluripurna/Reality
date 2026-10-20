/**
 * Renders a single contact sheet of the brand in context, for review:
 *   - launcher icon (iOS rounded square, Android circle mask)
 *   - splash screen on a phone-shaped frame
 *   - logo on the light app UI
 *
 *   node scripts/preview-brand.js   ->  .expo/brand-preview/sheet.png
 */
const fs = require('fs');
const path = require('path');
const { markShapes, roundedRectDist, INK, WHITE, GREEN } = require('./generate-brand-assets');

const W = 1400;
const H = 900;
const px = Buffer.alloc(W * H * 4);
const BG = [236, 236, 231];
const LIGHT = [255, 255, 255];
const shapes = markShapes();

function put(x, y, c, a = 1) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 4;
  px[i] = Math.round(px[i] * (1 - a) + c[0] * a);
  px[i + 1] = Math.round(px[i + 1] * (1 - a) + c[1] * a);
  px[i + 2] = Math.round(px[i + 2] * (1 - a) + c[2] * a);
  px[i + 3] = 255;
}

/** Paint a region using a per-sample colour function (null = transparent). */
function paint(x0, y0, w, h, fn) {
  const SS = 3;
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      const acc = [0, 0, 0];
      let hits = 0;
      for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
        const c = fn((x - x0 + (sx + 0.5) / SS) / w, (y - y0 + (sy + 0.5) / SS) / h);
        if (c) { acc[0] += c[0]; acc[1] += c[1]; acc[2] += c[2]; hits++; }
      }
      if (hits) put(x, y, acc.map(v => v / hits), hits / (SS * SS));
    }
  }
}

/** Mark colour at unit coords (0..1) inside a box, scaled about its centre. */
function markAt(u, v, scale, rColor) {
  const mx = (u * 100 - 50) / scale + 50;
  const my = (v * 100 - 50) / scale + 50;
  if (shapes.green(mx, my) <= 0) return GREEN;
  if (shapes.white(mx, my) <= 0) return rColor;
  return null;
}

// Background
for (let i = 0; i < W * H; i++) { px[i * 4] = BG[0]; px[i * 4 + 1] = BG[1]; px[i * 4 + 2] = BG[2]; px[i * 4 + 3] = 255; }

// 1. iOS-style icon (rounded square) — 220px
paint(80, 120, 220, 220, (u, v) => {
  if (roundedRectDist(u * 100, v * 100, 0, 0, 100, 100, 22) > 0) return null;
  return markAt(u, v, 0.78, WHITE) ?? INK;
});

// 2. Android adaptive icon in a circle mask — 220px (foreground at 50% scale, zoomed like the launcher does)
paint(80, 420, 220, 220, (u, v) => {
  if (Math.hypot(u - 0.5, v - 0.5) > 0.5) return null;
  return markAt(u, v, 0.5 / 0.66, WHITE) ?? INK;
});

// 3. Small sizes row (48, 32) to check legibility
paint(80, 700, 48, 48, (u, v) => (roundedRectDist(u * 100, v * 100, 0, 0, 100, 100, 22) > 0 ? null : markAt(u, v, 0.78, WHITE) ?? INK));
paint(150, 708, 32, 32, (u, v) => (roundedRectDist(u * 100, v * 100, 0, 0, 100, 100, 22) > 0 ? null : markAt(u, v, 0.78, WHITE) ?? INK));

// 4. Splash on a phone frame — 360x760
paint(400, 70, 360, 760, (u, v) => {
  if (roundedRectDist(u * 360, v * 760, 0, 0, 360, 760, 44) > 0) return null;
  // mark centred, 120dp-equivalent (= 1/3 of phone width)
  const size = 120 / 360;
  const mu = (u - 0.5) / size + 0.5;
  const mv = ((v - 0.5) * 760 / 360) / size + 0.5;
  if (mu >= 0 && mu <= 1 && mv >= 0 && mv <= 1) return markAt(mu, mv, 1, WHITE) ?? INK;
  return INK;
});

// 5. Light app header on a phone frame — logo on white
paint(860, 70, 460, 760, (u, v) => {
  if (roundedRectDist(u * 460, v * 760, 0, 0, 460, 760, 44) > 0) return null;
  // header tile icon at top-left, 56px
  const tx = u * 460 - 32;
  const ty = v * 760 - 60;
  if (tx >= 0 && tx < 56 && ty >= 0 && ty < 56) {
    if (roundedRectDist(tx / 56 * 100, ty / 56 * 100, 0, 0, 100, 100, 24) <= 0) return markAt(tx / 56, ty / 56, 0.78, WHITE) ?? INK;
  }
  // large ink mark on white, centred
  const s = 200;
  const lx = (u * 460 - 130) / s;
  const ly = (v * 760 - 300) / s;
  if (lx >= 0 && lx <= 1 && ly >= 0 && ly <= 1) {
    const c = markAt(lx, ly, 1, INK);
    if (c) return c;
  }
  return LIGHT;
});

const outDir = path.join(__dirname, '..', '.expo', 'brand-preview');
fs.mkdirSync(outDir, { recursive: true });
const file = path.join(outDir, `sheet-${Date.now()}.png`);
fs.writeFileSync(file, encodePngRect());
console.log(file);

function encodePngRect() {
  // encodePng expects a square; build a rectangular PNG here.
  const zlib = require('zlib');
  const raw = Buffer.alloc((W * 4 + 1) * H);
  for (let y = 0; y < H; y++) {
    raw[y * (W * 4 + 1)] = 0;
    px.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(W, 0);
  header.writeUInt32BE(H, 4);
  header[8] = 8;
  header[9] = 6;
  const chunk = (type, data) => {
    const kind = Buffer.from(type);
    const out = Buffer.alloc(12 + data.length);
    out.writeUInt32BE(data.length, 0);
    kind.copy(out, 4);
    data.copy(out, 8);
    let crc = 0xffffffff;
    for (const b of Buffer.concat([kind, data])) { crc ^= b; for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); }
    out.writeUInt32BE((crc ^ 0xffffffff) >>> 0, 8 + data.length);
    return out;
  };
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(raw, { level: 6 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}
