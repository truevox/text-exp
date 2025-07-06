import { defineConfig, Plugin } from "vite";
import { resolve } from "path";
import { viteStaticCopy } from "vite-plugin-static-copy";
import fg from "fast-glob";
import fs from "fs";
import { chromeExtensionHotReload } from "./vite-plugins/chrome-extension-hot-reload";

// Custom plugin to handle Chrome extension manifest and HTML files
function chromeExtensionPlugin(): Plugin {
  return {
    name: "chrome-extension",
    generateBundle() {
      // Copy and process manifest.json
      const manifestPath = resolve(__dirname, "manifest.json");
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));

      // Update paths in manifest for built files
      manifest.background.service_worker = "background/service-worker.js";
      manifest.content_scripts[0].js = ["content/content-script.js"];
      manifest.action.default_popup = "popup/popup.html";
      manifest.options_page = "options/options.html";

      // Background service worker can be a module
      manifest.background.type = "module";

      this.emitFile({
        type: "asset",
        fileName: "manifest.json",
        source: JSON.stringify(manifest, null, 2),
      });
    },
    buildStart() {
      // Process HTML files for popup and options
      const htmlFiles = fg.sync(["src/**/*.html"]);
      htmlFiles.forEach((file) => {
        const content = fs.readFileSync(file, "utf-8");
        const fileName = file.replace("src/", "");
        this.emitFile({
          type: "asset",
          fileName: fileName,
          source: content,
        });
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const isDev = mode === "development";

  return {
    root: __dirname,
    build: {
      outDir: "build",
      emptyOutDir: true,
      sourcemap: isDev,
      minify: isDev ? false : "terser",
      rollupOptions: {
        input: {
          // Background service worker as ES module
          "background/service-worker": resolve(
            __dirname,
            "src/background/service-worker.ts",
          ),
          // Content script built separately with vite.content.config.ts
          // UI components as ES modules
          "popup/popup": resolve(__dirname, "src/popup/popup.ts"),
          "options/options": resolve(__dirname, "src/options/options.ts"),
        },
        output: {
          entryFileNames: "[name].js",
          chunkFileNames: "[name]-[hash].js",
          assetFileNames: "[name].[ext]",
          format: "esm", // Use ESM for most files, convert content script after
        },
        external: ["chrome"],
      },
      target: "es2022",
      cssCodeSplit: false,
    },
    resolve: {
      alias: {
        "@": resolve(__dirname, "src"),
        "@/shared": resolve(__dirname, "src/shared"),
        "@/background": resolve(__dirname, "src/background"),
        "@/content": resolve(__dirname, "src/content"),
        "@/popup": resolve(__dirname, "src/popup"),
        "@/options": resolve(__dirname, "src/options"),
        "@/utils": resolve(__dirname, "src/utils"),
      },
    },
    plugins: [
      chromeExtensionPlugin(),
      viteStaticCopy({
        targets: [
          {
            src: "src/popup/popup.css",
            dest: "popup",
          },
          {
            src: "src/options/options.css",
            dest: "options",
          },
          {
            src: "src/assets/icons/*",
            dest: "icons",
          },
          {
            src: "scripts/setup-test-data.js",
            dest: "scripts",
          },
        ],
      }),
      ...(isDev ? [chromeExtensionHotReload()] : []),
    ],
    server: {
      port: 3000,
      host: "localhost",
    },
    define: {
      "process.env.NODE_ENV": JSON.stringify(mode),
      "process.env.EXTENSION_VERSION": JSON.stringify(
        process.env.npm_package_version || "0.2.0",
      ),
    },
  };
});
