import { readFileSync } from "node:fs";
import { createElement } from "react";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import DocumentHead from "@/components/DocumentHead";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { serviceCategories } from "@/data/services";
import { resolveRouteMeta } from "@/lib/routeMeta";

describe("resolveRouteMeta", () => {
  const paths = [
    "/",
    "/services",
    "/about",
    "/join-pros",
    "/join-pros/plans",
    "/support",
    "/make-request",
    "/terms",
    "/privacy",
    "/cookies",
  ] as const;

  it("sets a unique title and description per public route in English and French", () => {
    for (const path of paths) {
      const en = resolveRouteMeta(path, "en");
      const fr = resolveRouteMeta(path, "fr");
      expect(en.title.length).toBeGreaterThan(0);
      expect(fr.title.length).toBeGreaterThan(0);
      expect(en.description.length).toBeGreaterThan(40);
      expect(fr.description.length).toBeGreaterThan(40);
      expect(en.title).not.toBe(fr.title);
      expect(en.notFound).toBe(false);
      expect(en.canonicalPath.startsWith("/")).toBe(true);
    }
    const titles = paths.map((path) => resolveRouteMeta(path, "en").title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it("canonicalizes alias routes", () => {
    expect(resolveRouteMeta("/a-propos", "fr").canonicalPath).toBe("/about");
    expect(resolveRouteMeta("/privacy-policy", "en").canonicalPath).toBe("/privacy");
    expect(resolveRouteMeta("/cookie-policy", "en").canonicalPath).toBe("/cookies");
    expect(resolveRouteMeta("/get-app", "en").canonicalPath).toBe("/get-app/android");
  });

  it("titles real service categories and 404s unknown ones", () => {
    const slug = serviceCategories[0]?.slug;
    expect(slug).toBeTruthy();
    const meta = resolveRouteMeta(`/services/${slug}`, "en");
    expect(meta.notFound).toBe(false);
    expect(meta.title).toContain("AltShift");
    expect(resolveRouteMeta("/services/not-a-real-category", "en").notFound).toBe(true);
  });

  it("keeps a neutral title for a possible pro slug and 404s unknown nested paths", () => {
    const pro = resolveRouteMeta("/johnpork", "en");
    expect(pro.pendingProLookup).toBe(true);
    expect(pro.notFound).toBe(false);
    expect(resolveRouteMeta("/no/such/page", "fr").notFound).toBe(true);
  });

  it("writes the title and html lang when the route is rendered", () => {
    localStorage.setItem("altshift-locale", "en");
    render(
      createElement(
        MemoryRouter,
        { initialEntries: ["/support"] },
        createElement(LanguageProvider, null, createElement(DocumentHead)),
      ),
    );
    expect(document.title).toBe(resolveRouteMeta("/support", "en").title);
    expect(document.documentElement.lang).toBe("en");
    const canonical = document.head.querySelector('link[rel="canonical"]');
    expect(canonical?.getAttribute("href")).toBe("https://www.altshift.ca/support");
  });

  it("matches the French strings baked into index.html", () => {
    const html = readFileSync("index.html", "utf8");
    const home = resolveRouteMeta("/", "fr");
    expect(html).toContain(`<title>${home.title}</title>`);
    expect(html).toContain(home.description);
    expect(html).toContain('lang="fr"');
    expect(html).toContain("/og-image.png");
    expect(html).not.toContain("apple-pay-sdk.js");
  });
});
