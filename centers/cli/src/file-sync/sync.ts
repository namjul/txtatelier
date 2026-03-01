// Evolu sync logic - insert/update file records when content changes

import { relative } from "node:path";
import { type Evolu, sqliteTrue } from "@evolu/common";
import { computeFileHash } from "./hash";
import type { Schema } from "./schema";

type EvoluDatabase = Evolu<typeof Schema>;

export const syncFileToEvolu = async (
  evolu: EvoluDatabase,
  watchDir: string,
  absolutePath: string,
): Promise<void> => {
  try {
    // Compute relative path (relative to watch directory)
    const relativePath = relative(watchDir, absolutePath);

    // Read file content
    const file = Bun.file(absolutePath);
    const exists = await file.exists();

    if (!exists) {
      console.log(
        `[sync] File deleted: ${relativePath} (TODO: handle deletion in Phase 4)`,
      );
      return;
    }

    // Read content
    const content = await file.text();
    const contentHash = await computeFileHash(absolutePath);

    // Query existing record by path
    // Note: Kysely (used by Evolu) requires type coercion for branded types
    const existingQuery = evolu.createQuery((db) =>
      db
        .selectFrom("file")
        .select(["id", "contentHash"])
        // biome-ignore lint/suspicious/noExplicitAny: Evolu's Kysely needs runtime values
        .where("path", "==", relativePath as any)
        // biome-ignore lint/suspicious/noExplicitAny: Evolu's Kysely needs runtime values
        .where("isDeleted", "is not", sqliteTrue as any),
    );

    const existing = await evolu.loadQuery(existingQuery);

    if (existing.length > 0) {
      // File exists in Evolu - check if hash changed
      const existingRecord = existing[0];

      if (!existingRecord) {
        console.error(`[sync] Unexpected: record undefined after length check`);
        return;
      }

      if (existingRecord.contentHash === contentHash) {
        console.log(`[sync] No change: ${relativePath} (hash matches)`);
        return;
      }

      // Hash different - update
      console.log(`[sync] Updating: ${relativePath}`);
      evolu.update("file", {
        id: existingRecord.id,
        path: relativePath,
        content: content || null,
        contentHash,
      });
    } else {
      // New file - insert
      console.log(`[sync] Inserting: ${relativePath}`);
      evolu.insert("file", {
        path: relativePath,
        content: content || null,
        contentHash,
      });
    }
  } catch (error) {
    console.error(`[sync] Failed to sync ${absolutePath}:`, error);
  }
};
