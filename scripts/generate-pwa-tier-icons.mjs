/**
 * Build brand + PWA icons from the new AS mark (white on black).
 * Run: node scripts/generate-pwa-tier-icons.mjs
 *
 * - client: white mark on black
 * - starter / growth / pro: tier gradient fill on mark, dark tier background
 */
import sharp from "sharp";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const srcLogo = path.join(root, "public", "altshift-logo-source.png");
const outDir = path.join(root, "public");

/** @typedef {[number, number, number]} RGB */
/** @typedef {{ id: string, bg: RGB, theme: string, stops: RGB[] }} Theme */

/** @type {Theme[]} */
const THEMES = [
  {
    id: "client",
    bg: [10, 10, 10],
    theme: "#0a0a0a",
    stops: [[245, 245, 245], [245, 245, 245]],
  },
  {
    id: "starter",
    bg: [15, 23, 42],
    theme: "#1e3a8a",
    // light sky → deep blue (reads as a clear gradient at icon size)
    stops: [
      [186, 230, 253],
      [96, 165, 250],
      [37, 99, 235],
      [30, 64, 175],
    ],
  },
  {
    id: "growth",
    bg: [2, 44, 34],
    theme: "#047857",
    // green → teal → cyan
    stops: [
      [74, 222, 128],
      [16, 185, 129],
      [6, 182, 212],
      [14, 165, 233],
    ],
  },
  {
    id: "pro",
    bg: [30, 27, 75],
    theme: "#6d28d9",
    // purple → orange
    stops: [
      [192, 132, 252],
      [168, 85, 247],
      [249, 115, 22],
      [251, 146, 60],
    ],
  },
];

const MASTER = 1024;

/** @param {RGB[]} stops @param {number} t 0..1 */
function sampleGradient(stops, t) {
  if (stops.length === 1) return stops[0];
  const clamped = Math.max(0, Math.min(1, t));
  const scaled = clamped * (stops.length - 1);
  const i = Math.floor(scaled);
  const f = scaled - i;
  if (i >= stops.length - 1) return stops[stops.length - 1];
  const a = stops[i];
  const b = stops[i + 1];
  return [
    Math.round(a[0] + (b[0] - a[0]) * f),
    Math.round(a[1] + (b[1] - a[1]) * f),
    Math.round(a[2] + (b[2] - a[2]) * f),
  ];
}

/**
 * Place the source mark centered on a square canvas and return
 * { width, height, mark: Float32Array luminance 0..1 per pixel }.
 */
async function loadMarkMask(size) {
  const meta = await sharp(srcLogo).metadata();
  const sw = meta.width ?? 320;
  const sh = meta.height ?? 295;
  const padRatio = 0.12;
  const fit = Math.round(size * (1 - padRatio * 2));
  const scale = Math.min(fit / sw, fit / sh);
  const dw = Math.max(1, Math.round(sw * scale));
  const dh = Math.max(1, Math.round(sh * scale));
  const left = Math.floor((size - dw) / 2);
  const top = Math.floor((size - dh) / 2);

  const resized = await sharp(srcLogo)
    .resize(dw, dh, { fit: "fill" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const mark = new Float32Array(size * size);
  const { data, info } = resized;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const si = (y * info.width + x) * 4;
      const r = data[si];
      const g = data[si + 1];
      const b = data[si + 2];
      const a = data[si + 3] / 255;
      // Source is white mark on black — use luminance as mark strength
      const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      const strength = Math.max(0, Math.min(1, (lum - 0.12) / 0.75)) * a;
      const dx = left + x;
      const dy = top + y;
      if (dx < 0 || dy < 0 || dx >= size || dy >= size) continue;
      mark[dy * size + dx] = Math.max(mark[dy * size + dx], strength);
    }
  }
  return mark;
}

/** @param {Float32Array} mark @param {Theme} theme @param {number} size */
function paintTheme(mark, theme, size) {
  const out = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const m = mark[i];
      const o = i * 4;
      if (m < 0.02) {
        out[o] = theme.bg[0];
        out[o + 1] = theme.bg[1];
        out[o + 2] = theme.bg[2];
        out[o + 3] = 255;
        continue;
      }
      // Diagonal gradient (top-left → bottom-right) reads well on icons
      const t = (x + y) / (2 * (size - 1));
      const [cr, cg, cb] = sampleGradient(theme.stops, t);
      // Soft antialias against bg
      out[o] = Math.round(theme.bg[0] + (cr - theme.bg[0]) * m);
      out[o + 1] = Math.round(theme.bg[1] + (cg - theme.bg[1]) * m);
      out[o + 2] = Math.round(theme.bg[2] + (cb - theme.bg[2]) * m);
      out[o + 3] = 255;
    }
  }
  return sharp(out, { raw: { width: size, height: size, channels: 4 } });
}

/** White mark on transparent — for BrandLogo (CSS invert in light mode). */
async function writeTransparentMaster(mark) {
  const size = MASTER;
  const out = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const m = mark[i];
    const o = i * 4;
    out[o] = 255;
    out[o + 1] = 255;
    out[o + 2] = 255;
    out[o + 3] = Math.round(Math.max(0, Math.min(1, m)) * 255);
  }
  await sharp(out, { raw: { width: size, height: size, channels: 4 } })
    .png()
    .toFile(path.join(outDir, "altshift-logo-transparent.png"));
  console.log("wrote altshift-logo-transparent.png");
}

