// Bidirectional sync: Filesystem ↔ Evolu
// Loop A: Filesystem → Evolu (watch-driven)
// Loop B: Evolu → Filesystem (subscription-driven)

import { stat } from "node:fs/promises";
import { join, relative } from "node:path";
import {
  type Evolu,
  err,
  ok,
  type Result,
  sqliteTrue,
  tryAsync,
  trySync,
} from "@evolu/common";
import { logger } from "../logger";
import { createConflictFile, detectConflict } from "./conflicts";
import type { SyncLoopAError, SyncLoopBError } from "./errors";
import { computeFileHash } from "./hash";
import type { Schema } from "./schema";
import { getLastAppliedHash, setLastAppliedHash } from "./state";
import { writeFileAtomic } from "./write";

type EvoluDatabase = Evolu<typeof Schema>;

// ============================================================================
// Loop A: Filesystem → Evolu
// ============================================================================

export const syncFileToEvolu = async (
  evolu: EvoluDatabase,
  watchDir: string,
  absolutePath: string,
): Promise<Result<void, SyncLoopAError>> => {
  // Compute relative path (relative to watch directory)
  const relativePath = relative(watchDir, absolutePath).replaceAll("\\", "/");

  if (
    relativePath === "" ||
    relativePath === "." ||
    relativePath.startsWith("../")
  ) {
    return ok();
  }

  const statResult = await tryAsync(
    () => stat(absolutePath),
    (cause): SyncLoopAError => ({
      type: "FileStatFailed",
      absolutePath,
      cause,
    }),
  );

  let fileExists = false;
  if (statResult.ok) {
    if (!statResult.value.isFile()) {
      return ok();
    }
    fileExists = true;
  } else {
    const code =
      typeof statResult.error.cause === "object" && statResult.error.cause
        ? (statResult.error.cause as { code?: string }).code
        : undefined;

    if (code !== "ENOENT") {
      logger.error(
        `[loop-a] Failed to stat ${absolutePath}:`,
        statResult.error,
      );
      return err(statResult.error);
    }
  }

  // Read file content
  const file = Bun.file(absolutePath);
  // fs.stat already proved existence when fileStat is present, so avoid a
  // redundant exists() call. Fall back to Bun.exists() only when stat failed
  // (races or transient filesystem state).
  const existsResult = fileExists
    ? ok(true)
    : await tryAsync(
        () => file.exists(),
        (cause): SyncLoopAError => ({
          type: "FileReadFailed",
          absolutePath,
          cause,
        }),
      );

  if (!existsResult.ok) {
    logger.error(
      `[loop-a] Failed to check existence for ${absolutePath}:`,
      existsResult.error,
    );
    return err(existsResult.error);
  }

  if (!existsResult.value) {
    logger.log(
      `[loop-a] File deleted: ${relativePath} (TODO: handle deletion in Phase 4)`,
    );
    return ok();
  }

  const contentResult = await tryAsync(
    () => file.text(),
    (cause): SyncLoopAError => ({
      type: "FileReadFailed",
      absolutePath,
      cause,
    }),
  );
  if (!contentResult.ok) {
    logger.error(
      `[loop-a] Failed to read ${absolutePath}:`,
      contentResult.error,
    );
    return err(contentResult.error);
  }

  const contentHashResult = await tryAsync(
    () => computeFileHash(absolutePath),
    (cause): SyncLoopAError => ({
      type: "FileHashFailed",
      absolutePath,
      cause,
    }),
  );
  if (!contentHashResult.ok) {
    logger.error(
      `[loop-a] Failed to hash ${absolutePath}:`,
      contentHashResult.error,
    );
    return err(contentHashResult.error);
  }

  const content = contentResult.value;
  const contentHash = contentHashResult.value;

  // Query existing record by path
  // Note: Kysely (used by Evolu) requires type coercion for branded types
  const existingQuery = evolu.createQuery((db) =>
    db
      .selectFrom("file")
      .select(["id", "contentHash"])
      // biome-ignore lint/suspicious/noExplicitAny: Evolu's Kysely needs runtime values
      .where("path", "==", relativePath as any)
      // biome-ignore lint/suspicious/noExplicitAny: Evolu's Kysely needs runtime values
      .where("isDeleted", "is not", sqliteTrue as any),
  );

  const existingResult = await tryAsync(
    () => evolu.loadQuery(existingQuery),
    (cause): SyncLoopAError => ({
      type: "EvoluQueryFailed",
      relativePath,
      cause,
    }),
  );

  if (!existingResult.ok) {
    logger.error(
      `[loop-a] Failed to query ${relativePath}:`,
      existingResult.error,
    );
    return err(existingResult.error);
  }

  const existing = existingResult.value;

  const mutationResult = trySync(
    () => {
      if (existing.length > 0) {
        // File exists in Evolu - check if hash changed
        const existingRecord = existing[0];

        if (!existingRecord) {
          logger.error(
            `[loop-a] Unexpected: record undefined after length check`,
          );
          return;
        }

        if (existingRecord.contentHash === contentHash) {
          logger.log(`[loop-a] No change: ${relativePath} (hash matches)`);
          return;
        }

        logger.log(`[loop-a] Updating: ${relativePath}`);
        evolu.update("file", {
          id: existingRecord.id,
          path: relativePath,
          content: content || null,
          contentHash,
        });
      } else {
        logger.log(`[loop-a] Inserting: ${relativePath}`);
        evolu.insert("file", {
          path: relativePath,
          content: content || null,
          contentHash,
        });
      }

      setLastAppliedHash(evolu, relativePath, contentHash);
    },
    (cause): SyncLoopAError => ({
      type: "EvoluMutationFailed",
      relativePath,
      cause,
    }),
  );

  if (!mutationResult.ok) {
    logger.error(
      `[loop-a] Failed to mutate ${relativePath}:`,
      mutationResult.error,
    );
    return err(mutationResult.error);
  }

  return ok();
};

