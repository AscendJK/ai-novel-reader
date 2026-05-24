import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "fs";

// Serves JSON directory listings for /models/ paths
// (Vite's SPA fallback otherwise intercepts directory requests)
function modelsDirListing() {
  return {
    name: "models-dir-listing",
    configureServer(server: any) {
      server.middlewares.use((req: any, res: any, next: any) => {
        const url = req.url?.split("?")[0];
        // Only intercept /models/ requests that look like directory paths
        if (url?.startsWith("/models/") && url.endsWith("/")) {
          const dir = path.join(server.config.root, "public", url);
          try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            const dirs = entries
              .filter((e: fs.Dirent) => e.isDirectory())
              .map((e: fs.Dirent) => e.name);
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(dirs));
          } catch {
            next();
          }
        } else {
          next();
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), modelsDirListing()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api": "http://localhost:3001",
    },
    hmr: {
      // Don't full-reload on reconnect after mobile sleep
      overlay: false,
    },
    watch: {
      // Less aggressive file watching
      usePolling: false,
    },
  },
});
