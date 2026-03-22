# Contact Test: remove-bun-dependency

## Evidence tier

proximal — we run the CLI ourselves under Node.js and Deno and observe the
result directly.

## What would success look like?

1. `node dist/index.js` starts without throwing `Cannot find package 'bun:sqlite'`
   or `Bun is not defined`.
2. The startup sequence completes: watcher starts, Evolu database initialises,
   owner identity is loaded.
3. File changes in the watch directory are captured and materialised (smoke test
   of the sync loop).
4. `deno run dist/index.js` (or equivalent entry point) completes the same
   sequence without Bun-specific errors.
5. No Bun binary is required on the `PATH` for any of the above.

## What would falsify this claim?

Any of:
- Import-time crash on `bun:sqlite` or `Bun is not defined` — means the driver
  or IO layer was not fully ported.
- Startup hangs or errors in Evolu initialisation — means the SQLite driver
  interface diverged from what `createDbWorkerForPlatform` expects.
- File writes silently fail — means the `node:fs/promises` replacement for
  `Bun.write` is broken.
- Tests that previously passed under Bun now fail under Node — means we broke
  something in the migration.

## How will we check?

1. Build the CLI with the Node-targeting toolchain.
2. Run `node dist/index.js` in a temp directory; observe startup logs.
3. Create a `.txt` file in the watch directory; verify it appears in Evolu via
   the owner query.
4. Delete the file; verify the delete is captured.
5. Repeat steps 2–4 with Deno if Deno support is in scope for this iteration.
6. Run the existing integration test suite under Node to confirm no regression.

## When will we check?

Immediately after implementing the platform layer replacements — before
merging. The test is the merge gate.
