# Tasks: remove-bun-dependency

## Implementation

### 1. Replace the SQLite driver

- [x]1.1 Create `centers/cli/src/file-sync/platform/SqliteDriver.ts` by copying
      `BunSqliteDriver.ts` as a starting point.
- [x]1.2 Change the import: `import { Database } from "bun:sqlite"` →
      `import Database from "better-sqlite3"`.
- [x]1.3 Update the deserialise path: `Database.deserialize(existingData)` →
      `new Database(existingData)` (better-sqlite3 accepts `Buffer | Uint8Array`
      directly as the constructor argument to restore from serialised state).
- [x]1.4 Update the fresh-database path: `new Database(":memory:", { strict: true, safeIntegers: false })` →
      `new Database(":memory:")` (better-sqlite3 uses a different options shape;
      verify WAL pragma still applies correctly).
- [x]1.5 Change query calls: `db.query<T, P>(sql).run(...params)` →
      `db.prepare(sql).run(...params)` and `.all()` equivalently.
- [x]1.6 Change `db.run(sql)` (WAL pragma) → `db.exec(sql)`.
- [x]1.7 Change `db.close(false)` → `db.close()`.
- [x]1.8 Rename the export: `createPersistentBunSqliteDriver` →
      `createPersistentSqliteDriver`.
- [x]1.9 Delete `BunSqliteDriver.ts`.

### 2. Replace the platform I/O

- [x]2.1 In `PlatformIO.ts`, remove the `Bun.file()` / `Bun.write()` calls
      from `createBunPlatformIO`.
- [x]2.2 Replace `Bun.file(dbPath).exists()` with `node:fs/promises`
      `access(dbPath)` wrapped in a try/catch (returns `false` on `ENOENT`).
- [x]2.3 Replace `new Uint8Array(await file.arrayBuffer())` with
      `readFile(dbPath)` from `node:fs/promises`.
- [x]2.4 Replace `Bun.write(tempPath, data)` with `writeFile(tempPath, data)`
      from `node:fs/promises`.
- [x]2.5 Rename the factory: `createBunPlatformIO` → `createPlatformIO`.

### 3. Rename the Evolu deps factory

- [x]3.1 In `BunEvoluDeps.ts`, update the import of
      `createPersistentBunSqliteDriver` → `createPersistentSqliteDriver` (from
      the new `SqliteDriver.ts`).
- [x]3.2 Rename the exported function: `createBunEvoluDeps` →
      `createEvoluDeps`.
- [x]3.3 Rename the file: `BunEvoluDeps.ts` → `EvoluDeps.ts`.

### 4. Update the platform index

- [x]4.1 Update `platform/index.ts` to re-export from the renamed files:
      `createEvoluDeps`, `createPersistentSqliteDriver`, `createPlatformIO`.
- [x]4.2 Verify no other file outside `platform/` imports directly from
      `BunSqliteDriver`, `BunEvoluDeps`, or `createBunPlatformIO`.

### 5. Update the entry point

- [x]5.1 Change `centers/cli/src/index.ts` shebang:
      `#!/usr/bin/env bun` → `#!/usr/bin/env node`.
- [x]5.2 Update the `start` script in `package.json` from `bun src/index.ts`
      to `node --import tsx/esm src/index.ts` (or equivalent for the tsx
      dev-run path).

### 6. Update package metadata

- [x]6.1 Remove `@types/bun` from `devDependencies` in `package.json`.
- [x]6.2 Update `engines` field: `{ "bun": ">=1.0.0" }` →
      `{ "node": ">=22.5.0" }`.
- [x]6.3 Check `tsconfig.json` for `"types": ["bun"]` or similar — remove
      the Bun type reference if present.

### 7. Verify and test

- [x]7.1 Run `bun run build` (build tool unchanged) — confirm TypeScript
      compiles with zero errors after removing `@types/bun`.
- [x]7.2 Run `node dist/index.js` in a temp watch directory — confirm startup
      log sequence completes without `bun:sqlite` or `Bun is not defined`
      errors.
- [x]7.3 Create a `.txt` file in the watch directory — confirm capture and
      materialisation complete (check Evolu query output).
- [x]7.4 Delete the file — confirm deletion is captured.
- [x]7.5 Run the existing integration test suite and confirm no regressions.

## Co-variance notes

- **Bun surface was wider than the gesture assumed.** `hash.ts`, `write.ts`,
  `index.ts` (file-sync), `state-materialization.ts`, and `state-collector.ts`
  all contained direct `Bun.*` calls outside the `platform/` directory.
- **`better-sqlite3` does not load in Bun's runtime** (`bun:test` is Bun's
  test runner and runs code in the Bun runtime). Switching the test runner from
  `bun test` → `vitest` was required to make tests pass under Node.js.
- **Test files contained `Bun.*` calls** (`Bun.write`, `Bun.file().text()`,
  `Bun.file().unlink()`, `Bun.file().exists()`, `Bun.Glob`) that also needed
  updating to `node:fs/promises` equivalents.
- **`bun:test`-specific matchers** (`toBeString`, `toBeFunction`) are not
  available in base vitest — replaced with equivalent standard assertions.
- **Performance thresholds** in `ignore-perf.test.ts` were calibrated for
  Bun's faster JS runtime; updated to Node.js-appropriate values.
- **Hash algorithm changed** from `Bun.hash` (xxHash64) to `node:crypto`
  SHA-1. Existing stored hashes in Evolu databases will differ, causing
  a one-time full re-sync when migrating from a Bun-stored database.

## Load-bearing assumptions that didn't hold

**Assumption:** "Everything above the platform layer is already runtime-agnostic"

**What actually turned out to be true:** `Bun.*` was scattered across 5 files
outside `platform/`: `hash.ts` (Bun.hash), `write.ts` (Bun.write),
`file-sync/index.ts` (Bun.file), `state-materialization.ts` (Bun.file),
`state-collector.ts` (Bun.file).

**Assumption:** "Build toolchain (`bun build`, `bun test`) stays as-is"

**What actually turned out to be true:** `bun test` runs code in the Bun
runtime, which can't load `better-sqlite3`. The test runner had to change
to `vitest`.
