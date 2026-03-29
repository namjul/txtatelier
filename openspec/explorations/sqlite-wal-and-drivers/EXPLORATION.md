# Exploration: SQLite drivers, WAL, and persistence assumptions

**Date:** 2026-03-29 (original), 2026-03-29 (sql.js deep dive added)
**Status:** Open — design tradeoffs, no decision required to ship the Node temp-file repair
**Current thinking:** sql.js unification is promising but needs validation against actual usage patterns

---

## Why this exists

We hit a real failure mode on **Node + better-sqlite3**: `await evolu.appOwner` never resolved. Runtime evidence showed **`SQLITE_CANTOPEN` / “unable to open database file”** at `PRAGMA journal_mode = WAL` after opening an existing DB from a **byte buffer** (`new Database(Buffer.from(...))`). **Bun** did not fail because `BunSqliteDriver` already wrote bytes to a **temp file** and opened by **path**.

Separately, a **reference driver** (Obsidian-style, **sql.js**) loads `new SQL.Database(existingData)` and never enables WAL in the snippet — a different persistence and engine model.

This note explores **what WAL is for**, **why txtatelier enables it**, **how that differs from the reference**, and **what optional simplifications** might exist without claiming one is universally “right.”

---

## Three stacks in the conversation

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Evolu CreateSqliteDriver                         │
│  (same contract: exec, export, flush, Symbol.dispose)               │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
┌───────────────┐       ┌───────────────┐       ┌───────────────────┐
│ sql.js ref    │       │ Bun path      │       │ Node path         │
│ (wasm/JS)     │       │ bun:sqlite    │       │ better-sqlite3    │
│ in-memory DB  │       │ temp file +   │       │ temp file + path  │
│ export→io     │       │ path (WAL ok) │       │ (post-repair WAL) │
│ no WAL in     │       │               │       │                   │
│ snippet       │       │               │       │                   │
└───────────────┘       └───────────────┘       └───────────────────┘
```

---

## What WAL is (short)

**WAL** = SQLite **write-ahead logging**: writes go to a `-wal` file (and `-shm` coordination) so readers/writers can interleave more cheaply than classic rollback-journal modes for many workloads.

It is a **native SQLite file** concern: sidecar files want a **real path** on disk for that database connection.

---

## Why txtatelier uses WAL (today)

In [`centers/cli/src/file-sync/platform/SqliteDriverFactory.ts`](../../../centers/cli/src/file-sync/platform/SqliteDriverFactory.ts), after opening the DB:

- `db.exec("PRAGMA journal_mode = WAL;");`

**Intent:** better performance under **bursty writes** (the driver **debounces** saves after mutations) and typical read/write interleaving for a **CLI** holding a native DB open for a long time.

**Assumption:** “We have a **normal** on-disk SQLite identity.” That was **false** for Node when the DB was opened only from a **buffer** — WAL could not attach journal files → `SQLITE_CANTOPEN` → Evolu worker `init` failed → `onGetAppOwner` never flushed → `appOwner` hung.

**Repair (implemented):** align Node with Bun — **deserialize bytes to temp file, open by path**, `cleanup` on dispose.

---

## Why the reference can omit WAL

The pasted **sql.js** driver:

- Builds `new SQL.Database(existingData)` or empty DB — **logical in-memory** from the host’s view; durability is **export + `io.writeFile`**, not continuous WAL files beside a canonical path.
- Does not run `PRAGMA journal_mode = WAL` in the snippet (and sql.js semantics differ from native sqlite anyway).

So the reference is not proving “WAL is bad”; it is on a **different engine + persistence story**.

---

## Assumption matrix

| Assumption | txtatelier native factory | Reference sql.js |
|------------|---------------------------|------------------|
| SQLite implementation | Native (bun / better-sqlite3) | sql.js (wasm/asm) |
| Primary durability | Serialize/export + PlatformIO to **one** path | `db.export()` + `io.writeFile` |
| WAL | Enabled explicitly | Not in snippet |
| “Open from bytes” | Needs **path** for WAL (Node repair) | Normal in-memory load |
| Missing DB file | `Result` + ENOENT → `null` (strict) | try/catch → `null` (looser) |

---

## Open threads (no closure required)

1. **Is WAL necessary?**
   Probably **not** for correctness; it is a **performance** default. Alternatives: `DELETE` journal, or WAL only when `loadDatabase` returned a path-backed connection. Tradeoff: behavior/perf under load vs simpler mental model.

2. **Double read on startup**
   `createEvoluClient` preflights `io.readFile()`, then `createSqliteDriver` reads again. Useful for **fail-fast** before Evolu; redundant I/O. Could unify later if the pain matters.

3. **Would sql.js simplify cross-runtime?** [DEEPER ANALYSIS ABOVE]
   One engine everywhere, closer to reference — at the cost of **wasm load**, **perf**, and **different** edge cases (not a free lunch).
   
   **Key insight:** Our debounced snapshot persistence (5s timer) is closer to sql.js's export model than WAL's streaming model. We may be optimizing for the wrong pattern.

4. **subscribeError in createEvoluClient**
   Surfaces worker `onError` **before** `startFileSync` attaches its own subscriber — relevant when init dies on `appOwner`. Not redundant with the later subscription.

5. **What are the actual database size expectations?**
   sql.js loads the entire DB into memory. If txtatelier is for personal note-taking (hundreds of files, MB range), this is fine. If it's for large media or enterprise datasets (GB range), it's a non-starter. Unknown: typical usage patterns.

---

## Deep Dive: sql.js as Unified Driver

The reference snippet (Obsidian-style) opens a door: **what if we replaced all native drivers with sql.js?**

### Current vs Proposed Architecture

```
CURRENT STATE:
┌─────────────────────────────────────────────────────────────────┐
│                                                                  │
│  ┌─────────────┐         ┌─────────────┐        ┌─────────────┐│
│  │    CLI      │         │    CLI      │        │    PWA      ││
│  │   (Node)    │         │   (Bun)     │        │  (Browser)  ││
│  │             │         │             │        │             ││
│  │ better-sqlite3       │ bun:sqlite   │        │ @evolu/sqlite-wasm│
│  │  (native)   │         │  (native)   │        │   (wasm)    ││
│  │             │         │             │        │             ││
│  │ ┌─────────┐ │         │ ┌─────────┐ │        │ ┌─────────┐ ││
│  │ │  WAL    │ │         │ │  WAL    │ │        │ │ no WAL  │ ││
│  │ │ enabled │ │         │ │ enabled │ │        │ │  needed │ ││
│  │ └─────────┘ │         │ └─────────┘ │        │ └─────────┘ ││
│  └─────────────┘         └─────────────┘        └─────────────┘│
│         │                       │                      │         │
│         └───────────────────────┼──────────────────────┘         │
│                                 │                                │
│                         ┌───────▼────────┐                       │
│                         │  @evolu/common  │                       │
│                         │   (sync logic)  │                       │
│                         └─────────────────┘                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

