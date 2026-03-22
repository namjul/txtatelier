# Tasks: sync-txt-files

## Implementation

### 1. Add the txt filter to change-capture-plan

- [x] 1.1 Add `isTxtFile(path: string): boolean` inline in `change-capture-plan.ts` — uses `path.extname` normalized to lowercase, returns true only for `.txt`
- [x] 1.2 Insert the filter check after the ignore check, before deletion handling — skip with `"not-txt-file"` reason for non-txt files where `state.evolId === null`
- [x] 1.3 Ensure files with `state.evolId !== null` and `state.diskHash === null` (deletion of a previously-synced record) pass through the filter regardless of extension — to avoid ghost records
- [x] 1.4 Add a debug-level log entry for skipped non-txt files, consistent with the existing skip log pattern

### 2. Tests

- [x] 2.1 Add a test case: non-txt file with no Evolu record → `skip("not-txt-file")`
- [x] 2.2 Add a test case: non-txt file with an existing Evolu record and `diskHash === null` (deletion) → mark deleted (filter bypass)
- [x] 2.3 Add a test case: `.txt` file passes through and produces insert/update/skip as normal
- [x] 2.4 Add a test case: `.TXT` (uppercase) is treated as `.txt`

### 3. Verify contact test

- [ ] 3.1 Run a local sync against a mixed directory (`note.txt`, `readme.md`, `image.png`, `data.json`) and confirm only `note.txt` appears in Evolu
- [ ] 3.2 Restart the watcher (startup reconciliation path) and confirm the same result

## Co-variance notes

_Add notes here during implementation._

## Load-bearing assumptions that didn't hold

_Add notes here if any design assumptions proved wrong during implementation._
