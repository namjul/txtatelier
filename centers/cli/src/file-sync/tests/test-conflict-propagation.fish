#!/usr/bin/env fish
# Verify conflict files propagate across devices.

echo "=== Conflict Propagation Test ==="
echo ""

set DEVICE_A_DIR "/tmp/txtatelier-conflict-a"
set DEVICE_B_DIR "/tmp/txtatelier-conflict-b"
set PROJECT_ROOT (cd (dirname (status -f))/../../../../..; and pwd)

echo "[1/11] Cleaning state..."
rm -rf $DEVICE_A_DIR $DEVICE_B_DIR
mkdir -p $DEVICE_A_DIR/watched
mkdir -p $DEVICE_B_DIR/watched

cd $PROJECT_ROOT/centers/cli

echo "[2/11] Starting Device A..."
env TXTATELIER_DB_PATH=$DEVICE_A_DIR/txtatelier.db TXTATELIER_WATCH_DIR=$DEVICE_A_DIR/watched timeout 60s bun run start > /tmp/conflict-prop-a.log 2>&1 &
set PID_A $last_pid
sleep 5

echo "[3/11] Extracting mnemonic from Device A..."
set MNEMONIC (grep -A1 "Your mnemonic" /tmp/conflict-prop-a.log | tail -1 | awk '{$1=""; print $0}' | sed 's/^ *//')
if test -z "$MNEMONIC"
    echo "ERROR: Failed to extract mnemonic"
    kill $PID_A 2>/dev/null; or true
    exit 1
end

echo "[4/11] Restoring mnemonic on Device B..."
env TXTATELIER_DB_PATH=$DEVICE_B_DIR/txtatelier.db TXTATELIER_WATCH_DIR=$DEVICE_B_DIR/watched TXTATELIER_MNEMONIC="$MNEMONIC" timeout 30s bun run start > /tmp/conflict-prop-b-restore.log 2>&1
if not grep -q "Mnemonic restore persisted" /tmp/conflict-prop-b-restore.log
    echo "ERROR: Failed to restore mnemonic on Device B"
    kill $PID_A 2>/dev/null; or true
    exit 1
end

echo "[5/11] Starting Device B..."
env TXTATELIER_DB_PATH=$DEVICE_B_DIR/txtatelier.db TXTATELIER_WATCH_DIR=$DEVICE_B_DIR/watched timeout 60s bun run start > /tmp/conflict-prop-b.log 2>&1 &
set PID_B $last_pid
sleep 6

echo "[6/11] Creating baseline file on Device A..."
echo "BASE" > $DEVICE_A_DIR/watched/shared.txt
sleep 6

if not test -f $DEVICE_B_DIR/watched/shared.txt
    echo "ERROR: Baseline file did not sync to Device B"
    kill $PID_A $PID_B 2>/dev/null; or true
    exit 1
end

echo "[7/11] Stop Device B and create offline local edit..."
kill $PID_B 2>/dev/null; or true
sleep 2
echo "B_LOCAL_456" > $DEVICE_B_DIR/watched/shared.txt

echo "[8/11] Create remote edit on Device A..."
echo "A_REMOTE_123" > $DEVICE_A_DIR/watched/shared.txt
sleep 5

echo "[9/11] Restart Device B to trigger conflict..."
env TXTATELIER_DB_PATH=$DEVICE_B_DIR/txtatelier.db TXTATELIER_WATCH_DIR=$DEVICE_B_DIR/watched timeout 60s bun run start > /tmp/conflict-prop-b-restart.log 2>&1 &
set PID_B $last_pid

set B_CONFLICT_FILE ""
for idx in (seq 1 30)
    set MATCH (string match -r ".*/shared\\.conflict-.*" $DEVICE_B_DIR/watched/*)
    if test (count $MATCH) -gt 0
        set B_CONFLICT_FILE $MATCH[1]
        break
    end
    sleep 1
end

if test -z "$B_CONFLICT_FILE"
    echo "ERROR: Device B did not create conflict file"
    kill $PID_A $PID_B 2>/dev/null; or true
    exit 1
end

echo "[10/11] Waiting for conflict file to propagate to Device A..."
set A_CONFLICT_FILE ""
for idx in (seq 1 30)
    set MATCH (string match -r ".*/shared\\.conflict-.*" $DEVICE_A_DIR/watched/*)
    if test (count $MATCH) -gt 0
        set A_CONFLICT_FILE $MATCH[1]
        break
    end
    sleep 1
end

echo "[11/11] Assessing results..."
set -l success 1

set B_CONFLICT_COUNT (count (string match -r ".*/shared\\.conflict-.*" $DEVICE_B_DIR/watched/*))
set A_CONFLICT_COUNT (count (string match -r ".*/shared\\.conflict-.*" $DEVICE_A_DIR/watched/*))

if test -n "$A_CONFLICT_FILE"
    echo "Conflict file propagated to Device A"
    echo "  Device B conflict: "(basename $B_CONFLICT_FILE)
    echo "  Device A conflict: "(basename $A_CONFLICT_FILE)
else
    echo "ERROR: Conflict file did not propagate to Device A"
    set success 0
end

if test $B_CONFLICT_COUNT -eq 1
    echo "No conflict echo on Device B (1 conflict file)"
else
    echo "ERROR: Conflict echo on Device B ($B_CONFLICT_COUNT conflict files)"
    set success 0
end

if test $A_CONFLICT_COUNT -eq 1
    echo "No conflict echo on Device A (1 conflict file)"
else
    echo "ERROR: Conflict echo on Device A ($A_CONFLICT_COUNT conflict files)"
    set success 0
end

kill $PID_A $PID_B 2>/dev/null; or true
sleep 1

if test $success -eq 1
    echo "CONFLICT PROPAGATION TEST PASSED"
    exit 0
else
    echo "CONFLICT PROPAGATION TEST FAILED"
    echo "Logs: /tmp/conflict-prop-a.log /tmp/conflict-prop-b.log /tmp/conflict-prop-b-restart.log"
    exit 1
end
