# Delta Specs: remove-bun-dependency

## What behavior is being added?

**Node.js runtime support:**
- The CLI starts and runs correctly under Node.js v22.5+ without the Bun
  binary present on `PATH`.
- The sync loop (file capture, Evolu materialisation, watcher) behaves
  identically to the Bun-based version.

**Deno runtime support (stretch):**
- The CLI starts and runs correctly under Deno using `npm:` specifiers or a
  compiled entry point.
- No Bun globals (`Bun.file`, `Bun.write`) are referenced in any code path.

## What behavior is changing?

**Platform I/O (database persistence):**
- Previously: `Bun.file(path)` and `Bun.write(tempPath, data)` used for
  atomic SQLite reads and writes.
- After: `node:fs/promises` (`readFile`, `writeFile` + `rename`) used instead.
  Atomicity preserved via the same temp-file-then-rename pattern.
- The `PlatformIO` interface is unchanged; only the concrete factory
  (`createBunPlatformIO` → `createPlatformIO`) is replaced.

**SQLite driver:**
- Previously: `Database` from `bun:sqlite` used for in-memory SQLite with
  serialise/deserialise round-trips.
- After: `DatabaseSync` from `node:sqlite` (Node v22.5+) used instead.
  The driver implements the same `CreateSqliteDriver` interface from
  `@evolu/common`.
- Serialisation API differences between `bun:sqlite` and `node:sqlite` are
  handled inside the driver; callers see no change.

**Entry point shebang:**
- Previously: `#!/usr/bin/env bun`
- After: `#!/usr/bin/env node` (or a polyglot shebang if Deno support is
  included in this iteration).

**Naming:**
- `createBunPlatformIO` → `createPlatformIO`
- `createPersistentBunSqliteDriver` → `createPersistentSqliteDriver`
- `createBunEvoluDeps` → `createEvoluDeps`
- File names: `BunPlatformIO.ts` → `PlatformIO.ts` (merged or renamed),
  `BunSqliteDriver.ts` → `SqliteDriver.ts`, `BunEvoluDeps.ts` → `EvoluDeps.ts`

## What behavior is being removed?

- `bun:sqlite` is no longer imported anywhere in the codebase.
- `Bun.file()` and `Bun.write()` are no longer called.
- The `Bun` global is not referenced.
- Running `bun run` is no longer a prerequisite for using the CLI.

## What stays the same?

**All sync logic above the platform layer:**
- Change capture, startup reconciliation, state materialisation, the executor,
  and the watcher are unchanged.

**The `PlatformIO` interface:**
- The `readFile` / `writeFile` contract is unchanged; only the implementation
  behind it changes.

**The `CreateSqliteDriver` interface:**
- Evolu's driver interface is unchanged; only the implementation changes.

**The `EvoluDeps` shape:**
- `createEvoluDeps` returns the same `EvoluDeps` object; internal plumbing
  is updated but the surface seen by callers is identical.

**Evolu wiring (`BunEvoluDeps.ts` internals):**
- All calls to `createConsole`, `createRandom`, `createRandomBytes`,
  `createTime`, `createWebSocket` from `@evolu/common` remain as-is.
- The logged WebSocket wrapper is unchanged.

**Database file format:**
- Existing SQLite databases persisted by the Bun version are compatible with
  the Node version (same SQLite wire format).
