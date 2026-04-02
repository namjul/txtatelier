# Exploration: atomically Package for Atomic File Writes

**Exploration Date:** 2026-03-29  
**Context:** Evaluating whether to adopt the `atomically` npm package to replace or enhance current atomic file write implementations in txtatelier.

---

## Current State

### Existing Atomic Write Implementations

The codebase currently has **two** separate atomic write implementations:

```
┌─────────────────────────────────────────────────────────────────┐
│           CURRENT ATOMIC WRITE LANDSCAPE                        │
└─────────────────────────────────────────────────────────────────┘

1. FILE SYNC WRITES (write.ts)
   ┌────────────────────────────────────────┐
   │ writeFileAtomic(filePath, content)     │
   │ ├─ mkdir(parentDir, { recursive: true })│
   │ ├─ write(tempPath, content)            │
   │ └─ rename(tempPath → filePath)         │
   │                                        │
   │ tempPath: {file}.tmp-{time}-{random}     │
   │                                        │
   │ Used by:                               │
   │ • State materialization (Evolu→FS)      │
   │ • Conflict file creation               │
   └────────────────────────────────────────┘

2. DATABASE PERSISTENCE (PlatformIO.ts)  
   ┌────────────────────────────────────────┐
   │ PlatformIO.writeFile(data)             │
   │ ├─ mkdir(parentDir, { recursive: true })│
   │ ├─ write(tempPath, data)               │
   │ └─ rename(tempPath → dbPath)           │
   │                                        │
   │ tempPath: {db}.tmp-{time}-{UUID}       │
   │                                        │
   │ Used by:                               │
   │ • BunSqliteDriver export to disk       │
   └────────────────────────────────────────┘
```

### Where Writes Happen

| Component | Frequency | Critical? |
|-----------|-----------|-----------|
| State materialization (Evolu→disk) | Every remote change | Yes - user data |
| Conflict file creation | On conflicts | Yes - prevents data loss |
| Database export | Debounced (5s) | Yes - _syncState persistence |

### Temp File Pattern

Current pattern: `.tmp-{timestamp}-{random}`  
Ignored by: `ignore.ts` via fast-path check for `.tmp-`

---

## What atomically Offers

