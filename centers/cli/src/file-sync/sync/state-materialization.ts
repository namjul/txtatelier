import { access, readFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import {
  createIdFromString,
  err,
  type IdBytes,
  idBytesToId,
  ok,
  type Result,
  tryAsync,
} from "@evolu/common";
import type { TimestampBytes } from "@evolu/common/local-first";
import { logger } from "../../logger";
import { createConflictFile } from "../conflicts";
import type { StateMaterializationError } from "../errors";
import {
  createAllFilesQuery,
  createAllSyncStateQuery,
  createChangedFilesQuery,
  createDeletedFilesWithIdsQuery,
  createHistoryChangesQuery,
  createHistoryCursorQuery,
  createLatestHistoryQuery,
  type FileRow,
} from "../evolu-queries";
import type { FileId } from "../evolu-schema";
import { computeFileHash } from "../hash";
import { isIgnoredRelativePath } from "../ignore";
import { clearTrackedHash, getTrackedHash } from "../state";
import type { EvoluDatabase, FileSyncContext } from "./context";
import { executePlan } from "./executor";
import { collectMaterializationState } from "./state-collector";
import { planStateMaterialization } from "./state-materialization-plan";

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
  const q = createHistoryCursorQuery(evolu);
  const rows = await evolu.loadQuery(q);
  return rows[0]?.lastTimestamp ?? null;
};

const saveHistoryCursor = (evolu: EvoluDatabase, ts: TimestampBytes): void => {
  const cursorId = createIdFromString<"HistoryCursor">("history-cursor");
  evolu.upsert("_historyCursor", { id: cursorId, lastTimestamp: ts });
};

// ========== State Materialization ==========

