# Explore: store-files-in-shard-owner

## What we are noticing

All file rows are written to `AppOwner`. Evolu's own documentation explicitly warns against
this: AppOwner data is stored and synced forever, and cannot be truly deleted from the relay.
Soft-deleted rows accumulate in the CRDT log on the relay and every synced device indefinitely.

## What we don't understand

- How much log accumulation is occurring in practice — but it doesn't matter, the structural
  problem exists regardless of current volume.
- Whether the existing startup reconciliation logic needs to change when files move to a
  different `ownerId`.

## What we want to poke at

- Where in the codebase `ownerId` is currently set on file mutations (explicitly or by
  default).
- Whether Evolu queries return rows from all active owners or must be filtered by `ownerId`.

## What would make this worth a full intervention

Already clear. Evolu recommends ShardOwner for content data. The current design contradicts
that recommendation and forecloses true deletion permanently unless we migrate now.
