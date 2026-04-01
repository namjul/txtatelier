// Conflict detection and conflict file creation
// Phase 1: Basic conflict detection (hash comparison)

import { detectConflict as detectConflictFromInvariants } from "@txtatelier/sync-invariants";
import { basename, dirname, extname, join } from "node:path";
import { writeFileAtomic } from "./write";

/**
 * Re-export for callers that only need 3-way math (tests, legacy imports).
 * Prefer `classifyRemoteChange` from `@txtatelier/sync-invariants` for materialization policy.
 */
export const detectConflict = detectConflictFromInvariants;

/**
 * Action plan for creating a conflict file.
 */
export type ConflictAction = {
  readonly type: "CREATE_CONFLICT_FILE";
  readonly path: string;
  readonly content: string;
};

/**
 * Generate conflict file path (pure function).
 *
 * Conflict file format: {base}.conflict-{ownerId}-{timestamp}{ext}
 * Example: notes.conflict-abc123def456-1234567890123.md
 *
 * @param originalPath - Path to the original file
 * @param remoteOwnerId - Owner ID of the remote device
 * @param timestamp - Timestamp for uniqueness (defaults to Date.now())
 * @returns Path to the conflict file
 */
export const generateConflictPath = (
  originalPath: string,
  remoteOwnerId: string,
  timestamp: number = Date.now(),
): string => {
  const ext = extname(originalPath);
  const base = basename(originalPath, ext);
  const dir = dirname(originalPath);
  const shortOwnerId = remoteOwnerId.slice(0, 8);
  const conflictFileName = `${base}.conflict-${shortOwnerId}-${timestamp}${ext}`;
  return join(dir, conflictFileName);
};

/**
 * Plan a conflict file creation (pure function).
 *
 * @param originalPath - Path to the original file
 * @param remoteContent - Content from the remote change
 * @param remoteOwnerId - Owner ID of the remote device
 * @returns Action plan for creating conflict file
 */
export const planConflictAction = (
  originalPath: string,
  remoteContent: string,
  remoteOwnerId: string,
): ConflictAction => ({
  type: "CREATE_CONFLICT_FILE",
  path: generateConflictPath(originalPath, remoteOwnerId),
  content: remoteContent,
});

/**
 * Execute a conflict action (side effect).
 *
 * @param action - The conflict action to execute
 * @returns Path to the created conflict file
 */
export const executeConflictAction = async (
  action: ConflictAction,
): Promise<string> => {
  await writeFileAtomic(action.path, action.content);
  return action.path;
};

/**
 * Create a conflict file for a remote change that conflicts with local changes.
 *
 * @param originalPath - Path to the original file
 * @param remoteContent - Content from the remote change
 * @param remoteOwnerId - Owner ID of the remote device
 * @returns Path to the created conflict file
 */
export const createConflictFile = async (
  originalPath: string,
  remoteContent: string,
  remoteOwnerId: string,
): Promise<string> => {
  const action = planConflictAction(originalPath, remoteContent, remoteOwnerId);
  return executeConflictAction(action);
};
