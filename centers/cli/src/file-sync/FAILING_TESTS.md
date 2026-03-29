# Failing Integration Tests

## The 2 failing tests

Both in `src/file-sync/index.test.ts`, under `GIVEN file exists in both Evolu and disk`:

1. **"WHEN file is modified on disk while offline > THEN changes sync to Evolu on startup"**
   - Expects `rows[0]?.content` to be `"modified offline"`, receives `"synced content"`

2. **"WHEN file is edited in Evolu and deleted on disk while offline > THEN remote edit is applied on startup"**
   - Expects `rows2` to have length 1, receives length 2

Both pass in isolation. Both fail when the full suite runs.

## What these tests cover

Two-phase startup reconciliation in `startFileSync`:
- Phase 1 (`reconcileStartupEvoluState`): evolu→fs — applies Evolu state to disk
- Phase 2 (`reconcileStartupFilesystemState`): fs→evolu — captures disk state into Evolu

## Root cause theory

Phase 1 overwrites the offline disk change when it should skip.

It should skip because `lastAppliedHash === evolHash` (meaning: the Evolu version is the
one we already applied to disk — no new remote change). But if `lastAppliedHash` is null,
`detectConflict` returns false → falls through to safe-to-apply → **overwrites disk with
Evolu content**. Phase 2 then sees disk matches Evolu → skips. Evolu row stays at old content.

**Why `lastAppliedHash` might be null when it shouldn't be**: `_syncState.lastAppliedHash`
is normally set by `startStateMaterialization`'s debounce (500ms after a mutation). The
inner `beforeEach` wait is also exactly 500ms — a race condition. If the debounce hasn't
fired before `session1.stop()`, `lastAppliedHash` is never set.

## Approaches tried

### Fix: add `setTrackedHash` to both insert and update branches of `planChangeCapture`

So that fs→evolu capture sets `lastAppliedHash` immediately (synchronously, no debounce
dependency). This fix is currently in the code (`change-capture-plan.ts` lines 81, 89).
Tests still fail.

### Investigation of test isolation

Confirmed tests pass in isolation, fail together. Spent significant time tracing async
mutation ordering, Evolu worker timing, and in-memory SQLite execution. No clear answer
found. The logical flow with the fix in place should work, but empirically doesn't.

## Reproduce with the real CLI

This is a real bug, not just a test artifact. If the CLI is killed before `_syncState` is
persisted, the next startup treats all files as "never applied" and overwrites offline disk
changes with the Evolu version.

### Steps to trigger it

1. Start the CLI and let it sync a file:
   ```sh
   bun run src/index.ts sync --watch-dir /tmp/test-txtatelier
   echo "original content" > /tmp/test-txtatelier/note.txt
   # wait ~2s for the file to sync into Evolu
   ```

2. Kill the process hard (before the 5s debounced DB save fires):
   ```sh
   kill -9 <pid>
   # or Ctrl+\ (SIGQUIT), NOT Ctrl+C which triggers graceful shutdown
   ```

3. Modify the file while the CLI is offline:
   ```sh
   echo "my offline edit" > /tmp/test-txtatelier/note.txt
   ```

4. Restart the CLI:
   ```sh
   bun run src/index.ts sync --watch-dir /tmp/test-txtatelier
   ```

5. Check the file — if the bug is present, `note.txt` will revert to `"original content"`.
   Your offline edit is silently overwritten.

### Why kill -9 and not Ctrl+C

Ctrl+C sends SIGINT → graceful shutdown → `stop()` is called → `flush()` persists
`_syncState` → no bug. The bug requires `_syncState` to NOT be persisted, which happens
when the process exits without calling `flush()`. `kill -9` (or a crash) bypasses it.

The 5s save debounce in `SqlJsDriver` (`SAVE_DEBOUNCE_MS = 5000`) means you have a
~5s window after the file is first synced where killing the process will leave `_syncState`
unpersisted.

## Manual investigation steps

### Reproduce the failure
```sh
# Fails (runs full suite):
bun test src/file-sync/index.test.ts

# Passes (isolated):
bun test --test-name-pattern "modified on disk while offline" src/file-sync/index.test.ts
bun test --test-name-pattern "edited in Evolu and deleted on disk while offline" src/file-sync/index.test.ts
```

### Find the minimum repro

Run the failing test together with just one preceding test at a time to find which one
poisons the state:

```sh
bun test --test-name-pattern "file is added to Evolu while offline|modified on disk while offline" src/file-sync/index.test.ts
bun test --test-name-pattern "file is deleted in Evolu while offline|modified on disk while offline" src/file-sync/index.test.ts
```

### Inspect `_syncState` inside a test

Add this snippet just before session2 starts (in the "modified on disk while offline" test
body) to see what `lastAppliedHash` actually is:

```ts
const debugQuery = session1.evolu.createQuery((db) =>
  db.selectFrom("_syncState").selectAll(),
);
const debugRows = await session1.evolu.loadQuery(debugQuery);
console.log("_syncState before session2:", JSON.stringify(debugRows, null, 2));
```

### Trace which plan phase1 actually runs

Add a log in `planStateMaterialization` (or `reconcileStartupEvoluState`) to print the
exact values of `lastAppliedHash`, `diskHash`, `evolHash` for `synced.txt` during session2
startup. The expectation is `lastAppliedHash === evolHash === H1` → skip. If it's printing
`lastAppliedHash = null`, the fix isn't landing.

### Check if `setTrackedHash` actually executes

In `executor.ts`, `SET_TRACKED_HASH` calls `setTrackedHashState`. Add a `console.log`
there to confirm it's being called with the right path and hash during session1's
`reconcileStartupFilesystemState`.

### Verify timing with a longer wait

Change the inner `beforeEach` wait from 500ms to 2000ms and re-run the full suite. If
tests now pass, the race with `SUBSCRIPTION_DEBOUNCE_MS=500ms` is confirmed and the fix
isn't actually landing in time (or at all).

```ts
// line 284 in index.test.ts
await new Promise((resolve) => setTimeout(resolve, 2000)); // was 500
```

## Approaches NOT tried

1. **Add explicit debug logging to the tests** — print `lastAppliedHash`, `diskHash`,
   `evolHash` at each startup phase step for the failing tests. Would immediately reveal
   which assumption is wrong.

2. **Increase `beforeEach` wait from 500ms to 1500ms** — brute-force eliminate the
   debounce race without relying on the fix.

3. **Add `await session.flush()` before `session1.stop()` in the inner `beforeEach`** —
   ensure pending mutations are fully committed to the in-memory SQLite before the session
   ends.

4. **Fix `createSyncStateQuery` to filter `isDeleted IS NOT true`** — currently returns
   soft-deleted rows, which could return a stale `lastAppliedHash` after a prior
   `clearTrackedHash`. Probably unrelated to the fresh-DB case but untested.

5. **Add an `afterEach` that stops any lingering sessions** — the current `afterEach` is
   a commented-out no-op. If a test fails mid-run without calling `stop()`, the session
   leaks timers/subscriptions into the next test.

6. **Isolate which preceding test causes the failure** — run only tests N-1 + N to find
   the minimum repro. The two failing tests are the 3rd and 6th in their describe block.
