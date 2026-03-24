# Exploration: Partial Context Sharing via Evolu Owner Types

**Date:** 2026-03-24
**Status:** Exploration complete - awaiting decision on implementation

---

## The Idea

Share a subset of files with another user. The subset is called a "partial context" and is
defined by patterns (path regex, link graph, etc.). The author retains a private full copy;
the shared context is an optional mirror. Removing the share leaves the files intact in the
private space.

Evolu's four owner types are the mechanism:

- **AppOwner** — sync coordination and long-term persistence
- **ShardOwner** — data partitioning (recommended for content)
- **SharedOwner** — collaborative write access
- **SharedReadonlyOwner** — read-only access to shared data

---

## Evolu's Ownership Model

Every row in every Evolu table has `ownerId` as part of its primary key:

```sql
PRIMARY KEY ("ownerId", "id")
```

Rows from different owners coexist in the same SQLite table, partitioned by `ownerId`. There
is no separate database per owner — one SQLite file, all owners in it.

A "partial context" cannot be a filter on top of one owner. It must be a separate owner
(a `SharedOwner`) that holds a mirrored subset of rows.

---

## The Private Side: ShardOwner, Not AppOwner

Evolu's docs explicitly state:

> "Storing all app data in AppOwner means that data will be stored/synced forever. And that's
> a problem if we want to provide real data deletion... AppOwner must be preserved because it
> coordinates deletion information across devices."

**Currently, txtatelier stores all files in AppOwner. This is what the docs say not to do.**

The recommended pattern: use `deriveShardOwner` for content data.

```ts
const filesShardOwner = deriveShardOwner(appOwner, ["files", 1])
```

`deriveShardOwner` uses SLIP-21 key derivation:

```
secret = SLIP-21(appOwner.encryptionKey, ["files", 1])
         ↓
ShardOwner {
  id:            derived, deterministic
  encryptionKey: derived, deterministic
  writeKey:      derived, deterministic
}
```

No stored secret. No separate mnemonic. On any device that has AppOwner, the same ShardOwner
is derived identically. All devices start with the same file shard immediately, before any
sync occurs.

### The Privacy Boundary

A derived ShardOwner **cannot be shared with outsiders**. The reason is not cryptographic
leakage — SLIP-21 is one-way at every step:

```
appOwner.encryptionKey
  ↓ SLIP-21(["files", 1])
shardSecret
  ↓ SLIP-21(["Evolu", "OwnerEncryptionKey"])     ↓ SLIP-21(["Evolu", "OwnerWriteKey"])
shardOwner.encryptionKey                          shardOwner.writeKey
```

Knowing `shardOwner.encryptionKey` does not reveal `shardSecret` or `appOwner.encryptionKey`.
Knowing it also does not let someone derive other shards — that requires `appOwner.encryptionKey`.

The actual problem is **revocation**.

A `SharedOwner` is created from a random secret, independent of AppOwner. Evolu supports
independent write key rotation for it. And it can be deleted entirely — a new SharedOwner
has completely unrelated keys, making any cached `encryptionKey` useless against new data.

A derived ShardOwner has none of this. Its `writeKey` is permanently derived and cannot be
rotated independently. "Revoke access" means only one thing: delete the shard and rotate
the epoch. That is a nuclear operation — it deletes ALL files for ALL users, not just the
recipient you want to revoke.

```
Sharing a derived ShardOwner, then revoking:
  → rotate to epoch 2
  → ShardOwner["files", 1] deleted from relay
  → recipient can no longer sync new data ✓
  → recipient still has the encryptionKey for epoch 1 cached
    → any data they already pulled, they can still read forever ✗
  → ALL your files gone from relay, must re-sync from filesystem ✗

Sharing a random SharedOwner, then revoking:
  → delete SharedOwner
  → recipient can no longer sync ✓
  → recipient's cached encryptionKey is useless against any new SharedOwner ✓
  → your private ShardOwner["files", 1] completely unaffected ✓
```

