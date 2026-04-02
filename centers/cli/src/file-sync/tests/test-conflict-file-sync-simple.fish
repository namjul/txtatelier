#!/usr/bin/env fish
# Simplified test: Conflict files should sync like normal files
# Scenario: Manually create a conflict file -> change capture syncs it -> Verify in Evolu
# Expected: Conflict files are treated as normal files by change capture

echo "=== Conflict File Sync Test (Simplified) ==="
echo ""

set WATCH_DIR "$HOME/.txtatelier/watched"
set DB_PATH "$HOME/.txtatelier/txtatelier.db"
set PROJECT_ROOT (cd (dirname (status -f))/../../../../..; and pwd)

# Clean state
echo "[1/8] Cleaning state..."
rm -rf $DB_PATH $WATCH_DIR
mkdir -p $WATCH_DIR

# Start CLI
echo "[2/8] Starting CLI..."
cd $PROJECT_ROOT/centers/cli
timeout 10s bun run start > /tmp/conflict-simple-init.log 2>&1 &
set CLI_PID $last_pid
sleep 3

# Create a normal file first
echo "[3/8] Creating normal file..."
echo "Normal file content" > $WATCH_DIR/file.txt
sleep 2

# Manually create a conflict file (simulating what state materialization would create)
echo "[4/8] Creating conflict file manually..."
echo "Conflict content from Device B" > $WATCH_DIR/file.conflict-DeviceB-1234567890.txt
sleep 3

# Check if both files are in Evolu
echo ""
echo "[5/8] Check files in Evolu..."
sqlite3 -header -column $DB_PATH "SELECT path, substr(content, 1, 30) as content FROM file WHERE isDeleted IS NOT 1 ORDER BY path;"

set FILE_COUNT (sqlite3 $DB_PATH "SELECT COUNT(*) FROM file WHERE isDeleted IS NOT 1;")
set CONFLICT_COUNT (sqlite3 $DB_PATH "SELECT COUNT(*) FROM file WHERE path LIKE '%conflict%' AND isDeleted IS NOT 1;")

echo ""
echo "[6/8] File counts:"
echo "Total files: $FILE_COUNT"
echo "Conflict files: $CONFLICT_COUNT"

kill $CLI_PID 2>/dev/null; or true
sleep 1

# Verify
echo ""
echo "[7/8] Files on disk:"
ls -la $WATCH_DIR/

echo ""
echo "[8/8] Test assessment..."
set -l success 1

if test $FILE_COUNT -eq 2
    echo "Correct total file count (2)"
else
    echo "ERROR: Expected 2 files in Evolu, found $FILE_COUNT"
    set success 0
end

if test $CONFLICT_COUNT -eq 1
    echo "Conflict file synced to Evolu"
else
    echo "ERROR: Conflict file not synced to Evolu"
    set success 0
end

echo ""
if test $success -eq 1
    echo "CONFLICT FILE SYNC TEST PASSED"
    exit 0
else
    echo "CONFLICT FILE SYNC TEST FAILED"
    exit 1
end
