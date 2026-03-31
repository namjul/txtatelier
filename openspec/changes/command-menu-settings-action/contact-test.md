# Contact Test: command-menu-settings-action

## Evidence tier
proximal

## What would success look like?
- On mobile device (or mobile viewport): tap bottom bar → CommandMenu opens → type "?" → "Open Settings" action appears → tap it → SettingsDialog opens
- On desktop: press ⌘K → CommandMenu opens → type "?" → "Open Settings" action appears → press Enter or click → SettingsDialog opens
- File search continues working: type "notes" without "?" prefix → file list filters normally

## What would falsify this claim?
- Typing "?" shows no action or shows "No files match" message
- SettingsDialog fails to open when action is selected
- File search breaks when "?" detection is added (e.g., files with "?" in path don't match)
- CommandMenu doesn't close after selecting Settings action
- Action item styling breaks Combobox keyboard navigation

## How will we check?
Manual test on both mobile viewport and desktop:
1. Open browser dev tools, set mobile viewport (iPhone SE or similar)
2. Tap bottom bar to open CommandMenu
3. Type "?" in search field
4. Verify "Open Settings" action appears (instead of file list)
5. Tap/click the action
6. Verify SettingsDialog opens
7. Close Settings, repeat with file search (type "note") to verify no regression
8. Repeat test on desktop viewport with ⌘K shortcut

## When will we check?
Immediately after implementation (same session), before committing.
