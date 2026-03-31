# Contact Test: add-vite-pwa

## Evidence tier
proximal

## What would success look like?
After implementation, I can:
1. Build the project and run `bun run preview`
2. Open the app in Chrome/Edge and see the install icon in the address bar
3. Click install and have txtatelier appear as a standalone app in my applications folder
4. Open the installed app, turn off WiFi, and still access and edit files
5. Re-enable WiFi and observe changes sync through Evolu

## What would falsify this claim?
Any of these would falsify the claim:
- No install icon appears in supported browsers
- Installation fails or produces a broken app
- Service worker doesn't register (checking DevTools > Application)
- App shows offline error page instead of cached content
- Files edited offline are lost when connectivity returns
- Build fails with PWA plugin errors

## How will we check?
1. Build and serve the production build: `bun run build && bun run preview`
2. Open Chrome DevTools > Application tab
3. Verify service worker is registered and manifest is valid
4. Test Lighthouse PWA audit - expect score > 90
5. Install the PWA and verify it opens in standalone window
6. Disable network, refresh, verify app still loads
7. Edit a file offline, re-enable network, verify sync completes

## When will we check?
Immediately after implementation completes. Run full PWA verification checklist within 24 hours of merge.