export const startStateMaterialization = (
  ctx: FileSyncContext,
  options?: StateMaterializationOptions,
): (() => void) => {
  const { evolu } = ctx;
  logger.debug("[materialize:evolu→fs] Starting state materialization");

  const allFilesQuery = createAllFilesQuery(evolu);

  let initialLoadComplete = false;

  // Ensure cursor exists before starting
  ensureHistoryCursor(evolu);

  evolu.loadQuery(allFilesQuery).then(async (rows) => {
    logger.debug(
      `[state:subscription] Initial load: ${rows.length} existing files`,
    );
    await syncEvoluToFiles(ctx, rows, options);

    // Set cursor to current timestamp to avoid replaying old history
    // Query latest timestamp from evolu_history
    const latestHistoryQuery = createLatestHistoryQuery(evolu);

    const latestHistory = await evolu.loadQuery(latestHistoryQuery);
    if (latestHistory.length > 0) {
      const firstRow = latestHistory[0];
      // biome-ignore lint/complexity/useLiteralKeys: typed via index signature; dot access triggers TS4111.
      if (firstRow?.["timestamp"]) {
        const latestTimestamp =
          firstRow[
            // biome-ignore lint/complexity/useLiteralKeys: typed via index signature; dot access triggers TS4111.
            "timestamp"
          ];
        saveHistoryCursor(evolu, latestTimestamp);
        logger.debug(
          "[state:subscription] Cursor initialized to latest history timestamp",
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
    logger.debug(
      `[state:subscription] 🔔 Subscription fired (#${subscriptionFireCount}) at ${triggerTime}`,
    );

    if (!initialLoadComplete) {
      logger.debug(
        "[state:subscription] Skipping subscription (initial load in progress)",
      );
      return;
    }

    if (debounceTimer) {
      logger.debug("[state:debounce] Resetting debounce timer (rapid changes)");
      clearTimeout(debounceTimer);
    }

    // TODO simplify debouncer
    debounceTimer = setTimeout(async () => {
      try {
        logger.debug("[state:debounce] Change detected (debounced)");

        // Load cursor to find last processed timestamp
        const cursor = await loadHistoryCursor(evolu);

        // Query evolu_history for both content and deletion changes since cursor
        const historyQuery = createHistoryChangesQuery(evolu, cursor);
        const historyRows = await evolu.loadQuery(historyQuery);

        if (historyRows.length === 0) {
          logger.debug("[state:debounce] No new changes to process");
          debounceTimer = null;
          return;
        }

        // Separate history rows by event type
        const contentChangeIds: FileId[] = [];
        const deletionEventIds: FileId[] = [];

        for (const historyRow of historyRows) {
          const stringId = idBytesToId(
            historyRow.id as unknown as IdBytes,
          ) as FileId;
          // biome-ignore lint/complexity/useLiteralKeys: typed via index signature; dot access triggers TS4111.
          const column = historyRow["column"];

          if (column === "isDeleted") {
            deletionEventIds.push(stringId);
          } else if (column === "content") {
            contentChangeIds.push(stringId);
          }
        }

        // Process content changes
        if (contentChangeIds.length > 0) {
          const changedFilesQuery = createChangedFilesQuery(
            evolu,
            contentChangeIds,
          );

          const changedRows = await evolu.loadQuery(changedFilesQuery);

          // Log which files are being processed
          if (changedRows.length === 1) {
            logger.debug(
              // biome-ignore lint/complexity/useLiteralKeys: typed via index signature; dot access triggers TS4111.
              `[materialize:evolu→fs] Processing changed file: ${changedRows[0]?.["path"]}`,
            );
          } else if (changedRows.length <= 5) {
            // biome-ignore lint/complexity/useLiteralKeys: typed via index signature; dot access triggers TS4111.
            const paths = changedRows.map((r) => r["path"]).join(", ");
            logger.debug(
              `[materialize:evolu→fs] Processing ${changedRows.length} changed files: ${paths}`,
            );
          } else {
            logger.debug(
              `[materialize:evolu→fs] Processing ${changedRows.length} changed files`,
            );
          }

          // Process content changes
          await syncEvoluToFiles(ctx, changedRows, options);
        }

        // Process deletion events
        if (deletionEventIds.length > 0) {
          const deletedFilesQuery = createDeletedFilesWithIdsQuery(
            evolu,
            deletionEventIds,
          );
          const deletedRows = await evolu.loadQuery(deletedFilesQuery);

          if (deletedRows.length === 1) {
            const firstRow = deletedRows[0];
            logger.debug(
              // biome-ignore lint/complexity/useLiteralKeys: typed via index signature; dot access triggers TS4111.
              `[materialize:evolu→fs] Processing deletion: ${firstRow?.["path"]}`,
            );
          } else if (deletedRows.length > 0) {
            logger.debug(
              `[materialize:evolu→fs] Processing ${deletedRows.length} deletions`,
            );
          }

          // Process each deletion
          for (const deletedRow of deletedRows) {
            const path = deletedRow.path;
            if (!path) continue;

            const lastAppliedHashResult = await getTrackedHash(evolu, path);

            if (!lastAppliedHashResult.ok) {
              logger.error(
                `[materialize:evolu→fs] Failed to get tracked hash for ${path}:`,
                lastAppliedHashResult.error,
              );
              continue;
            }

            const deleteResult = await applyRemoteDeletionToFilesystem(
              ctx,
              path as string,
              lastAppliedHashResult.value ?? "",
              options,
            );

            if (!deleteResult.ok) {
              logger.error(
                `[materialize:evolu→fs] Failed to apply deletion for ${path}:`,
                deleteResult.error,
              );
            }
          }
        }

        // Update cursor to latest timestamp
        if (historyRows.length > 0) {
          const lastRow = historyRows[historyRows.length - 1];
          if (lastRow?.timestamp) {
            const lastTimestamp =
              lastRow.timestamp as unknown as TimestampBytes;
            saveHistoryCursor(evolu, lastTimestamp);
          }
        }

        debounceTimer = null;
      } catch (error) {
        logger.error("[state:debounce] Unhandled error:", error);
        debounceTimer = null;
      }
    }, SUBSCRIPTION_DEBOUNCE_MS);
  });

  logger.debug("[state:subscription] Subscribed");

  return () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    unsubscribe();
  };
};

const MATERIALIZE_CONCURRENCY = 20;

const syncEvoluToFiles = async (
  ctx: FileSyncContext,
  rows: readonly FileRow[],
  options?: StateMaterializationOptions,
): Promise<void> => {
  const { evolu } = ctx;
  const total = rows.length;
  if (total === 0) return;

  const failedByType = new Map<string, number>();
  let failedCount = 0;
  let processed = 0;

  if (total > 50) {
    logger.debug(`[materialize:evolu→fs] Processing ${total} files...`);
  }

  // Pre-load all sync states to avoid one DB query per file
  const syncStateRows = await evolu.loadQuery(createAllSyncStateQuery(evolu));
  const syncStateMap = new Map<string, string | null>(
    syncStateRows.map((r) => [r.path as string, r.lastAppliedHash ?? null]),
  );

  const startTime = Date.now();

  const processRow = async (row: FileRow): Promise<void> => {
    if (isIgnoredRelativePath(row.path)) {
      processed++;
      return;
    }

    const preloadedHash = syncStateMap.has(row.path)
      ? (syncStateMap.get(row.path) ?? null)
      : null;
    const result = await syncEvoluRowToFile(ctx, row, options, preloadedHash);

    if (!result.ok) {
      failedCount += 1;
      failedByType.set(
        result.error.type,
        (failedByType.get(result.error.type) ?? 0) + 1,
      );
      logger.error(
        `[materialize:evolu→fs] Failed to sync ${row.path}:`,
        result.error,
      );
    }

    processed++;

    if (total > 50 && processed % 50 === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      logger.debug(
        `[materialize:evolu→fs] Progress: ${processed}/${total} files (${elapsed}s)`,
      );
    }
  };

  for (let i = 0; i < rows.length; i += MATERIALIZE_CONCURRENCY) {
    await Promise.all(
      rows.slice(i, i + MATERIALIZE_CONCURRENCY).map(processRow),
    );
  }

  if (total > 50) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    logger.info(
      `[materialize:evolu→fs] Completed ${total} files in ${elapsed}s`,
    );
  }

  if (failedCount > 0) {
    logger.warn(
      `[materialize:evolu→fs] Failed rows: ${failedCount}/${total} (${Array.from(
        failedByType.entries(),
      )
        .map(([type, count]) => `${type}=${count}`)
        .join(", ")})`,
    );
  }
};

const syncEvoluRowToFile = async (
  ctx: FileSyncContext,
  row: FileRow,
  options?: StateMaterializationOptions,
  preloadedLastAppliedHash?: string | null,
): Promise<Result<void, StateMaterializationError>> => {
  const { evolu, watchDir } = ctx;
  // Step 1: Collect state (I/O)
  const stateResult = await collectMaterializationState(
    evolu,
    watchDir,
    row,
    preloadedLastAppliedHash,
  );

  if (!stateResult.ok) {
    logger.error(
      `[materialize:evolu→fs] Failed to collect state for ${row.path}:`,
      stateResult.error,
    );
    return err({
      type: "DiskHashFailed",
      absolutePath: `${watchDir}/${row.path}`,
      cause: stateResult.error,
    });
  }

  // Step 2: Plan actions (pure logic)
  const plan = planStateMaterialization(stateResult.value);

  // Step 3: Execute plan (I/O)
  const results = await executePlan(ctx, plan);

  // Step 4: Handle conflict notification if needed
  const conflictAction = plan.find((a) => a.type === "CREATE_CONFLICT");
  if (conflictAction && conflictAction.type === "CREATE_CONFLICT") {
    if (options?.onConflictArtifactCreated) {
      await options.onConflictArtifactCreated(conflictAction.conflictPath);
    }
  }

  // Check for execution errors
  const firstError = results.find((r) => !r.ok);
  if (firstError && !firstError.ok) {
    logger.error(
      `[materialize:evolu→fs] Execution failed for ${row.path}:`,
      firstError.error,
    );
    return err({
      type: "FileWriteFailed",
      absolutePath: `${watchDir}/${row.path}`,
      cause: firstError.error,
    });
  }

  return ok();
};

export const applyRemoteDeletionToFilesystem = async (
  ctx: FileSyncContext,
  path: string,
  lastAppliedHash: string,
  options?: StateMaterializationOptions,
): Promise<Result<void, StateMaterializationError>> => {
  const { evolu, watchDir } = ctx;
  const absolutePath = join(watchDir, path);

  const existsResult = await tryAsync(
    () =>
      access(absolutePath).then(
        () => true,
        () => false,
      ),
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
    return clearTrackedHash(evolu, path);
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
    logger.info(`[materialize:evolu→fs] Deletion conflict detected: ${path}`);

    const localContentResult = await tryAsync(
      () => readFile(absolutePath, "utf-8"),
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

    const stateResult = clearTrackedHash(evolu, path);
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

  logger.debug(`[materialize:evolu→fs] Deleted: ${path}`);

  return clearTrackedHash(evolu, path);
};
