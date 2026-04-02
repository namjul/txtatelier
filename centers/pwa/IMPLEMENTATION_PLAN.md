# PWA Implementation Plan — Web Interaction Surface

This plan defines Phase 6 implementation for the PWA as txtatelier's web interaction surface. It is correctness-first and preserves the core system contract: filesystem is canonical, and the CLI is the only bridge to disk.

---

## Scope

- Browser-based file interaction workflows (discover, open, edit, resolve conflicts).
- Dedicated settings surface for owner and mnemonic management.
- PWA reads and writes Evolu only.
- No direct filesystem access from browser code.

Out of scope for the current implementation window:

- Rich text features
- Automatic merging
- Advanced multi-view information architecture

---

## Architecture

Data flow:

1. PWA mutates `file` rows in Evolu.
2. CLI state materialization applies Evolu changes to the filesystem.
3. Filesystem edits are captured by CLI change capture back into Evolu.
4. PWA subscribes to Evolu and reflects new state.

### Invariants

- Browser never writes disk directly.
- No silent overwrite on editing conflicts.
- Conflict artifacts are first-class rows/files.
- Mnemonic is hidden by default and revealed only through explicit user action.
- Destructive owner reset requires explicit user confirmation.

---

## Tech Stack

- Framework: SolidJS
- Data/Replication: Evolu
- UI behavior: ZagJS (when interaction complexity requires it)
- Styling: Tailwind CSS + daisyUI
- Tooling/runtime: Bun

---

## Design Orientation (Reference Pattern)

Use the referenced page as a visual direction for the first PWA UI language.

Extracted patterns to preserve:

- Minimal, text-first interface with almost no decorative chrome.
- Monospace-led typography with strong editorial hierarchy (bold identity, plain body copy).
- Quiet neutral canvas (light gray background), near-black text, sparse blue underlined links.
- High whitespace density and readable line length over compact information packing.
- Structural clarity through alignment and spacing before using cards, borders, or shadows.

Translate these into implementation rules:

- Prefer a monospace primary type scale for both navigation and body text.
- Keep composition narrow and left-anchored inside a centered max-width container.
- Use simple primitives: headings, plain lists, links, textarea/editor surface, status lines.
- Avoid heavy component styling (rounded cards, gradients, elevated panels, icon-heavy controls).
- Keep interaction feedback textual (`saving`, `saved`, `conflict detected`) rather than ornamental.
- Preserve mobile readability by collapsing the split header into a single vertical flow.

Initial visual tokens:

- Background: warm/light neutral gray.
- Foreground text: near-black.
- Link color: classic hyperlink blue with underline.
- Spacing rhythm: generous vertical gaps between content groups.
- Motion: minimal; only subtle state transitions where they improve clarity.

Theme support (daisyUI):

- Ship both light and dark themes from the start using daisyUI theme switching.
- Keep the same text-first, low-chrome language across both themes.
- Light theme follows the reference pattern (neutral gray canvas, near-black text, blue links).
- Dark theme mirrors contrast and restraint (deep neutral background, off-white text, accessible link blue).
- Default theme should reflect system preference (`prefers-color-scheme`).
- If a manual toggle is added, it should be an explicit override of system preference.
- Ensure conflict, save-state, and navigation affordances remain equally legible in both themes.

**Implementation approach:**

- Use daisyUI theme names: `light` and `dark` (or custom theme names if needed).
- Apply theme via `data-theme` attribute on root element.
- Detect system preference: `window.matchMedia('(prefers-color-scheme: dark)')`.
- Store user override in localStorage: `txtatelier-theme` (`light`/`dark`/`system`).
- Toggle UI: Simple text link "Switch to Dark" / "Switch to Light" in footer or settings.

Design boundary:

- This direction governs visual language, not data architecture.
- Evolu-only writes, conflict explicitness, and CLI filesystem boundary remain non-negotiable.

---

## Owner and Recovery (Mnemonic Settings)

Purpose:

- Make cross-device recovery and owner lifecycle actions first-class in the PWA.

Capabilities:

- Show/Hide Mnemonic (hidden by default).
- Restore from Mnemonic (validate input before restore).
- Reset local owner/data (explicit destructive confirmation).
- Download local database backup (`exportDatabase`).

Behavioral constraints:

- Owner actions run through Evolu APIs only.
- No filesystem APIs in browser code.
- Feedback remains textual and explicit (`restoring`, `restored`, `reset complete`, `backup exported`, `error`).

