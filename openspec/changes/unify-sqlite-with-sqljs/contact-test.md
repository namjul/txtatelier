# Contact Test: unify-sqlite-with-sqljs

## Evidence tier
proximal — direct testing of the driver implementation across runtimes

## What would success look like?

1. **Unified driver works in both Node and Bun** — Single `SqlJsDriver.ts` code path executes successfully in both runtimes without runtime detection or platform-specific branches
2. **Evolu sync remains functional** — File sync (watch → Evolu → disk) completes successfully with no regressions in sync latency (measured: time from file save to database update < 500ms)
3. **Startup time acceptable** — CLI cold start (from command invocation to first sync) increases by < 500ms compared to native driver baseline
4. **No temp file complexity** — Database loads directly from Uint8Array without creating temp files; temp directory remains empty during normal operation
5. **Test suite passes** — All existing driver tests pass without modification (API compatibility maintained)

## What would falsify this claim?

1. **Runtime-specific failures** — Driver works in Node but fails in Bun (or vice versa), requiring platform-specific code paths
2. **Sync breakage** — File sync fails, loses data, or has > 2x latency increase vs native driver
3. **Unacceptable startup delay** — CLI cold start increases by > 1 second (WASM load too slow)
4. **Memory exhaustion** — Database operations fail with out-of-memory errors on typical usage (< 100MB database)
5. **Evolu incompatibility** — sql.js SQLite implementation lacks features Evolu requires (transactions, specific pragmas, data types)
6. **Native dependency still needed** — We discover we need to keep better-sqlite3 for some edge case, re-introducing dual-driver complexity

## How will we check?

1. **Cross-runtime test** — Run driver tests in both Node 22+ and Bun 1.1+: `bun test` and `node --test` (or equivalent)
2. **Sync latency benchmark** — Measure end-to-end: write file → detect change → Evolu mutation → persist. Compare native vs sql.js timings.
3. **Startup measurement** — Use `console.time()` wrapper around CLI init to measure cold start delta
4. **Memory monitoring** — Log `process.memoryUsage()` during sync operations; verify no leaks or excessive growth
5. **Feature compatibility test** — Verify all Evolu queries execute correctly: CRDT mutations, sync queries, transaction handling
6. **Temp file audit** — Check temp directory after 10 sync cycles; should contain no database files

## When will we check?

**Immediate (during implementation):**
- After Task 3 (sql.js driver implementation): Cross-runtime test
- After Task 4 (factory integration): Feature compatibility test

**Before merge (after Task 5):**
- Full test suite run in both runtimes
- Startup time measurement vs baseline
- Sync latency benchmark comparison
- Memory audit during stress test (rapid file changes)

**Go/no-go criteria:**
- If all success criteria met: Merge and complete the change
- If any falsification criteria met: Document in evidence.md, assess if fixable or if we need to revert to native drivers

**Decision point:** Within 1 week of completing implementation tasks.
