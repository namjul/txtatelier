# Design: prevent-duplicate-instance-start

## Approach

Use `proper-lockfile` library to enforce single-instance-per-directory via atomic directory locking:

1. **Lock mechanism**: `proper-lockfile` uses atomic `mkdir` strategy - the lock IS the directory creation itself. Pass the watch directory path to the library; it handles lock location internally via a companion lock directory.
2. **Implementation location**: Create `centers/cli/src/file-sync/platform/InstanceLock.ts` as platform abstraction
3. **Lock acquisition**: Before initializing Evolu in `runStart()`, acquire exclusive lock on watch directory via `proper-lockfile`
4. **Failure path**: If lock fails, print clear error with PID of holding process (if retrievable from lock metadata) and exit with code 2
5. **Success path**: Hold lock for process lifetime; `proper-lockfile` automatically releases on graceful exit and detects stale locks (10s threshold)
6. **Error handling**: Create specific error type `InstanceLockError` with variants for "AlreadyLocked" and "LockFailed"

Interface design:
```typescript
export type InstanceLock = {
  readonly acquire: () => Promise<Result<void, InstanceLockError>>;
  readonly release: () => Promise<void>;
};

export const createInstanceLock = (watchDir: string): InstanceLock;
```

`proper-lockfile` handles:
- **Lock location**: Creates companion lock directory automatically (adjacent to watch dir by default, customizable via `lockfilePath` option)
- **Atomic acquisition**: Uses `mkdir` which is atomic on all filesystems including NFS
- **Stale detection**: Updates mtime periodically; detects crashed processes via stale threshold (default 10s)
- **Cleanup**: Automatically releases on graceful process exit (SIGTERM, SIGINT, normal exit)
- **Cross-platform**: Works on Linux, macOS, Windows via Node.js fs APIs

## Rationale

**Why file locking over other approaches?**

- **PID files**: Require manual cleanup on crash; race conditions on read-check-write
- **Port binding**: Would require network stack; doesn't work offline; port conflicts with other apps
- **Environment variables**: Not cross-process; session-local only
- **SQLite exclusive mode**: Too late—database initialization happens after we want to fail

File locking is atomic at OS level, survives crashes (OS releases locks), and requires no cleanup logic for normal termination.

**Why lock the watch directory itself rather than use a global lock registry?**

- `proper-lockfile` creates lock companion directory automatically
- Allows same user to run multiple txtatelier instances on different directories
- Lock lifetime bound to directory lifetime (if you delete the directory, lock concern disappears)
- No global state to manage or clean up
- Clear association: the lock is for this specific directory

## Load-bearing assumptions

1. **`proper-lockfile` works correctly on Bun** (via Node compatibility layer) - it uses `mkdir` strategy which is atomic on all filesystems
2. **Lock acquisition is atomic**—`proper-lockfile`'s `mkdir` strategy guarantees this
3. **Reading our own PID and checking other process PIDs is reliable** - needed for error messages and stale lock verification
4. **The parent directory of watch directory is writable** - `proper-lockfile` needs to create companion lock directory
5. **The companion lock directory doesn't interfere with sync** - lock metadata shouldn't be synced (may need to add pattern to ignore list)

If any prove false during implementation, the approach must be revised.

## Risks and trade-offs

**Risk: Network filesystems may not support advisory locks**
- Mitigation: Detect NFS/unsupported fs and warn user; they accept the race condition risk
- Trade-off: We sacrifice perfect protection for NFS users to gain simplicity for local filesystem users

**Risk: Stale lock detection race condition**
- Window exists between checking PID and acquiring lock where original process could restart
- Mitigation: Accept this window; it's the same risk as PID files anyway, and rare

**Risk: Users running as different OS users**
- User A starts txtatelier, User B tries to start on same directory
- User B can't read lock file or see User A's process
- Trade-off: Single-instance guarantee only works per-user; cross-user conflicts are out of scope

## Out of scope

- `--force` flag to override lock (useful but dangerous; defer to future need)
- Network filesystem robustness beyond warning
- Cross-user instance detection
- Instance status/ls command (could be useful but separate feature)
- Automatic lock recovery after crashes (we do stale detection but user must manually clear)

## Known unknowns

- Does `proper-lockfile` behave correctly under Bun (Node compatibility layer)?
- What's the exact behavior on Windows with `proper-lockfile` stale detection?
- How does this interact with containerized environments (Docker bind mounts with `mkdir` locking)?
- Should we add `.txtatelier/` to the default ignore patterns to prevent syncing lock metadata?

## Co-variance

What else this motion will touch:

- **NEW FILE**: `centers/cli/src/file-sync/platform/InstanceLock.ts` - Platform abstraction for instance locking
- **MODIFY**: `centers/cli/src/file-sync/platform/index.ts` - Export the new `InstanceLock` interface
- **MODIFY**: `centers/cli/package.json` - Add `proper-lockfile` dependency (~3 transitive deps)
- **MODIFY**: `centers/cli/src/index.ts` - Add lock acquisition before `startFileSync()` call
- **MODIFY**: `centers/cli/src/file-sync/index.ts` - May need to expose watchDir earlier for lock check

Order of operations in startup (`runStart` function):
1. Parse args → determine watchDir
2. **Create InstanceLock and acquire** ← new step (before Evolu init)
3. On success → proceed to startFileSync
4. On failure → print error with PID, exit with code 2

Exit code 2 chosen to distinguish "duplicate instance" from other startup failures (code 1).

## ⚠ Design warnings

### Responsiveness

The lock check happens before any heavy initialization (Evolu, sync loops), so startup failure is fast (<100ms). Users get immediate feedback—no hanging, no timeout confusion.

### Continuity after correction

If user sees "Instance already running" error, the message must include:
- The conflicting directory path (so they know which instance)
- The PID of the running instance (so they can terminate it)
- Clear next steps: "Run `kill <pid>` to stop the existing instance, or use a different directory"

Without this guidance, they're stuck. The error is the entire UI for this edge case.

### Exploratory capacity

This intervention deliberately removes the ability to "just see what happens" when running multiple instances. Users lose the accidental discovery path of "huh, weird conflict files" leading to eventual understanding.

We trade that exploration for immediate clarity. This is appropriate because:
- The failure mode was confusing, not educational
- The fix is obvious (don't run two instances)
- The cost of accidental discovery was corrupted data

But it's worth naming: we're closing a door that, while dangerous, was a feedback loop some users might have learned from.
