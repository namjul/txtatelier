## Why

Orchestration functions currently return `void`, hiding all errors from callers. This makes it impossible to distinguish between "operation succeeded" and "operation failed catastrophically." We need a clear signal for fatal failures (watch directory missing, database corrupted) while maintaining resilience for partial failures (individual file errors).

## What Changes

- **BREAKING**: Change orchestration function signatures from `Promise<void>` to `Promise<Result<Stats, FatalError>>`
- Add `ReconcileFatalError` and `ReconcileStats` type definitions
- Distinguish fatal errors (operation can't proceed) from recoverable errors (tracked in stats)
- Update `startFileSync` to handle fatal reconciliation errors
- Update all test call sites to check Results
- Maintain current resilience: individual file failures continue processing, only systematic failures return `err()`

## Capabilities

### New Capabilities
- `fatal-error-handling`: Orchestration functions return Result with fatal-only error semantics (catastrophic failures like missing watchDir return err(), per-file failures in stats)
- `reconciliation-observability`: Expose reconciliation statistics (processed count, failed count, error details) through function return values

### Modified Capabilities
<!-- No existing capabilities being modified - this is new error handling infrastructure -->

## Impact

**Affected modules:**
- `centers/cli/src/file-sync/sync/startup-reconciliation.ts` - Add Result returns and fatal error types
- `centers/cli/src/file-sync/index.ts` - Handle fatal reconciliation errors in startFileSync
- `centers/cli/src/file-sync/index.test.ts` - Update 19+ test call sites to check Results

**Breaking changes:**
- All callers of `reconcileStartupFilesystemState` must handle Result
- All callers of `reconcileStartupEvoluState` must handle Result
- Tests must be updated to expect Result types

**Non-breaking aspects:**
- Resilience maintained: still continues on per-file errors
- Behavior unchanged: same operations, just better error visibility
- No changes to low-level functions (captureChange, etc.) - they already return Result
