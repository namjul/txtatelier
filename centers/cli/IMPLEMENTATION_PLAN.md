# CLI Implementation Plan — Local-First File Sync with Evolu

This plan describes a step-by-step implementation of the CLI sync system. Each phase builds on the previous one so behavior stays deterministic and conflict-safe.

---

## Phase 0 — Foundations (Single Device, No Replication)

Goal: Filesystem <-> Evolu mirror works locally.

### 0.1 Define Evolu Schema

```ts
file {
  path: string        // unique
  content: string
  contentHash: string
  // + createdAt, updatedAt, isDeleted, ownerId (auto-added by Evolu)
}

_syncState {
  path: string
  lastAppliedHash: string
}

_historyCursor {
  lastTimestamp: TimestampBytes | null
}
```

- `path` is primary identity
- `contentHash = hash(content)` using xxHash64 (Bun.hash)
- `_syncState` and `_historyCursor` are local-only (underscore prefix prevents sync)

### 0.2 Build change-capture — Filesystem -> Evolu

CLI responsibilities:

1. Watch workspace directory
2. On file change:
   - Read content
   - Compute hash
   - Compare to stored hash in Evolu
   - If different, update row

**Watching mechanism:**
- Uses chokidar with `ignoreInitial: true`
- Debounce per-path: 100ms default
- Concurrency limit: 10 parallel file operations

### 0.3 Add `lastAppliedHash[path]`

Local CLI-only state:

```ts
Map<string, string>
```

Purpose: prevent write-back of identical content.

**Storage:**
- Stored in `_syncState` table (local-only, not synced across devices)
- Each row: `path`, `lastAppliedHash`
- Updated after each state-materialization write

---

## Phase 1 — Add state-materialization (Single Device)

Goal: Evolu changes apply back to filesystem safely.

**Mechanism:**
- Subscribe to `file` table changes with 500ms debounce
- Query `evolu_history` for incremental changes since `_historyCursor.lastTimestamp`
- Process only rows with content or isDeleted column changes
- Update cursor after processing batch

**Logic per file:**
1. Check if `lastAppliedHash === contentHash` (skip if already processed).
2. Compare incoming row `contentHash` with disk hash.
3. If identical, update `lastAppliedHash` and skip write.
4. If different and no conflict:
   - Write file atomically
   - Update `lastAppliedHash[path]` in `_syncState` table
5. If conflict detected: create conflict file, update `lastAppliedHash`

---

## Phase 2 — Enable Multi-Device Replication

- Turn on Evolu sync between devices.
- change-capture updates Evolu, state-materialization applies remote changes to disk.
- Basic file replication achieved.

---

## Phase 3 — Add Conflict Detection

Conflict condition on state-materialization:

**3-way merge conflict detection:**
1. Read local disk file hash (LOCAL).
2. Load `lastAppliedHash` from `_syncState` (BASE).
3. Compare with remote `contentHash` (REMOTE).
4. Conflict if: `diskHash !== lastAppliedHash` AND `remoteHash !== lastAppliedHash`

**Conflict file creation:**
```
<filename>.conflict-<ownerId>-<timestamp>.<ext>
```

- Original file untouched.
- Conflict file contains remote content.
- Conflict files sync like normal files.
- Format: `{base}.conflict-{ownerId}-{timestamp}{ext}`

---

## Phase 4 — Deletion Handling

### 4.1 File Deletion

- change-capture: Delete file -> remove Evolu row (soft delete with `isDeleted` flag).
- state-materialization: Remote delete -> remove file if `lastAppliedHash[path]` matches current disk hash, else create conflict file with deletion metadata.

### 4.2 Directory Deletion

- Directories are not tracked as separate entities.
- Deleting all files in a directory effectively deletes the directory.
- Empty directories are not synced (filesystem-only concern).

**Deletion conflict:**
- If remote deletes file but disk hash differs from `lastAppliedHash`, create conflict file.
- Conflict file contains local (disk) content that would have been lost.
- Owner ID: `"remote-delete"` to indicate deletion conflict.
- Format: `{base}.conflict-remote-delete-{timestamp}{ext}`

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

**Implementation:**
- Two-phase reconciliation: filesystem-first, then Evolu-only rows
- Uses `captureChange` for disk files
- Uses `applyRemoteDeletionToFilesystem` for Evolu-only deleted rows

### 5.2 Write Debounce + Atomic Writes

**Debouncing:**
- Default: 100ms per file path (hardcoded in watch.ts).
- Per-path debounce timers to allow parallel processing of different files.
- Chokidar also has `awaitWriteFinish` with 100ms stability threshold.

**Atomic writes (state-materialization):**
1. Write content to temp file: `<target>.tmp-<timestamp>-<randomId>`.
2. Temp location: same directory as target file.
3. On success: rename temp to target (atomic on POSIX, near-atomic on Windows).
4. On failure: log error, leave temp file, retry on next sync cycle.
5. Cleanup stale temps (`.tmp-*` older than 1 hour) on startup.
6. Ensure parent directory exists before write.

