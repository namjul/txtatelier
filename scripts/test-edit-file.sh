#!/usr/bin/env bash
# Helper to create test edits during subscription test

set -e

DEVICE="${1:-A}"
MESSAGE="${2:-test edit $(date +%s)}"

if [ "$DEVICE" = "B" ]; then
  TARGET_DIR="${TXTATELIER_WATCH_DIR:-/tmp/txtatelier-device-b}"
else
  TARGET_DIR="${TXTATELIER_WATCH_DIR:-.}"
fi

TEST_FILE="$TARGET_DIR/subscription-test.md"

echo "📝 Creating test edit on Device $DEVICE"
echo "   File: $TEST_FILE"
echo "   Message: $MESSAGE"
echo ""

# Ensure directory exists
mkdir -p "$TARGET_DIR"

# Append to test file
echo "$MESSAGE" >> "$TEST_FILE"

echo "✅ Edit complete. Watch the other device's logs for:"
echo "   [materialize] 🔔 Subscription fired"
echo ""
