# Spec: Log Categories

## What behavior is being added?

Structured category prefixes for all DEBUG level log messages in the file-sync system.

## Category Definitions

### [lifecycle]
**Purpose:** System lifecycle events visible to users
**Level:** INFO
**When to use:** Startup, shutdown, ready states, owner changes

Examples:
```
[lifecycle] Initializing...
[lifecycle] Ready
[lifecycle] Shutting down...
[lifecycle] Owner restored. Restart required.
```

### [file:watch]
**Purpose:** Filesystem watcher events
**Level:** DEBUG
**When to use:** Any filesystem add/change/unlink events

Examples:
```
[file:watch] add: notes/test.md
[file:watch] change: notes/test.md
[file:watch] unlink: notes/test.md
```

### [sync:fs→evolu]
**Purpose:** Changes flowing FROM filesystem TO Evolu database
**Level:** DEBUG
**When to use:** Any operation that writes filesystem state into Evolu

Examples:
```
[sync:fs→evolu] Inserting: notes/test.md
[sync:fs→evolu] Updating: notes/test.md
[sync:fs→evolu] Deleting: notes/test.md
[sync:fs→evolu] No change: notes/test.md (hash matches)
```

### [sync:evolu→fs]
**Purpose:** Changes flowing FROM Evolu database TO filesystem
**Level:** DEBUG
**When to use:** Any operation that writes Evolu state to filesystem

Examples:
```
[sync:evolu→fs] Writing: notes/test.md
[sync:evolu→fs] Skipped (already processed): notes/test.md
[sync:evolu→fs] Skipped (disk matches): notes/test.md
[sync:evolu→fs] Conflict detected: notes/test.md
[sync:evolu→fs] Created conflict file: notes/test.conflict-xxx.md
[sync:evolu→fs] Deleted: notes/test.md
```

### [state:load]
**Purpose:** State loading operations
**Level:** DEBUG
**When to use:** Initial data loads, query results, subscription setup

Examples:
```
[state:load] Initial load: 42 existing files
[state:load] 🔔 Subscription fired (#1) at 2026-03-21T10:00:00.000Z
[state:load] Cursor initialized to latest history timestamp
[state:load] Processing 5 changed files: a.md, b.md, c.md, d.md, e.md
```

### [state:debounce]
**Purpose:** Debounce and batching operations
**Level:** DEBUG
**When to use:** Timer resets, batch processing

Examples:
```
[state:debounce] Resetting debounce timer (rapid changes)
[state:debounce] Change detected (debounced)
[state:debounce] No new changes to process
```

### [net:websocket]
**Purpose:** Network/WebSocket layer events
**Level:** DEBUG
**When to use:** Connection open/close, message send/receive

Examples:
```
[net:websocket] websocket open wss://free.evoluhq.com
[net:websocket] websocket message 1024
[net:websocket] websocket send 512 ok
[net:websocket] websocket close 1000 Normal closure
```

### [db:init]
**Purpose:** Database initialization
**Level:** DEBUG
**When to use:** Database setup, deserialization, WAL mode

Examples:
```
[db:init] init { memory: false }
```

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
| `[materialize]` | `[sync:evolu→fs]`, `[state:*]` |
| `[capture]` | `[sync:fs→evolu]` |
| `[reconcile]` | `[sync:fs→evolu]`, `[sync:evolu→fs]` |
| `[watch]` | `[file:watch]` |
| `[evolu-sync]` | `[net:websocket]` |
| `[sqlite-driver]` | `[db:init]` |
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
# Show all sync operations (both directions)
DEBUG | grep "sync:"

# Show only filesystem → Evolu sync
DEBUG | grep "→evolu"

# Show only Evolu → filesystem sync
DEBUG | grep "→fs"

# Exclude debounce noise
DEBUG | grep -v "state:debounce"

# Show only lifecycle and errors
DEBUG | grep -E "(lifecycle|error)"

# Show everything except state internals
DEBUG | grep -v "state:"
```

## Implementation Notes

1. Use template literals with category prefix: `` `[category] message` ``
2. Keep message content unchanged (don't over-format)
3. Direction arrows should use Unicode: → (U+2192)
4. Categories use lowercase with hyphens
