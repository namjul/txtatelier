# Contact Test: prevent-duplicate-instance-start

## Evidence tier
proximal

## What would success look like?
When attempting to start a second txtatelier instance on a watch directory that already has a running instance:
- The second start fails immediately (within 500ms of process launch)
- The error message clearly states "Instance already running on <directory>" or similar, with the conflicting directory path visible
- The error message includes the process ID of the running instance
- No SQLite database files are created or modified by the second instance
- No files in the watch directory are created, modified, or deleted
- The exit code is non-zero (different from normal success)

## What would falsify this claim?
- Second instance starts successfully and both run concurrently
- Error message is generic (e.g., "Error" without explaining why)
- Error mentions the directory but doesn't explain it's already in use
- Second instance creates/modifies database files before failing
- Any files in the watch directory are touched (created/modified/deleted) by the second instance
- Exit code is 0 (success), making scripted detection impossible

## How will we check?
Manual test procedure:
1. Start txtatelier instance A on watch directory `/tmp/test-dir` (Terminal 1)
2. Wait for instance A to complete startup (sync loop running, prompt visible)
3. In Terminal 2, attempt to start txtatelier instance B on the same `/tmp/test-dir`
4. Observe the error output in Terminal 2
5. Check exit code: `echo $?`
6. Verify no new files appeared in `/tmp/test-dir`
7. Check that instance A continues running unaffected

Automated verification (if available):
- Run integration test that spawns two processes and asserts the second fails

## When will we check?
Immediately after implementation completes, before merging to main.

If any falsifying observation occurs, the implementation must be revised.
