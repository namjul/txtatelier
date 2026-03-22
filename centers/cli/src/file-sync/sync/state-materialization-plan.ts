// Pure planning functions for state materialization (Evolu → filesystem)
// No I/O - just data transformation

import { detectConflict, generateConflictPath } from "../conflicts";
import type { SyncAction } from "./actions";
import {
  createConflict,
  log,
  setTrackedHash,
  skip,
  writeFile,
} from "./actions";
import type { MaterializationState } from "./state-types";

/**
 * Plan what actions to take when Evolu state changes.
 * Pure function - no I/O, deterministic.
 *
 * @param state - Snapshot of disk and Evolu state
 * @returns Array of actions to execute
 */
export const planStateMaterialization = (
  state: MaterializationState,
): readonly SyncAction[] => {
  // Evolu row should always have a hash for non-deleted rows.
  // Content may be null for empty files (stored as null by convention).
  const { evolHash } = state;
  if (evolHash === null) {
    return [
      log("warn", `[materialize:evolu→fs] Skipping (no hash): ${state.path}`),
      skip("invalid-evolu-state", state.path),
    ];
  }

  // Null content means empty file — treat as empty string for write operations.
  const evolContent = state.evolContent ?? "";

  // Already processed?
  if (state.lastAppliedHash === evolHash) {
    return [
      log(
        "debug",
        `[materialize:evolu→fs] Skipped (already processed): ${state.path}`,
      ),
      skip("already-processed", state.path),
    ];
  }

  // Disk matches Evolu? Just update tracking
  if (state.diskHash === evolHash) {
    return [
      log(
        "debug",
        `[materialize:evolu→fs] Skipped (disk matches): ${state.path}`,
      ),
      setTrackedHash(state.path, evolHash),
    ];
  }

  // Conflict detection
  if (detectConflict(state.diskHash, state.lastAppliedHash, evolHash)) {
    const conflictPath = generateConflictPath(state.path, state.ownerId);
    return [
      log("debug", `[materialize:evolu→fs] Conflict detected: ${state.path}`),
      createConflict(state.path, conflictPath, evolContent, state.ownerId),
      log(
        "debug",
        `[materialize:evolu→fs] Created conflict file: ${conflictPath}`,
      ),
      setTrackedHash(state.path, evolHash),
    ];
  }

  // Safe to apply
  return [
    log("debug", `[materialize:evolu→fs] Writing: ${state.path}`),
    writeFile(state.path, evolContent, evolHash),
    setTrackedHash(state.path, evolHash),
  ];
};
