# Gesture: structured-log-prefixes

## Gesture type
create

## What are we gesturing toward?
A categorized, filterable logging system where DEBUG level logs are organized by functional domain rather than scattered arbitrary prefixes.

## Current State
DEBUG logs exist but use inconsistent prefixes:
- `[materialize]` - mixed state subscription + sync operations
- `[capture]` - mixed watch events + sync planning
- `[reconcile]` - startup reconciliation only
- `[watch]` - filesystem events
- `[evolu-sync]` - WebSocket events
- `[sqlite-driver]` - database init

This makes filtering difficult. You can't easily see "all sync operations" or "all filesystem activity" without complex grep patterns.

## Claim
Adding structured hybrid prefixes (component + direction) will enable:
1. **Targeted debugging** - `DEBUG | grep "capture:"` shows only capture operations
2. **Direction filtering** - `DEBUG | grep "→evolu"` shows all filesystem→Evolu flow
3. **Component mapping** - Prefixes map to source files for easy navigation
4. **Maximum flexibility** - Filter by component OR direction or both

## Selected: Option C3 (Hybrid)

Combines component names with directional suffixes where data flow matters:

```
[lifecycle]                - Startup, shutdown, ready states
[watch]                    - Filesystem watch events (add/change/unlink)
[capture:fs→evolu]         - Filesystem changes being captured TO Evolu
[materialize:evolu→fs]     - Evolu changes being materialized TO filesystem
[reconcile:fs→evolu]        - Startup reconciliation (fs→Evolu)
[reconcile:evolu→fs]        - Startup reconciliation (Evolu→fs)
[state:subscription]       - Subscription events, initial loads
[state:debounce]           - Debounce timers, batching
[net:websocket]            - WebSocket open/close/messages
[db:sqlite]                - SQLite operations
[error]                    - Errors (all levels)
```

**Rationale:** Best of both worlds - component names map to source files, directional suffixes show data flow.

## What are our load-bearing assumptions?
1. Users will actually use grep filtering (not just scroll through all DEBUG output)
2. Category names are self-documenting
3. The overhead of longer prefixes is worth the clarity

## Co-variance: what else might this touch?
- All files in `file-sync/` that call `logger.debug()`
- Documentation for debugging/troubleshooting
- Potentially the LogAction type if we want typed categories

## Spec files this gesture touches
- specs/logging/categories.md - defining the category system

## Design Decision Needed
**Q:** Should categories be enforced at the type level (via LogAction) or just convention?
**A:** (TBD - see design.md)

**Q:** Do we keep some existing prefixes like `[materialize]` or migrate everything to new system?
**A:** (TBD - see design.md)
