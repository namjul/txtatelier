import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";

const basePath = process.env["BASE_PATH"] ?? "/";

export default defineConfig({
  base: basePath,
  plugins: [tailwindcss(), solidPlugin()],
  optimizeDeps: {
    exclude: ["@evolu/web"],
  },
});
