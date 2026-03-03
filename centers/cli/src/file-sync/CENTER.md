# File-Sync Center

**Status:** Strong
**Created:** 2026-03-01
**Last Updated:** 2026-03-03

---

## What This Center Does

Implements bidirectional sync between filesystem and Evolu CRDT database.

**Current state:** Phase 0 + Phase 1 + Phase 2 complete. Multi-device sync working via Evolu relay.

**Implemented:**
- **Phase 0 (Loop A: Filesystem → Evolu)**
  - Custom Evolu platform layer for Bun CLI
  - SQLite driver with debounced persistence (5 sec delay)
  - PlatformIO abstraction for file I/O
  - Schema definition for file records
  - Mnemonic management (auto-generated, persisted by Evolu)
  - Mnemonic restore via TXTATELIER_MNEMONIC env var
  - Filesystem watching (Node.js fs.watch, debounced 100ms)
  - Content hashing (Bun.hash with xxHash64)
  - Evolu mutation logic (insert new files, update changed files, skip unchanged)
  - Concurrency control (max 10 parallel file operations)

- **Phase 1 (Loop B: Evolu → Filesystem)**
  - Local-only `_syncState` table for tracking applied hashes
  - Evolu subscriptions for real-time sync (500ms debounce)
  - Atomic file writes (temp + rename pattern)
  - Basic conflict detection (hash comparison)
  - Conflict file creation (`.conflict-{ownerId}-{timestamp}`)
  - Echo prevention (lastAppliedHash-based, not ownerId)
  - Performance optimizations (early-exit on hash match, batch progress logging)

- **Phase 2 (Multi-device sync)**
  - WebSocket transport via wss://free.evoluhq.com relay
  - BigInt compatibility fix (disabled safeIntegers for Evolu)
  - Same-mnemonic sync (devices sharing mnemonic sync automatically)
  - WebSocket event logging (debug connectivity)
  - Two-stage mnemonic restore flow

**Not yet implemented:**
- Deletion handling - Phase 4
- Startup reconciliation - Phase 5

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

Strong - Bidirectional sync complete, organizing power fully demonstrated

