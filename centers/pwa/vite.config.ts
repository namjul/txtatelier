import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";

// biome-ignore lint/complexity/useLiteralKeys: process.env is typed via index signature; dot access triggers TS4111.
const basePath = process.env["BASE_PATH"] ?? "/";

export default defineConfig({
  base: basePath,
  plugins: [tailwindcss(), solidPlugin()],
  optimizeDeps: {
    exclude: ["@evolu/web"],
  },
});
