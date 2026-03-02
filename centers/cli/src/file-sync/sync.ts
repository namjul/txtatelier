// Bidirectional sync: Filesystem ↔ Evolu
// Loop A: Filesystem → Evolu (watch-driven)
// Loop B: Evolu → Filesystem (subscription-driven)

import { join, relative } from "node:path";
import { type AppOwner, type Evolu, sqliteTrue } from "@evolu/common";
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
    // Compute relative path (relative to watch directory)
    const relativePath = relative(watchDir, absolutePath);

    // Read file content
    const file = Bun.file(absolutePath);
    const exists = await file.exists();

    if (!exists) {
      console.log(
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
        console.error(
          `[loop-a] Unexpected: record undefined after length check`,
        );
        return;
      }

      if (existingRecord.contentHash === contentHash) {
        console.log(`[loop-a] No change: ${relativePath} (hash matches)`);
        return;
      }

      // Hash different - update
      console.log(`[loop-a] Updating: ${relativePath}`);
      evolu.update("file", {
        id: existingRecord.id,
        path: relativePath,
        content: content || null,
        contentHash,
      });
    } else {
      // New file - insert
      console.log(`[loop-a] Inserting: ${relativePath}`);
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
    console.error(`[loop-a] Failed to sync ${absolutePath}:`, error);
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
  owner: AppOwner,
  watchDir: string,
): (() => void) => {
  console.log("[loop-b] Starting...");

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
    console.log(`[loop-b] Initial load: ${rows.length} existing files`);
    void syncEvoluToFiles(evolu, owner, watchDir, rows).then(() => {
      initialLoadComplete = true;
    });
  });

  // Subscribe to future changes (fires when data changes via Evolu mutations)
  const unsubscribe = evolu.subscribeQuery(allFilesQuery)(() => {
    // Skip if initial load hasn't completed yet
    if (!initialLoadComplete) {
      console.log("[loop-b] Skipping subscription (initial load in progress)");
      return;
    }

    console.log("[loop-b] Change detected");
    const rows = evolu.getQueryRows(allFilesQuery);
    void syncEvoluToFiles(evolu, owner, watchDir, rows);
  });

  console.log("[loop-b] Subscribed");
  return unsubscribe;
};

/**
 * Sync a batch of Evolu rows to the filesystem.
 * Called whenever Evolu data changes.
 */
const syncEvoluToFiles = async (
  evolu: EvoluDatabase,
  owner: AppOwner,
  watchDir: string,
  // biome-ignore lint/suspicious/noExplicitAny: Query rows type will be refined later
  rows: readonly any[],
): Promise<void> => {
  for (const row of rows) {
    // Skip our own changes (prevent echo)
    if (row.ownerId === owner.id) {
      continue;
    }

    const absolutePath = join(watchDir, row.path);
    await syncEvoluRowToFile(evolu, absolutePath, row);
  }
};

/**
 * Apply a single Evolu row to the filesystem.
 * Handles conflict detection and file writing.
 */
const syncEvoluRowToFile = async (
  evolu: EvoluDatabase,
  absolutePath: string,
  // biome-ignore lint/suspicious/noExplicitAny: Row type will be refined later
  row: any,
): Promise<void> => {
  try {
    // Get current disk state
    const file = Bun.file(absolutePath);
    const diskExists = await file.exists();
    const diskHash = diskExists ? await computeFileHash(absolutePath) : null;

    // Get last applied state
    const lastAppliedHash = await getLastAppliedHash(evolu, row.path);

    // Optimization: Skip if already up to date
    if (diskHash === row.contentHash && lastAppliedHash === row.contentHash) {
      return;
    }

    // Check for conflicts
    if (detectConflict(diskHash, lastAppliedHash, row.contentHash)) {
      console.log(`[loop-b] Conflict detected: ${row.path}`);
      const conflictPath = await createConflictFile(
        absolutePath,
        row.content || "",
        row.ownerId,
      );
      console.log(`[loop-b] Created conflict file: ${conflictPath}`);
      return;
    }

    // No conflict - apply change
    console.log(`[loop-b] Writing: ${row.path}`);
    await writeFileAtomic(absolutePath, row.content || "");

    // Update state
    setLastAppliedHash(evolu, row.path, row.contentHash);
  } catch (error) {
    console.error(`[loop-b] Failed to sync ${row.path}:`, error);
  }
};
