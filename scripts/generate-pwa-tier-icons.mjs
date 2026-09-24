/**
 * Generate PWA / home-screen icons for client (B&W) and pro tiers.
 * Run: node scripts/generate-pwa-tier-icons.mjs
 */
import sharp from "sharp";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const srcLogo = path.join(root, "public", "altshift-logo.png");
const outDir = path.join(root, "public");

/** @typedef {{ id: string, bg: [number,number,number], s: [number,number,number], a: [number,number,number], theme: string }} Theme */

/** @type {Theme[]} */
const THEMES = [
  // Normal users — black & white only (white mark, black A counter for contrast)
  { id: "client", bg: [10, 10, 10], s: [245, 245, 245], a: [10, 10, 10], theme: "#0a0a0a" },
  // Starter — blue tier
  { id: "starter", bg: [15, 23, 42], s: [96, 165, 250], a: [248, 250, 252], theme: "#1e3a8a" },
  // Growth — green / teal
  { id: "growth", bg: [2, 44, 34], s: [52, 211, 153], a: [236, 253, 245], theme: "#047857" },
  // Pro — purple + orange accent on the A
  { id: "pro", bg: [30, 27, 75], s: [192, 132, 252], a: [251, 146, 60], theme: "#6d28d9" },
];

function nearWhite(r, g, b) {
  return r > 235 && g > 235 && b > 235;
}
function nearBlack(r, g, b) {
  return r + g + b < 60;
}

async function recolorLogo(theme) {
  const { data, info } = await sharp(srcLogo).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.from(data);
  for (let i = 0; i < out.length; i += 4) {
    const r = out[i];
    const g = out[i + 1];
    const b = out[i + 2];
    const alpha = out[i + 3];
    if (alpha < 20) {
      out[i] = theme.bg[0];
      out[i + 1] = theme.bg[1];
      out[i + 2] = theme.bg[2];
      out[i + 3] = 255;
      continue;
    }
    if (nearWhite(r, g, b)) {
      out[i] = theme.bg[0];
      out[i + 1] = theme.bg[1];
      out[i + 2] = theme.bg[2];
      out[i + 3] = 255;
    } else if (nearBlack(r, g, b)) {
      out[i] = theme.a[0];
      out[i + 1] = theme.a[1];
      out[i + 2] = theme.a[2];
      out[i + 3] = 255;
    } else {
      // Gray S body → tier S color (preserve slight luminance)
      const lum = (r + g + b) / (3 * 255);
      const mix = 0.85 + lum * 0.15;
      out[i] = Math.min(255, Math.round(theme.s[0] * mix));
      out[i + 1] = Math.min(255, Math.round(theme.s[1] * mix));
      out[i + 2] = Math.min(255, Math.round(theme.s[2] * mix));
      out[i + 3] = 255;
    }
  }
  return sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } });
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
    background_color: `#${theme.bg.map((n) => n.toString(16).padStart(2, "0")).join("")}`,
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

async function main() {
  for (const theme of THEMES) {
    const logo = await recolorLogo(theme);
    const base = `pwa-${theme.id}`;
    await writeSized(logo, 192, `${base}-192x192.png`);
    await writeSized(logo, 512, `${base}-512x512.png`);
    await writeMaskable(logo, 192, `${base}-maskable-192x192.png`, theme.bg);
    await writeMaskable(logo, 512, `${base}-maskable-512x512.png`, theme.bg);
    await writeSized(logo, 180, `${base}-apple-touch.png`);
    await writeManifest(theme);
  }

  // Default install assets = client B&W
  const client = await recolorLogo(THEMES[0]);
  await writeSized(client, 192, "pwa-192x192.png");
  await writeSized(client, 512, "pwa-512x512.png");
  await writeMaskable(client, 192, "pwa-maskable-192x192.png", THEMES[0].bg);
  await writeMaskable(client, 512, "pwa-maskable-512x512.png", THEMES[0].bg);
  await writeSized(client, 180, "apple-touch-icon.png");

  console.log("done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
