# Testing Guide for txtatelier

## Manual Testing Steps for Custom Evolu Platform Layer

### Prerequisites

```bash
# Ensure you're in the project root
cd /home/hobl/code/proj/txtatelier

# Install dependencies (if not done already)
bun install
```

---

## Test 1: First Run - Mnemonic Generation

**Purpose:** Verify that a fresh installation generates a mnemonic and creates the database

**Steps:**

```bash
# 1. Clean slate - remove any existing database
rm -rf ~/.txtatelier

# 2. Run the CLI
bun run --cwd centers/cli start
```

**Expected output:**
```
[txtatelier] Starting...
[file-sync] Initializing...
[file-sync]
[file-sync] First run detected!
[file-sync]
[file-sync] Your mnemonic (save this securely!):
[file-sync]   <24 words separated by spaces>
[file-sync]
[file-sync] ⚠️  IMPORTANT: Save this mnemonic!
[file-sync] ⚠️  You'll need it to access your data on other devices.
[file-sync] ⚠️  Run 'txtatelier show-mnemonic' to see it again.
[file-sync]
[file-sync] Owner ID: <some ID>
[file-sync] Ready
[txtatelier] Running (press Ctrl+C to stop)
```

**Verification:**
- ✅ Mnemonic is shown (24 words)
- ✅ Owner ID is displayed
- ✅ "First run detected!" message appears
- ✅ Process keeps running

**Stop the process:**
```bash
# Press Ctrl+C
```

**Expected shutdown:**
```
[txtatelier] Received SIGINT, shutting down gracefully...
[file-sync] Shutting down...
[file-sync] Stopped
```

---

## Test 2: Database File Creation

**Purpose:** Verify that the SQLite database file is created in the correct location

**Steps:**

```bash
# Check that the database file exists
ls -lh ~/.txtatelier/

# Check the file is a valid SQLite database
file ~/.txtatelier/txtatelier.db
```

**Expected output:**
```bash
# ls output:
total 56K
-rw-rw-r-- 1 user user 56K <date> txtatelier.db

# file output:
/home/user/.txtatelier/txtatelier.db: SQLite 3.x database, last written using SQLite version 3046000, file counter 2, database pages 14, cookie 0x1, schema 4, UTF-8, version-valid-for 2
```

**Verification:**
- ✅ File exists at `~/.txtatelier/txtatelier.db`
- ✅ File is a valid SQLite database
- ✅ File size is reasonable (around 50-60KB)

---

## Test 3: Mnemonic Persistence

**Purpose:** Verify that the mnemonic is persisted and the same owner is used on subsequent runs

**Steps:**

```bash
# 1. Run the CLI again (database already exists)
bun run --cwd centers/cli start
```

**Expected output:**
```
[txtatelier] Starting...
[file-sync] Initializing...
[file-sync] Owner ID: <same ID as Test 1>
[file-sync] Ready
[txtatelier] Running (press Ctrl+C to stop)
```

**Verification:**
- ✅ NO "First run detected!" message (not first run anymore)
- ✅ NO mnemonic displayed (already exists)
- ✅ Same Owner ID as in Test 1 (persistence works!)
- ✅ Process starts without errors

**Stop with Ctrl+C**

---

## Test 4: TypeScript Type Checking

**Purpose:** Verify that all TypeScript types are correct

**Steps:**

```bash
bun run typecheck
```

**Expected output:**
```
$ bunx tsc --noEmit
```

**Verification:**
- ✅ No TypeScript errors
- ✅ Command exits with code 0

---

## Test 5: Linting and Formatting

**Purpose:** Verify code quality and style

**Steps:**

```bash
# Check linting
bun run check
```

**Expected output:**
```
$ bunx biome check .
Checked 12 files in <X>ms. No fixes applied.
```

**Verification:**
- ✅ No linting errors
- ✅ No formatting issues
- ✅ Command exits with code 0

---

## Test 6: Database Inspection (Optional)

**Purpose:** Inspect the SQLite database to verify Evolu tables exist

**Steps:**

```bash
# Install sqlite3 if needed:
# sudo apt install sqlite3

# Open the database
sqlite3 ~/.txtatelier/txtatelier.db

# In the SQLite prompt:
.tables
```

**Expected tables (Evolu creates these):**
```
evolu_history  evolu_message  file
```

**Query the schema:**
```sql
.schema file
```

**Expected schema:**
```sql
CREATE TABLE file (
  id TEXT PRIMARY KEY NOT NULL,
  path TEXT,
  content TEXT,
  contentHash TEXT,
  createdAt BLOB NOT NULL,
  updatedAt BLOB NOT NULL,
  isDeleted INTEGER NOT NULL,
  ownerId BLOB NOT NULL
);
```

**Exit SQLite:**
```
.quit
```

