## 1. Dependency Setup

- [ ] 1.1 Add sql.js to CLI package.json dependencies
- [ ] 1.2 Remove better-sqlite3 from dependencies and devDependencies
- [ ] 1.3 Run `bun install` to update lockfile
- [ ] 1.4 Verify sql.js WASM file is accessible (check node_modules/sql.js/dist/)

## 2. Create SqlJsDriver Implementation (Self-Contained)

- [ ] 2.1 Create `centers/cli/src/file-sync/platform/SqlJsDriver.ts`
- [ ] 2.2 Implement `CreateSqliteDriver` interface using sql.js
- [ ] 2.3 Handle database loading: `new SQL.Database(existingData)` from Uint8Array (no temp files)
- [ ] 2.4 Implement `exec()` method with prepared statements
- [ ] 2.5 Implement `export()` method returning Uint8Array
- [ ] 2.6 **Add debounced persistence logic** (moved from factory):
  - 5s debounce timer after mutations
  - `scheduleSave()` to queue saves
  - `saveToDisk()` to call `io.writeFile(db.export())`
- [ ] 2.7 Add proper cleanup/dispose handling (clear timer, final export)
- [ ] 2.8 Add logging with `[db:sqlite:sqljs]` prefix

## 3. Delete Driver Factory

- [ ] 3.1 Delete `SqliteDriverFactory.ts` entirely (no longer needed)
- [ ] 3.2 Delete `SqliteAdapter` interface export if defined separately
- [ ] 3.3 Verify no other files import from factory

## 4. Update EvoluDeps

- [ ] 4.1 Update `EvoluDeps.ts` to import `createSqlJsDriver` directly
- [ ] 4.2 Remove `createBunSqliteDriver` import (file deleted)
- [ ] 4.3 Remove `createPersistentSqliteDriver` import (file deleted)
- [ ] 4.4 Remove runtime detection logic (`typeof Bun`)
- [ ] 4.5 Pass `io` directly to `createSqlJsDriver(io)` (no factory wrapper)

## 5. Remove Obsolete Drivers

- [ ] 5.1 Delete `BunSqliteDriver.ts`
- [ ] 5.2 Delete `SqliteDriver.ts` (better-sqlite3 version)
- [ ] 5.3 Update any imports that reference deleted files
- [ ] 5.4 Verify no references to deleted files remain

## 6. Testing & Validation

- [ ] 6.1 Run existing driver tests: `bun test`
- [ ] 6.2 Test in Node runtime (if applicable): `node dist/index.js`
- [ ] 6.3 Test file sync end-to-end: create file, verify sync, edit file, verify update
- [ ] 6.4 Measure startup time: compare native vs sql.js baseline
- [ ] 6.5 Verify no temp files created in `/tmp` during operation
- [ ] 6.6 Check memory usage during sync: `process.memoryUsage()` logs

## 7. Performance Benchmark (Optional but Recommended)

- [ ] 7.1 Create benchmark script: 100 file mutations, measure total time
- [ ] 7.2 Run benchmark with native driver (if still available in git history)
- [ ] 7.3 Run benchmark with sql.js driver
- [ ] 7.4 Compare results: document any significant regressions (> 50% slower)

## 8. Cleanup & Documentation

- [ ] 8.1 Remove better-sqlite3 types from devDependencies if present
- [ ] 8.2 Update CENTER.md to document sql.js usage
- [ ] 8.3 Update any README references to better-sqlite3
- [ ] 8.4 Verify build works: `bun run build`
- [ ] 8.5 Verify CLI starts without errors: `bun start --help`

## 9. Document Co-Variance (Delta Specs)

- [ ] 9.1 Create `openspec/changes/unify-sqlite-with-sqljs/specs/sqljs-driver/spec.md` documenting the new self-contained driver
- [ ] 9.2 Create `openspec/changes/unify-sqlite-with-sqljs/specs/driver-factory/spec.md` documenting the elimination of the factory abstraction
- [ ] 9.3 Update `openspec/changes/unify-sqlite-with-sqljs/specs/cross-platform-cli/spec.md` noting unified sql.js across Node/Bun
