# Design: structured-log-prefixes

## Decision: Hybrid System with Selective Event Types (Option C3 + Option 2)

We will use **component names with optional event type or direction suffixes**.

**Rationale:**
- **Component names map to source files** - easy to find where log originates
- **Direction suffixes for sync operations** - `:fs→evolu` vs `:evolu→fs` shows data flow
- **Event type suffixes for meaningful variation** - `:add/change/unlink` for watch, `:open/close/message` for WebSocket
- **Keep simple components plain** - lifecycle, state don't need event types (message context is enough)
- **Maximum grep flexibility** - filter by component, direction, or event type

## Prefix Definitions

| Prefix | Meaning | Log Level | Files |
|--------|---------|-----------|-------|
| `[lifecycle]` | Startup, shutdown (no event types) | INFO | index.ts |
| `[watch:*]` | Filesystem watcher events (with types: add/change/unlink) | DEBUG | watch.ts |
| `[capture:fs→evolu]` | Filesystem → Evolu sync (with direction) | DEBUG | change-capture*.ts |
| `[materialize:evolu→fs]` | Evolu → Filesystem sync (with direction) | DEBUG | state-materialization*.ts |
| `[reconcile:fs→evolu]` | Startup sync fs→Evolu (with direction) | DEBUG | startup-reconciliation.ts |
| `[reconcile:evolu→fs]` | Startup sync Evolu→fs (with direction) | DEBUG | startup-reconciliation.ts |
| `[state:subscription]` | Subscription/load (no event types) | DEBUG | state-materialization.ts |
| `[state:debounce]` | Debounce/batching (no event types) | DEBUG | state-materialization.ts |
| `[net:websocket:*]` | WebSocket events (with types: open/close/message/send) | DEBUG | BunEvoluDeps.ts |
| `[db:sqlite:*]` | SQLite operations (with types: init) | DEBUG | BunSqliteDriver.ts |
| `[error]` | Error conditions | ERROR | All files |

## Taxonomy Rules

1. **Use event types where events are meaningfully different:**
   - `[watch:add]`, `[watch:change]`, `[watch:unlink]` - different file operations
   - `[net:websocket:open]`, `[net:websocket:message]` - different lifecycle phases
   - `[db:sqlite:init]` - different db operations (extensible)

2. **Use direction for data flow between systems:**
   - `[capture:fs→evolu]` - filesystem to Evolu
   - `[materialize:evolu→fs]` - Evolu to filesystem
   - `[reconcile:fs→evolu]`, `[reconcile:evolu→fs]` - both directions

3. **Keep simple where context is sufficient:**
   - `[lifecycle]` - startup/shutdown/ready (message is clear)
   - `[state:subscription]` - subscription events (single concern)
   - `[state:debounce]` - debounce operations (single concern)

## Implementation Pattern

### Logger Usage

```typescript
// Current
logger.debug(`[materialize] Writing: ${path}`);
logger.debug(`[watch] add: ${path}`);
logger.debug(`[evolu-sync] websocket open`);

// New (Hybrid: component + direction/event-type)
logger.debug(`[materialize:evolu→fs] Writing: ${path}`);
logger.debug(`[capture:fs→evolu] Inserting: ${path}`);
logger.debug(`[watch:add] ${path}`);
logger.debug(`[net:websocket:open] wss://free.evoluhq.com`);
logger.debug(`[lifecycle] Ready`);  // No suffix - simple component
```

### LogAction Changes (Optional Enhancement)

```typescript
// Option A: Just use strings (simplest)
log("debug", `[sync:evolu→fs] Writing: ${path}`);

// Option B: Typed categories (more structure)
export interface LogAction {
  readonly type: "LOG";
  readonly category: "lifecycle" | "file:watch" | "sync:fs→evolu" | ...;
  readonly level: "debug" | "info" | "warn" | "error";
  readonly message: string;
}

// Usage
log("sync:evolu→fs", "debug", `Writing: ${path}`);
```

**Decision:** Start with Option A (string prefixes). If we need programmatic filtering later, migrate to Option B.

## Migration Strategy

### Phase 1: Update DEBUG logs in planning functions
- change-capture-plan.ts: `[capture] → [capture:fs→evolu]`
- state-materialization-plan.ts: `[materialize] → [materialize:evolu→fs]`

### Phase 2: Update DEBUG logs in sync infrastructure
- state-materialization.ts: 
  - Sync operations → `[materialize:evolu→fs]`
  - State operations → `[state:subscription]` or `[state:debounce]` (no suffixes)
- watch.ts: `[watch] → [watch:add/change/unlink]` for file events
- startup-reconciliation.ts: `[reconcile] → [reconcile:fs→evolu]` or `[reconcile:evolu→fs]`

### Phase 3: Update platform layer
- BunEvoluDeps.ts: `[evolu-sync] → [net:websocket:open/message/send/close]`
- BunSqliteDriver.ts: `[sqlite-driver] → [db:sqlite:init]`

### Phase 4: Update lifecycle logs
- file-sync/index.ts: `[file-sync] → [lifecycle]`

### Phase 5: Verify INFO logs are minimal
- Keep `[lifecycle]` for startup/shutdown (INFO level)
- Ensure no direction-suffix logs appear at INFO level

## Verification Plan

1. Run with `TXTATELIER_LOG_LEVEL=DEBUG` and create a test file
2. Verify output shows:
   - `[watch:add] test.md` (with event type)
   - `[watch:change] test.md` (with event type)
   - `[capture:fs→evolu] Inserting: test.md`
   - `[materialize:evolu→fs] Writing: test.md` (echo from subscription)
3. Test filtering:
   - `grep "capture:"` → shows capture operations
   - `grep "materialize:"` → shows materialize operations
   - `grep "reconcile:"` → shows reconciliation
   - `grep "→evolu"` → shows all fs→evolu operations
   - `grep "→fs"` → shows all evolu→fs operations

## Open Questions

1. **Should we keep `[watch]` or change to `[file:watch]`?**
   - Preference: `[watch]` - shorter, maps directly to watch.ts

2. **Direction arrows in all sync components or just materialize/capture?**
   - Decision: All sync operations that have directionality get arrows
   - `[capture:fs→evolu]`, `[materialize:evolu→fs]`, `[reconcile:fs→evolu]`, `[reconcile:evolu→fs]`

3. **Should we add timestamps to prefixes?**
   - No - Evolu's console already handles timestamps if enabled

4. **Color coding?**
   - Out of scope - keep it simple text for now