PROPOSED STATE (sql.js):
┌─────────────────────────────────────────────────────────────────┐
│                                                                  │
│  ┌─────────────┐         ┌─────────────┐        ┌─────────────┐│
│  │    CLI      │         │    CLI      │        │    PWA      ││
│  │   (Node)    │         │   (Bun)     │        │  (Browser)  ││
│  │             │         │             │        │             ││
│  │   sql.js    │         │   sql.js    │        │ @evolu/sqlite-wasm│
│  │   (wasm)    │         │   (wasm)    │        │   (wasm)    ││
│  │             │         │             │        │             ││
│  │ ┌─────────┐ │         │ ┌─────────┐ │        │ ┌─────────┐ ││
│  │ │ no WAL  │ │         │ │ no WAL  │ │        │ │ no WAL  │ ││
│  │ │  needed │ │         │ │  needed │ │        │ │  needed │ ││
│  │ └─────────┘ │         │ └─────────┘ │        │ └─────────┘ ││
│  └─────────────┘         └─────────────┘        └─────────────┘│
│         │                       │                      │         │
│         └───────────────────────┴──────────────────────┘         │
│                                 │                                │
│                    ┌────────────▼─────────┐                      │
│                    │  UNIFIED ENGINE!     │                      │
│                    │  Same SQLite impl    │                      │
│                    │  across all targets  │                      │
│                    └──────────────────────┘                      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Performance Comparison

| Aspect | Native (better-sqlite3/bun:sqlite) | sql.js (WASM) |
|--------|-----------------------------------|---------------|
| **Query speed** | Native speed - very fast | WASM overhead ~30-50% slower |
| **Startup time** | Instant (just open file) | Need to load WASM binary (~1-2MB) |
| **Memory usage** | Handles large DBs efficiently | Entire DB in memory (JS heap limit) |
| **Persistence model** | WAL mode (continuous) | Export/import (snapshot-based) |
| **Binary size** | Native deps (large but system) | WASM file (~1-2MB) |
| **Cross-platform** | Different per runtime | Identical everywhere |

### Why sql.js Might Fit txtatelier

**Current persistence flow:**
```
┌─────────┐    mutation    ┌─────────┐    debounce    ┌─────────┐
│  Evolu  │ ──────────────▶ │  SQLite │ ─────────────▶ │  Disk   │
│  (CRDT) │                 │  (WAL)    │   (5s timer)   │ (file)  │
└─────────┘                 └─────────┘                └─────────┘
```

