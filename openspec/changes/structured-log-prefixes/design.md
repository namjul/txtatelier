# Design: structured-log-prefixes

## Decision: Hybrid System (Option C3)

We will use **component names with directional suffixes** where data flow matters.

**Rationale:**
- **Component names map to source files** - easy to find where log originates
- **Direction suffixes show data flow** - `:fs→evolu` vs `:evolu→fs`
- **Maximum grep flexibility** - can filter by component OR direction
- **Best of both worlds** - structure of components + clarity of direction

## Prefix Definitions

| Prefix | Meaning | Log Level | Files |
|--------|---------|-----------|-------|
| `[lifecycle]` | Startup, shutdown, major state changes | INFO | index.ts |
| `[watch]` | Filesystem watcher events | DEBUG | watch.ts |
| `[capture:fs→evolu]` | Filesystem change being captured TO Evolu | DEBUG | change-capture*.ts |
| `[materialize:evolu→fs]` | Evolu change being materialized TO filesystem | DEBUG | state-materialization*.ts |
| `[reconcile:fs→evolu]` | Startup reconciliation (filesystem TO Evolu) | DEBUG | startup-reconciliation.ts |
| `[reconcile:evolu→fs]` | Startup reconciliation (Evolu TO filesystem) | DEBUG | startup-reconciliation.ts |
| `[state:subscription]` | Subscription events, initial loads | DEBUG | state-materialization.ts |
| `[state:debounce]` | Debounce timers, batching | DEBUG | state-materialization.ts |
| `[net:websocket]` | WebSocket connection events | DEBUG | BunEvoluDeps.ts |
| `[db:sqlite]` | SQLite operations | DEBUG | BunSqliteDriver.ts |
| `[error]` | Error conditions | ERROR | All files |

## Implementation Pattern

### Logger Usage

```typescript
// Current
logger.debug(`[materialize] Writing: ${path}`);

// New (Hybrid: component + direction)
logger.debug(`[materialize:evolu→fs] Writing: ${path}`);
logger.debug(`[capture:fs→evolu] Inserting: ${path}`);
logger.debug(`[reconcile:fs→evolu] Startup scan found ${count} files`);
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
  - State operations → `[state:subscription]` or `[state:debounce]`
- watch.ts: Keep `[watch]` (no direction, just filesystem events)
- startup-reconciliation.ts: `[reconcile] → [reconcile:fs→evolu]` or `[reconcile:evolu→fs]`

### Phase 3: Update platform layer
- BunEvoluDeps.ts: `[evolu-sync] → [net:websocket]`
- BunSqliteDriver.ts: `[sqlite-driver] → [db:sqlite]`

### Phase 4: Update lifecycle logs
- file-sync/index.ts: `[file-sync] → [lifecycle]`

### Phase 5: Verify INFO logs are minimal
- Keep `[lifecycle]` for startup/shutdown (INFO level)
- Ensure no direction-suffix logs appear at INFO level

## Verification Plan

1. Run with `TXTATELIER_LOG_LEVEL=DEBUG` and create a test file
2. Verify output shows:
   - `[watch] add: test.md`
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
