#!/usr/bin/env fish
# Test multiple sequential conflicts on the same file
# Scenario: Device A creates file -> Device B modifies -> Device A modifies (offline) -> Device B modifies again
# Expected: Multiple conflict files created, each preserving different versions

echo "=== Multiple Sequential Conflicts Test ==="
echo ""

set WATCH_DIR "$HOME/.txtatelier/watched"
set DB_PATH "$HOME/.txtatelier/txtatelier.db"
set PROJECT_ROOT (cd (dirname (status -f))/../../../../..; and pwd)

# Clean state
echo "[1/20] Cleaning state..."
rm -rf $DB_PATH $WATCH_DIR
mkdir -p $WATCH_DIR

# Start CLI (Device A)
echo "[2/20] Starting CLI (Device A)..."
cd $PROJECT_ROOT/centers/cli
timeout 10s bun run start > /tmp/multi-conflict-init.log 2>&1 &
set CLI_PID $last_pid
sleep 3

# Create initial file via change capture
echo "[3/20] Device A creates initial file..."
echo "Version 1 - Device A initial" > $WATCH_DIR/shared.txt
sleep 2

# Get initial hash
set HASH_V1 (sqlite3 $DB_PATH "SELECT contentHash FROM file WHERE path = 'shared.txt';")
echo "Hash V1: $HASH_V1"

# Stop CLI (simulates Device A going offline)
echo "[4/20] Device A goes offline..."
kill $CLI_PID 2>/dev/null; or true
sleep 2

# Simulate Device B modification (remote change #1)
echo "[5/20] Device B modifies file (remote change #1)..."
set CONTENT_B1 "Version 2 - Device B first change"
set HASH_B1 (bun -e "import { computeContentHash } from './src/file-sync/hash'; console.log(await computeContentHash('$CONTENT_B1\n'));" 2>&1 | tail -1)
echo "Hash B1: $HASH_B1"

sqlite3 $DB_PATH "
UPDATE file
SET content = '$CONTENT_B1',
    contentHash = '$HASH_B1',
    ownerId = 'DeviceB-111',
    updatedAt = X'0000018E0000000001'
WHERE path = 'shared.txt';
"

# Meanwhile, user modifies file locally on Device A (while offline)
echo "[6/20] User modifies file locally on Device A (while offline)..."
echo "Version 3 - Device A local modification" > $WATCH_DIR/shared.txt
sleep 1

# Restart CLI (Device A comes online, should detect first conflict)
echo "[7/20] Device A comes online (should detect conflict #1)..."
timeout 10s bun run start > /tmp/multi-conflict-1.log 2>&1 &
set CLI_PID $last_pid
sleep 5

kill $CLI_PID 2>/dev/null; or true
sleep 1