**Evidence:**
- Custom Evolu platform successfully integrated
- SQLite database persists to `~/.txtatelier/txtatelier.db`
- Local-only `_syncState` table working (Evolu's underscore convention)
- Mnemonic generation and owner management working
- Graceful shutdown with debounced persistence (prevents data loss)
- **Loop A fully functional:** Filesystem → Evolu sync working (insert, update, no-change)
- **Loop B fully functional:** Evolu → Filesystem sync working (processes existing rows, subscribes to changes)
- Conflict detection ready (basic hash comparison)
- Atomic writes prevent partial file content
- Echo prevention works (lastAppliedHash-based, supports same-mnemonic multi-device)
- Multi-device sync functional (tested with two CLIs via Evolu relay)
- Mnemonic restore working (env var + two-stage flow)
- Performance optimizations (concurrency control, debouncing, early-exit checks)
- 13 TypeScript modules (platform + schema + hash + watch + sync + state + write + conflicts)
- CLI successfully starts both loops, syncs bidirectionally across devices, persists data

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

### 2026-03-01 - Implement Loop B (Evolu → Filesystem)

**Aim:** Enable Evolu changes to apply back to filesystem with conflict detection

**Claim:** Loop B using Evolu subscriptions + `_syncState` local-only table will enable bidirectional sync with conflict safety

**Changes:**
- Added `_syncState` table to schema (local-only, underscore prefix prevents sync)
  - Tracks `lastAppliedHash` per file path
  - Uses deterministic IDs for stable upserts
- Created `state.ts` - State management for `_syncState` operations
  - `getLastAppliedHash()`, `setLastAppliedHash()`, `clearLastAppliedHash()`
- Created `write.ts` - Atomic file writes using temp-file + rename pattern
  - Prevents partial writes, filesystem watch storms
- Created `conflicts.ts` - Conflict detection and file creation
  - `detectConflict()` - Compares disk hash, last applied hash, remote hash
  - `createConflictFile()` - Creates `.conflict-{ownerId}-{timestamp}` files
- Updated `sync.ts` - Added Loop B alongside Loop A
  - `startSyncEvoluToFiles()` - Subscription setup, returns cleanup function
  - `syncEvoluToFiles()` - Batch processor
  - `syncEvoluRowToFile()` - Single file application with conflict detection
  - Loop A now calls `setLastAppliedHash()` after mutations
- Updated `index.ts` - Wire Loop B into lifecycle
  - Start Loop B after Loop A
  - Stop Loop B before Loop A on shutdown
- Updated `watch.ts` - Ignore `.tmp-` files to prevent watch storms

**Design decisions:**
- **Local-only state:** Uses Evolu's `_` prefix convention for non-synced table
- **Subscription model:** `loadQuery` for initial rows, `subscribeQuery` for changes
- **Echo prevention:** Skip rows where `ownerId === myOwnerId`
- **Conflict format:** `{base}.conflict-{shortOwnerId}-{timestamp}{ext}`
- **Atomic writes:** Temp file with random suffix + rename

**Contact test:**
- Success-if: Existing Evolu rows (different ownerId) apply to filesystem on startup, subscription fires on Evolu mutations, conflicts create separate files, no echo loops, atomic writes prevent partial content
- Failure-if: Files not created from Evolu data, echo loops occur, conflicts silently overwrite, partial writes visible
- Evidence: Manual testing 2026-03-01. Verified: (1) Loop B processes existing rows on startup, (2) Skips own ownerId correctly, (3) Atomic writes work, (4) Conflict detection logic tested in isolation, (5) Temp files ignored by watcher
- Timeline: Immediate (tested same day)

**Status:** Completed

---

### 2026-03-02 - Enable Phase 2 Multi-Device Sync

**Aim:** Enable real-time sync between multiple devices through Evolu relay

**Claim:** Configuring Evolu transports with WebSocket relay will enable automatic multi-device sync without manual database sharing

**Changes:**
- Configured Evolu transports with `wss://free.evoluhq.com` relay
- Updated test-multi-device-sync.fish to test real sync instead of manual DB copy
- Each device maintains separate database, syncs via relay

**Contact test:**
- Success-if: Two CLIs sync files via relay within 10 seconds
- Failure-if: Files don't sync or relay connection fails
- Timeline: Immediate (test script)

**Status:** Completed → Reverted → Completed (see below)

---

### 2026-03-02 - Disable Phase 2 Due to Evolu/Bun Incompatibility (REVISION)

**Aim:** Document and disable broken multi-device sync

**Claim:** Evolu 7.4.1 has Bun runtime incompatibility causing sync protocol crashes

**Changes:**
- Disabled transports (empty array) to prevent crash
- Documented error: `TypeError: Invalid mix of BigInt and other type in subtraction` at Protocol.js:938

**Root cause:** Bun SQLite with `safeIntegers: true` returns BigInt, but Evolu's Protocol.js expects Number in getSize()

**Contact test:**
- Success-if: Evolu releases Bun-compatible version
- Failure-if: Issue persists in future Evolu releases
- Timeline: Monitor Evolu releases

**Status:** Completed (documented failure)

---

### 2026-03-02 - Fix BigInt Issue and Re-Enable Phase 2

**Aim:** Fix BigInt compatibility issue between Bun SQLite and Evolu

**Claim:** Disabling `safeIntegers` in BunSqliteDriver will resolve Protocol.js TypeError without losing functionality

**Changes:**
- Disabled `safeIntegers` in BunSqliteDriver (changed from `true` to `false`)
- Re-enabled Evolu transports with `wss://free.evoluhq.com`

**Root cause analysis:**
- Bun SQLite with `safeIntegers: true` → returns BigInt for integers
- Evolu Protocol.js getSize() expects Number
- `upper - lower` operation fails (can't mix BigInt and Number)

**Contact test:**
- Success-if: WebSocket connects, no BigInt errors in logs
- Failure-if: TypeError persists or sync protocol fails
- Timeline: Immediate (run CLI and check logs)
- Evidence: Manual testing confirmed WebSocket connection successful, no errors

**Status:** Completed

---

### 2026-03-02 - Fix Loop B Echo Prevention for Same-Owner Multi-Device

**Aim:** Enable same-mnemonic multi-device sync (currently broken)

**Claim:** Replacing ownerId-based echo prevention with lastAppliedHash-based approach will allow devices sharing the same mnemonic to sync correctly

**Changes:**
- Removed ownerId filter from Loop B (was skipping all rows from same owner)
- Implemented lastAppliedHash-based echo prevention:
  - If this device wrote the hash to Evolu → `lastAppliedHash === row.contentHash` → early-return no-op
  - If remote device wrote → `lastAppliedHash === null` and `diskHash === null` → proceed to write

**Root cause:** ownerId filter broke same-mnemonic multi-device sync. Device B would skip all rows from Device A because they shared the same owner, preventing remote writes from applying.

**Contact test:**
- Success-if: Device B writes test.txt after Device A syncs it through the relay
- Failure-if: Files still don't appear or conflict files are created spuriously on initial load
- Timeline: Immediate (verified by manual test)
- Evidence: Manual testing confirmed Device B now applies files from Device A

**Status:** Completed

---

### 2026-03-02 - Add Mnemonic Restore and WebSocket Debug Logging

**Aim:** Enable device provisioning with existing mnemonic and improve relay observability

**Claim:** TXTATELIER_MNEMONIC env var with two-stage restore flow will enable restoring an owner from another device's mnemonic

**Changes:**
- Added `TXTATELIER_MNEMONIC` env var support in index.ts
- Implemented two-stage restore flow:
  - Stage 1: Restore mnemonic (exits after persisting because Evolu's reload mechanism is browser-native)
  - Stage 2: Start CLI with restored owner
- Added WebSocket event logging to BunEvoluDeps (open/close/error/message/send with byte sizes)
- Updated test-multi-device-sync.fish to verify matching owner IDs before checking file sync

**Design decision:** Two-stage flow required because Evolu's `restoreMnemonic().reload()` hangs in CLI (browser-native reload mechanism)

**Contact test:**
- Success-if: Test script prints matching owner IDs and finds test.txt on Device B
- Failure-if: Mnemonic restore exits non-zero or owner IDs differ
- Timeline: Immediate (next test run)
- Evidence: Manual testing confirmed matching owner IDs and successful file sync

**Status:** Completed

---

### 2026-03-03 - Performance Optimizations (Loop B + Watch)

**Aim:** Improve sync performance and reduce unnecessary disk I/O during bulk operations

**Claim:** Adding subscription debouncing, concurrency control, and early-exit optimizations will prevent rapid-fire processing and reduce CPU load without sacrificing correctness

**Changes:**
- **Loop B (sync.ts):**
  - Added 500ms subscription debounce (prevents rapid-fire processing during bulk operations)
  - Added early-exit optimization (check `lastAppliedHash` first, skip disk I/O if already applied)
  - Added secondary optimization (if `diskHash === row.contentHash`, update state and skip)
  - Added batch progress logging (every 50 files for batches >50)
- **Watcher (watch.ts):**
  - Added concurrency control (max 10 parallel file operations)
  - Changed from direct callback to queue-based processing
- **Lifecycle (index.ts):**
  - Added proper cleanup for error subscription (prevents memory leak)

**Design decisions:**
- 500ms subscription debounce balances responsiveness with stability
- Early-exit optimization prioritizes `lastAppliedHash` check (cheapest) before disk I/O
- Concurrency limit prevents filesystem overload during bulk changes
- Progress logging provides visibility for large sync operations

**Contact test:**
- Success-if: Bulk operations (>50 files) show progress logs, CPU usage remains reasonable, no missed changes
- Failure-if: Sync delays increase, CPU spikes, or changes get lost
- Timeline: Next bulk sync test
- Evidence: Awaiting testing with large file sets

**Status:** In Progress (awaiting testing)

---

## Relationships to Other Centers

**Contained by:**
- CLI center - provides workspace and orchestration context

**Will be used by:**
- CLI commands - trigger sync operations
- evolu-sync center (Phase 1) - coordinate with Loop B

**Uses:**
- Evolu `@evolu/common` - CRDT storage and replication
- Evolu relay `wss://free.evoluhq.com` - Multi-device sync transport
- Bun `bun:sqlite` - Native SQLite database (WAL mode, safeIntegers disabled for Evolu compat)
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
- Echo prevention (lastAppliedHash-based, supports same-mnemonic multi-device)
- Atomic operations (temp-file + rename pattern)
- Performance-aware (early-exit optimizations, concurrency control, subscription debouncing)

### Completed Phases

- **Phase 0:** Loop A (Filesystem → Evolu) ✅
- **Phase 1:** Loop B (Evolu → Filesystem) ✅
- **Phase 2:** Multi-device replication ✅

### Future Phases

- **Phase 3:** Enhanced conflict detection
- **Phase 4:** Deletion handling
- **Phase 5:** Startup reconciliation

See IMPLEMENTATION_PLAN.md for full details.

---

## Open Questions

### Resolved
- ✅ Hash algorithm: xxHash64 (via Bun.hash) - fast, sufficient for change detection
- ✅ Debounce duration: 100ms filesystem watch, 500ms subscription - balances responsiveness and stability
- ✅ Watch strategy: Node.js fs.watch() - more stable than Bun.watch
- ✅ Echo prevention: lastAppliedHash-based (not ownerId) - enables same-mnemonic multi-device sync
- ✅ BigInt compatibility: Disable safeIntegers in BunSqliteDriver for Evolu Protocol.js compatibility
- ✅ Mnemonic restore: Two-stage flow (restore + exit, then start) - Evolu reload() is browser-native
- ✅ Concurrency control: Max 10 parallel file operations prevents filesystem overload

### Outstanding
- File filtering strategy? (gitignore patterns? explicit allow/deny lists?)
- Should we add initial scan on startup? (Phase 5)
- How to handle very large files? (streaming hash computation?)
- Performance testing with bulk operations (>100 files)?
