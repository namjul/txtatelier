## ADDED Requirements

### Requirement: Command menu action mode for settings

When the file switcher command menu input is exactly `?` or begins with `?`, the system SHALL show command actions instead of filtering files by path. At minimum, the system SHALL offer an action labeled "Open Settings" that opens the settings dialog.

#### Scenario: Action mode replaces file filter

- **WHEN** the user opens the command menu and types `?` or text starting with `?`
- **THEN** the list shows the "Open Settings" action (not a filtered file list)

#### Scenario: File search unchanged without leading question mark

- **WHEN** the user types a search term that does not start with `?`
- **THEN** the list shows files filtered by path substring as before, including paths that contain `?` elsewhere in the name

#### Scenario: Selecting Open Settings

- **WHEN** the user selects the "Open Settings" action
- **THEN** the settings dialog opens and the command menu closes
