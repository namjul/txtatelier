# Delta Specs: store-files-in-shard-owner

## What behavior is being added?

File rows are now stored under a `ShardOwner` derived deterministically from `AppOwner` using
the path `["files", 1]`. The ShardOwner can be completely purged from the relay — all rows
and all history — enabling true deletion of content data. This is not possible with AppOwner.

The epoch number (`1`) is embedded in the derivation path as a handle for future rotation.
Incrementing it produces a cryptographically unrelated owner, allowing a clean slate without
data duplication.

## What behavior is changing?

All file mutations now carry an explicit `ownerId` pointing to the derived ShardOwner instead
of defaulting to AppOwner. The ShardOwner is registered with `evolu.useOwner` on startup
alongside AppOwner.

## What behavior is being removed?

File rows are no longer written to AppOwner. AppOwner is now used exclusively for sync
coordination metadata.

## What stays the same?

- The `file` table schema is unchanged. `ownerId` is a system column — no migration needed.
- File sync, reconciliation, conflict detection, and all existing query behavior are unchanged.
- Files are still identified and deduplicated by `path`, not by `ownerId`.
- Soft-delete (`isDeleted = true`) is still used for individual file deletions within an epoch.
