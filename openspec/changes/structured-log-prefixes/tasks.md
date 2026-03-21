# Tasks: structured-log-prefixes

## Phase 1: Update Planning Functions

### 1. Update change-capture-plan.ts
- [ ] 1.1 Replace `[capture]` with `[sync:fs→evolu]` in all log actions
- [ ] 1.2 Update spec examples if needed

### 2. Update state-materialization-plan.ts
- [ ] 2.1 Replace `[materialize]` with `[sync:evolu→fs]` in all log actions
- [ ] 2.2 Update spec examples if needed

## Phase 2: Update Sync Infrastructure

### 3. Update state-materialization.ts
- [ ] 3.1 `[materialize] Starting...` → `[sync:evolu→fs] Starting state materialization`
- [ ] 3.2 Subscription events → `[state:load]` 
- [ ] 3.3 Debounce events → `[state:debounce]`
- [ ] 3.4 Processing files → `[sync:evolu→fs]` or `[state:load]`
- [ ] 3.5 Keep `[sync:evolu→fs] Deletion conflict detected` (INFO level stays)

### 4. Update startup-reconciliation.ts
- [ ] 4.1 `[reconcile] Startup scan...` → `[sync:fs→evolu] Startup scan found N files`
- [ ] 4.2 `[reconcile] Offline deletion...` → `[sync:fs→evolu] Offline deletion: path`
- [ ] 4.3 `[reconcile] Synced N files...` → `[sync:evolu→fs] Synced N files from Evolu`
- [ ] 4.4 Other reconcile logs → appropriate sync category

### 5. Update watch.ts
- [ ] 5.1 `[watch] Starting to watch...` → `[file:watch] Starting watcher: path`
- [ ] 5.2 `[watch] add/change/unlink: path` → `[file:watch] add: path` (etc.)
- [ ] 5.3 `[watch] Stopped watching` → `[lifecycle] Stopped file watcher` OR keep `[file:watch]`

## Phase 3: Update Platform Layer

### 6. Update BunEvoluDeps.ts
- [ ] 6.1 `[evolu-sync] websocket open` → `[net:websocket] websocket open`
- [ ] 6.2 Other evolu-sync logs → `[net:websocket]`

### 7. Update BunSqliteDriver.ts
- [ ] 7.1 `[sqlite-driver] init` → `[db:init] init`

## Phase 4: Update Lifecycle Logs

### 8. Update file-sync/index.ts
- [ ] 8.1 `[file-sync] Initializing...` → `[lifecycle] Initializing...`
- [ ] 8.2 `[file-sync] Ready` → `[lifecycle] Ready`
- [ ] 8.3 `[file-sync] Shutting down...` → `[lifecycle] Shutting down...`
- [ ] 8.4 `[file-sync] Stopped` → `[lifecycle] Stopped`
- [ ] 8.5 `[file-sync] Watching directory...` → `[lifecycle] Watching directory: path`
- [ ] 8.6 Owner ID, mnemonic messages → `[lifecycle]`
- [ ] 8.7 Other `[file-sync]` logs → appropriate category

## Phase 5: Verification

### 9. Test filtering
- [ ] 9.1 Run with DEBUG and create a file
- [ ] 9.2 Verify `grep "sync:"` shows both directions
- [ ] 9.3 Verify `grep "→evolu"` shows only fs→evolu
- [ ] 9.4 Verify `grep "→fs"` shows only evolu→fs
- [ ] 9.5 Verify `grep "lifecycle"` shows startup/shutdown

### 10. Final review
- [ ] 10.1 No old prefixes remain (`[materialize]`, `[capture]`, `[reconcile]`, `[watch]`, `[evolu-sync]`, `[sqlite-driver]`)
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
