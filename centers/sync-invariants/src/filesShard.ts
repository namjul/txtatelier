/**
 * Canonical Evolu shard path for `file` table rows.
 * Pass to `deriveShardOwner(appOwner, FILES_SHARD)` so CLI, PWA, and relay agree on `ownerId`.
 */
export const FILES_SHARD = ["files", 1] as const;