**Verification:**
- ✅ `file` table exists
- ✅ Schema matches expected columns
- ✅ Evolu system tables exist (`evolu_history`, `evolu_message`)

---

## Test 7: Graceful Shutdown (Data Loss Prevention)

**Purpose:** Verify that data is flushed to disk even during the 5-second debounce window

**Steps:**

```bash
# 1. Start the CLI
bun run --cwd centers/cli start

# 2. Wait 2-3 seconds (within debounce window)

# 3. Press Ctrl+C immediately
```

**Expected output:**
```
[txtatelier] Received SIGINT, shutting down gracefully...
[file-sync] Shutting down...
[file-sync] Stopped
```

**Verification:**
- ✅ Shutdown completes without errors
- ✅ No database corruption warnings
- ✅ Process exits cleanly

**Restart to verify data persisted:**
```bash
bun run --cwd centers/cli start
# Should show same Owner ID (no data loss)
```

---

## Test 8: WAL Mode Verification

**Purpose:** Verify that SQLite is using WAL (Write-Ahead Logging) mode

**Steps:**

```bash
# 1. Start the CLI
bun run --cwd centers/cli start &

# 2. Check for WAL files
ls -la ~/.txtatelier/

# 3. Stop the CLI
kill %1
```

**Expected files:**
```
txtatelier.db       # Main database
txtatelier.db-wal   # Write-Ahead Log file (may appear)
txtatelier.db-shm   # Shared memory file (may appear)
```

**Note:** WAL files may not always be visible depending on timing and whether there are pending writes.

**Alternative verification - query the database:**
```bash
sqlite3 ~/.txtatelier/txtatelier.db "PRAGMA journal_mode;"
```

**Expected output:**
```
wal
```

**Verification:**
- ✅ WAL mode is enabled (output shows "wal")
- ✅ WAL files may appear during operation

---

## Test 9: Multiple Rapid Starts/Stops

**Purpose:** Verify stability and prevent resource leaks

**Steps:**

```bash
# Bash/Zsh:
for i in {1..3}; do
  echo "Run $i"
  timeout 2 bun run --cwd centers/cli start || true
  sleep 1
done

# Fish shell:
for i in (seq 1 3)
  echo "Run $i"
  timeout 2 bun run --cwd centers/cli start; or true
  sleep 1
end
```

**Expected output:**
```
Run 1
[txtatelier] Starting...
[file-sync] Initializing...
[file-sync] Owner ID: <ID>
[file-sync] Ready
...

Run 2
[txtatelier] Starting...
[file-sync] Initializing...
[file-sync] Owner ID: <same ID>
[file-sync] Ready
...

Run 3
[txtatelier] Starting...
[file-sync] Initializing...
[file-sync] Owner ID: <same ID>
[file-sync] Ready
...
```

**Verification:**
- ✅ All runs start successfully
- ✅ Same Owner ID every time
- ✅ No errors about locked database
- ✅ No resource leak warnings

---

## Test 10: Clean Reinstall

**Purpose:** Verify fresh installation works after cleanup

**Steps:**

```bash
# 1. Remove database
rm -rf ~/.txtatelier

# 2. Verify removal
ls ~/.txtatelier
# Should show: "No such file or directory"

# 3. Run CLI
bun run --cwd centers/cli start
```

**Expected output:**
```
[file-sync] First run detected!
[file-sync] Your mnemonic (save this securely!):
[file-sync]   <NEW mnemonic, different from before>
[file-sync] Owner ID: <NEW ID, different from before>
```

**Verification:**
- ✅ New mnemonic generated
- ✅ New Owner ID (different from previous tests)
- ✅ "First run detected!" appears again
- ✅ Database recreated successfully

---

## Success Criteria Summary

**All tests should pass with:**
- ✅ No TypeScript errors
- ✅ No linting/formatting issues
- ✅ First run shows mnemonic (24 words)
- ✅ Subsequent runs use same Owner ID
- ✅ Database file created at `~/.txtatelier/txtatelier.db`
- ✅ Graceful shutdown works (no data loss)
- ✅ WAL mode enabled
- ✅ SQLite database valid and queryable
- ✅ Multiple starts/stops work without errors
- ✅ Clean reinstall generates new owner

---

## Troubleshooting

### Issue: "Database locked" error

**Cause:** Another process is accessing the database

**Solution:**
```bash
# Check for running processes
ps aux | grep bun

# Kill any stale processes
killall bun

# Remove lock files
rm ~/.txtatelier/txtatelier.db-wal ~/.txtatelier/txtatelier.db-shm
```

### Issue: TypeScript errors after changes

**Cause:** Types may have changed

**Solution:**
```bash
# Reinstall dependencies
bun install

# Rerun type check
bun run typecheck
```

### Issue: Owner ID changes on restart

