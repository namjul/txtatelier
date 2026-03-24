# Design: store-files-in-shard-owner

## Approach

In `evolu.ts`, after obtaining `appOwner`, derive the files shard:

```ts
const filesShardOwner = deriveShardOwner(appOwner, ["files", 1])
evolu.useOwner(filesShardOwner)
```

Expose `filesShardOwner` from `createEvoluClient` alongside `owner` and `flush`. All call
sites that insert or update `file` rows pass `{ ownerId: filesShardOwner.id }` as the
mutation options argument.

No schema changes. No query changes. No reconciliation changes.

## Why this approach?

The change is entirely in the write path. `ownerId` is a system column already present on
every row — no migration of the schema is needed. Existing queries do not filter on `ownerId`
(Evolu returns rows from all active owners), so they continue to work without modification.
Reconciliation identifies files by `path`, not `ownerId`, so it is unaffected.

The derivation path `["files", 1]` is chosen over `["files"]` to embed an epoch handle at
zero cost. The coordination machinery for epoch rotation is explicitly out of scope for this
change.

## What are our load-bearing assumptions about the approach?

- Evolu queries return rows from all active `useOwner` owners without needing an `ownerId`
  filter — confirmed by examining the query layer.
- `deriveShardOwner` is synchronous and available immediately after `appOwner` is resolved,
  introducing no async gap in the startup path.
- Reconciliation matches files by `path` only — the `ownerId` on existing AppOwner rows in
  a pre-migration local DB does not cause duplicate entries or conflicts.

## Risks and trade-offs

- **Existing local databases**: devices that have already synced files under AppOwner will
  have rows with `ownerId = appOwner.id`. After this change, new writes go to the ShardOwner.
  Reconciliation will treat the old AppOwner rows as stale state and eventually soft-delete
  them (or they simply coexist until the DB is reset). Since the system is currently
  pre-production, this is acceptable.
- **No epoch rotation logic**: the `1` is a permanent constant until epoch machinery is built.
  This is intentional — the handle exists, the machinery does not need to exist yet.

## What we are not doing

- Epoch rotation machinery (reading/writing `filesEpoch` in AppOwner, coordinating across
  devices).
- Migrating existing AppOwner file rows to the new ShardOwner.
- Any changes to query filtering, reconciliation, or conflict detection.
- Any changes to the `_syncState` or `_historyCursor` local-only tables — these remain in
  AppOwner (local-only tables are not synced regardless of `ownerId`).

## Known unknowns

- Whether any existing test fixtures construct Evolu state that will break when `ownerId`
  changes. To be checked during implementation.

## Co-variance: what else might this touch?

- `evolu.ts` — derivation and `useOwner` call, plus exposing `filesShardOwner`
- `file-sync/index.ts` and any other entry points that call file mutations — need the
  `ownerId` option threaded through

## Design warnings

### Responsiveness

No change. Write latency is identical — ShardOwner mutations are processed the same way as
AppOwner mutations.

### Continuity after correction

No change. Files are still identified by `path`. A user renaming or editing a file lands in
the same place they expect.

### Exploratory capacity

No change visible to users. This is purely an internal ownership boundary.