---

## Editing State Model

Per active file, keep:

- `remoteSnapshot`: latest Evolu content and metadata
- `localDraft`: current editor value
- `dirty`: whether draft differs from base
- `baseFingerprint`: fingerprint captured when editing started (`contentHash` or equivalent)

This model enables explicit conflict detection during editing without hidden merges.

---

## PWA Conflict Policy

When remote content changes while `dirty = true` and fingerprint differs:

- Do not overwrite local draft.
- Pause autosave for that file.
- Show explicit resolution actions:
  1. Save local draft as conflict artifact file (recommended default)
  2. Replace draft with remote
  3. Compare side-by-side (later enhancement)

Conflict artifact naming follows system convention:

```
<filename>.conflict-<ownerId>-<timestamp>.<ext>
```

Rationale:

- Preserves user intent.
- Matches existing CLI conflict semantics.
- Avoids hidden last-write-wins behavior.

---

## Phased Delivery

### 6.0 Foundation

- Create PWA workspace structure and scripts.
- Add baseline runtime, app shell, and Evolu client wiring.

### 6.1 Read Workflows

**File discovery and navigation:**

- Query non-deleted files from Evolu via subscription.
- Display as simple list sorted by `updatedAt` (most recent first).
- Show file path, last modified timestamp, file size (computed from content length).
- Click file to open in editor view.

**UI structure:**
```
Files (42)
─────────────────────────────────
notes/ideas.md          2m ago
draft.md                5m ago
notes.conflict-xyz-...  1h ago
```

**Performance:**
- For >100 files, implement virtual scrolling or pagination.
- Load first 50 files, lazy-load rest on scroll.

### 6.2 Write Workflows

**File creation:**

1. Add "New File" button/link in file list.
2. Prompt for file path (e.g., `notes/new-idea.md`).
3. Validate path (no leading/trailing slashes, no `..`, valid characters).
4. Create new Evolu row with empty content.
5. Open in editor immediately.

**Editing and saving:**

1. Load file content into textarea/editor.
2. Capture `baseFingerprint` (initial `contentHash`).
3. Track `dirty` state on every keystroke.
4. Autosave after 2 seconds of inactivity (debounced).
5. Show save state:
   - `editing` (dirty but within debounce window)
   - `saving...` (mutation in flight)
   - `saved` (mutation confirmed)
   - `error: <message>` (mutation failed)

**Save implementation:**
- Compute new `contentHash` from `localDraft`.
- Mutate Evolu row with new `content`, `contentHash`, `updatedAt`.
- Update `baseFingerprint` to new hash on success.

### 6.3 Conflict Guard

**Detection mechanism:**

1. Subscribe to Evolu changes for currently open file.
2. On remote update, compare `remoteSnapshot.contentHash` vs `baseFingerprint`.
3. If hashes match: safe to continue editing (no conflict).
4. If hashes differ and `dirty = false`: update editor with remote content, reset `baseFingerprint`.
5. If hashes differ and `dirty = true`: **conflict detected**.

**Conflict state:**

- Pause autosave.
- Display conflict banner above editor:
  ```
  Conflict detected: This file was modified remotely.
  [Save as conflict] [Discard local changes] [Review]
  ```
- Disable normal save until user resolves.

**Race condition handling:**

- If multiple rapid remote updates occur while in conflict state, always compare against latest `remoteSnapshot`.
- Do not accumulate conflicts; treat as single conflict until resolved.

### 6.4 Conflict Artifact Flow

**"Save as conflict" action:**

1. Generate conflict filename:
   ```ts
   const conflictPath = generateConflictPath(
     originalPath,
     ownerId,
     Date.now()
   );
   // Example: "notes.conflict-abc123-1710412345.md"
   ```

2. Create new Evolu row with:
   - `path`: conflict filename
   - `content`: current `localDraft`
   - `contentHash`: hash of `localDraft`
   - `updatedAt`: current timestamp

3. Update editor to show remote content:
   - Set `localDraft = remoteSnapshot.content`
   - Set `baseFingerprint = remoteSnapshot.contentHash`
   - Set `dirty = false`
   - Clear conflict state

4. Show confirmation message:
   ```
   Local changes saved as: notes.conflict-abc123-1710412345.md
   ```

**Verification:**
- Conflict file appears in file list.
- CLI syncs conflict file to disk.
- Can open and edit conflict file like any other file.

### 6.5 End-to-End Verification

**Manual test protocol:**

