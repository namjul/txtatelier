// Pure planning functions for change capture (filesystem → Evolu)
// No I/O - just data transformation

import { extname } from "node:path";
import { isIgnoredRelativePath } from "../ignore";
import type { SyncAction } from "./actions";
import {
  clearTrackedHash,
  insertEvolu,
  log,
  markDeletedEvolu,
  skip,
  updateEvolu,
} from "./actions";
import type { ChangeCaptureState } from "./state-types";

export const isTxtFile = (filePath: string): boolean =>
  extname(filePath).toLowerCase() === ".txt";

/**
 * Plan what actions to take when filesystem changes.
 * Pure function - no I/O, deterministic.
 *
 * @param state - Snapshot of filesystem and Evolu state
 * @returns Array of actions to execute
 */
export const planChangeCapture = (
  state: ChangeCaptureState,
): readonly SyncAction[] => {
  // Check if path should be ignored
  if (isIgnoredRelativePath(state.path)) {
    return [skip("ignored-path", state.path)];
  }

  // Only sync .txt files. Allow deletions of previously-synced non-txt records
  // (evolId !== null) to pass through so they don't become ghost records in Evolu.
  if (!isTxtFile(state.path) && state.evolId === null) {
    return [
      log("debug", `[capture:fs→evolu] Skipping non-txt file: ${state.path}`),
      skip("not-txt-file", state.path),
    ];
  }

  // File deleted on disk
  if (state.diskHash === null) {
    if (state.evolId !== null) {
      return [
        log("debug", `[capture:fs→evolu] Deleting: ${state.path}`),
        markDeletedEvolu(state.evolId, state.path),
        clearTrackedHash(state.path),
      ];
    }
    return [skip("file-not-found", state.path)];
  }

  // At this point, diskHash and diskContent are guaranteed non-null
  const { diskHash, diskContent } = state;
  if (diskContent === null) {
    // This should never happen given the diskHash check above, but satisfy TypeScript
    return [skip("invalid-state", state.path)];
  }

  // File exists - check if changed
  if (diskHash === state.evolHash) {
    return [
      log(
        "debug",
        `[capture:fs→evolu] No change: ${state.path} (hash matches)`,
      ),
      skip("hash-matches", state.path),
    ];
  }

  // Need to sync to Evolu
  if (state.evolId !== null) {
    // Update existing record
    return [
      log("debug", `[capture:fs→evolu] Updating: ${state.path}`),
      updateEvolu(state.evolId, state.path, diskContent, diskHash),
    ];
  }

  // Insert new record
  return [
    log("debug", `[capture:fs→evolu] Inserting: ${state.path}`),
    insertEvolu(state.path, diskContent, diskHash),
  ];
};
