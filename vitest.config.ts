import { defineConfig } from "vitest/config";

/**
 * Monorepo test entry: `bun run test` from repo root runs all centers.
 * Single center: `cd centers/<name> && bun run test`, or
 * `bun run test --project @txtatelier/<name>` (pwa, sync-invariants, cli).
 */
export default defineConfig({
  test: {
    projects: ["centers/pwa", "centers/sync-invariants", "centers/cli"],
  },
});
