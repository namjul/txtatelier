import { mkdir, readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { type Evolu, sqliteTrue } from "@evolu/common";
import { logger } from "../../logger";
import { computeFileHash } from "../hash";
import { isIgnoredRelativePath } from "../ignore";
import type { Schema } from "../schema";
import { getTrackedHash, setTrackedHash } from "../state";
import { writeFileAtomic } from "../write";
import { captureChange } from "./change-capture";
import { applyRemoteDeletionToFilesystem } from "./state-materialization";

type EvoluDatabase = Evolu<typeof Schema>;

export const reconcileStartupFilesystemState = async (
  evolu: EvoluDatabase,
  watchDir: string,
): Promise<void> => {
  await mkdir(watchDir, { recursive: true });

  const allFiles = await collectFilesRecursively(watchDir);
  const filesToReconcile = allFiles.filter((absolutePath) => {
    const relativePath = relative(watchDir, absolutePath).replaceAll("\\", "/");
    return !isIgnoredRelativePath(relativePath);
  });

  // Query non-deleted files from Evolu
  const existingRowsQuery = evolu.createQuery((db) =>
    db
      .selectFrom("file")
      .select(["path"])
      // biome-ignore lint/suspicious/noExplicitAny: Evolu's Kysely needs runtime values
      .where("isDeleted", "is not", sqliteTrue as any),
  );
  const existingRows = await evolu.loadQuery(existingRowsQuery);
  const existingPaths = new Set(
    existingRows.flatMap((row) => (row.path ? [row.path as string] : [])),
  );

  logger.log(
    `[reconcile] Startup scan found ${filesToReconcile.length} filesystem files`,
  );

  // Step 1: Process all files on disk (new files and content changes)
  let failedCount = 0;
  let insertedCount = 0;
  for (const absolutePath of filesToReconcile) {
    const relativePath = relative(watchDir, absolutePath).replaceAll("\\", "/");

    // captureChange handles both new files and content updates
    const result = await captureChange(evolu, watchDir, absolutePath);
    if (!result.ok) {
      failedCount += 1;
      logger.error(
        `[reconcile] Failed to capture ${absolutePath}:`,
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

    // File was deleted while CLI was offline
    const absolutePath = join(watchDir, evolPath);
    logger.log(`[reconcile] Offline deletion detected: ${evolPath}`);

    const result = await captureChange(evolu, watchDir, absolutePath);
    if (!result.ok) {
      failedCount += 1;
      logger.error(
        `[reconcile] Failed to capture offline deletion ${evolPath}:`,
        result.error,
      );
      continue;
    }

    deletedCount += 1;
  }

  if (failedCount > 0) {
    logger.warn(
      `[reconcile] Startup reconciliation completed with ${failedCount} failures`,
    );
    return;
  }

  logger.log(
    `[reconcile] Startup filesystem reconciliation complete (inserted ${insertedCount}, deleted ${deletedCount})`,
  );
};

export const reconcileStartupEvoluState = async (
  evolu: EvoluDatabase,
  watchDir: string,
): Promise<void> => {
  logger.log("[reconcile] Starting Evolu state reconciliation");

  // Step 1: Apply remote deletions (files deleted in Evolu while offline)
  const deletedRowsQuery = evolu.createQuery((db) =>
    db
      .selectFrom("file")
      .select(["path"])
      // biome-ignore lint/suspicious/noExplicitAny: Evolu's Kysely needs runtime values
      .where("isDeleted", "is", sqliteTrue as any),
  );

  const deletedRows = await evolu.loadQuery(deletedRowsQuery);
  logger.log(`[reconcile] Found ${deletedRows.length} deleted rows in Evolu`);
  let removedCount = 0;
  for (const row of deletedRows) {
    if (!row.path) continue;

    const trackedHashResult = await getTrackedHash(evolu, row.path as string);
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
      logger.error(
        `[reconcile] Failed to apply deletion for ${row.path}:`,
        result.error,
      );
      continue;
    }

    removedCount += 1;
  }

  logger.log(`[reconcile] Applied ${removedCount} remote deletions`);

  // Step 2: Apply remote additions/updates (files added/updated in Evolu while offline)
  const activeRowsQuery = evolu.createQuery((db) =>
    db
      .selectFrom("file")
      .selectAll()
      // biome-ignore lint/suspicious/noExplicitAny: Evolu's Kysely needs runtime values
      .where("isDeleted", "is not", sqliteTrue as any),
  );

  const activeRows = await evolu.loadQuery(activeRowsQuery);
  let syncedCount = 0;

  for (const row of activeRows) {
    if (!row.path || !row.content) continue;

    const absolutePath = join(watchDir, row.path as string);
    const trackedHashResult = await getTrackedHash(evolu, row.path as string);
    const lastAppliedHash = trackedHashResult.ok
      ? (trackedHashResult.value ?? "")
      : "";

    if (lastAppliedHash === row.contentHash) {
      continue;
    }

    const file = Bun.file(absolutePath);
    const diskExists = await file.exists();
    const diskHash = diskExists ? await computeFileHash(absolutePath) : null;

    if (diskHash === row.contentHash) {
      await setTrackedHash(
        evolu,
        row.path as string,
        row.contentHash as string,
      );
      continue;
    }

    if (!diskExists || diskHash === lastAppliedHash) {
      await writeFileAtomic(absolutePath, row.content as string);
      await setTrackedHash(
        evolu,
        row.path as string,
        row.contentHash as string,
      );
      syncedCount += 1;
      logger.log(`[reconcile] Synced from Evolu: ${row.path}`);
    } else {
      // Conflict: disk differs from both lastAppliedHash and row.contentHash
      logger.log(`[reconcile] Conflict detected on startup: ${row.path}`);
    }
  }

  logger.log(`[reconcile] Synced ${syncedCount} files from Evolu`);
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