| | Derived ShardOwner | Random SharedOwner |
|---|---|---|
| Crypto leakage to AppOwner | None | None |
| Write key rotation | Not possible | Supported |
| Revoke access | Delete whole shard (nuclear) | Delete just this owner |
| Private data affected by revocation | Yes — all files | No |
| Designed for sharing | No | Yes |

```
Derived from AppOwner  →  private only, revocation is nuclear
Random secret          →  shareable, revocation is surgical
```

For sharing, a separate random `SharedOwner` is required.

---

## What Epoch Means

The `1` in `["files", 1]` is the epoch — a number embedded in the derivation path. Changing
it produces a cryptographically unrelated owner:

```
deriveShardOwner(appOwner, ["files", 1])  →  id_A, encKey_A, writeKey_A
deriveShardOwner(appOwner, ["files", 2])  →  id_B, encKey_B, writeKey_B
```

The relay has no idea these are related. They are two completely separate owners.

### What It Unlocks: True Deletion

In a CRDT system, individual changes cannot be deleted — the log is append-only.
`isDeleted = true` hides a row but the change record stays on the relay forever.

A ShardOwner can be completely purged from the relay — all rows, all history, gone.
Epoch rotation is the only mechanism for true deletion of content data:

```
epoch 1 in use
  → all files live in ShardOwner["files", 1]
  → user: "delete everything"
  → delete ShardOwner["files", 1] from relay  ← truly gone
  → increment epoch to 2
  → ShardOwner["files", 2] starts empty
```

### The Coordination Problem

Rotating the epoch creates a new owner, but other devices don't automatically know about it.
The solution: store the current epoch in AppOwner (its job is coordination).

```
AppOwner row: { filesEpoch: 2 }
```

Device B syncs AppOwner, reads `filesEpoch: 2`, derives `["files", 2]`, switches over.

### What the Number Costs If You Never Rotate

Nothing. `["files", 1]` vs `["files"]` — one extra element in the path, same derivation cost.
If you never rotate, epoch 1 is permanent and the coordination machinery never needs to be
built.

The `1` is a handle. Having it costs nothing. Not having it means true deletion becomes
impossible without a later migration.

---

## The Full 3-Layer Architecture

```
AppOwner  (coordinator)
│  - epoch pointer: { filesEpoch: 1 }
│  - shared context registry: { contextId, sharedOwnerId }
│  - never stores content
│  - never shared
│
├── deriveShardOwner(["files", 1])   ← ALL private files live here
│     - all file rows live here
│     - deletable from relay
│     - epoch-rotatable
│     - deterministic across devices
│
└── createSharedOwner(randomSecret)  ← optional shared context
      - mirrored subset of files
      - mnemonic shareable
      - fully deletable
      - independent of AppOwner secret
```

---

## How Sharing Works: The Mirror Model

### The Dual-Write Model

A file lives in `ShardOwner["files", 1]` (private). When shared, it is also written to a
`SharedOwner` with the same `id`:

```
ShardOwner["files", 1]        SharedOwner["work"]
┌──────────────────────┐      ┌──────────────────────┐
│ id=abc  notes.txt ✓ │ ──→  │ id=abc  notes.txt ✓  │  (mirrored)
│ id=def  journal.txt  │      │                      │  (not shared)
└──────────────────────┘      └──────────────────────┘
       source of truth              optional mirror
```

Same `id`, different `ownerId`. The private copy is the source of truth; the shared copy is
a derived mirror.

### Lifecycle

```
SHARE
  file exists in ShardOwner["files", 1]
  → insert row with same id into SharedOwner["work"]
  → evolu.useOwner(sharedOwner) to register for sync

UPDATE (while shared)
  author edits file → ShardOwner row updated
  → mirror update to SharedOwner row (same id)
  → relay propagates to recipient

UNSHARE
  soft-delete row from SharedOwner (isDeleted = true)
  → relay propagates deletion to all recipients
  → file disappears from recipient's local DB
  → ShardOwner row untouched (private copy survives)
```

### The Write Side

`ownerId` is optional on Evolu mutations. Default is AppOwner:

