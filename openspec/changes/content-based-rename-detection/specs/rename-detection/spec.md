## ADDED Requirements

### Requirement: System SHALL track recently deleted files

The system SHALL maintain a local-only table `_recentDeletions` that records deleted files with their contentHash and deletion timestamp.

#### Scenario: File deletion recorded
- **WHEN** a file is deleted from the filesystem
- **THEN** system inserts record into `_recentDeletions` with path, contentHash, deletedAt timestamp, and evolFileId

#### Scenario: Deletion record includes all required fields
- **WHEN** deletion is recorded
- **THEN** record contains original file path
- **THEN** record contains contentHash at deletion time
- **THEN** record contains Unix timestamp in milliseconds
- **THEN** record contains Evolu file row ID

### Requirement: System SHALL detect renames using content matching

When a new file appears, the system SHALL query recent deletions for matching contentHash within the time window.

#### Scenario: Rename detected within time window
- **WHEN** file with path `journal.md` is created
- **THEN** system queries `_recentDeletions` for matching contentHash within 5 seconds
- **THEN** if match found for `notes.md`, system treats as rename

#### Scenario: Rename not detected outside time window
- **WHEN** file is created 6 seconds after deletion
- **THEN** system does not match against that deletion record
- **THEN** file is treated as new insertion

#### Scenario: Multiple deletions - most recent match wins
- **WHEN** two files with same contentHash were deleted
- **THEN** system matches against the most recently deleted file
- **THEN** older deletion record remains for potential future matches

### Requirement: System SHALL update Evolu row path on rename detection

When rename is detected, the system SHALL update the existing Evolu row's path field instead of creating a new row.

#### Scenario: Path updated on existing row
- **WHEN** rename detected from `notes.md` to `journal.md`
- **THEN** system updates Evolu row with `id` from deletion record
- **THEN** row's `path` field changes to `journal.md`
- **THEN** row's `updatedAt` field is set to current timestamp
- **THEN** row's `isDeleted` flag remains false or is cleared

#### Scenario: File identity preserved
- **WHEN** rename updates Evolu row
- **THEN** row's `id` remains unchanged
- **THEN** row's `createdAt` remains unchanged
- **THEN** row's `ownerId` remains unchanged
- **THEN** row's `contentHash` remains unchanged (same content)

#### Scenario: No new row created
- **WHEN** rename is detected
- **THEN** system does NOT insert new row into `file` table
- **THEN** only one row exists with the new path

### Requirement: System SHALL remove deletion record after successful rename

After updating the Evolu row path, the system SHALL delete the corresponding record from `_recentDeletions`.

#### Scenario: Deletion record cleaned up
- **WHEN** rename operation completes successfully
- **THEN** system deletes matching record from `_recentDeletions`
- **THEN** subsequent queries do not find that deletion record

### Requirement: System SHALL garbage collect old deletion records

The system SHALL periodically remove deletion records older than the retention threshold.

#### Scenario: Periodic cleanup executes
- **WHEN** garbage collection runs (every 60 seconds)
- **THEN** system deletes records where `deletedAt` is older than 10 seconds
- **THEN** recent records (within 10 seconds) are preserved

#### Scenario: Cleanup does not affect recent deletions
- **WHEN** garbage collection runs
- **THEN** deletion records within 10-second retention window remain
- **THEN** only records older than retention threshold are removed

### Requirement: System SHALL handle renames at startup

During startup reconciliation, the system SHALL detect renames that occurred while CLI was offline.

#### Scenario: Offline rename detected at startup
- **WHEN** CLI starts after being offline
- **THEN** system scans filesystem and Evolu state
- **THEN** file present on disk but missing in Evolu triggers rename check
- **THEN** if contentHash matches recently deleted Evolu row, update path instead of insert

#### Scenario: Startup uses extended time window
- **WHEN** checking for renames at startup
- **THEN** system uses deletion records from entire offline period
- **THEN** time window does not limit startup rename detection

### Requirement: System SHALL fall back to insert on no match

When no matching deletion is found, the system SHALL insert the file as a new row (current behavior).

#### Scenario: No matching deletion - new file inserted
- **WHEN** new file appears with contentHash not in recent deletions
- **THEN** system inserts new row into `file` table
- **THEN** file is treated as new creation

#### Scenario: Hash mismatch - new file inserted
- **WHEN** file renamed but content also changed (hash differs)
- **THEN** system does not match against deletion record
- **THEN** falls back to delete + create behavior
