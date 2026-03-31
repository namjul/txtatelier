## ADDED Requirements

### Requirement: Web app manifest declares share target

The PWA manifest SHALL include a `share_target` block so installed clients can receive shares via `POST` with `multipart/form-data`, accepting `title`, `text`, and `url` form fields. The action URL SHALL resolve under the app `scope` (including configurable Vite base path).

#### Scenario: Share target action matches service worker route

- **WHEN** the app is built with base path `/` or a subpath
- **THEN** `share_target.action` is the pathname the service worker uses for the POST handler (e.g. `/share-target` or `/subdir/share-target`)
