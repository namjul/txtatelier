#!/usr/bin/env fish
# Manual test for Loop B (Evolu → Filesystem)
# Tests that Loop B processes existing rows on startup and skips own ownerId

echo "=== Loop B Manual Test (Fish Shell) ==="
echo ""

set WATCH_DIR "$HOME/.txtatelier/watched"
set DB_PATH "$HOME/.txtatelier/txtatelier.db"
set PROJECT_ROOT (cd (dirname (status -f))/../../../../..; and pwd)

# Clean state
echo "[1/10] Cleaning state..."
rm -rf $DB_PATH $WATCH_DIR
mkdir -p $WATCH_DIR

# Start CLI to create database and tables
echo "[2/10] Starting CLI to initialize database..."
cd $PROJECT_ROOT/centers/cli
timeout 8s bun run start > /tmp/loop-b-init.log 2>&1 &
set CLI_PID $last_pid
sleep 4

# Create a file via Loop A (creates tables)
echo "[3/10] Creating file via Loop A (initializes tables)..."
echo "Setup file for table creation" > $WATCH_DIR/setup.txt
sleep 2

# Stop CLI
echo "[4/10] Stopping CLI..."
kill $CLI_PID 2>/dev/null; or true
sleep 2

# Get our owner ID
set OUR_OWNER_ID (sqlite3 $DB_PATH "SELECT appOwnerId FROM evolu_config LIMIT 1;")
echo "[5/10] Our owner ID: $OUR_OWNER_ID"

# Insert a "remote" file (different ownerId)
echo "[6/10] Inserting remote file into database..."
sqlite3 $DB_PATH "
INSERT INTO file (id, path, content, contentHash, createdAt, updatedAt, isDeleted, ownerId)
VALUES (
  'remote-file-001',
  'from-remote-device.txt',
  'Hello from another device!',
  'remotehash123',
  X'0000018E0000000000',
  X'0000018E0000000001',
  0,
  'RemoteDeviceOwner123'
);
"

# Insert another remote file
echo "[7/10] Inserting second remote file..."
sqlite3 $DB_PATH "
INSERT INTO file (id, path, content, contentHash, createdAt, updatedAt, isDeleted, ownerId)
VALUES (
  'remote-file-002',
  'another-remote.txt',
  'Another file from remote device!',
  'remotehash456',
  X'0000018E0000000000',
  X'0000018E0000000002',
  0,
  'RemoteDeviceOwner123'
);
"

# Delete the setup file from disk (but keep in database)
rm $WATCH_DIR/setup.txt

echo "[8/10] Database state before CLI restart:"
sqlite3 -header -column $DB_PATH "SELECT path, substr(ownerId, 1, 20) as ownerId_short FROM file ORDER BY path;"

# Restart CLI (Loop B should process existing rows)
echo ""
echo "[9/10] Restarting CLI (Loop B should process existing rows)..."
echo "Watch for: [materialize] Initial load: 3 existing files"
echo ""
timeout 10s bun run start 2>&1 | tee /tmp/loop-b-restart.log &
set CLI_PID $last_pid
sleep 5

# Stop CLI
kill $CLI_PID 2>/dev/null; or true
sleep 1

# Verify results
echo ""
echo "[10/10] Verification"
echo ""
echo "=== Files in watch directory ==="
ls -la $WATCH_DIR/

echo ""
echo "=== File contents ==="
for file in $WATCH_DIR/*
    echo "--- "(basename $file)" ---"
    cat $file
    echo ""
end

echo ""
echo "=== Expected Results ==="
echo "✓ from-remote-device.txt should exist (different ownerId)"
echo "✓ another-remote.txt should exist (different ownerId)"
echo "✓ setup.txt should NOT exist (our own ownerId, echo prevention)"
echo ""

# Check expectations
set -l success 1

if test -f $WATCH_DIR/from-remote-device.txt
    echo "✅ from-remote-device.txt exists"
else
    echo "❌ from-remote-device.txt NOT found"
    set success 0
end

if test -f $WATCH_DIR/another-remote.txt
    echo "✅ another-remote.txt exists"
else
    echo "❌ another-remote.txt NOT found"
    set success 0
end

if not test -f $WATCH_DIR/setup.txt
    echo "✅ setup.txt correctly NOT recreated (echo prevention works)"
else
    echo "❌ setup.txt was recreated (echo prevention FAILED)"
    set success 0
end

# Check _syncState table
echo ""
echo "=== State Tracking (_syncState table) ==="
sqlite3 -header -column $DB_PATH "SELECT path, substr(lastAppliedHash, 1, 16) as hash_short FROM _syncState ORDER BY path;"

echo ""
echo "=== Loop B Log Entries ==="
grep -E "\[materialize\]" /tmp/loop-b-restart.log; or echo "No materialize logs found"

echo ""
if test $success -eq 1
    echo "✅ ✅ ✅ ALL TESTS PASSED ✅ ✅ ✅"
    exit 0
else
    echo "❌ ❌ ❌ SOME TESTS FAILED ❌ ❌ ❌"
    exit 1
end
