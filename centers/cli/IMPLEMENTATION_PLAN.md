# CLI Implementation Plan — Local-First File Sync with Evolu

This plan describes a step-by-step implementation of the CLI sync system. Each phase builds on the previous one so behavior stays deterministic and conflict-safe.

---

## Phase 0 — Foundations (Single Device, No Replication)

Goal: Filesystem <-> Evolu mirror works locally.

### 0.1 Define Evolu Schema

```ts
File {
  path: string        // unique
  content: string
  contentHash: string
  updatedAt: number
  ownerId: string     // from Evolu
}
```

- `path` is primary identity
- `contentHash = hash(content)`
- No baseHash or shadow metadata

### 0.2 Build Loop A — Filesystem -> Evolu

CLI responsibilities:

1. Watch workspace directory
2. On file change:
   - Read content
   - Compute hash
   - Compare to stored hash in Evolu
   - If different, update row

### 0.3 Add `lastAppliedHash[path]`

Local CLI-only state:

```ts
Map<string, string>
```

Purpose: prevent write-back of identical content.

**Storage:**
- Persist to `~/.txtatelier/state.json` (or workspace-local `.txtatelier/state.json`)
- JSON format: `{ "lastAppliedHash": { "path/to/file.md": "hash123..." } }`
- Load on startup, save after each update
- If lost/corrupted: treat as empty map, reconciliation handles recovery

---

## Phase 1 — Add Loop B (Single Device)

Goal: Evolu changes apply back to filesystem safely.

1. Compare incoming row `contentHash` with disk hash.
2. If identical, ignore.
3. If different:
   - Write file
   - Update `lastAppliedHash[path]`

Check `row.ownerId === myOwnerId` to avoid echo loops.

---

## Phase 2 — Enable Multi-Device Replication

- Turn on Evolu sync between devices.
- Loop A updates Evolu, Loop B applies remote changes to disk.
- Basic file replication achieved.

---

## Phase 3 — Add Conflict Detection

Conflict condition on Loop B:

1. Read local disk file.
2. Compare hash with `lastAppliedHash[path]` and remote `contentHash`.
3. If conflict, create conflict file:

```
<filename>.conflict-<ownerId>-<timestamp>.md
```

- Original file untouched.
- Conflict files sync like normal files.

---

## Phase 4 — Deletion Handling

### 4.1 File Deletion

- Loop A: Delete file -> remove Evolu row (soft delete with `isDeleted` flag).
- Loop B: Remote delete -> remove file if `lastAppliedHash[path]` matches current disk hash, else create conflict file with deletion metadata.

### 4.2 Directory Deletion

- Directories are not tracked as separate entities.
- Deleting all files in a directory effectively deletes the directory.
- Empty directories are not synced (filesystem-only concern).

**Deletion conflict format:**
```
<filename>.conflict-<ownerId>-<timestamp>-deleted.md
```

Content: Original file content that would have been deleted.

---

## Phase 5 — Stability Hardening

### 5.1 Startup Reconciliation

On CLI startup:

1. Scan disk for all files (respecting ignore patterns).
2. Load all non-deleted Evolu rows.
3. Reconcile:
   - **Disk only:** Insert to Evolu with current hash.
   - **Evolu only:** Write to disk, update `lastAppliedHash`.
   - **Both exist, hashes match:** No action.
   - **Both exist, hashes differ:**
     - If `lastAppliedHash` missing: treat disk as canonical, update Evolu.
     - If `lastAppliedHash` matches disk: remote changed, apply from Evolu.
     - If `lastAppliedHash` matches neither: conflict, create conflict file.

**Performance:** Process files sequentially on startup. For large workspaces (>1000 files), log progress every 100 files.

### 5.2 Write Debounce + Atomic Writes

**Debouncing:**
- Default: 100ms per file path.
- Configurable via environment variable `TXTATELIER_DEBOUNCE_MS`.
- Use per-path debounce timers to allow parallel processing of different files.

**Atomic writes (Loop B):**
1. Write content to temp file: `<target>.tmp-<randomId>`.
2. Temp location: same directory as target file.
3. On success: rename temp to target (atomic on POSIX, near-atomic on Windows).
4. On failure: log error, leave temp file, retry on next sync cycle.
5. Cleanup stale temps (`.tmp-*` older than 1 hour) on startup.

