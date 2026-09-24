/**
 * Build brand + PWA icons from the AS mark (flat solid fill, no metallic gradients).
 * Run: node scripts/generate-pwa-tier-icons.mjs
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
/** @typedef {{ id: string, bg: RGB, mark: RGB, theme: string }} Theme */

/** Flat solid tier colors — same energy as the old B&W mark, just recolored. */
/** @type {Theme[]} */
const THEMES = [
  { id: "client", bg: [10, 10, 10], mark: [245, 245, 245], theme: "#0a0a0a" },
  { id: "starter", bg: [15, 23, 42], mark: [96, 165, 250], theme: "#1e3a8a" },
  { id: "growth", bg: [2, 44, 34], mark: [52, 211, 153], theme: "#047857" },
  { id: "pro", bg: [30, 27, 75], mark: [192, 132, 252], theme: "#6d28d9" },
];

const MASTER = 1024;
/** Match previous logo scale — almost full canvas, tiny safe margin. */
const PAD_RATIO = 0.04;

/**
 * Place the source mark centered on a square canvas.
 * @returns {Promise<Float32Array>} luminance mask 0..1
 */
async function loadMarkMask(size) {
  const meta = await sharp(srcLogo).metadata();
  const sw = meta.width ?? 320;
  const sh = meta.height ?? 295;
  const fit = Math.round(size * (1 - PAD_RATIO * 2));
  const scale = Math.min(fit / sw, fit / sh);
  const dw = Math.max(1, Math.round(sw * scale));
  const dh = Math.max(1, Math.round(sh * scale));
  const left = Math.floor((size - dw) / 2);
  const top = Math.floor((size - dh) / 2);

  const resized = await sharp(srcLogo)
    .resize(dw, dh, { fit: "fill", kernel: sharp.kernel.lanczos3 })
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
      const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      // Harder threshold → flat mark, soft AA only on the edge
      let strength = 0;
      if (lum > 0.55) strength = 1;
      else if (lum > 0.25) strength = (lum - 0.25) / 0.3;
      strength *= a;
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
  const [mr, mg, mb] = theme.mark;
  const [br, bg, bb] = theme.bg;
  for (let i = 0; i < size * size; i++) {
    const m = mark[i];
    const o = i * 4;
    out[o] = Math.round(br + (mr - br) * m);
    out[o + 1] = Math.round(bg + (mg - bg) * m);
    out[o + 2] = Math.round(bb + (mb - bb) * m);
    out[o + 3] = 255;
  }
  return sharp(out, { raw: { width: size, height: size, channels: 4 } });
}

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

async function writeSolidMaster(mark) {
  await paintTheme(mark, THEMES[0], MASTER).png().toFile(path.join(outDir, "altshift-logo.png"));
  console.log("wrote altshift-logo.png");
}

async function writeSized(pipeline, size, file) {
  await pipeline.clone().resize(size, size, { fit: "cover" }).png().toFile(path.join(outDir, file));
  console.log("wrote", file);
}

async function writeMaskable(pipeline, size, file, bg) {
  const pad = Math.round(size * 0.1);
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

async function writeIco(pngBuf, dest) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  const entry = Buffer.alloc(16);
  entry[0] = 32;
  entry[1] = 32;
  entry.writeUInt16LE(0, 2);
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(pngBuf.length, 8);
  entry.writeUInt32LE(22, 12);
  await fs.writeFile(dest, Buffer.concat([header, entry, pngBuf]));
}

async function writeFavicons(mark) {
  const client = paintTheme(mark, THEMES[0], MASTER);
  const buf32 = await client.clone().resize(32, 32).png().toBuffer();
  const buf64 = await client.clone().resize(64, 64).png().toBuffer();
  await fs.writeFile(path.join(outDir, "favicon-32.png"), buf32);
  await fs.writeFile(path.join(outDir, "favicon-64.png"), buf64);
  await writeIco(buf32, path.join(outDir, "favicon.ico"));
  console.log("wrote favicon-32.png, favicon-64.png, favicon.ico");
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
