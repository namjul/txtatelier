# Tasks: store-files-in-shard-owner

## Implementation

### 1. Derive and expose the files shard owner

- [x] 1.1 In `evolu.ts`, after resolving `appOwner`, call `deriveShardOwner(appOwner, ["files", 1])` and register it with `evolu.useOwner(filesShardOwner)`
- [x] 1.2 Add `filesShardOwner: ShardOwner` to the return value of `createEvoluClient`

### 2. Route file mutations to the shard owner

- [x] 2.1 In `sync/executor.ts`, pass `{ ownerId: filesShardOwner.id }` to all `evolu.insert("file", ...)` and `evolu.update("file", ...)` calls
- [x] 2.2 Verify no other call sites write to the `file` table (grep for `insert("file"` and `update("file"`)

### 3. Verify tests

- [x] 3.1 Run the full test suite and confirm no regressions
- [x] 3.2 Check whether test fixtures in `index.test.ts` need `ownerId` added to their `upsert`/`update` calls — update if needed

## Co-variance notes

- `filesOwnerId` had to be threaded through more of the call chain than anticipated:
  `executor` → `executePlan` → `change-capture` → `startup-reconciliation` (both functions)
  → `state-materialization` (three functions) → `index.ts` (OwnerSession, startFileSync return value).
- `reconcileStartupEvoluState` also calls `executePlan` (via an inner `processRow` function),
  not just `reconcileStartupFilesystemState`. Both needed the parameter.
- `startFileSync` return literal did not include `filesShardOwner` despite the type requiring it —
  caught at runtime in tests.

## Load-bearing assumptions that didn't hold

**Assumed**: "No query changes" — queries do not filter on `ownerId`.
**Actual**: Correct. Queries return rows from all active owners without change. However, test
fixtures that wrote to AppOwner (no `ownerId`) created duplicate rows visible in queries alongside
ShardOwner rows. All test mutations to the `file` table needed `{ ownerId: filesShardOwner.id }`.