// ============================================================================
// Loop B: Evolu → Filesystem
// ============================================================================

/**
 * Start subscribing to Evolu changes and apply them to the filesystem.
 * Returns an unsubscribe function to stop the subscription.
 */
export const startSyncEvoluToFiles = (
  evolu: EvoluDatabase,
  watchDir: string,
): (() => void) => {
  logger.log("[loop-b] Starting...");

  // Query all non-deleted files
  const allFilesQuery = evolu.createQuery((db) =>
    db
      .selectFrom("file")
      .selectAll()
      // biome-ignore lint/suspicious/noExplicitAny: Evolu's Kysely needs runtime values
      .where("isDeleted", "is not", sqliteTrue as any),
  );

  // Track if initial load is complete (to avoid duplicate processing)
  let initialLoadComplete = false;

  // Load existing rows immediately on startup
  evolu.loadQuery(allFilesQuery).then((rows) => {
    logger.log(`[loop-b] Initial load: ${rows.length} existing files`);
    void syncEvoluToFiles(evolu, watchDir, rows).then(() => {
      initialLoadComplete = true;
    });
  });

  // Debounce subscription to prevent rapid-fire processing during bulk operations
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  const SUBSCRIPTION_DEBOUNCE_MS = 500;

  // Subscribe to future changes (fires when data changes via Evolu mutations)
  const unsubscribe = evolu.subscribeQuery(allFilesQuery)(() => {
    // Skip if initial load hasn't completed yet
    if (!initialLoadComplete) {
      logger.log("[loop-b] Skipping subscription (initial load in progress)");
      return;
    }

    // Clear existing timer
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    // Set new timer - only process after changes settle
    debounceTimer = setTimeout(() => {
      logger.log("[loop-b] Change detected (debounced)");
      const rows = evolu.getQueryRows(allFilesQuery);
      void syncEvoluToFiles(evolu, watchDir, rows);
      debounceTimer = null;
    }, SUBSCRIPTION_DEBOUNCE_MS);
  });

  logger.log("[loop-b] Subscribed");

  return () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    unsubscribe();
  };
};

/**
 * Sync a batch of Evolu rows to the filesystem.
 * Called whenever Evolu data changes.
 */
