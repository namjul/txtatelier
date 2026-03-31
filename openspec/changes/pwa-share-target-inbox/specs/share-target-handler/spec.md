## ADDED Requirements

### Requirement: Service worker stores text shares before navigation

The service worker SHALL handle `POST` requests to the configured share-target pathname, read `multipart/form-data`, and derive plain text by preferring non-empty `text`, then `url`, then `title`. If the derived text is empty, the handler SHALL not write to the share bridge. File-only shares SHALL be ignored (no storage). After handling, the worker SHALL respond with `303` redirect to the app scope root without query parameters.

#### Scenario: Pending share record shape

- **WHEN** non-empty text is derived from the share form
- **THEN** the worker stores `{ content, timestamp }` in IndexedDB under the fixed key `pendingShare` in a dedicated database for the app

### Requirement: App consumes pending share into Evolu inbox

The client SHALL read `pendingShare` using the native IndexedDB API on startup and whenever the document becomes visible (via `@solid-primitives/page-visibility`). If a record exists, the app SHALL format one line `YYYY-MM-DD HH:MM: {normalized text}` (whitespace and newlines collapsed), prepend it to the configured inbox markdown file in Evolu (creating the file if missing), then delete `pendingShare` only after a successful write.

#### Scenario: Visibility triggers processing

- **WHEN** the page transitions to visible and Evolu is ready
- **THEN** the app attempts to drain `pendingShare` into the inbox file
