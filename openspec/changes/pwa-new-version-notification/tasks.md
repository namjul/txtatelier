## 1. Configuration Changes

- [ ] 1.1 Change `registerType` from `"autoUpdate"` to `"prompt"` in `vite.config.ts`
- [ ] 1.2 Verify vite-plugin-pwa configuration still works after mode change

## 2. Service Worker Registration Enhancement

- [ ] 2.1 Replace `registerSW({ immediate: true })` in `main.tsx` with registration providing `onNeedRefresh` callback
- [ ] 2.2 Export `needRefresh` signal and `updateSW` function from registration for use by notification component
- [ ] 2.3 Add `onOfflineReady` callback for optional offline-ready notification (can be no-op initially)

## 3. Create Update Notification Component

- [ ] 3.1 Create `PwaUpdateNotification.tsx` component with:
  - Fixed position banner at bottom of screen
  - Props: `needRefresh` (boolean signal), `updateSW` (function to call)
  - "New version available" message with "Update now" button
  - Consistent styling matching existing dark/light theme
- [ ] 3.2 Add dismiss/close button to allow user to defer update
- [ ] 3.3 Test component renders correctly with mock props

## 4. Service Worker Message Handling

- [ ] 4.1 Add `message` event listener to `sw.ts` for `skipWaiting` command
- [ ] 4.2 Call `self.skipWaiting()` when message action is `"skipWaiting"`
- [ ] 4.3 Verify service worker properly handles the message and activates

## 5. Integration

- [ ] 5.1 Import and mount `PwaUpdateNotification` in `App.tsx` at root level
- [ ] 5.2 Wire up `needRefresh` signal and `updateSW` function from `main.tsx` registration to component props
- [ ] 5.3 Ensure notification persists across all app states and routes

## 6. Testing and Verification

- [ ] 6.1 Test update flow in development mode (understanding HMR limitations)
- [ ] 6.2 Build production version and test in Chrome with local server
- [ ] 6.3 Verify notification appears when new service worker is waiting
- [ ] 6.4 Click "Update now" and verify page reloads with new version
- [ ] 6.5 Test with unsaved editor content to ensure persistence through reload
- [ ] 6.6 Test dismiss functionality (notification should disappear)

## 7. Document Co-variance (Delta Specs)

- [ ] 7.1 Create or update `specs/pwa-service-worker/spec.md` documenting the change from autoUpdate to prompt mode
- [ ] 7.2 Create `specs/update-notification-ui/spec.md` documenting the new notification pattern and component interface
