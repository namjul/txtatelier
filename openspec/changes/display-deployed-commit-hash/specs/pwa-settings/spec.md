## ADDED Requirements

### Requirement: Settings panel shows deployed commit identifier

The PWA settings panel SHALL display a build-time commit identifier so testers can confirm which revision is running. The label SHALL be `commit:` and the value SHALL be a monospace, muted string adjacent to other status metadata in the Status section.

#### Scenario: Production build with injected hash

- **WHEN** the client bundle was built with a non-empty `VITE_COMMIT_SHA` environment variable
- **THEN** the settings Status section shows `commit:` followed by that value (trimmed)

#### Scenario: Local or unset build metadata

- **WHEN** `VITE_COMMIT_SHA` is unset or empty at build time
- **THEN** the settings Status section shows `commit:` followed by the literal `dev`

#### Scenario: Discoverability

- **WHEN** the user opens the settings panel
- **THEN** the commit row is visible without scrolling past the Status section on typical viewports