[atomically](https://github.com/fabiospampinato/atomically) is a TypeScript library for atomic file operations with these key features:

### Core Capabilities

| Feature | atomically | Current Implementation |
|---------|------------|------------------------|
| **Atomic writes** | ✓ temp+rename | ✓ temp+rename |
| **Write queuing** | ✓ Same-file queue | ✗ No queue (race possible) |
| **Retry logic** | ✓ 7500ms timeout, exponential backoff | ✗ No retry |
| **Auto cleanup** | ✓ Temp files purged even on crash | ✗ Leftover on SIGKILL |
| **fsync control** | ✓ Configurable (fsyncWait: false for 10x speed) | ✗ Always waits |
| **Error handling** | ✓ Handles ENOSYS/EPERM/EINVAL gracefully | ✗ Bubbles up |
| **Path truncation** | ✓ Smart truncation for ENAMETOOLONG | ✗ Crashes |
| **Symlink resolution** | ✓ Automatic | ✗ Not handled |
| **Dependencies** | ✓ 0 dependencies | ✓ 0 dependencies |

### Key Options

```typescript
// Performance tuning
await writeFile(path, data, { fsyncWait: false });  // 10x faster

// Reliability tuning  
await writeFile(path, data, { 
  timeout: 5000,     // Custom retry timeout
  tmpPurge: false,   // Keep temp file on failure (debugging)
});
```

---

## Gap Analysis

### Current Gaps in Our Implementation

```
┌─────────────────────────────────────────────────────────────────┐
│                    IDENTIFIED GAPS                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ 1. WRITE RACES                                                  │
│    Scenario: Two syncs modify same file simultaneously          │
│    Risk:     Temp file collision or partial write               │
│    Impact:   Medium (rare in practice, but possible)          │
│                                                                 │
│ 2. NO RETRY LOGIC                                               │
│    Scenario: EMFILE/ENFILE/EBUSY during heavy sync              │
│    Risk:     Write fails, file out of sync                      │
│    Impact:   High (causes sync failures)                        │
│                                                                 │
│ 3. CRASH DEBRIS                                                 │
│    Scenario: SIGKILL (kill -9) during write                   │
│    Risk:     .tmp-* files left in watch directory               │
│    Impact:   Low (ignored by sync, but messy)                   │
│                                                                 │
│ 4. ALWAYS SYNCHRONOUS FSYNC                                     │
│    Scenario: Bulk sync of many files                            │
│    Risk:     Slow performance on high-latency filesystems         │
│    Impact:   Medium ( affects UX during large syncs)            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Real-World Evidence Needed

**Questions to validate before adopting:**

1. **Are we seeing race conditions?**
   - Check logs for simultaneous writes to same file
   - Look for "file busy" errors

2. **Are we hitting resource limits?**
   - Monitor for EMFILE/ENFILE errors during sync storms
   - Check if temp files accumulate after crashes

3. **Is fsync a bottleneck?**
   - Profile sync performance on network drives
   - Compare with fsync disabled

4. **Are we losing data on crashes?**
   - The FAILING_TESTS.md notes a real bug where `kill -9` loses `_syncState`
   - This is about state persistence, not file writes, but related

---

## Trade-off Analysis

### Pros of Adopting atomically

1. **Reliability gains:**
   - Retry logic handles transient failures
   - Crash cleanup prevents temp file debris
   - Better error handling for permission issues

2. **Performance option:**
   - `fsyncWait: false` for 10x faster writes when durability isn't critical
   - Could speed up bulk sync operations

3. **Edge case handling:**
   - Path truncation for deep directory structures
   - Symlink resolution
   - Better cross-platform behavior

4. **Maintenance reduction:**
   - Battle-tested library (rewrite of write-file-atomic)
   - One implementation instead of two

### Cons/Considerations

1. **Bundle size:**
   - ~20% larger than current implementation
   - Impact: minimal (CLI tool, not browser)

2. **Dependency addition:**
   - Adds external dependency (though 0 sub-dependencies)
   - Current: 100% custom code

3. **Complexity for simple use case:**
   - Our needs are basic: temp+rename
   - atomically offers many features we don't need

4. **Integration work:**
   - Need to wrap with Result types
   - Need to align temp file naming with ignore patterns
   - Testing to ensure no regressions

---

## Decision Framework

### Adoption Criteria

**Adopt IF any of these are true:**
- [ ] Observed race conditions in sync logs
- [ ] Observed EMFILE/ENFILE errors
- [ ] Finding .tmp-* debris after crashes
- [ ] Performance issues with fsync on target filesystems
- [ ] Need for better cross-platform compatibility (Windows, network drives)

**Defer IF:**
- [ ] Current implementation works reliably
- [ ] No observed issues in production
- [ ] Prefer to minimize dependencies
- [ ] Team bandwidth limited for integration/testing

### Implementation Path (if adopted)

**Option A: Full Replacement**
- Replace both `writeFileAtomic` and `PlatformIO.writeFile`
- Unified atomic write layer
- Pro: Single implementation, consistent behavior
- Con: More invasive change

**Option B: Selective Replacement**
- Only replace high-frequency writes (state materialization)
- Keep PlatformIO simple for DB exports
- Pro: Minimal change, targeted improvement
- Con: Two implementations remain

**Option C: Wrap atomically**
- Create adapter that wraps atomically with our Result types
- Keep current API, swap implementation
- Pro: Drop-in replacement
- Con: Adds abstraction layer

---

## Related Issues

### Connection to FAILING_TESTS.md

The documented bug in FAILING_TESTS.md (offline edits overwritten) is **not** directly caused by atomic write issues. It's caused by `_syncState.lastAppliedHash` not being persisted before SIGKILL.

However, atomically's crash cleanup would help with a related issue: if the process dies **during** a file write, a partial temp file could be left. Currently, our code doesn't clean these up.

### Connection to Instance Lock

The instance lock uses atomic mkdir (not file writes). This is unrelated to atomically's scope.

---

## Recommendations

### Immediate Actions

1. **Instrument current implementation:**
   - Add logging for write failures
   - Track temp file creation/cleanup
   - Monitor for EMFILE/ENFILE errors

2. **Create reproduction test:**
   - Simulate rapid concurrent writes to same file
   - Verify if races actually occur

3. **Check for temp file debris:**
   - Look for `.tmp-*` files in test directories
   - Check if any exist after test suite runs

### Decision Timeline

**If issues found:** Create change proposal to adopt atomically  
**If no issues:** Document decision to keep current implementation, revisit in 3 months  

### Default Recommendation

**Defer adoption** until evidence of need. Current implementation is:
- Simple and auditable
- Sufficient for known use cases
- Already integrated with Result types and ignore patterns

**Switch to atomically if:**
- Cross-platform deployment reveals edge cases
- Performance profiling shows fsync bottleneck
- Reliability testing reveals write races

---

## Open Questions

1. What's the actual performance cost of fsyncWait on target filesystems (SSD vs network)?
2. Does Bun's fs.writeFile have different atomicity guarantees than Node's?
3. How does atomically behave with Bun's different runtime characteristics?
4. Should we unify the two current implementations first, before deciding on atomically?

---

## References

- [atomically on npm](https://www.npmjs.com/package/atomically)
- [atomically on GitHub](https://github.com/fabiospampinato/atomically)
- [write-file-atomic](https://github.com/npm/write-file-atomic) (atomically's predecessor)
- Current implementation: `centers/cli/src/file-sync/write.ts`
- Related bug: `openspec/changes/prevent-duplicate-instance-start/`
- Failing tests: `centers/cli/src/file-sync/FAILING_TESTS.md`

---

**Status:** Exploration complete, awaiting validation data  
**Next Review:** After observing production behavior or Phase 3 completion