```ts
// Private write (default)
evolu.insert("file", { path, content, contentHash })

// Shared write (mirror)
evolu.insert("file", { path, content, contentHash }, { ownerId: sharedOwner.id })
```

Every update to a shared file must go to both owners. The system needs to know which files
are shared before every write.

---

## How Sharing Works: The Recipient Side

The author creates a `SharedOwner` from a random secret, then generates a `SharedReadonlyOwner`
to give to the recipient:

```ts
// Author
const sharedOwner = createSharedOwner(createOwnerSecret(randomBytes))
const readonlyForRecipient = createSharedReadonlyOwner(sharedOwner)
// share readonlyForRecipient (id + encryptionKey, no writeKey)
```

The recipient registers the readonly owner with their Evolu instance:

```ts
// Recipient
evolu.useOwner(sharedReadonlyOwner)  // start pulling this owner's data
```

### How It Looks on the Recipient's Side

The shared files land in the recipient's local SQLite under the shared `ownerId` — NOT in
their AppOwner. Their own files and the shared files coexist in the same table:

```
Recipient's file table:
  ownerId=recipient_shard  │ personal.txt      (theirs)
  ownerId=recipient_shard  │ journal.txt       (theirs)
  ownerId=shared_work      │ notes.txt         (from author, read-only)
  ownerId=shared_work      │ roadmap.txt       (from author, read-only)

After author unshares notes.txt:
  ownerId=recipient_shard  │ personal.txt
  ownerId=recipient_shard  │ journal.txt
  ownerId=shared_work      │ roadmap.txt
  ownerId=shared_work      │ notes.txt  isDeleted=1  ← hidden by query
```

---

## Full vs. Read-Only Access

```
SharedOwner  (full access)
├── id              → public, used to route on relay
├── encryptionKey   → can read all rows
└── writeKey        → can write new rows

SharedReadonlyOwner  (read-only)
├── id              → public
└── encryptionKey   → can read all rows
    (no writeKey)
```

Full collaborative access introduces a write-back problem: if the recipient edits the shared
copy, the author's private (ShardOwner) copy diverges. Closing that loop requires bidirectional
mirroring between two rows representing the same logical file — a convergence problem.

**Recommendation: start with read-only sharing only.** Full collaborative access is a separate,
harder problem.

---

## Pattern Types for Context Definition

What defines which files go into a shared context:

| Pattern | How it works | Risk |
|---|---|---|
| Path regex | `^work/.*` matches all files under `work/` | Structural, not semantic |
| Link graph | Files reachable via `[[path]]` from a root file | Greedy transitivity |
| Depth-limited graph | Reachable within N hops | Arbitrary cutoff |
| Explicit tag | `#share:work` in file content | Requires touching each file |

### The Greedy Transitivity Problem

Link graph reachability ≠ inclusion intent. One link to an unrelated file contaminates the
context:

```
project-alpha.txt
  → [[team.txt]]           ← intended
  → [[roadmap.txt]]        ← intended
       → [[personal-notes.txt]]  ← accidentally included
```

A depth limit reduces this but introduces an arbitrary cutoff. Explicit tagging is precise
but manual.

### Open Question: Context Boundaries

If file B is in a shared context but links to file C which isn't, the recipient has a broken
`[[C]]` link. Should contexts be "link-closed" (include all transitive dependencies)? Or are
broken links at context edges acceptable?

---

## FAQ

**Why store all data in ShardOwner and not AppOwner?**
Soft-deleted rows stay in the CRDT log forever — the relay and every synced device accumulates
them. ShardOwner can be fully purged from the relay, truly reclaiming space. AppOwner can
never be fully purged; it must be preserved for sync coordination.

**When would I use the ShardOwner mnemonic?**
Never. Derived ShardOwners have no mnemonic — they are computed from AppOwner on the fly and
never stored or entered.

**What mnemonic do I enter to open my data in the PWA?**
The AppOwner mnemonic. Everything else derives from it.

