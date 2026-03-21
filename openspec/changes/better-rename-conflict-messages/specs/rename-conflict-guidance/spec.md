## ADDED Requirements

### Requirement: Conflict files SHALL include rename scenario guidance

When a remote deletion conflict occurs, the generated conflict file SHALL contain a markdown header explaining that the deletion might be caused by a file rename on another device.

#### Scenario: Remote deletion conflict with guidance header
- **WHEN** system creates a conflict file for remote deletion
- **THEN** conflict file content starts with "# Conflict: Remote Deletion" header
- **THEN** conflict file explains common causes including file renames
- **THEN** conflict file provides step-by-step resolution instructions

#### Scenario: Guidance includes all common causes
- **WHEN** system generates conflict file content
- **THEN** content lists "File was renamed on the other device" as a cause
- **THEN** content lists "File was intentionally deleted" as a cause
- **THEN** content lists "External tool (git, file manager) moved the file" as a cause

### Requirement: Conflict files SHALL include resolution steps

The conflict file SHALL provide actionable steps for users to resolve rename-related conflicts.

#### Scenario: Resolution steps guide checking for renames
- **WHEN** conflict file is generated
- **THEN** first resolution step instructs user to check if file was renamed
- **THEN** second step instructs how to handle confirmed renames
- **THEN** third step instructs how to handle confirmed deletions
- **THEN** fourth step provides fallback for uncertain cases

#### Scenario: Rename resolution includes specific actions
- **WHEN** user follows rename resolution step
- **THEN** instructions tell user to copy changes to new location
- **THEN** instructions tell user to delete the conflict file after copying

### Requirement: Conflict files SHALL preserve original content with clear separator

The conflict file SHALL include the user's original file content below the guidance section, separated by a clear visual marker.

#### Scenario: Content separated from guidance
- **WHEN** conflict file is created
- **THEN** guidance section ends with "Your preserved changes:" text
- **THEN** markdown horizontal rule (---) separates guidance from content
- **THEN** original file content appears after the separator

#### Scenario: Original content unchanged
- **WHEN** conflict file includes guidance header
- **THEN** original file content is byte-identical to user's local version
- **THEN** no formatting or encoding changes to original content

### Requirement: Conflict file format SHALL maintain existing naming convention

The conflict file naming convention SHALL remain unchanged to maintain compatibility with existing tooling and user expectations.

#### Scenario: Filename format preserved
- **WHEN** system creates rename-related conflict file
- **THEN** filename follows format `<basename>.conflict-remote-delete-<timestamp>.md`
- **THEN** timestamp is Unix epoch seconds
- **THEN** file extension matches original file extension