### 5.3 Ignore Patterns

**Current implementation:**
- Temp files: `.tmp-*`, `.*tmp-*`
- System files: `.DS_Store`, `Thumbs.db`, `desktop.ini`
- Hidden files: `.*` (all dotfiles and dotdirectories)
- Implemented in `ignore.ts` using picomatch: `isIgnoredRelativePath()`

**Planned (not yet implemented):**
- Node/build artifacts: `node_modules/`, `dist/`, `build/`, `.next/`, `.cache/`
- Optional: `.txtatelier/ignore` file (gitignore-style syntax)

**File type filtering:**
- Currently syncs all files (no binary detection)
- Future: detect binary files and skip with warning

### 5.4 File Size Limits

**Implementation:**
- Maximum file size: 10MB (10,485,760 bytes, binary calculation)
- Checked in `change-capture.ts` after `stat()`, before content read
- Files over limit: logged as warning, not synced
- Uses binary units (1024-based): 1KB = 1024 bytes, 1MB = 1024KB

**Error handling:**
- Error type: `FileTooLarge`
- Logged with file path and size in human-readable format
- Other files continue syncing normally
- No retry - file must shrink below limit to sync

**Example error message:**
```
[capture] File too large: /path/to/huge.bin (15.23MB > 10.00MB) - skipped
```

**Rationale:**
- Prevents syncing large binary files accidentally
- Protects against memory/performance issues
- Keeps sync fast and responsive
- SQLite practical limit: ~1GB per column, but 10MB is safer for multi-device sync

**Future enhancements:**
- Configurable limit via CLI flag or config file
- Large file support with chunking/external storage
- Per-directory size limits

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

1. Check for existing Evolu database.
2. If not found, prompt user:
   ```
   Initialize txtatelier in /path/to/workspace? (y/n)
   ```
3. If yes:
   - Initialize Evolu instance (generates owner/mnemonic).
   - Display mnemonic with warning to save securely.
   - Initialize `_syncState` and `_historyCursor` tables.
   - Run initial reconciliation (Phase 5.1).

4. If Evolu already initialized (mnemonic exists): restore from mnemonic.

**Configuration:**
- Workspace path: Current directory or via `--workspace` flag.

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
mk sync            # Run both change-capture and state-materialization once
mk sync --from-fs  # change-capture only
mk sync --from-db  # state-materialization only
```

Output: Summary of files updated in each direction.

### 8.4 `mk doctor`

Diagnose common issues:

- Check Evolu connection.
- Verify _syncState and _historyCursor table integrity.
- Scan for orphaned temp files.
- Compare disk vs Evolu counts.
- Report ignored files count.

Output: Pass/fail with actionable suggestions.

**Example:**
```
✓ Evolu connected
✓ _syncState table valid
✓ _historyCursor table valid
✗ Found 3 orphaned temp files
  → Run 'mk doctor --clean' to remove

✓ Disk files: 42, Evolu rows: 42
```

**Flags:**
- `--clean`: Auto-fix safe issues (remove stale temps, etc.).

---

## Summary

**Implementation status:**

- ✅ Phase 0: Foundations complete (schema, change-capture, _syncState)
- ✅ Phase 1: state-materialization complete (incremental history processing)
- ✅ Phase 2: Multi-device replication works
- ✅ Phase 3: Conflict detection implemented (3-way merge)
- ✅ Phase 4: Deletion handling (file and deletion conflicts)
- ✅ Phase 5.1: Startup reconciliation implemented
- ✅ Phase 5.2: Atomic writes and debouncing implemented
- ✅ Phase 5.3: Ignore patterns (system files, hidden files, temp files via picomatch)
- ✅ Phase 5.4: File size limits (10MB max, binary units)
- ❌ Phase 6: PWA integration (not started)
- ❌ Phase 7: Edge case testing (not started)
- ❌ Phase 8: Observability commands (not started)

**Current system characteristics:**

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
15. **Corrupted state recovery:** Detect and auto-repair corrupted `_syncState` or `_historyCursor` tables.
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
33. **Database versioning:** Version local-only table schemas (_syncState, _historyCursor), auto-migrate on load.
34. **Compatibility matrix:** Document which CLI versions work with which Evolu schema versions.

### Missing from Plan (Implemented but Undocumented)

35. **Full ignore pattern system:** Expand `ignore.ts` beyond `.tmp-*` to match Phase 5.3 spec.
36. **Binary file detection:** Add UTF-8 validation to skip binary files as specified.
37. **Concurrency control:** Document 10-file concurrency limit in watch.ts.
38. **Echo processing:** Document accepted redundancy (subscription fires for own edits, hash check prevents writes).
39. **History cursor initialization:** Document cursor bootstrap to latest timestamp on first run.
