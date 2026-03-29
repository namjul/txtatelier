// Shared SQLite driver factory for runtime-agnostic implementation
// Uses adapter pattern to handle runtime-specific database instantiation

import { type CreateSqliteDriver, tryAsync } from "@evolu/common";
import { logger } from "../../logger";
import type { DbDeserializeError } from "../errors";
import type { PlatformIO } from "./PlatformIO";

const SAVE_DEBOUNCE_MS = 5_000;

// biome-ignore lint/suspicious/noExplicitAny: Runtime-agnostic database interface (duck typing over runtime-specific implementations)
type SqliteDatabase = any;

// Adapter interface for runtime-specific implementations
export interface SqliteAdapter {
  readonly loadDatabase: (
    existingData: Uint8Array | null,
    memory?: boolean,
  ) => SqliteDatabase | Promise<SqliteDatabase>;
  readonly cleanup?: () => Promise<void>;
  readonly logPrefix: string;
  readonly errorType: string;
}

export const createSqliteDriver =
  (io: PlatformIO, adapter: SqliteAdapter): CreateSqliteDriver =>
  async (_name, options) => {
    logger.debug(`${adapter.logPrefix}:init]`, {
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

    // 2. Create database using runtime-specific adapter
    let db: SqliteDatabase;
    if (existingData && !options?.memory) {
      const deserializeResult = await tryAsync(
        async () => adapter.loadDatabase(existingData, false),
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
      db = await adapter.loadDatabase(null, true);
    }

    // 3. Enable WAL mode for better performance
    db.exec("PRAGMA journal_mode = WAL;");

    // 4. Setup debounced persistence state
    let isDisposed = false;
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
      if (saveTimer) return;
      saveTimer = setTimeout(() => {
        saveTimer = null;
        saveToDisk();
      }, SAVE_DEBOUNCE_MS);
    };

    const flushToDisk = async (): Promise<void> => {
      if (isDisposed) return;
      if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
      }
      isFlushed = true;
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
      flush: flushToDisk,

      exec: (query, isMutation) => {
        if (isDisposed) return { rows: [], changes: 0 };

        if (isMutation) {
          const stmt = db.prepare(query.sql);
          const result = stmt.run(...query.parameters);
          const changes = result.changes;
          if (changes > 0) scheduleSave();
          return { rows: [], changes };
        }

        const stmt = db.prepare(query.sql);
        const rows = stmt.all(...query.parameters);
        return { rows, changes: 0 };
      },

      export: () => db.serialize(),

      [Symbol.dispose]: async () => {
        if (isDisposed) return;
        isDisposed = true;
        if (saveTimer) {
          clearTimeout(saveTimer);
          saveTimer = null;
        }
        if (!isFlushed) {
          const data = db.serialize();
          const writeResult = await io.writeFile(data);
          if (!writeResult.ok) {
            logger.error(
              "[txtatelier] ERROR: Failed to save database",
              writeResult.error,
            );
          }
        }
        db.close();

        // Runtime-specific cleanup (e.g., temp files for Bun)
        if (adapter.cleanup) {
          await adapter.cleanup();
        }
      },
    };
  };
