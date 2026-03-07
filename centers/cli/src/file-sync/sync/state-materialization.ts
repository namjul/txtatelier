import { unlink } from "node:fs/promises";
import { join } from "node:path";
import {
  createIdFromString,
  type Evolu,
  err,
  type IdBytes,
  idBytesToId,
  ok,
  type Result,
  sqliteTrue,
  tryAsync,
  trySync,
} from "@evolu/common";
import type { TimestampBytes } from "@evolu/common/local-first";
import { logger } from "../../logger";
import { createConflictFile, detectConflict } from "../conflicts";
import type { StateMaterializationError } from "../errors";
import { computeFileHash } from "../hash";
import { isIgnoredRelativePath } from "../ignore";
import type { Schema } from "../schema";
import {
  clearLastAppliedHash,
  getLastAppliedHash,
  getTrackedSyncState,
  setLastAppliedHash,
} from "../state";
import { writeFileAtomic } from "../write";

type EvoluDatabase = Evolu<typeof Schema>;

export interface StateMaterializationOptions {
  readonly onConflictArtifactCreated?: (absolutePath: string) => Promise<void>;
}

// ========== History Cursor Management ==========

const ensureHistoryCursor = (evolu: EvoluDatabase): void => {
  const cursorId = createIdFromString<"HistoryCursor">("history-cursor");
  evolu.upsert("_historyCursor", { id: cursorId });
};

const loadHistoryCursor = async (
  evolu: EvoluDatabase,
): Promise<TimestampBytes | null> => {
  const cursorId = createIdFromString<"HistoryCursor">("history-cursor");

  const q = evolu.createQuery((db) =>
    db
      .selectFrom("_historyCursor")
      .select(["lastTimestamp"])
      .where("id", "=", cursorId)
      .where("isDeleted", "is", null)
      .limit(1),
  );

  const rows = await evolu.loadQuery(q);
  return rows[0]?.lastTimestamp ?? null;
};

const saveHistoryCursor = (evolu: EvoluDatabase, ts: TimestampBytes): void => {
  const cursorId = createIdFromString<"HistoryCursor">("history-cursor");
  evolu.upsert("_historyCursor", { id: cursorId, lastTimestamp: ts });
};

// ========== State Materialization ==========

