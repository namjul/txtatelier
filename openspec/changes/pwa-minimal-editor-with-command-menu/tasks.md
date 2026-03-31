## 1. Setup

- [x] 1.1 Install Ark UI dependencies: `@ark-ui/solid`
- [x] 1.2 Install pointer primitives: `@solid-primitives/pointer`
- [x] 1.3 Install keyboard primitives: `@solid-primitives/keyboard`
- [x] 1.4 Create directory structure: `centers/pwa/src/components/command-menu/`
- [x] 1.5 Create directory: `centers/pwa/src/components/editor/`

## 2. Command Menu Component

- [x] 2.1 Create `CommandMenuDialog.tsx` using Ark UI Dialog
- [x] 2.2 Implement `CommandMenuCombobox.tsx` with virtualization
- [x] 2.3 Add file list query integration with Evolu
- [x] 2.4 Implement search filtering (substring matching)
- [x] 2.5 Handle file selection and navigation
- [x] 2.6 Add focus restoration to editor on close

## 3. Desktop Trigger

- [x] 3.1 Create global keyboard shortcut using `createShortcut` from `@solid-primitives/keyboard`
- [x] 3.2 Configure shortcut for Cmd+K (Mac) and Ctrl+K (Windows/Linux)
- [x] 3.3 Prevent default browser behavior for Cmd/Ctrl+K

## 4. Mobile Trigger

- [x] 4.1 Create bottom bar component (8px height, full width)
- [x] 4.2 Implement tap handler using `@solid-primitives/pointer`
- [x] 4.3 Add bottom-edge swipe detection (100px zone from bottom)
- [x] 4.4 Ensure single-hand operation (thumb accessibility)
- [x] 4.5 Test on iOS/Android for gesture collision

## 5. Minimal Editor Layout

- [x] 5.1 Refactor editor to full viewport (100% width/height)
- [x] 5.2 Remove sidebar, header, status bar chrome
- [x] 5.3 Add subtle bottom-edge gradient affordance on mobile
- [x] 5.4 Verify editor viewport >85% on all screen sizes
- [x] 5.5 Ensure textarea has zero margins/padding overflow

## 6. Onboarding & Accessibility

- [x] 6.1 Create one-time hint component for first-time users
- [x] 6.2 Add dismissible keyboard shortcut hint on desktop
- [x] 6.3 Add ARIA labels: dialog "File switcher", editor region
- [x] 6.4 Ensure screen reader announces command menu open/close
- [x] 6.5 Test focus trapping in dialog

## 7. Theme & Styling

- [x] 7.1 Style dialog with theme variables (light/dark mode)
- [x] 7.2 Ensure combobox respects color scheme
- [x] 7.3 Add backdrop overlay styling
- [x] 7.4 Verify contrast ratios for accessibility

## 8. Testing & Validation

- [x] 8.1 Test command menu opens in <100ms
- [x] 8.2 Test search filtering feels instant (<50ms)
- [x] 8.3 Verify focus restoration after dialog close
- [x] 8.4 Test mobile keyboard doesn't break dialog positioning
- [x] 8.5 Test with 1000+ files for virtualization performance

## 9. Document co-variance (delta specs)

- [x] 9.1 Create `openspec/changes/pwa-minimal-editor-with-command-menu/specs/command-menu/spec.md`
      Document the new command-menu structure with ADDED sections
- [x] 9.2 Create `openspec/changes/pwa-minimal-editor-with-command-menu/specs/minimal-editor-chrome/spec.md`
      Document minimal editor layout changes with ADDED/MODIFIED sections
- [x] 9.3 Update `openspec/changes/pwa-minimal-editor-with-command-menu/specs/file-navigation/spec.md`
      Document file navigation shift from sidebar to command menu
