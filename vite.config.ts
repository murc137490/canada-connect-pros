import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import { VitePWA } from "vite-plugin-pwa";
import fs from "fs";
import path from "path";

/** Unknown URLs that are not rewritten still boot the SPA, with HTTP 404. */
function spa404Plugin(): Plugin {
  return {
    name: "altshift-spa-404",
    apply: "build",
    closeBundle() {
      const dist = path.resolve(__dirname, "dist");
      const indexPath = path.join(dist, "index.html");
      if (!fs.existsSync(indexPath)) return;
      fs.copyFileSync(indexPath, path.join(dist, "404.html"));
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      // Static /manifest-*.webmanifest files — blob manifests break Android icons.
      manifest: false,
      includeAssets: [
        "favicon.ico",
        "favicon-*.ico",
        "favicon-*.png",
        "favicon-32.png",
        "favicon-64.png",
        "brand-logo-*.png",
        "apple-touch-icon.png",
        "manifest.webmanifest",
        "manifest-*.webmanifest",
        "pwa-*.png",
        "pwa-client-*.png",
        "pwa-starter-*.png",
        "pwa-growth-*.png",
        "pwa-pro-*.png",
      ],
      workbox: {
        // Main App chunk exceeds Workbox default 2 MiB precache limit.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api/, /^\/functions/, /^\/\.well-known/],
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webmanifest,woff2}"],
        runtimeCaching: [
          {
            // Always revalidate manifests + PWA/brand icons so Android gets the current tier.
            urlPattern: ({ url }) =>
              url.pathname.endsWith(".webmanifest") ||
              url.pathname.includes("/pwa-") ||
              url.pathname.includes("/brand-logo-") ||
              url.pathname.includes("/favicon"),
            handler: "NetworkFirst",
            options: {
              cacheName: "altshift-brand-icons",
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ url }) =>
              url.hostname.endsWith("supabase.co") ||
              url.hostname.includes("squareup.com") ||
              url.hostname.includes("squareupsandbox.com"),
            handler: "NetworkOnly",
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-stylesheets",
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-webfonts",
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
    spa404Plugin(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
