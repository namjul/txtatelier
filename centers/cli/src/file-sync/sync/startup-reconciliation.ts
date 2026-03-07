import { mkdir, readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { type Evolu, sqliteTrue } from "@evolu/common";
import { logger } from "../../logger";
import { isIgnoredRelativePath } from "../ignore";
import type { Schema } from "../schema";
import { captureChange } from "./change-capture";

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

  // Step 1: Add new files (files on disk but not in Evolu)
  let failedCount = 0;
  let insertedCount = 0;
  for (const absolutePath of filesToReconcile) {
    const relativePath = relative(watchDir, absolutePath).replaceAll("\\", "/");

    if (existingPaths.has(relativePath)) {
      continue;
    }

    const result = await captureChange(evolu, watchDir, absolutePath);
    if (!result.ok) {
      failedCount += 1;
      logger.error(
        `[reconcile] Failed to capture ${absolutePath}:`,
        result.error,
      );
      continue;
    }

    insertedCount += 1;
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
    `[reconcile] Startup filesystem reconciliation complete (inserted ${insertedCount} new files, deleted ${deletedCount} offline-deleted files)`,
  );
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