# Verify first conflict
echo ""
echo "[8/20] Verify first conflict file created..."
set CONFLICT_FILES_1 (ls $WATCH_DIR/*.conflict-* 2>/dev/null)
if test (count $CONFLICT_FILES_1) -eq 1
    echo "Created: "(basename $CONFLICT_FILES_1[1])
else
    echo "ERROR: Expected 1 conflict file, found "(count $CONFLICT_FILES_1)
end

# Check original file preserved
set CURRENT_CONTENT (cat $WATCH_DIR/shared.txt)
echo "Original file content: $CURRENT_CONTENT"

# Now simulate second remote change from Device B
echo ""
echo "[9/20] Device B modifies again (remote change #2)..."
set CONTENT_B2 "Version 4 - Device B second change"
set HASH_B2 (bun -e "import { computeContentHash } from './src/file-sync/hash'; console.log(await computeContentHash('$CONTENT_B2\n'));" 2>&1 | tail -1)
echo "Hash B2: $HASH_B2"

# Need to update via raw SQL since CLI is stopped
sqlite3 $DB_PATH "
UPDATE file
SET content = '$CONTENT_B2',
    contentHash = '$HASH_B2',
    ownerId = 'DeviceB-222',
    updatedAt = X'0000018E0000000002'
WHERE path = 'shared.txt';
"

# User modifies file again locally (creates condition for second conflict)
echo "[10/20] User modifies file locally again..."
echo "Version 5 - Device A second local modification" > $WATCH_DIR/shared.txt
sleep 1

# Restart CLI (should detect second conflict)
echo "[11/20] Restart CLI (should detect conflict #2)..."
timeout 10s bun run start > /tmp/multi-conflict-2.log 2>&1 &
set CLI_PID $last_pid
sleep 5

kill $CLI_PID 2>/dev/null; or true
sleep 1

# Verify second conflict
echo ""
echo "[12/20] Verify second conflict file created..."
set CONFLICT_FILES_2 (ls $WATCH_DIR/*.conflict-* 2>/dev/null)
if test (count $CONFLICT_FILES_2) -eq 2
    echo "Total conflict files: "(count $CONFLICT_FILES_2)
else
    echo "ERROR: Expected 2 conflict files, found "(count $CONFLICT_FILES_2)
end

# Now simulate third remote change from Device C
echo ""
echo "[13/20] Device C modifies (remote change #3)..."
set CONTENT_C1 "Version 6 - Device C change"
set HASH_C1 (bun -e "import { computeContentHash } from './src/file-sync/hash'; console.log(await computeContentHash('$CONTENT_C1\n'));" 2>&1 | tail -1)
echo "Hash C1: $HASH_C1"

sqlite3 $DB_PATH "
UPDATE file
SET content = '$CONTENT_C1',
    contentHash = '$HASH_C1',
    ownerId = 'DeviceC-333',
    updatedAt = X'0000018E0000000003'
WHERE path = 'shared.txt';
"

# User modifies file third time locally
echo "[14/20] User modifies file locally third time..."
echo "Version 7 - Device A third local modification" > $WATCH_DIR/shared.txt
sleep 1

# Restart CLI (should detect third conflict)
echo "[15/20] Restart CLI (should detect conflict #3)..."
timeout 10s bun run start > /tmp/multi-conflict-3.log 2>&1 &
set CLI_PID $last_pid
sleep 5

kill $CLI_PID 2>/dev/null; or true
sleep 1

# Final verification
echo ""
echo "[16/20] Final verification..."
echo ""
echo "=== All files in watch directory ==="
ls -la $WATCH_DIR/

echo ""
echo "=== Original file (should be preserved) ==="
cat $WATCH_DIR/shared.txt

echo ""
echo "=== All conflict files ==="
set ALL_CONFLICTS (ls $WATCH_DIR/*.conflict-* 2>/dev/null | sort)
for conflict in $ALL_CONFLICTS
    echo "--- "(basename $conflict)" ---"
    cat $conflict
    echo ""
end

echo ""
echo "[17/20] Count check..."
set FINAL_COUNT (count $ALL_CONFLICTS)
echo "Total conflict files: $FINAL_COUNT"

# Verify each conflict has unique content
echo ""
echo "[18/20] Verify conflict files have unique content..."
if test (count $ALL_CONFLICTS) -ge 2
    set CONTENT_1 (cat $ALL_CONFLICTS[1])
    set CONTENT_2 (cat $ALL_CONFLICTS[2])

    if test "$CONTENT_1" != "$CONTENT_2"
        echo "Conflict 1 and 2 have different content"
    else
        echo "ERROR: Conflict 1 and 2 have same content"
    end
end

# Check logs for conflict detection
echo ""
echo "[19/20] Check logs for conflict detection..."
echo "=== First conflict ==="
grep -E "\[materialize\].*[Cc]onflict" /tmp/multi-conflict-1.log; or echo "No conflict logs"
echo ""
echo "=== Second conflict ==="
grep -E "\[materialize\].*[Cc]onflict" /tmp/multi-conflict-2.log; or echo "No conflict logs"
echo ""
echo "=== Third conflict ==="
grep -E "\[materialize\].*[Cc]onflict" /tmp/multi-conflict-3.log; or echo "No conflict logs"

# Final assessment
echo ""
echo "[20/20] Test assessment..."
set -l success 1

# Check original file preserved
if test -f $WATCH_DIR/shared.txt
    if string match -q "*Device A third local modification*" (cat $WATCH_DIR/shared.txt)
        echo "Original file preserved with latest local modification"
    else
        echo "ERROR: Original file has wrong content"
        set success 0
    end
else
    echo "ERROR: Original file missing"
    set success 0
end

# Check conflict count
if test $FINAL_COUNT -eq 3
    echo "Correct number of conflict files (3)"
else
    echo "ERROR: Expected 3 conflict files, found $FINAL_COUNT"
    set success 0
end

# Check naming format
set -l naming_ok 1
for conflict in $ALL_CONFLICTS
    if not string match -q "*.conflict-*" (basename $conflict)
        echo "ERROR: Invalid naming format: "(basename $conflict)
        set naming_ok 0
        set success 0
    end
end
if test $naming_ok -eq 1
    echo "All conflict files have correct naming format"
end

echo ""
if test $success -eq 1
    echo "MULTIPLE SEQUENTIAL CONFLICTS TEST PASSED"
    exit 0
else
    echo "MULTIPLE SEQUENTIAL CONFLICTS TEST FAILED"
    exit 1
end
