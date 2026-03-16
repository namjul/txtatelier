## ADDED Requirements

### Requirement: Reconciliation functions SHALL return statistics about processed files

Both reconcileStartupFilesystemState and reconcileStartupEvoluState SHALL return a ReconcileStats object containing counts and error details.

#### Scenario: Stats include processed count
- **WHEN** reconciliation processes N files
- **THEN** returned stats SHALL have processedCount equal to N

#### Scenario: Stats include failed count
- **WHEN** reconciliation encounters M file errors
- **THEN** returned stats SHALL have failedCount equal to M

#### Scenario: Stats include error details for each failure
- **WHEN** a file fails during reconciliation
- **THEN** stats.errors array SHALL include an entry with the file path and error object

#### Scenario: Stats errors array is empty when no failures occur
- **WHEN** all files are processed successfully
- **THEN** stats.errors array SHALL be empty
- **AND** stats.failedCount SHALL be 0

### Requirement: ReconcileStats SHALL include all necessary observability data

The ReconcileStats interface SHALL provide sufficient information for logging, monitoring, and status reporting.

#### Scenario: Stats enable quick health check
- **WHEN** caller checks stats.failedCount
- **THEN** caller can determine if any files failed without iterating errors array

#### Scenario: Stats enable detailed error logging
- **WHEN** caller iterates stats.errors
- **THEN** each error SHALL include both the file path and the specific error object
- **AND** error object SHALL be the original ChangeCaptureError or StateMaterializationError

#### Scenario: Stats support future status command
- **WHEN** stats are exposed on FileSyncSession
- **THEN** future CLI status command can display "X files synced, Y failed"

### Requirement: FileSyncSession SHALL expose startup reconciliation statistics

The FileSyncSession interface SHALL include a startupReconciliation field containing stats from both reconciliation functions.

#### Scenario: Session exposes filesystem reconciliation stats
- **WHEN** FileSyncSession is created after successful startup
- **THEN** session.startupReconciliation.filesystem SHALL contain ReconcileStats from filesystem reconciliation

#### Scenario: Session exposes Evolu reconciliation stats
- **WHEN** FileSyncSession is created after successful startup
- **THEN** session.startupReconciliation.evolu SHALL contain ReconcileStats from Evolu reconciliation

#### Scenario: Session stats are immutable
- **WHEN** caller accesses session.startupReconciliation
- **THEN** the stats object SHALL be readonly (TypeScript immutability)

### Requirement: Reconciliation stats SHALL distinguish between Evolu and filesystem phases

Stats from reconcileStartupEvoluState and reconcileStartupFilesystemState SHALL be tracked separately.

#### Scenario: Filesystem stats count filesystem operations only
- **WHEN** reconcileStartupFilesystemState processes files
- **THEN** returned stats SHALL count only filesystem → Evolu sync operations
- **AND** SHALL NOT include Evolu → filesystem materialization operations

#### Scenario: Evolu stats count materialization operations only
- **WHEN** reconcileStartupEvoluState processes Evolu rows
- **THEN** returned stats SHALL count only Evolu → filesystem materialization operations
- **AND** SHALL NOT include filesystem → Evolu capture operations

#### Scenario: Both stats are available on session
- **WHEN** FileSyncSession is created
- **THEN** caller can inspect both filesystem and evolu stats independently
- **AND** can determine which phase had failures
