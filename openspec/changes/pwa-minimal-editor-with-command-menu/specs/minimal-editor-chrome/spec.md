# Delta spec: minimal-editor-chrome

## ADDED Requirements

### Requirement: Full-viewport editor shell

The PWA editor view SHALL use a fixed full-viewport layout where the primary writing surface occupies the remaining space below optional first-run hint chrome, without a persistent header, sidebar, or status bar for navigation.

#### Scenario: Editor fills viewport

- **WHEN** the user is on the editor page with at least one file
- **THEN** the textarea uses the available height and width without outer margins that reduce the writing area below roughly 85% of the viewport (excluding the dismissible hint strip and mobile bottom affordance when shown)

### Requirement: First-run discovery hint

The PWA SHALL show a dismissible hint that explains how to open the file switcher on fine versus coarse pointers, persisted with a client-side flag so it does not return after dismissal.

#### Scenario: Dismiss hint

- **WHEN** the user dismisses the hint
- **THEN** the system stores dismissal and does not show the hint again on subsequent loads

### Requirement: Settings access without persistent nav chrome

The PWA SHALL provide access to settings without a persistent header nav, using Meta+, and Control+, (with `preventDefault` when handled). Settings SHALL appear as a fullscreen modal dialog layered above the editor (higher z-index than the file switcher) so the editor remains mounted. The user SHALL be able to dismiss settings with Escape or with an explicit back control. Outside clicks SHALL NOT dismiss settings (`closeOnInteractOutside` false).

#### Scenario: Open and close settings

- **WHEN** the user presses Meta+, or Control+, from the editor context
- **THEN** the system opens the settings dialog on top of the editor

#### Scenario: Escape returns to editor

- **WHEN** settings are open and the user presses Escape
- **THEN** the system closes the settings dialog and restores focus to the editor surface
