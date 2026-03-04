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
2. CLI Loop B materializes Evolu changes to filesystem.
3. Filesystem edits are captured by CLI Loop A back into Evolu.
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
- Structural clarity through alignment and spacing instead of cards, borders, or shadows.
- Header split into identity block (left) and compact action list (right), then long-form content below.

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

- Query non-deleted files from Evolu.
- Provide reliable selection and open flows for file content.

### 6.2 Write Workflows

- Edit and save file content to Evolu.
- Show save state (`saving`, `saved`, `error`).

### 6.3 Conflict Guard

- Detect dirty-draft vs remote-update collisions via `baseFingerprint`.
- Block blind overwrite and require explicit action.

### 6.4 Conflict Artifact Flow

- Implement "save as conflict artifact" action.
- Verify artifact appears as normal file in list and sync pipeline.

### 6.5 End-to-End Verification

- PWA edit -> Evolu -> CLI -> filesystem.
- Filesystem edit -> CLI -> Evolu -> PWA refresh.
- Dirty-draft conflict -> explicit resolution path.
- Restore from mnemonic -> expected rows visible after sync.
- Verification protocol and preflight script live in:
  - `centers/pwa/PHASE_6_5_VERIFICATION.md`
  - `centers/pwa/tests/phase-6-5-preflight.sh`

### 6.6 Mnemonic Settings and Owner Actions

- Add Settings page and navigation from file editing surface.
- Implement show/hide mnemonic.
- Implement restore flow with mnemonic validation and clear typed errors.
- Implement reset flow with explicit confirmation guard.
- Implement local database export flow.

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