/** Solid client mark — public/altshift-logo.png */
async function writeSolidMaster(mark) {
  const pipeline = paintTheme(mark, THEMES[0], MASTER);
  await pipeline.png().toFile(path.join(outDir, "altshift-logo.png"));
  console.log("wrote altshift-logo.png");
}

async function writeSized(pipeline, size, file) {
  await pipeline.clone().resize(size, size, { fit: "cover" }).png().toFile(path.join(outDir, file));
  console.log("wrote", file);
}

async function writeMaskable(pipeline, size, file, bg) {
  const pad = Math.round(size * 0.12);
  const inner = size - pad * 2;
  const innerBuf = await pipeline.clone().resize(inner, inner, { fit: "cover" }).png().toBuffer();
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 3,
      background: { r: bg[0], g: bg[1], b: bg[2] },
    },
  })
    .composite([{ input: innerBuf, left: pad, top: pad }])
    .png()
    .toFile(path.join(outDir, file));
  console.log("wrote", file);
}

async function writeManifest(theme) {
  const id = theme.id;
  const prefix = `/pwa-${id}`;
  const bgHex = `#${theme.bg.map((n) => n.toString(16).padStart(2, "0")).join("")}`;
  const manifest = {
    name: "AltShift",
    short_name: "AltShift",
    description:
      "Describe your need and receive quotes from trusted local service professionals across Quebec and Canada.",
    start_url: "/",
    scope: "/",
    id: "/",
    display: "standalone",
    orientation: "any",
    lang: "fr",
    dir: "ltr",
    background_color: bgHex,
    theme_color: theme.theme,
    categories: ["business", "lifestyle"],
    icons: [
      { src: `${prefix}-192x192.png`, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: `${prefix}-512x512.png`, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: `${prefix}-maskable-192x192.png`, sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: `${prefix}-maskable-512x512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: `${prefix}-192x192.png`, sizes: "192x192", type: "image/png", purpose: "any maskable" },
      { src: `${prefix}-512x512.png`, sizes: "512x512", type: "image/png", purpose: "any maskable" },
    ],
  };
  const file = `manifest-${id}.webmanifest`;
  await fs.writeFile(path.join(outDir, file), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log("wrote", file);
}

async function writeFavicons(mark) {
  const client = paintTheme(mark, THEMES[0], MASTER);
  const buf32 = await client.clone().resize(32, 32).png().toBuffer();
  const buf64 = await client.clone().resize(64, 64).png().toBuffer();
  await fs.writeFile(path.join(outDir, "favicon-32.png"), buf32);
  await fs.writeFile(path.join(outDir, "favicon-64.png"), buf64);
  // Multi-size ICO via PNG pack is awkward; write 32px as favicon.ico substitute (browsers accept PNG in practice via link tags).
  // Keep a simple 32→ico using sharp if possible — fallback: copy 32 png bytes won't work as ico.
  // Use PNG renamed is wrong; emit a minimal ICO with embedded 32 PNG.
  await writeIco(buf32, path.join(outDir, "favicon.ico"));
  console.log("wrote favicon-32.png, favicon-64.png, favicon.ico");
}

/** Minimal ICO containing one PNG. */
async function writeIco(pngBuf, dest) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2); // ICO
  header.writeUInt16LE(1, 4); // 1 image
  const entry = Buffer.alloc(16);
  entry[0] = 32;
  entry[1] = 32;
  entry.writeUInt16LE(0, 2);
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(pngBuf.length, 8);
  entry.writeUInt32LE(22, 12); // offset
  await fs.writeFile(dest, Buffer.concat([header, entry, pngBuf]));
}

async function main() {
  await fs.access(srcLogo);
  const mark = await loadMarkMask(MASTER);

  await writeSolidMaster(mark);
  await writeTransparentMaster(mark);
  await writeFavicons(mark);

  for (const theme of THEMES) {
    const logo = paintTheme(mark, theme, MASTER);
    const base = `pwa-${theme.id}`;
    await writeSized(logo, 192, `${base}-192x192.png`);
    await writeSized(logo, 512, `${base}-512x512.png`);
    await writeMaskable(logo, 192, `${base}-maskable-192x192.png`, theme.bg);
    await writeMaskable(logo, 512, `${base}-maskable-512x512.png`, theme.bg);
    await writeSized(logo, 180, `${base}-apple-touch.png`);
    await writeManifest(theme);
  }

  const client = paintTheme(mark, THEMES[0], MASTER);
  await writeSized(client, 192, "pwa-192x192.png");
  await writeSized(client, 512, "pwa-512x512.png");
  await writeMaskable(client, 192, "pwa-maskable-192x192.png", THEMES[0].bg);
  await writeMaskable(client, 512, "pwa-maskable-512x512.png", THEMES[0].bg);
  await writeSized(client, 180, "apple-touch-icon.png");

  // JPEG reference copy
  await paintTheme(mark, THEMES[0], MASTER)
    .jpeg({ quality: 95 })
    .toFile(path.join(outDir, "altshift-logo-current.jpg"));
  console.log("wrote altshift-logo-current.jpg");
  console.log("done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
