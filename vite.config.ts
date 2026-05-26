import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /\/models\/.*\.onnx$/,
            handler: "CacheFirst",
            options: {
              cacheName: "model-cache",
              expiration: { maxEntries: 10, maxAgeSeconds: 365 * 24 * 3600 },
            },
          },
          {
            urlPattern: /\/api\/(?!sync\/)/,
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              networkTimeoutSeconds: 3,
            },
          },
        ],
        cleanupOutdatedCaches: true,
      },
      manifest: {
        name: "AI 小说精读助手",
        short_name: "小说精读",
        theme_color: "#0a0a0a",
        background_color: "#0a0a0a",
        display: "standalone",
        icons: [{ src: "/favicon.svg", sizes: "any", type: "image/svg+xml" }],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    chunkSizeWarningLimit: 1000,
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api": "http://localhost:3001",
      "/admin": "http://localhost:3001",
    },
    hmr: {
      overlay: false,
    },
    watch: {
      usePolling: false,
    },
  },
});
