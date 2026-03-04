# PWA Implementation Plan — Web Interaction Surface

This plan defines Phase 6 implementation for the PWA as txtatelier's web interaction surface. It is correctness-first and preserves the core system contract: filesystem is canonical, and the CLI is the only bridge to disk.

---

## Scope

- Browser-based file interaction workflows (discover, open, edit, resolve conflicts).
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

---

## Tech Stack

- Framework: SolidJS
- Data/Replication: Evolu
- UI behavior: ZagJS (when interaction complexity requires it)
- Styling: Tailwind CSS + daisyUI
- Tooling/runtime: Bun

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

---

## Acceptance Criteria

- PWA presents a usable browser interaction loop over Evolu-backed file state.
- Editing and saving updates Evolu rows.
- No filesystem API usage in PWA code.
- Dirty-draft remote collisions never silently overwrite local draft.
- Conflict artifacts can be created from PWA and sync through CLI.
- Existing CLI regression suite remains green.

---

## Test Matrix (Phase 6)

1. Create new file from PWA and confirm filesystem materialization.
2. Edit existing file from PWA and confirm disk update.
3. Edit file on disk and confirm PWA refreshes through Evolu.
4. Trigger dirty-draft conflict and confirm resolution banner appears.
5. Use "save as conflict artifact" and confirm file naming and propagation.
