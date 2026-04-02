#!/usr/bin/env bash
# Comprehensive test for change capture (Filesystem → Evolu)
# Run from project root: centers/cli/src/file-sync/tests/test-change-capture.sh
set -e

echo "=== Change capture comprehensive test ==="
echo

WATCH_DIR="$HOME/.txtatelier/watched"
DB_PATH="$HOME/.txtatelier/txtatelier.db"
PROJECT_ROOT="$(cd "$(dirname "$0")/../../../../.." && pwd)"

# Clean state
echo "[1/9] Cleaning state..."
rm -rf "$DB_PATH" "$DB_PATH-"* "$WATCH_DIR"/*
mkdir -p "$WATCH_DIR"

# Start CLI in background
echo "[2/9] Starting CLI..."
cd "$PROJECT_ROOT/centers/cli"
bun run start > /tmp/txtatelier-test.log 2>&1 &
CLI_PID=$!
cd "$PROJECT_ROOT"
sleep 3

# Test 1: Insert new file
echo "[3/9] Test: Insert new file (test.txt)"
echo "initial content" > "$WATCH_DIR/test.txt"
sleep 1

# Test 2: Update file
echo "[4/9] Test: Update file (test.txt)"
echo "updated content" > "$WATCH_DIR/test.txt"
sleep 1

# Test 3: No change (write same content)
echo "[5/9] Test: No change (test.txt with same content)"
echo "updated content" > "$WATCH_DIR/test.txt"
sleep 1

# Test 4: Insert another file
echo "[6/9] Test: Insert another file (notes.md)"
echo "# My Notes" > "$WATCH_DIR/notes.md"
sleep 1

# Test 5: Empty file
echo "[7/9] Test: Insert empty file (empty.txt)"
touch "$WATCH_DIR/empty.txt"
sleep 1

# Stop CLI
echo "[8/9] Stopping CLI..."
kill -SIGINT $CLI_PID
sleep 2

# Verify results
echo "[9/9] Verifying database..."
echo
echo "=== Database Contents ==="
sqlite3 -header -column "$DB_PATH" "SELECT path, CASE WHEN content IS NULL THEN '<null>' WHEN content = '' THEN '<empty>' ELSE substr(content, 1, 30) END as content_preview, contentHash FROM file ORDER BY path;"
echo
echo "=== File Count ==="
FILE_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM file;")
echo "Total files in database: $FILE_COUNT"
echo
echo "=== CLI Log (last 30 lines) ==="
tail -30 /tmp/txtatelier-test.log
echo
echo "=== Expected Results ==="
echo "✓ 3 files in database (test.txt, notes.md, empty.txt)"
echo "✓ test.txt should have 'updated content'"
echo "✓ notes.md should have '# My Notes'"
echo "✓ empty.txt should have empty or null content"
echo "✓ Log should show: 1 insert for test.txt, 1 update, 1 no-change, 2 more inserts"
echo
if [ "$FILE_COUNT" -eq 3 ]; then
  echo "✅ Test PASSED - File count matches expected"
else
  echo "❌ Test FAILED - Expected 3 files, got $FILE_COUNT"
  exit 1
fi
