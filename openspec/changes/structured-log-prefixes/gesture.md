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
Adding structured category prefixes will enable:
1. **Targeted debugging** - `DEBUG | grep "sync:evolu→fs"` shows only Evolu→filesystem sync
2. **Clear data flow** - Directional arrows show which way data moves
3. **Noise reduction** - Can exclude noisy categories like `[state:debounce]`
4. **Documentation through structure** - The prefix system documents the architecture

## Categories (Option C1 - Recommended)

```
[lifecycle]      - Startup, shutdown, ready states
[file:watch]     - Filesystem watch events (add/change/unlink)
[sync:fs→evolu]  - Filesystem changes syncing TO Evolu
[sync:evolu→fs]  - Evolu changes syncing TO filesystem
[state:load]     - Initial loads, subscriptions, cursors
[state:debounce] - Debounce timers, batching
[net:websocket]  - WebSocket open/close/messages
[db:init]        - Database initialization, migrations
[error]          - Errors (all levels)
```

## Alternative: Option C2 (Component-Based)

Keep existing `[materialize]`, `[capture]`, etc. but make them consistent and add subcategories:
```
[materialize:write]    vs [materialize:skip]
[capture:plan]         vs [capture:execute]
```

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
