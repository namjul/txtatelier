# Design: unify-sqlite-with-sqljs

## Approach

Replace the dual native driver implementation (better-sqlite3 for Node, bun:sqlite for Bun) with a single sql.js (ASM.js flavor) driver that works identically across all runtimes.

### Architecture Changes

```
Current:
┌─────────────────────────────────────────────────────┐
│         SqliteDriverFactory (shared)               │
│  ┌─────────────────┐    ┌──────────────────────┐  │
│  │ BunSqliteDriver │    │ PersistentSqliteDrv  │  │
│  │   (bun:sqlite)  │    │   (better-sqlite3)   │  │
│  └────────┬────────┘    └──────────┬───────────┘  │
│           │                        │               │
│           └──────────┬───────────┘               │
│                      ┌─▼─┐                        │
│                      │WAL│ ← requires temp files  │
│                      └───┘                        │
└─────────────────────────────────────────────────────┘

Proposed (Option B - Eliminate Factory):
┌─────────────────────────────────────────────────────┐
│                                                     │
│              SqlJsDriver.ts                        │
│         (self-contained driver)                    │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │  • Load DB from Uint8Array                   │   │
│  │  • Debounced save (5s timer)                │   │
│  │  • exec/flush/export interface              │   │
│  │  • Result mapping (cols/vals → objects)     │   │
│  │  • isFlushed sealed state                    │   │
│  │  • Singleton SQL init (ASM.js)              │   │
│  └─────────────────────────────────────────────┘   │
│                    │                                │
│                    ▼                                │
│              ┌─────────┐                            │
│              │  sql.js │ ← ASM.js in-memory         │
│              │ (ASM.js)│    export → PlatformIO      │
│              └─────────┘                            │
│                                                     │
│  Factory eliminated: driver owns persistence logic  │
│  Fire-and-forget writes: .catch() error handling    │
└─────────────────────────────────────────────────────┘
```

### Implementation Strategy

1. **Create new driver**: `SqlJsDriver.ts` implementing the `CreateSqliteDriver` interface directly
   - Driver owns: database loading, debounced persistence (5s timer), exec/flush/export interface
   - No adapter pattern needed (single implementation)
   - No factory abstraction (driver is self-contained)
2. **Use ASM.js flavor**: Import from `sql.js/dist/sql-asm.js` — single JS file, no WASM binary to distribute
3. **Database loading**: sql.js accepts Uint8Array directly — no temp files needed
4. **Remove WAL**: sql.js doesn't support WAL (in-memory only); our debounced export handles persistence
5. **Eliminate factory**: Remove `SqliteDriverFactory.ts` entirely; driver creates itself
6. **Dependency swap**: Replace `better-sqlite3` and `bun:sqlite` with `sql.js` in package.json

### Key Technical Details (from reference analysis)

- **SQL Initialization**: Use singleton pattern to cache `initSqlJs()` promise — avoid reloading on multiple DB opens
- **Database loading**: `new SQL.Database(existingData)` accepts Uint8Array directly — no temp file workaround
- **Query results mapping**: sql.js returns `[{columns, values}]` not objects — must map to `{[col]: val}` format for Evolu compatibility
- **Change tracking**: sql.js uses `db.getRowsModified()` not `result.changes` — different API from better-sqlite3
- **Persistence**: `db.export()` returns Uint8Array — fire-and-forget via `io.writeFile(data).catch()` with logger
- **isFlushed state**: Track flushed state to prevent stale writes after dispose — seal driver from new saves post-flush
- **Fire-and-forget pattern**: Don't await file writes in debounce/dispose — use `.catch()` with structured logging
- **ASM.js benefits**: Single file distribution, no async WASM loading, simpler bundling

### Key Technical Details

- **Database loading**: `new SQL.Database(existingData)` accepts Uint8Array directly — no temp file workaround
- **Persistence**: `db.export()` returns Uint8Array — write via existing PlatformIO
- **API differences from better-sqlite3**: 
  - sql.js uses `db.exec()` + manual result mapping vs `stmt.all()` 
  - sql.js uses `db.getRowsModified()` vs `result.changes`
  - No prepared statement objects returned for queries
