#!/usr/bin/env fish
# Multi-device real-time sync test via Evolu relay
# Tests that changes propagate between two CLI instances through Evolu sync

echo "=== Multi-Device Real-Time Sync Test ==="
echo ""
echo "Testing real-time sync via wss://free.evoluhq.com"
echo ""

set DEVICE_A_DIR "/tmp/txtatelier-device-a"
set DEVICE_B_DIR "/tmp/txtatelier-device-b"
set PROJECT_ROOT (cd (dirname (status -f))/../../../../..; and pwd)

# Clean state
echo "[1/12] Cleaning state..."
rm -rf $DEVICE_A_DIR $DEVICE_B_DIR
mkdir -p $DEVICE_A_DIR/watched
mkdir -p $DEVICE_B_DIR/watched

cd $PROJECT_ROOT/centers/cli

# Start Device A (separate database, will sync via relay)
echo "[2/12] Starting Device A..."
env TXTATELIER_DB_PATH=$DEVICE_A_DIR/txtatelier.db TXTATELIER_WATCH_DIR=$DEVICE_A_DIR/watched timeout 30s bun run start > /tmp/device-a-sync.log 2>&1 &
set PID_A $last_pid
sleep 5

# Create file on Device A
echo "[3/12] Creating file on Device A..."
echo "Content from Device A" > $DEVICE_A_DIR/watched/test.txt
sleep 5

# Start Device B (separate database, will sync via relay)
echo "[4/12] Starting Device B..."
env TXTATELIER_DB_PATH=$DEVICE_B_DIR/txtatelier.db TXTATELIER_WATCH_DIR=$DEVICE_B_DIR/watched timeout 30s bun run start > /tmp/device-b-sync.log 2>&1 &
set PID_B $last_pid
sleep 8

# Check if file synced to Device B via Evolu relay
echo "[5/12] Checking if file synced to Device B via relay..."
if test -f $DEVICE_B_DIR/watched/test.txt
    echo "✓ File synced via Evolu relay"
    set CONTENT_B (cat $DEVICE_B_DIR/watched/test.txt)
    echo "  Content: $CONTENT_B"
else
    echo "✗ File NOT synced (relay sync failed)"
end

# Create file on Device B
echo "[6/12] Creating file on Device B..."
echo "Content from Device B" > $DEVICE_B_DIR/watched/other.txt
sleep 5

# Check if it synced to Device A via relay
echo "[7/12] Checking if file synced to Device A via relay..."
if test -f $DEVICE_A_DIR/watched/other.txt
    echo "✓ File synced via Evolu relay"
    set CONTENT_A (cat $DEVICE_A_DIR/watched/other.txt)
    echo "  Content: $CONTENT_A"
else
    echo "✗ File NOT synced (relay sync failed)"
end

# Stop both devices
echo "[8/12] Stopping devices..."
kill $PID_A $PID_B 2>/dev/null; or true
sleep 2

# Show results
echo ""
echo "[9/12] Results..."
echo ""
echo "Device A directory:"
ls -la $DEVICE_A_DIR/watched/
echo ""
echo "Device B directory:"
ls -la $DEVICE_B_DIR/watched/
echo ""

# Assessment
echo "[10/12] Files on Device A:"
for file in $DEVICE_A_DIR/watched/*
    if test -f $file
        echo "  "(basename $file)": "(cat $file)
    end
end

echo ""
echo "[11/12] Files on Device B:"
for file in $DEVICE_B_DIR/watched/*
    if test -f $file
        echo "  "(basename $file)": "(cat $file)
    end
end

echo ""
echo "[12/12] Test assessment..."
set -l success 1

# Check Device B has test.txt from Device A
if test -f $DEVICE_B_DIR/watched/test.txt
    echo "✓ Device B received file from Device A"
else
    echo "✗ Device B missing file from Device A"
    set success 0
end

# Check Device A has other.txt from Device B
if test -f $DEVICE_A_DIR/watched/other.txt
    echo "✓ Device A received file from Device B"
else
    echo "✗ Device A missing file from Device B"
    set success 0
end

echo ""
if test $success -eq 1
    echo "MULTI-DEVICE SYNC TEST PASSED"
    exit 0
else
    echo "MULTI-DEVICE SYNC TEST FAILED"
    echo ""
    echo "Check logs:"
    echo "  /tmp/device-a-sync.log"
    echo "  /tmp/device-b-sync.log"
    exit 1
end
