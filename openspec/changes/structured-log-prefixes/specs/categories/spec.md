# Spec: Log Prefixes (Hybrid System)

## What behavior is being added?

Structured hybrid prefixes (component + direction) for all DEBUG level log messages in the file-sync system.

## Prefix Definitions

### [lifecycle]
**Purpose:** System lifecycle events visible to users (no event type)
**Level:** INFO
**When to use:** Startup, shutdown, ready states, owner changes

Examples:
```
[lifecycle] Initializing...
[lifecycle] Ready
[lifecycle] Shutting down...
[lifecycle] Owner restored. Restart required.
```

**Note:** No event types - the message context is sufficient.

### [watch:*]
**Purpose:** Filesystem watcher events (with event type)
**Level:** DEBUG
**When to use:** Filesystem add/change/unlink events

Examples:
```
[watch:add] notes/test.md
[watch:change] notes/test.md
[watch:unlink] notes/test.md
[watch] Starting watcher: /path/to/dir
[watch] Stopped watcher
```

**Note:** Event types (`:add`, `:change`, `:unlink`) for actual file operations. Simple `[watch]` for lifecycle messages.

### [capture:fs→evolu]
**Purpose:** Change capture: filesystem TO Evolu database
**Level:** DEBUG
**When to use:** Any operation that writes filesystem state into Evolu

Examples:
```
[capture:fs→evolu] Inserting: notes/test.md
[capture:fs→evolu] Updating: notes/test.md
[capture:fs→evolu] Deleting: notes/test.md
[capture:fs→evolu] No change: notes/test.md (hash matches)
```

### [materialize:evolu→fs]
**Purpose:** State materialization: Evolu database TO filesystem
**Level:** DEBUG
**When to use:** Any operation that writes Evolu state to filesystem

Examples:
```
[materialize:evolu→fs] Writing: notes/test.md
[materialize:evolu→fs] Skipped (already processed): notes/test.md
[materialize:evolu→fs] Skipped (disk matches): notes/test.md
[materialize:evolu→fs] Conflict detected: notes/test.md
[materialize:evolu→fs] Created conflict file: notes/test.conflict-xxx.md
[materialize:evolu→fs] Deleted: notes/test.md
```

### [reconcile:fs→evolu]
**Purpose:** Startup reconciliation: filesystem TO Evolu
**Level:** DEBUG
**When to use:** Startup scan finding new/changed files

Examples:
```
[reconcile:fs→evolu] Startup scan found 42 filesystem files
[reconcile:fs→evolu] Offline deletion detected: notes/old.md
```

### [reconcile:evolu→fs]
**Purpose:** Startup reconciliation: Evolu TO filesystem
**Level:** DEBUG
**When to use:** Applying remote deletions and updates on startup

Examples:
```
[reconcile:evolu→fs] Found 3 deleted rows in Evolu
[reconcile:evolu→fs] Applied 3 remote deletions
[reconcile:evolu→fs] Synced 15 files from Evolu
```

### [state:subscription]
**Purpose:** Subscription and initial load operations (no event type)
**Level:** DEBUG
**When to use:** Subscription events, query results, cursor management

Examples:
```
[state:subscription] Initial load: 42 existing files
[state:subscription] 🔔 Subscription fired (#1) at 2026-03-21T10:00:00.000Z
[state:subscription] Cursor initialized to latest history timestamp
```

**Note:** No event types - single concern, message context is sufficient.

### [state:debounce]
**Purpose:** Debounce and batching operations (no event type)
**Level:** DEBUG
**When to use:** Timer resets, batch processing

Examples:
```
[state:debounce] Resetting debounce timer (rapid changes)
[state:debounce] Change detected (debounced)
[state:debounce] No new changes to process
```

**Note:** No event types - single concern, message context is sufficient.

### [net:websocket:*]
**Purpose:** Network/WebSocket layer events (with event type)
**Level:** DEBUG
**When to use:** Connection open/close, message send/receive

Examples:
```
[net:websocket:open] wss://free.evoluhq.com
[net:websocket:message] 1024 bytes
[net:websocket:send] 512 bytes ok
[net:websocket:close] 1000 Normal closure
```

**Note:** Event types for all WebSocket lifecycle phases.

### [db:sqlite:*]
**Purpose:** SQLite database operations (with event type)
**Level:** DEBUG
**When to use:** Database initialization, serialization

Examples:
```
[db:sqlite:init] { memory: false }
```

**Note:** Event types for different database operations.

### [error]
**Purpose:** Error conditions (all categories)
**Level:** ERROR
**When to use:** Any error condition

Examples:
```
[error] Failed to sync notes/test.md: { type: "FileWriteFailed", ... }
[error] Evolu error: { ... }
[error] Failed to capture notes/test.md: { ... }
```

## What behavior is changing?

Existing log prefixes are being replaced:

| Current Prefix | New Prefix |
|----------------|------------|
| `[materialize]` | `[materialize:evolu→fs]`, `[state:subscription]`, `[state:debounce]` |
| `[capture]` | `[capture:fs→evolu]` |
| `[reconcile]` | `[reconcile:fs→evolu]`, `[reconcile:evolu→fs]` |
| `[watch]` | `[watch]` |
| `[evolu-sync]` | `[net:websocket]` |
| `[sqlite-driver]` | `[db:sqlite]` |
| `[file-sync]` | `[lifecycle]` |

## What behavior is being removed?

Nothing removed - only prefixes changed.

## What stays the same?

- Log message content (after prefix)
- Log levels (DEBUG, INFO, ERROR)
- Logger API (debug(), info(), warn(), error())
- Log destinations (console)

## Filtering Examples

```bash
# Show specific component operations
DEBUG | grep "capture:"
DEBUG | grep "materialize:"
DEBUG | grep "reconcile:"

# Show all operations in one direction
DEBUG | grep "→evolu"  # All fs→evolu (capture + reconcile:fs→evolu)
DEBUG | grep "→fs"     # All evolu→fs (materialize + reconcile:evolu→fs)

# Show specific component + direction
DEBUG | grep "capture:fs→evolu"
DEBUG | grep "materialize:evolu→fs"

# Show specific event types
DEBUG | grep "watch:add"       # Only file additions
DEBUG | grep "watch:change"   # Only file changes
DEBUG | grep "net:websocket:message"  # Only incoming messages

# Exclude noisy categories
DEBUG | grep -v "state:debounce"
DEBUG | grep -v "state:subscription"

# Show only lifecycle and errors
DEBUG | grep -E "(lifecycle|error)"

# Show only state management (not sync operations)
DEBUG | grep "state:"

# Show only network layer
DEBUG | grep "net:websocket"

# Show only database operations
DEBUG | grep "db:sqlite"
```

## Implementation Notes

1. Use template literals with prefix: `` `[component:direction] message` ``
2. Keep message content unchanged (don't over-format)
3. Direction arrows should use Unicode: → (U+2192)
4. Components use lowercase, match source file names where possible
5. Direction suffix only for operations with data flow (capture, materialize, reconcile)
6. No direction suffix for: watch, lifecycle, state:*, net:*, db:*
