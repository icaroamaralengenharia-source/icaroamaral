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
  }
});
