# Delta spec: driver-factory

Change-local delta for capability **driver-factory**. Documents removal of the shared factory and native adapters in favor of a single `createSqlJsDriver` entry point.

## REMOVED Requirements

### Requirement: SqliteDriverFactory with SqliteAdapter

**Reason:** A single sql.js implementation replaces Node (`better-sqlite3`) and Bun (`bun:sqlite`) adapters; persistence and `exec` mapping live in `SqlJsDriver.ts` only.

**Migration:** Call `createSqlJsDriver(io)` from `EvoluDeps.ts` and pass it as `createSqliteDriver` to `createDbWorkerForPlatform`. Do not import `SqliteDriverFactory`, `SqliteAdapter`, `createPersistentSqliteDriver`, or `createBunSqliteDriver`.

#### Scenario: No factory module

- **WHEN** code in `centers/cli` wires Evolu local-first database dependencies
- **THEN** it SHALL NOT depend on `SqliteDriverFactory.ts` or an adapter interface for runtime-specific `loadDatabase` implementations

### Requirement: Runtime-specific SQLite drivers in CLI platform

**Reason:** `BunSqliteDriver.ts` and `SqliteDriver.ts` (better-sqlite3) duplicated open paths and temp-file workarounds; sql.js unifies behavior.

**Migration:** All CLI SQLite access goes through `SqlJsDriver.ts`.

#### Scenario: No bun:sqlite or better-sqlite3 in platform layer

- **WHEN** building or running the CLI file-sync platform layer
- **THEN** `bun:sqlite` and `better-sqlite3` SHALL NOT be imported from `centers/cli/src/file-sync/platform/`

## ADDED Requirements

### Requirement: Direct factory function for Evolu

The system SHALL expose `createSqlJsDriver(io: PlatformIO): CreateSqliteDriver` as the only CLI implementation of `CreateSqliteDriver` used by `createEvoluDeps`.

#### Scenario: EvoluDeps uses sql.js only

- **WHEN** `createEvoluDeps` is constructed with a `PlatformIO`
- **THEN** it SHALL set `createSqliteDriver` to `createSqlJsDriver(io)` without branching on `typeof Bun` or other runtime detection
