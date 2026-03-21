# Tasks: config-file

## Implementation

### 1. Configuration schema and types

- [ ] 1.1 Install Zod dependency (`bun add zod`)
- [ ] 1.2 Create `centers/cli/src/config/schema.ts` defining Zod schema for config
- [ ] 1.3 Define TypeScript `Config` type derived from schema
- [ ] 1.4 Define `ConfigError` discriminated union type for different validation failures
- [ ] 1.5 Add unit tests for schema validation (valid configs, invalid configs, partial configs)

**Co-variance notes:**
- Need to decide on exact schema defaults and validation rules during implementation
- Zod error messages might need wrapping for clarity

### 2. File location search

- [ ] 2.1 Create `centers/cli/src/config/paths.ts` with functions to resolve config file paths
- [ ] 2.2 Implement `getXdgConfigDir()` helper (check if Bun provides this or use fallback)
- [ ] 2.3 Implement `findConfigFile()` that searches in order: CLI arg → cwd → home → XDG
- [ ] 2.4 Add unit tests for path resolution (mock filesystem or use temp directories)

**Co-variance notes:**
- XDG directory resolution may differ on Windows vs Unix
- Need to handle missing home directory gracefully
- Path resolution might need to expand `~` and handle relative paths

### 3. Config loading and validation

- [ ] 3.1 Create `centers/cli/src/config/load.ts` with `loadConfig()` function
- [ ] 3.2 Implement file reading with error handling (file not found, permission denied, invalid JSON)
- [ ] 3.3 Implement Zod validation and convert errors to `ConfigError` types
- [ ] 3.4 Add test injection path: `loadConfig()` accepts optional pre-parsed config object
- [ ] 3.5 Return `Result<Config, ConfigError>` with specific error types
- [ ] 3.6 Add unit tests for loading (missing file, malformed JSON, validation errors, successful load)

**Co-variance notes:**
- Result type might need to come from common utilities or define locally
- Error messages need to be actionable (include field names, file path, line numbers if possible)

### 4. CLI integration

- [ ] 4.1 Add `--config <path>` CLI argument to main entry point
- [ ] 4.2 Call `loadConfig()` in CLI startup before sync initialization
- [ ] 4.3 Handle `ConfigError` cases and display clear error messages
- [ ] 4.4 Log loaded config file path at info level
- [ ] 4.5 Pass validated `Config` object to sync loop initialization

**Co-variance notes:**
- CLI entry point might not exist yet (Phase 0 might still be in progress)
- Need to coordinate with existing CLI structure or create if missing
- Error display format needs to match CLI style

### 5. Replace hardcoded values

- [ ] 5.1 Identify all hardcoded values in current codebase (watchDir, ownerId, debounce intervals)
- [ ] 5.2 Update sync loop constructors to accept config as parameter
- [ ] 5.3 Replace hardcoded values with config property access
- [ ] 5.4 Verify all config fields are consumed and none are unused

**Co-variance notes:**
- Sync loops might not exist yet depending on current implementation phase
- May need to update function signatures in multiple places
- Breaking changes to existing tests

### 6. Testing infrastructure

- [ ] 6.1 Create test helper function `createTestConfig()` that generates valid config with overrides
- [ ] 6.2 Update existing tests to use `createTestConfig()` helper
- [ ] 6.3 Add integration test: CLI startup with valid config file
- [ ] 6.4 Add integration test: CLI startup with missing required fields
- [ ] 6.5 Add integration test: CLI startup with invalid values

**Co-variance notes:**
- All existing tests will need config provided
- Test helper needs sensible defaults for all fields
- May expose issues in existing test structure

### 7. Documentation

- [ ] 7.1 Create example `txtatelier.config.json` file with all fields and comments (as separate doc)
- [ ] 7.2 Document config schema in README or docs: field names, types, defaults, validation rules
- [ ] 7.3 Document config file search order
- [ ] 7.4 Add troubleshooting section for common config errors

**Co-variance notes:**
- Documentation location might need new file structure
- Example config should include comments explaining each field (external doc, not in JSON)

### 8. Edge cases and validation

- [ ] 8.1 Decide on and implement `ownerId` format validation (if any)
- [ ] 8.2 Decide on and implement `watchDir` validation (exists? accessible? absolute path?)
- [ ] 8.3 Add validation for debounce intervals (minimum values, maximum values)
- [ ] 8.4 Test behavior with empty config file `{}`
- [ ] 8.5 Test behavior with config file containing extra unknown fields

**Co-variance notes:**
- Validation decisions made here become load-bearing assumptions
- Too strict validation reduces flexibility, too loose allows footguns
- Watch directory validation might need to be deferred or made optional

## Co-variance notes

_(Add notes here as implementation progresses)_

## Load-bearing assumptions that didn't hold

_(Add notes here if any assumptions from intervention.md or design.md prove incorrect during implementation)_
