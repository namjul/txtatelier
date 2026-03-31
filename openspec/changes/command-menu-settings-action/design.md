# Design: command-menu-settings-action

## Approach

Hardcode a single action trigger in CommandMenuCombobox: when user types "?", show "Open Settings" action instead of file list. Selecting this action invokes a callback that opens SettingsDialog.

Prop drilling path:
1. AppShell holds `setSettingsOpen` signal
2. Pass `() => setSettingsOpen(true)` through FilesWorkspace → CommandMenuDialog → CommandMenuCombobox
3. CommandMenuCombobox detects "?" prefix and renders action item
4. On action select: call callback, close CommandMenu (via closeOnSelect)

## Rationale

**Why CommandMenu, not dedicated button:**
- Settings access is rare (agreed in exploration)
- CommandMenu already has mobile affordance (bottom bar tap/swipe)
- No new UI chrome added to main interface
- Pattern matches VS Code, Linear, Raycast command palettes

**Why "?" prefix, not always-visible action:**
- File switching is primary use case—actions shouldn't compete for attention
- "?" is discoverable enough for edge-case actions (like help/commands pages)
- Keeps UI minimal for common case (file search)

**Why hardcode vs generic system:**
- Only one action needed now (Settings)
- Generic system adds complexity without proven need
- Easy to refactor when 3+ actions exist

## Load-bearing assumptions

1. CommandMenuCombobox can branch rendering based on search prefix without breaking existing file filtering
2. Ark UI Combobox component supports mixing item types (files vs actions)
3. Prop drilling through 3 layers (App → FilesWorkspace → Dialog → Combobox) won't create maintenance burden

## Risks and trade-offs

**Risk:** Users who type "?" expecting file search get confused by seeing Settings action
- Mitigation: Only trigger when search equals "?" or starts with "?", so partial matches like "notes?" still search files

**Trade-off:** No visual hint that settings exists in CommandMenu
- Acceptable because: mobile settings access is rare, users who need it will likely try common patterns (swipe from edge, look for menu, eventually try CommandMenu)

## Out of scope

- Generic command/action system with registration API
- Other actions (help, keyboard shortcuts, theme toggle)
- Action icons or visual styling beyond text
- Partial word matching for action names (e.g., "?s" matching Settings)

## Known unknowns

- Does Ark UI Combobox handle item selection gracefully when collection changes from files to single action?
- Will virtualizer (TanStack) work cleanly with single item or need special case?

## Co-variance

- CommandMenuDialog.tsx: needs new `onOpenSettings` prop
- CommandMenuCombobox.tsx: needs new `onOpenSettings` prop + branching logic
- FilesWorkspace (App.tsx): needs to receive and forward `onOpenSettings` prop
- AppShell (App.tsx): needs to pass `() => setSettingsOpen(true)` to FilesWorkspace

## ⚠ Design warnings

### Responsiveness
Action selection should feel immediate. SettingsDialog opens on top of CommandMenu, which auto-closes—no perceptible delay expected.

### Continuity after correction
If user opens CommandMenu by mistake, types "?", then realizes they wanted file search—they can just clear input (backspace) and return to file mode. No state lost.

### Exploratory capacity
This approach doesn't reduce exploration—users can still discover all files via CommandMenu. Settings discovery is slightly hidden (by design, since rare use).
