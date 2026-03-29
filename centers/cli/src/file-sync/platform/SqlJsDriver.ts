// Single SQLite driver for Node and Bun via sql.js (ASM.js build — no WASM binary load).

import {
  type CreateSqliteDriver,
  type SqliteExecResult,
  type SqliteQuery,
  type SqliteRow,
  type SqliteValue,
  tryAsync,
} from "@evolu/common";
import type { Database } from "sql.js";
import { logger } from "../../logger";
import type { DbDeserializeError } from "../errors";
import type { PlatformIO } from "./PlatformIO";

const SAVE_DEBOUNCE_MS = 5_000;
const LOG_PREFIX = "[db:sqlite:sqljs]";

type SqlJsApi = {
  readonly Database: new (data?: ArrayLike<number> | null) => Database;
};

let sqlJsStaticPromise: Promise<SqlJsApi> | null = null;

const getSqlJs = async (): Promise<SqlJsApi> => {
  if (!sqlJsStaticPromise) {
    sqlJsStaticPromise = import("sql.js/dist/sql-asm.js").then((mod) => {
      const init = mod.default as (
        config?: Record<string, unknown>,
      ) => Promise<SqlJsApi>;
      return init();
    });
  }
  return sqlJsStaticPromise;
};

const bindParams = (query: SqliteQuery): SqliteValue[] => [...query.parameters];

const rowFromSqlJsObject = (obj: Record<string, SqlValue>): SqliteRow => {
  const row: SqliteRow = {};
  for (const key of Object.keys(obj)) {
    const v = obj[key];
    row[key] = v as SqliteValue;
  }
  return row;
};

type SqlValue = number | string | Uint8Array | null;

const execSelect = (
  db: Database,
  query: SqliteQuery,
): ReadonlyArray<SqliteRow> => {
  const stmt = db.prepare(query.sql);
  try {
    stmt.bind(bindParams(query));
    const rows: SqliteRow[] = [];
    while (stmt.step()) {
      rows.push(
        rowFromSqlJsObject(stmt.getAsObject() as Record<string, SqlValue>),
      );
    }
    return rows;
  } finally {
    stmt.free();
  }
};

const execMutation = (db: Database, query: SqliteQuery): number => {
  db.run(query.sql, bindParams(query));
  return db.getRowsModified();
};

export const createSqlJsDriver =
  (io: PlatformIO): CreateSqliteDriver =>
  async (_name, options) => {
    logger.debug(`${LOG_PREFIX}:init]`, {
      memory: options?.memory ?? false,
    });

    const readResult = await io.readFile();
    if (!readResult.ok) {
      logger.error(`${LOG_PREFIX} Failed to read database`, readResult.error);
      throw new Error("Failed to read sqlite database", {
        cause: readResult.error,
      });
    }

    const existingData = readResult.value;
    const SQL = await getSqlJs();

    let db: Database;
    if (existingData && !options?.memory) {
      const deserializeResult = await tryAsync(
        async () => new SQL.Database(existingData),
        (cause): DbDeserializeError => ({
          type: "DbDeserializeFailed",
          cause,
        }),
      );

      if (!deserializeResult.ok) {
        logger.error(
          `${LOG_PREFIX} Failed to deserialize existing database`,
          deserializeResult.error,
        );
        throw new Error("Failed to deserialize sqlite database", {
          cause: deserializeResult.error,
        });
      }

      db = deserializeResult.value;
    } else {
      db = new SQL.Database();
    }

    let isDisposed = false;
    let isFlushed = false;
    let saveTimer: ReturnType<typeof setTimeout> | null = null;

    const saveToDisk = (): void => {
      if (isDisposed || isFlushed) return;
      const data = db.export();
      void io.writeFile(data).then((writeResult) => {
        if (!writeResult.ok) {
          logger.error(
            `${LOG_PREFIX} Failed to save database`,
            writeResult.error,
          );
        }
      });
    };

    const scheduleSave = (): void => {
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
      const data = db.export();
      const writeResult = await io.writeFile(data);
      if (!writeResult.ok) {
        logger.error(
          `${LOG_PREFIX} Failed to save database`,
          writeResult.error,
        );
      }
    };

    return {
      flush: flushToDisk,

      exec: (query: SqliteQuery, isMutation: boolean): SqliteExecResult => {
        if (isDisposed) return { rows: [], changes: 0 };

        if (isMutation) {
          const changes = execMutation(db, query);
          if (changes > 0) scheduleSave();
          return { rows: [], changes };
        }

        const rows = execSelect(db, query);
        return { rows, changes: 0 };
      },

      export: () => db.export(),

      [Symbol.dispose]: async () => {
        if (isDisposed) return;
        isDisposed = true;
        if (saveTimer) {
          clearTimeout(saveTimer);
          saveTimer = null;
        }
        if (!isFlushed) {
          const data = db.export();
          const writeResult = await io.writeFile(data);
          if (!writeResult.ok) {
            logger.error(
              `${LOG_PREFIX} Failed to save database`,
              writeResult.error,
            );
          }
        }
        db.close();
      },
    };
  };
