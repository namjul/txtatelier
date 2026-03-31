# Contact Test: pwa-minimal-editor-with-command-menu

## Evidence tier
proximal

## What would success look like?
Developer uses Cmd/Ctrl+K reflexively to switch files without conscious deliberation. File switching happens in under 2 seconds. No instance of reaching for mouse to navigate file tree when keyboard is already in use. Developer reports forgetting there is a command menu—it's simply "how I switch files."

## What would falsify this claim?
- Developer hunts visually for file tree or navigation chrome when wanting to switch files
- Developer asks "how do I see other files?" or "where's the file sidebar?"
- File switching takes >5 seconds or requires multiple attempts
- Developer expresses frustration with "invisible" navigation
- Mobile: Two-handed typing interruption to access command menu

## How will we check?
**Soft observation**: Use implementation myself for one week across desktop and mobile. Track moments of friction during file switching. Count instances of visual searching vs keyboard reflex. After one week, attempt to disable command menu shortcut and notice if I reach for it automatically.

**Medium validation**: Ask 2-3 early users to switch files without instruction. Observe if they discover and use command menu naturally, or if they look for traditional file tree UI.

## When will we check?
One week after implementation deployed to daily-use environment. Validation with other users within two weeks of internal release.
