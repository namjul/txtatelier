#!/usr/bin/env bash
set -euo pipefail

echo "=== Conflict Artifact Callback Test ==="
echo

WATCH_DIR="$HOME/.txtatelier/watched"
DB_PATH="$HOME/.txtatelier/txtatelier.db"
PROJECT_ROOT="$(cd "$(dirname "$0")/../../../../.." && pwd)"

echo "[1/11] Cleaning state..."
rm -rf "$DB_PATH" "$DB_PATH-"* "$WATCH_DIR"/*
mkdir -p "$WATCH_DIR"

echo "[2/11] Starting CLI..."
cd "$PROJECT_ROOT/centers/cli"
timeout 12s bun run start > /tmp/callback-init.log 2>&1 &
CLI_PID=$!
sleep 4

echo "[3/11] Creating baseline file..."
echo "BASELINE" > "$WATCH_DIR/shared-callback.txt"
sleep 3

echo "[4/11] Stopping CLI (simulate offline local edit)..."
kill "$CLI_PID" 2>/dev/null || true
sleep 2

echo "[5/11] Applying local offline edit..."
echo "LOCAL_OFFLINE_EDIT" > "$WATCH_DIR/shared-callback.txt"

echo "[6/11] Simulating remote update in mirror state..."
REMOTE_CONTENT="REMOTE_EDIT_FROM_DEVICE_B"
REMOTE_HASH=$(bun -e "import { computeContentHash } from './src/file-sync/hash'; console.log(await computeContentHash(process.argv[1]));" "$REMOTE_CONTENT" 2>/dev/null)

sqlite3 "$DB_PATH" "
UPDATE file
SET content = '${REMOTE_CONTENT}',
    contentHash = '${REMOTE_HASH}',
    ownerId = 'RemoteDeviceB999',
    updatedAt = X'0000018E00000000AA'
WHERE path = 'shared-callback.txt';
"

echo "[7/11] Restarting CLI (materialize should create conflict artifact)..."
timeout 20s bun run start > /tmp/callback-restart.log 2>&1 &
CLI_PID=$!

CONFLICT_FILE=""
for _ in $(seq 1 25); do
  shopt -s nullglob
  matches=("$WATCH_DIR"/shared-callback.conflict-*)
  shopt -u nullglob
  if [[ ${#matches[@]} -gt 0 ]]; then
    CONFLICT_FILE="${matches[0]}"
    break
  fi
  sleep 1
done

if [[ -z "$CONFLICT_FILE" ]]; then
  echo "FAIL: conflict artifact was not created"
  kill "$CLI_PID" 2>/dev/null || true
  exit 1
fi

CONFLICT_BASENAME="$(basename "$CONFLICT_FILE")"

echo "[8/11] Checking materialize log entry..."
if ! rg -n "\[materialize\].*Created conflict file" /tmp/callback-restart.log >/dev/null; then
  echo "FAIL: materialize conflict creation log missing"
  kill "$CLI_PID" 2>/dev/null || true
  exit 1
fi

echo "[9/11] Checking capture callback log entry..."
if ! rg -n "\[capture\].*Inserting: ${CONFLICT_BASENAME}" /tmp/callback-restart.log >/dev/null; then
  echo "FAIL: capture callback insertion log missing for conflict artifact"
  kill "$CLI_PID" 2>/dev/null || true
  exit 1
fi

echo "[10/11] Stopping CLI to flush and verifying mirror row..."
kill "$CLI_PID" 2>/dev/null || true
sleep 1

DB_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM file WHERE path = '${CONFLICT_BASENAME}' AND isDeleted IS NOT 1;")
if [[ "$DB_COUNT" != "1" ]]; then
  echo "FAIL: conflict artifact not captured into Evolu after flush (count=$DB_COUNT path=$CONFLICT_BASENAME)"
  exit 1
fi

echo "[11/11] Result..."

echo "PASS: conflict artifact callback propagated to mirror state"
