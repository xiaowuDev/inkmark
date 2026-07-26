import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteStaticCopy } from "vite-plugin-static-copy";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        {
          src: "node_modules/vditor/dist/js/{highlight.js,i18n,katex,lute,mermaid}/**/*",
          dest: "vditor/dist/js",
          rename: { stripBase: 4 },
        },
        {
          src: "node_modules/vditor/dist/css/**/*",
          dest: "vditor/dist/css",
          rename: { stripBase: 4 },
        },
        {
          src: "node_modules/vditor/dist/images/**/*",
          dest: "vditor/dist/images",
          rename: { stripBase: 4 },
        },
      ],
    }),
  ],

  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host ?? false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  build: {
    target: "es2022",
    cssCodeSplit: true,
    assetsInlineLimit: 2048,
    sourcemap: false,
    reportCompressedSize: true,
  },
});
