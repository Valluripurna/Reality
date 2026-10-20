/**
 * Generates every raster brand asset from one geometry definition, so the app
 * icon, Android adaptive icon, splash image and favicon can never drift apart
 * from the in-app <BrandMark /> (src/brand.tsx uses the same numbers).
 *
 * The mark: a bold "R" whose leg runs on into a check — the record, verified.
 *
 *   node scripts/generate-brand-assets.js
 *
 * Pure Node (zlib only). Shapes are rendered as signed-distance fields with
 * 4x4 supersampling for clean anti-aliased edges.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// ---- Brand tokens (keep in sync with src/ui.tsx and src/brand.tsx) ----
const INK = [17, 18, 20];
const WHITE = [255, 255, 255];
const GREEN = [22, 163, 116];

// Geometry in a 100x100 box. Mirrors MARK in src/brand.tsx.
const MARK = {
  stroke: 10.5,
  // Stem + bowl of the R
  stemX: 23,
  top: 25,
  bottom: 75,
  bowlEndX: 42,
  bowlRadius: 13,
  // The R's leg (white) lands on the baseline, then rises as a check (green)
  legStart: [36, 51],
  legLow: [51, 75],
  tickEnd: [77, 49]
};

// ---------------------------------------------------------------- geometry
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

/** Distance to the right-hand half circle (the R's bowl). */
function bowlArcDist(px, py, cx, cy, r) {
  if (px >= cx) return Math.abs(Math.hypot(px - cx, py - cy) - r);
  // Outside the half-plane the arc's nearest points are its two endpoints.
  return Math.min(Math.hypot(px - cx, py - (cy - r)), Math.hypot(px - cx, py - (cy + r)));
}

function roundedRectDist(px, py, x, y, w, h, r) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const qx = Math.abs(px - cx) - (w / 2 - r);
  const qy = Math.abs(py - cy) - (h / 2 - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

/** Returns { white, green } coverage-distance functions for the mark in 0..100 space. */
function markShapes() {
  const m = MARK;
  const half = m.stroke / 2;
  const bowlCy = m.top + m.bowlRadius;
  const bowlBottom = m.top + m.bowlRadius * 2;
  return {
    white(px, py) {
      const d = Math.min(
        segDist(px, py, m.stemX, m.top, m.stemX, m.bottom),
        segDist(px, py, m.stemX, m.top, m.bowlEndX, m.top),
        segDist(px, py, m.stemX, bowlBottom, m.bowlEndX, bowlBottom),
        bowlArcDist(px, py, m.bowlEndX, bowlCy, m.bowlRadius),
        segDist(px, py, m.legStart[0], m.legStart[1], m.legLow[0], m.legLow[1])
      );
      return d - half;
    },
    green(px, py) {
      return segDist(px, py, m.legLow[0], m.legLow[1], m.tickEnd[0], m.tickEnd[1]) - half;
    }
  };
}

// ---------------------------------------------------------------- raster
function render(size, { background, tile, markScale = 1, markColorWhite = WHITE }) {
  const px = Buffer.alloc(size * size * 4);
  const shapes = markShapes();
  const SS = 4;
  const unit = size / 100;
  // Mark is scaled around the canvas centre.
  const toMark = v => (v - 50) / markScale + 50;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const ux = (x + (sx + 0.5) / SS) / unit;
          const uy = (y + (sy + 0.5) / SS) / unit;
          let col = null;
          let alpha = 0;
          if (background) { col = background; alpha = 1; }
          if (tile && roundedRectDist(ux, uy, tile.inset, tile.inset, 100 - tile.inset * 2, 100 - tile.inset * 2, tile.radius) <= 0) {
            col = tile.color; alpha = 1;
          }
          const mx = toMark(ux);
          const my = toMark(uy);
          if (shapes.white(mx, my) <= 0) { col = markColorWhite; alpha = 1; }
          if (shapes.green(mx, my) <= 0) { col = GREEN; alpha = 1; }
          if (col) { r += col[0] * alpha; g += col[1] * alpha; b += col[2] * alpha; a += alpha; }
        }
      }
      const n = SS * SS;
      const i = (y * size + x) * 4;
      if (a > 0) {
        px[i] = Math.round(r / a);
        px[i + 1] = Math.round(g / a);
        px[i + 2] = Math.round(b / a);
      }
      px[i + 3] = Math.round((a / n) * 255);
    }
  }
  return encodePng(size, px);
}

// ---------------------------------------------------------------- png
function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const kind = Buffer.from(type);
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  kind.copy(out, 4);
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([kind, data])), 8 + data.length);
  return out;
}

function encodePng(size, pixels) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

// ---------------------------------------------------------------- outputs
module.exports = { render, encodePng, markShapes, roundedRectDist, MARK, INK, WHITE, GREEN };
if (require.main !== module) return;

const out = path.join(__dirname, '..', 'assets');
fs.mkdirSync(path.join(out, 'brand'), { recursive: true });

// Vector master, for the store listing, website and print.
const svg = (bg, rColor) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="1024" height="1024">
${bg ? `  <rect width="100" height="100" rx="22" fill="${bg}"/>\n` : ''}  <g fill="none" stroke-width="${MARK.stroke}" stroke-linecap="round" stroke-linejoin="round"${bg ? ' transform="translate(50 50) scale(0.78) translate(-50 -50)"' : ''}>
    <path d="M${MARK.stemX} ${MARK.bottom} V${MARK.top} H${MARK.bowlEndX} A${MARK.bowlRadius} ${MARK.bowlRadius} 0 0 1 ${MARK.bowlEndX} ${MARK.top + MARK.bowlRadius * 2} H${MARK.stemX} M${MARK.legStart.join(' ')} L${MARK.legLow.join(' ')}" stroke="${rColor}"/>
    <path d="M${MARK.legLow.join(' ')} L${MARK.tickEnd.join(' ')}" stroke="rgb(${GREEN.join(',')})"/>
  </g>
</svg>
`;
fs.writeFileSync(path.join(out, 'brand', 'mark-tile.svg'), svg('#111214', '#FFFFFF'));
fs.writeFileSync(path.join(out, 'brand', 'mark-dark.svg'), svg(null, '#111214'));
fs.writeFileSync(path.join(out, 'brand', 'mark-light.svg'), svg(null, '#FFFFFF'));
console.log('wrote assets/brand/mark-{tile,dark,light}.svg');

const targets = [
  // iOS/Android legacy icon: opaque square, the OS applies its own mask.
  ['icon.png', 1024, { background: INK, markScale: 0.78 }],
  // Android adaptive foreground: transparent, mark kept inside the 66% safe zone.
  ['adaptive-icon.png', 1024, { markScale: 0.5 }],
  // Splash image: transparent mark, composited on the ink splash background.
  ['splash.png', 1024, { markScale: 1 }],
  // Web favicon: rounded tile so it reads on light and dark browser chrome.
  ['favicon.png', 96, { tile: { color: INK, inset: 2, radius: 24 }, markScale: 0.8 }],
  // Google Play listing icon (512x512, opaque).
  ['brand/play-store-icon.png', 512, { background: INK, markScale: 0.78 }]
];

for (const [name, size, opts] of targets) {
  fs.writeFileSync(path.join(out, name), render(size, opts));
  console.log(`wrote assets/${name} (${size}x${size})`);
}
