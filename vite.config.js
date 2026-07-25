import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  root: "relatorio-qualidade-obras",
  build: {
    outDir: "../dist/relatorio-qualidade-obras",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        relatorio: resolve(__dirname, "relatorio-qualidade-obras/relatorio-qualidade-obras.html")
      }
    }
  },
  server: {
    host: "127.0.0.1",
    port: 5500,
    strictPort: false
  },
  plugins: [{
    name: "serve-root-access-gate-assets",
    configureServer(server) {
      const gateAssets = {
        "/assets/site-access-gate.js": {
          file: resolve(__dirname, "assets/site-access-gate.js"),
          type: "text/javascript; charset=utf-8"
        },
        "/assets/site-access-gate.css": {
          file: resolve(__dirname, "assets/site-access-gate.css"),
          type: "text/css; charset=utf-8"
        }
      };
      server.middlewares.use(function serveAccessGateAsset(req, res, next) {
        const pathname = String(req.url || "").split("?")[0];
        const asset = gateAssets[pathname];
        if (!asset) return next();
        res.statusCode = 200;
        res.setHeader("Content-Type", asset.type);
        res.end(readFileSync(asset.file));
      });
    }
  }]
});
