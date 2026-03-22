// State collectors - gather filesystem and Evolu state for planning
// These functions handle I/O and return Result types

import { relative } from "node:path";
import { type Evolu, type Result, sqliteTrue, tryAsync } from "@evolu/common";
import { computeFileHash } from "../hash";
import type { Schema } from "../evolu-schema";
import { getTrackedHash } from "../state";
import type { ChangeCaptureState, MaterializationState } from "./state-types";

type EvoluDatabase = Evolu<typeof Schema>;

interface StateCollectionError {
  readonly type: "StateCollectionFailed";
  readonly path: string;
  readonly cause: unknown;
}

/**
 * Collect state for change capture planning.
 * Gathers both filesystem and Evolu state.
 *
 * @param evolu - Evolu database instance
 * @param watchDir - Watch directory (for relative paths)
 * @param absolutePath - Absolute path to file
 * @returns Result with ChangeCaptureState or error
 */
export const collectChangeCaptureState = async (
  evolu: EvoluDatabase,
  watchDir: string,
  absolutePath: string,
): Promise<Result<ChangeCaptureState, StateCollectionError>> => {
  return tryAsync(
    async (): Promise<ChangeCaptureState> => {
      const relativePath = relative(watchDir, absolutePath).replaceAll(
        "\\",
        "/",
      );

      // Check if file exists and get content
      const file = Bun.file(absolutePath);
      const exists = await file.exists();

      let diskHash: string | null = null;
      let diskContent: string | null = null;

      if (exists) {
        diskHash = await computeFileHash(absolutePath);
        diskContent = await file.text();
      }

      // Query Evolu for existing record
      const query = evolu.createQuery((db) =>
        db
          .selectFrom("file")
          .select(["id", "contentHash"])
          // biome-ignore lint/suspicious/noExplicitAny: Evolu's Kysely needs runtime values
          .where("path", "==", relativePath as any)
          // biome-ignore lint/suspicious/noExplicitAny: Evolu's Kysely needs runtime values
          .where("isDeleted", "is not", sqliteTrue as any),
      );

      const rows = await evolu.loadQuery(query);
      const existing = rows[0];

      return {
        path: relativePath,
        diskHash,
        diskContent,
        evolHash: existing?.contentHash ?? null,
        evolId: existing?.id ?? null,
      };
    },
    (cause): StateCollectionError => ({
      type: "StateCollectionFailed",
      path: relative(watchDir, absolutePath).replaceAll("\\", "/"),
      cause,
    }),
  );
};

/**
 * Collect state for materialization planning.
 * Gathers disk state and tracking info for an Evolu row.
 *
 * @param evolu - Evolu database instance
 * @param watchDir - Watch directory (for absolute paths)
 * @param row - Evolu row data (any type from query)
 * @returns Result with MaterializationState or error
 */
export const collectMaterializationState = async (
  evolu: EvoluDatabase,
  watchDir: string,
  // biome-ignore lint/suspicious/noExplicitAny: Row type from Evolu query
  row: any,
): Promise<Result<MaterializationState, StateCollectionError>> => {
  return tryAsync(
    async (): Promise<MaterializationState> => {
      const absolutePath = `${watchDir}/${row.path}`;

      // Get tracked hash
      const trackedResult = await getTrackedHash(evolu, row.path);
      const lastAppliedHash = trackedResult.ok ? trackedResult.value : null;

      // Get disk hash if file exists
      const file = Bun.file(absolutePath);
      const exists = await file.exists();

      let diskHash: string | null = null;
      if (exists) {
        diskHash = await computeFileHash(absolutePath);
      }

      return {
        path: row.path,
        diskHash,
        evolHash: row.contentHash,
        evolContent: row.content,
        lastAppliedHash,
        ownerId: row.ownerId,
      };
    },
    (cause): StateCollectionError => ({
      type: "StateCollectionFailed",
      path: row.path,
      cause,
    }),
  );
};

/**
 * Collect state for startup reconciliation (same as change capture).
 * Alias for clarity in startup context.
 */
export const collectStartupReconciliationState = collectChangeCaptureState;
