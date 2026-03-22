import { mkdir, readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { type Evolu, err, ok, type Result } from "@evolu/common";
import { logger } from "../../logger";
import type { ChangeCaptureError } from "../errors";
import { isIgnoredRelativePath } from "../ignore";
import type { FilePath, Schema } from "../evolu-schema";
import { getTrackedHash } from "../state";
import { captureChange } from "./change-capture";
import { isTxtFile } from "./change-capture-plan";
import { executePlan } from "./executor";
import { collectMaterializationState } from "./state-collector";
import { applyRemoteDeletionToFilesystem } from "./state-materialization";
import { planStateMaterialization } from "./state-materialization-plan";
import { createAllFilesQuery, createDeletedPathsQuery, createExistingPathsQuery, type FileRow } from "../evolu-queries";

type EvoluDatabase = Evolu<typeof Schema>;

/**
 * Fatal errors that prevent reconciliation from proceeding.
 *
 * These represent systematic failures where the operation cannot continue at all:
 * - Watch directory doesn't exist or is inaccessible
 * - Database is unavailable or corrupted
 *
 * Per-file failures (permission denied, file too large, etc.) are NOT fatal -
 * they are tracked in ReconcileStats.errors and processing continues.
 */
export type ReconcileFatalError =
  | {
      readonly type: "WatchDirNotFound";
      readonly path: string;
    }
  | {
      readonly type: "WatchDirUnreadable";
      readonly path: string;
      readonly cause: Error;
    }
  | {
      readonly type: "WatchDirUnwritable";
      readonly path: string;
      readonly cause: Error;
    }
  | {
      readonly type: "DatabaseUnavailable";
      readonly cause: Error;
    };

/**
 * Statistics about a reconciliation operation.
 *
 * Returned on success (ok()) even when some files fail. Use failedCount
 * to check for partial failures, and errors array for details.
 *
 * @property processedCount - Total number of items attempted
 * @property failedCount - Number of items that failed
 * @property errors - Details of each failure (path + error)
 */
export interface ReconcileStats {
  readonly processedCount: number;
  readonly failedCount: number;
  readonly errors: ReadonlyArray<{
    readonly path: string;
    readonly error: ChangeCaptureError;
  }>;
}

/**
 * Reconciliation decision for a file (pure data).
 */
export type ReconcileDecision =
  | { readonly type: "SKIP"; readonly reason: string }
  | {
      readonly type: "WRITE_FROM_EVOLU";
      readonly content: string;
      readonly hash: string;
    }
  | {
      readonly type: "CONFLICT";
      readonly diskHash: string;
      readonly evolHash: string;
    };

/**
 * Decide what to do with a file during startup (pure function).
 */
export const decideReconcileAction = (
  diskHash: string | null,
  lastAppliedHash: string | null,
  evolHash: string,
  content: string,
): ReconcileDecision => {
  // Already processed
  if (lastAppliedHash === evolHash) {
    return { type: "SKIP", reason: "already-processed" };
  }

  // Disk matches Evolu
  if (diskHash === evolHash) {
    return { type: "SKIP", reason: "disk-matches-evolu" };
  }

  // File doesn't exist on disk OR disk unchanged from last applied
  if (!diskHash || diskHash === lastAppliedHash) {
    return { type: "WRITE_FROM_EVOLU", content, hash: evolHash };
  }

  // Conflict: disk differs from both lastAppliedHash and evolHash
  return { type: "CONFLICT", diskHash, evolHash };
};

export const reconcileStartupFilesystemState = async (
  evolu: EvoluDatabase,
  watchDir: string,
): Promise<Result<ReconcileStats, ReconcileFatalError>> => {
  // Fatal check: ensure watchDir exists and is accessible
  try {
    await mkdir(watchDir, { recursive: true });
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "EACCES" || nodeError.code === "EPERM") {
      return err({
        type: "WatchDirUnwritable",
        path: watchDir,
        cause: nodeError,
      });
    }
    throw error;
  }

  // Fatal check: ensure we can read watchDir
  let allFiles: string[];
  try {
    allFiles = await collectFilesRecursively(watchDir);
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "ENOENT") {
      return err({
        type: "WatchDirNotFound",
        path: watchDir,
      });
    }
    if (nodeError.code === "EACCES" || nodeError.code === "EPERM") {
      return err({
        type: "WatchDirUnreadable",
        path: watchDir,
        cause: nodeError,
      });
    }
    throw error;
  }

  const filesToReconcile = allFiles.filter((absolutePath) => {
    const relativePath = relative(watchDir, absolutePath).replaceAll("\\", "/");
    return (
      isTxtFile(absolutePath) &&
      !isIgnoredRelativePath(relativePath)
    );
  });

  // Query non-deleted files from Evolu
  const existingRows = await evolu.loadQuery(createExistingPathsQuery(evolu));
  const existingPaths = new Set(
    existingRows.flatMap((row) => (row.path ? [row.path as string] : [])),
  );

  logger.info(
    `[reconcile:fs→evolu] Startup scan found ${filesToReconcile.length} filesystem files`,
  );

  // Track stats for observability
  let processedCount = 0;
  const errors: Array<{ path: string; error: ChangeCaptureError }> = [];
  let insertedCount = 0;

  // Step 1: Process all files on disk (new files and content changes)
  // RESILIENT: Continue processing even if individual files fail
  for (const absolutePath of filesToReconcile) {
    processedCount += 1;
    const relativePath = relative(watchDir, absolutePath).replaceAll("\\", "/");

    // captureChange handles both new files and content updates
    const result = await captureChange(evolu, watchDir, absolutePath);
    if (!result.ok) {
      // Per-file error: NOT fatal, add to stats and continue
      errors.push({ path: absolutePath, error: result.error });
      logger.error(
        `[reconcile:fs→evolu] Failed to capture ${absolutePath}:`,
        result.error,
      );
      continue;
    }

    if (!existingPaths.has(relativePath)) {
      insertedCount += 1;
    }
  }

  // Step 2: Detect offline deletions (files in Evolu but not on disk)
  const filesystemPaths = new Set(
    filesToReconcile.map((absolutePath) =>
      relative(watchDir, absolutePath).replaceAll("\\", "/"),
    ),
  );

  let deletedCount = 0;
  for (const evolPath of existingPaths) {
    if (filesystemPaths.has(evolPath)) {
      continue;
    }

    processedCount += 1;

    // File was deleted while CLI was offline
    const absolutePath = join(watchDir, evolPath);
    logger.debug(`[reconcile:fs→evolu] Offline deletion detected: ${evolPath}`);

    const result = await captureChange(evolu, watchDir, absolutePath);
    if (!result.ok) {
      // Per-file error: NOT fatal, add to stats and continue
      errors.push({ path: absolutePath, error: result.error });
      logger.error(
        `[reconcile:fs→evolu] Failed to capture offline deletion ${evolPath}:`,
        result.error,
      );
      continue;
    }

    deletedCount += 1;
  }

  // Return stats (ok even with partial failures)
  const stats: ReconcileStats = {
    processedCount,
    failedCount: errors.length,
    errors,
  };

  if (stats.failedCount > 0) {
    logger.warn(
      `[reconcile:fs→evolu] Startup reconciliation completed with ${stats.failedCount} failures`,
    );
  } else {
    logger.info(
      `[reconcile:fs→evolu] Startup filesystem reconciliation complete (inserted ${insertedCount}, deleted ${deletedCount})`,
    );
  }

  return ok(stats);
};

