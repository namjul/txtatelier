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
  setTrackedHash,
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
    // Update existing record.
    // setTrackedHash records diskHash as the last hash we applied to _syncState.
    // This is necessary so that on the next startup, reconcileStartupEvoluState
    // (evolu→fs) sees lastAppliedHash === evolHash and skips re-writing the file —
    // preventing it from overwriting any offline disk changes the user made while
    // the CLI was not running. Without this, _syncState would only be written by
    // the state materialization debounce (500ms), creating a race on shutdown.
    return [
      log("debug", `[capture:fs→evolu] Updating: ${state.path}`),
      updateEvolu(state.evolId, state.path, diskContent, diskHash),
      setTrackedHash(state.path, diskHash),
    ];
  }

  // Insert new record.
  // Same reasoning as the update branch above: record diskHash in _syncState
  // immediately so the next startup knows this version is already on disk.
  return [
    log("debug", `[capture:fs→evolu] Inserting: ${state.path}`),
    insertEvolu(state.path, diskContent, diskHash),
    setTrackedHash(state.path, diskHash),
  ];
};
