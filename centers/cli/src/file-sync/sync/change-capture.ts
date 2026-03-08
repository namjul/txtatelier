import { stat } from "node:fs/promises";
import { relative } from "node:path";
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
import type { ChangeCaptureError } from "../errors";
import { computeFileHash } from "../hash";
import { isIgnoredRelativePath } from "../ignore";
import type { Schema } from "../schema";
import { clearLastAppliedHash } from "../state";

type EvoluDatabase = Evolu<typeof Schema>;

export const captureChange = async (
  evolu: EvoluDatabase,
  watchDir: string,
  absolutePath: string,
): Promise<Result<void, ChangeCaptureError>> => {
  const relativePath = relative(watchDir, absolutePath).replaceAll("\\", "/");

  if (
    relativePath === "" ||
    relativePath === "." ||
    relativePath.startsWith("../")
  ) {
    return ok();
  }

  if (isIgnoredRelativePath(relativePath)) {
    return ok();
  }

  const statResult = await tryAsync(
    () => stat(absolutePath),
    (cause): ChangeCaptureError => ({
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
        `[capture] Failed to stat ${absolutePath}:`,
        statResult.error,
      );
      return err(statResult.error);
    }
  }

  const file = Bun.file(absolutePath);
  const existsResult = fileExists
    ? ok(true)
    : await tryAsync(
        () => file.exists(),
        (cause): ChangeCaptureError => ({
          type: "FileReadFailed",
          absolutePath,
          cause,
        }),
      );

  if (!existsResult.ok) {
    logger.error(
      `[capture] Failed to check existence for ${absolutePath}:`,
      existsResult.error,
    );
    return err(existsResult.error);
  }

  if (!existsResult.value) {
    const existingQuery = evolu.createQuery((db) =>
      db
        .selectFrom("file")
        .select(["id"])
        // biome-ignore lint/suspicious/noExplicitAny: Evolu's Kysely needs runtime values
        .where("path", "==", relativePath as any)
        // biome-ignore lint/suspicious/noExplicitAny: Evolu's Kysely needs runtime values
        .where("isDeleted", "is not", sqliteTrue as any),
    );

    const existingResult = await tryAsync(
      () => evolu.loadQuery(existingQuery),
      (cause): ChangeCaptureError => ({
        type: "EvoluQueryFailed",
        relativePath,
        cause,
      }),
    );

    if (!existingResult.ok) {
      logger.error(
        `[capture] Failed to query deleted path ${relativePath}:`,
        existingResult.error,
      );
      return err(existingResult.error);
    }

    if (existingResult.value.length === 0) {
      return ok();
    }

    logger.log(`[capture] Deleting: ${relativePath}`);
    const deleteResult = trySync(
      () => {
        for (const row of existingResult.value) {
          evolu.update("file", {
            id: row.id,
            isDeleted: sqliteTrue,
          });
        }
        clearLastAppliedHash(evolu, relativePath);
      },
      (cause): ChangeCaptureError => ({
        type: "EvoluMutationFailed",
        relativePath,
        cause,
      }),
    );

    if (!deleteResult.ok) {
      logger.error(
        `[capture] Failed to mark ${relativePath} as deleted:`,
        deleteResult.error,
      );
      return err(deleteResult.error);
    }

    return ok();
  }

  const contentResult = await tryAsync(
    () => file.text(),
    (cause): ChangeCaptureError => ({
      type: "FileReadFailed",
      absolutePath,
      cause,
    }),
  );
  if (!contentResult.ok) {
    logger.error(
      `[capture] Failed to read ${absolutePath}:`,
      contentResult.error,
    );
    return err(contentResult.error);
  }

  const contentHashResult = await tryAsync(
    () => computeFileHash(absolutePath),
    (cause): ChangeCaptureError => ({
      type: "FileHashFailed",
      absolutePath,
      cause,
    }),
  );
  if (!contentHashResult.ok) {
    logger.error(
      `[capture] Failed to hash ${absolutePath}:`,
      contentHashResult.error,
    );
    return err(contentHashResult.error);
  }

  const content = contentResult.value;
  const contentHash = contentHashResult.value;

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
    (cause): ChangeCaptureError => ({
      type: "EvoluQueryFailed",
      relativePath,
      cause,
    }),
  );

  if (!existingResult.ok) {
    logger.error(
      `[capture] Failed to query ${relativePath}:`,
      existingResult.error,
    );
    return err(existingResult.error);
  }

  const existing = existingResult.value;

  const mutationResult = trySync(
    () => {
      if (existing.length > 0) {
        const existingRecord = existing[0];

        if (!existingRecord) {
          logger.error(
            `[capture] Unexpected: record undefined after length check`,
          );
          return;
        }

        if (existingRecord.contentHash === contentHash) {
          logger.log(`[capture] No change: ${relativePath} (hash matches)`);
          return;
        }

        logger.log(`[capture] Updating: ${relativePath}`);
        evolu.update("file", {
          id: existingRecord.id,
          path: relativePath,
          content: content || null,
          contentHash,
        });
      } else {
        logger.log(`[capture] Inserting: ${relativePath}`);
        evolu.insert("file", {
          path: relativePath,
          content: content || null,
          contentHash,
        });
      }

      // Do NOT set lastAppliedHash here - capture reads FROM disk, doesn't write TO disk
      // Only materialize loop should set lastAppliedHash (when it writes to disk)
    },
    (cause): ChangeCaptureError => ({
      type: "EvoluMutationFailed",
      relativePath,
      cause,
    }),
  );

  if (!mutationResult.ok) {
    logger.error(
      `[capture] Failed to mutate ${relativePath}:`,
      mutationResult.error,
    );
    return err(mutationResult.error);
  }

  return ok();
};
