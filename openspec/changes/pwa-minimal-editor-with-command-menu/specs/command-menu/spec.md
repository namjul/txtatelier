# Delta spec: command-menu

## ADDED Requirements

### Requirement: File switcher dialog

The PWA SHALL provide a modal file switcher labeled for assistive technologies as "File switcher" that lists non-deleted files from Evolu, supports keyboard and pointer interaction, and closes on Escape or successful file selection.

#### Scenario: Open and close

- **WHEN** the user invokes the file switcher via the configured shortcuts or mobile affordance
- **THEN** the system opens a modal dialog with a filter field focused and announces open state to assistive technologies

#### Scenario: Select file

- **WHEN** the user confirms a highlighted file (e.g. Enter) or selects an item
- **THEN** the system selects that file for editing, closes the dialog, and restores focus to the editor

### Requirement: Filtered file list with virtualization

The file switcher SHALL filter the visible file list by case-insensitive substring match on file path and SHALL virtualize the list so large workspaces remain responsive.

#### Scenario: Substring filter

- **WHEN** the user types in the filter field
- **THEN** the system shows only paths whose full path contains the typed substring (case-insensitive)

#### Scenario: Large workspace

- **WHEN** the workspace contains thousands of files
- **THEN** the system still renders the list using virtualization without blocking the main thread on full list paint

### Requirement: Desktop keyboard shortcuts

On desktop-class pointers, the PWA SHALL open the file switcher on Meta+K or Control+K and SHALL call `preventDefault` on those shortcuts when handled.

#### Scenario: Meta or Control with K

- **WHEN** the user presses Meta+K or Control+K while the editor surface is active
- **THEN** the system opens the file switcher and prevents the browser default for that chord

### Requirement: Mobile affordance

When the primary pointer is coarse, the PWA SHALL expose an 8px-tall full-width bottom tap target and SHALL recognize an upward swipe of at least 48px starting within the bottom 100px of the viewport as an alternative open gesture.

#### Scenario: Bottom tap

- **WHEN** the user taps the bottom bar with minimal pointer movement
- **THEN** the system opens the file switcher

#### Scenario: Swipe up from bottom zone

- **WHEN** the user swipes upward from within the bottom 100px zone by at least 48px
- **THEN** the system opens the file switcher
