# Design: pwa-minimal-editor-with-command-menu

## Approach

**Editor layout**: Full viewport minus minimal chrome. Editor textarea occupies 100% width/height within a zero-margin container. No sidebar, no header, no status bar. The only persistent UI is a subtle bottom-edge affordance on mobile (thin gradient line suggesting upward interaction) and keyboard shortcut indicator on desktop (fades after first use).

**Command menu as modal overlay**: File switching happens through a centered modal dialog triggered by keyboard shortcut (desktop) or thumb gesture (mobile). The dialog uses Ark UI's Dialog component for accessibility and focus management, containing a Combobox with virtualization for instant search across all files.

**Trigger mechanisms**:
- **Desktop**: Global Cmd/Ctrl+K via `createShortcut` from `@solid-primitives/keyboard`. No visual button exists—only the keyboard shortcut. Dialog appears centered with overlay backdrop.
- **Mobile**: Two options using `@solid-primitives/pointer` for reliable touch handling—(1) swipe up from bottom edge within 100px of screen bottom, or (2) tap thin bottom bar (8px height, full width). Both avoid two-handed typing interruption.

**Combobox behavior**: Immediately focused on open. Typing filters file list. Arrow keys navigate. Enter selects and closes. Escape cancels. Virtualization ensures smooth scrolling with 10k+ files.

## Rationale

**Why modal overlay instead of sidebar**: Sidebars are always present-at-hand—they occupy visual space and demand attention. A modal appears only when invoked, then disappears entirely. This preserves the 85%+ editor viewport goal.

**Why Cmd/Ctrl+K**: This shortcut is becoming standard (VS Code, Linear, Raycast, Obsidian). Users will likely try it without being told. No visual button needed, maintaining minimal chrome.

**Why Ark UI**: Provides battle-tested accessibility (focus trapping, ARIA, screen readers) without building from scratch. Dialog + Combobox combination is documented and stable.

**Why `@solid-primitives/keyboard`**: Manually handling keyboard shortcuts requires event listener management, modifier key tracking, and cross-platform differences (Cmd vs Ctrl). `createShortcut` handles all this declaratively with proper cleanup, supports sequences and chords, and prevents conflicts with native browser shortcuts.

**Why `@solid-primitives/pointer`**: Native pointer events in Solid can be inconsistent across touch devices and don't handle gesture composition well. `@solid-primitives/pointer` provides reliable touch/mouse unification, gesture recognition helpers, and proper cleanup—critical for bottom-edge swipe detection that must coexist with scrolling and other touch interactions.

**Mobile trigger alternatives considered**:
- Floating action button (FAB): Rejected—permanent visual element violates minimal chrome principle
- Two-finger gesture: Rejected—requires two hands, interrupts typing flow
- Long-press on editor: Rejected—interferes with text selection
- Bottom swipe/tap: Accepted—thumb naturally rests near bottom, single-hand operation

## Load-bearing assumptions

1. **Ark UI virtualization scales**: The Combobox virtualization handles 1000+ files without perceptible lag on mobile devices
2. **Keyboard shortcuts are discoverable**: Users will try Cmd/Ctrl+K or look for keyboard hints (we'll add one-time onboarding hint)
3. **Mobile bottom-gesture doesn't conflict with system gestures**: iOS/Android bottom-swipe is system-level; our 100px detection zone stays above that

## Risks and trade-offs

**Discovery risk**: Users unfamiliar with command palettes may feel lost without visible file tree. *Mitigation*: One-time hint on first load, dismissible forever.

**Mobile gesture collision**: Bottom-edge swipe might conflict with app-switching gestures on iOS. *Mitigation*: Use tap on bottom bar as primary trigger, swipe as secondary.

**Accessibility gap**: Screen reader users may struggle without persistent navigation landmarks. *Mitigation*: Dialog has clear label "File switcher", editor has region label, hint explains keyboard access.

**Trade-off**: We're trading visual discoverability for minimalism. New users need 30 seconds of orientation. This is acceptable for a power-user writing tool.

## Out of scope

- File creation from command menu (keep it to switching only)
- Folder navigation/browsing (flat file list, search-only)
- Recent files list (search is fast enough)
- Fuzzy search (starts with substring matching, can enhance later)
- Settings/preferences in command menu
- Multi-select or batch operations

## Known unknowns

- Exact bottom-edge detection threshold that feels natural vs accidental
- Whether 85% viewport is sufficient or should target 90%+
- Performance of file list query from Evolu on large workspaces
- If mobile users will prefer tap vs swipe trigger

## Co-variance

- **File sync loop**: Command menu needs real-time file list from Evolu—sync must stay current
- **Editor component**: Needs to expose focus management so dialog can restore focus on close
- **Theme system**: Dialog styling must respect light/dark mode variables
- **Mobile keyboard**: On-screen keyboard may push dialog up—need to test positioning
- **Routing**: File selection may need URL update without page reload

## ⚠ Design warnings

### Responsiveness
Dialog opens in <100ms. File list appears immediately with virtualization. Search filtering must feel instant (<50ms). Any delay will break ready-to-hand feel.

### Continuity after correction
If user opens command menu by accident, Escape closes it immediately and focus returns to editor at previous cursor position. No text lost, no position changed.

### Exploratory capacity
Minimal chrome reduces accidental discovery. Users won't stumble upon features. This is intentional—exploration happens through intentional command menu use, not UI browsing. Cost: steeper initial learning curve.
