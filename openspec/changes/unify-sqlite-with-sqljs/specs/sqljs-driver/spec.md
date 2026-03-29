# Delta spec: sqljs-driver

Change-local delta for capability **sqljs-driver**. Describes the self-contained CLI SQLite driver backed by sql.js (ASM build).

## ADDED Requirements

### Requirement: CLI SQLite uses sql.js ASM with singleton init

The system SHALL load SQLite via `sql.js/dist/sql-asm.js` and SHALL cache the resolved sql.js module promise so multiple database opens reuse a single initialization.

#### Scenario: Second open reuses init

- **WHEN** `createSqlJsDriver` is used to open a database more than once in one process
- **THEN** the implementation SHALL not call the sql.js init function repeatedly for each open (singleton promise pattern)

### Requirement: Database bytes load without temp files

The system SHALL construct the in-memory database from `Uint8Array` returned by `PlatformIO.readFile()` using `new SQL.Database(existingData)` when data is present and `options.memory` is not set.

#### Scenario: Existing file opens from buffer

- **WHEN** `readFile` returns non-null bytes and persistence is requested
- **THEN** the driver SHALL open SQLite from those bytes without writing a temporary database file under the OS temp directory for deserialization

### Requirement: Exec maps sql.js results to Evolu row shape

The system SHALL execute mutations with `Database.run` and bounded parameters, SHALL read `getRowsModified()` for change counts, and SHALL execute selects with `prepare`, `bind`, `step`, `getAsObject`, and `free`, mapping each row to `Record<string, SqliteValue>` for Evolu compatibility.

#### Scenario: Mutation reports changes

- **WHEN** a mutation query runs and rows are modified
- **THEN** `exec` SHALL return `changes` equal to `getRowsModified()` after the run

#### Scenario: Select returns object rows

- **WHEN** a non-mutation query returns rows
- **THEN** `exec` SHALL return a `rows` array of objects whose keys are column names and values are sql.js-compatible scalars

### Requirement: Debounced persistence and lifecycle

The system SHALL debounce disk writes for 5 seconds after a mutation with `changes > 0`, SHALL write `db.export()` through `PlatformIO.writeFile` without awaiting the debounced write in the scheduling path (fire-and-forget with error logging), SHALL expose `flush` that clears the timer, sets a flushed seal, and awaits a final write, and SHALL on dispose clear the timer and persist if not yet flushed.

#### Scenario: Debounced write after mutation

- **WHEN** a mutation changes rows and no flush has sealed the driver
- **THEN** a single debounced save SHALL be scheduled and SHALL eventually call `writeFile` with exported bytes unless disposed or flushed first

### Requirement: Structured logging prefix

The system SHALL log driver lifecycle and persistence failures using the prefix `[db:sqlite:sqljs]`.

#### Scenario: Init is observable

- **WHEN** the driver initializes
- **THEN** debug logging SHALL include `[db:sqlite:sqljs]` for the init message
