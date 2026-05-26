import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    chunkSizeWarningLimit: 1000, // Transformers.js ~800KB is expected
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
