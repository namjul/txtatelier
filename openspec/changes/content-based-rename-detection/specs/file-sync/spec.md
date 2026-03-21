## MODIFIED Requirements

### Requirement: Change capture SHALL detect and handle file renames

The change capture system SHALL distinguish between file deletions and file renames, updating Evolu accordingly.

**Previous behavior:** All file deletions resulted in marking Evolu row as deleted. All new files resulted in new row insertion.

**New behavior:** When a file is deleted and a new file with matching content appears within time window, update the existing row's path instead of delete + create.

#### Scenario: File renamed locally - path updated
- **WHEN** user renames `notes.md` to `journal.md` locally
- **THEN** change capture detects deletion of `notes.md`
- **THEN** change capture detects creation of `journal.md`
- **THEN** contentHash matches between old and new
- **THEN** system updates Evolu row path to `journal.md`
- **THEN** no new row is created

#### Scenario: File renamed remotely - path synced
- **WHEN** Device A renames file and syncs to Evolu
- **THEN** Device B receives path update via Evolu subscription
- **THEN** Device B applies path update to filesystem (renames local file)
- **THEN** no conflict is created

#### Scenario: True deletion - marked as deleted
- **WHEN** file is deleted and no matching file created within time window
- **THEN** system marks Evolu row as deleted (existing behavior)
- **THEN** no rename detection occurs

#### Scenario: Rename with content change - treated as delete + create
- **WHEN** user renames file and modifies content simultaneously
- **THEN** contentHash differs from deletion record
- **THEN** system treats as deletion + new file creation
- **THEN** falls back to existing delete + create behavior