export const startStateMaterialization = (
  evolu: EvoluDatabase,
  watchDir: string,
  options?: StateMaterializationOptions,
): (() => void) => {
  logger.log("[materialize] Starting...");

  const allFilesQuery = evolu.createQuery((db) =>
    db
      .selectFrom("file")
      .selectAll()
      // biome-ignore lint/suspicious/noExplicitAny: Evolu's Kysely needs runtime values
      .where("isDeleted", "is not", sqliteTrue as any),
  );

  let initialLoadComplete = false;

  // Ensure cursor exists before starting
  ensureHistoryCursor(evolu);

  evolu.loadQuery(allFilesQuery).then(async (rows) => {
    logger.log(`[materialize] Initial load: ${rows.length} existing files`);
    await syncEvoluToFiles(evolu, watchDir, rows, options);

    // Set cursor to current timestamp to avoid replaying old history
    // Query latest timestamp from evolu_history
    const latestHistoryQuery = evolu.createQuery((db) =>
      // biome-ignore lint/suspicious/noExplicitAny: Evolu's internal table needs runtime values
      (db as any)
        .selectFrom("evolu_history")
        .select(["timestamp"])
        // biome-ignore lint/suspicious/noExplicitAny: Evolu's internal table needs runtime values
        .where("table", "==", "file" as any)
        // biome-ignore lint/suspicious/noExplicitAny: Evolu's internal table needs runtime values
        .orderBy("timestamp", "desc" as any)
        .limit(1),
    );

    const latestHistory = await evolu.loadQuery(latestHistoryQuery);
    if (latestHistory.length > 0) {
      const firstRow = latestHistory[0];

      // biome-ignore lint/complexity/useLiteralKeys: typed via index signature; dot access triggers TS4111.
      if (firstRow?.["timestamp"]) {
        const latestTimestamp = firstRow[
        // biome-ignore lint/complexity/useLiteralKeys: typed via index signature; dot access triggers TS4111.
          "timestamp"
        ] as unknown as TimestampBytes;
        saveHistoryCursor(evolu, latestTimestamp);
        logger.log(
          "[materialize] Cursor initialized to latest history timestamp",
        );
      }
    }

    initialLoadComplete = true;
  });

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  const SUBSCRIPTION_DEBOUNCE_MS = 500;
  let subscriptionFireCount = 0;

  // Note: This subscription fires for ALL Evolu mutations including our own
  // local edits (echo/self-processing). This is accepted redundancy:
  // - Hash checks prevent actual redundant disk writes (no-op if unchanged)
  // - Overhead is ~4ms per edit (imperceptible to users)
  // - Alternative (tracking row IDs) adds complexity for marginal benefit
  // See: KNOWN_REDUNDANCY_ECHO_PROCESSING.md for full analysis
  const unsubscribe = evolu.subscribeQuery(allFilesQuery)(() => {
    subscriptionFireCount++;
    const triggerTime = new Date().toISOString();
    logger.log(
      `[materialize] 🔔 Subscription fired (#${subscriptionFireCount}) at ${triggerTime}`,
    );

    if (!initialLoadComplete) {
      logger.log(
        "[materialize] Skipping subscription (initial load in progress)",
      );
      return;
    }

    if (debounceTimer) {
      logger.log("[materialize] Resetting debounce timer (rapid changes)");
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(async () => {
      logger.log("[materialize] Change detected (debounced)");

      // Load cursor to find last processed timestamp
      const cursor = await loadHistoryCursor(evolu);

      // Query evolu_history for changes since cursor
      const historyQuery = evolu.createQuery((db) => {
        let qb = db
          .selectFrom("evolu_history")
          .select(["id", "timestamp"])
          // biome-ignore lint/suspicious/noExplicitAny: Evolu's internal table needs runtime values
          .where("table", "==", "file" as any)
          // biome-ignore lint/suspicious/noExplicitAny: Evolu's internal table needs runtime values
          .where("column", "==", "content" as any);

        if (cursor != null) {
          // biome-ignore lint/suspicious/noExplicitAny: Evolu's internal table needs runtime values
          qb = qb.where("timestamp", ">", cursor as any);
        }

        // biome-ignore lint/suspicious/noExplicitAny: Evolu's internal table needs runtime values
        return qb.orderBy("timestamp", "asc" as any);
      });

      const historyRows = await evolu.loadQuery(historyQuery);

      if (historyRows.length === 0) {
        logger.log("[materialize] No new changes to process");
        debounceTimer = null;
        return;
      }

      // Convert history IDs to string IDs and fetch file rows
      const stringIds = historyRows.map((h) =>
        idBytesToId(h.id as unknown as IdBytes),
      );

      const changedFilesQuery = evolu.createQuery((db) =>
        // biome-ignore lint/suspicious/noExplicitAny: Dynamic ID list requires any
        (db as any)
          .selectFrom("file")
          .selectAll()
          // biome-ignore lint/suspicious/noExplicitAny: Dynamic ID list requires any
          .where("id", "in", stringIds as any)
          // biome-ignore lint/suspicious/noExplicitAny: Evolu's Kysely needs runtime values
          .where("isDeleted", "is not", sqliteTrue as any),
      );

      const changedRows = await evolu.loadQuery(changedFilesQuery);

      // Log which files are being processed
      if (changedRows.length === 1) {
        logger.log(
          // biome-ignore lint/complexity/useLiteralKeys: typed via index signature; dot access triggers TS4111.
          `[materialize] Processing changed file: ${changedRows[0]?.["path"]}`,
        );
      } else if (changedRows.length <= 5) {
        // biome-ignore lint/complexity/useLiteralKeys: typed via index signature; dot access triggers TS4111.
        const paths = changedRows.map((r) => r["path"]).join(", ");
        logger.log(
          `[materialize] Processing ${changedRows.length} changed files: ${paths}`,
        );
      } else {
        logger.log(
          `[materialize] Processing ${changedRows.length} changed files`,
        );
      }

      // Process only changed files
      await syncEvoluToFiles(evolu, watchDir, changedRows, options);

      // Update cursor to latest timestamp
      if (historyRows.length > 0) {
        const lastRow = historyRows[historyRows.length - 1];
        if (lastRow?.timestamp) {
          const lastTimestamp = lastRow.timestamp as unknown as TimestampBytes;
          saveHistoryCursor(evolu, lastTimestamp);
        }
      }

      debounceTimer = null;
    }, SUBSCRIPTION_DEBOUNCE_MS);
  });

  logger.log("[materialize] Subscribed");

  return () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    unsubscribe();
  };
};