**sql.js persistence flow:**
```
┌─────────┐    mutation    ┌─────────┐    debounce    ┌─────────┐
│  Evolu  │ ──────────────▶ │  SQLite │ ─────────────▶ │  Disk   │
│  (CRDT) │                 │ (memory) │   (5s timer)   │ (file)  │
└─────────┘                 └─────────┘                └─────────┘
                               │
                               ▼
                         ┌─────────┐
                         │ export()│
                         │ (bytes) │
                         └─────────┘
```

**Key insight:** Evolu's architecture is *already* snapshot-based. The 5-second debounced save means we're not leveraging WAL's continuous durability anyway. We're serializing and writing the entire database on a timer — exactly what sql.js is designed for.

### Complexity Elimination

**Current driver complexity:**
- Runtime detection (Bun vs Node)
- Temp file management for buffer loading (both Node and Bun)
- Cleanup logic for temp files
- WAL mode path requirements
- Two different native bindings to maintain

**sql.js would have:**
- Single initialization pattern everywhere
- No temp files (load buffer directly into memory)
- No WAL concerns
- No runtime detection needed
- Same code path for CLI and PWA

### The Real Questions

**Does txtatelier need WAL's benefits?**

WAL exists for:
- Concurrent readers/writers without locks
- Crash recovery between writes
- Performance under heavy write load

Evolu provides:
- Its own concurrency model (worker thread, serialized mutations)
- CRDT-based recovery (sync from other devices)
- Batched writes via debounced serialization

**The mismatch:** WAL optimizes for a pattern (continuous disk persistence) that txtatelier doesn't actually use.

### Risk Assessment

**Switch to sql.js makes sense if:**
- Databases stay under ~100-500MB (comfortable in Node.js memory)
- Query performance isn't critical bottleneck
- Simplicity and cross-platform consistency are prioritized
- Want to eventually merge CLI/PWA code paths

**Keep native drivers if:**
- Files could grow large (GB range)
- Query performance is critical
- Startup time matters (WASM load overhead)
- Memory pressure is a concern

### Relationship to @evolu/sqlite-wasm

The PWA already uses `@evolu/sqlite-wasm`. Investigation needed:
- Is @evolu/sqlite-wasm a thin wrapper over sql.js?
- Or a different WASM build?
- Could CLI use the same package as PWA?

This determines whether "unification" means:
- A) Use sql.js directly everywhere (CLI switches to match PWA's approach)
- B) Use @evolu/sqlite-wasm everywhere (if it's usable in Node/Bun)

---

## Mental model in one line

**WAL optimizes native on-disk SQLite; it demands a file identity. Buffer-open + WAL was the bad combo. The reference avoids that world by using in-memory sql.js + export, not by disproving WAL.**

**Extension:** txtatelier's debounced snapshot persistence aligns better with sql.js's model than with WAL's continuous streaming model. The question isn't whether WAL is good — it's whether our architecture actually benefits from it.

---

## Related code (anchors)

- Shared factory + WAL: `centers/cli/src/file-sync/platform/SqliteDriverFactory.ts`
- Node adapter + temp file: `centers/cli/src/file-sync/platform/SqliteDriver.ts`
- Bun adapter (prior art): `centers/cli/src/file-sync/platform/BunSqliteDriver.ts`
- Platform IO + Result: `centers/cli/src/file-sync/platform/PlatformIO.ts`
- Init error visibility: `centers/cli/src/file-sync/evolu.ts` (`subscribeError` before `appOwner`)

---

## If this becomes a change

Possible follow-ups (proposal phase, not decided here):

- Document "native SQLite requires path before WAL" in `file-sync` CENTER or design note.
- Optional: journal mode policy (always WAL vs conditional).
- Optional: single read path on cold start.

### sql.js Unification Path (speculative)

If we decide sql.js is the right direction:

1. **Spike:** Evaluate @evolu/sqlite-wasm vs sql.js directly
   - Can @evolu/sqlite-wasm run in Node/Bun? (probably not, it's web-focused)
   - What's the bundle size impact for CLI?
   - Performance benchmark: native vs sql.js for typical Evolu workloads

2. **Implementation approach:**
   - New driver: `SqlJsDriver.ts` alongside existing drivers
   - Factory selects based on env var or config (not runtime detection)
   - Gradual rollout: opt-in flag, then default, then remove native drivers

3. **Risk mitigation:**
   - Keep native drivers as fallback during transition
   - Performance benchmarks before committing
   - Memory usage monitoring for large databases

### Simpler Alternative: Drop WAL, Keep Native

If sql.js is too heavy but we want simplicity:

- Remove `PRAGMA journal_mode = WAL` from factory
- Use default `DELETE` journal mode (or `MEMORY` for :memory: dbs)
- Keep temp file pattern (needed for loading from bytes anyway)
- Benefit: simpler persistence model, no WAL file complications
- Cost: slightly worse performance under heavy concurrent load (may not matter for CLI)
