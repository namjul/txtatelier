#!/usr/bin/env bash
# Edge case tests for Loop A
# Run from project root: centers/cli/src/file-sync/tests/test-loop-a-edge-cases.sh
set -e

echo "=== Loop A Edge Case Tests ==="
echo

WATCH_DIR="$HOME/.txtatelier/watched"
DB_PATH="$HOME/.txtatelier/txtatelier.db"
PROJECT_ROOT="$(cd "$(dirname "$0")/../../../../.." && pwd)"

# Clean state
echo "[1/7] Cleaning state..."
rm -rf "$DB_PATH" "$DB_PATH-"* "$WATCH_DIR"/*
mkdir -p "$WATCH_DIR"

# Start CLI in background
echo "[2/7] Starting CLI..."
cd "$PROJECT_ROOT/centers/cli"
bun run start > /tmp/txtatelier-edge-test.log 2>&1 &
CLI_PID=$!
cd "$PROJECT_ROOT"
sleep 3

# Test: File with spaces in name
echo "[3/7] Test: File with spaces in name"
echo "content" > "$WATCH_DIR/file with spaces.txt"
sleep 1

# Test: Unicode and special characters in content
echo "[4/7] Test: Unicode and special characters"
echo "Hello 世界 🌍 Special: <>&\"'" > "$WATCH_DIR/unicode.txt"
sleep 1

# Test: Multiple rapid updates (debounce test)
echo "[5/7] Test: Rapid updates (debounce)"
for i in {1..5}; do
  echo "rapid update $i" > "$WATCH_DIR/rapid.txt"
  sleep 0.05  # 50ms between updates (less than 100ms debounce)
done
sleep 1  # Wait for debounce to settle

# Test: Large-ish file
echo "[6/7] Test: Larger file (10KB)"
yes "This is a test line for a larger file content." | head -200 > "$WATCH_DIR/large.txt"
sleep 1

# Stop CLI
echo "[7/7] Stopping CLI..."
kill -SIGINT $CLI_PID
sleep 2

# Verify results
echo
echo "=== Database Contents ==="
sqlite3 -header -column "$DB_PATH" "SELECT path, length(content) as size, contentHash FROM file ORDER BY path;"
echo
echo "=== File Count ==="
FILE_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM file;")
echo "Total files in database: $FILE_COUNT"
echo
echo "=== Sync Events in Log ==="
echo "Inserts:"
grep "\[sync\] Inserting:" /tmp/txtatelier-edge-test.log | wc -l
echo "Updates:"
grep "\[sync\] Updating:" /tmp/txtatelier-edge-test.log | wc -l
echo "No changes:"
grep "\[sync\] No change:" /tmp/txtatelier-edge-test.log | wc -l
echo
echo "=== Expected Results ==="
echo "✓ 4 files in database"
echo "✓ File with spaces handled correctly"
echo "✓ Unicode content handled correctly"
echo "✓ Rapid updates debounced (should only have 1 insert for rapid.txt)"
echo "✓ Large file synced successfully"
echo
if [ "$FILE_COUNT" -eq 4 ]; then
  echo "✅ Edge case test PASSED - File count matches expected"
  # Verify unicode content
  UNICODE_CONTENT=$(sqlite3 "$DB_PATH" "SELECT content FROM file WHERE path = 'unicode.txt';")
  if echo "$UNICODE_CONTENT" | grep -q "世界"; then
    echo "✅ Unicode test PASSED - Content preserved correctly"
  else
    echo "❌ Unicode test FAILED - Content not preserved"
    exit 1
  fi
else
  echo "❌ Edge case test FAILED - Expected 4 files, got $FILE_COUNT"
  exit 1
fi
