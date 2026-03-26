# Tasks: add-txtatelier-log-level

## Phase 1: Infrastructure and Initial Reclassification

### 1. Update environment configuration
- [x] 1.1 Create `LogLevel` enum with DEBUG/INFO/ERROR in env.ts
- [x] 1.2 Add `LogLevelValue` union type for parsing ("DEBUG", "INFO", "ERROR", case-insensitive)
- [x] 1.3 Add `TXT_ATELIER_LOG_LEVEL` to EnvInput schema (optional field)
- [x] 1.4 Parse environment variable with default to ERROR
- [x] 1.5 Export both `LogLevel` enum and `env.logLevel` from env.ts

### 2. Update logger with level filtering
- [x] 2.1 Import `LogLevel` and `env` in logger.ts
- [x] 2.2 Define level priority mapping (DEBUG:0, INFO:1, ERROR:2)
- [x] 2.3 Create `shouldLog(messageLevel)` helper function
- [x] 2.4 Add `debug()` method that checks DEBUG level
- [x] 2.5 Update `info()` to check INFO level
- [x] 2.6 Update `warn()` to check ERROR level (maps to ERROR priority)
- [x] 2.7 Update `error()` to always log (ERROR level)
- [x] 2.8 Export wrapped logger object

### 3. Reclassify logs to appropriate levels (Phase 1 - minimal INFO)

**Keep as INFO (minimal lifecycle/progress):**
- [x] 3.1 file-sync/index.ts: "Initializing...", "Ready", "Shut down", "Stopped"
- [x] 3.2 file-sync/index.ts: "Watching directory", "Owner ID"
- [x] 3.3 file-sync/index.ts: Mnemonic display messages (first run)
- [x] 3.4 file-sync/index.ts: "Owner restored/reset. Restart required"
- [x] 3.5 file-sync/sync/state-materialization.ts: "Completed N files in Xs"
- [x] 3.6 file-sync/sync/state-materialization.ts: "Deletion conflict detected"
- [x] 3.7 file-sync/sync/startup-reconciliation.ts: "Startup scan found N files", "Synced N files"
- [x] 3.8 file-sync/watch.ts: "Starting to watch", "Stopped watching"

**Change to DEBUG (detailed operational traces):**
- [x] 3.9 file-sync/index.ts: All other logger.log() calls (mnemonic restore steps, etc.)
- [x] 3.10 file-sync/sync/state-materialization.ts: Subscription events, debounce timer, processing details
- [x] 3.11 file-sync/sync/state-materialization.ts: Initial load count, "No new changes", individual file writes
- [x] 3.12 file-sync/sync/startup-reconciliation.ts: Offline deletion detection, row counts
- [x] 3.13 file-sync/sync/change-capture-plan.ts: All planning logs (Deleting, No change, Updating, Inserting)
- [x] 3.14 file-sync/sync/state-materialization-plan.ts: All planning logs (Skipped, Conflict detected, Writing)
- [x] 3.15 file-sync/watch.ts: Individual file watch events
- [x] 3.16 file-sync/platform/BunSqliteDriver.ts: Database init details
- [x] 3.17 file-sync/platform/BunEvoluDeps.ts: WebSocket events

### 4. Update scripts and documentation
- [x] 4.1 Update scripts/start-device to use `TXTATELIER_LOG_LEVEL=DEBUG`
- [x] 4.2 Update any other shell scripts referencing old variable
- [x] 4.3 Add note to AGENTS.md about the new variable

### 5. Verify implementation
- [x] 5.1 Run TypeScript type check
- [x] 5.2 Test ERROR level (should only show errors)
- [x] 5.3 Test INFO level (should show minimal lifecycle)
- [x] 5.4 Test DEBUG level (should show all including file operations)
- [x] 5.5 Test invalid values default to ERROR

## Phase 2: DEBUG Refinement (After 1 Week Usage)

### 6. Evaluate and clean DEBUG logs
- [ ] 6.1 Review which DEBUG logs actually helped diagnose issues
- [ ] 6.2 Remove or further categorize noisy DEBUG logs that didn't help
- [ ] 6.3 Document DEBUG log patterns that are useful for troubleshooting

## Co-variance notes
<!--
Add notes as implementation progresses.
-->

## Load-bearing assumptions that didn't hold
<!--
Document any assumptions that proved incorrect during implementation.
-->
