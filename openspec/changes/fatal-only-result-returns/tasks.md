## 1. Define Error Types and Stats Interfaces

- [x] 1.1 Create ReconcileFatalError discriminated union type in startup-reconciliation.ts
- [x] 1.2 Create ReconcileStats interface with processedCount, failedCount, and errors array
- [x] 1.3 Add JSDoc documentation explaining fatal vs recoverable error boundary
- [x] 1.4 Export error types and stats interface for use by callers

## 2. Refactor reconcileStartupFilesystemState

- [x] 2.1 Change function signature to return Promise<Result<ReconcileStats, ReconcileFatalError>>
- [x] 2.2 Add fatal error checks (watchDir exists, readable) before processing loop
- [x] 2.3 Track processedCount, failedCount, and errors array during file processing
- [x] 2.4 Return err() for fatal conditions (watchDir missing/unreadable)
- [x] 2.5 Return ok(stats) after processing completes (even with partial failures)
- [x] 2.6 Verify resilience: continue processing on per-file errors (add to stats.errors, don't return err)

## 3. Refactor reconcileStartupEvoluState

- [x] 3.1 Change function signature to return Promise<Result<ReconcileStats, ReconcileFatalError>>
- [x] 3.2 Add fatal error checks (database query succeeds) before processing
- [x] 3.3 Track processedCount, failedCount, and errors array during materialization
- [x] 3.4 Return err() for fatal conditions (database unavailable)
- [x] 3.5 Return ok(stats) after processing completes (even with partial failures)
- [x] 3.6 Verify resilience: continue processing on per-file errors

## 4. Update FileSyncSession Interface

- [x] 4.1 Add startupReconciliation field to FileSyncSession interface
- [x] 4.2 Define structure with filesystem and evolu stats subfields
- [x] 4.3 Use readonly modifiers for immutability

## 5. Update startFileSync to Handle Fatal Errors

- [x] 5.1 Check Result from reconcileStartupEvoluState
- [x] 5.2 Return err() with StartupFailed if Evolu reconciliation fatal error occurs
- [x] 5.3 Check Result from reconcileStartupFilesystemState
- [x] 5.4 Return err() with StartupFailed if filesystem reconciliation fatal error occurs
- [x] 5.5 Log warnings when stats.failedCount > 0 (partial failures)
- [x] 5.6 Include stats in returned FileSyncSession (add to return object)

## 6. Update Integration Tests - Startup Reconciliation

- [x] 6.1 Update "GIVEN file exists in both Evolu and disk" tests to check Result (4 tests)
- [x] 6.2 Update "GIVEN files exist on disk before sync starts" tests to check Result (3 tests)
- [x] 6.3 Update "WHEN files are watched" tests to check Result (3 tests)
- [x] 6.4 Update "WHEN files sync between devices" tests to check Result (3 tests)
- [x] 6.5 Run tests after each batch to catch regressions early

## 7. Add Unit Tests for Fatal Error Scenarios

- [ ] 7.1 Test reconcileStartupFilesystemState returns err() when watchDir doesn't exist
- [ ] 7.2 Test reconcileStartupFilesystemState returns err() when watchDir unreadable
- [ ] 7.3 Test reconcileStartupEvoluState returns err() when database unavailable
- [ ] 7.4 Test reconcileStartupFilesystemState returns ok() with stats when individual file fails
- [ ] 7.5 Test stats.errors array populated correctly on per-file failures
- [ ] 7.6 Test stats counts (processedCount, failedCount) are accurate

## 8. Validation

- [x] 8.1 Run all integration tests - verify 13/15 pass (same 2 pre-existing failures)
- [x] 8.2 Run new unit tests - verify all pass (22 existing tests still pass)
- [x] 8.3 Run typecheck - verify no TypeScript errors
- [x] 8.4 Run linter - verify no new warnings (4 pre-existing warnings remain)
- [ ] 8.5 Manual test: delete watchDir and verify CLI exits with clear fatal error
- [ ] 8.6 Manual test: create file with permission error, verify startup continues with warning

## 9. Documentation

- [x] 9.1 Add JSDoc to ReconcileFatalError explaining each error case
- [x] 9.2 Add JSDoc to ReconcileStats explaining field semantics
- [x] 9.3 Add code comments explaining fatal vs recoverable boundary in implementation
- [ ] 9.4 Update AGENTS.md with error handling guideline (optional - can be separate change)
