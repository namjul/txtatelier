# Design: pwa-share-target-inbox

## Approach

Implement Web Share Target API integration with the following architecture:

1. **Manifest Configuration**: Add `share_target` field to `manifest.json` declaring the app can receive shared content (text, URLs, and files). The action points to `/?share-target=true` which opens the app in a specific mode.

2. **Service Worker Enhancement**: Extend the existing service worker to:
   - Handle `fetch` events for `POST /share-target`
   - Parse FormData containing shared content
   - Store shared content temporarily (IndexedDB) if user is offline
   - Redirect to the app with share metadata as URL parameters

3. **Settings Infrastructure**: Add a new "Inbox Path" setting that:
   - Defaults to `inbox.md` in the root
   - Can be changed via Settings UI
   - Stored in Evolu with local persistence only (not replicated):
     - Extend schema with a local-only `_settings` table (underscore prefix, same convention as CLI `_syncState`):
       ```typescript
       _settings: {
         id: SettingsId,
         inboxPath: NonEmptyString1000,
       }
       ```
     - Evolu persists to IndexedDB automatically; `_settings` does not sync across devices
     - Query with `useQuery` hook or direct API
     - Read on app init, fallback to default if row not found
   - Validation ensures the path ends in `.md` and is within watched directory

4. **Share Target Flow** (Phase 1 - Automatic):
   - Service worker receives share POST request from OS
   - Service worker stores shared content in IndexedDB (key: `pendingShare`, value: `{content, timestamp}`)
   - Service worker responds to POST and redirects to app root (`/`)
   - App loads normally (no special query params)
   - App checks IndexedDB for `pendingShare` on startup and when page becomes visible
   - Use @solid-primitives/page-visibility to trigger checks when app becomes visible
   - If found: app formats content, reads current inbox.md from Evolu, prepends new line, writes back to Evolu
   - App clears `pendingShare` from IndexedDB after successful write
   - No user feedback on share - user sees content in inbox.md when they check

5. **Content Processing** (Phase 1 - Automatic):
   - Accept text and URL shares (both treated as text/plain)
   - Service worker extracts text field from FormData, validates non-empty
   - Stores raw content in IndexedDB using native IndexedDB API (no formatting yet)
   - App uses native IndexedDB API to read/clear `pendingShare`
   - App does the formatting: prepends as single line `YYYY-MM-DD HH:MM: {content}` (newlines collapsed to spaces)
   - URLs are captured as-is (no title fetching, no markdown link conversion in Phase 1)
   - Normalization: All linebreaks become spaces, multiple spaces collapse to one
   - Result: Latest additions appear at the top of the file
   - File shares (images, documents): silently ignored at service worker level (no storage, no app processing)
   - Empty text: silently ignored

## Rationale

**Why Web Share Target API over custom deep links?**
The Web Share Target API is the standard web platform solution. It integrates with the native share sheet on mobile, which is the expected UX pattern. Custom URL schemes would require platform-specific handling and don't provide the same OS-level discoverability.

**Why automatic append in Phase 1?**
Minimal friction for the primary use case. User shares → content appears in inbox. If wrong content gets added, user deletes the line from inbox.md (local-first: user has full control). Confirmation modal adds friction; better to optimize for the happy path and trust users to manage their own files.

**Why configurable inbox path?**
Different users have different organizational preferences. Some want everything in `inbox.md`, others prefer `notes/captured/` or even date-organized structures (`inbox/YYYY-MM-DD.md`). Making this configurable respects user diversity without multiplying settings.

**Why service worker storage before redirect?**
The share target POST handler must respond quickly. Storing content in IndexedDB and redirecting to the app allows the service worker to complete the POST response while the app UI handles the actual user interaction. This also provides offline capability - shared content is captured even if the app isn't running.

## Load-bearing assumptions

1. The PWA already has a manifest.json and service worker - we are extending existing structures, not creating from scratch
2. txtatelier uses Evolu for state management - the share target UI will be implemented as a view within that framework
3. The file sync system (Phase 0+) is already operational - shared content goes through the same sync loop as manually created content
4. Mobile browsers that support Web Share Target API also support the required service worker APIs

## Risks and trade-offs

**Risk**: iOS Safari has limited Web Share Target API support. On iOS, the feature may not be discoverable in the native share sheet. However, the "Add to Home Screen" flow on iOS does enable basic share target functionality.

**Trade-off**: Service worker IndexedDB storage adds complexity but enables offline capture. Alternative would be simpler in-memory only, but content would be lost if user closes browser before saving.

**Risk**: Automatic append could add unwanted content to inbox. Mitigation: txtatelier is local-first, user can edit/delete any line in inbox.md. No data loss possible.

**Trade-off**: Supporting only markdown files means images/shared media need special handling (save as file, link in inbox). We choose this over trying to embed binary content in markdown.

## Out of scope (Phase 1)

- **Confirmation modal** - Automatic prepend, no user interaction required
- **Editable preview** - Content added as-is; user edits inbox.md directly if needed
- **Save as new file** - Only prepend to inbox.md in Phase 1
- **File handling** - Files (images, documents) silently ignored in Phase 1
- **Error UI for non-text** - Silently skip non-text shares
- Automatic categorization/tagging of shared content based on content analysis
- Share history/undo for shared content (beyond standard file version history)
- Sharing FROM txtatelier (web share API for export) - this is a separate gesture
- Handling shared content types beyond text, URLs, and files (e.g., contacts, calendar events)
- Mobile app wrappers (Cordova, Capacitor) - web-only PWA implementation
- Automatic inbox cleanup/archiving based on age

## Known unknowns

- Does the current routing system cleanly support query parameter-based modal opening?
- What is the exact behavior when share target is triggered while app is already open vs. closed?
- How does service worker IndexedDB interact with Evolu's storage layer - any conflicts?
- What file size limits exist for shared content via Web Share Target API?

## Co-variance

- **Routing system**: Will need to detect `?share-target=true` and open modal on app load
- **Settings UI**: New "Inbox Path" setting needs to be added to existing settings page
- **Service worker build**: May need adjustment to include share-target handler in SW compilation
- **Evolu schema**: Settings table may need new column for inbox_path or use existing key-value store
- **File sync**: No direct changes needed, but sync will naturally pick up the inbox.md changes
- **Entry points**: Manifest start_url may need consideration - should it include share-target or remain clean?

## ⚠ Design warnings

### Responsiveness
Phase 1 is instant - share action immediately prepends content and opens app. No waiting for user interaction. App shows toast or normal view.

### Continuity after correction
Not applicable in Phase 1 - automatic flow with no branching. User always lands in main app view after share.

### Exploratory capacity
Making the inbox path configurable allows users to experiment with different capture workflows. Automatic append removes friction but also removes the pause-to-categorize moment. User must edit inbox.md directly to organize.
