/**
 * Pure 3-way merge conflict detection.
 * @see openspec/changes/archive/2026-04-01-pwa-editor-fsm-zag-unify/CONFLICT_RULES.md — Layer 1.
 * Call only from `classifyRemoteChange` for product policy; direct use is for tests / CLI bridge during migration.
 */
export const detectConflict = (
  diskHash: string | null,
  lastAppliedHash: string | null,
  remoteHash: string,
): boolean => {
  if (diskHash === null) return false;
  if (lastAppliedHash === null) return false;
  if (remoteHash === diskHash) return false;

  const localChanged = diskHash !== lastAppliedHash;
  const remoteChanged = remoteHash !== lastAppliedHash;

  return localChanged && remoteChanged;
};
