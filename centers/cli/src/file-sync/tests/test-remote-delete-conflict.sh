#!/usr/bin/env bash
set -euo pipefail

echo "=== Remote Delete Conflict Path Test ==="
echo

WATCH_DIR="$HOME/.txtatelier/watched"
DB_PATH="$HOME/.txtatelier/txtatelier.db"
PROJECT_ROOT="$(cd "$(dirname "$0")/../../../../.." && pwd)"

echo "[1/10] Cleaning state..."
rm -rf "$DB_PATH" "$DB_PATH-"* "$WATCH_DIR"/*
mkdir -p "$WATCH_DIR"

echo "[2/10] Starting CLI..."
cd "$PROJECT_ROOT/centers/cli"
bun run start > /tmp/remote-delete-conflict-init.log 2>&1 &
CLI_PID=$!
sleep 4

echo "[3/10] Creating baseline file via capture..."
echo "baseline before delete conflict" > "$WATCH_DIR/delete-conflict.txt"
sleep 3

echo "[4/10] Stopping CLI (simulate offline local edit)..."
kill "$CLI_PID" 2>/dev/null || true
sleep 2

echo "[5/10] Applying local offline edit..."
echo "local edit while remote deleted" > "$WATCH_DIR/delete-conflict.txt"

echo "[6/10] Marking mirror row deleted by remote device..."
sqlite3 "$DB_PATH" "
UPDATE file
SET isDeleted = 1,
    ownerId = 'RemoteDeleteDevice999',
    updatedAt = X'0000018E00000000CC'
WHERE path = 'delete-conflict.txt';
"

echo "[7/10] Restarting CLI (materialize should create conflict artifact)..."
bun run start > /tmp/remote-delete-conflict-restart.log 2>&1 &
CLI_PID=$!

CONFLICT_FILE=""
for _ in $(seq 1 25); do
  shopt -s nullglob
  matches=("$WATCH_DIR"/delete-conflict.conflict-*)
  shopt -u nullglob
  if [[ ${#matches[@]} -gt 0 ]]; then
    CONFLICT_FILE="${matches[0]}"
    break
  fi
  sleep 1
done

echo "[8/10] Stopping CLI to flush..."
kill "$CLI_PID" 2>/dev/null || true
sleep 1

echo "[9/10] Verifying conflict artifact behavior..."
if [[ ! -f "$WATCH_DIR/delete-conflict.txt" ]]; then
  echo "FAIL: original file was deleted; expected local version preserved"
  exit 1
fi

if ! rg -n "local edit while remote deleted" "$WATCH_DIR/delete-conflict.txt" >/dev/null; then
  echo "FAIL: original file content was not preserved"
  exit 1
fi

if [[ -z "$CONFLICT_FILE" ]]; then
  echo "FAIL: deletion conflict artifact was not created"
  exit 1
fi

if ! rg -n "local edit while remote deleted" "$CONFLICT_FILE" >/dev/null; then
  echo "FAIL: conflict artifact does not contain local divergent content"
  exit 1
fi

if ! rg -n "\[materialize\].*Deletion conflict detected: delete-conflict.txt" /tmp/remote-delete-conflict-restart.log >/dev/null; then
  echo "FAIL: missing deletion conflict log"
  exit 1
fi

if ! rg -n "\[capture\].*Inserting: $(basename "$CONFLICT_FILE")" /tmp/remote-delete-conflict-restart.log >/dev/null; then
  echo "FAIL: conflict artifact callback was not captured into mirror state"
  exit 1
fi

STATE_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM _syncState WHERE path = 'delete-conflict.txt' AND isDeleted IS NOT 1;")
if [[ "$STATE_COUNT" != "0" ]]; then
  echo "FAIL: _syncState not cleared for delete-conflict.txt (count=$STATE_COUNT)"
  exit 1
fi

echo "[10/10] Result..."
echo "PASS: remote delete conflict preserved local file and produced conflict artifact"
