# Delta spec: cross-platform-cli

Change-local delta for capability **cross-platform-cli**. Notes that the CLI SQLite engine is unified across Node and Bun via sql.js (ASM), not separate native bindings per runtime.

## ADDED Requirements

### Requirement: Single SQLite engine for Node and Bun CLI

The system SHALL use the same sql.js (ASM) driver for SQLite when the CLI runs under Node.js (per `engines`) or under Bun; the system SHALL NOT select between `better-sqlite3` and `bun:sqlite` at runtime for file-sync.

#### Scenario: No runtime branch for SQLite backend

- **WHEN** the CLI initializes Evolu local-first deps for file sync
- **THEN** SQLite SHALL be provided only by `createSqlJsDriver` and SHALL NOT depend on `typeof Bun` to choose a driver implementation

### Requirement: Dependency surface for CLI database

The CLI package SHALL declare `sql.js` as a runtime dependency for SQLite and SHALL NOT declare `better-sqlite3` as a dependency for the unified driver path.

#### Scenario: Installable without native SQLite addon

- **WHEN** a developer installs `@txtatelier/cli` dependencies
- **THEN** SQLite SHALL not require compiling or loading the `better-sqlite3` native addon for the file-sync database path described in this change

#### Scenario: Optional typing for sql.js

- **WHEN** TypeScript checks the CLI workspace
- **THEN** `@types/sql.js` MAY be present as a devDependency to type the driver implementation without affecting the unified runtime choice