**Cause:** Database not persisting properly

**Solution:**
```bash
# Check database file exists
ls -lh ~/.txtatelier/txtatelier.db

# Check file permissions
chmod 644 ~/.txtatelier/txtatelier.db

# Check directory permissions
chmod 755 ~/.txtatelier
```

### Issue: Mnemonic shown every time

**Cause:** First-run detection not working

**Solution:**
```bash
# Verify database file exists before starting
ls ~/.txtatelier/txtatelier.db

# If file doesn't exist, the detection is working correctly
# If file exists but mnemonic shows, check the isFirstRun logic
```

---

## Change capture automated tests

**Location:** `tests/` directory in this center

**Status:** ✅ All tests passing (verified 2026-03-01)

### Test Suite Overview

The automated tests verify change capture (Filesystem → Evolu) across basic operations and edge cases.

### Running change capture tests

**Basic functionality test:**
```bash
# From project root
centers/cli/src/file-sync/tests/test-change-capture.sh
```

**What it tests:**
- Insert new file (test.txt)
- Update existing file with changed content
- Skip unchanged file (hash match optimization)
- Insert another file (notes.md)
- Insert empty file (empty.txt)

**Expected results:**
- 3 files in database
- All three sync paths verified (insert, update, no-change)
- Content integrity confirmed via database queries

---

**Edge case test:**
```bash
# From project root
centers/cli/src/file-sync/tests/test-change-capture-edge-cases.sh
```

**What it tests:**
- Files with spaces in names (`file with spaces.txt`)
- Unicode characters in content (世界 🌍)
- Special characters in content (<>&"')
- Rapid updates with debounce (5 updates in 250ms → 1 sync operation)
- Large files (10KB / 200 lines)

**Expected results:**
- 4 files in database
- Unicode content preserved correctly
- Debounce working (multiple rapid events → single sync)
- Large files handled without issues

---

### Test Results

**Last test run:** 2026-03-01

**Basic test:** ✅ PASSED (3/3 files synced correctly)
**Edge case test:** ✅ PASSED (4/4 files synced correctly)

**Performance observations:**
- Sync latency: <200ms (feels instant)
- Debounce effectiveness: 100% (5 events → 1 sync)
- CPU usage: Minimal
- Memory usage: Stable

**Detailed results:** See `tests/TEST_RESULTS.md`

---

### Manual change capture testing

If you want to manually test change capture:

```bash
# 1. Clean state
rm -rf ~/.txtatelier/txtatelier.db ~/.txtatelier/watched/*

# 2. Start CLI
bun run --cwd centers/cli start

# 3. In another terminal, create/modify files
echo "test content" > ~/.txtatelier/watched/test.txt
echo "updated content" > ~/.txtatelier/watched/test.txt
echo "same content" > ~/.txtatelier/watched/test.txt

# 4. Verify in logs (should see: Insert, Update, No change)

# 5. Check database
sqlite3 ~/.txtatelier/txtatelier.db "SELECT path, content, contentHash FROM file;"
```

**Expected log output:**
```
[watch] rename: test.txt
[sync] Inserting: test.txt
[watch] change: test.txt
[sync] Updating: test.txt
[watch] change: test.txt
[sync] No change: test.txt (hash matches)
```

---

## Next Steps After Testing

Platform layer and change capture are complete. Next phases:

1. ✅ Platform layer implemented
2. ✅ Change capture (Filesystem → Evolu) implemented
3. Phase 1: State materialization (Evolu → Filesystem)
4. Phase 2: Multi-device replication

---

## Contact Tests Summary

### Platform Layer Contact Test

**Success-if:**
- All 10 manual tests pass
- TypeScript compilation clean
- Linting clean
- Database persists across runs
- Same Owner ID on restart
- Graceful shutdown without data loss

**Failure-if:**
- Any test fails
- TypeScript errors
- Database corruption
- Different Owner ID on restart
- Data loss on shutdown
- Process crashes

**Status:** ✅ PASSED (2026-03-01)

---

### Change capture contact test

**Success-if:**
- Files created/updated in watch directory sync to Evolu within 200ms
- Hash matches prevent unnecessary updates
- CPU usage <5%
- Manual testing shows all three paths work correctly (insert, update, no-change)
- Automated tests pass

**Failure-if:**
- Sync failures
- Duplicate updates for unchanged content
- High CPU usage
- Sync latency >500ms

**Status:** ✅ PASSED (2026-03-01)

**Evidence:**
- Automated test suite: 2/2 tests passed (basic + edge cases)
- Total test cases: 9/9 passed
- Performance: Sync latency <200ms, CPU minimal
- Debounce: 100% effective (5 rapid updates → 1 sync)
- Unicode/special characters: Preserved correctly

**Timeline:** Immediate (tested same day)
