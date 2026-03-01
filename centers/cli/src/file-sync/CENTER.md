# File-Sync Center

**Status:** Emerging
**Created:** 2026-03-01
**Last Updated:** 2026-03-01

---

## What This Center Does

Implements Loop A (Filesystem → Evolu) - watches filesystem for changes and updates Evolu database when content differs.

**Current state:** Platform layer implemented, Evolu integrated. Ready for Loop A implementation.

**Implemented:**
- Custom Evolu platform layer for Bun CLI
- SQLite driver with debounced persistence (5 sec delay)
- PlatformIO abstraction for file I/O
- Schema definition for file records
- Mnemonic management (auto-generated, persisted by Evolu)

**Not yet implemented:**
- Filesystem watching
- Content hashing
- Evolu mutation logic (insert/update file records)

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

Emerging - platform layer complete, organizing power starting to show

**Evidence:**
- Custom Evolu platform successfully integrated
- SQLite database persists to `~/.txtatelier/txtatelier.db`
- Mnemonic generation and owner management working
- Graceful shutdown with debounced persistence (prevents data loss)
- 8 new TypeScript modules created (platform layer + schema + client management)
- CLI successfully starts, shows mnemonic on first run, persists owner across runs

---

## Interventions

### 2026-03-01 - Create Blank Canvas

**Aim:** Establish file-sync module structure before Phase 0 implementation

**Claim:** Creating module structure now enables Phase 0 sync logic implementation

**Status:** Completed

---

### 2026-03-01 - Implement Custom Evolu Platform Layer

**Aim:** Integrate Evolu's local-first database with Bun's native SQLite, enabling file-sync to use CRDT storage

**Claim:** Custom platform layer using Bun's native SQLite will be faster and simpler than using WASM SQLite or external dependencies

**Changes:**
- Created `platform/PlatformIO.ts` - File I/O abstraction (read/write database as Uint8Array)
- Created `platform/BunSqliteDriver.ts` - SQLite driver with:
  - In-memory database + manual serialize pattern (matches Obsidian reference)
  - Debounced persistence (5 sec delay after mutations)
  - Explicit `flush()` method for graceful shutdown
  - State guards (`isDisposed`, `isFlushed`) to prevent race conditions
  - WAL mode enabled for performance
  - `safeIntegers: true` for bigint support (prevents precision loss)
- Created `platform/BunEvoluDeps.ts` - Wires up platform using `createDbWorkerForPlatform`
- Created `schema.ts` - File table schema (path, content, contentHash)
- Created `evolu.ts` - Client management with module-level caching
- Updated `index.ts` - Shows mnemonic on first run, handles graceful shutdown

**Design decisions:**
- **No mnemonic backup file** - Evolu persists owner internally, user responsible for saving mnemonic
- **Database location:** `~/.txtatelier/txtatelier.db` (standard for CLI tools)
- **No sync transport** - Phase 0 is single-device only (`transports: []`)
- **Schema:** Path max 1000 chars, content nullable, hash as NonEmptyString100

**Contact test:**
- Success-if: CLI starts successfully, generates mnemonic, persists owner across runs, database file created
- Failure-if: Errors on startup, mnemonic not shown, owner changes on restart, database not created
- Evidence: Manual testing showed all success conditions met
- Timeline: Immediate (tested 2026-03-01)

**Status:** Completed

---

## Relationships to Other Centers

**Contained by:**
- CLI center - provides workspace and orchestration context

**Will be used by:**
- CLI commands - trigger sync operations
- evolu-sync center (Phase 1) - coordinate with Loop B

**Uses:**
- Evolu `@evolu/common` - CRDT storage and replication
- Bun `bun:sqlite` - Native SQLite database (WAL mode, safeIntegers)
- Bun file APIs - For PlatformIO (atomic writes via temp-file + rename)

**Strengthened by:**
- Reference implementation from Obsidian plugin (pattern for custom platform layer)

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
