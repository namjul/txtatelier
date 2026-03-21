## ADDED Requirements

### Requirement: System SHALL log detected renames

When a rename is detected, the system SHALL log the operation at INFO level.

#### Scenario: Rename logged with old and new paths
- **WHEN** system detects rename from `notes.md` to `journal.md`
- **THEN** log message includes both old path and new path
- **THEN** log level is INFO
- **THEN** log message format is `[rename] Detected: <oldPath> → <newPath>`

#### Scenario: Failed rename attempts logged at WARN level
- **WHEN** rename detection finds match but path update fails
- **THEN** system logs at WARN level
- **THEN** log includes error cause

### Requirement: System SHALL log potential false positives

When rename detection matches identical files that may not be related, the system SHALL log a warning.

#### Scenario: Ambiguous rename logged as warning
- **WHEN** two files with identical content are deleted and created
- **THEN** system logs warning about possible false positive
- **THEN** log message format indicates uncertainty: `[rename] Possible false positive: <oldPath> → <newPath>`

### Requirement: System SHALL expose rename statistics

The system SHALL track and expose counts of detected renames for observability.

#### Scenario: Rename count tracked during session
- **WHEN** CLI session is running
- **THEN** system maintains counter of detected renames
- **THEN** counter increments on each successful rename detection

#### Scenario: Rename statistics available in session object
- **WHEN** user queries FileSyncSession object
- **THEN** session includes `renamesDetected` count field
- **THEN** field reflects total renames detected since startup
