## ADDED Requirements

### Requirement: Debounced auto-save

The PWA SHALL persist the active file draft to Evolu automatically after the user stops editing for 300ms, without a manual save control.

The PWA MUST NOT run auto-save when a conflict is active for the open file.

The PWA MUST NOT enqueue auto-save when the file row's `ownerId` does not match `deriveShardOwner(appOwner, ["files", 1]).id` (the same owner id used by `getFilesShardMutationOptions`).

The PWA MUST compare draft content to the last applied baseline before writing; when the computed hash matches the row `contentHash`, it SHALL skip the Evolu update while treating the draft as clean.

#### Scenario: Content persists after debounce

- **WHEN** the user edits the draft and pauses for at least 300ms
- **THEN** the system writes the draft to Evolu for that file row (unless a conflict is active or row `ownerId` does not match the files shard owner id)

#### Scenario: Conflict blocks auto-save

- **WHEN** the editor is in a conflict state for the open file
- **THEN** the system does not perform auto-save until the conflict is resolved

### Requirement: Auto-save state feedback

The editor chrome SHALL show distinct feedback for saving in progress, successful save, save error with retry, and final save failure after retries.

#### Scenario: Editor shows auto-save indicator

- **WHEN** an auto-save write is in progress
- **THEN** the editor shows a Saving… indicator

- **WHEN** an auto-save write completes successfully
- **THEN** the editor shows a Saved indicator before returning to an idle presentation

- **WHEN** a save fails and retries are still scheduled
- **THEN** the editor shows that a retry is in progress

### Requirement: Manual save control removed

The editor SHALL NOT expose a primary manual “save” button for the file draft; persistence is automatic.

#### Scenario: No manual save button

- **WHEN** the user views the file editor for a normal (non-conflict) file
- **THEN** there is no save button next to the path; conflict-resolution actions remain available when a conflict exists
