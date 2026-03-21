# Proposal: structured-log-prefixes

## Problem

DEBUG level logs currently use inconsistent, component-specific prefixes like `[materialize]`, `[capture]`, `[watch]`. This makes it hard to:
- Filter by functional domain (e.g., "show me all sync operations")
- Understand data flow direction (is this filesystem→Evolu or Evolu→filesystem?)
- Focus on specific concerns without noise

## Solution

Implement a **hybrid prefix system** combining component names with directional suffixes.

### Prefix Schema

```
[lifecycle]                - System lifecycle events
[watch]                    - Filesystem watch events  
[capture:fs→evolu]         - Capture: filesystem TO Evolu
[materialize:evolu→fs]     - Materialize: Evolu TO filesystem
[reconcile:fs→evolu]        - Reconcile: filesystem TO Evolu
[reconcile:evolu→fs]        - Reconcile: Evolu TO filesystem
[state:subscription]       - State loading/subscriptions
[state:debounce]           - Debounce/batching
[net:websocket]            - Network layer
[db:sqlite]                - SQLite operations
```

### Examples

**Before:**
```
[materialize] 🔔 Subscription fired (#1) at 2026-03-21T10:00:00.000Z
[capture] Inserting: notes/test.md
[materialize] Writing: notes/test.md
```

**After:**
```
[state:subscription] 🔔 Subscription fired (#1) at 2026-03-21T10:00:00.000Z
[capture:fs→evolu] Inserting: notes/test.md
[materialize:evolu→fs] Writing: notes/test.md
```

## Scope

### In Scope
- Update all `logger.debug()` calls in file-sync/ to use new prefixes
- Update LogAction type to support typed categories
- Update documentation

### Out of Scope
- Changing INFO or ERROR level logs (keep them simple)
- Adding new log messages (just re categorizing existing ones)
- Performance optimizations

## Success Criteria

1. `DEBUG | grep "capture:"` shows capture operations
2. `DEBUG | grep "materialize:"` shows materialize operations
3. `DEBUG | grep "→evolu"` shows all filesystem→Evolu operations (across components)
4. `DEBUG | grep -v "state:debounce"` hides debounce noise
5. New developers can map prefixes to source files

## Dependencies

Depends on: `add-txtatelier-log-level` (provides DEBUG level infrastructure)

## Timeline

Small change - 1-2 days to implement once design is approved.

## Contact Test Preview

**Evidence tier:** Proximal - use grep to filter DEBUG output

**Success-if:** Can effectively filter DEBUG logs by category/direction
**Failure-if:** Prefixes are inconsistent or filtering doesn't work as expected
