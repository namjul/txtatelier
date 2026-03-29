// Bun-compatible SQLite driver using bun:sqlite
// Thin wrapper around shared factory with Bun-specific adapter

import type { CreateSqliteDriver } from "@evolu/common";
import type { PlatformIO } from "./PlatformIO";
import { createSqliteDriver } from "./SqliteDriverFactory";

export const createBunSqliteDriver = (io: PlatformIO): CreateSqliteDriver => {
  let tempDbPath: string | undefined;

  const bunAdapter = {
    loadDatabase: async (existingData: Uint8Array | null, memory?: boolean) => {
      // Dynamically import bun:sqlite (only available in Bun runtime)
      const { Database } = await import("bun:sqlite");

      if (existingData && !memory) {
        // Write existing data to temp file, then open it
        // bun:sqlite doesn't support loading serialized data into :memory:
        const { mkdtemp, writeFile } = await import("node:fs/promises");
        const { tmpdir } = await import("node:os");
        const { join } = await import("node:path");

        const tempDir = await mkdtemp(join(tmpdir(), "txtatelier-"));
        tempDbPath = join(tempDir, "evolu.db");
        await writeFile(tempDbPath, existingData);
        return new Database(tempDbPath);
      }
      return new Database(":memory:");
    },
    cleanup: async () => {
      // Clean up temp file if we used one
      if (tempDbPath) {
        const { unlink, rmdir } = await import("node:fs/promises");
        const { dirname } = await import("node:path");
        try {
          await unlink(tempDbPath);
          await rmdir(dirname(tempDbPath));
        } catch {
          // Ignore cleanup errors
        }
      }
    },
    logPrefix: "[db:sqlite:bun",
    errorType: "DbDeserializeFailed",
  };

  return createSqliteDriver(io, bunAdapter);
};
