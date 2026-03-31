import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import solidPlugin from "vite-plugin-solid";

// biome-ignore lint/complexity/useLiteralKeys: process.env is typed via index signature; dot access triggers TS4111.
const basePath = process.env["VITE_TXTATELIER_BASE_PATH"] ?? "/";

const shareTargetActionPath = (): string => {
  const normalized = basePath === "/" ? "" : basePath.replace(/\/?$/, "");
  return new URL("/share-target", `https://placeholder.invalid${normalized}`)
    .pathname;
};

export default defineConfig({
  base: basePath,
  worker: {
    format: "es",
  },
  plugins: [
    tailwindcss(),
    solidPlugin(),
    VitePWA({
      // autoUpdate + registerSW: bare register() never activates waiting SW ("prompt" needs onNeedRefresh UI).
      registerType: "autoUpdate",
      injectRegister: null,
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      manifest: {
        name: "TXTAtelier",
        short_name: "TXTAtelier",
        description:
          "Local-first file sync with Evolu — edit notes in the browser with offline-capable PWA support.",
        theme_color: "#0f172a",
        background_color: "#0f172a",
        display: "standalone",
        start_url: basePath,
        scope: basePath,
        icons: [
          {
            src: "pwa-source.svg",
            sizes: "512x512",
            type: "image/svg+xml",
            purpose: "any",
          },
        ],
        share_target: {
          action: shareTargetActionPath(),
          method: "POST",
          enctype: "multipart/form-data",
          params: {
            title: "title",
            text: "text",
            url: "url",
          },
        },
      },
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,wasm,webmanifest}"],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  optimizeDeps: {
    exclude: ["@evolu/web"],
  },
});