**Why have multiple ShardOwners?**
Separate deletion lifecycles. Example: `["files", 1]` for notes and `["attachments", 1]` for
binary files — you can purge all attachments without touching notes. It is also good design
even if only one epoch ever exists: it keeps concerns separate and avoids a migration later.

**Does deleting a single file touch the epoch?**
No. Single file deletion is a soft-delete on that row within the current epoch. Epoch
rotation wipes an entire shard.

**What are epochs for?**
True deletion — rotating the epoch creates a fresh owner, allowing the old one to be fully
purged from the relay. Also clean schema migration: if the data structure changes
incompatibly, a new epoch gives a clean slate without duplication from the old structure.

**Does epoch rotation require re-inserting every file?**
Yes. The new shard is a different owner with a different `ownerId`. Files must be inserted
into the new shard as new rows; there is no in-place move.

**How does epoch rotation work across devices?**

CLI: deletes the old shard from the relay, derives the new shard, writes the new epoch
number to AppOwner. Reconciliation re-syncs all files from the filesystem into the new owner.

PWA / other devices: still point to the old epoch until they sync AppOwner. During that
window, files appear gone. Once the new epoch is read from AppOwner, the device derives the
new shard and all files become visible again. No permanent data loss — just a temporary gap.

**What is a bucket?**
One bucket = one SharedOwner. The UI filters by `ownerId` to render each bucket separately.
A user can have their own AppOwner files and any number of shared buckets active simultaneously.

**How does a user access a shared bucket?**
The author puts the mnemonic in a PWA URL query parameter. The PWA reads it, derives the
`SharedReadonlyOwner`, calls `evolu.useOwner`, and the bucket appears.

**Can a user view multiple shared buckets?**
Yes. Each `evolu.useOwner` call adds another owner. Any number of shared contexts can be
active simultaneously alongside the user's own files.

**What are the two sharing models?**

- **Collaborative context**: SharedOwner created empty, shared with others, everyone writes
  to it directly. No private copy. Deleting it removes data for everyone. This is a shared
  workspace.
- **Published context**: Author's existing private files mirrored into a SharedOwner. The
  author's ShardOwner is the source of truth. Unsharing removes only the mirror; the private
  copy survives.

**Is mirroring always needed?**
Only when the author wants to retain files after ending the share — for both read-only and
writable SharedOwners. If the author is content to lose the data when the share ends, no
mirroring is needed.

**Are there alternatives to mirroring?**
No. A row's `ownerId` is immutable — the only way to have data in two owners is to write
it twice.

**What can only the CLI do?**
Epoch rotation. The CLI can re-sync all files from the filesystem into a new ShardOwner epoch.
The PWA has no filesystem access and cannot reconstruct data from disk, so it cannot rotate
epochs. The PWA can do sharing, writing, and querying.

---

## Open Questions

1. **Mirroring location**: Does the mirror logic live in the file-sync layer (aware of sharing
   state), or in a separate "sharing manager" above file-sync?

2. **Shared context metadata**: The mapping `{ contextName → sharedOwnerId }` must be stored
   durably and synced across devices. AppOwner is the right place — one small `sharedContext`
   table, no content, just owner IDs and names.

3. **Sharing state per file**: How does the write path know a file is shared? Options:
   - Nullable `sharedContextId` column on `file` (one context per file, no join)
   - Separate `fileShare` table `{ fileId, sharedOwnerId }` (multiple contexts per file)
   - Derived: check if a live row with `(ownerId=sharedOwner.id, id=fileId)` exists

4. **Epoch machinery timing**: The `1` in `["files", 1]` should be added now (zero cost).
   The rotation logic and AppOwner coordination can be built when true deletion is needed.

5. **Is epoch coordination needed immediately?** If epoch never changes, it's just a constant
   in the path. The `filesEpoch` row in AppOwner is only needed when rotation becomes a
   real feature.

6. **Sharing as a view vs. a sync primitive**: "Share this context" implies the recipient
   syncs it locally (offline access). "View this context" could be ephemeral and read-only
   (no local sync). Very different models with different complexity.
