// Node.js SQLite driver using better-sqlite3
// Thin wrapper around shared factory with Node-specific adapter

import { mkdtemp, rmdir, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { CreateSqliteDriver } from "@evolu/common";
import Database from "better-sqlite3";
import type { PlatformIO } from "./PlatformIO";
import { createSqliteDriver } from "./SqliteDriverFactory";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type NodeDatabase = any;

export const createPersistentSqliteDriver = (
  io: PlatformIO,
): CreateSqliteDriver => {
  let tempDbPath: string | undefined;

  const nodeAdapter = {
    loadDatabase: async (
      existingData: Uint8Array | null,
      memory?: boolean,
    ): Promise<NodeDatabase> => {
      if (existingData && !memory) {
        // Opening from a buffer is an anonymous DB; WAL needs a filesystem
        // path for -wal/-shm. Match BunSqliteDriver: temp file + open by path.
        const tempDir = await mkdtemp(join(tmpdir(), "txtatelier-"));
        tempDbPath = join(tempDir, "evolu.db");
        await writeFile(tempDbPath, existingData);
        return new Database(tempDbPath) as NodeDatabase;
      }
      return new Database(":memory:") as NodeDatabase;
    },
    cleanup: async () => {
      if (tempDbPath) {
        try {
          await unlink(tempDbPath);
          await rmdir(dirname(tempDbPath));
        } catch {
          // Ignore cleanup errors
        }
        tempDbPath = undefined;
      }
    },
    logPrefix: "[db:sqlite:node",
    errorType: "DbDeserializeFailed",
  };

  return createSqliteDriver(io, nodeAdapter);
};
