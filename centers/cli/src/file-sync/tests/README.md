# Loop A & Loop B Tests

## Automated Tests

### Loop A (Filesystem → Evolu)

**Bash:**
```bash
./test-loop-a.sh
./test-loop-a-edge-cases.sh
./test-directional-invariants.sh
```

Tests: Insert, Update, No-change, Empty files, Unicode, Large files
Directional invariants: Capture does not materialize, Materialize does not mutate mirror file rows

### Loop B (Evolu → Filesystem)

**Fish shell:**
```fish
fish test-loop-b-manual.fish
```

**What it tests:**
- Loop B processes existing Evolu rows on startup
- Echo prevention (skips own ownerId)
- Remote files (different ownerId) are written to disk
- `_syncState` table tracks applied hashes

**How it works:**
1. Creates database via Loop A
2. Manually inserts "remote" files (different ownerId) via SQL
3. Restarts CLI
4. Loop B's `loadQuery` fetches existing rows
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
# Watch for: [loop-b] Initial load: 1 existing files

# Terminal 2: Verify
cat ~/.txtatelier/watched/remote.txt
# Should show: "Hello from remote!"
```

## Understanding Loop B Behavior

**Why restart is needed for manual testing:**

- Direct SQLite inserts bypass Evolu's mutation system
- `subscribeQuery` only fires on Evolu API changes (insert/update/delete)
- `loadQuery` explicitly fetches existing rows on startup

**In real multi-device scenarios:**

- Device A uses `evolu.insert()` → Evolu syncs → Device B's subscription fires automatically
- No restart needed!

## Test Results

See `TEST_RESULTS.md` for detailed results from automated tests.