1. **PWA edit -> Evolu -> CLI -> filesystem:**
   - Open file in PWA, edit, wait for "saved".
   - Check filesystem: file content matches edit.
   - Timeline: <5 seconds for change to materialize.

2. **Filesystem edit -> CLI -> Evolu -> PWA refresh:**
   - Edit file on disk with external editor.
   - Check PWA: editor updates with new content within 5 seconds.
   - Verify `baseFingerprint` updates.

3. **Dirty-draft conflict -> explicit resolution path:**
   - Open file in PWA, start editing (dirty state).
   - Edit same file on disk before saving PWA changes.
   - Verify conflict banner appears in PWA.
   - Use "Save as conflict" action.
   - Verify conflict file created and synced.

4. **Restore from mnemonic -> expected rows visible after sync:**
   - Note current mnemonic from Settings.
   - Reset local owner/data.
   - Restore with saved mnemonic.
   - Wait for sync (up to 30 seconds).
   - Verify all files reappear in PWA.

**Automated verification (future):**
- Preflight script in `centers/pwa/tests/phase-6-5-preflight.sh`.
- Runs before phase completion.
- Exit code 0 = pass, non-zero = fail with details.

### 6.6 Mnemonic Settings and Owner Actions

**Settings page structure:**

- Link in main navigation: "Settings"
- Sections: Owner Info, Mnemonic, Danger Zone

**Owner Info section:**

```
Owner ID: abc123def456...
Created: 2026-03-10
```

**Mnemonic section:**

1. **Show/Hide toggle:**
   - Default: Hidden, show as `••••••••••••••••••••••••`.
   - Button: "Reveal Mnemonic".
   - On click: Show full mnemonic as plain text, button changes to "Hide Mnemonic".
   - Warning text: "Store this mnemonic securely. Anyone with it can access your data."

2. **Mnemonic validation:**
   - Evolu mnemonics are 12-word BIP39 phrases.
   - Validate: exactly 12 words, all in BIP39 wordlist, valid checksum.
   - Show specific errors:
     - "Mnemonic must be 12 words" (if word count wrong)
     - "Invalid word: '<word>'" (if not in wordlist)
     - "Invalid mnemonic checksum" (if checksum fails)

3. **Restore flow:**
   - Textarea input for mnemonic.
   - Button: "Restore from Mnemonic".
   - On click:
     - Validate mnemonic (show errors if invalid).
     - Show confirmation modal: "This will replace your current owner. Continue?"
     - If confirmed: call `evolu.restoreOwner(mnemonic)`.
     - Show status: `restoring...` -> `restored` or `error: <message>`.
     - On success: reload page to refresh Evolu subscriptions.

**Danger Zone section:**

1. **Reset owner/data:**
   - Button: "Reset Local Data" (styled as dangerous/destructive).
   - On click: Show confirmation modal with typed confirmation.
     ```
     Warning: This will permanently delete all local data.
     Type "DELETE" to confirm: [input]
     ```
   - If input matches "DELETE": call `evolu.resetOwner()`.
   - Show status: `resetting...` -> `reset complete`.
   - On success: reload page.

2. **Download backup:**
   - Button: "Download Database Backup".
   - On click: call `evolu.exportDatabase()`, trigger file download.
   - Filename: `txtatelier-backup-<timestamp>.sqlite`.
   - Show status: `exporting...` -> `backup exported` or `error: <message>`.

---

## Acceptance Criteria

- PWA presents a usable browser interaction loop over Evolu-backed file state.
- Editing and saving updates Evolu rows.
- No filesystem API usage in PWA code.
- Dirty-draft remote collisions never silently overwrite local draft.
- Conflict artifacts can be created from PWA and sync through CLI.
- PWA exposes a dedicated settings page for mnemonic and owner actions.
- Mnemonic is hidden by default and shown only after explicit reveal.
- Invalid mnemonic input is rejected with clear validation feedback.
- Restore from valid mnemonic yields expected synced dataset visibility.
- Owner reset is confirmation-gated and clears local owner/data.
- Local backup download succeeds as SQLite payload.
- Existing CLI regression suite remains green.

---

## Test Matrix (Phase 6)

