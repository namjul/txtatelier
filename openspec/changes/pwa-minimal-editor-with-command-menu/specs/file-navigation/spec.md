# Delta spec: file-navigation

## ADDED Requirements

### Requirement: File switching via command menu

The PWA SHALL switch the active file from the modal file switcher rather than from an always-visible sidebar or in-page file tree.

#### Scenario: No persistent file tree

- **WHEN** the user is editing on the main editor page
- **THEN** the system does not show a persistent sidebar file picker; file switching is initiated from the file switcher overlay or mobile affordance

### Requirement: Document title reflects current file

When a file is selected, the PWA SHALL set `document.title` to include that file path as context.

#### Scenario: Title updates on selection

- **WHEN** the user selects a file
- **THEN** the document title incorporates the file path
