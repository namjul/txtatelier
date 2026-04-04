## Context

**Current state:**
- Orchestration functions (`reconcileStartupFilesystemState`, `reconcileStartupEvoluState`) return `Promise<void>`
- Errors are logged internally but never surface to callers
- No way to distinguish "operation succeeded" from "operation failed catastrophically"
- Individual file failures are resilient (continue processing), but caller has no visibility

**Problem:**
- If watch directory doesn't exist, reconciliation logs error but returns void - `startFileSync` continues as if everything worked
- If database is corrupted, reconciliation fails silently
- Tests can't assert on error conditions
- No foundation for future CLI status commands to show what failed during startup

**Constraints:**
- Must maintain current resilience (continue on per-file errors)
- Breaking change acceptable (internal API, not user-facing)
- Must follow existing Result pattern (used by low-level functions)

## Goals / Non-Goals

**Goals:**
- Enable fatal error detection at orchestration level
- Maintain resilience for partial failures (per-file errors)
- Provide observability through stats (processed/failed counts, error details)
- Type-safe error handling (TypeScript forces checking Result)
- Foundation for CLI status/doctor commands

**Non-Goals:**
- Changing low-level function signatures (captureChange, etc. already return Result)
- Adding retry mechanisms (separate concern)
- Changing state materialization functions (focus on startup reconciliation only)
- Making CLI fail-fast by default (caller decides)

## Decisions

### Decision 1: Fatal-Only Result Pattern

**Choice:** Use `Result<Stats, FatalError>` where error type only includes catastrophic failures.

**Alternatives considered:**
1. **`Result<Stats, never>`** - Always succeeds, just returns stats
   - ❌ Rejected: Using Result with `never` is ceremony - just return Stats directly
   - No type safety benefit if it can't fail
   
2. **`Result<void, AnyError>`** - Fail on any error, including per-file
   - ❌ Rejected: Loses resilience - would stop on first file error
   - Goes against project principle of best-effort processing
   
3. **`Result<Stats, FatalError>`** - Only fail on catastrophic issues ✅
   - ✅ Chosen: Clear boundary between fatal (can't continue) and recoverable (in stats)
   - Maintains resilience while enabling fatal detection
   - Result type has semantic meaning: "Can operation proceed?"

**Rationale:**
- Fatal errors = systematic failures (watchDir missing, DB corrupted)
- Recoverable errors = per-file issues (too large, permission denied)
- Caller can check `result.ok` for fatals, `result.value.failedCount` for partials

### Decision 2: Stats Structure

**Choice:** Return structured stats with counts and error details:

```typescript
interface ReconcileStats {
  readonly processedCount: number;
  readonly failedCount: number;
  readonly errors: ReadonlyArray<{
    readonly path: string;
    readonly error: ChangeCaptureError;
  }>;
}
```

**Alternatives considered:**
1. **Just counts (no error details)** 
   - ❌ Rejected: Can't diagnose which files failed or why
   
2. **Full error objects only (no counts)**
   - ❌ Rejected: Requires caller to compute counts manually
   
3. **Counts + error details** ✅
   - ✅ Chosen: Balance between observability and usability
   - Caller can quickly check `failedCount > 0`
   - Full error details available for logging/debugging

**Rationale:**
- Foundation for future status command: can show "23 files synced, 2 failed"
- Error details enable detailed logging without re-processing
- Counts enable quick health checks

### Decision 3: Fatal Error Taxonomy

**Fatal errors** (return `err()`):
- `WatchDirNotFound` - Watch directory doesn't exist
- `WatchDirUnreadable` - No read permission on watch directory
- `WatchDirUnwritable` - Can't write to watch directory (for materialization)
- `DatabaseUnavailable` - Can't query Evolu database

**Recoverable errors** (in stats.errors):
- Individual file read failures
- Individual file too large
- Individual file permission errors
- Individual Evolu insert/update failures
- Individual hash computation failures

**Rationale:**
- Fatal = can't perform core operation at all (can't enumerate files, can't query DB)
- Recoverable = can skip this item and continue with others

### Decision 4: Caller Error Handling Strategy

**`startFileSync` behavior:**
```typescript
const fsResult = await reconcileStartupFilesystemState(evolu, watchDir);
if (!fsResult.ok) {
  // Fatal error - can't continue
  return err({ type: "StartupFailed", cause: fsResult.error });
}

// Partial failures are okay - just log
if (fsResult.value.failedCount > 0) {
  logger.warn(`Started with ${fsResult.value.failedCount} failed files`);
}
```

**Rationale:**
- Fatal errors propagate up (CLI should exit with error)
- Partial failures log warnings but don't block startup
- User sees degraded state but can still use the system

### Decision 5: Expose Stats on Session

**Choice:** Add `startupReconciliation` to `FileSyncSession`:

```typescript
export interface FileSyncSession extends OwnerSession {
  readonly stop: () => Promise<void>;
  readonly startupReconciliation: {
    readonly filesystem: ReconcileStats;
    readonly evolu: ReconcileStats;
  };
}
```

**Rationale:**
- Foundation for future `txtatelier status` command
- Enables post-startup introspection
- Additive change (non-breaking for existing code)

## Risks / Trade-offs

### Risk 1: Breaking Change Overhead
**Risk:** 19+ test call sites need updating, potential for mistakes

**Mitigation:**
- TypeScript will catch all call sites (compilation errors)
- Update tests systematically (one describe block at a time)
- Run test suite after each batch to catch regressions early

### Risk 2: Ambiguity in Fatal vs Recoverable Boundary
**Risk:** Future developers might be unclear what qualifies as "fatal"

**Mitigation:**
- Document taxonomy clearly in error type definitions
- Add JSDoc examples showing fatal vs recoverable scenarios
- Code review checklist: "Is this error truly fatal or can we skip and continue?"

### Risk 3: Over-reliance on Stats
**Risk:** Callers might ignore `failedCount`, assuming `ok()` means "all good"

**Mitigation:**
- Log warnings when `failedCount > 0` at the call site
- Future: Add health check that surfaces high failure rates
- Documentation: explain ok() = can proceed, not ok() = all succeeded

### Risk 4: Type Explosion
**Risk:** Need to define multiple error types (ReconcileFatalError, StartupFatalError, etc.)

**Trade-off accepted:**
- More types = better type safety
- Explicit error taxonomy aids debugging
- One-time cost during implementation

## Migration Plan

**Implementation order:**
1. Define error types and stats interfaces in `sync/startup-reconciliation.ts`
2. Update `reconcileStartupFilesystemState` to return `Result<Stats, FatalError>`
3. Update `reconcileStartupEvoluState` to return `Result<Stats, FatalError>`
4. Update `startFileSync` to handle Results and expose stats on session
5. Update integration tests (one describe block at a time, run tests after each)
6. Add new unit tests for fatal error scenarios

**Testing strategy:**
- Existing integration tests verify behavior unchanged (resilience maintained)
- New unit tests verify fatal error detection (mock missing watchDir, etc.)
- Manual test: Delete watchDir and verify CLI exits with clear error

**Rollback:**
- Not applicable (internal refactor, no persistent state changes)
- If issues found, revert commit (single atomic change)

## Open Questions

None - design is straightforward application of existing Result pattern to orchestration layer.
