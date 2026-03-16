## ADDED Requirements

### Requirement: Orchestration functions SHALL return Result with fatal-only errors

Orchestration functions (reconcileStartupFilesystemState, reconcileStartupEvoluState) SHALL return `Result<Stats, FatalError>` where the error type contains only catastrophic failures that prevent the operation from proceeding.

#### Scenario: Fatal error when watch directory does not exist
- **WHEN** reconcileStartupFilesystemState is called with a watchDir that does not exist
- **THEN** function SHALL return err() with type "WatchDirNotFound"

#### Scenario: Fatal error when watch directory is unreadable
- **WHEN** reconcileStartupFilesystemState is called with a watchDir that exists but has no read permissions
- **THEN** function SHALL return err() with type "WatchDirUnreadable"

#### Scenario: Fatal error when database is unavailable
- **WHEN** reconcileStartupEvoluState cannot query the Evolu database
- **THEN** function SHALL return err() with type "DatabaseUnavailable"

#### Scenario: Success with zero failures
- **WHEN** all files are processed successfully during reconciliation
- **THEN** function SHALL return ok() with stats showing processedCount > 0 and failedCount = 0

#### Scenario: Success with partial failures
- **WHEN** some individual files fail during reconciliation (file too large, permission denied)
- **THEN** function SHALL return ok() with stats showing failedCount > 0 and errors array populated
- **AND** function SHALL continue processing remaining files (resilient behavior)

### Requirement: Fatal errors SHALL only include systematic failures

The FatalError type SHALL only include failures that prevent the entire operation from proceeding, not per-file failures.

#### Scenario: Individual file read failure is not fatal
- **WHEN** a single file cannot be read during filesystem reconciliation
- **THEN** function SHALL return ok() with that file listed in stats.errors
- **AND** function SHALL continue processing remaining files

#### Scenario: Individual file too large is not fatal
- **WHEN** a single file exceeds size limit during reconciliation
- **THEN** function SHALL return ok() with that file listed in stats.errors
- **AND** function SHALL continue processing remaining files

#### Scenario: Individual Evolu insert failure is not fatal
- **WHEN** a single Evolu insert operation fails during reconciliation
- **THEN** function SHALL return ok() with that file listed in stats.errors
- **AND** function SHALL continue processing remaining files

### Requirement: ReconcileFatalError type SHALL include all catastrophic failure modes

The ReconcileFatalError discriminated union SHALL include cases for all systematic failures.

#### Scenario: WatchDirNotFound error includes path
- **WHEN** fatal error occurs because watchDir doesn't exist
- **THEN** error SHALL have type "WatchDirNotFound" and include the path field

#### Scenario: WatchDirUnreadable error includes path and cause
- **WHEN** fatal error occurs because watchDir has no read permissions
- **THEN** error SHALL have type "WatchDirUnreadable" and include path and cause fields

#### Scenario: DatabaseUnavailable error includes cause
- **WHEN** fatal error occurs because database query fails
- **THEN** error SHALL have type "DatabaseUnavailable" and include cause field
