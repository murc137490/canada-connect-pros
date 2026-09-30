import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { serviceCategories } from "@/data/services";
import { unsplashSrcSet, unsplashUrl } from "@/data/categoryVisuals";

function sourceToRegExp(source: string): RegExp {
  const body = source.replace(/:([A-Za-z0-9_]+)/g, "[^/]+");
  return new RegExp(`^${body}$`);
}

function samplePath(routePath: string): string {
  return routePath.replace(/:([A-Za-z0-9_]+)/g, "sample");
}

describe("vercel hosting", () => {
  const vercel = JSON.parse(readFileSync("vercel.json", "utf8")) as {
    headers: { source: string; headers: { key: string; value: string }[] }[];
    rewrites: { source: string; destination: string }[];
  };
  const sources = vercel.rewrites.map((rule) => rule.source);

  it("covers every React route without a catch-all that hides unknown nested URLs", () => {
    const app = readFileSync("src/App.tsx", "utf8");
    const routes = [...app.matchAll(/<Route path="([^"]+)"/g)].map((match) => match[1]);
    expect(routes.length).toBeGreaterThan(20);

    for (const route of routes) {
      if (route === "*" || route === "/") continue;
      const sample = samplePath(route);
      const covered = sources.some((source) => sourceToRegExp(source).test(sample));
      expect(covered, `${route} (${sample})`).toBe(true);
    }

    expect(sources.some((source) => sourceToRegExp(source).test("/no/such/page"))).toBe(false);
    expect(sources.some((source) => sourceToRegExp(source).test("/not-a-real-page"))).toBe(false);
    expect(sources.some((source) => sourceToRegExp(source).test("/johnpork"))).toBe(true);
    expect(sources.some((source) => sourceToRegExp(source).test("/sw.js"))).toBe(false);
  });

  it("sets the security and cache headers without a wildcard CORS header", () => {
    const flat = vercel.headers.flatMap((rule) => rule.headers);
    const csp = flat.find((header) => header.key === "Content-Security-Policy")?.value ?? "";
    expect(csp).toContain("frame-ancestors 'self'");
    expect(csp).toContain("https://*.supabase.co");
    expect(csp).toContain("https://*.squarecdn.com");
    expect(csp).toContain("https://fonts.googleapis.com");
    expect(csp).toContain("https://applepay.cdn-apple.com");
    expect(flat.some((header) => header.key === "X-Content-Type-Options" && header.value === "nosniff")).toBe(true);
    expect(
      flat.some((header) => header.key === "Referrer-Policy" && header.value === "strict-origin-when-cross-origin"),
    ).toBe(true);
    expect(flat.some((header) => header.key === "X-Frame-Options")).toBe(true);
    expect(flat.some((header) => header.key === "Permissions-Policy" && header.value.includes("payment=(self)"))).toBe(
      true,
    );
    expect(flat.some((header) => header.key === "Permissions-Policy" && header.value.includes("geolocation=(self)"))).toBe(
      true,
    );
    expect(flat.some((header) => header.value.includes("max-age=31536000, immutable"))).toBe(true);
    expect(flat.some((header) => header.key === "Cache-Control" && header.value.includes("max-age=0"))).toBe(true);
    expect(JSON.stringify(vercel)).not.toContain("Access-Control-Allow-Origin");
  });
});

describe("public sitemap", () => {
  const xml = readFileSync("public/sitemap.xml", "utf8");

  it("lists marketing routes and every service category", () => {
    for (const path of ["/about", "/join-pros/plans", "/get-app", "/get-app/android", "/get-app/ios", "/support"]) {
      expect(xml).toContain(`https://www.altshift.ca${path}`);
    }
    expect(serviceCategories.length).toBeGreaterThan(5);
    for (const category of serviceCategories) {
      expect(xml).toContain(`https://www.altshift.ca/services/${category.slug}`);
    }
  });
});

describe("unsplash image urls", () => {
  it("requests smaller crops than the previous 2400w q=90 default", () => {
    const url = unsplashUrl("photo-example");
    expect(url).not.toContain("w=2400");
    expect(url).not.toContain("q=90");
    expect(url).toContain("q=70");
    expect(unsplashSrcSet("photo-example")).not.toContain("2400w");
    expect(unsplashSrcSet("photo-example")).toContain("1600w");
  });
});
