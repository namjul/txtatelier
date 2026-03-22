# Design: remove-bun-dependency

## Approach

Replace the three Bun-specific call sites with cross-runtime equivalents, then
rename the files to drop the `Bun` prefix. All changes are confined to
`centers/cli/src/file-sync/platform/` and the entry point shebang.

**SQLite driver:** replace `bun:sqlite` with `better-sqlite3`.
`better-sqlite3` is already a declared dependency and already externalized in
the build script (`--external better-sqlite3`). Its API is close enough to
`bun:sqlite` that the driver needs only mechanical changes (import path,
static deserialise call, `.query()` → `.prepare()`).

**Platform I/O:** replace `Bun.file()` / `Bun.write()` with
`node:fs/promises`. `readFile` / `writeFile` / `stat` cover the same surface.
The atomic-write pattern (write temp file, then `rename`) is already using
`node:fs/promises.rename`, so only the read and initial write paths change.

**Entry point:** change `#!/usr/bin/env bun` to `#!/usr/bin/env node`.

**Naming:** rename files and exported factories to remove the `Bun` prefix.
The `PlatformIO` interface type is already runtime-neutral; only the concrete
factory is renamed.

## Why this approach?

`better-sqlite3` over `node:sqlite`:
- Already in `package.json` as a runtime dependency — zero new deps.
- Has `db.serialize()` / `new Database(buffer)` (load from Uint8Array) which
  map directly to bun:sqlite's `db.serialize()` / `Database.deserialize()`.
  The `node:sqlite` experimental API does not expose serialize/deserialize.
- Synchronous API — same model as bun:sqlite, so the existing async wrapper
  pattern in the driver is unchanged.
- The build already marks it as external, which is the correct treatment for a
  native addon.

`node:fs/promises` over `Bun.file`:
- Available in all Node.js versions we target (v22+) and in Deno's Node compat
  layer.
- The `randomUUID` from `node:crypto` and `rename` from `node:fs/promises` are
  already present in `PlatformIO.ts`; this change is completing what was
  started.

## What are our load-bearing assumptions about the approach?

1. **`better-sqlite3`'s `new Database(data: Buffer | Uint8Array)` correctly
   restores a database from a buffer serialized by `db.serialize()`.**
   If the round-trip is lossy or requires a different call signature, the
   driver will corrupt data on first load from an existing database file.

2. **`better-sqlite3` in synchronous mode satisfies Evolu's
   `CreateSqliteDriver` interface.** The interface accepts synchronous exec
   results — the driver just needs to return `{ rows, changes }` from
   `.prepare(sql).run()` and `.prepare(sql).all()`. No async SQLite APIs are
   needed.

3. **The `node:fs/promises` `writeFile` + `rename` sequence is available and
   atomic on the platforms we target.** POSIX atomicity via rename is already
   relied on; this assumption is already in the codebase.

## Risks and trade-offs

**Native addon build:** `better-sqlite3` is a native Node addon. It must be
compiled for the target Node version. If the pre-built binary isn't available
(unusual architecture, musl vs glibc), the user needs `node-gyp` dependencies.
This is a known `better-sqlite3` trade-off — unchanged from any existing
Node project using it.

**bun:sqlite and better-sqlite3 query result shapes may diverge in edge
cases.** bun:sqlite returns column values as `null | string | number |
Uint8Array`; better-sqlite3 returns similar types but handles `BigInt` and
`BLOB` differently. Evolu controls the schema, so this is unlikely to surface,
but it needs verification during testing.

**`@types/bun` in devDependencies:** removing this will cause TypeScript errors
if any file still references Bun-specific types (even accidentally). This is a
compile-time signal, not a runtime risk — but it must be resolved before the
build passes.

## What we are not doing

- **Deno-first support.** Deno compatibility is a stretch goal. The primary
  target is Node.js. If Deno compat falls out naturally (likely, given
  Node compat layer), great — but we won't add Deno-specific code paths.
- **Abstracting the SQLite driver further.** The platform seam already exists
  (`CreateSqliteDriver`). We are not adding new abstractions on top.
- **Changing the build toolchain.** Bun is used as the build tool (tsc/bun
  build). This change removes the Bun runtime requirement, not the Bun build
  tool requirement.
- **Migrating scripts in `package.json`.** `bun run build`, `bun test`, etc.
  remain as-is — those are developer tooling, not runtime requirements.

## Known unknowns

- **Does `better-sqlite3`'s WAL pragma survive the deserialise round-trip?**
  The driver sets WAL mode after opening. If a serialised DB already has WAL
  metadata, the pragma might be a no-op or cause an error. Needs a test.
- **`node:crypto randomUUID` in Deno** — Deno supports this but the exact
  import path (`node:crypto` vs `crypto`) may need a check.
- **`specialist` CLI library** — used in `index.ts`. Does it have any Bun
  assumptions? Unlikely, but worth verifying once the shebang changes.

## Co-variance: what else might this touch?

- `centers/cli/package.json`: remove `@types/bun` from devDependencies, update
  `engines` field from `bun` to `node`.
- Integration tests: the test harness currently invokes `bun test`. Tests
  themselves may need `bun` → `node` if they reference `Bun.*`.
- `tsconfig.json`: `@types/bun` may be in the `types` array — remove it to
  confirm no Bun type leakage.

## Design warnings

### Responsiveness

No user-visible change. The CLI produces the same log output; startup and sync
behaviour are identical. No responsiveness concern.

### Continuity after correction

No user state is affected. The SQLite database file format is unchanged;
existing databases load correctly under the new driver. Users switching from
the Bun build to the Node build lose nothing.

### Exploratory capacity

No change to what users can do. This is a pure runtime-portability change with
no surface-level impact.