export const reconcileStartupEvoluState = async (
  evolu: EvoluDatabase,
  watchDir: string,
): Promise<Result<ReconcileStats, ReconcileFatalError>> => {
  logger.debug("[reconcile:evolu→fs] Starting Evolu state reconciliation");

  // Track stats for observability
  let processedCount = 0;
  const errors: Array<{ path: string; error: ChangeCaptureError }> = [];

  // Step 1: Apply remote deletions (files deleted in Evolu while offline)
  // Fatal check: ensure we can query database
  let deletedRows: ReadonlyArray<{ path: FilePath }>;
  try {
    deletedRows = await evolu.loadQuery(createDeletedPathsQuery(evolu));
  } catch (error) {
    return err({
      type: "DatabaseUnavailable",
      cause: error as Error,
    });
  }

  logger.debug(
    `[reconcile:evolu→fs] Found ${deletedRows.length} deleted rows in Evolu`,
  );
  let removedCount = 0;

  // RESILIENT: Continue processing even if individual deletions fail
  for (const row of deletedRows) {
    if (!row.path) continue;

    processedCount += 1;

    const trackedHashResult = await getTrackedHash(evolu, row.path);
    const lastAppliedHash = trackedHashResult.ok
      ? (trackedHashResult.value ?? "")
      : "";

    const result = await applyRemoteDeletionToFilesystem(
      evolu,
      watchDir,
      row.path as string,
      lastAppliedHash,
      {},
    );

    if (!result.ok) {
      // Per-file error: NOT fatal, add to stats and continue
      errors.push({
        path: row.path as string,
        error: {
          type: "FileStatFailed",
          absolutePath: row.path as string,
          cause: result.error,
        },
      });
      logger.error(
        `[reconcile:evolu→fs] Failed to apply deletion for ${row.path}:`,
        result.error,
      );
      continue;
    }

    removedCount += 1;
  }

  logger.debug(`[reconcile:evolu→fs] Applied ${removedCount} remote deletions`);

  // Step 2: Apply remote additions/updates (files added/updated in Evolu while offline)
  // Fatal check: ensure we can query database
  let activeRows: readonly FileRow[];
  try {
    activeRows = await evolu.loadQuery(createAllFilesQuery(evolu));
  } catch (error) {
    return err({
      type: "DatabaseUnavailable",
      cause: error as Error,
    });
  }

  let syncedCount = 0;

  // RESILIENT: Continue processing even if individual files fail
  for (const row of activeRows) {
    if (!row.path) continue;

    processedCount += 1;

    // Step 2a: Collect state
    const stateResult = await collectMaterializationState(evolu, watchDir, row);
    if (!stateResult.ok) {
      // Per-file error: NOT fatal, add to stats and continue
      errors.push({
        path: row.path as string,
        error: {
          type: "FileStatFailed",
          absolutePath: row.path as string,
          cause: stateResult.error,
        },
      });
      logger.error(
        `[reconcile:evolu→fs] Failed to collect state for ${row.path}:`,
        stateResult.error,
      );
      continue;
    }

    // Step 2b: Plan actions
    const plan = planStateMaterialization(stateResult.value);

    // Step 2c: Execute plan
    const results = await executePlan(evolu, watchDir, plan);

    // Count synced files (those with WRITE_FILE action)
    if (plan.some((a) => a.type === "WRITE_FILE")) {
      syncedCount += 1;
    }

    // Check for errors
    const firstError = results.find((r) => !r.ok);
    if (firstError && !firstError.ok) {
      // Per-file error: NOT fatal, add to stats and continue
      errors.push({
        path: row.path as string,
        error: {
          type: "FileStatFailed",
          absolutePath: row.path as string,
          cause: firstError.error,
        },
      });
      logger.error(
        `[reconcile:evolu→fs] Failed to apply changes for ${row.path}:`,
        firstError.error,
      );
    }
  }

  logger.info(`[reconcile:evolu→fs] Synced ${syncedCount} files from Evolu`);

  // Return stats (ok even with partial failures)
  const stats: ReconcileStats = {
    processedCount,
    failedCount: errors.length,
    errors,
  };

  return ok(stats);
};

const collectFilesRecursively = async (dir: string): Promise<string[]> => {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const absolutePath = join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectFilesRecursively(absolutePath)));
      continue;
    }

    if (entry.isFile()) {
      files.push(absolutePath);
    }
  }

  return files;
};
