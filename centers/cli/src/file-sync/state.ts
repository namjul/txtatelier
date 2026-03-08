// State management for _syncState table
// Tracks which file hashes have been applied to the filesystem

import {
  createIdFromString,
  type Evolu,
  type Result,
  sqliteTrue,
  trySync,
} from "@evolu/common";
import type { StateMaterializationError } from "./errors";
import type { Schema } from "./schema";

type EvoluDatabase = Evolu<typeof Schema>;

/**
 * Get the last hash we applied to the filesystem for a given path.
 * Returns null if we've never applied anything for this path.
 */
export const getLastAppliedHash = async (
  evolu: EvoluDatabase,
  path: string,
): Promise<string | null> => {
  const query = evolu.createQuery((db) =>
    db
      .selectFrom("_syncState")
      .select(["lastAppliedHash"])
      // biome-ignore lint/suspicious/noExplicitAny: Evolu's Kysely needs runtime values
      .where("path", "==", path as any),
  );

  const rows = await evolu.loadQuery(query);
  return rows[0]?.lastAppliedHash ?? null;
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
      const id = createIdFromString(`syncstate-${path}`);
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
      const id = createIdFromString(`syncstate-${path}`);
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
