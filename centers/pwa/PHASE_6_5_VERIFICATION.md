# Phase 6.5 End-to-End Verification

This protocol verifies that the PWA interaction loop, CLI change capture and state materialization, and
conflict policy work together without boundary violations.

## Automated Preflight

Run:

```bash
bash centers/pwa/tests/phase-6-5-preflight.sh
```

Expected:

- `bun run typecheck` passes.
- PWA build succeeds.
- CLI directional invariants test passes.
- CLI conflict artifact callback test passes.

## Manual End-to-End Matrix

Use two terminals and one browser session.

### 1) PWA edit -> Evolu -> CLI -> filesystem

1. Start CLI sync in `centers/cli`.
2. Start PWA dev server in `centers/pwa`.
3. Open a file in PWA, edit content, click `save`.
4. Confirm filesystem file in watched directory updates.

Success condition: edited content is materialized to disk via CLI only.

### 2) Filesystem edit -> CLI -> Evolu -> PWA refresh

1. Edit the same file directly on disk.
2. Wait for CLI capture loop to process change.
3. Confirm PWA file content updates from subscription.

Success condition: browser view reflects filesystem edit after loop propagation.

### 3) Dirty-draft conflict -> explicit resolution path

1. In PWA, open file and make unsaved changes (dirty draft).
2. Modify the same file from another source so remote `contentHash` changes.
3. Confirm PWA shows `conflict detected` banner and disables normal save.
4. Click `save draft as conflict artifact`.
5. Confirm artifact file appears in list with `.conflict-<owner>-<timestamp>`.

Alternative path:

1. Trigger conflict again.
2. Click `replace draft with remote`.
3. Confirm draft resets to remote content and conflict clears.

Success condition: no silent overwrite; resolution is explicit and deterministic.

### 4) Mnemonic restore -> expected rows visible after sync

1. Open `settings` page.
2. Restore from a known mnemonic with existing file rows.
3. Return to `files` page and confirm expected rows appear.

Success condition: owner restore changes visible dataset and remains Evolu-only.

## Current Run Snapshot (2026-03-04)

- Automated preflight: pass.
- Manual matrix: pass (verified in active browser+CLI session).
