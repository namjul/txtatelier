# Gesture: remove-bun-dependency

## Gesture type

revision

## What are we gesturing toward?

The platform layer: `centers/cli/src/file-sync/platform/`

This is the seam between the runtime environment (Bun, Node, Deno) and the
rest of the application. It currently exports three Bun-specific things:
`createBunPlatformIO`, `createPersistentBunSqliteDriver`, and
`createBunEvoluDeps`. Everything above this layer (`file-sync`, `sync`,
`executor`, etc.) is already runtime-agnostic.

## Claim

Replacing the three Bun-specific implementations with cross-runtime equivalents
— and renaming them to drop the `Bun` prefix — will allow the CLI to run under
Node.js and Deno without changes to any code outside the platform layer.

## What made us do this?

Three concrete blockers:
1. `BunSqliteDriver.ts` imports `{ Database } from "bun:sqlite"` — Node.js has
   no such module.
2. `PlatformIO.ts` calls `Bun.file()` and `Bun.write()` — Bun globals that
   don't exist on other runtimes.
3. `index.ts` opens with `#!/usr/bin/env bun` — prevents Node/Deno execution.

Everything else (Evolu, file-sync logic, the watcher) is already
runtime-agnostic.

## What are our load-bearing assumptions?

1. **Node.js ships `node:sqlite` (v22.5+), which is API-compatible enough with
   `bun:sqlite` to support the query patterns in `BunSqliteDriver.ts`.** If the
   APIs differ significantly, we'll need an adapter shim rather than a direct
   replacement.

2. **The `PlatformIO` interface is the only place `Bun.*` globals are used for
   file I/O.** The grep confirms this — `Bun.file` and `Bun.write` appear only
   in `PlatformIO.ts`, so replacing `createBunPlatformIO` with a Node/Deno
   implementation covers the full surface.

3. **Renaming `createBunEvoluDeps` → `createEvoluDeps` requires no changes
   inside it.** `BunEvoluDeps.ts` only calls `@evolu/common` APIs plus our own
   `BunSqliteDriver` — once the driver is replaced, the deps factory is already
   runtime-agnostic.

## Spec files this gesture touches

- `specs/platform-io/spec.md` — revision: replace `Bun.file`/`Bun.write` with
  `node:fs/promises`; drop Bun global dependency
- `specs/sqlite-driver/spec.md` — revision: replace `bun:sqlite` with
  `node:sqlite`
- `specs/evolu-deps/spec.md` — revision: rename `createBunEvoluDeps` →
  `createEvoluDeps`; no logic changes

## Co-variance: what else might this touch?

- `index.ts` shebang: `#!/usr/bin/env bun` → `#!/usr/bin/env node` (or a
  polyglot shebang)
- `package.json`: build/run scripts that invoke `bun run` or `bun build`
- `tsconfig.json`: may reference Bun type definitions (`@types/bun`)
- Integration tests: any test harness that shells out to `bun` will need
  updating
