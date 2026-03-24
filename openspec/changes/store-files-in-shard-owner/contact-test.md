# Contact Test: store-files-in-shard-owner

## Evidence tier

proximal — directly observable in the database and relay storage.

## What would success look like?

After the change:
- All `file` rows in the local SQLite have `ownerId` matching `deriveShardOwner(appOwner, ["files", 1]).id`, not `appOwner.id`.
- Deleting the ShardOwner from the relay removes all file rows. AppOwner rows remain.
- All existing file sync, reconciliation, and conflict tests pass without modification.

## What would falsify this claim?

- Any file row still written to `appOwner.id` after migration.
- Reconciliation fails to match files by path because it filters on `ownerId`.
- Queries return no rows because they implicitly filter on `appOwner.id`.

## How will we check?

Query the local SQLite directly after a sync cycle:
```sql
SELECT DISTINCT ownerId FROM file;
```
Must return exactly one value: the ShardOwner id. Run the full test suite and confirm no
regressions.

## When will we check?

Immediately after implementation — before merging.
