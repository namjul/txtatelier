# Design: add-txtatelier-log-level

## Approach

Wrap Evolu's `createConsole` with a level-based filter. Define `LogLevel` enum with DEBUG/INFO/ERROR. Parse `TXT_ATELIER_LOG_LEVEL` from environment. Implement wrapper logger that checks level before delegating to Evolu's console.

**Level priority (higher number = more restrictive):**
- DEBUG (0) - shows all
- INFO (1) - shows INFO and ERROR
- ERROR (2) - shows only ERROR

**Implementation:**
1. `env.ts`: Parse `TXT_ATELIER_LOG_LEVEL` → `LogLevel` enum
2. `logger.ts`: Export wrapped logger with `debug()`, `info()`, `warn()`, `error()` methods
3. Filter logic: `messageLevelPriority >= configLevelPriority`

## Why this approach?

Evolu's `createConsole` has boolean `enableLogging`. We need graduated levels. Wrapping is the cleanest solution:
- Leverages Evolu's console implementation
- Adds filtering without modifying Evolu
- Minimal code (~20-30 lines)
- Type-safe wrapper

Alternative: Fork Evolu's logger - rejected, too heavy.
Alternative: Use a different logging library - rejected, unnecessary complexity.

## What are our load-bearing assumptions?

1. Evolu's console methods (`log`, `info`, `warn`, `error`) can be called conditionally without side effects
2. The performance cost of checking a level before each log call is negligible
3. DEBUG level will actually be useful (to be validated in contact tests)

## Risks and trade-offs

**Risk**: DEBUG output could be overwhelming in high-activity scenarios (many files syncing rapidly).
**Mitigation**: Phase 2 will refine DEBUG logs after real usage.

**Trade-off**: Additional wrapper function call per log. Negligible impact given file sync is I/O bound.

## What we are not doing

- Not adding runtime log level changes (requires restart)
- Not adding file-based logging or rotation
- Not adding structured logging (JSON)
- Not adding per-module log levels
- Not changing error behavior (Evolu already shows errors when disabled)

## Known unknowns

- Exact performance impact of DEBUG logging with 1000+ files
- Whether DEBUG level will provide enough value vs. noise

## Co-variance: what else might this touch?

- Scripts that set `TXT_ATELIER_LOG` will need updating to `TXT_ATELIER_LOG_LEVEL`
- Documentation will need updating
- Developer muscle memory for the old variable

## ⚠ Design warnings

### Responsiveness
No impact - logging doesn't affect response times.

### Continuity after correction
Invalid log level values will throw clear validation errors during startup, not silently fail.

### Exploratory capacity
More log levels = more ways to observe system. Should increase exploratory capacity.
