// Platform-independent file I/O abstraction for SQLite database persistence.
// Follows the pattern from the Obsidian reference implementation.

import { randomUUID } from "node:crypto";
import { access, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { err, ok, type Result, tryAsync } from "@evolu/common";
import type { ReadDbError, WriteDbError } from "../errors";

export type PlatformIO = {
  readonly readFile: () => Promise<Result<Uint8Array | null, ReadDbError>>;
  readonly writeFile: (data: Uint8Array) => Promise<Result<void, WriteDbError>>;
};

export const createPlatformIO = (dbPath: string): PlatformIO => {
  return {
    readFile: async (): Promise<Result<Uint8Array | null, ReadDbError>> => {
      const existsResult = await tryAsync(
        async () => {
          await access(dbPath);
          return true;
        },
        (cause): ReadDbError => ({
          type: "DbReadFailed",
          dbPath,
          cause,
        }),
      );

      if (!existsResult.ok) {
        // ENOENT means file doesn't exist — not an error, return null
        const cause = existsResult.error.cause as NodeJS.ErrnoException;
        if (cause?.code === "ENOENT") {
          return ok(null);
        }
        return err(existsResult.error);
      }

      const contentResult = await tryAsync(
        async () => new Uint8Array(await readFile(dbPath)),
        (cause): ReadDbError => ({
          type: "DbReadFailed",
          dbPath,
          cause,
        }),
      );

      return contentResult.ok
        ? ok(contentResult.value)
        : err(contentResult.error);
    },

    writeFile: async (
      data: Uint8Array,
    ): Promise<Result<void, WriteDbError>> => {
      // Atomic write: write to temp file, then rename
      // This prevents corruption if process is killed mid-write
      // Use a unique temp path per write to avoid rename races when multiple
      // writes overlap (e.g., debounce save + flush/dispose).
      const tempPath = `${dbPath}.tmp-${Date.now()}-${randomUUID()}`;
      const writeResult = await tryAsync(
        async () => {
          await mkdir(dirname(dbPath), { recursive: true });
          await writeFile(tempPath, data);

          // Atomic rename (POSIX guarantees atomicity)
          await rename(tempPath, dbPath);
        },
        (cause): WriteDbError => ({
          type: "DbWriteFailed",
          dbPath,
          cause,
        }),
      );

      return writeResult.ok ? ok() : err(writeResult.error);
    },
  };
};
