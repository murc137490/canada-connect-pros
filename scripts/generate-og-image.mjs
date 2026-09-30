/**
 * Static Open Graph image. Regenerates public/og-image.png.
 * Brand colors match the boot screen (navy + cream).
 */
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#10243f"/>
  <rect x="0" y="0" width="18" height="630" fill="#007A56"/>
  <text x="88" y="280" fill="#f7f4ef" font-family="Noto Serif, serif" font-size="108">AltShift</text>
  <text x="92" y="360" fill="#d7e0ea" font-family="Inter, sans-serif" font-size="32">Local service professionals across Quebec and Canada</text>
  <text x="92" y="412" fill="#d7e0ea" font-family="Inter, sans-serif" font-size="32">Professionnels de services locaux au Québec et au Canada</text>
  <text x="92" y="540" fill="#9eb0c4" font-family="Inter, sans-serif" font-size="22">Les Services AltShift Inc.  ·  altshift.ca</text>
</svg>`;

const png = await sharp(Buffer.from(svg)).png().toBuffer();
writeFileSync(resolve(root, "public/og-image.png"), png);
console.log(`Wrote public/og-image.png (${png.length} bytes)`);
