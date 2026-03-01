# File-Sync Center

**Status:** Strengthening
**Created:** 2026-03-01
**Last Updated:** 2026-03-01

---

## What This Center Does

Implements Loop A (Filesystem → Evolu) - watches filesystem for changes and updates Evolu database when content differs.

**Current state:** Phase 0 Loop A complete and tested. Single-device sync working.

**Implemented:**
- Custom Evolu platform layer for Bun CLI
- SQLite driver with debounced persistence (5 sec delay)
- PlatformIO abstraction for file I/O
- Schema definition for file records
- Mnemonic management (auto-generated, persisted by Evolu)
- Filesystem watching (Node.js fs.watch, debounced 100ms)
- Content hashing (Bun.hash with xxHash64)
- Evolu mutation logic (insert new files, update changed files, skip unchanged)

**Not yet implemented:**
- Loop B (Evolu → Filesystem) - Phase 1
- Multi-device replication - Phase 2
- Conflict detection - Phase 3

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

Strengthening - Loop A complete, organizing power demonstrated through coherent sync implementation

**Evidence:**
- Custom Evolu platform successfully integrated
- SQLite database persists to `~/.txtatelier/txtatelier.db`
- Mnemonic generation and owner management working
- Graceful shutdown with debounced persistence (prevents data loss)
- Loop A fully functional (filesystem → Evolu sync working)
- All three sync paths verified: insert, update, no-change
- 11 TypeScript modules (platform + schema + hash + watch + sync)
- CLI successfully starts, watches directory, syncs files, persists data

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

### 2026-03-01 - Implement Loop A (Filesystem → Evolu)

**Aim:** Watch filesystem directory for changes and sync file records to Evolu when content differs

**Claim:** Loop A with 100ms debounce, xxHash64 hashing, and Node.js fs.watch will provide reliable single-device sync without excessive CPU usage

**Changes:**
- Created `hash.ts` - Content hashing utilities using Bun.hash() (xxHash64, returns hex string)
  - `computeFileHash(filePath)` - Hash file from disk
  - `computeContentHash(content)` - Hash string content directly
- Created `watch.ts` - Filesystem watching with debounce
  - Uses Node.js `fs.watch()` with recursive option (more stable than Bun.watch)
  - 100ms debounce per file path (balances responsiveness and stability)
  - Creates watch directory if not exists
  - Returns cleanup function for graceful shutdown
- Created `sync.ts` - Evolu mutation logic
  - `syncFileToEvolu()` - Main sync function
  - Computes relative path from watch directory
  - Queries existing record by path (using branded type workaround with `as any`)
  - Inserts new record or updates if hash changed
  - Skips update if hash matches (avoids unnecessary mutations)
- Updated `index.ts` - Wire Loop A into CLI lifecycle
  - Defines `WATCH_DIR` constant (`~/.txtatelier/watched`)
  - Starts watching on startup, stops on shutdown
  - Passes `syncFileToEvolu` callback to watcher

**Design decisions:**
- **Hash algorithm:** xxHash64 via Bun.hash() (fast, non-cryptographic, sufficient for change detection)
- **Debounce:** 100ms (balances instant feedback with stability)
- **Watch API:** Node.js fs.watch() (more stable than Bun.watch for now)
- **Initial scan:** None - only watch changes (Phase 5 will add startup reconciliation)
- **File filtering:** None for Phase 0 (all files synced)
- **Type workaround:** Used `as any` casts for Kysely where clauses (Evolu's branded types incompatible with Kysely's type inference)

**Contact test:**
- Success-if: Files created/updated in watch directory sync to Evolu within 200ms, hash matches prevent unnecessary updates, CPU usage <5%
- Failure-if: Sync failures, duplicate updates, high CPU usage, or sync latency >500ms
- Evidence: Manual testing showed all three paths work (insert, update, no-change), sync feels instant, no performance issues
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

### Resolved
- ✅ Hash algorithm: xxHash64 (via Bun.hash) - fast, sufficient for change detection
- ✅ Debounce duration: 100ms - balances responsiveness and stability
- ✅ Watch strategy: Node.js fs.watch() - more stable than Bun.watch

### Outstanding
- File filtering strategy? (gitignore patterns? explicit allow/deny lists?)
- Should we add initial scan on startup? (Phase 5)
- How to handle very large files? (streaming hash computation?)
