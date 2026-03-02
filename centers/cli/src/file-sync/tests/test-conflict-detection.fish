#!/usr/bin/env fish
# Test conflict detection in Loop B
# Simulates scenario: local modification + remote change = conflict file

echo "=== Conflict Detection Test (Fish Shell) ==="
echo ""

set WATCH_DIR "$HOME/.txtatelier/watched"
set DB_PATH "$HOME/.txtatelier/txtatelier.db"
set PROJECT_ROOT (cd (dirname (status -f))/../../../../..; and pwd)

# Clean state
echo "[1/12] Cleaning state..."
rm -rf $DB_PATH $WATCH_DIR
mkdir -p $WATCH_DIR

# Start CLI
echo "[2/12] Starting CLI..."
cd $PROJECT_ROOT/centers/cli
timeout 10s bun run start > /tmp/conflict-init.log 2>&1 &
set CLI_PID $last_pid
sleep 3

# Create initial file via Loop A (establishes baseline)
echo "[3/12] Creating initial file via Loop A..."
echo "Initial content from Device A" > $WATCH_DIR/shared-file.txt
sleep 2

echo "[4/12] Database state after initial creation:"
sqlite3 -header -column $DB_PATH "SELECT path, content, contentHash FROM file WHERE path = 'shared-file.txt';"

# Get the initial hash
set INITIAL_HASH (sqlite3 $DB_PATH "SELECT contentHash FROM file WHERE path = 'shared-file.txt';")
echo "[5/12] Initial hash: $INITIAL_HASH"

# Check _syncState
echo "[6/12] _syncState tracking:"
sqlite3 -header -column $DB_PATH "SELECT path, lastAppliedHash FROM _syncState WHERE path = 'shared-file.txt';"

# CRITICAL: Stop CLI BEFORE user modifies file
# This prevents Loop A from detecting and syncing the local change
echo "[7/12] Stopping CLI (simulates device going offline)..."
kill $CLI_PID 2>/dev/null; or true
sleep 2

# Modify file locally (simulates user editing while offline)
echo "[8/12] User modifies file locally while offline..."
echo "Local modification by user" > $WATCH_DIR/shared-file.txt
sleep 1

# Get local hash
set LOCAL_HASH (bun -e "import { computeContentHash } from './src/file-sync/hash'; console.log(await computeContentHash('Local modification by user\n'));" 2>&1 | tail -1)
echo "Local hash after user edit: $LOCAL_HASH"

# Simulate remote change (different content, different ownerId)
echo ""
echo "[9/12] Simulating remote change from another device (via sync)..."
set REMOTE_CONTENT "Remote change from Device B"
set REMOTE_HASH (bun -e "import { computeContentHash } from './src/file-sync/hash'; console.log(await computeContentHash('$REMOTE_CONTENT'));" 2>&1 | tail -1)
echo "Remote hash: $REMOTE_HASH"

sqlite3 $DB_PATH "
UPDATE file
SET content = '$REMOTE_CONTENT',
    contentHash = '$REMOTE_HASH',
    ownerId = 'RemoteDeviceB123',
    updatedAt = X'0000018E0000000001'
WHERE path = 'shared-file.txt';
"

echo ""
echo "[10/12] Database state after remote change:"
sqlite3 -header -column $DB_PATH "SELECT path, substr(content, 1, 30) as content, contentHash, substr(ownerId, 1, 16) as owner FROM file WHERE path = 'shared-file.txt';"

# Restart CLI (Loop B should detect conflict)
echo ""
echo "[11/12] Restarting CLI (Loop B should detect conflict)..."
echo "Watch for: [loop-b] Conflict detected"
echo ""
timeout 10s bun run start 2>&1 | tee /tmp/conflict-restart.log &
set CLI_PID $last_pid
sleep 5

kill $CLI_PID 2>/dev/null; or true
sleep 1

# Verify results
echo ""
echo "[12/12] Verification"
echo ""
echo "=== Files in watch directory ==="
ls -la $WATCH_DIR/

echo ""
echo "=== Original file content (should be preserved) ==="
cat $WATCH_DIR/shared-file.txt

echo ""
echo "=== Conflict files ==="
set CONFLICT_FILES (ls $WATCH_DIR/*.conflict-* 2>/dev/null)
if test (count $CONFLICT_FILES) -gt 0
    for conflict in $CONFLICT_FILES
        echo "--- "(basename $conflict)" ---"
        cat $conflict
        echo ""
    end
else
    echo "❌ NO CONFLICT FILES FOUND"
end

echo ""
echo "=== Expected Results ==="
echo "✓ Original shared-file.txt preserved (local modification)"
echo "✓ Conflict file created: shared-file.conflict-{ownerId}-{timestamp}.txt"
echo "✓ Conflict file contains remote content"
echo "✓ Original file unchanged"
echo ""

# Check expectations
set -l success 1

# Check original file preserved
if test -f $WATCH_DIR/shared-file.txt
    set ORIGINAL_CONTENT (cat $WATCH_DIR/shared-file.txt)
    if string match -q "*Local modification*" $ORIGINAL_CONTENT
        echo "✅ Original file preserved with local modifications"
    else
        echo "❌ Original file was overwritten (should be preserved!)"
        set success 0
    end
else
    echo "❌ Original file missing"
    set success 0
end

# Check conflict file exists
if test (count $CONFLICT_FILES) -gt 0
    echo "✅ Conflict file created: "(basename $CONFLICT_FILES[1])
    
    # Check conflict file content
    set CONFLICT_CONTENT (cat $CONFLICT_FILES[1])
    if string match -q "*Remote change from Device B*" $CONFLICT_CONTENT
        echo "✅ Conflict file contains remote content"
    else
        echo "❌ Conflict file has wrong content"
        set success 0
    end
    
    # Check naming format
    if string match -q "*.conflict-*" (basename $CONFLICT_FILES[1])
        echo "✅ Conflict file naming format correct"
    else
        echo "❌ Conflict file naming format incorrect"
        set success 0
    end
else
    echo "❌ No conflict file created"
    set success 0
end

echo ""
echo "=== Loop B Logs ==="
grep -E "\[loop-b\].*[Cc]onflict" /tmp/conflict-restart.log; or echo "No conflict logs found"

echo ""
if test $success -eq 1
    echo "✅ ✅ ✅ CONFLICT DETECTION WORKS ✅ ✅ ✅"
    exit 0
else
    echo "❌ ❌ ❌ CONFLICT DETECTION FAILED ❌ ❌ ❌"
    exit 1
end
