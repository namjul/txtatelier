# instance-lock (delta)

## ADDED Requirements

### Requirement: Single CLI instance per watch directory

The CLI SHALL acquire an exclusive instance lock on the resolved watch directory before initializing Evolu or starting sync loops. A second CLI process using the same resolved path SHALL fail fast without mutating shared state.

#### Scenario: First start acquires lock

- **WHEN** the user runs `txtatelier` (or `txtatelier --watch-dir <path>`) and no other process holds the lock for that resolved directory
- **THEN** the CLI acquires the lock and continues startup

#### Scenario: Second start on same directory

- **WHEN** another `txtatelier` process already holds the instance lock for the same resolved watch directory
- **THEN** the new process prints a clear error naming the watch directory and suggesting how to stop the other instance or use a different directory
- **THEN** the process exits with code 2

#### Scenario: Lock released on graceful shutdown

- **WHEN** the running instance receives SIGINT or SIGTERM and shuts down cleanly
- **THEN** the instance lock is released so a new CLI start on the same directory can succeed immediately

#### Scenario: Library API without CLI lock

- **WHEN** code calls `startFileSync` directly (tests, embeddings) without going through CLI `runStart`
- **THEN** no instance lock is applied by that API (locking remains a CLI concern)

### Requirement: Lock implementation characteristics

The instance lock SHALL use an atomic filesystem mechanism suitable for local disks (e.g. companion lock path via `proper-lockfile`). Stale locks SHALL become eligible for takeover after the library stale threshold so crashed processes do not block startup indefinitely.

#### Scenario: Stale lock after crash

- **WHEN** a previous process crashed without releasing the lock and the lock is older than the stale threshold
- **THEN** a new CLI start MAY acquire the lock after the library treats the lock as stale
