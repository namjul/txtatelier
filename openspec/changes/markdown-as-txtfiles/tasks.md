# Tasks: markdown-as-txtfiles

## Implementation

### 1. Update file filter function

- [x] 1.1 Modify `isTxtFile` in `centers/cli/src/file-sync/sync/change-capture-plan.ts`
  - Change extension check from `=== ".txt"` to allowlist: `[".txt", ".md"]`
  - Update the skip message from "non-txt file" to "non-text file"

- [x] 1.2 Update `startup-reconciliation.ts` if it imports `isTxtFile`
  - Verify it picks up the updated function automatically (if imported)
  - No changes needed if it's just importing the function

### 2. Update tests

- [x] 2.1 Find and update tests that check for `.txt`-only behavior
  - Search for test files that test the file filter
  - Add test cases for `.md` files
  - Ensure existing `.txt` tests still pass

### 3. Verification

- [x] 3.1 Run the test suite
  - All existing tests should pass
  - New `.md` tests should pass

- [x] 3.2 Manual verification (optional but recommended)
  - Create a `.md` file in the watch directory
  - Verify it appears in the file list
  - Verify it syncs to Evolu
  - Verify it behaves identically to `.txt` files

## Co-variance notes

<!-- Add notes here as implementation progresses -->

## Load-bearing assumptions that didn't hold

<!-- Record any assumptions that turned out wrong during implementation -->
