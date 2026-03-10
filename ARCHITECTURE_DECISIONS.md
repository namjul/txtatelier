# Architecture Decisions

This document records key architectural decisions for txtatelier, including research findings, trade-offs, and rationales.

---

## AD-001: Evolu Owner Model Selection

**Date:** 2026-03-10
**Status:** Decided - Start with AppOwner, migrate to ShardOwner later
**Context:** Phase 0-2 implementation

### Background

Evolu provides four owner types for different use cases:

1. **AppOwner** - Application root identity
   - Purpose: Sync coordination and long-term persistence
   - Lifecycle: Must never be deleted (coordinates deletion of other owners)
   - Privacy: Never share except OwnerId (for relay authorization)
   - Best practice: Store only coordination metadata, not application data

2. **ShardOwner** - Data partitioning
   - Purpose: Recommended storage for most application data
   - Lifecycle: Can be completely deleted (relays + devices)
   - Creation: Random or derived deterministically from AppOwner
   - Use case: Enables true data deletion and lifecycle management

3. **SharedOwner** - Collaborative write access
   - Purpose: Multiple users write to same dataset
   - Sharing: Give full owner (including writeKey) to collaborators

4. **SharedReadonlyOwner** - Read-only sharing
   - Purpose: Share data without write permissions
   - Contains: Only OwnerId + OwnerEncryptionKey (no writeKey)

### Key Ownership Properties

**Immutability:**
- Row's `ownerId` never changes after creation
- Only creating device/identity owns the row

**Encryption:**
- Every row encrypted with its owner's `OwnerEncryptionKey`
- Cannot read data without corresponding encryption key
- No "public rows" concept in Evolu

**Deletion Semantics:**
- **Soft delete**: Individual changes can only be marked deleted (needed for sync)
- **Hard delete**: Entire owners can be completely removed (data truly freed)

### Research: obsidian-local-sync Analysis

Analyzed [elcomtik/obsidian-local-sync](https://github.com/elcomtik/obsidian-local-sync) to understand real-world Evolu usage:

**Owner Strategy:**
- Uses AppOwner only (single owner model)
- All file content and Yjs CRDT states stored in AppOwner
- No use of ShardOwner, SharedOwner, or ReadonlyOwner

**Sync Architecture:**
- CRDT-based automatic merging via Yjs
- Poll-based sync (1000ms interval)
- No explicit conflict files (concurrent edits merged automatically)

**Trade-offs:**
- ❌ Cannot truly delete old file versions
- ❌ Data syncs forever (soft deletes only)
- ❌ No storage reclamation
- ❌ No data lifecycle management
- ✅ Simpler implementation
- ✅ Automatic conflict resolution

### Decision: Phased Approach

**Phase 0-2: AppOwner Only**

Store all file content in AppOwner for initial implementation:

```typescript
const appOwner = createAppOwner(mnemonicToOwnerSecret(mnemonic));
// All files stored directly in AppOwner tables
```

**Rationale:**
- Simplicity for MVP (prove sync works)
- Matches existing Evolu examples and obsidian-local-sync
- Deletion capability not critical for early phases
- Can migrate later without breaking existing deployments

**Phase 5+: Migrate to ShardOwner-per-Epoch**

After stability is proven, implement epoch-based sharding:

```typescript
// AppOwner stores file index/metadata only
const appOwner = createAppOwner(mnemonicToOwnerSecret(mnemonic));

// Monthly/quarterly shards for actual file content
const shard202603 = deriveShardOwner(appOwner, ["shard", "2026-03"]);
const shard202604 = deriveShardOwner(appOwner, ["shard", "2026-04"]);

// After N months: migrate active files to new shard, delete old shard
```

**Benefits of epoch sharding:**
- True deletion capability (archive old data)
- Moderate complexity (simpler than per-file sharding)
- Efficient sync (partition by time)
- Clean data lifecycle management

**Alternative considered: ShardOwner per file**
- Rejected due to management overhead (many owners)
- Each file would need its own derived ShardOwner
- Adds complexity without clear benefit over epoch approach

### Implications

**For Phase 0-2:**
- Deleted files are soft-deleted only
- Old versions accumulate in AppOwner
- Storage grows monotonically
- Simple conflict detection (hash-based, explicit conflict files)

**For Phase 5+ migration:**
- Requires migration logic to move data between shards
- AppOwner maintains index of which shard contains which files
- Old shards can be archived/deleted after migration window
- Users gain storage reclamation capability

**For multi-device same user:**
- Same mnemonic on all devices = same AppOwner
- All devices see all rows after sync
- Use `row.ownerId === myAppOwner.id` to detect echo loops

**For collaboration (future):**
- Different users = different AppOwners = cannot share in Evolu
- Would require external sharing mechanism or SharedOwner implementation
- Not in scope for current phases

### Open Questions

1. When should epoch rotation occur? (monthly/quarterly/on-demand)
2. Should users manually trigger shard migration or auto-migrate?
3. What retention policy for old shards? (delete after N months, keep forever, user choice)
4. Should we support per-file ShardOwners for special cases (large files, sensitive data)?

### References

- Evolu Owner types: `@evolu/common/src/local-first/Owner.ts`
- obsidian-local-sync: https://github.com/elcomtik/obsidian-local-sync
- Evolu documentation: https://www.evolu.dev/docs/advanced/owners
- IMPLEMENTATION_PLAN.md phases 0-2 (AppOwner), phases 5+ (consider sharding)

---

## Future Decisions

Additional architectural decisions will be recorded here as the project evolves.

**Potential topics:**
- Conflict resolution strategy refinements
- PWA offline-first architecture
- CLI deployment model (daemon vs one-shot)
- Database schema versioning approach
- Observability and debugging patterns
