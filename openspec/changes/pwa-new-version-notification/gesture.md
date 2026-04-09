# Gesture: pwa-new-version-notification

## Gesture type
create

## What are we gesturing toward?
pwa-update-notification - A user-visible mechanism that announces when a new app version is available and allows explicit activation.

## Claim
When a new service worker is waiting to activate, users will see a non-intrusive notification banner at the bottom of the screen. Users will click the update button to activate the new version and reload the page.

## What made us do this?
The current PWA uses `registerType: "autoUpdate"` which silently updates the service worker in the background. This causes three issues:
1. Users may not realize the app has changed, leading to confusion when UI or behavior shifts unexpectedly
2. Users editing files could lose unsaved work if the app refreshes unexpectedly
3. We have no visibility into whether users are actually running the latest version

## Load-bearing assumptions
1. Users prefer explicit control over when the app updates (vs silent background updates)
2. The update notification is visible enough to be noticed but non-intrusive enough to not disrupt workflow
3. vite-plugin-pwa's `prompt` mode with `onNeedRefresh` callback works reliably in all target browsers

## Structures this gesture touches
structures/pwa-service-worker/ - The existing service worker registration and lifecycle management
structures/update-notification-ui/ - New: A banner component for announcing available updates

## Co-variance
- App.tsx - Must integrate the notification component into the app shell
- main.tsx - Must expand service worker registration to handle update detection
- sw.ts - Must add message handling for skip-waiting activation
- vite.config.ts - Must change `registerType` from `"autoUpdate"` to `"prompt"`
