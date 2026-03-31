## 0. Setup

- [x] 0.1 Add dependency: `bun install @solid-primitives/page-visibility`

## 1. Manifest and Service Worker Foundation

- [x] 1.1 Add `share_target` configuration to `manifest.json` with text and URL support (Phase 1)
- [x] 1.2 Create service worker share target handler at `/share-target` endpoint (POST)
- [x] 1.3 Implement IndexedDB storage in service worker (`pendingShare` key)
- [x] 1.4 Add share metadata extraction in SW - extract text field, reject files/empty text
- [x] 1.5 Service worker redirects to `/` after storing content (no query params)

## 2. Settings Infrastructure

- [x] 2.1 Add inbox_path column to Evolu settings schema
- [x] 2.2 Create inbox path validation utilities (must end in .md, within watched dir)
- [x] 2.3 Add "Inbox Path" input to Settings UI with default value `inbox.md`
- [x] 2.4 Implement settings persistence and retrieval for inbox path

## 3. App Share Processing (Phase 1 - Automatic)

- [x] 3.1 Create IndexedDB utility module for get/delete `pendingShare` (native API)
- [x] 3.2 Create effect that checks IndexedDB on startup and when page becomes visible (use @solid-primitives/page-visibility)
- [x] 3.3 Implement content formatting: `YYYY-MM-DD HH:MM: {content}` with newline normalization
- [x] 3.4 Read current inbox.md content from Evolu, prepend new line, write back
- [x] 3.5 Delete `pendingShare` from IndexedDB after successful Evolu write
- [x] 3.6 Handle edge case: inbox.md doesn't exist yet (create with just the new line)

## 5. Testing and Edge Cases

- [ ] 5.1 Test share target flow on Chrome/Android with app closed
- [ ] 5.2 Test share target flow on Chrome/Android with app already open
- [ ] 5.3 Test sharing URLs (treated as text)
- [ ] 5.4 Test sharing files (silently ignored)
- [ ] 5.5 Test offline share capture (service worker IndexedDB storage)
- [ ] 5.6 Test iOS Safari behavior and document limitations
- [ ] 5.7 Test inbox path changes apply immediately to share target

_Checklist and iOS notes: `evidence.md` in this change directory._

## 6. Document co-variance (delta specs)

- [x] 6.1 Create or update `specs/pwa-manifest/spec.md` documenting share_target field
- [x] 6.2 Create or update `specs/share-target-handler/spec.md` documenting service worker capture, IndexedDB bridge, app-side processing
- [x] 6.3 Create or update `specs/settings-inbox-path/spec.md` documenting inbox path configuration
