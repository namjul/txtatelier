# Gesture: add-txtatelier-log-level

## Gesture type
create

## What are we gesturing toward?
The logging system configuration for txtatelier CLI, specifically adding graduated log levels to control verbosity.

## Claim
Adding `TXT_ATELIER_LOG_LEVEL` with DEBUG/INFO/ERROR levels will provide:
1. Clean production logs (ERROR only by default)
2. Operational visibility when needed (INFO shows important lifecycle events)
3. Deep debugging capability when troubleshooting (DEBUG shows all file operations)

## What made us do this?
The current system lacks granularity - either all logs or minimal logs. During development and troubleshooting, we need to see file sync decisions and timing without being overwhelmed by routine operational messages.

## What are our load-bearing assumptions?
1. Evolu's `createConsole` can be wrapped to support level-based filtering
2. DEBUG level will actually help diagnose sync issues (not just add noise)
3. INFO level can be kept minimal while still being useful

## Spec files this gesture touches
- specs/logging/spec.md - creating the log level capability

## Logger API

The wrapped logger exports only level-specific methods:

```typescript
export const logger = {
  debug: (...args: unknown[]): void;
  info: (...args: unknown[]): void;
  warn: (...args: unknown[]): void;
  error: (...args: unknown[]): void;
};
```

**Note**: The ambiguous `log()` method has been removed. Use explicit level methods:
- `logger.debug()` - Detailed operational traces (file operations, hash comparisons)
- `logger.info()` - Lifecycle events and progress summaries
- `logger.warn()` - Non-fatal issues
- `logger.error()` - Fatal errors (always outputs regardless of log level)

## Co-variance: what else might this touch?
- Environment variable parsing in env.ts
- Logger initialization and wrapper logic
- All files that call logger methods (will need reclassification in phase 2)
- Documentation for configuration
- Shell scripts that set logging variables
