import { defineConfig } from "vite";
import { resolve } from "path";

/**
 * Dedicated Vite configuration for content script
 * Builds as IIFE to be compatible with Chrome content script requirements
 */
export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/content/content-script.ts"),
      name: "PuffPuffPasteContentScript",
      formats: ["iife"],
      fileName: () => "content-script.js", // Explicit .js extension
    },
    outDir: "build/content",
    emptyOutDir: false,
    rollupOptions: {
      external: ["chrome"],
      output: {
        globals: {
          chrome: "chrome",
        },
      },
    },
    minify: false, // Keep readable for debugging
    target: "es2022",
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
      "@/shared": resolve(__dirname, "src/shared"),
      "@/content": resolve(__dirname, "src/content"),
      "@/utils": resolve(__dirname, "src/utils"),
    },
  },
});
