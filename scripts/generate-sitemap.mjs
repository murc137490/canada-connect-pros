/**
 * Writes public/sitemap.xml from the service category slugs in src/data/services.ts
 * plus the public marketing routes. Run before `vite build`.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(resolve(root, "src/data/services.ts"), "utf8");
const orderMatch = source.match(/const catOrder = \[([\s\S]*?)\];/);
if (!orderMatch) {
  console.error("generate-sitemap: could not find catOrder in src/data/services.ts");
  process.exit(1);
}

const categorySlugs = [...orderMatch[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]);
if (categorySlugs.length === 0) {
  console.error("generate-sitemap: catOrder was empty");
  process.exit(1);
}

const ORIGIN = "https://www.altshift.ca";

/** @type {{ loc: string, changefreq: string, priority: string }[]} */
const urls = [
  { loc: `${ORIGIN}/`, changefreq: "weekly", priority: "1.0" },
  { loc: `${ORIGIN}/services`, changefreq: "weekly", priority: "0.9" },
  ...categorySlugs.map((slug) => ({
    loc: `${ORIGIN}/services/${slug}`,
    changefreq: "weekly",
    priority: "0.7",
  })),
  { loc: `${ORIGIN}/about`, changefreq: "monthly", priority: "0.6" },
  { loc: `${ORIGIN}/join-pros`, changefreq: "monthly", priority: "0.8" },
  { loc: `${ORIGIN}/join-pros/plans`, changefreq: "monthly", priority: "0.7" },
  { loc: `${ORIGIN}/get-app`, changefreq: "monthly", priority: "0.5" },
  { loc: `${ORIGIN}/get-app/android`, changefreq: "monthly", priority: "0.5" },
  { loc: `${ORIGIN}/get-app/ios`, changefreq: "monthly", priority: "0.5" },
  { loc: `${ORIGIN}/make-request`, changefreq: "monthly", priority: "0.8" },
  { loc: `${ORIGIN}/support`, changefreq: "monthly", priority: "0.6" },
  { loc: `${ORIGIN}/terms`, changefreq: "yearly", priority: "0.3" },
  { loc: `${ORIGIN}/privacy`, changefreq: "yearly", priority: "0.3" },
  { loc: `${ORIGIN}/cookies`, changefreq: "yearly", priority: "0.2" },
];

const body = urls
  .map(
    (url) => `  <url>
    <loc>${url.loc}</loc>
    <changefreq>${url.changefreq}</changefreq>
    <priority>${url.priority}</priority>
  </url>`,
  )
  .join("\n");

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;

writeFileSync(resolve(root, "public/sitemap.xml"), xml);
console.log(`Wrote public/sitemap.xml (${urls.length} urls, ${categorySlugs.length} categories)`);
