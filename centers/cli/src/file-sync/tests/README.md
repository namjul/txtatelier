# Change Capture & State Materialization Tests

## Automated Tests

### Change Capture (Filesystem → Evolu)

**Bash:**
```bash
./test-loop-a.sh
./test-loop-a-edge-cases.sh
./test-directional-invariants.sh
./test-conflict-artifact-callback.sh
./test-startup-reconciliation.sh
./test-remote-delete-safe.sh
./test-remote-delete-conflict.sh
```

Tests: Insert, Update, No-change, Empty files, Unicode, Large files
Directional invariants: Capture does not materialize, Materialize does not mutate mirror file rows

### State Materialization (Evolu → Filesystem)

**Fish shell:**
```fish
fish test-loop-b-manual.fish
```

**What it tests:**
- State Materialization processes existing Evolu rows on startup
- Echo prevention (skips own ownerId)
- Remote files (different ownerId) are written to disk
- `_syncState` table tracks applied hashes

**How it works:**
1. Creates database via Change Capture
2. Manually inserts "remote" files (different ownerId) via SQL
3. Restarts CLI
4. State Materialization `loadQuery` fetches existing rows
5. Files with different ownerId are written to filesystem
6. Files with own ownerId are skipped (echo prevention)

## Manual Testing

### Quick Test: Create Remote File

```fish
# Terminal 1: Start CLI
cd centers/cli
rm -rf ~/.txtatelier/txtatelier.db ~/.txtatelier/watched/*
bun run start
# Wait for "Ready", then Ctrl+C

# Terminal 2: Insert remote file
sqlite3 ~/.txtatelier/txtatelier.db "
INSERT INTO file (id, path, content, contentHash, createdAt, updatedAt, isDeleted, ownerId)
VALUES (
  'remote-001',
  'remote.txt',
  'Hello from remote!',
  'hash999',
  X'0000018E0000000000',
  X'0000018E0000000000',
  0,
  'RemoteOwner999'
);
"

# Terminal 1: Restart CLI
bun run start
# Watch for: [materialize] Initial load: 1 existing files

# Terminal 2: Verify
cat ~/.txtatelier/watched/remote.txt
# Should show: "Hello from remote!"
```

## Understanding State Materialization Behavior

**Why restart is needed for manual testing:**

- Direct SQLite inserts bypass Evolu's mutation system
- `subscribeQuery` only fires on Evolu API changes (insert/update/delete)
- `loadQuery` explicitly fetches existing rows on startup

**In real multi-device scenarios:**

- Device A uses `evolu.insert()` → Evolu syncs → Device B's subscription fires automatically
- No restart needed!

## Startup Capture Note

- Watcher startup uses `ignoreInitial: true` to prevent synthetic `add` events for pre-existing files.
- This avoids a boot race between capture and materialization when both loops start together.
- Pre-existing filesystem-only files should be handled by explicit startup reconciliation, not by watcher side effects.
- Temporary write artifacts (`.tmp-*`) are ignored by capture/materialization/reconciliation.
- `test-startup-reconciliation.sh` verifies this behavior end-to-end.

## Test Results

See `TEST_RESULTS.md` for detailed results from automated tests.

## TODO

- Remake legacy test scripts that still grep old loop tags (`[loop-a]`, `[loop-b]`) to use `[capture]` and `[materialize]`.
