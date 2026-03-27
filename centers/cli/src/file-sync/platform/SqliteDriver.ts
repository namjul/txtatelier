import { type CreateSqliteDriver, trySync } from "@evolu/common";
import Database from "better-sqlite3";
import { logger } from "../../logger";
import type { DbDeserializeError } from "../errors";
import type { PlatformIO } from "./PlatformIO";

type SqliteValue = null | string | number | Uint8Array;

const SAVE_DEBOUNCE_MS = 5_000;

export const createPersistentSqliteDriver = (
  io: PlatformIO,
): CreateSqliteDriver => {
  return async (_name, options) => {
    logger.debug("[db:sqlite:init]", {
      memory: options?.memory ?? false,
    });
    // 1. Load existing database or start fresh
    const readResult = await io.readFile();
    if (!readResult.ok) {
      logger.error("[error] Failed to read database", readResult.error);
      throw new Error("Failed to read sqlite database", {
        cause: readResult.error,
      });
    }
    const existingData = readResult.value;

    // 2. Create in-memory database
    let db: Database.Database;
    if (existingData && !options?.memory) {
      // Deserialize existing data into in-memory database.
      // better-sqlite3 accepts a Buffer as the constructor argument.
      const deserializeResult = trySync(
        () => new Database(Buffer.from(existingData)),
        (cause): DbDeserializeError => ({
          type: "DbDeserializeFailed",
          cause,
        }),
      );

      if (!deserializeResult.ok) {
        logger.error(
          "[error] Failed to deserialize existing database",
          deserializeResult.error,
        );
        throw new Error("Failed to deserialize sqlite database", {
          cause: deserializeResult.error,
        });
      }

      db = deserializeResult.value;
    } else {
      // Fresh in-memory database
      db = new Database(":memory:");
    }

    // 3. Enable WAL mode for better performance
    db.exec("PRAGMA journal_mode = WAL;");

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
          logger.error("[error] Failed to save database", writeResult.error);
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
        // than letting db.prepare/exec throw "Database closed" on every operation
        if (isDisposed) return { rows: [], changes: 0 };

        if (isMutation) {
          const stmt = db.prepare<SqliteValue[]>(query.sql);
          const result = stmt.run(...query.parameters);
          const changes = result.changes;
          if (changes > 0) scheduleSave();
          return { rows: [], changes };
        }

        // Query (read operation)
        const stmt = db.prepare<SqliteValue[], Record<string, SqliteValue>>(
          query.sql,
        );
        const rows = stmt.all(...query.parameters);
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
        db.close();
      },
    };
  };
};
