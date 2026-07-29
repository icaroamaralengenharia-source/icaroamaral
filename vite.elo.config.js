import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  root: resolve(__dirname),
  appType: "mpa",
  server: {
    host: "127.0.0.1",
    port: 5606,
    strictPort: false
  }
});
