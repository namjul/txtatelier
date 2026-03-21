## MODIFIED Requirements

### Requirement: Remote deletion conflicts SHALL distinguish renames from true deletions

The conflict detection system SHALL provide additional context when remote deletion might be a rename.

**Previous behavior:** All remote deletions with local changes created `*.conflict-remote-delete-*.md` files with generic messaging.

**New behavior:** When remote deletion detection runs, check if a file with similar content (matching contentHash) exists elsewhere. If found, conflict message indicates possible rename.

#### Scenario: Potential rename mentioned in conflict
- **WHEN** Device A renames `notes.md` to `journal.md`
- **THEN** Device B with local edits to `notes.md` detects remote deletion
- **THEN** Device B checks for files with matching contentHash
- **THEN** if `journal.md` found with matching hash, conflict message mentions possible rename
- **THEN** conflict file includes path to potential new location

#### Scenario: True deletion - no rename indication
- **WHEN** file is genuinely deleted remotely
- **THEN** system does not find matching contentHash elsewhere
- **THEN** conflict message indicates true deletion
- **THEN** no rename suggestion provided

#### Scenario: Conflict message includes resolution guidance
- **WHEN** conflict created with rename indication
- **THEN** message instructs user to check `journal.md` for renamed content
- **THEN** message provides steps to merge local changes to new location
