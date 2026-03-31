## ADDED Requirements

### Requirement: Precache-only Workbox strategy

The generated service worker SHALL precache versioned static assets using Workbox `globPatterns` that include `js`, `css`, `html`, `svg`, `png`, and `wasm` files, with `cleanupOutdatedCaches` and `clientsClaim` enabled. The configuration SHALL NOT add broad runtime caching for arbitrary `fetch` responses that would override Evolu’s IndexedDB-backed sync and WebSocket replication.

#### Scenario: Static shell available offline

- **WHEN** the user opens a previously loaded build while offline
- **THEN** precached JS, CSS, HTML, WASM, and icon assets can be served from the service worker so the app shell loads

#### Scenario: Evolu transport stays outside SW caching

- **WHEN** Evolu performs replication over WebSocket or persists data in IndexedDB
- **THEN** those channels are not replaced by a cache-first HTTP strategy for API-like URLs because only build artifacts are precached and no such runtime cache rules are configured
