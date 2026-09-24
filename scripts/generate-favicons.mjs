/**
 * Build browser-tab favicons as an SA cutout (transparent outside the mark).
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

function nearLight(r, g, b) {
  return (r + g + b) / 3 > 140;
}
function nearDark(r, g, b) {
  return r + g + b < 120;
}

/** Pack PNG buffers into a multi-size .ico (PNG-in-ICO). */
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
 * Keep light S + dark A; everything else transparent so the tab icon
 * is the monogram silhouette, not a square plate.
 */
async function cutoutMonogram() {
  const { data, info } = await sharp(srcLogo).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(data.length);
  const w = info.width;
  const h = info.height;

  let minX = w;
  let minY = h;
  let maxX = 0;
  let maxY = 0;

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
        out[i] = 18;
        out[i + 1] = 18;
        out[i + 2] = 18;
        out[i + 3] = 255;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
        continue;
      }

      if (nearLight(r, g, b)) {
        out[i] = 210;
        out[i + 1] = 210;
        out[i + 2] = 210;
        out[i + 3] = 255;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
        continue;
      }

      const lum = (r + g + b) / (3 * 255);
      out[i] = 210;
      out[i + 1] = 210;
      out[i + 2] = 210;
      out[i + 3] = Math.round(a * lum);
      if (out[i + 3] > 8) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
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
  const cutout = await cutoutMonogram();
  await cutout.clone().png().toFile(path.join(outDir, "favicon-cutout.png"));
  console.log("wrote favicon-cutout.png");

  const icoPngs = [];
  for (const size of [16, 32, 48, 64, 192]) {
    const name = `favicon-${size}.png`;
    const buf = await writeSized(cutout, size, name);
    if (size === 16 || size === 32 || size === 48) icoPngs.push(buf);
  }
  await writeSized(cutout, 32, "favicon.png");

  const ico = pngIco(icoPngs);
  await fs.writeFile(path.join(outDir, "favicon.ico"), ico);
  console.log("wrote favicon.ico", ico.length);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
