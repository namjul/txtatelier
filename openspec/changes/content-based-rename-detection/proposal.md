## Why

File renames across devices currently create unnecessary conflicts, waste bandwidth (full content re-upload), and lose file identity/history. Research shows that while Obsidian, Logseq, and Dendron all use delete + create, they control renames through their apps. Since txtatelier is filesystem-canonical and supports external renames (git, file managers), implementing content-based rename detection provides a competitive advantage: efficient multi-device rename sync without requiring app-controlled operations.

## What Changes

- Add `_recentDeletions` local-only table to track deleted files by contentHash
- Implement rename detection by matching new file hashes against recent deletions
- Update Evolu row path in-place instead of delete + create when rename detected
- Add configurable time window for rename matching (default 5 seconds)
- Implement garbage collection for old deletion records
- Add observability: log detected renames, expose in `mk status` output
- Update conflict handling to distinguish true deletions from missed renames

## Capabilities

### New Capabilities
- `rename-detection`: Track and detect file renames using content-based identity (contentHash matching within time window)
- `rename-observability`: Log and report detected renames for debugging and user awareness

### Modified Capabilities
- `file-sync`: Change capture now detects renames and updates existing Evolu rows instead of delete + create (behavioral change in how renames are synced)
- `conflict-detection`: Remote deletion conflicts distinguish between true deletions and potential missed renames (detection logic enhancement)

## Impact

**Affected code:**
- `centers/cli/src/file-sync/schema.ts` - Add `_recentDeletions` table definition
- `centers/cli/src/file-sync/sync/change-capture.ts` - Add rename detection logic
- `centers/cli/src/file-sync/sync/change-capture-plan.ts` - Add `UPDATE_PATH` action type
- `centers/cli/src/file-sync/sync/actions.ts` - Define rename action types
- `centers/cli/src/file-sync/sync/executor.ts` - Implement path update execution
- `centers/cli/src/file-sync/sync/startup-reconciliation.ts` - Integrate rename detection at startup
- `centers/cli/src/file-sync/state.ts` - Add functions to query/manage recent deletions

**Schema changes:**
- **BREAKING**: New `_recentDeletions` local-only table (migration required)
- Existing Evolu `file` table unchanged (rename updates path field on existing row)

**Performance:**
- Improved: No longer re-upload full file content on rename (bandwidth savings)
- Improved: Maintains file identity across renames (history preserved)
- New cost: Query recent deletions on every file add (small overhead)
- New cost: Periodic garbage collection (every 60s)

**User experience:**
- Fewer false deletion conflicts when renaming files
- Transparent rename handling (works with git, file managers, external editors)
- Observability through logs and `mk status` command
- Competitive advantage over Obsidian/Logseq/Dendron (no app lock-in)

**Risks:**
- False positives: Two identical files deleted + created looks like rename
- Time window tuning: Too short = missed renames, too long = false matches
- Edge case: Rename + edit simultaneously (hash changes, breaks detection)
