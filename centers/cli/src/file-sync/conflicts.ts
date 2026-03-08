// Conflict detection and conflict file creation
// Phase 1: Basic conflict detection (hash comparison)

import { basename, dirname, extname, join } from "node:path";
import { writeFileAtomic } from "./write";

/**
 * Detect if there's a conflict between disk state and remote change.
 *
 * Implements 3-way merge conflict detection:
 * - BASE   = lastAppliedHash (what we last wrote to disk)
 * - LOCAL  = diskHash (current disk state, possibly user-edited)
 * - REMOTE = remoteHash (incoming change from another device)
 *
 * Conflict occurs when BOTH local and remote changed from the common base:
 * 1. File exists on disk (diskHash is not null)
 * 2. We have a base to compare against (lastAppliedHash is not null)
 * 3. User modified the file locally (diskHash !== lastAppliedHash)
 * 4. Remote also changed from base (remoteHash !== lastAppliedHash)
 *
 * This aligns with standard 3-way merge semantics used by Git, Mercurial, etc.
 *
 * @param diskHash - Current hash of file on disk (null if doesn't exist)
 * @param lastAppliedHash - Last hash we applied to disk, the common base (null if never applied)
 * @param remoteHash - Hash from Evolu (remote change)
 * @returns true if conflict detected, false otherwise
 */
export const detectConflict = (
  diskHash: string | null,
  lastAppliedHash: string | null,
  remoteHash: string,
): boolean => {
  // No conflict if file doesn't exist on disk
  if (diskHash === null) return false;

  // No conflict if we never applied anything (new file, no common base)
  if (lastAppliedHash === null) return false;

  // Optimization: If remote matches disk, no conflict regardless of base
  // (Both sides converged to same value, or remote has no real change)
  if (remoteHash === diskHash) return false;

  // 3-way merge conflict detection:
  // Conflict exists when BOTH local and remote diverged from the base
  const localChanged = diskHash !== lastAppliedHash;
  const remoteChanged = remoteHash !== lastAppliedHash;

  return localChanged && remoteChanged;
};

/**
 * Create a conflict file for a remote change that conflicts with local changes.
 *
 * Conflict file format: {base}.conflict-{ownerId}-{timestamp}{ext}
 * Example: notes.conflict-abc123def456-1234567890123.md
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
  const ext = extname(originalPath);
  const base = basename(originalPath, ext);
  const dir = dirname(originalPath);
  const timestamp = Date.now();

  // Shorten ownerId for readability (first 8 chars)
  const shortOwnerId = remoteOwnerId.slice(0, 8);

  const conflictFileName = `${base}.conflict-${shortOwnerId}-${timestamp}${ext}`;
  const conflictPath = join(dir, conflictFileName);

  await writeFileAtomic(conflictPath, remoteContent);

  return conflictPath;
};