- **Worker context**: sql.js works in Web Workers (Evolu's architecture) without native addon issues
- **Logger integration**: Use txtatelier's structured logger instead of console.error — maintain observability

## Rationale

### Why sql.js over alternatives

| Alternative | Why rejected |
|-------------|--------------|
| Keep native + simplify | Still have dual code paths, temp files, WAL complexity |
| Use @evolu/sqlite-wasm | Web-focused, may not work in Node/Bun CLI context |
| Just drop WAL from native | Better, but still have dual drivers and native binding complexity |

### Alignment with existing architecture

Our current persistence model is:
```
Mutation → Debounce (5s) → Serialize → Write to disk
```

This matches sql.js's model exactly:
```
Mutation → Debounce (5s) → db.export() → Write to disk
```

WAL is designed for:
```
Mutation → Write to WAL → Continuous streaming to disk
```

We've been maintaining WAL complexity for a persistence pattern we don't actually use.

## Load-bearing assumptions

1. **sql.js (ASM.js) performance is acceptable for CLI** — ASM.js is slower than native but faster than WASM initialization overhead; Evolu's sync overhead likely dominates anyway
2. **Bundle size is manageable** — sql.js ASM.js is ~2-3MB single file, acceptable for CLI tool (no separate WASM binary)
3. **API translation layer works** — Result mapping (columns/values → objects) and change tracking (getRowsModified) function correctly for Evolu's queries
4. **PlatformIO remains compatible** — sql.js export returns Uint8Array, matches current interface
5. **Fire-and-forget persistence is reliable enough** — Not awaiting file writes is acceptable; OS-level write buffering sufficient for CLI workloads

## Risks and trade-offs

| Risk | Mitigation | Severity |
|------|-----------|----------|
| Memory exhaustion on large DBs | Document size limits; keep native drivers as fallback option | Medium |
| ASM.js slower than WASM | Acceptable tradeoff for simpler distribution | Low |
| Fire-and-forget data loss | isFlushed state prevents overwrites; logger captures errors | Medium |
| API translation bugs | Comprehensive test coverage for query result mapping | Medium |
| Breaking changes in sql.js API | Pin version; comprehensive test coverage | Low |
| Evolu expects specific SQLite features | Test sync thoroughly; fallback to native if issues | Medium |
| Stale write race conditions | isFlushed sealed state prevents old instances overwriting new | Low |

## Out of scope

- **Removing temp files entirely**: PlatformIO may still need temp files for atomic writes (rename pattern), just not for database loading
- **Changing the debounce interval**: Keeping 5s, not adjusting for sql.js
- **PWA changes**: PWA already uses WASM SQLite (@evolu/sqlite-wasm); this change focuses on CLI unification
- **Performance optimization**: Initial focus is on correctness and simplicity, not query optimization
- **Large database support**: Out of scope for this change; revisit if users report size issues
- **Fire-and-forget vs await decision**: Starting with fire-and-forget; user will evaluate if sufficient during implementation

## Known unknowns

1. **Does sql.js support all SQLite features Evolu uses?** — Need to test: transactions, BigInt, etc.
2. **Is fire-and-forget persistence reliable?** — Need evaluation: can we tolerate not awaiting file writes? What about crashes during write?
3. **How does sql.js handle concurrent access?** — Single-threaded ASM.js may have different locking behavior
4. **Result mapping performance impact?** — How much overhead from converting columns/values to objects for large result sets?
5. **Can we use @evolu/sqlite-wasm in CLI?** — If so, that might be simpler than direct sql.js (but WASM has distribution complexity)

## Co-variance

### Files expected to change
- `centers/cli/src/file-sync/platform/SqlJsDriver.ts` — Create new (self-contained driver with persistence logic)
- `centers/cli/src/file-sync/platform/SqliteDriver.ts` — Delete (better-sqlite3 version)
- `centers/cli/src/file-sync/platform/BunSqliteDriver.ts` — Delete (no longer needed)
- `centers/cli/src/file-sync/platform/SqliteDriverFactory.ts` — Delete (factory eliminated, logic merged into driver)
- `centers/cli/src/file-sync/platform/EvoluDeps.ts` — Remove runtime detection, use sql.js directly
- `centers/cli/package.json` — Replace better-sqlite3 with sql.js

### Testing impact
- Driver tests need to run against sql.js (simpler: same code in all environments)
- Performance benchmarks needed (baseline vs sql.js)

### Build impact
- Single ASM.js file (no separate WASM binary) — simpler bundling
- Remove native addon build steps for better-sqlite3
- No postinstall scripts for native compilation

## ⚠ Design warnings

### Responsiveness
No impact on user-facing responsiveness. ASM.js initializes synchronously (no async WASM load), so startup is comparable to native driver initialization.

### Continuity after correction
N/A — this is an infrastructure change, not a user-facing feature.

### Exploratory capacity
N/A — this change narrows the technical surface (good), doesn't constrain user behavior.
