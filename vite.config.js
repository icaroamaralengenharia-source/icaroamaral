import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";

const CONTENT_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".webp": "image/webp"
};

function contentTypeFor(pathname) {
  const match = String(pathname || "").match(/\.[^.]+$/);
  return CONTENT_TYPES[match ? match[0].toLowerCase() : ""] || "application/octet-stream";
}

function existingFile(path) {
  if (!existsSync(path) || !statSync(path).isFile()) return null;
  return path;
}

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
    name: "serve-root-level-surfaces",
    configureServer(server) {
      server.middlewares.use(function serveRootLevelSurface(req, res, next) {
        const pathname = String(req.url || "").split("?")[0];
        let file = null;
        if (pathname === "/elo.html" || pathname === "/elo.css") {
          file = existingFile(resolve(__dirname, pathname.slice(1)));
        } else if (pathname.startsWith("/assets/")) {
          file = existingFile(resolve(__dirname, pathname.slice(1)));
        } else if (pathname.startsWith("/relatorio-qualidade-obras/")) {
          file = existingFile(resolve(__dirname, pathname.slice(1)));
        }
        if (!file) return next();
        res.statusCode = 200;
        res.setHeader("Content-Type", contentTypeFor(pathname));
        res.end(readFileSync(file));
      });
    }
  }]
});
