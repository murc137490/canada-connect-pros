// Post-build: write dist/sitemap.xml = static public pages + every listed pro's /<username>.
// Uses only the public anon key (same data the site shows). Falls back to public/sitemap.xml
// unchanged if the env or the network is unavailable, so a build never fails because of it.
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const ORIGIN = "https://www.altshift.ca";
const DIST = "dist/sitemap.xml";
const HANDLE_RE = /^[a-z][a-z0-9._-]{2,29}$/;

function loadDotEnv() {
  for (const f of [".env", ".env.local", ".env.production"]) {
    if (!existsSync(f)) continue;
    for (const line of readFileSync(f, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  }
}

async function main() {
  if (!existsSync("dist")) return;
  loadDotEnv();
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  const base = readFileSync("public/sitemap.xml", "utf8");
  if (!url?.startsWith("https://") || !key || key.length < 100) {
    console.log("[sitemap] no Supabase env — kept static sitemap");
    return;
  }
  // Only public columns (security review: pro_profiles column grants). No lastmod: updated_at is private.
  let rows = [];
  try {
    const res = await fetch(
      `${url}/rest/v1/pro_profiles?select=share_slug&is_verified=eq.true&share_slug=not.is.null`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    rows = await res.json();
  } catch (e) {
    console.log(`[sitemap] fetch failed (${e.message}) — kept static sitemap`);
    return;
  }
  const entries = rows
    .map((r) => ({ h: String(r.share_slug ?? "").trim().toLowerCase(), d: String(r.updated_at ?? "").slice(0, 10) }))
    .filter((r) => HANDLE_RE.test(r.h))
    .map(
      (r) =>
        `  <url>\n    <loc>${ORIGIN}/${r.h}</loc>\n${r.d ? `    <lastmod>${r.d}</lastmod>\n` : ""}    <changefreq>weekly</changefreq>\n    <priority>0.6</priority>\n  </url>`,
    );
  const out = base.replace("</urlset>", `${entries.join("\n")}${entries.length ? "\n" : ""}</urlset>`);
  writeFileSync(DIST, out);
  console.log(`[sitemap] wrote ${DIST} with ${entries.length} pro page(s)`);
}

main().catch((e) => console.log(`[sitemap] skipped: ${e.message}`));
