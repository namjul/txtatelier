# Contact Test: pwa-new-version-notification

## Evidence tier
proximal — We will witness it directly by testing the PWA update flow ourselves and observing the notification behavior.

## What would success look like?
When we deploy a new build and refresh the PWA:
1. A notification banner appears at the bottom of the screen stating a new version is available
2. The banner remains visible until acted upon or dismissed
3. Clicking "Update" activates the new service worker and reloads the page
4. After reload, the new version is active (can verify via build timestamp or service worker version)
5. Unsaved edits in the editor are preserved through the update process

## What would falsify this claim?
1. The notification never appears even when a new service worker is waiting
2. The notification appears but clicking update does nothing (page doesn't reload)
3. The page reloads but the old service worker remains active
4. The notification is so intrusive it blocks workflow or causes users to ignore it
5. Users lose unsaved work when the update activates

## How will we check?
**Method**: Self-experience and direct observation

1. Build and deploy the PWA with the new update notification feature
2. Make a visible change (e.g., modify a label or add a marker)
3. Deploy a second build
4. Open the first build in browser, verify it's running
5. Trigger the update (refresh page or wait for service worker check)
6. Observe if notification appears
7. Click update button and verify page reloads with new version
8. Test with unsaved edits in the editor to verify they persist
9. Repeat test in both Chrome and Safari (main target browsers)

## When will we check?
Timeline: Within 1 week of deployment to production or staging environment.

Success criteria: At least 3 successful update cycles observed with notification visible and functional.
