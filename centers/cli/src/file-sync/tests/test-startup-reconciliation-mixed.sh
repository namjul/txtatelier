#!/usr/bin/env bash
set -euo pipefail

echo "=== Startup Reconciliation Mixed State Test ==="
echo

WATCH_DIR="$HOME/.txtatelier/watched"
DB_PATH="$HOME/.txtatelier/txtatelier.db"
PROJECT_ROOT="$(cd "$(dirname "$0")/../../../../.." && pwd)"

echo "[1/10] Cleaning state..."
rm -rf "$DB_PATH" "$DB_PATH-"* "$WATCH_DIR"/*
mkdir -p "$WATCH_DIR/nested"

echo "[2/10] Starting CLI to create baseline state..."
cd "$PROJECT_ROOT/centers/cli"
bun run start > /tmp/startup-mixed-init.log 2>&1 &
CLI_PID=$!
sleep 4

echo "[3/10] Creating tombstone baseline file via capture..."
echo "baseline that should be safely deleted" > "$WATCH_DIR/nested/tombstone-target.txt"
sleep 3

echo "[4/10] Stopping CLI..."
kill "$CLI_PID" 2>/dev/null || true
sleep 2

echo "[5/10] Preparing mixed startup state (offline)..."
echo "disk-only startup file" > "$WATCH_DIR/nested/disk-only.txt"

REMOTE_CONTENT="remote-only startup file"
REMOTE_HASH=$(bun -e "import { computeContentHash } from './src/file-sync/hash'; console.log(computeContentHash('${REMOTE_CONTENT}'));" 2>/dev/null)

sqlite3 "$DB_PATH" "
INSERT INTO file (id, path, content, contentHash, createdAt, updatedAt, isDeleted, ownerId)
VALUES (
  'remote-only-001',
  'nested/remote-only.txt',
  '${REMOTE_CONTENT}',
  '${REMOTE_HASH}',
  X'0000018E0000000000',
  X'0000018E00000000DD',
  0,
  'RemoteStartupDevice'
);
"

sqlite3 "$DB_PATH" "
UPDATE file
SET isDeleted = 1,
    ownerId = 'RemoteDeleteDevice999',
    updatedAt = X'0000018E00000000EE'
WHERE path = 'nested/tombstone-target.txt';
"

echo "[6/10] Restarting CLI (reconcile + materialize)..."
bun run start > /tmp/startup-mixed-restart.log 2>&1 &
CLI_PID=$!
sleep 6

echo "[7/10] Stopping CLI to flush..."
kill "$CLI_PID" 2>/dev/null || true
sleep 1

echo "[8/10] Verifying disk-only was captured into Evolu..."
DISK_ONLY_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM file WHERE path = 'nested/disk-only.txt' AND isDeleted IS NOT 1;")
if [[ "$DISK_ONLY_COUNT" != "1" ]]; then
  echo "FAIL: disk-only file was not captured during startup reconciliation"
  exit 1
fi

echo "[9/10] Verifying Evolu-only and tombstone behavior..."
if [[ ! -f "$WATCH_DIR/nested/remote-only.txt" ]]; then
  echo "FAIL: Evolu-only file was not materialized to filesystem"
  exit 1
fi

if ! rg -n "^remote-only startup file$" "$WATCH_DIR/nested/remote-only.txt" >/dev/null; then
  echo "FAIL: Evolu-only file has incorrect content"
  exit 1
fi

if [[ -f "$WATCH_DIR/nested/tombstone-target.txt" ]]; then
  echo "FAIL: tombstone-target.txt should have been safely deleted"
  exit 1
fi

TOMBSTONE_LIVE_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM file WHERE path = 'nested/tombstone-target.txt' AND isDeleted IS NOT 1;")
if [[ "$TOMBSTONE_LIVE_COUNT" != "0" ]]; then
  echo "FAIL: tombstone path was resurrected as a live row"
  exit 1
fi

if ! rg -n "\[materialize\].*Deleted: nested/tombstone-target.txt" /tmp/startup-mixed-restart.log >/dev/null; then
  echo "FAIL: expected tombstone deletion log entry is missing"
  exit 1
fi

echo "[10/10] Result..."
echo "PASS: startup mixed-state reconciliation handled disk-only, Evolu-only, and tombstone paths"
