import { readFileSync, writeFileSync } from "node:fs";

const body = readFileSync(
  "apple-pay/apple-developer-merchantid-domain-association",
  "utf8",
);

if (body.startsWith("{") || body.length < 8000) {
  console.error(
    "Association file looks decoded/short. Keep the Square hex download (~9098 chars).",
  );
  process.exit(1);
}

const rev = `hex-${body.length}-${Date.now().toString(36)}`;

const middleware = `/**
 * Square Apple Pay domain association (hex, ~9098 bytes).
 * Served only from Edge Middleware so Vercel CDN cannot keep serving an old
 * decoded JSON copy (4549 bytes) that Square rejects as "partial response".
 *
 * Source of truth: apple-pay/apple-developer-merchantid-domain-association
 * Sync: node scripts/sync-apple-pay-middleware.mjs
 */
export const config = {
  matcher: "/.well-known/apple-developer-merchantid-domain-association",
};

const BODY = ${JSON.stringify(body)};
const REV = ${JSON.stringify(rev)};

export default function middleware() {
  const bytes = new TextEncoder().encode(BODY);
  return new Response(bytes, {
    status: 200,
    headers: {
      "Content-Type": "text/plain",
      "Content-Disposition":
        'attachment; filename="apple-developer-merchantid-domain-association"',
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      "CDN-Cache-Control": "no-store",
      "Vercel-CDN-Cache-Control": "no-store",
      "Accept-Ranges": "none",
      "X-Assoc-Rev": REV,
      "X-Assoc-Bytes": String(bytes.byteLength),
    },
  });
}
`;

writeFileSync("middleware.ts", middleware);
console.log(`Wrote middleware.ts rev=${rev} bytes=${body.length}`);
