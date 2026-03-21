# Design: structured-log-prefixes

## Decision: Category-Based System (Option C1)

We will use **functional categories with directional arrows** rather than component names.

**Rationale:**
- **Data flow is the primary concern** when debugging sync issues
- **Categories group by intent** not implementation (one category may span multiple files)
- **Arrows show directionality** without verbose "to" / "from" text
- **Better grep ergonomics** - single token per category

## Category Definitions

| Category | Meaning | Log Level | Files |
|----------|---------|-----------|-------|
| `[lifecycle]` | Startup, shutdown, major state changes | INFO | index.ts |
| `[file:watch]` | Filesystem watcher events | DEBUG | watch.ts |
| `[sync:fs→evolu]` | Filesystem change being synced TO Evolu | DEBUG | change-capture*.ts |
| `[sync:evolu→fs]` | Evolu change being synced TO filesystem | DEBUG | state-materialization*.ts |
| `[state:load]` | Initial data load, subscription setup | DEBUG | state-materialization.ts |
| `[state:debounce]` | Debounce timers, batching operations | DEBUG | state-materialization.ts |
| `[net:websocket]` | WebSocket connection events | DEBUG | BunEvoluDeps.ts |
| `[db:init]` | Database initialization | DEBUG | BunSqliteDriver.ts |
| `[error]` | Error conditions | ERROR | All files |

## Implementation Pattern

### Logger Usage

```typescript
// Current
logger.debug(`[materialize] Writing: ${path}`);

// New
logger.debug(`[sync:evolu→fs] Writing: ${path}`);
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
- change-capture-plan.ts: `[capture] → [sync:fs→evolu]`
- state-materialization-plan.ts: `[materialize] → [sync:evolu→fs]`

### Phase 2: Update DEBUG logs in sync infrastructure
- state-materialization.ts: Split between `[state:*]` and `[sync:evolu→fs]`
- watch.ts: `[watch] → [file:watch]`
- startup-reconciliation.ts: `[reconcile] → [sync:*]`

### Phase 3: Update platform layer
- BunEvoluDeps.ts: `[evolu-sync] → [net:websocket]`
- BunSqliteDriver.ts: `[sqlite-driver] → [db:init]`

### Phase 4: Verify INFO logs are minimal
- Keep `[lifecycle]` for startup/shutdown (INFO level)
- Ensure no other categories appear at INFO level

## Verification Plan

1. Run with `TXTATELIER_LOG_LEVEL=DEBUG` and create a test file
2. Verify output shows:
   - `[file:watch] add: test.md`
   - `[sync:fs→evolu] Inserting: test.md`
   - `[sync:evolu→fs] Writing: test.md` (echo from subscription)
3. Test filtering:
   - `grep "sync:"` → shows both direction lines
   - `grep "→evolu"` → shows only fs→evolu
   - `grep "→fs"` → shows only evolu→fs

## Open Questions

1. **Should we keep `[lifecycle]` for INFO level or use `[startup]`?**
   - Preference: `[lifecycle]` - more general

2. **What about `[reconcile]` logs?**
   - Split: Startup reconciliation → `[sync:fs→evolu]`, Evolu reconciliation → `[sync:evolu→fs]`

3. **Should we add timestamps to prefixes?**
   - No - Evolu's console already handles timestamps if enabled

4. **Color coding?**
   - Out of scope - keep it simple text for now
