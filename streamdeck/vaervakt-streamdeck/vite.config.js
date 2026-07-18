import { resolve } from "node:path";
import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

const pluginDirectory = resolve("no.vaervakt.streamdeck.sdPlugin");

export default defineConfig({
  base: "./",
  plugins: [svelte()],
  build: {
    outDir: pluginDirectory,
    emptyOutDir: false,
    rollupOptions: {
      input: {
        plugin: resolve("plugin.html"),
        vaervakt: resolve("vaervakt.html"),
      },
      output: {
        entryFileNames: "bin/[name].js",
        chunkFileNames: "bin/[name].js",
        assetFileNames: "bin/[name][extname]",
      },
    },
  },
});
