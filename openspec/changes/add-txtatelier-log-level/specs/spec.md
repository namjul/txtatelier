# Delta Specs: add-txtatelier-log-level

## What behavior is being added?

**Three-level logging system:**

1. **ERROR** (default): Only error messages output
   - Sync failures
   - WebSocket connection errors
   - File I/O errors
   - Database errors

2. **INFO**: Minimal operational visibility
   - Lifecycle: "Initializing...", "Ready", "Shut down"
   - Configuration: "Watching directory: /path", "Owner ID: xxx"
   - Progress: "Completed N files in Xs"
   - User-facing: Mnemonic display, "First run detected"
   - Conflicts: "Conflict detected: path"

3. **DEBUG**: Detailed operational traces
   - Individual file sync decisions with reasoning
   - Hash comparisons: "hash A != hash B"
   - Subscription timing: "Subscription fired", "Resetting debounce"
   - Planning function decisions
   - WebSocket events: open, message, close
   - SQL query details

**Environment variable:**
- `TXT_ATELIER_LOG_LEVEL` accepts: `DEBUG`, `INFO`, `ERROR`
- Case-insensitive parsing
- Unset or invalid → defaults to `ERROR`

## What behavior is changing?

**Phase 1 - Initial reclassification:**
- Most current `logger.log()` calls become `logger.debug()`
- Keep only lifecycle/progress messages at `logger.info()`
- All `logger.error()` stay as ERROR level
- `logger.warn()` maps to ERROR level

**Phase 2 - DEBUG refinement (after usage):**
- Remove or further categorize noisy DEBUG logs
- Keep only DEBUG messages that actually helped diagnose issues

## What behavior is being removed?

Nothing removed - this is additive. The existing `TXT_ATELIER_LOG` boolean variable (if it exists) will be replaced by `TXT_ATELIER_LOG_LEVEL`.

## What stays the same?

- Log message format unchanged
- Log destinations (console) unchanged
- Error messages always output at ERROR level
- Logger API: `log()`, `info()`, `warn()`, `error()`, plus new `debug()`
- All internal code calling existing logger methods works unchanged
