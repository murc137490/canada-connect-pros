/**
 * Generate PWA / home-screen icons for client (B&W) and pro tiers.
 * Run: node scripts/generate-pwa-tier-icons.mjs
 *
 * Samsung / Android notes:
 * - Never use purpose "any maskable" (breaks some installers → Android robot).
 * - Maskable + any icons must be opaque (no alpha).
 * - Keep maskable artwork inside ~80% safe zone.
 */
import sharp from "sharp";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const srcLogo = path.join(root, "public", "altshift-logo.png");
const outDir = path.join(root, "public");
/** Absolute icon URLs — Samsung Internet resolves relative paths inconsistently. */
const ORIGIN = "https://www.altshift.ca";

/** @typedef {{ id: string, bg: [number,number,number], s: [number,number,number], a: [number,number,number], theme: string }} Theme */

/** @type {Theme[]} */
const THEMES = [
  // Normal users — black & white only (white mark, black A counter for contrast)
  { id: "client", bg: [10, 10, 10], s: [245, 245, 245], a: [10, 10, 10], theme: "#0a0a0a" },
  // Starter — blue tier
  { id: "starter", bg: [15, 23, 42], s: [96, 165, 250], a: [248, 250, 252], theme: "#1e3a8a" },
  // Growth — green / teal
  { id: "growth", bg: [2, 44, 34], s: [52, 211, 153], a: [236, 253, 245], theme: "#047857" },
  // Pro — purple mark on deep indigo
  { id: "pro", bg: [30, 27, 75], s: [192, 132, 252], a: [251, 146, 60], theme: "#6d28d9" },
];

function nearWhite(r, g, b) {
  return r > 200 && g > 200 && b > 200;
}
function nearBlack(r, g, b) {
  return r + g + b < 80;
}

/**
 * Source art is white AS mark on black (or transparent).
 * - transparent / black → theme background
 * - white / light mark → theme.s (tier accent)
 * - mid anti-alias → blend toward theme.s
 */
async function recolorLogo(theme) {
  const { data, info } = await sharp(srcLogo).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.from(data);
  for (let i = 0; i < out.length; i += 4) {
    const r = out[i];
    const g = out[i + 1];
    const b = out[i + 2];
    const alpha = out[i + 3];
    if (alpha < 20 || nearBlack(r, g, b)) {
      out[i] = theme.bg[0];
      out[i + 1] = theme.bg[1];
      out[i + 2] = theme.bg[2];
      out[i + 3] = 255;
      continue;
    }
    if (nearWhite(r, g, b)) {
      out[i] = theme.s[0];
      out[i + 1] = theme.s[1];
      out[i + 2] = theme.s[2];
      out[i + 3] = 255;
      continue;
    }
    // Anti-aliased edge: mix accent into background by luminance
    const lum = (r + g + b) / (3 * 255);
    out[i] = Math.round(theme.bg[0] * (1 - lum) + theme.s[0] * lum);
    out[i + 1] = Math.round(theme.bg[1] * (1 - lum) + theme.s[1] * lum);
    out[i + 2] = Math.round(theme.bg[2] * (1 - lum) + theme.s[2] * lum);
    out[i + 3] = 255;
  }
  return sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } });
}

/** Flatten to opaque RGB PNG (Samsung rejects / mishandles alpha on install icons). */
async function writeSized(pipeline, size, file, bg) {
  await pipeline
    .clone()
    .resize(size, size, { fit: "cover" })
    .flatten({ background: { r: bg[0], g: bg[1], b: bg[2] } })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(path.join(outDir, file));
  console.log("wrote", file);
}

async function writeMaskable(pipeline, size, file, bg) {
  // ~18% pad → logo stays inside Android 80% safe-zone circle (Samsung squircles).
  const pad = Math.round(size * 0.18);
  const inner = size - pad * 2;
  const innerBuf = await pipeline
    .clone()
    .resize(inner, inner, { fit: "cover" })
    .flatten({ background: { r: bg[0], g: bg[1], b: bg[2] } })
    .png()
    .toBuffer();
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 3,
      background: { r: bg[0], g: bg[1], b: bg[2] },
    },
  })
    .composite([{ input: innerBuf, left: pad, top: pad }])
    .flatten({ background: { r: bg[0], g: bg[1], b: bg[2] } })
    .removeAlpha()
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(path.join(outDir, file));
  console.log("wrote", file);
}

function iconEntry(src, sizes, purpose) {
  return {
    src: `${ORIGIN}${src}`,
    sizes,
    type: "image/png",
    purpose,
  };
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
    // Separate any vs maskable only — "any maskable" breaks Samsung install icons.
    icons: [
      iconEntry(`${prefix}-96x96.png`, "96x96", "any"),
      iconEntry(`${prefix}-144x144.png`, "144x144", "any"),
      iconEntry(`${prefix}-192x192.png`, "192x192", "any"),
      iconEntry(`${prefix}-512x512.png`, "512x512", "any"),
      iconEntry(`${prefix}-maskable-192x192.png`, "192x192", "maskable"),
      iconEntry(`${prefix}-maskable-512x512.png`, "512x512", "maskable"),
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
    for (const size of [96, 144, 192, 512]) {
      await writeSized(logo, size, `${base}-${size}x${size}.png`, theme.bg);
    }
    await writeMaskable(logo, 192, `${base}-maskable-192x192.png`, theme.bg);
    await writeMaskable(logo, 512, `${base}-maskable-512x512.png`, theme.bg);
    await writeSized(logo, 180, `${base}-apple-touch.png`, theme.bg);
    await writeManifest(theme);
  }

  // Default install assets = client B&W
  const client = await recolorLogo(THEMES[0]);
  const cbg = THEMES[0].bg;
  for (const size of [96, 144, 192, 512]) {
    await writeSized(client, size, `pwa-${size}x${size}.png`, cbg);
  }
  await writeMaskable(client, 192, "pwa-maskable-192x192.png", cbg);
  await writeMaskable(client, 512, "pwa-maskable-512x512.png", cbg);
  await writeSized(client, 180, "apple-touch-icon.png", cbg);

  // Fallback path some Android WebViews still request
  await fs.copyFile(path.join(outDir, "manifest-client.webmanifest"), path.join(outDir, "manifest.webmanifest"));
  console.log("wrote manifest.webmanifest");

  console.log("done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