### 5.3 Ignore Patterns

Files to ignore (never sync):

- Temp files: `*.tmp-*`, `*~`, `*.swp`, `*.swo`
- System files: `.DS_Store`, `Thumbs.db`, `desktop.ini`
- Hidden files: `.*` (except `.txtatelier/` if workspace-local)
- State directory: `.txtatelier/`
- Node/build artifacts: `node_modules/`, `dist/`, `build/`, `.next/`, `.cache/`

**Configuration:**
- Default ignore list hardcoded.
- Optional: `.txtatelier/ignore` file (gitignore-style syntax) for user overrides.
- Use glob patterns for matching.

**File type filtering:**
- Text files only (UTF-8 content).
- Detect binary files by attempting UTF-8 decode; skip if fails.
- Log skipped binary files at debug level.

---

## Phase 6 — PWA Integration Boundary

- PWA reads/writes only to Evolu.
- CLI handles disk synchronization.

---

## Phase 7 — Edge Case Testing

Test scenarios with expected outcomes:

### 7.1 Concurrent Edit Conflict
- **Setup:** Device A and B both offline, edit `notes.md`.
- **Expected:** Device A comes online, syncs. Device B comes online, detects conflict, creates `notes.conflict-<B-ownerId>-<timestamp>.md`.
- **Verify:** Original file untouched, conflict file exists, both sync to all devices.

### 7.2 Edit vs Delete Conflict
- **Setup:** Device A edits `draft.md`, Device B deletes it (both offline).
- **Expected:** Device that syncs second creates `draft.conflict-<ownerId>-<timestamp>-deleted.md` with preserved content.
- **Verify:** No data loss, explicit conflict artifact.

### 7.3 Three-Device Simultaneous Edits
- **Setup:** Devices A, B, C all edit `shared.md` offline with different content.
- **Expected:** First to sync wins original filename. Second and third create conflict files with respective ownerIds.
- **Verify:** Three files total, no infinite loops, all content preserved.

### 7.4 Rapid Local Edits
- **Setup:** Edit same file 10 times within 1 second locally.
- **Expected:** Debouncing results in single Evolu update with final content.
- **Verify:** No duplicate updates, correct final state.

### 7.5 Large File Handling
- **Setup:** Create 5MB text file.
- **Expected:** Syncs successfully or fails with clear error if over limit.
- **Verify:** No crash, explicit feedback.

**Automation:** Tests run via `bun test` with mock filesystem and Evolu instances.

---

## Phase 0.4 — Initialization Flow

First-time setup when running CLI in a new workspace:

1. Check for existing `.txtatelier/state.json` or `~/.txtatelier/state.json`.
2. If not found, prompt user:
   ```
   Initialize txtatelier in /path/to/workspace? (y/n)
   ```
3. If yes:
   - Create state directory.
   - Initialize Evolu instance (generates owner/mnemonic).
   - Display mnemonic with warning to save securely.
   - Create empty `lastAppliedHash` map.
   - Run initial reconciliation (Phase 5.1).

4. If Evolu already initialized (mnemonic exists): restore from mnemonic.

**Configuration:**
- Workspace path: Current directory or via `--workspace` flag.
- State location: Workspace-local `.txtatelier/` preferred over global `~/.txtatelier/`.

---

## Phase 8 — Observability

Add CLI commands for introspection and debugging.

### 8.1 `mk status`

Show sync system health:

```
Workspace: /Users/alice/notes
Owner ID: abc123...
Tracked files: 42
Conflicts: 2
Last sync: 3 seconds ago
Evolu status: connected
```

**Flags:**
- `--json`: Output as JSON for scripting.

### 8.2 `mk conflicts`

List all conflict files with metadata:

```
notes.conflict-xyz789-1234567890.md
  Original: notes.md
  Created: 2026-03-14 10:23:45
  Remote owner: xyz789

draft.conflict-abc123-1234567891-deleted.md
  Type: deletion conflict
  Created: 2026-03-14 10:24:12
```

**Flags:**
- `--resolve <path>`: Mark conflict as resolved (removes from list, preserves file).

### 8.3 `mk sync`

Manually trigger sync cycles:

