#!/usr/bin/env bash
set -euo pipefail

echo "=== Startup Reconciliation Test ==="
echo

WATCH_DIR="$HOME/.txtatelier/watched"
DB_PATH="$HOME/.txtatelier/txtatelier.db"
PROJECT_ROOT="$(cd "$(dirname "$0")/../../../../.." && pwd)"

echo "[1/7] Cleaning state..."
rm -rf "$DB_PATH" "$DB_PATH-"* "$WATCH_DIR"/*
mkdir -p "$WATCH_DIR"

echo "[2/7] Creating pre-existing filesystem files before startup..."
echo "captured on startup" > "$WATCH_DIR/pre-existing.txt"
echo "temporary artifact" > "$WATCH_DIR/pre-existing.txt.tmp-123"

echo "[3/7] Starting CLI..."
cd "$PROJECT_ROOT/centers/cli"
bun run start > /tmp/startup-reconciliation.log 2>&1 &
CLI_PID=$!
sleep 5

echo "[4/7] Stopping CLI..."
kill "$CLI_PID" 2>/dev/null || true
sleep 1

echo "[5/7] Verifying pre-existing file captured..."
CAPTURED_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM file WHERE path = 'pre-existing.txt' AND isDeleted IS NOT 1;")
if [[ "$CAPTURED_COUNT" != "1" ]]; then
  echo "FAIL: pre-existing filesystem file was not captured at startup"
  exit 1
fi

echo "[6/7] Verifying temp artifact file ignored..."
IGNORED_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM file WHERE path = 'pre-existing.txt.tmp-123' AND isDeleted IS NOT 1;")
if [[ "$IGNORED_COUNT" != "0" ]]; then
  echo "FAIL: temp artifact file should be ignored (.tmp-)"
  exit 1
fi

if ! rg -n "\[reconcile\].*Startup filesystem reconciliation complete" /tmp/startup-reconciliation.log >/dev/null; then
  echo "FAIL: reconciliation completion log missing"
  exit 1
fi

echo "[7/7] Result..."
echo "PASS: startup reconciliation captures pre-existing files and ignores temp artifacts"
