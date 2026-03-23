# Tasks: beautiful-reconciliation-patterns

## Implementation

### 1. Create pipeline utility module

- [ ] 1.1 Create `centers/cli/src/file-sync/utils/pipeline.ts`
  - Implement `pipe` function (left-to-right composition)
  - Implement `batch` generator for chunking arrays
  - Implement `concurrentMap` for parallel async processing
  - Implement `scan` for streaming state aggregation
  - All with proper TypeScript types

### 2. Apply pipeline to startup reconciliation

- [ ] 2.1 Refactor `reconcileStartupFilesystemState`
  - Replace manual batch loop with pipeline
  - Keep preloading and error tracking

- [ ] 2.2 Refactor `reconcileStartupEvoluState`
  - Replace manual batch loops (deletions and active rows)
  - Use scan for progress tracking instead of manual counter

### 3. Verify and test

- [ ] 3.1 Run test suite
  - All existing tests pass
  - No behavioral changes

- [ ] 3.2 Performance check (optional)
  - Time reconciliation with 1000 files
  - Should be comparable to before

## Co-variance notes

<!-- Add notes here as implementation progresses -->

## Load-bearing assumptions that didn't hold

<!-- Record any assumptions that turned out wrong during implementation -->
