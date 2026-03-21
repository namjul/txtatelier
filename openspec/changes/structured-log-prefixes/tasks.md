# Tasks: structured-log-prefixes

## Phase 1: Update Planning Functions

### 1. Update change-capture-plan.ts
- [ ] 1.1 Replace `[capture]` with `[capture:fs→evolu]` in all log actions
- [ ] 1.2 Update spec examples if needed

### 2. Update state-materialization-plan.ts
- [ ] 2.1 Replace `[materialize]` with `[materialize:evolu→fs]` in all log actions
- [ ] 2.2 Update spec examples if needed

## Phase 2: Update Sync Infrastructure

### 3. Update state-materialization.ts
- [ ] 3.1 `[materialize] Starting...` → `[materialize:evolu→fs] Starting state materialization`
- [ ] 3.2 `[materialize] 🔔 Subscription fired...` → `[state:subscription] 🔔 Subscription fired...`
- [ ] 3.3 `[materialize] Resetting debounce...` → `[state:debounce] Resetting debounce...`
- [ ] 3.4 `[materialize] Change detected...` → `[state:debounce] Change detected...`
- [ ] 3.5 `[materialize] No new changes...` → `[state:debounce] No new changes...`
- [ ] 3.6 Processing file operations → `[materialize:evolu→fs]`
- [ ] 3.7 Keep `[materialize:evolu→fs] Deletion conflict detected` at INFO level

### 4. Update startup-reconciliation.ts
- [ ] 4.1 `[reconcile] Startup scan...` → `[reconcile:fs→evolu] Startup scan found N files`
- [ ] 4.2 `[reconcile] Offline deletion...` → `[reconcile:fs→evolu] Offline deletion: path`
- [ ] 4.3 `[reconcile] Found N deleted rows...` → `[reconcile:evolu→fs] Found N deleted rows in Evolu`
- [ ] 4.4 `[reconcile] Applied N remote deletions` → `[reconcile:evolu→fs] Applied N remote deletions`
- [ ] 4.5 `[reconcile] Synced N files...` → `[reconcile:evolu→fs] Synced N files from Evolu`

### 5. Update watch.ts
- [ ] 5.1 `[watch] Starting to watch...` → Keep `[watch]` (lifecycle message, no event type)
- [ ] 5.2 `[watch] add: path` → `[watch:add] path` (with event type)
- [ ] 5.3 `[watch] change: path` → `[watch:change] path` (with event type)
- [ ] 5.4 `[watch] unlink: path` → `[watch:unlink] path` (with event type)
- [ ] 5.5 `[watch] Stopped watching` → `[watch] Stopped watching` (lifecycle message, no event type)

## Phase 3: Update Platform Layer

### 6. Update BunEvoluDeps.ts
- [ ] 6.1 `[evolu-sync] websocket open` → `[net:websocket:open]`
- [ ] 6.2 `[evolu-sync] websocket message` → `[net:websocket:message]`
- [ ] 6.3 `[evolu-sync] websocket send` → `[net:websocket:send]`
- [ ] 6.4 `[evolu-sync] websocket close` → `[net:websocket:close]`

### 7. Update BunSqliteDriver.ts
- [ ] 7.1 `[sqlite-driver] init` → `[db:sqlite:init]`

## Phase 4: Update Lifecycle Logs

### 8. Update file-sync/index.ts
- [ ] 8.1 `[file-sync] Initializing...` → `[lifecycle] Initializing...`
- [ ] 8.2 `[file-sync] Ready` → `[lifecycle] Ready`
- [ ] 8.3 `[file-sync] Shutting down...` → `[lifecycle] Shutting down...`
- [ ] 8.4 `[file-sync] Stopped` → `[lifecycle] Stopped`
- [ ] 8.5 `[file-sync] Watching directory...` → `[lifecycle] Watching directory: path`
- [ ] 8.6 Owner ID, mnemonic messages → `[lifecycle]`
- [ ] 8.7 Other `[file-sync]` logs → appropriate component

## Phase 5: Verification

### 9. Test filtering
- [ ] 9.1 Run with DEBUG and create a file
- [ ] 9.2 Verify `grep "watch:add"` shows file additions
- [ ] 9.3 Verify `grep "watch:change"` shows file changes
- [ ] 9.4 Verify `grep "capture:"` shows capture operations
- [ ] 9.5 Verify `grep "materialize:"` shows materialize operations
- [ ] 9.6 Verify `grep "→evolu"` shows all fs→evolu (capture + reconcile:fs→evolu)
- [ ] 9.7 Verify `grep "→fs"` shows all evolu→fs (materialize + reconcile:evolu→fs)
- [ ] 9.8 Verify `grep "net:websocket:message"` shows incoming WebSocket messages
- [ ] 9.9 Verify `grep "lifecycle"` shows startup/shutdown

### 10. Final review
- [ ] 10.1 No old prefixes remain (`[materialize]`, `[capture]`, `[reconcile]`, `[evolu-sync]`, `[sqlite-driver]`, `[file-sync]`)
- [ ] 10.2 Type check passes
- [ ] 10.3 Tests pass

## Co-variance notes
<!--
Add notes as implementation progresses.
-->

## Load-bearing assumptions that didn't hold
<!--
Document any assumptions that proved incorrect during implementation.
-->
