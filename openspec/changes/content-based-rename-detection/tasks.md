## 1. Schema Changes

- [ ] 1.1 Add `_recentDeletions` table definition to `schema.ts`
- [ ] 1.2 Define `RecentDeletionId` type
- [ ] 1.3 Add fields: path, contentHash, deletedAt, evolFileId
- [ ] 1.4 Verify table is local-only (underscore prefix prevents sync)
- [ ] 1.5 Create type exports for RecentDeletion record

## 2. Deletion Tracking Implementation

- [ ] 2.1 Create `state.ts` functions for deletion tracking
- [ ] 2.2 Implement `recordDeletion(path, contentHash, evolFileId, deletedAt)`
- [ ] 2.3 Implement `queryRecentDeletions(contentHash, timeWindow)` 
- [ ] 2.4 Implement `clearDeletionRecord(evolFileId)`
- [ ] 2.5 Implement `garbageCollectDeletions(cutoffTime)` 
- [ ] 2.6 Add unit tests for deletion tracking functions

## 3. Rename Detection Logic

- [ ] 3.1 Update `change-capture-plan.ts` to add rename detection
- [ ] 3.2 On file deletion, call `recordDeletion()` with file metadata
- [ ] 3.3 On file creation, query recent deletions with contentHash
- [ ] 3.4 If match found within time window, return UPDATE_PATH action
- [ ] 3.5 If no match, return INSERT action (existing behavior)
- [ ] 3.6 Add unit tests for rename detection decision logic

## 4. Action Type and Executor

- [ ] 4.1 Define `UpdatePathAction` type in `actions.ts`
- [ ] 4.2 Add fields: type, evolFileId, newPath, oldPath
- [ ] 4.3 Implement `executeUpdatePath()` in `executor.ts`
- [ ] 4.4 Use Evolu update to change path field on existing row
- [ ] 4.5 Clear isDeleted flag if set
- [ ] 4.6 Update updatedAt timestamp
- [ ] 4.7 Call `clearDeletionRecord()` after successful update
- [ ] 4.8 Add unit tests for path update execution

## 5. Startup Reconciliation Integration

- [ ] 5.1 Update `reconcileStartupFilesystemState()` for renames
- [ ] 5.2 On file found on disk but missing in Evolu, check for recent Evolu deletions
- [ ] 5.3 Query Evolu deleted rows with matching contentHash
- [ ] 5.4 If match found, update row path instead of insert
- [ ] 5.5 Handle case where CLI was offline for extended period (no time window limit)
- [ ] 5.6 Add integration test for offline rename detection

## 6. Garbage Collection

- [ ] 6.1 Add garbage collection interval (60 seconds) in `index.ts`
- [ ] 6.2 Set retention threshold (10 seconds)
- [ ] 6.3 Call `garbageCollectDeletions()` periodically
- [ ] 6.4 Clean up interval on CLI shutdown
- [ ] 6.5 Add test for garbage collection timing

## 7. Logging and Observability

- [ ] 7.1 Add INFO log when rename detected: `[rename] Detected: oldPath → newPath`
- [ ] 7.2 Add WARN log for potential false positives
- [ ] 7.3 Add debug logs for deletion tracking operations
- [ ] 7.4 Add `renamesDetected` counter to FileSyncSession
- [ ] 7.5 Increment counter on each successful rename detection
- [ ] 7.6 Verify logs appear in test scenarios

## 8. Conflict Detection Enhancement

- [ ] 8.1 Update remote deletion conflict handler in `state-materialization.ts`
- [ ] 8.2 When remote deletion detected, search for files with matching contentHash
- [ ] 8.3 If match found, include rename suggestion in conflict message
- [ ] 8.4 Update conflict file content template with rename guidance
- [ ] 8.5 Add integration test for rename-related conflict messaging

## 9. Integration Testing

- [ ] 9.1 Test: Single device rename - verify path update in Evolu
- [ ] 9.2 Test: Multi-device rename - Device A renames, Device B syncs
- [ ] 9.3 Test: Rename within time window - detection succeeds
- [ ] 9.4 Test: Rename outside time window - falls back to delete + create
- [ ] 9.5 Test: Rename with content change - no detection (hash differs)
- [ ] 9.6 Test: Two identical files - false positive logged
- [ ] 9.7 Test: Offline rename - detected at startup
- [ ] 9.8 Test: Concurrent rename on two devices - conflict handling
- [ ] 9.9 Test: Garbage collection removes old records
- [ ] 9.10 Test: Rename across directories - detection works

## 10. Performance Testing

- [ ] 10.1 Benchmark: 1000 file operations with rename detection enabled
- [ ] 10.2 Measure query overhead per file operation (<5ms target)
- [ ] 10.3 Verify overall overhead <10% compared to without rename detection
- [ ] 10.4 Test memory usage with large deletion table (1000+ records)
- [ ] 10.5 Optimize contentHash index if queries are slow

## 11. Documentation

- [ ] 11.1 Update AGENTS.md with rename detection behavior
- [ ] 11.2 Document time window configuration (future)
- [ ] 11.3 Document false positive scenarios and mitigations
- [ ] 11.4 Add JSDoc for all new public functions
- [ ] 11.5 Update IMPLEMENTATION_PLAN.md to mark rename detection as implemented

## 12. Validation

- [ ] 12.1 Run all existing integration tests - verify no regressions
- [ ] 12.2 Run all unit tests - verify all pass
- [ ] 12.3 Run typecheck - verify no TypeScript errors
- [ ] 12.4 Run linter - verify no new warnings
- [ ] 12.5 Manual test: Rename file with CLI running, check logs
- [ ] 12.6 Manual test: Rename file while CLI offline, restart and verify detection
- [ ] 12.7 Manual test: Rename on Device A, sync to Device B, verify no conflict
