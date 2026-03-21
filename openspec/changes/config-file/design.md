# Design: config-file

## Approach

**Configuration schema and validation:**
- Define TypeScript interface for config shape using type-safe schema validation
- Use Zod or similar for runtime validation with clear error messages
- Config schema lives in `centers/cli/src/config/` as a new module

**File location search:**
- Search for `txtatelier.config.json` in order: CLI `--config` flag → current directory → home directory → XDG config directory (`~/.config/txtatelier/`)
- First file found wins, no merging of multiple configs
- If no file found and required fields missing, fail with helpful error pointing to docs

**Loading and initialization:**
- Config loading happens in new `loadConfig()` function
- Returns `Result<Config, ConfigError>` with specific error types for different failure modes
- CLI main function calls `loadConfig()` before initializing sync loops
- Config object passed to sync loop constructors as dependency

**Default values:**
- Optional fields have defaults defined in schema
- Defaults chosen for safety and reasonable performance (100ms debounce)
- Required fields: `watchDir`, `ownerId` (no sensible defaults)

**Testing support:**
- `loadConfig()` accepts optional config object parameter for test injection
- Tests bypass file loading and provide config directly
- No filesystem mocking needed for config tests

## Why this approach?

**Type safety from start:** Using Zod or similar gives us runtime validation that matches compile-time types. One source of truth for config shape.

**Fail fast principle:** Loading config before sync initialization means we never start with invalid configuration. Better to refuse to start than corrupt data.

**Search order aligns with user expectation:** CLI flag (explicit) → current directory (project-specific) → home directory (user-specific) → XDG standard (system-wide) follows principle of most specific wins.

**No merging reduces complexity:** Multiple configs merging introduces questions about precedence, partial overrides, and validation timing. Single config is simpler and more predictable.

**Result type for errors:** Using Result pattern instead of throwing allows callers to handle config errors explicitly and provides clear error types for different failure modes.

## What are our load-bearing assumptions about the approach?

1. **JSON is sufficient format** - users won't need comments, includes, or environment variable expansion in config. If they do, we can add JSONC or TOML later without changing structure.

2. **Static config at startup is enough** - no need for hot reloading or runtime config changes. Restart to apply new config is acceptable.

3. **Zod or similar library provides good error messages** - validation errors will be clear enough for users without custom formatting. If not, we can wrap them.

4. **Config schema won't change frequently** - once established, config shape should be stable. Breaking changes would require migration strategy.

## Risks and trade-offs

**Risk: Config location confusion** - users might not know where CLI is reading config from if multiple files exist. Mitigation: log config file path on startup at info level.

**Risk: Breaking changes to config schema** - adding required fields or changing validation breaks existing configs. Mitigation: prefer optional fields with defaults, document schema versioning strategy.

**Trade-off: No environment variable overrides** - some users might expect `TXTATELIER_WATCH_DIR` style overrides. We're choosing file-based config only for simplicity. Can add env vars later if needed.

**Trade-off: No hot reloading** - changing config requires restart. This is acceptable for CLI but might feel dated to some users. Hot reload adds significant complexity for uncertain benefit.

## What we are not doing

**Not implementing:**
- Config file merging from multiple locations
- Environment variable overrides
- Hot reloading / watch for config changes
- Config migration system (for schema breaking changes)
- Encrypted config fields
- Remote config fetching
- Config validation CLI command (may add later as `txtatelier config validate`)

**Not supporting:**
- YAML, TOML, or other formats (JSON only for now)
- Comments in JSON (no JSONC yet)
- Template variables or expressions in config values
- Conditional config based on environment

## Known unknowns

**XDG directory resolution:** Need to verify how to properly resolve XDG config directory cross-platform. Does Bun have built-in helpers or do we need a library?

**Watch directory validation:** Should we validate that `watchDir` exists and is accessible at config load time, or defer to sync loop initialization? Early validation gives better errors but might prevent valid use cases (dir created after config).

**Owner ID format:** Should we enforce any format on `ownerId` (UUID, alphanumeric, length limits) or allow any string? Too strict reduces flexibility, too loose allows confusing values.

**Config in PWA:** How will PWA get its config? Same file read won't work in browser. Likely needs IndexedDB storage, but that's separate concern for Phase 6.

## Co-variance: what else might this touch?

**CLI entry point** - main function must call config loading before sync initialization

**Sync loop constructors** - need to accept config object and use its values instead of hardcoded constants

**Testing infrastructure** - all tests need to provide config, either via helper function or fixture

**Error handling** - new config error types need handling in CLI error reporter

**Logging** - logger initialization might need config (for log level), creating chicken-egg problem if we log during config loading

**Documentation** - need example config file and explanation of all fields

## ⚠ Design warnings

### Responsiveness

Config loading adds startup latency (file I/O + validation). Should be <100ms on normal systems but could be noticeable on slow disks or network filesystems.

Users will see delay before sync starts. Need clear progress indication: "Loading config from ~/.config/txtatelier/txtatelier.config.json..."

Error messages must be immediate and actionable - if config is invalid, user needs to know exactly what to fix without trial and error.

### Continuity after correction

If user corrects invalid config and restarts CLI, they should land in working sync state immediately. Config errors must not leave system in partially initialized state.

Failed config load should leave no side effects - no partial file writes, no database state changes, no lock files.

### Exploratory capacity

Configuration system reduces exploration by making behavior explicit rather than implicit. Users now must specify `watchDir` and `ownerId` - they can't just run CLI and see what happens.

This is intentional trade-off for safety, but means onboarding requires more steps. First-run experience needs to guide users through config creation.

Good: users can experiment with different debounce values by editing config
Risk: users might be intimidated by required fields and not try the tool at all

Mitigation: provide `txtatelier init` command (future) that generates config interactively, or clear error message with example config when file is missing.
