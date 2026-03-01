# File-Sync Center

**Status:** Proposed
**Created:** 2026-03-01
**Last Updated:** 2026-03-01

---

## What This Center Does

Implements Loop A (Filesystem → Evolu) - watches filesystem for changes and updates Evolu database when content differs.

Currently: Blank canvas - no functionality implemented.

---

## Center Definition

### Hypothesis

The file-sync center will organize the core synchronization logic from filesystem to Evolu, implementing Loop A from the architecture.

**This center:**
- Watches filesystem for changes (debounced, 50-200ms)
- Computes content hashes (SHA-256 or similar)
- Updates Evolu rows when hash differs from stored value
- Respects "filesystem is canonical" principle

**Contact test for "will this become a center?"**
- Success-if: All Loop A logic lives here, other modules depend on it, removing it breaks sync
- Failure-if: Logic spreads across multiple locations, or is trivial wrapper around libraries

### Current Strength

Proposed - blank canvas only, no functionality

**Evidence:**
- None yet - awaiting Phase 0 implementation

---

## Planned Interventions

### 2026-03-01 - Create Blank Canvas

**Aim:** Establish file-sync module structure before Phase 0 implementation

**Claim:** Creating module structure now enables Phase 0 sync logic implementation

**Status:** In Progress

---

## Relationships to Other Centers

**Contained by:**
- CLI center - provides workspace and orchestration context

**Will be used by:**
- CLI commands - trigger sync operations
- evolu-sync center (Phase 1) - coordinate with Loop B

**Will use:**
- Evolu (external) - for CRDT storage and replication
- Bun file APIs - for filesystem watching and hashing

---

## Architecture Notes

### Phase 0: Loop A (Filesystem → Evolu)

```
Filesystem change detected
  ↓
Debounce (50-200ms)
  ↓
Compute content hash
  ↓
Compare with Evolu row hash
  ↓
If different: Update Evolu row
```

**Key principles:**
- Filesystem is canonical (never overwrite files)
- Deterministic (same inputs → same outputs)
- Loop prevention (check ownerId to avoid echoes)
- Atomic operations (temp-file + rename pattern)

### Future Phases

- **Phase 1:** Add Loop B (Evolu → Filesystem)
- **Phase 2:** Multi-device replication
- **Phase 3:** Conflict detection
- **Phase 4:** Deletion handling

See IMPLEMENTATION_PLAN.md for full details.

---

## Open Questions

- Which hash algorithm? (SHA-256, BLAKE3, or xxHash for speed?)
- Debounce duration? (50ms for responsiveness vs 200ms for stability)
- Watch strategy? (Bun.watch vs manual polling?)
- File filtering? (gitignore patterns? explicit allow/deny lists?)
