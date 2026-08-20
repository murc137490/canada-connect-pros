import { readFileSync, writeFileSync } from "node:fs";

const body = readFileSync(
  "public/.well-known/apple-developer-merchantid-domain-association",
  "utf8",
);

const middleware = `/**
 * Square Apple Pay domain verification.
 * Vercel static assets advertise Accept-Ranges and answer Range with 206;
 * Square's crawler then reports "partial response". Middleware always returns 200 + full body.
 *
 * After replacing the association file under public/.well-known/, run:
 *   node scripts/sync-apple-pay-middleware.mjs
 */
export const config = {
  matcher: "/.well-known/apple-developer-merchantid-domain-association",
};

const BODY = ${JSON.stringify(body)};

export default function middleware() {
  return new Response(BODY, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition":
        'attachment; filename="apple-developer-merchantid-domain-association"',
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "Accept-Ranges": "none",
    },
  });
}
`;

writeFileSync("middleware.ts", middleware);
console.log(`Wrote middleware.ts (association body ${body.length} bytes)`);
