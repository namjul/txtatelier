import { defineConfig } from "vitest/config";

/**
 * Unit tests only (pure TS). If you add `@zag-js/solid` / `solid-js/web` tests again,
 * use `environment: "happy-dom"` (or `jsdom`) plus client `solid-js` resolution — see git history.
 */
export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["src/**/*.test.ts"],
  },
});
