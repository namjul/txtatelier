## ADDED Requirements

### Requirement: Inbox path is configurable and validated (local-only)

The Evolu schema SHALL include a local-only `_settings` table (underscore prefix, not replicated) with an `inboxPath` column (`NonEmptyString1000`). The Settings UI SHALL expose an “inbox path” field defaulting to `inbox.md` when no row exists. Persisted values MUST be relative paths ending in `.md`, without `..` or a leading `/`. The app SHALL persist the preference with a stable row id (e.g. `upsert` on a deterministic id) without requiring the files shard owner.

#### Scenario: Save upserts local settings row

- **WHEN** the user saves a valid inbox path
- **THEN** the app upserts the single `_settings` row with the new `inboxPath`

#### Scenario: Share processing uses saved path

- **WHEN** a pending share is applied and a `_settings` row defines `inboxPath`
- **THEN** the new line is prepended to the file at that path in Evolu
