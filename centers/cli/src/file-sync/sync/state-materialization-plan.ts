// Pure planning functions for state materialization (Evolu → filesystem)
// No I/O - just data transformation

import { classifyRemoteChange } from "@txtatelier/sync-invariants";
import { generateConflictPath } from "../conflicts";
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
  const { diskHash, lastAppliedHash } = state;

  const evoluMatchesLastApplied =
    lastAppliedHash != null && lastAppliedHash === evolHash;

  const diskStillMatchesLastApply =
    diskHash != null &&
    lastAppliedHash != null &&
    diskHash === lastAppliedHash;

  // Nothing new in Evolu vs tracking, and disk still shows that version — no write.
  if (evoluMatchesLastApplied && diskStillMatchesLastApply) {
    return [
      log(
        "debug",
        `[materialize:evolu→fs] Skipped (already processed): ${state.path}`,
      ),
      skip("already-processed", state.path),
    ];
  }

  if (diskHash === evolHash) {
    return [
      log(
        "debug",
        `[materialize:evolu→fs] Skipped (disk matches): ${state.path}`,
      ),
      setTrackedHash(state.path, evolHash),
    ];
  }

  // Layer 2 classification: `remote_behind` covers disk diverged while Evolu still matches
  // lastApplied; `true_divergence` covers 3-way fork. See centers/sync-invariants + CONFLICT_RULES.md.
  const remoteClass = classifyRemoteChange({
    diskHash,
    lastAppliedHash,
    remoteHash: evolHash,
    lastPersistedHash: null,
  });

  if (remoteClass === "true_divergence" || remoteClass === "remote_behind") {
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
