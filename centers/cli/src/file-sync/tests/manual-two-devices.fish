#!/usr/bin/env fish
# Manual test setup for two independent devices
# Each device has its own database and watch directory
# Use this to manually test and compare behavior

echo "=== Two Independent Devices Setup ==="
echo ""

set DEVICE_A_DIR "/tmp/txtatelier-device-a"
set DEVICE_B_DIR "/tmp/txtatelier-device-b"
set PROJECT_ROOT (cd (dirname (status -f))/../../../../..; and pwd)

# Clean previous test data
echo "[1/2] Cleaning previous test data..."
rm -rf $DEVICE_A_DIR $DEVICE_B_DIR
mkdir -p $DEVICE_A_DIR/watched
mkdir -p $DEVICE_B_DIR/watched

echo ""
echo "[2/2] Setup complete"
echo ""
echo "Device A: $DEVICE_A_DIR/"
echo "  Database: $DEVICE_A_DIR/txtatelier.db"
echo "  Watch dir: $DEVICE_A_DIR/watched/"
echo ""
echo "Device B: $DEVICE_B_DIR/"
echo "  Database: $DEVICE_B_DIR/txtatelier.db"
echo "  Watch dir: $DEVICE_B_DIR/watched/"
echo ""
echo "=== Instructions ==="
echo ""
echo "Each device is completely independent (Phase 0/1 - no sync protocol yet)."
echo ""
echo "Terminal 1 (Device A):"
echo "  cd $PROJECT_ROOT/centers/cli"
echo "  TXTATELIER_DB_PATH=$DEVICE_A_DIR/txtatelier.db TXTATELIER_WATCH_DIR=$DEVICE_A_DIR/watched bun run start"
echo ""
echo "Terminal 2 (Device B):"
echo "  cd $PROJECT_ROOT/centers/cli"
echo "  TXTATELIER_DB_PATH=$DEVICE_B_DIR/txtatelier.db TXTATELIER_WATCH_DIR=$DEVICE_B_DIR/watched bun run start"
echo ""
echo "=== What to test ==="
echo ""
echo "1. Single device file sync (Loop A):"
echo "   echo 'test' > $DEVICE_A_DIR/watched/test.txt"
echo "   # Watch Device A logs for [loop-a] Inserting: test.txt"
echo ""
echo "2. Compare directories:"
echo "   ls $DEVICE_A_DIR/watched/"
echo "   ls $DEVICE_B_DIR/watched/"
echo "   # They will be different (no sync between devices yet)"
echo ""
echo "3. Manually simulate sync by copying:"
echo "   cp $DEVICE_A_DIR/watched/test.txt $DEVICE_B_DIR/watched/"
echo "   # Watch Device B logs for [loop-a] Inserting: test.txt"
echo ""
echo "4. Test conflicts manually:"
echo "   # Stop both CLIs"
echo "   echo 'A version' > $DEVICE_A_DIR/watched/shared.txt"
echo "   echo 'B version' > $DEVICE_B_DIR/watched/shared.txt"
echo "   # Copy B's file to A's directory with different ownerId simulation"
echo "   # This requires manually updating the database (complex)"
echo ""
echo "5. Check databases:"
echo "   sqlite3 $DEVICE_A_DIR/txtatelier.db 'SELECT * FROM file;'"
echo "   sqlite3 $DEVICE_B_DIR/txtatelier.db 'SELECT * FROM file;'"
echo ""
echo "Note: Real multi-device sync will be implemented in Phase 2."
echo ""
