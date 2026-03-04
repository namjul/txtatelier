// Evolu SQLite driver using Bun's native SQLite with debounced persistence.
// Based on the Obsidian reference implementation pattern.

import { Database } from "bun:sqlite";
import type { CreateSqliteDriver } from "@evolu/common";
import { logger } from "../../logger";
import type { PlatformIO } from "./PlatformIO";

const SAVE_DEBOUNCE_MS = 5_000;

export const createPersistentBunSqliteDriver = (
  io: PlatformIO,
): CreateSqliteDriver => {
  return async (_name, options) => {
    logger.log("[sqlite-driver] init", {
      memory: options?.memory ?? false,
    });
    // 1. Load existing database or start fresh
    const readResult = await io.readFile();
    if (!readResult.ok) {
      logger.error("[sqlite-driver] Failed to read database", readResult.error);
      throw new Error("Failed to read sqlite database", {
        cause: readResult.error,
      });
    }
    const existingData = readResult.value;

    // 2. Create in-memory database
    let db: Database;
    if (existingData && !options?.memory) {
      // Deserialize existing data into in-memory database
      db = Database.deserialize(existingData);
    } else {
      // Fresh in-memory database
      db = new Database(":memory:", {
        strict: true,
        // safeIntegers disabled - Evolu expects Number not BigInt for getSize()
        safeIntegers: false,
      });
    }

    // 3. Enable WAL mode for better performance
    db.run("PRAGMA journal_mode = WAL;");

    // 4. Setup debounced persistence state
    let isDisposed = false;
    // Set to true after flush() — prevents stale post-reload disk writes from
    // an old driver instance overwriting the new instance's saved state.
    let isFlushed = false;
    let saveTimer: ReturnType<typeof setTimeout> | null = null;

    const saveToDisk = (): void => {
      if (isDisposed || isFlushed) return;
      const data = db.serialize();
      void (async () => {
        const writeResult = await io.writeFile(data);
        if (!writeResult.ok) {
          logger.error(
            "[txtatelier] ERROR: Failed to save database",
            writeResult.error,
          );
        }
      })();
    };

    const scheduleSave = () => {
      if (isFlushed || isDisposed) return;
      if (saveTimer) return; // Already scheduled
      saveTimer = setTimeout(() => {
        saveTimer = null;
        saveToDisk();
      }, SAVE_DEBOUNCE_MS);
    };

    /**
     * Cancels any pending debounce timer and immediately awaits a write of the
     * current in-memory database, **without** closing the SQLite instance.
     *
     * Call this on process shutdown. After returning, the driver enters a "sealed"
     * state: in-memory queries and mutations still succeed (so Evolu's async
     * callbacks don't throw), but no further disk writes are scheduled. This
     * prevents a stale old-process-instance from overwriting the new instance's
     * data on disk.
     */
    const flushToDisk = async (): Promise<void> => {
      if (isDisposed) return;
      if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
      }
      isFlushed = true; // Seal before IO — prevents new saves from arming
      const data = db.serialize();
      const writeResult = await io.writeFile(data);
      if (!writeResult.ok) {
        logger.error(
          "[txtatelier] ERROR: Failed to save database",
          writeResult.error,
        );
      }
    };

    return {
      // Extension to Evolu's CreateSqliteDriver interface for graceful shutdown
      flush: flushToDisk,

      exec: (query, isMutation) => {
        // After dispose the SQLite DB is closed; return empty results rather
        // than letting db.run/exec throw "Database closed" on every operation
        if (isDisposed) return { rows: [], changes: 0 };

        if (isMutation) {
          const stmt = db.query(query.sql);
          // biome-ignore lint/suspicious/noExplicitAny: Evolu's query parameters are loosely typed
          const result = stmt.run(...(query.parameters as any[]));
          const changes = result.changes;
          if (changes > 0) scheduleSave();
          return { rows: [], changes };
        }

        // Query (read operation)
        const stmt = db.query(query.sql);
        // biome-ignore lint/suspicious/noExplicitAny: Evolu's query parameters and rows are loosely typed
        const rows = stmt.all(...(query.parameters as any[])) as readonly any[];
        return { rows, changes: 0 };
      },

      export: () => db.serialize(),

      [Symbol.dispose]: () => {
        if (isDisposed) return;
        isDisposed = true;
        if (saveTimer) {
          clearTimeout(saveTimer);
          saveTimer = null;
        }
        if (!isFlushed) {
          // Export before closing DB, then write asynchronously
          const data = db.serialize();
          void (async () => {
            const writeResult = await io.writeFile(data);
            if (!writeResult.ok) {
              logger.error(
                "[txtatelier] ERROR: Failed to save database",
                writeResult.error,
              );
            }
          })();
        }
        db.close(false);
      },
    };
  };
};
