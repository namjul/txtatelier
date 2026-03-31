## 1. Add dependencies

- [x] 1.1 Add `@solid-primitives/scheduled` to `centers/pwa/package.json` dependencies
- [x] 1.2 Add `@zag-js/solid` to `centers/pwa/package.json` dependencies
- [x] 1.3 Run `bun install` to install the packages

## 2. Create auto-save state machine

- [x] 2.1 Create `centers/pwa/src/machines/auto-save-machine.ts` using `@zag-js/core`:
  - States: idle, dirty, saving, saved, error
  - Events: TYPE, SAVE, SAVE_SUCCESS, SAVE_ERROR, RESET
  - Guards: preventSaveWhenNoChanges, preventSaveWhenConflict
- [x] 2.2 Create `useAutoSaveMachine` hook using `@zag-js/solid`
- [x] 2.3 Wire machine to content hash tracking for change detection

## 3. Add auto-save effect

- [x] 3.1 Create debounced effect watching content signal (300ms delay)
- [x] 3.2 Add ownerId and lastSavedHash checks to prevent sync loops
- [x] 3.3 Wire effect to Evolu update mutation

## 4. Replace save button with indicator

- [x] 4.1 Remove manual save button from Editor component
- [x] 4.2 Add auto-save indicator showing save state (Saving.../Saved/Error)
- [x] 4.3 Style indicator minimally (top-right or bottom of editor)

## 5. Handle edge cases

- [x] 5.1 Prevent auto-save when file is in conflict state
- [x] 5.2 Add retry logic for failed saves
- [x] 5.3 Handle rapid tab switching without triggering saves

## 6. Document co-variance (delta specs)

- [x] 6.1 Create `openspec/changes/add-auto-save/specs/pwa/auto-save/spec.md` with:
  - ADDED: Debounced auto-save effect
  - MODIFIED: Editor component save UI
  - Scenario: Editor shows auto-save indicator
  - Scenario: Content persists after 300ms debounce