```bash
mk sync            # Run both Loop A and Loop B once
mk sync --from-fs  # Loop A only
mk sync --from-db  # Loop B only
```

Output: Summary of files updated in each direction.

### 8.4 `mk doctor`

Diagnose common issues:

- Check Evolu connection.
- Verify state file integrity.
- Scan for orphaned temp files.
- Compare disk vs Evolu counts.
- Report ignored files count.

Output: Pass/fail with actionable suggestions.

**Example:**
```
✓ Evolu connected
✓ State file valid
✗ Found 3 orphaned temp files
  → Run 'mk doctor --clean' to remove

✓ Disk files: 42, Evolu rows: 42
```

**Flags:**
- `--clean`: Auto-fix safe issues (remove stale temps, etc.).

---

## Summary

At the end of this plan, the CLI system is:

- Deterministic
- Explicit about conflicts
- Simple and observable
- Safe for multi-device edits
- Evolvable for future enhancements

---

## Future Improvements

The following enhancements are deferred beyond the current implementation scope:

### Performance and Scale

1. **File size limits:** Define and enforce maximum file size (e.g., 10MB) with clear error messages.
2. **File count limits:** Test and document performance characteristics with 1K, 10K, 100K files.
3. **Incremental hashing:** For large files, consider streaming hash computation to reduce memory footprint.
4. **Parallel reconciliation:** Speed up startup by processing files concurrently.

### Advanced File Operations

5. **Rename/move detection:** Track file moves to avoid treating them as delete + create (requires content-based identity or inode tracking).
6. **Case-sensitivity handling:** Explicitly handle case-only renames on case-insensitive filesystems (macOS, Windows).
7. **Directory operations:** First-class directory tracking with metadata (creation time, etc.).
8. **Symlink handling:** Define behavior for symbolic links (follow, ignore, or sync as special file type).

### Conflict Resolution Workflows

9. **Conflict resolution UI:** Interactive CLI tool to review and resolve conflicts (three-way diff, accept theirs/mine/both).
10. **Auto-resolution strategies:** Optional policies (last-write-wins, keep-both) configurable per-workspace.
11. **Conflict lifecycle:** Mark conflicts as resolved, archive old conflicts, prevent re-syncing resolved conflicts.
12. **Recursive conflict prevention:** Prevent conflict files themselves from conflicting (ignore `*.conflict-*` in conflict detection).

### Error Handling and Resilience

13. **Retry logic:** Automatic retry with exponential backoff for transient errors (network, filesystem locks).
14. **Permission errors:** Graceful handling of read-only files, permission denied, etc.
15. **Corrupted state recovery:** Detect and auto-repair corrupted `state.json` files.
16. **Evolu sync failure handling:** Queue changes locally when Evolu sync is down, replay when reconnected.

### Logging and Diagnostics

17. **Structured logging:** JSON logs with levels (debug, info, warn, error) for machine parsing.
18. **Log rotation:** Automatic rotation and retention policy for log files.
19. **Privacy mode:** Option to redact file paths and content from logs.
20. **Performance metrics:** Track sync latency, file processing time, memory usage over time.

### Security

21. **Content encryption:** Encrypt file content at rest in Evolu (E2EE).
22. **Access control:** Multi-user workspaces with role-based permissions.
23. **Sensitive file detection:** Warn when syncing files with potential secrets (`.env`, `credentials.json`).

### Testing and Quality

24. **Property-based testing:** Use generative tests for sync logic (QuickCheck-style).
25. **Chaos testing:** Simulate network partitions, crashes, filesystem failures.
26. **Benchmark suite:** Track performance regressions across versions.
27. **Cross-platform CI:** Test on Linux, macOS, Windows in CI pipeline.

### Documentation and Usability

28. **User guide:** Step-by-step tutorials for common workflows.
29. **Troubleshooting runbook:** Common issues and solutions.
30. **API documentation:** JSDoc for all exported functions and types.
31. **Migration tools:** Scripts to migrate from other sync systems (Syncthing, Dropbox, etc.).

### Backwards Compatibility

32. **Schema versioning:** Version Evolu schema, provide migration scripts for breaking changes.
33. **State file versioning:** Version `state.json` format, auto-migrate on load.
34. **Compatibility matrix:** Document which CLI versions work with which Evolu schema versions.
