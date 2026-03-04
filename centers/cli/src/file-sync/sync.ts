// Bidirectional sync: Filesystem ↔ Evolu
// Loop A: Filesystem → Evolu (watch-driven)
// Loop B: Evolu → Filesystem (subscription-driven)

import { join, relative } from "node:path";
import { type Evolu, sqliteTrue } from "@evolu/common";
import { logger } from "../logger";
import { createConflictFile, detectConflict } from "./conflicts";
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
): Promise<void> => {
  try {
    const fs = await import("node:fs/promises");

    // Compute relative path (relative to watch directory)
    const relativePath = relative(watchDir, absolutePath).replaceAll("\\", "/");

    if (
      relativePath === "" ||
      relativePath === "." ||
      relativePath.startsWith("../")
    ) {
      return;
    }

    let fileStat: Awaited<ReturnType<typeof fs.stat>> | null = null;
    try {
      fileStat = await fs.stat(absolutePath);
    } catch {
      fileStat = null;
    }

    if (fileStat && !fileStat.isFile()) {
      return;
    }

    // Read file content
    const file = Bun.file(absolutePath);
    // fs.stat already proved existence when fileStat is present, so avoid a
    // redundant exists() call. Fall back to Bun.exists() only when stat failed
    // (races or transient filesystem state).
    const exists = fileStat ? true : await file.exists();

    if (!exists) {
      logger.log(
        `[loop-a] File deleted: ${relativePath} (TODO: handle deletion in Phase 4)`,
      );
      return;
    }

    // Read content
    const content = await file.text();
    const contentHash = await computeFileHash(absolutePath);

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

    const existing = await evolu.loadQuery(existingQuery);

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

      // Hash different - update
      logger.log(`[loop-a] Updating: ${relativePath}`);
      evolu.update("file", {
        id: existingRecord.id,
        path: relativePath,
        content: content || null,
        contentHash,
      });
    } else {
      // New file - insert
      logger.log(`[loop-a] Inserting: ${relativePath}`);
      evolu.insert("file", {
        path: relativePath,
        content: content || null,
        contentHash,
      });
    }

    // Track that we wrote this hash to Evolu
    // This prevents Loop B from echoing our own writes
    setLastAppliedHash(evolu, relativePath, contentHash);
  } catch (error) {
    logger.error(`[loop-a] Failed to sync ${absolutePath}:`, error);
  }
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

  if (total > 50) {
    logger.log(`[loop-b] Processing ${total} files...`);
  }

  let processed = 0;
  const startTime = Date.now();

  for (const row of rows) {
    const absolutePath = join(watchDir, row.path);
    await syncEvoluRowToFile(evolu, watchDir, absolutePath, row);

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
): Promise<void> => {
  try {
    // Get last applied state first (cheapest check)
    const lastAppliedHash = await getLastAppliedHash(evolu, row.path);

    // Early exit: if we already applied this exact hash, skip disk I/O entirely
    if (lastAppliedHash === row.contentHash) {
      return;
    }

    // Get current disk state
    const file = Bun.file(absolutePath);
    const diskExists = await file.exists();
    const diskHash = diskExists ? await computeFileHash(absolutePath) : null;

    // Secondary optimization: Skip if disk matches and we just haven't recorded it yet
    if (diskHash === row.contentHash) {
      // Update state to prevent future checks
      setLastAppliedHash(evolu, row.path, row.contentHash);
      return;
    }

    // Check for conflicts
    if (detectConflict(diskHash, lastAppliedHash, row.contentHash)) {
      logger.log(`[loop-b] Conflict detected: ${row.path}`);
      const conflictPath = await createConflictFile(
        absolutePath,
        row.content || "",
        row.ownerId,
      );
      logger.log(`[loop-b] Created conflict file: ${conflictPath}`);

      // Mark remote hash as processed for the original path.
      // This prevents repeated conflict creation when subsequent query updates
      // (including conflict-file sync) re-run Loop B.
      setLastAppliedHash(evolu, row.path, row.contentHash);

      // Ensure conflict files propagate even if filesystem watch misses the event.
      await syncFileToEvolu(evolu, watchDir, conflictPath);
      return;
    }

    // No conflict - apply change
    logger.log(`[loop-b] Writing: ${row.path}`);
    await writeFileAtomic(absolutePath, row.content || "");

    // Update state
    setLastAppliedHash(evolu, row.path, row.contentHash);
  } catch (error) {
    logger.error(`[loop-b] Failed to sync ${row.path}:`, error);
  }
};
