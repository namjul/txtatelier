// State management for _syncState table
// Tracks which file hashes have been applied to the filesystem

import { createIdFromString, type Evolu, sqliteTrue } from "@evolu/common";
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
 */
export const setLastAppliedHash = (
  evolu: EvoluDatabase,
  path: string,
  hash: string,
): void => {
  // Create deterministic ID from path so we can upsert
  const id = createIdFromString(`syncstate-${path}`);

  evolu.upsert("_syncState", {
    id,
    path,
    lastAppliedHash: hash,
  });
};

/**
 * Clear the state for a given path.
 * Used when files are deleted.
 */
export const clearLastAppliedHash = (
  evolu: EvoluDatabase,
  path: string,
): void => {
  // Create deterministic ID from path (same as setLastAppliedHash)
  const id = createIdFromString(`syncstate-${path}`);

  evolu.update("_syncState", {
    id,
    isDeleted: sqliteTrue,
  });
};

export interface SyncStateEntry {
  readonly path: string;
  readonly lastAppliedHash: string;
}

export const getTrackedSyncState = async (
  evolu: EvoluDatabase,
): Promise<ReadonlyArray<SyncStateEntry>> => {
  // "Tracked sync state" = paths that Loop B has previously applied to disk,
  // together with the last applied hash. This is the local memory used to
  // decide whether a missing remote row should delete safely or create a
  // conflict file because local content diverged.
  const query = evolu.createQuery((db) =>
    db
      .selectFrom("_syncState")
      .select(["path", "lastAppliedHash"])
      // biome-ignore lint/suspicious/noExplicitAny: Evolu's Kysely needs runtime values
      .where("isDeleted", "is not", sqliteTrue as any),
  );

  const rows = await evolu.loadQuery(query);
  return rows.flatMap((row) => {
    if (row.path === null || row.lastAppliedHash === null) {
      return [];
    }

    return [
      {
        path: row.path,
        lastAppliedHash: row.lastAppliedHash,
      },
    ];
  });
};
