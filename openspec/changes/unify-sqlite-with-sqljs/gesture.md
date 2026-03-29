# Gesture: unify-sqlite-with-sqljs

## Gesture type
revision

## What are we gesturing toward?
sqlite-driver-unification

## Claim
Replacing native SQLite drivers (better-sqlite3, bun:sqlite) with sql.js (WASM) will eliminate runtime-specific driver complexity while maintaining acceptable performance for personal note-taking workloads (databases < 100MB).

## What made us do this?
We hit `SQLITE_CANTOPEN` on Node when opening a database from a buffer with WAL enabled — WAL needs a filesystem path for its journal files, but buffer-loaded databases don't have one. We fixed this with temp files, but the pattern reveals a deeper misalignment: WAL optimizes for continuous disk streaming, but txtatelier's 5-second debounced snapshot persistence doesn't leverage that model anyway.

The sql.js reference (Obsidian-style) uses explicit `db.export()` + `io.writeFile` — matching exactly what we already do with debounced saves. This suggests our architecture is better suited to sql.js's explicit persistence model than to native SQLite's WAL model.

## Load-bearing assumptions
1. **Database size stays under ~100MB** — sql.js loads the entire DB into memory; if users start storing media files or huge datasets, this becomes a hard bottleneck.
2. **Query performance is not the critical path** — Evolu's sync and the 5s debounce are the actual bottlenecks, not raw SQLite query speed.
3. **CLI usage patterns mirror PWA** — both involve bursty writes with idle periods, not sustained heavy write load that would benefit from WAL.

## Structures this gesture touches

### New structures
- `sqljs-driver` — A single SQLite driver implementation using sql.js that works identically in Node, Bun, and Browser environments

### Anticipated co-variances
- `driver-factory` — Will be simplified from runtime-detection to unified initialization
- `temp-file-management` — Will be eliminated entirely (no more temp files for buffer loading)
- `wal-configuration` — Will be removed (sql.js doesn't use WAL)
- `cross-platform-cli` — Simplifies by having one engine across Node and Bun

## Co-variance

### Likely to strengthen
- `driver-testability` — Single code path means tests run identically everywhere
- `bundle-size-consistency` — WASM binary replaces platform-specific native bindings

### Likely to dissolve
- `runtime-detection` — No need to check `typeof Bun` or platform at runtime
- `temp-file-cleanup` — Eliminated complexity

### Unknown / Watch for
- **Startup latency** — WASM initialization vs instant native driver load
- **Memory pressure** — Node.js heap limits vs native SQLite memory management
- **@evolu/sqlite-wasm relationship** — PWA already uses this; is it compatible with our CLI needs?
