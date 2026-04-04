// State management for _syncState table
// Tracks which file hashes have been applied to the filesystem

import {
  createIdFromString,
  type Evolu,
  type Result,
  sqliteTrue,
  tryAsync,
  trySync,
} from "@evolu/common";
import type { StateMaterializationError } from "./errors";
import { createSyncStateQuery } from "./evolu-queries";
import type { FilePath, Schema } from "./evolu-schema";

type EvoluDatabase = Evolu<typeof Schema>;

/**
 * Generate deterministic sync state ID from path (pure function).
 */
export const generateStateId = (path: string): string => {
  return createIdFromString(`syncstate-${path}`);
};

/**
 * Get the last hash we applied to the filesystem for a given path.
 * Returns Result containing the hash (or null if never applied) with error handling.
 */
export const getTrackedHash = async (
  evolu: EvoluDatabase,
  path: FilePath,
): Promise<Result<string | null, StateMaterializationError>> => {
  return tryAsync(
    async () => {
      const query = createSyncStateQuery(evolu, path);
      const rows = await evolu.loadQuery(query);
      return rows[0]?.lastAppliedHash ?? null;
    },
    (cause): StateMaterializationError => ({
      type: "StateReadFailed",
      path,
      cause,
    }),
  );
};

/**
 * Record that we've applied a specific hash to the filesystem.
 * Uses upsert to automatically handle insert or update.
 * Uses deterministic ID based on path to enable stable upserts.
 * Returns a Result with standardized error handling.
 */
export const setTrackedHash = (
  evolu: EvoluDatabase,
  path: string,
  hash: string,
): Result<void, StateMaterializationError> => {
  return trySync(
    () => {
      const id = generateStateId(path);
      evolu.upsert("_syncState", {
        id,
        path,
        lastAppliedHash: hash,
      });
    },
    (cause): StateMaterializationError => ({
      type: "StateWriteFailed",
      path,
      cause,
    }),
  );
};

/**
 * Clear the state for a given path.
 * Used when files are deleted.
 * Returns a Result with standardized error handling.
 */
export const clearTrackedHash = (
  evolu: EvoluDatabase,
  path: string,
): Result<void, StateMaterializationError> => {
  return trySync(
    () => {
      const id = generateStateId(path);
      evolu.update("_syncState", {
        id,
        isDeleted: sqliteTrue,
      });
    },
    (cause): StateMaterializationError => ({
      type: "StateWriteFailed",
      path,
      cause,
    }),
  );
};
