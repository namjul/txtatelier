#!/usr/bin/env bash
set -euo pipefail

echo "=== Remote Delete Safe Path Test ==="
echo

WATCH_DIR="$HOME/.txtatelier/watched"
DB_PATH="$HOME/.txtatelier/txtatelier.db"
PROJECT_ROOT="$(cd "$(dirname "$0")/../../../../.." && pwd)"

echo "[1/9] Cleaning state..."
rm -rf "$DB_PATH" "$DB_PATH-"* "$WATCH_DIR"/*
mkdir -p "$WATCH_DIR"

echo "[2/9] Starting CLI..."
cd "$PROJECT_ROOT/centers/cli"
bun run start > /tmp/remote-delete-safe-init.log 2>&1 &
CLI_PID=$!
sleep 4

echo "[3/9] Creating baseline file via capture..."
echo "safe delete baseline" > "$WATCH_DIR/delete-safe.txt"
sleep 3

echo "[4/9] Stopping CLI (simulate offline remote delete)..."
kill "$CLI_PID" 2>/dev/null || true
sleep 2

echo "[5/9] Marking mirror row deleted by remote device..."
sqlite3 "$DB_PATH" "
UPDATE file
SET isDeleted = 1,
    ownerId = 'RemoteDeleteDevice999',
    updatedAt = X'0000018E00000000BB'
WHERE path = 'delete-safe.txt';
"

echo "[6/9] Restarting CLI (materialize should delete local file)..."
bun run start > /tmp/remote-delete-safe-restart.log 2>&1 &
CLI_PID=$!

for _ in $(seq 1 20); do
  if [[ ! -f "$WATCH_DIR/delete-safe.txt" ]]; then
    break
  fi
  sleep 1
done

echo "[7/9] Stopping CLI to flush..."
kill "$CLI_PID" 2>/dev/null || true
sleep 1

echo "[8/9] Verifying deletion and sync state cleanup..."
if [[ -f "$WATCH_DIR/delete-safe.txt" ]]; then
  echo "FAIL: file still exists after remote safe delete"
  exit 1
fi

STATE_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM _syncState WHERE path = 'delete-safe.txt' AND isDeleted IS NOT 1;")
if [[ "$STATE_COUNT" != "0" ]]; then
  echo "FAIL: _syncState not cleared after remote delete (count=$STATE_COUNT)"
  exit 1
fi

if ! rg -n "\[materialize\].*Deleted: delete-safe.txt" /tmp/remote-delete-safe-restart.log >/dev/null; then
  echo "FAIL: missing materialize deletion log"
  exit 1
fi

echo "[9/9] Result..."
echo "PASS: remote safe delete removed file and cleared sync state"
