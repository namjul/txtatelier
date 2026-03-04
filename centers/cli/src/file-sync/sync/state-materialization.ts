import { unlink } from "node:fs/promises";
import { join } from "node:path";
import {
  type Evolu,
  err,
  ok,
  type Result,
  sqliteTrue,
  tryAsync,
  trySync,
} from "@evolu/common";
import { logger } from "../../logger";
import { createConflictFile, detectConflict } from "../conflicts";
import type { SyncLoopBError } from "../errors";
import { computeFileHash } from "../hash";
import type { Schema } from "../schema";
import {
  clearLastAppliedHash,
  getLastAppliedHash,
  getTrackedSyncState,
  setLastAppliedHash,
} from "../state";
import { writeFileAtomic } from "../write";
import { syncFileToEvolu } from "./change-capture";

type EvoluDatabase = Evolu<typeof Schema>;

export const startSyncEvoluToFiles = (
  evolu: EvoluDatabase,
  watchDir: string,
): (() => void) => {
  logger.log("[loop-b] Starting...");

  const allFilesQuery = evolu.createQuery((db) =>
    db
      .selectFrom("file")
      .selectAll()
      // biome-ignore lint/suspicious/noExplicitAny: Evolu's Kysely needs runtime values
      .where("isDeleted", "is not", sqliteTrue as any),
  );

  let initialLoadComplete = false;

  evolu.loadQuery(allFilesQuery).then((rows) => {
    logger.log(`[loop-b] Initial load: ${rows.length} existing files`);
    void syncEvoluToFiles(evolu, watchDir, rows).then(() => {
      initialLoadComplete = true;
    });
  });

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  const SUBSCRIPTION_DEBOUNCE_MS = 500;

  const unsubscribe = evolu.subscribeQuery(allFilesQuery)(() => {
    if (!initialLoadComplete) {
      logger.log("[loop-b] Skipping subscription (initial load in progress)");
      return;
    }

    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

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

const syncEvoluToFiles = async (
  evolu: EvoluDatabase,
  watchDir: string,
  // biome-ignore lint/suspicious/noExplicitAny: Query rows type will be refined later
  rows: readonly any[],
): Promise<void> => {
  const rowsByPath = new Set<string>();
  for (const row of rows) {
    rowsByPath.add(row.path);
  }

  const trackedStateResult = await tryAsync(
    () => getTrackedSyncState(evolu),
    (cause): SyncLoopBError => ({
      type: "StateListReadFailed",
      cause,
    }),
  );

  if (!trackedStateResult.ok) {
    logger.error(
      "[loop-b] Failed to read sync state:",
      trackedStateResult.error,
    );
    return;
  }

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

    if (total > 50 && processed % 50 === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      logger.log(
        `[loop-b] Progress: ${processed}/${total} files (${elapsed}s)`,
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
    );

    if (!deleteResult.ok) {
      failedCount += 1;
      failedByType.set(
        deleteResult.error.type,
        (failedByType.get(deleteResult.error.type) ?? 0) + 1,
      );
      logger.error(
        `[loop-b] Failed to apply deletion for ${trackedState.path}:`,
        deleteResult.error,
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
  if (lastAppliedHash === row.contentHash) {
    return ok();
  }

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

const applyRemoteDeletionToFilesystem = async (
  evolu: EvoluDatabase,
  watchDir: string,
  path: string,
  lastAppliedHash: string,
): Promise<Result<void, SyncLoopBError>> => {
  const absolutePath = join(watchDir, path);
  const file = Bun.file(absolutePath);

  const existsResult = await tryAsync(
    () => file.exists(),
    (cause): SyncLoopBError => ({
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
      (cause): SyncLoopBError => ({
        type: "StateWriteFailed",
        path,
        cause,
      }),
    );

    return stateResult.ok ? ok() : err(stateResult.error);
  }

  const diskHashResult = await tryAsync(
    () => computeFileHash(absolutePath),
    (cause): SyncLoopBError => ({
      type: "DiskHashFailed",
      absolutePath,
      cause,
    }),
  );

  if (!diskHashResult.ok) {
    return err(diskHashResult.error);
  }

  if (diskHashResult.value !== lastAppliedHash) {
    logger.log(`[loop-b] Deletion conflict detected: ${path}`);

    const localContentResult = await tryAsync(
      () => file.text(),
      (cause): SyncLoopBError => ({
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
      (cause): SyncLoopBError => ({
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
      (cause): SyncLoopBError => ({
        type: "StateWriteFailed",
        path,
        cause,
      }),
    );

    if (!stateResult.ok) {
      return err(stateResult.error);
    }

    const conflictSyncResult = await syncFileToEvolu(
      evolu,
      watchDir,
      conflictResult.value,
    );
    if (!conflictSyncResult.ok) {
      return err({
        type: "ConflictFileCreateFailed",
        absolutePath: conflictResult.value,
        cause: conflictSyncResult.error,
      });
    }

    return ok();
  }

  const deleteResult = await tryAsync(
    () => unlink(absolutePath),
    (cause): SyncLoopBError => ({
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

  logger.log(`[loop-b] Deleted: ${path}`);

  const stateResult = trySync(
    () => clearLastAppliedHash(evolu, path),
    (cause): SyncLoopBError => ({
      type: "StateWriteFailed",
      path,
      cause,
    }),
  );

  return stateResult.ok ? ok() : err(stateResult.error);
};
