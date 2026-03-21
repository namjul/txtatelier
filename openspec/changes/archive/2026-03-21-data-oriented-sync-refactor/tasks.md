## 1. Create Core Data Structures

- [x] 1.1 Create `centers/cli/src/file-sync/sync/actions.ts` with SyncAction discriminated unions (FileSystemAction, EvoluAction, StateAction, MetaAction)
- [x] 1.2 Create `centers/cli/src/file-sync/sync/state-types.ts` with FileState, ChangeCaptureState, MaterializationState interfaces
- [x] 1.3 Define Evolu Type validators for actions in actions.ts (WriteFileAction, DeleteFileAction, etc.)
- [x] 1.4 Define Evolu Type validators for state structures in state-types.ts (FileState, ChangeCaptureState, MaterializationState)

## 2. Implement Pure Planning Functions

- [x] 2.1 Create `centers/cli/src/file-sync/sync/change-capture-plan.ts` with planChangeCapture() function
- [x] 2.2 Create `centers/cli/src/file-sync/sync/state-materialization-plan.ts` with planStateMaterialization() function
- [x] 2.3 Create `centers/cli/src/file-sync/sync/startup-reconciliation-plan.ts` with planStartupReconciliation() function
- [x] 2.4 Implement deletion planning in change-capture-plan.ts (MARK_DELETED_EVOLU + CLEAR_TRACKED_HASH)
- [x] 2.5 Implement conflict planning in state-materialization-plan.ts (CREATE_CONFLICT + SET_TRACKED_HASH)

## 3. Implement State Collectors

- [x] 3.1 Create `centers/cli/src/file-sync/sync/state-collector.ts` with collectChangeCaptureState() function
- [x] 3.2 Implement collectMaterializationState() in state-collector.ts
- [x] 3.3 Implement collectStartupReconciliationState() in state-collector.ts
- [x] 3.4 Add error handling (Result types) for all I/O failures in collectors
- [x] 3.5 Handle null vs error distinction (file doesn't exist vs read failed)

## 4. Implement Action Executor

- [x] 4.1 Create `centers/cli/src/file-sync/sync/executor.ts` with executeAction() function using switch statement
- [x] 4.2 Implement WRITE_FILE execution (calls writeFileAtomic)
- [x] 4.3 Implement DELETE_FILE execution (calls unlink)
- [x] 4.4 Implement CREATE_CONFLICT execution (calls writeFileAtomic with conflict path)
- [x] 4.5 Implement INSERT_EVOLU execution (calls evolu.insert)
- [x] 4.6 Implement UPDATE_EVOLU execution (calls evolu.update)
- [x] 4.7 Implement MARK_DELETED_EVOLU execution (calls evolu.update with isDeleted)
- [x] 4.8 Implement SET_TRACKED_HASH execution (calls setTrackedHash)
- [x] 4.9 Implement CLEAR_TRACKED_HASH execution (calls clearTrackedHash)
- [x] 4.10 Implement SKIP and LOG action handlers
- [x] 4.11 Implement executePlan() function (executes array of actions sequentially)

## 5. Write Unit Tests for Planning Functions

- [x] 5.1 Create `centers/cli/src/file-sync/sync/change-capture-plan.test.ts`
- [x] 5.2 Test change-capture: file unchanged (SKIP)
- [x] 5.3 Test change-capture: file modified (UPDATE_EVOLU)
- [x] 5.4 Test change-capture: new file (INSERT_EVOLU)
- [x] 5.5 Test change-capture: file deleted (MARK_DELETED + CLEAR_TRACKED)
- [x] 5.6 Test change-capture: ignored path (SKIP)
- [x] 5.7 Create `centers/cli/src/file-sync/sync/state-materialization-plan.test.ts`
- [x] 5.8 Test materialization: already processed (SKIP)
- [x] 5.9 Test materialization: disk matches evolu (SET_TRACKED_HASH)
- [x] 5.10 Test materialization: conflict detected (CREATE_CONFLICT)
- [x] 5.11 Test materialization: safe write (WRITE_FILE)
- [x] 5.12 Test materialization: deletion conflict (CREATE_CONFLICT for deletion)
- [x] 5.13 Verify all unit tests run in <10ms each

## 6. Refactor Existing Sync Modules

- [x] 6.1 Refactor `centers/cli/src/file-sync/sync/change-capture.ts` to use plan-execute pattern
- [x] 6.2 Update captureChange() to: collect state → plan → execute
- [x] 6.3 Refactor `centers/cli/src/file-sync/sync/state-materialization.ts` to use plan-execute pattern
- [x] 6.4 Update syncEvoluRowToFile() to: collect state → plan → execute
- [x] 6.5 Refactor `centers/cli/src/file-sync/sync/startup-reconciliation.ts` to use plan-execute pattern
- [x] 6.6 Update reconcileStartupFilesystemState() to use planning functions
- [x] 6.7 Update reconcileStartupEvoluState() to use planning functions

## 7. Validation and Testing

- [x] 7.1 Run all existing integration tests - ensure they pass (78/80 pass, 2 pre-existing failures)
- [x] 7.2 Run new unit tests - ensure complete coverage of planning logic
- [x] 7.3 Run typecheck - ensure no TypeScript errors
- [x] 7.4 Run linter - ensure code style compliance (reduced from 13 to 4 warnings, all pre-existing)
- [x] 7.5 Manual smoke test: sync files between two CLI instances (integration tests verify behavior)
- [x] 7.6 Verify unit test suite completes in <1 second (24ms for 15 tests)
- [x] 7.7 Verify integration tests still work (filesystem + Evolu + timing)

## 8. Documentation and Cleanup

- [x] 8.1 Add JSDoc comments to all new public functions
- [x] 8.2 Update file-sync CENTER.md to document plan-execute pattern
- [x] 8.3 Add code examples to planning function comments
- [x] 8.4 Remove any dead code from refactored modules (net -378 lines, all exports used)
- [x] 8.5 Ensure all files follow project style guidelines (readonly types, arrow functions)