const syncEvoluToFiles = async (
  evolu: EvoluDatabase,
  watchDir: string,
  // biome-ignore lint/suspicious/noExplicitAny: Query rows type will be refined later
  rows: readonly any[],
): Promise<void> => {
  const total = rows.length;
  const failedByType = new Map<string, number>();
  let failedCount = 0;

  if (total > 50) {
    logger.log(`[loop-b] Processing ${total} files...`);
  }

  let processed = 0;
  const startTime = Date.now();

  for (const row of rows) {
    const absolutePath = join(watchDir, row.path);
    const result = await syncEvoluRowToFile(evolu, watchDir, absolutePath, row);
    if (!result.ok) {
      failedCount += 1;
      failedByType.set(
        result.error.type,
        (failedByType.get(result.error.type) ?? 0) + 1,
      );
      logger.error(`[loop-b] Failed to sync ${row.path}:`, result.error);
    }

    processed++;

    // Log progress every 50 files for large batches
    if (total > 50 && processed % 50 === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      logger.log(
        `[loop-b] Progress: ${processed}/${total} files (${elapsed}s)`,
      );
    }
  }

  if (total > 50) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    logger.log(`[loop-b] Completed ${total} files in ${elapsed}s`);
  }

  if (failedCount > 0) {
    logger.warn(
      `[loop-b] Failed rows: ${failedCount}/${total} (${Array.from(
        failedByType.entries(),
      )
        .map(([type, count]) => `${type}=${count}`)
        .join(", ")})`,
    );
  }
};

/**
 * Apply a single Evolu row to the filesystem.
 * Handles conflict detection and file writing.
 */
const syncEvoluRowToFile = async (
  evolu: EvoluDatabase,
  watchDir: string,
  absolutePath: string,
  // biome-ignore lint/suspicious/noExplicitAny: Row type will be refined later
  row: any,
): Promise<Result<void, SyncLoopBError>> => {
  const lastAppliedResult = await tryAsync(
    () => getLastAppliedHash(evolu, row.path),
    (cause): SyncLoopBError => ({
      type: "StateReadFailed",
      path: row.path,
      cause,
    }),
  );
  if (!lastAppliedResult.ok) {
    return err(lastAppliedResult.error);
  }

  const lastAppliedHash = lastAppliedResult.value;

  // Early exit: if we already applied this exact hash, skip disk I/O entirely
  if (lastAppliedHash === row.contentHash) {
    return ok();
  }

  // Get current disk state
  const file = Bun.file(absolutePath);
  const diskExistsResult = await tryAsync(
    () => file.exists(),
    (cause): SyncLoopBError => ({
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
        (cause): SyncLoopBError => ({
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

  // Secondary optimization: Skip if disk matches and we just haven't recorded it yet
  if (diskHash === row.contentHash) {
    const stateUpdateResult = trySync(
      () => setLastAppliedHash(evolu, row.path, row.contentHash),
      (cause): SyncLoopBError => ({
        type: "StateWriteFailed",
        path: row.path,
        cause,
      }),
    );

    return stateUpdateResult.ok ? ok() : err(stateUpdateResult.error);
  }

  // Check for conflicts
  if (detectConflict(diskHash, lastAppliedHash, row.contentHash)) {
    logger.log(`[loop-b] Conflict detected: ${row.path}`);

    const conflictFileResult = await tryAsync(
      () => createConflictFile(absolutePath, row.content || "", row.ownerId),
      (cause): SyncLoopBError => ({
        type: "ConflictFileCreateFailed",
        absolutePath,
        cause,
      }),
    );

    if (!conflictFileResult.ok) {
      return err(conflictFileResult.error);
    }

    const conflictPath = conflictFileResult.value;
    logger.log(`[loop-b] Created conflict file: ${conflictPath}`);

    const stateUpdateResult = trySync(
      () => setLastAppliedHash(evolu, row.path, row.contentHash),
      (cause): SyncLoopBError => ({
        type: "StateWriteFailed",
        path: row.path,
        cause,
      }),
    );

    if (!stateUpdateResult.ok) {
      return err(stateUpdateResult.error);
    }

    // Ensure conflict files propagate even if filesystem watch misses the event.
    const conflictSyncResult = await syncFileToEvolu(
      evolu,
      watchDir,
      conflictPath,
    );
    if (!conflictSyncResult.ok) {
      return err({
        type: "ConflictFileCreateFailed",
        absolutePath: conflictPath,
        cause: conflictSyncResult.error,
      });
    }

    return ok();
  }

  // No conflict - apply change
  logger.log(`[loop-b] Writing: ${row.path}`);
  const writeResult = await tryAsync(
    () => writeFileAtomic(absolutePath, row.content || ""),
    (cause): SyncLoopBError => ({
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
    (cause): SyncLoopBError => ({
      type: "StateWriteFailed",
      path: row.path,
      cause,
    }),
  );

  return stateUpdateResult.ok ? ok() : err(stateUpdateResult.error);
};
