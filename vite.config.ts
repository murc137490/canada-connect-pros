import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

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
        "favicon-32.png",
        "favicon-64.png",
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
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
