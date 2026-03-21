# Proposal: structured-log-prefixes

## Problem

DEBUG level logs currently use inconsistent, component-specific prefixes like `[materialize]`, `[capture]`, `[watch]`. This makes it hard to:
- Filter by functional domain (e.g., "show me all sync operations")
- Understand data flow direction (is this filesystem→Evolu or Evolu→filesystem?)
- Focus on specific concerns without noise

## Solution

Implement a **category-based prefix system** with directional indicators for sync operations.

### Category Schema

```
[lifecycle]      - System lifecycle events
[file:watch]     - Filesystem watch events  
[sync:fs→evolu]  - Sync: filesystem TO Evolu
[sync:evolu→fs]  - Sync: Evolu TO filesystem
[state:load]     - State loading operations
[state:debounce] - Debounce/batching
[net:websocket]  - Network layer
[db:init]        - Database initialization
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
[state:load] 🔔 Subscription fired (#1) at 2026-03-21T10:00:00.000Z
[sync:fs→evolu] Inserting: notes/test.md
[sync:evolu→fs] Writing: notes/test.md
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

1. `DEBUG | grep "sync:"` shows all sync operations (both directions)
2. `DEBUG | grep "→evolu"` shows all filesystem→Evolu operations
3. `DEBUG | grep -v "state:debounce"` hides debounce noise
4. New developers can understand data flow from reading DEBUG logs

## Dependencies

Depends on: `add-txtatelier-log-level` (provides DEBUG level infrastructure)

## Timeline

Small change - 1-2 days to implement once design is approved.

## Contact Test Preview

**Evidence tier:** Proximal - use grep to filter DEBUG output

**Success-if:** Can effectively filter DEBUG logs by category/direction
**Failure-if:** Prefixes are inconsistent or filtering doesn't work as expected
