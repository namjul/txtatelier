#!/usr/bin/env bash
# Helper script for two-device subscription test

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=========================================="
echo "Two-Device Subscription Test Helper"
echo "=========================================="
echo ""

# Check if mnemonic is set
if [ -z "$TXTATELIER_MNEMONIC" ]; then
  echo "⚠️  Warning: TXTATELIER_MNEMONIC not set"
  echo ""
  echo "To run multi-device test, you need to:"
  echo "1. Get mnemonic from Device A: bun run cli owner show"
  echo "2. Export it here: export TXTATELIER_MNEMONIC='<mnemonic>'"
  echo ""
fi

# Detect which device we're simulating
DEVICE="${1:-A}"

if [ "$DEVICE" = "B" ]; then
  echo "🔷 Running as Device B (simulated)"
  echo ""
  
  # Use different directories for Device B
  export TXTATELIER_WATCH_DIR="${TXTATELIER_WATCH_DIR:-/tmp/txtatelier-device-b}"
  export TXTATELIER_DB_PATH="${TXTATELIER_DB_PATH:-$HOME/.txtatelier/evolu-device-b.db}"
  
  echo "Configuration:"
  echo "  Watch dir: $TXTATELIER_WATCH_DIR"
  echo "  DB path: $TXTATELIER_DB_PATH"
  echo "  Mnemonic: ${TXTATELIER_MNEMONIC:0:20}... (${#TXTATELIER_MNEMONIC} chars)"
  echo ""
  
  # Create watch directory if it doesn't exist
  mkdir -p "$TXTATELIER_WATCH_DIR"
  echo "✅ Created $TXTATELIER_WATCH_DIR"
  echo ""
  
  echo "🔍 Watch for these logs:"
  echo "  [materialize] 🔔 Subscription fired"
  echo ""
  echo "Starting Device B..."
  echo "=========================================="
  echo ""
  
  cd "$PROJECT_ROOT"
  exec bun centers/cli/src/index.ts start
  
else
  echo "🔶 Running as Device A (primary)"
  echo ""
  
  # Use default directories for Device A
  echo "Configuration:"
  echo "  Watch dir: ${TXTATELIER_WATCH_DIR:-<default>}"
  echo "  DB path: ${TXTATELIER_DB_PATH:-<default>}"
  echo ""
  
  echo "🔍 Watch for these logs:"
  echo "  [materialize] 🔔 Subscription fired"
  echo ""
  echo "Starting Device A..."
  echo "=========================================="
  echo ""
  
  cd "$PROJECT_ROOT"
  exec bun centers/cli/src/index.ts start
fi
