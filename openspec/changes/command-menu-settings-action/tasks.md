## 1. Prop drilling for settings callback

- [x] 1.1 Add `onOpenSettings: () => void` prop to CommandMenuCombobox props interface
- [x] 1.2 Add `onOpenSettings: () => void` prop to CommandMenuDialog props interface
- [x] 1.3 Add `onOpenSettings: () => void` prop to FilesWorkspace props interface
- [x] 1.4 Pass `() => setSettingsOpen(true)` from AppShell to FilesWorkspace

## 2. Command menu action mode detection

- [x] 2.1 Create `isActionMode` computed signal in CommandMenuCombobox that returns `true` when search equals "?" or starts with "?"
- [x] 2.2 Branch fileOptions memo: when in action mode, return single action item instead of filtered files
- [x] 2.3 Update collection creation to handle action item type

## 3. Action item rendering

- [x] 3.1 Create action item data structure with label "Open Settings" and execute callback
- [x] 3.2 Update Combobox.Item rendering to handle action items (skip virtualizer positioning for single item)
- [x] 3.3 Handle onSelect for action items: call onOpenSettings callback

## 4. Visual polish

- [x] 4.1 Style action item distinctly from file items (optional: prefix with icon or label)
- [x] 4.2 Test that CommandMenu closes properly after selecting action (closeOnSelect behavior)

## 5. Document co-variance (delta specs)

- [x] 5.1 Create or update `specs/command-menu/spec.md` under this change directory documenting the action trigger pattern
