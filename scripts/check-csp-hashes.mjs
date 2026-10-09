#!/usr/bin/env node
// Prints the sha256 hashes of the inline <script> blocks in dist/index.html and checks they are
// listed in the Content-Security-Policy(-Report-Only) script-src in vercel.json.
// Run after `npm run build` whenever index.html's inline scripts change:  node scripts/check-csp-hashes.mjs
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../dist/index.html", import.meta.url), "utf8");
const vercel = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
const csp = (vercel.headers ?? [])
  .flatMap((h) => h.headers ?? [])
  .filter((h) => /^Content-Security-Policy/i.test(h.key))
  .map((h) => h.value)
  .join(" ");

let missing = 0;
for (const m of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)) {
  const hash = `'sha256-${createHash("sha256").update(m[1], "utf8").digest("base64")}'`;
  const ok = csp.includes(hash);
  if (!ok) missing += 1;
  console.log(`${ok ? "ok     " : "MISSING"} ${hash}`);
}
if (missing) {
  console.error(`${missing} inline script hash(es) missing from vercel.json script-src.`);
  process.exit(1);
}
