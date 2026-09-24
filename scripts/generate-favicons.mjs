/**
 * Transparent SA cutout favicons + in-app brand marks per tier.
 * Run: node scripts/generate-favicons.mjs
 */
import sharp from "sharp";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const srcLogo = path.join(root, "public", "altshift-logo-transparent.png");
const outDir = path.join(root, "public");

/** @typedef {{ id: string, s: [number,number,number], a: [number,number,number] }} TierColors */

/** @type {TierColors[]} */
const TIERS = [
  { id: "client", s: [210, 210, 210], a: [18, 18, 18] },
  { id: "starter", s: [96, 165, 250], a: [226, 232, 240] },
  { id: "growth", s: [52, 211, 153], a: [236, 253, 245] },
  { id: "pro", s: [192, 132, 252], a: [251, 146, 60] },
];

function nearLight(r, g, b) {
  return (r + g + b) / 3 > 140;
}
function nearDark(r, g, b) {
  return r + g + b < 120;
}

function pngIco(buffers) {
  const count = buffers.length;
  const headerSize = 6 + count * 16;
  let offset = headerSize;
  const entries = [];
  for (const buf of buffers) {
    const w = (buf[16] << 24) | (buf[17] << 16) | (buf[18] << 8) | buf[19];
    const h = (buf[20] << 24) | (buf[21] << 16) | (buf[22] << 8) | buf[23];
    entries.push({
      widthByte: w >= 256 ? 0 : w,
      heightByte: h >= 256 ? 0 : h,
      size: buf.length,
      offset,
      buf,
    });
    offset += buf.length;
  }
  const out = Buffer.alloc(offset);
  out.writeUInt16LE(0, 0);
  out.writeUInt16LE(1, 2);
  out.writeUInt16LE(count, 4);
  let entryAt = 6;
  for (const e of entries) {
    out[entryAt] = e.widthByte;
    out[entryAt + 1] = e.heightByte;
    out[entryAt + 2] = 0;
    out[entryAt + 3] = 0;
    out.writeUInt16LE(1, entryAt + 4);
    out.writeUInt16LE(32, entryAt + 6);
    out.writeUInt32LE(e.size, entryAt + 8);
    out.writeUInt32LE(e.offset, entryAt + 12);
    e.buf.copy(out, e.offset);
    entryAt += 16;
  }
  return out;
}

/**
 * Recolor SA mark with transparent outside (no square plate).
 * Returns cropped sharp pipeline + bbox size.
 */
async function cutoutForTier(tier) {
  const { data, info } = await sharp(srcLogo).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(data.length);
  const w = info.width;
  const h = info.height;

  let minX = w;
  let minY = h;
  let maxX = 0;
  let maxY = 0;

  const mark = (x, y) => {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      if (a < 20) {
        out[i + 3] = 0;
        continue;
      }

      if (nearDark(r, g, b)) {
        out[i] = tier.a[0];
        out[i + 1] = tier.a[1];
        out[i + 2] = tier.a[2];
        out[i + 3] = 255;
        mark(x, y);
        continue;
      }

      if (nearLight(r, g, b)) {
        out[i] = tier.s[0];
        out[i + 1] = tier.s[1];
        out[i + 2] = tier.s[2];
        out[i + 3] = 255;
        mark(x, y);
        continue;
      }

      // Edge anti-alias toward S color
      const lum = (r + g + b) / (3 * 255);
      out[i] = Math.round(tier.a[0] * (1 - lum) + tier.s[0] * lum);
      out[i + 1] = Math.round(tier.a[1] * (1 - lum) + tier.s[1] * lum);
      out[i + 2] = Math.round(tier.a[2] * (1 - lum) + tier.s[2] * lum);
      out[i + 3] = a;
      if (a > 8) mark(x, y);
    }
  }

  const pad = Math.round(Math.max(maxX - minX, maxY - minY) * 0.06);
  const left = Math.max(0, minX - pad);
  const top = Math.max(0, minY - pad);
  const width = Math.min(w - left, maxX - minX + 1 + pad * 2);
  const height = Math.min(h - top, maxY - minY + 1 + pad * 2);

  return sharp(out, { raw: { width: w, height: h, channels: 4 } })
    .extract({ left, top, width, height })
    .png({ compressionLevel: 9 });
}

async function writeSized(pipeline, size, file) {
  const buf = await pipeline
    .clone()
    .resize(size, size, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
  await fs.writeFile(path.join(outDir, file), buf);
  console.log("wrote", file);
  return buf;
}

async function main() {
  let clientIcoPngs = [];

  for (const tier of TIERS) {
    const cutout = await cutoutForTier(tier);

    // In-app / header mark (large transparent)
    await cutout
      .clone()
      .resize(256, 256, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png({ compressionLevel: 9 })
      .toFile(path.join(outDir, `brand-logo-${tier.id}.png`));
    console.log("wrote", `brand-logo-${tier.id}.png`);

    const icoPngs = [];
    for (const size of [16, 32, 48, 64, 192]) {
      const buf = await writeSized(cutout, size, `favicon-${tier.id}-${size}.png`);
      if (size === 16 || size === 32 || size === 48) icoPngs.push(buf);
    }

    const ico = pngIco(icoPngs);
    await fs.writeFile(path.join(outDir, `favicon-${tier.id}.ico`), ico);
    console.log("wrote", `favicon-${tier.id}.ico`, ico.length);

    if (tier.id === "client") {
      clientIcoPngs = icoPngs;
      // Legacy default favicon paths (signed-out / B&W)
      await writeSized(cutout, 32, "favicon-32.png");
      await writeSized(cutout, 64, "favicon-64.png");
      await writeSized(cutout, 192, "favicon-192.png");
      await writeSized(cutout, 16, "favicon-16.png");
      await writeSized(cutout, 48, "favicon-48.png");
      await writeSized(cutout, 32, "favicon.png");
      await cutout.clone().png().toFile(path.join(outDir, "favicon-cutout.png"));
      console.log("wrote favicon-cutout.png");
    }
  }

  const ico = pngIco(clientIcoPngs);
  await fs.writeFile(path.join(outDir, "favicon.ico"), ico);
  console.log("wrote favicon.ico", ico.length);
  console.log("done");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
