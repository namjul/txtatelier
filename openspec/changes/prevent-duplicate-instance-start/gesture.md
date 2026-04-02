# Gesture: prevent-duplicate-instance-start

## Gesture type
repair

## What are we gesturing toward?
single-instance-guard - prevents multiple Evolu instances from corrupting the same watch directory

## Claim
If a user attempts to start txtatelier on a watch directory that already has a running instance, the second start will fail immediately with a clear error message explaining the conflict, and no database corruption or sync conflicts will occur.

## What made us do this?
Evolu supports multi-tenancy via the `name` property (each instance gets its own SQLite database file), but nothing prevents starting multiple txtatelier instances pointing at the same filesystem directory. When this happens:
- Conflict files spawn mysteriously (`.conflict-*` files appearing)
- Files disappear or reappear without user action
- Database states diverge between instances
- Race conditions between change capture and state materialization

The failure is loud (visible file chaos) but the CAUSE is invisible. Users see symptoms without intuiting that multiple instances are the root cause. This wastes debugging time and creates mistrust in the system.

## Load-bearing assumptions
1. We can reliably detect if another txtatelier instance is already managing a specific watch directory (file lock, pid file, or similar mechanism)
2. The detection mechanism itself won't cause the corruption we're trying to prevent (race conditions in lock acquisition)
3. Users expect and accept that only one instance per directory is allowed (this is a reasonable constraint, not an artificial limitation)

## Structures this gesture touches

### New structures (anticipated)
- `structures/instance-lock/` - Cross-process mutex for watch directory
- `structures/startup-validation/` - Pre-flight checks before initializing Evolu

### Anticipated co-variances
- `structures/error-handling/` - New error type for duplicate instance
- `structures/cli-initialization/` - Startup sequence now includes lock acquisition

## Co-variance

What else might shift:
- CLI exit codes may need to distinguish "duplicate instance" from other errors (for scripting)
- Error messages become part of the UI contract - users may parse them
- Need to handle edge cases: crashed instances leaving stale locks, network filesystems with different locking semantics
- May need `--force` flag to override (dangerous but useful for recovery)
- Could evolve into "instance status" command showing which directories are locked
