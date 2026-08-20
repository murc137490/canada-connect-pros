import { readFileSync, writeFileSync } from "node:fs";

const body = readFileSync(
  "public/.well-known/apple-developer-merchantid-domain-association",
  "utf8",
);

const middleware = `/**
 * Square Apple Pay domain verification.
 * Vercel static CDN answers HTTP Range with 206 Partial Content; Square reports "partial response".
 * Middleware always returns 200 + full body and ignores Range.
 *
 * After replacing public/.well-known/apple-developer-merchantid-domain-association, run:
 *   node scripts/sync-apple-pay-middleware.mjs
 */
export const config = {
  matcher: "/.well-known/apple-developer-merchantid-domain-association",
};

const BODY = ${JSON.stringify(body)};

export default function middleware() {
  const bytes = new TextEncoder().encode(BODY);
  return new Response(bytes, {
    status: 200,
    headers: {
      "Content-Type": "text/plain",
      "Content-Disposition":
        'attachment; filename="apple-developer-merchantid-domain-association"',
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "no-store",
      "Accept-Ranges": "none",
    },
  });
}
`;

writeFileSync("middleware.ts", middleware);
console.log(`Wrote middleware.ts (association body ${body.length} bytes)`);