const syncEvoluToFiles = async (
  evolu: EvoluDatabase,
  watchDir: string,
  // biome-ignore lint/suspicious/noExplicitAny: Query rows type will be refined later
  rows: readonly any[],
  options?: StateMaterializationOptions,
): Promise<void> => {
  const rowsByPath = new Set<string>();
  for (const row of rows) {
    if (isIgnoredRelativePath(row.path)) {
      continue;
    }
    rowsByPath.add(row.path);
  }

  const trackedStateResult = await tryAsync(
    () => getTrackedSyncState(evolu),
    (cause): StateMaterializationError => ({
      type: "StateListReadFailed",
      cause,
    }),
  );

  if (!trackedStateResult.ok) {
    logger.error(
      "[materialize] Failed to read sync state:",
      trackedStateResult.error,
    );
    return;
  }

  const total = rows.length;
  const failedByType = new Map<string, number>();
  let failedCount = 0;

  if (total > 50) {
    logger.log(`[materialize] Processing ${total} files...`);
  }

  let processed = 0;
  const startTime = Date.now();

  for (const row of rows) {
    if (isIgnoredRelativePath(row.path)) {
      continue;
    }

    const absolutePath = join(watchDir, row.path);
    const result = await syncEvoluRowToFile(evolu, absolutePath, row, options);
    if (!result.ok) {
      failedCount += 1;
      failedByType.set(
        result.error.type,
        (failedByType.get(result.error.type) ?? 0) + 1,
      );
      logger.error(`[materialize] Failed to sync ${row.path}:`, result.error);
    }

    processed++;

    if (total > 50 && processed % 50 === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      logger.log(
        `[materialize] Progress: ${processed}/${total} files (${elapsed}s)`,
      );
    }
  }

  for (const trackedState of trackedStateResult.value) {
    if (rowsByPath.has(trackedState.path)) {
      continue;
    }

    const deleteResult = await applyRemoteDeletionToFilesystem(
      evolu,
      watchDir,
      trackedState.path,
      trackedState.lastAppliedHash,
      options,
    );

    if (!deleteResult.ok) {
      failedCount += 1;
      failedByType.set(
        deleteResult.error.type,
        (failedByType.get(deleteResult.error.type) ?? 0) + 1,
      );
      logger.error(
        `[materialize] Failed to apply deletion for ${trackedState.path}:`,
        deleteResult.error,
      );
    }
  }

  if (total > 50) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    logger.log(`[materialize] Completed ${total} files in ${elapsed}s`);
  }

  if (failedCount > 0) {
    logger.warn(
      `[materialize] Failed rows: ${failedCount}/${total} (${Array.from(
        failedByType.entries(),
      )
        .map(([type, count]) => `${type}=${count}`)
        .join(", ")})`,
    );
  }
};

const syncEvoluRowToFile = async (
  evolu: EvoluDatabase,
  absolutePath: string,
  // biome-ignore lint/suspicious/noExplicitAny: Row type will be refined later
  row: any,
  options?: StateMaterializationOptions,
): Promise<Result<void, StateMaterializationError>> => {
  const lastAppliedResult = await tryAsync(
    () => getLastAppliedHash(evolu, row.path),
    (cause): StateMaterializationError => ({
      type: "StateReadFailed",
      path: row.path,
      cause,
    }),
  );
  if (!lastAppliedResult.ok) {
    return err(lastAppliedResult.error);
  }

  const lastAppliedHash = lastAppliedResult.value;
  if (lastAppliedHash === row.contentHash) {
    logger.log(`[materialize] Skipped (already processed): ${row.path}`);
    return ok();
  }

  const file = Bun.file(absolutePath);
  const diskExistsResult = await tryAsync(
    () => file.exists(),
    (cause): StateMaterializationError => ({
      type: "DiskHashFailed",
      absolutePath,
      cause,
    }),
  );
  if (!diskExistsResult.ok) {
    return err(diskExistsResult.error);
  }

  const diskHashResult = diskExistsResult.value
    ? await tryAsync(
        () => computeFileHash(absolutePath),
        (cause): StateMaterializationError => ({
          type: "DiskHashFailed",
          absolutePath,
          cause,
        }),
      )
    : ok(null);

  if (!diskHashResult.ok) {
    return err(diskHashResult.error);
  }

  const diskHash = diskHashResult.value;

  if (diskHash === row.contentHash) {
    logger.log(`[materialize] Skipped (disk matches): ${row.path}`);
    const stateUpdateResult = trySync(
      () => setLastAppliedHash(evolu, row.path, row.contentHash),
      (cause): StateMaterializationError => ({
        type: "StateWriteFailed",
        path: row.path,
        cause,
      }),
    );

    return stateUpdateResult.ok ? ok() : err(stateUpdateResult.error);
  }

  if (detectConflict(diskHash, lastAppliedHash, row.contentHash)) {
    logger.log(`[materialize] Conflict detected: ${row.path}`);

    const conflictFileResult = await tryAsync(
      () => createConflictFile(absolutePath, row.content || "", row.ownerId),
      (cause): StateMaterializationError => ({
        type: "ConflictFileCreateFailed",
        absolutePath,
        cause,
      }),
    );

    if (!conflictFileResult.ok) {
      return err(conflictFileResult.error);
    }

    const conflictPath = conflictFileResult.value;
    logger.log(`[materialize] Created conflict file: ${conflictPath}`);

    const stateUpdateResult = trySync(
      () => setLastAppliedHash(evolu, row.path, row.contentHash),
      (cause): StateMaterializationError => ({
        type: "StateWriteFailed",
        path: row.path,
        cause,
      }),
    );

    if (!stateUpdateResult.ok) {
      return err(stateUpdateResult.error);
    }

    const notifyResult = await tryAsync(
      async () => {
        if (options?.onConflictArtifactCreated) {
          await options.onConflictArtifactCreated(conflictPath);
        }
      },
      (cause): StateMaterializationError => ({
        type: "ConflictFileCreateFailed",
        absolutePath: conflictPath,
        cause,
      }),
    );
    if (!notifyResult.ok) {
      return err(notifyResult.error);
    }

    return ok();
  }

  logger.log(`[materialize] Writing: ${row.path}`);
  const writeResult = await tryAsync(
    () => writeFileAtomic(absolutePath, row.content || ""),
    (cause): StateMaterializationError => ({
      type: "FileWriteFailed",
      absolutePath,
      cause,
    }),
  );

  if (!writeResult.ok) {
    return err(writeResult.error);
  }

  const stateUpdateResult = trySync(
    () => setLastAppliedHash(evolu, row.path, row.contentHash),
    (cause): StateMaterializationError => ({
      type: "StateWriteFailed",
      path: row.path,
      cause,
    }),
  );

  return stateUpdateResult.ok ? ok() : err(stateUpdateResult.error);
};

