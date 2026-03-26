# file-sync-context Specification

## Purpose
TBD - created by archiving change filesynccontext-refactor. Update Purpose after archive.
## Requirements
### Requirement: File sync call chain SHALL accept a single FileSyncContext

Functions that participate in the CLI file-sync loop (filesystem capture, Evolu materialization, startup reconciliation, and action execution) SHALL receive sync dependencies as one readonly context object instead of separate `evolu`, `watchDir`, and `filesOwnerId` parameters at each boundary.

#### Scenario: Context bundles database, watch root, and files owner

- **WHEN** code constructs a `FileSyncContext` at the sync entry point
- **THEN** the object SHALL expose `evolu`, `watchDir`, and `filesOwnerId` as readonly fields suitable for the sync call chain

#### Scenario: Executor uses context for mutations

- **WHEN** `executeAction` or `executePlan` runs
- **THEN** the first argument SHALL be `FileSyncContext` and mutations SHALL use `ctx.evolu` and `ctx.filesOwnerId` as needed

#### Scenario: Change capture uses context

- **WHEN** `captureChange` runs for a filesystem event or reconciliation
- **THEN** the first argument SHALL be `FileSyncContext` and the function SHALL use `ctx` for Evolu updates and path resolution

#### Scenario: State materialization and startup reconciliation use context

- **WHEN** `startStateMaterialization`, `applyRemoteDeletionToFilesystem`, `reconcileStartupFilesystemState`, or `reconcileStartupEvoluState` runs
- **THEN** the sync-environment argument SHALL be `FileSyncContext` (or derived destructuring at the function entry only), consistent with the design that context is built once at the boundary

### Requirement: EvoluDatabase type SHALL be canonical in sync context module

The type alias for `Evolu<typeof Schema>` used by file-sync SHALL be defined once and imported from the sync context module; duplicate local aliases in sync modules SHALL NOT be reintroduced.

#### Scenario: Single definition site

- **WHEN** a maintainer looks up the database type for file-sync
- **THEN** they SHALL find `EvoluDatabase` exported from `centers/cli/src/file-sync/sync/context.ts` (or re-export path) as the canonical alias

### Requirement: Sync context SHALL be constructed once at file-sync startup

`startFileSync` SHALL build exactly one `FileSyncContext` after the owner session is resolved and SHALL pass that object to all startup and runtime sync entry points that previously took the three parameters separately.

#### Scenario: Single construction per session start

- **WHEN** `startFileSync` completes owner resolution and begins reconciliation and loops
- **THEN** it SHALL construct `syncCtx` once and use it for startup reconciliation, filesystem watching, state materialization, and conflict follow-up capture as specified in the implementation