1. Create new file from PWA and confirm filesystem materialization.
2. Edit existing file from PWA and confirm disk update.
3. Edit file on disk and confirm PWA refreshes through Evolu.
4. Trigger dirty-draft conflict and confirm resolution banner appears.
5. Use "save as conflict artifact" and confirm file naming and propagation.
6. Verify mnemonic is hidden by default; reveal/hide toggle works.
7. Restore with invalid mnemonic and confirm validation feedback.
8. Restore with valid mnemonic and confirm owner/data convergence.
9. Reset owner/data requires confirmation and clears local state.
10. Download backup and confirm file is downloaded and non-empty.

---

## Future Improvements

The following enhancements are deferred beyond Phase 6 scope:

### File Management

1. **File deletion:** Add "Delete" action in file list or editor with confirmation modal.
2. **Bulk operations:** Select multiple files for deletion, export, or tagging.
3. **File search:** Full-text search across file content and paths with highlighting.
4. **Recent files:** Quick access list of last 10 edited files.
5. **Favorites/bookmarks:** Pin frequently accessed files to top of list.
6. **Folder view:** Tree-based navigation for nested directory structures.
7. **File metadata:** Show file size, word count, character count, line count.

### Navigation and Discovery

8. **Advanced filtering:** Filter files by date range, size, file extension, conflict status.
9. **Sorting options:** Sort by name, size, modified date (ascending/descending).
10. **Breadcrumb navigation:** Show current file path with clickable segments for parent folders.
11. **Keyboard shortcuts:** Quick file switching (Cmd+P), new file (Cmd+N), save (Cmd+S).

### Editing Experience

12. **Syntax highlighting:** Code highlighting for common languages (JS, TS, Python, etc.).
13. **Markdown preview:** Live preview pane for Markdown files.
14. **Line numbers:** Optional line numbers in editor gutter.
15. **Word wrap toggle:** User preference for soft wrap vs horizontal scroll.
16. **Font size control:** Zoom in/out or font size picker.
17. **Multiple open files:** Tab interface for switching between multiple open editors.
18. **Unsaved changes warning:** Prompt before navigating away from dirty file.
19. **Vim/Emacs keybindings:** Optional modal editing modes.

### Conflict Resolution

20. **Side-by-side diff:** Show local draft vs remote content in split view with line-by-line diff.
21. **Three-way merge UI:** Manual merge editor for selecting chunks from each version.
22. **Conflict history:** View past conflicts for a file with timestamps.
23. **Auto-merge strategies:** Optional policies (prefer local, prefer remote, keep both).

### Offline and Sync

24. **Offline indicator:** Banner showing online/offline status and last sync time.
25. **Service worker:** Cache app shell and assets for fully offline-capable PWA.
26. **Sync status per file:** Show sync state (synced, syncing, conflict, error) in file list.
27. **Manual sync trigger:** Button to force immediate sync cycle.
28. **Sync queue visibility:** Show pending changes waiting to sync when offline.

### Performance

29. **Virtual scrolling:** Render only visible file list items for >1000 files.
30. **Editor performance:** Use CodeMirror or Monaco for better performance with large files.
31. **Query optimization:** Index Evolu database for faster file list queries.
32. **Lazy loading:** Load file content only when opened, not on list render.

### Settings and Customization

33. **Theme customization:** Color picker for accent colors, background tones.
34. **Editor preferences:** Tab size, indent type (spaces/tabs), auto-save interval.
35. **File ignore patterns:** User-configurable patterns to hide files from PWA list.
36. **Import/export settings:** Backup and restore PWA preferences.

### Collaboration

37. **Owner attribution:** Show which owner last edited each file in file list.
38. **Edit history:** Timeline of changes with owner and timestamp.
39. **Presence indicators:** Show which files other owners are currently editing (if multi-user).

### Accessibility

40. **Screen reader support:** Proper ARIA labels, semantic HTML, keyboard navigation.
41. **High contrast mode:** Dedicated theme with WCAG AAA contrast ratios.
42. **Keyboard-only workflow:** All actions accessible without mouse.
43. **Focus management:** Logical focus order, visible focus indicators.

### Documentation and Help

44. **In-app help:** Contextual tooltips, onboarding tour for first-time users.
45. **Keyboard shortcut reference:** Modal showing all available shortcuts.
46. **Conflict resolution guide:** Step-by-step instructions for handling conflicts.

### Testing and Quality

47. **E2E test suite:** Playwright tests for all user workflows.
48. **Visual regression tests:** Screenshot comparison to catch UI regressions.
49. **Accessibility audit:** Automated and manual WCAG compliance testing.
50. **Performance benchmarks:** Track bundle size, time-to-interactive, largest contentful paint.
