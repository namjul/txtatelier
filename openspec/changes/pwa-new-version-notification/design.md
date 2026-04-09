# Design: pwa-new-version-notification

## Approach

Switch from vite-plugin-pwa's `autoUpdate` mode to `prompt` mode, enabling user-controlled service worker activation. The implementation follows the standard PWA update pattern:

1. **Configuration change**: Update `vite.config.ts` to use `registerType: "prompt"` instead of `"autoUpdate"`

2. **Registration enhancement**: Replace simple `registerSW({ immediate: true })` in `main.tsx` with a registration that provides an `onNeedRefresh` callback. This callback receives an `updateSW` function that, when called, activates the waiting service worker and reloads the page.

3. **Notification component**: Create a `PwaUpdateNotification` Solid.js component that:
   - Appears as a fixed banner at the bottom of the screen
   - Shows only when `needRefresh` signal is true
   - Displays message: "A new version is available"
   - Provides "Update now" button and dismiss option
   - Uses consistent styling with existing app theme (dark/light support)

4. **Service worker message handling**: Add a `message` event listener in `sw.ts` to respond to `skipWaiting` commands from the main thread.

5. **Integration**: Mount the notification component in `App.tsx` at the root level so it persists across route changes.

## Rationale

**Why not keep autoUpdate?**
- Silent updates cause user confusion when UI changes unexpectedly
- Risk of losing unsaved work during background refresh
- No visibility into which version users are running

**Why user-controlled vs other patterns?**
- **Prompt mode** is the standard approach recommended by Workbox/vite-plugin-pwa
- **Manual refresh** (waiting for user to close and reopen app) has poor adoption
- **Forced update** (immediate skipWaiting) breaks user flow and risks data loss
- **Tab-based activation** (skipWaiting on new tab) doesn't solve the "old version" problem

**Why bottom banner?**
- Consistent with Google's Inbox pattern referenced in research
- Non-intrusive but visible
- Matches existing app notification patterns

## Load-bearing assumptions

1. vite-plugin-pwa's `prompt` mode reliably detects service worker updates in all target browsers (Chrome, Safari, Firefox)
2. The `onNeedRefresh` callback fires consistently when a new service worker is waiting
3. Calling the provided `updateSW(true)` function properly activates the service worker and reloads the page
4. IndexedDB (used by Evolu) persists across the page reload triggered by the update

## Risks and trade-offs

**Risks:**
- Users might ignore the notification and continue using old version indefinitely
- The notification might be missed on mobile (smaller screen, banner positioned at bottom)
- Multiple rapid deployments could spam users with update notifications
- Service worker registration failure could leave users stuck on old version

**Trade-offs:**
- Explicit updates add one click friction vs seamless background updates
- Waiting for user activation delays new version rollout (vs immediate for all users)
- Additional UI surface area to maintain and style consistently

## Out of scope

- Automatic update after timeout (forcing update if user ignores for N days)
- Update changelog or version diff display
- Grace period for active editing sessions (deferred update while typing)
- Analytics/tracking of update acceptance rates
- Multiple update queue (if multiple versions deployed while app open)
- Network-first strategy changes (keeping existing precache behavior)

## Known unknowns

1. How will the notification behave on iOS Safari PWA (add to home screen mode)?
2. Does the update flow work correctly when app is offline?
3. Will there be any race conditions with Evolu's sync during the reload?
4. How to test this in development (service workers behave differently with HMR)?

## Co-variance

Files that will be modified:
- `vite.config.ts` - PWA plugin configuration
- `main.tsx` - Service worker registration logic
- `App.tsx` - Integration of notification component
- `sw.ts` - Message event handler for skip-waiting

New files to create:
- `src/components/PwaUpdateNotification.tsx` - Notification banner component
- `src/components/PwaUpdateNotification.css` or inline styles (depending on project patterns)

## ⚠ Design warnings

### Responsiveness
The notification must appear immediately when a new service worker is detected. There should be no perceptible delay between the browser detecting the update and the UI showing the notification. The update action must provide clear feedback (button state change) before the page reloads.

### Continuity after correction
If a user has unsaved edits in the editor when they click "Update", those edits must persist through the page reload. The editor's auto-save mechanism (via Evolu) should have already saved the draft, but we need to verify this happens before the reload triggers.

### Exploratory capacity
Adding a prominent notification could train users to ignore bottom banners (banner blindness). We should ensure the styling is distinct from other notifications and that the update action is clearly the primary action.
