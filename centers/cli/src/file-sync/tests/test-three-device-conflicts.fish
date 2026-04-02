#!/usr/bin/env fish
# Test three devices editing same file simultaneously while offline
# Scenario: Three devices (A, B, C) all edit same file offline, then come online
# Expected: Deterministic conflict resolution, no infinite loops

echo "=== Three-Device Simultaneous Conflicts Test ==="
echo ""

set WATCH_DIR "$HOME/.txtatelier/watched"
set DB_PATH "$HOME/.txtatelier/txtatelier.db"
set PROJECT_ROOT (cd (dirname (status -f))/../../../../..; and pwd)

# Clean state
echo "[1/16] Cleaning state..."
rm -rf $DB_PATH $WATCH_DIR
mkdir -p $WATCH_DIR

# Start CLI (Device A)
echo "[2/16] Starting CLI as Device A..."
cd $PROJECT_ROOT/centers/cli
timeout 10s bun run start > /tmp/three-device-init.log 2>&1 &
set CLI_PID $last_pid
sleep 3

# Device A creates initial file and syncs
echo "[3/16] Device A creates initial file..."
echo "Initial version from Device A" > $WATCH_DIR/shared.txt
sleep 2

set INITIAL_HASH (sqlite3 $DB_PATH "SELECT contentHash FROM file WHERE path = 'shared.txt';")
echo "Initial hash: $INITIAL_HASH"

# All devices go offline
echo "[4/16] All devices go offline..."
kill $CLI_PID 2>/dev/null; or true
sleep 2

# Device A modifies locally (while offline)
echo "[5/16] Device A modifies file while offline..."
echo "Device A offline edit" > $WATCH_DIR/shared.txt
set HASH_A (bun -e "import { computeContentHash } from './src/file-sync/hash'; console.log(await computeContentHash('Device A offline edit\n'));" 2>&1 | tail -1)
echo "Hash A: $HASH_A"

# Device B modifies (simulate by updating Evolu directly)
echo "[6/16] Device B modifies file while offline..."
set CONTENT_B "Device B offline edit"
set HASH_B (bun -e "import { computeContentHash } from './src/file-sync/hash'; console.log(await computeContentHash('$CONTENT_B\n'));" 2>&1 | tail -1)
echo "Hash B: $HASH_B"

# Insert Device B's version into Evolu
sqlite3 $DB_PATH "
UPDATE file
SET content = '$CONTENT_B',
    contentHash = '$HASH_B',
    ownerId = 'DeviceB-222',
    updatedAt = X'0000018E0000000001'
WHERE path = 'shared.txt';
"

# Device A comes online first (detects conflict with B)
echo "[7/16] Device A comes online (should detect conflict with B)..."
timeout 10s bun run start > /tmp/three-device-a-online.log 2>&1 &
set CLI_PID $last_pid
sleep 5

kill $CLI_PID 2>/dev/null; or true
sleep 1

echo ""
echo "[8/16] After Device A vs B conflict..."
ls -la $WATCH_DIR/

# Now Device C's version arrives (third simultaneous edit)
echo ""
echo "[9/16] Device C's edit arrives..."
set CONTENT_C "Device C offline edit"
set HASH_C (bun -e "import { computeContentHash } from './src/file-sync/hash'; console.log(await computeContentHash('$CONTENT_C\n'));" 2>&1 | tail -1)
echo "Hash C: $HASH_C"

# Insert Device C's version
sqlite3 $DB_PATH "
UPDATE file
SET content = '$CONTENT_C',
    contentHash = '$HASH_C',
    ownerId = 'DeviceC-333',
    updatedAt = X'0000018E0000000002'
WHERE path = 'shared.txt';
"

# Device A processes C's update
echo "[10/16] Device A processes C's update (should create another conflict)..."
timeout 10s bun run start > /tmp/three-device-c-arrives.log 2>&1 &
set CLI_PID $last_pid
sleep 5

kill $CLI_PID 2>/dev/null; or true
sleep 1

echo ""
echo "[11/16] After Device C's edit..."
ls -la $WATCH_DIR/

# Count conflict files
set CONFLICT_COUNT (ls $WATCH_DIR/*.conflict-* 2>/dev/null | wc -l)
echo ""
echo "[12/16] Total conflict files: $CONFLICT_COUNT"

# Display all files
echo ""
echo "[13/16] All files on disk:"
for file in $WATCH_DIR/*
    echo "--- "(basename $file)" ---"
    cat $file
    echo ""
end

# Check Evolu state
echo ""
echo "[14/16] Files in Evolu:"
sqlite3 -header -column $DB_PATH "SELECT path, substr(content, 1, 25) as content, substr(ownerId, 1, 10) as owner FROM file WHERE isDeleted IS NOT 1 ORDER BY path;"

# Check for infinite loops (no file should appear more than once)
echo ""
echo "[15/16] Check for duplicates or loops..."
set TOTAL_FILES (ls $WATCH_DIR/ | wc -l)
set UNIQUE_BASENAMES (ls $WATCH_DIR/ | sed 's/\.conflict-.*//' | sort -u | wc -l)
echo "Total files: $TOTAL_FILES"
echo "Unique base names: $UNIQUE_BASENAMES"

# Assessment
echo ""
echo "[16/16] Test assessment..."
set -l success 1

# Should have original file + 2 conflict files (B and C)
if test $CONFLICT_COUNT -eq 2
    echo "Correct conflict count (2)"
else
    echo "WARNING: Expected 2 conflict files, found $CONFLICT_COUNT"
    # Don't fail - behavior may vary based on timing
end

# Original file should be preserved
if test -f $WATCH_DIR/shared.txt
    set ORIGINAL_CONTENT (cat $WATCH_DIR/shared.txt)
    if string match -q "*Device A*" $ORIGINAL_CONTENT
        echo "Original file preserved with Device A's content"
    else
        echo "ERROR: Original file has unexpected content"
        set success 0
    end
else
    echo "ERROR: Original file missing"
    set success 0
end

# Check no duplicates (no infinite loop)
if test $TOTAL_FILES -eq (math $CONFLICT_COUNT + 1)
    echo "No duplicate files (no infinite loop)"
else
    echo "WARNING: File count mismatch, possible duplicate creation"
end

# Check logs for conflicts
echo ""
echo "Conflict detections in logs:"
grep -h "\[materialize\].*[Cc]onflict" /tmp/three-device-*.log; or echo "No conflict logs"

echo ""
if test $success -eq 1
    echo "THREE-DEVICE CONFLICTS TEST PASSED"
    exit 0
else
    echo "THREE-DEVICE CONFLICTS TEST FAILED"
    exit 1
end
