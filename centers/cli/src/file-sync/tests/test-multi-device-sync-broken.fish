#!/usr/bin/env fish
# BROKEN UNTIL PHASE 2: Multi-device sync test
#
# This test attempts to verify real-time sync between two CLI instances
# running simultaneously with different watch directories.
#
# WHY IT'S BROKEN:
# - Phase 0/1 has transports: [] in evolu.ts (no sync protocol)
# - Each CLI has separate in-memory Evolu CRDT instance
# - Changes don't propagate between instances without transport
# - Database writes are buffered in memory, not immediately visible to other processes
#
# TO FIX IN PHASE 2:
# - Configure Evolu transports with WebSocket relay server
# - Changes will propagate through relay instead of shared database
# - This test will then work as written
#
# WORKAROUND FOR NOW:
# - Use manual-two-devices.fish for manual testing
# - Use restart pattern (stop one CLI, start another) to simulate sync
# - Or use direct SQLite manipulation to inject "remote" changes (like conflict tests do)

echo "=== Multi-Device Real-Time Sync Test ==="
echo ""
echo "⚠️  BROKEN: This test requires Phase 2 Evolu sync (transports config)"
echo ""

set DEVICE_A_DIR "/tmp/txtatelier-device-a"
set DEVICE_B_DIR "/tmp/txtatelier-device-b"
set SHARED_DIR "/tmp/txtatelier-shared"
set PROJECT_ROOT (cd (dirname (status -f))/../../../../..; and pwd)

# Clean state
echo "[1/10] Cleaning state..."
rm -rf $DEVICE_A_DIR $DEVICE_B_DIR $SHARED_DIR
mkdir -p $DEVICE_A_DIR/watched
mkdir -p $DEVICE_B_DIR/watched
mkdir -p $SHARED_DIR

cd $PROJECT_ROOT/centers/cli

# Start Device A
echo "[2/10] Starting Device A..."
env TXTATELIER_DB_PATH=$SHARED_DIR/txtatelier.db TXTATELIER_WATCH_DIR=$DEVICE_A_DIR/watched timeout 15s bun run start > /tmp/device-a-broken.log 2>&1 &
set PID_A $last_pid
sleep 3

# Create file on Device A
echo "[3/10] Creating file on Device A..."
echo "Content from Device A" > $DEVICE_A_DIR/watched/test.txt
sleep 2

# Start Device B (shares same database)
echo "[4/10] Starting Device B..."
env TXTATELIER_DB_PATH=$SHARED_DIR/txtatelier.db TXTATELIER_WATCH_DIR=$DEVICE_B_DIR/watched timeout 15s bun run start > /tmp/device-b-broken.log 2>&1 &
set PID_B $last_pid
sleep 3

# Check if file synced to Device B (it won't)
echo "[5/10] Checking if file synced to Device B..."
if test -f $DEVICE_B_DIR/watched/test.txt
    echo "✓ File synced (unexpected - Phase 2 not implemented)"
else
    echo "✗ File NOT synced (expected - Phase 2 not implemented)"
end

# Modify file on Device B
echo "[6/10] Creating file on Device B..."
echo "Content from Device B" > $DEVICE_B_DIR/watched/other.txt
sleep 3

# Check if it synced to Device A (it won't)
echo "[7/10] Checking if file synced to Device A..."
if test -f $DEVICE_A_DIR/watched/other.txt
    echo "✓ File synced (unexpected - Phase 2 not implemented)"
else
    echo "✗ File NOT synced (expected - Phase 2 not implemented)"
end

# Stop both devices
echo "[8/10] Stopping devices..."
kill $PID_A $PID_B 2>/dev/null; or true
sleep 2

# Show results
echo ""
echo "[9/10] Results..."
echo ""
echo "Device A directory:"
ls -la $DEVICE_A_DIR/watched/
echo ""
echo "Device B directory:"
ls -la $DEVICE_B_DIR/watched/
echo ""

echo "[10/10] Conclusion..."
echo ""
echo "This test demonstrates that real-time sync doesn't work in Phase 0/1."
echo "Each device only sees its own files."
echo ""
echo "To fix: Implement Phase 2 (Evolu transports with relay server)"
echo ""

exit 1
