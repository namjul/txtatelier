# Gesture: store-files-in-shard-owner

## Gesture type

strengthen

## What are we gesturing toward?

The ownership layer of file storage — specifically, which Evolu owner holds the `file` table
rows. This shapes deletion semantics, relay storage growth, and future epoch rotation.

## Claim

Routing all file mutations to `deriveShardOwner(appOwner, ["files", 1])` instead of AppOwner
will make true deletion of content data possible and prevent indefinite accumulation of
soft-deleted rows on the relay.

## What made us do this?

Evolu's documentation explicitly states AppOwner data is stored forever and cannot be truly
deleted. The exploration of partial context sharing surfaced that ShardOwner is the
recommended storage location for all content data. The current design contradicts this and
forecloses epoch rotation without a migration if left unchanged.

## What are our load-bearing assumptions?

- Evolu queries return rows from all active `useOwner` owners — no per-owner filter needed
  in existing query code.
- `deriveShardOwner` is available synchronously from `appOwner` before any file mutations
  occur, so no async gap is introduced in the write path.
- Startup reconciliation identifies files by `path`, not `ownerId` — moving rows to a new
  owner does not break reconciliation logic.

## Spec files this gesture touches

- `specs/file-storage/spec.md` — new capability: file ownership and deletion semantics

## Co-variance: what else might this touch?

- `evolu.ts` — shard owner derivation and `useOwner` registration
- `evolu-schema.ts` — no schema change needed; `ownerId` is a system column
- All file mutations — must pass `{ ownerId: filesShardOwner.id }` explicitly
- Startup reconciliation — verify it handles the new `ownerId` without change
