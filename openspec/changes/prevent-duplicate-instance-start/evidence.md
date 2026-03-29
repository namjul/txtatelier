# Evidence: prevent-duplicate-instance-start

## Contact test result

Observed (implementation session): duplicate CLI start on same `--watch-dir` exits **2** with multi-line message including the resolved path and guidance (`kill` / different directory). `proper-lockfile` does not expose holder **PID** in `ELOCKED` errors; message uses generic “another process” text unless we add PID discovery later.

Second start returns before Evolu init. After SIGINT on first instance, a new start on the same directory succeeds (lock released in shutdown handler).

Vitest: `InstanceLock.test.ts` covers double-acquire and release/re-acquire. Full `bun test` still reports **2 failing** scenarios in `index.test.ts` (offline conflict / remote-delete flows); those tests call `startFileSync` only and are unchanged by CLI locking—treat as pre-existing flakes or product bugs to track separately.

## What we observed

- Second CLI instance fails fast with exit code **2** and readable error.
- Lock path follows `proper-lockfile` (companion `*.lock` next to resolved watch dir).
- Graceful shutdown releases lock; immediate re-start works.

Expected observations based on contact-test.md:
- Second instance start fails immediately (<500ms)
- Error message includes directory path; **PID** not available from library metadata in current form
- Exit code is 2 (distinct from other failures)
- No database files created/modified by second instance
- No files in watch directory touched by second instance
- Instance A continues running unaffected

## What held

1. `proper-lockfile` works under **Node** with `tsx` for CLI dev entry (same as existing `node --import tsx/esm`); bundled into `dist/index.js` via `bun build`.
2. Atomic `mkdir` lock behavior matches design for local temp dirs.
3. Parent directory writable for default temp/watch paths in manual checks.

## What didn't hold

- **PID in error**: not satisfied without extra instrumentation (`proper-lockfile` does not attach PID to `ELOCKED`).

Potential falsifications still to watch:
- Race conditions under heavy parallel starts (unlikely on local FS)
- `proper-lockfile` behavior on exotic/network filesystems
- Two failing `index.test.ts` integration tests (unrelated to CLI lock)

## What changed in our understanding of the system

Pending implementation completion.

Key learning questions:
- How reliable is `proper-lockfile` on Bun?
- Do users find the error message actionable?
- Are there edge cases we missed (network filesystems, containers)?
- What other startup validation might be needed?

## What does this change about how we understand this

Pending evidence collection.

Possible outcomes:
- **Success**: System strengthened, intervention complete
- **Partial success**: Revision needed (different library, different approach)
- **Failure**: New hypothesis required, possibly different locking strategy

If evidence is inconclusive, may need more observation or different test approach.
