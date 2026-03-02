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

# Extract Device A's mnemonic from logs
echo "[3/12] Extracting Device A mnemonic..."
set MNEMONIC (grep -A1 "Your mnemonic" /tmp/device-a-sync.log | tail -1 | awk '{$1=""; print $0}' | sed 's/^ *//')

if test -z "$MNEMONIC"
    echo "ERROR: Could not extract mnemonic from Device A logs"
    echo "Check /tmp/device-a-sync.log for details"
    kill $PID_A 2>/dev/null; or true
    exit 1
end

echo "Device A mnemonic extracted (first 3 words): "(echo $MNEMONIC | awk '{print $1, $2, $3}')"..."

# Create file on Device A
echo "[4/12] Creating file on Device A..."
echo "Content from Device A" > $DEVICE_A_DIR/watched/test.txt
sleep 5

# Restore mnemonic on Device B (this run exits after persisting restore)
echo "[5/12] Restoring mnemonic on Device B..."
env TXTATELIER_DB_PATH=$DEVICE_B_DIR/txtatelier.db TXTATELIER_WATCH_DIR=$DEVICE_B_DIR/watched TXTATELIER_MNEMONIC="$MNEMONIC" timeout 20s bun run start > /tmp/device-b-restore.log 2>&1

if grep -q "Mnemonic restore persisted" /tmp/device-b-restore.log
    echo "✓ Mnemonic restore persisted"
else
    echo "ERROR: Mnemonic restore did not persist"
    cat /tmp/device-b-restore.log
    kill $PID_A 2>/dev/null; or true
    exit 1
end

# Start Device B without mnemonic env var (loads restored owner from DB)
echo "[6/12] Starting Device B with restored owner..."
env TXTATELIER_DB_PATH=$DEVICE_B_DIR/txtatelier.db TXTATELIER_WATCH_DIR=$DEVICE_B_DIR/watched timeout 30s bun run start > /tmp/device-b-sync.log 2>&1 &
set PID_B $last_pid
sleep 12

# Verify both devices have same owner ID
echo "[7/12] Verifying owner IDs match..."
set OWNER_A (grep "Owner ID:" /tmp/device-a-sync.log | awk '{print $NF}')
set OWNER_B (grep "Owner ID:" /tmp/device-b-sync.log | awk '{print $NF}')

echo "  Device A Owner ID: $OWNER_A"
echo "  Device B Owner ID: $OWNER_B"

if test "$OWNER_A" != "$OWNER_B"
    echo "ERROR: Owner IDs don't match - mnemonic restoration may have failed"
    echo "Check /tmp/device-b-sync.log for restoration errors"
else
    echo "✓ Owner IDs match - both devices share same owner"
end

# Check if file synced to Device B via Evolu relay
echo "[8/12] Checking if file synced to Device B via relay..."
if test -f $DEVICE_B_DIR/watched/test.txt
    echo "✓ File synced via Evolu relay"
    set CONTENT_B (cat $DEVICE_B_DIR/watched/test.txt)
    echo "  Content: $CONTENT_B"
else
    echo "✗ File NOT synced (relay sync failed)"
end

# Create file on Device B
echo "[9/12] Creating file on Device B..."
echo "Content from Device B" > $DEVICE_B_DIR/watched/other.txt
sleep 5

# Check if it synced to Device A via relay
echo "[10/12] Checking if file synced to Device A via relay..."
if test -f $DEVICE_A_DIR/watched/other.txt
    echo "✓ File synced via Evolu relay"
    set CONTENT_A (cat $DEVICE_A_DIR/watched/other.txt)
    echo "  Content: $CONTENT_A"
else
    echo "✗ File NOT synced (relay sync failed)"
end

# Stop both devices
echo "[11/12] Stopping devices..."
kill $PID_A $PID_B 2>/dev/null; or true
sleep 2

# Show results
echo ""
echo "[12/12] Results..."
echo ""
echo "Device A directory:"
ls -la $DEVICE_A_DIR/watched/
echo ""
echo "Device B directory:"
ls -la $DEVICE_B_DIR/watched/
echo ""

# Assessment
echo "Files on Device A:"
for file in $DEVICE_A_DIR/watched/*
    if test -f $file
        echo "  "(basename $file)": "(cat $file)
    end
end

echo ""
echo "Files on Device B:"
for file in $DEVICE_B_DIR/watched/*
    if test -f $file
        echo "  "(basename $file)": "(cat $file)
    end
end

echo ""
echo "Test assessment..."
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
