import { mkdir, readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import type { Evolu } from "@evolu/common";
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

  const existingRowsQuery = evolu.createQuery((db) =>
    db.selectFrom("file").select(["path"]),
  );
  const existingRows = await evolu.loadQuery(existingRowsQuery);
  const existingPaths = new Set(
    existingRows.flatMap((row) => (row.path ? [row.path as string] : [])),
  );

  logger.log(
    `[reconcile] Startup scan found ${filesToReconcile.length} filesystem files`,
  );

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

  if (failedCount > 0) {
    logger.warn(
      `[reconcile] Startup reconciliation completed with ${failedCount} failures`,
    );
    return;
  }

  logger.log(
    `[reconcile] Startup filesystem reconciliation complete (inserted ${insertedCount} new files)`,
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
