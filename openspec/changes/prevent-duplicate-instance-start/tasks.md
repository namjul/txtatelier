# Tasks: prevent-duplicate-instance-start

## 1. Setup

- [x] 1.1 Add `proper-lockfile` dependency to `centers/cli/package.json`
- [x] 1.2 Install dependencies (`bun install` in centers/cli)

## 2. Core Implementation

- [x] 2.1 Create `centers/cli/src/file-sync/platform/InstanceLock.ts`
  - Define `InstanceLockError` type with "AlreadyLocked" and "LockFailed" variants
  - Define `InstanceLock` interface with `acquire()` and `release()` methods
  - Implement `createInstanceLock(watchDir)` using `proper-lockfile`
  - Handle lock acquisition failure and extract PID from lock metadata if available
  - Add proper error handling and Result types
- [x] 2.2 Export `InstanceLock` and `InstanceLockError` from `centers/cli/src/file-sync/platform/index.ts`

## 3. CLI Integration

- [x] 3.1 Modify `centers/cli/src/index.ts` `runStart()` function
  - Import `createInstanceLock` from platform module
  - Create lock instance immediately after determining `watchDir`
  - Call `acquire()` before `startFileSync()`
  - On lock failure, print error message with directory path and PID
  - Exit with code 2 on duplicate instance (distinct from code 1 for other errors)
  - Ensure lock release on graceful shutdown (SIGTERM, SIGINT)
- [x] 3.2 Add error message formatting function for duplicate instance error
  - Include watch directory path
  - Include holding process PID (if retrievable)
  - Provide clear next steps: "kill <pid>" or use different directory

## 4. Testing & Verification

- [x] 4.1 Test duplicate instance detection manually
  - Start instance A on a test directory
  - Attempt to start instance B on same directory
  - Verify instance B fails with exit code 2 and clear error message
  - Verify instance A continues running unaffected
- [x] 4.2 Verify lock cleanup on graceful exit
  - Start txtatelier, then Ctrl+C
  - Verify lock is released (can start new instance immediately)
- [x] 4.3 Run existing tests to ensure no regressions

## 5. Document co-variance (delta specs)

- [x] 5.1 Create `openspec/changes/prevent-duplicate-instance-start/specs/instance-lock/spec.md`
  - Document the new `instance-lock` capability
  - Specify behavior: atomic acquisition, stale detection, error messages
  - Include scenarios: success path, failure path, graceful exit, crash recovery
- [x] 5.2 Update `openspec/changes/prevent-duplicate-instance-start/specs/startup-validation/spec.md` (if not exists, create)
  - Document startup validation sequence including lock check
  - Specify order: args → lock check → Evolu init → sync loops