const applyRemoteDeletionToFilesystem = async (
  evolu: EvoluDatabase,
  watchDir: string,
  path: string,
  lastAppliedHash: string,
  options?: StateMaterializationOptions,
): Promise<Result<void, StateMaterializationError>> => {
  const absolutePath = join(watchDir, path);
  const file = Bun.file(absolutePath);

  const existsResult = await tryAsync(
    () => file.exists(),
    (cause): StateMaterializationError => ({
      type: "FileDeleteFailed",
      absolutePath,
      cause,
    }),
  );

  if (!existsResult.ok) {
    return err(existsResult.error);
  }

  if (!existsResult.value) {
    const stateResult = trySync(
      () => clearLastAppliedHash(evolu, path),
      (cause): StateMaterializationError => ({
        type: "StateWriteFailed",
        path,
        cause,
      }),
    );

    return stateResult.ok ? ok() : err(stateResult.error);
  }

  const diskHashResult = await tryAsync(
    () => computeFileHash(absolutePath),
    (cause): StateMaterializationError => ({
      type: "DiskHashFailed",
      absolutePath,
      cause,
    }),
  );

  if (!diskHashResult.ok) {
    return err(diskHashResult.error);
  }

  if (diskHashResult.value !== lastAppliedHash) {
    logger.log(`[materialize] Deletion conflict detected: ${path}`);

    const localContentResult = await tryAsync(
      () => file.text(),
      (cause): StateMaterializationError => ({
        type: "ConflictFileCreateFailed",
        absolutePath,
        cause,
      }),
    );

    if (!localContentResult.ok) {
      return err(localContentResult.error);
    }

    const conflictResult = await tryAsync(
      () =>
        createConflictFile(
          absolutePath,
          localContentResult.value,
          "remote-delete",
        ),
      (cause): StateMaterializationError => ({
        type: "ConflictFileCreateFailed",
        absolutePath,
        cause,
      }),
    );

    if (!conflictResult.ok) {
      return err(conflictResult.error);
    }

    const stateResult = trySync(
      () => clearLastAppliedHash(evolu, path),
      (cause): StateMaterializationError => ({
        type: "StateWriteFailed",
        path,
        cause,
      }),
    );

    if (!stateResult.ok) {
      return err(stateResult.error);
    }

    const notifyResult = await tryAsync(
      async () => {
        if (options?.onConflictArtifactCreated) {
          await options.onConflictArtifactCreated(conflictResult.value);
        }
      },
      (cause): StateMaterializationError => ({
        type: "ConflictFileCreateFailed",
        absolutePath: conflictResult.value,
        cause,
      }),
    );
    if (!notifyResult.ok) {
      return err(notifyResult.error);
    }

    return ok();
  }

  const deleteResult = await tryAsync(
    () => unlink(absolutePath),
    (cause): StateMaterializationError => ({
      type: "FileDeleteFailed",
      absolutePath,
      cause,
    }),
  );

  if (!deleteResult.ok) {
    const code =
      typeof deleteResult.error.cause === "object" && deleteResult.error.cause
        ? (deleteResult.error.cause as { code?: string }).code
        : undefined;

    if (code !== "ENOENT") {
      return err(deleteResult.error);
    }
  }

  logger.log(`[materialize] Deleted: ${path}`);

  const stateResult = trySync(
    () => clearLastAppliedHash(evolu, path),
    (cause): StateMaterializationError => ({
      type: "StateWriteFailed",
      path,
      cause,
    }),
  );

  return stateResult.ok ? ok() : err(stateResult.error);
};
