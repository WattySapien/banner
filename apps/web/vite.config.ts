import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      ...(mode === "production" ? { loglevel: path.resolve(import.meta.dirname, "src/lib/silent-logger.ts") } : {}),
    },
  },
  base: "/",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    minify: mode === "production" ? "terser" : "esbuild",
    terserOptions: mode === "production" ? { compress: { drop_console: true, drop_debugger: true } } : undefined,
    rollupOptions: {
      input: {
        main: path.resolve(import.meta.dirname, "index.html"),
      },
      output: {
        manualChunks(id) {
          if (id.includes("/node_modules/gsap/") || id.includes("/node_modules/@gsap/")) return "motion-vendor";
          if (id.includes("/node_modules/framer-motion/")) return "motion-vendor";
          if (id.includes("/node_modules/recharts/")) return "charts-vendor";
          if (id.includes("/node_modules/@radix-ui/")) return "ui-vendor";
        },
      },
    },
  },
  server: {
    port: 3000,
    strictPort: true,
    host: true,
    open: false,
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
    proxy: {
      '/api': {
        target: "http://127.0.0.1:5000",
        changeOrigin: true,
        secure: false,
      },
    },
  },
}));
