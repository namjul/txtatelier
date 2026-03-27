import { mkdir, readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { err, ok, type Result } from "@evolu/common";
import { logger } from "../../logger";
import type { ChangeCaptureError } from "../errors";
import {
  createAllFileRecordsQuery,
  createAllFilesQuery,
  createAllSyncStateQuery,
  createDeletedPathsQuery,
  type FileRow,
} from "../evolu-queries";
import type { FilePath } from "../evolu-schema";
import { isIgnoredRelativePath } from "../ignore";
import { captureChange } from "./change-capture";
import { isTxtFile } from "./change-capture-plan";
import type { FileSyncContext } from "./context";
import { executePlan } from "./executor";
import { collectMaterializationState } from "./state-collector";
import { applyRemoteDeletionToFilesystem } from "./state-materialization";
import { planStateMaterialization } from "./state-materialization-plan";

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
  ctx: FileSyncContext,
): Promise<Result<ReconcileStats, ReconcileFatalError>> => {
  const { evolu, watchDir } = ctx;
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
    return isTxtFile(absolutePath) && !isIgnoredRelativePath(relativePath);
  });

  // Pre-load all Evolu file records to avoid one DB query per file
  const fileRecordRows = await evolu.loadQuery(
    createAllFileRecordsQuery(evolu),
  );
  const fileRecordsMap = new Map(
    fileRecordRows.map((r) => [
      r.path as string,
      { id: r.id, contentHash: r.contentHash },
    ]),
  );
  const existingPaths = new Set(fileRecordRows.map((r) => r.path as string));

  logger.info(
    `[reconcile:fs→evolu] Startup scan found ${filesToReconcile.length} filesystem files`,
  );

  // Track stats for observability
  let processedCount = 0;
  const errors: Array<{ path: string; error: ChangeCaptureError }> = [];
  let insertedCount = 0;

  const RECONCILE_CONCURRENCY = 20;

  // Step 1: Process all files on disk (new files and content changes)
  // RESILIENT: Continue processing even if individual files fail
  const processFile = async (absolutePath: string): Promise<void> => {
    processedCount += 1;
    const relativePath = relative(watchDir, absolutePath).replaceAll("\\", "/");
    const preloadedExisting = fileRecordsMap.get(relativePath) ?? null;

    // captureChange handles both new files and content updates
    const result = await captureChange(ctx, absolutePath, preloadedExisting);
    if (!result.ok) {
      // Per-file error: NOT fatal, add to stats and continue
      errors.push({ path: absolutePath, error: result.error });
      logger.error(
        `[reconcile:fs→evolu] Failed to capture ${absolutePath}:`,
        result.error,
      );
      return;
    }

    if (!existingPaths.has(relativePath)) {
      insertedCount += 1;
    }
  };

  for (let i = 0; i < filesToReconcile.length; i += RECONCILE_CONCURRENCY) {
    await Promise.all(
      filesToReconcile.slice(i, i + RECONCILE_CONCURRENCY).map(processFile),
    );
  }

  // Step 2: Detect offline deletions (files in Evolu but not on disk)
  const filesystemPaths = new Set(
    filesToReconcile.map((absolutePath) =>
      relative(watchDir, absolutePath).replaceAll("\\", "/"),
    ),
  );

  let deletedCount = 0;
  const deletionPaths = [...existingPaths].filter(
    (p) => !filesystemPaths.has(p),
  );

  const processDeletion = async (evolPath: string): Promise<void> => {
    processedCount += 1;

    // File was deleted while CLI was offline
    const absolutePath = join(watchDir, evolPath);
    logger.debug(`[reconcile:fs→evolu] Offline deletion detected: ${evolPath}`);

    const preloadedExisting = fileRecordsMap.get(evolPath) ?? null;
    const result = await captureChange(ctx, absolutePath, preloadedExisting);
    if (!result.ok) {
      // Per-file error: NOT fatal, add to stats and continue
      errors.push({ path: absolutePath, error: result.error });
      logger.error(
        `[reconcile:fs→evolu] Failed to capture offline deletion ${evolPath}:`,
        result.error,
      );
      return;
    }

    deletedCount += 1;
  };

  for (let i = 0; i < deletionPaths.length; i += RECONCILE_CONCURRENCY) {
    await Promise.all(
      deletionPaths.slice(i, i + RECONCILE_CONCURRENCY).map(processDeletion),
    );
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
  ctx: FileSyncContext,
): Promise<Result<ReconcileStats, ReconcileFatalError>> => {
  const { evolu, watchDir } = ctx;
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

  // Pre-load all sync states to avoid one DB query per file
  const syncStateRows = await evolu.loadQuery(createAllSyncStateQuery(evolu));
  const syncStateMap = new Map<string, string | null>(
    syncStateRows.map((r) => [r.path as string, r.lastAppliedHash ?? null]),
  );

  const EVOLU_RECONCILE_CONCURRENCY = 20;

  // RESILIENT: Continue processing even if individual deletions fail
  const processDeletion = async (row: { path: FilePath }): Promise<void> => {
    if (!row.path) return;

    processedCount += 1;

    const lastAppliedHash = syncStateMap.get(row.path as string) ?? "";

    const result = await applyRemoteDeletionToFilesystem(
      ctx,
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
      return;
    }

    removedCount += 1;
  };

  for (let i = 0; i < deletedRows.length; i += EVOLU_RECONCILE_CONCURRENCY) {
    await Promise.all(
      deletedRows
        .slice(i, i + EVOLU_RECONCILE_CONCURRENCY)
        .map(processDeletion),
    );
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
  const processRow = async (row: FileRow): Promise<void> => {
    if (!row.path) return;

    processedCount += 1;

    const preloadedHash = syncStateMap.get(row.path as string) ?? null;

    // Step 2a: Collect state
    const stateResult = await collectMaterializationState(
      evolu,
      watchDir,
      row,
      preloadedHash,
    );
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
      return;
    }

    // Step 2b: Plan actions
    const plan = planStateMaterialization(stateResult.value);

    // Step 2c: Execute plan
    const results = await executePlan(ctx, plan);

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
  };

  for (let i = 0; i < activeRows.length; i += EVOLU_RECONCILE_CONCURRENCY) {
    await Promise.all(
      activeRows.slice(i, i + EVOLU_RECONCILE_CONCURRENCY).map(processRow),
    );
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
