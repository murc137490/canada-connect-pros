/**
 * Generate PWA / home-screen icons for client + paid tiers.
 * Run: node scripts/generate-pwa-tier-icons.mjs
 *
 * Android/Samsung:
 * - Opaque only (no alpha) for purpose "any" and "maskable"
 * - Absolute icon URLs with ?v= so installers don't keep a stale B&W glyph
 * - A counters painted as the tier background (reads as a punched hole)
 */
import sharp from "sharp";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import {
  TIER_THEMES,
  ICON_ASSET_VER,
  nearDark,
  nearLight,
  sColorAt,
} from "./brand-icon-colors.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const srcLogo = path.join(root, "public", "altshift-logo-transparent.png");
const outDir = path.join(root, "public");
const ORIGIN = "https://www.altshift.ca";

async function recolorLogo(theme) {
  const { data, info } = await sharp(srcLogo).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.from(data);
  const w = info.width;
  const h = info.height;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const r = out[i];
      const g = out[i + 1];
      const b = out[i + 2];
      const alpha = out[i + 3];
      if (alpha < 20 || nearDark(r, g, b)) {
        // Outside + A hole → solid tier background (opaque, Android-safe)
        out[i] = theme.bg[0];
        out[i + 1] = theme.bg[1];
        out[i + 2] = theme.bg[2];
        out[i + 3] = 255;
        continue;
      }
      if (nearLight(r, g, b) || alpha > 8) {
        const [sr, sg, sb] = sColorAt(theme, x, y, w, h, false);
        out[i] = sr;
        out[i + 1] = sg;
        out[i + 2] = sb;
        out[i + 3] = 255;
      }
    }
  }
  return sharp(out, { raw: { width: w, height: h, channels: 4 } });
}

async function writeSized(pipeline, size, file, bg) {
  await pipeline
    .clone()
    .resize(size, size, {
      fit: "contain",
      background: { r: bg[0], g: bg[1], b: bg[2], alpha: 1 },
    })
    .flatten({ background: { r: bg[0], g: bg[1], b: bg[2] } })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(path.join(outDir, file));
  console.log("wrote", file);
}

async function writeMaskable(pipeline, size, file, bg) {
  const pad = Math.round(size * 0.18);
  const inner = size - pad * 2;
  const innerBuf = await pipeline
    .clone()
    .resize(inner, inner, {
      fit: "contain",
      background: { r: bg[0], g: bg[1], b: bg[2], alpha: 1 },
    })
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
    src: `${ORIGIN}${src}?v=${ICON_ASSET_VER}`,
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
  for (const theme of TIER_THEMES) {
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

  const client = await recolorLogo(TIER_THEMES[0]);
  const cbg = TIER_THEMES[0].bg;
  for (const size of [96, 144, 192, 512]) {
    await writeSized(client, size, `pwa-${size}x${size}.png`, cbg);
  }
  await writeMaskable(client, 192, "pwa-maskable-192x192.png", cbg);
  await writeMaskable(client, 512, "pwa-maskable-512x512.png", cbg);
  await writeSized(client, 180, "apple-touch-icon.png", cbg);

  await fs.copyFile(path.join(outDir, "manifest-client.webmanifest"), path.join(outDir, "manifest.webmanifest"));
  console.log("wrote manifest.webmanifest");
  console.log("done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
