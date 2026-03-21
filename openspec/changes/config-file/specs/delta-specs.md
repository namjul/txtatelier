# Delta Specs: config-file

## What behavior is being added?

**Configuration file loading:**
- CLI reads configuration from `txtatelier.config.json` file on startup
- Config file location searched in order: current directory, home directory, XDG config directory
- Users can specify custom config path with `--config` CLI flag
- Config validation happens before sync loops start - invalid config prevents startup

**Configurable parameters:**
- `watchDir` - absolute path to directory being synced (required)
- `ownerId` - unique device identifier for conflict resolution (required)
- `fileWatchDebounceMs` - milliseconds to wait before processing filesystem changes (optional, default: 100)
- `evoluSubscriptionDebounceMs` - milliseconds to wait before processing Evolu changes (optional, default: 100)
- `logLevel` - verbosity of logging: "error" | "warn" | "info" | "debug" (optional, default: "info")
- `conflictFilePattern` - template for conflict file naming (optional, default: "{name}.conflict-{ownerId}-{timestamp}{ext}")

**Error handling:**
- Clear error messages when config file is malformed (invalid JSON)
- Validation errors specify which field is invalid and why
- Missing optional fields use documented defaults
- Missing required fields prevent startup with helpful error

**Configuration in tests:**
- Tests can provide config objects programmatically
- No need for real config files during testing

## What behavior is changing?

**CLI startup:**
- Previously: hardcoded values used directly in code
- After: config loading and validation step added before sync initialization
- Startup fails fast if config is invalid rather than using potentially dangerous defaults

**Device identity:**
- Previously: owner ID hardcoded or generated at runtime
- After: owner ID read from config file (required field)
- Each device explicitly declares its identity via config

**Testing:**
- Previously: tests used hardcoded values or modified source
- After: tests provide config objects matching test scenarios

## What behavior is being removed?

**Hardcoded configuration values:**
- No more hardcoded watch directory path in source code
- No more hardcoded debounce intervals
- No more hardcoded owner ID generation
- No more implicit defaults scattered throughout code

**Silent defaults:**
- No more implicit fallback values when parameters aren't specified
- All defaults now explicit and documented in config schema

## What stays the same?

**Sync behavior:**
- Configuration controls parameters but doesn't change sync algorithms
- Loop A (filesystem → Evolu) and Loop B (Evolu → filesystem) work identically
- Conflict detection logic unchanged
- Hash comparison unchanged

**Filesystem is canonical:**
- Config file is read-only input, never written by CLI
- Config is not synced via Evolu
- Each device maintains independent configuration
- Users edit config with text editor like any other file

**Phase ordering:**
- Config system doesn't affect implementation phase order
- Still following Phase 0 → Phase 1 → ... sequence
- Config available from Phase 0 but doesn't enable features from later phases
