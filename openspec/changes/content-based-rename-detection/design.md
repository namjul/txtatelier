## Context

**Current behavior:**
File renames are treated as delete + create operations:
- Old path: Marked as deleted in Evolu (`isDeleted: true`)
- New path: New row inserted with new ID
- Full content re-uploaded to Evolu
- Cross-device: Appears as deletion + new file, causing false "remote-delete" conflicts

**Research findings:**
- Obsidian, Logseq, Dendron all use delete + create at sync layer
- They control renames through app UI and update links before syncing
- txtatelier is filesystem-canonical: renames happen externally (git, file managers)
- No competitors implement content-based rename detection across devices

**Architecture constraints:**
- "No ancestry tracking" (PROJECT.md) - but content-based identity is simpler than full ancestry
- Filesystem is canonical - must detect renames from external tools
- Simple state tracking - avoid complex CRDT merge logic
- Multi-device sync required - solution must work across devices

## Goals / Non-Goals

**Goals:**
- Detect file renames using content-based identity (contentHash matching)
- Update Evolu row path in-place instead of delete + create
- Work with external rename operations (git mv, file manager, etc.)
- Reduce bandwidth (no content re-upload on rename)
- Maintain file identity across renames (same Evolu row ID)
- Provide observability (logs, status command)
- Reduce false deletion conflicts

**Non-Goals:**
- Inode tracking (device-local, doesn't help multi-device)
- Detect renames when content changes simultaneously (hash differs)
- Guarantee 100% rename detection (false negatives acceptable)
- Real-time rename detection (time window approach is acceptable)
- Directory rename detection (handle per-file)
- Link/reference updates (future PWA feature with wikilinks)

## Decisions

### **Decision 1: Content-Based Identity via contentHash**

**Approach:**
Match new files against recently deleted files by contentHash within a time window.

**Schema addition:**
```typescript
_recentDeletions: {
  id: RecentDeletionId,
  path: NonEmptyString1000,        // Original path
  contentHash: NonEmptyString100,   // Hash at deletion time
  deletedAt: number,                // Unix timestamp (ms)
  evolFileId: FileId,               // ID of deleted row
}
```

**Algorithm:**
```typescript
// On file deletion:
1. Mark file as deleted in Evolu (existing behavior)
2. Insert into _recentDeletions with current timestamp

// On file creation:
1. Compute contentHash of new file
2. Query _recentDeletions for matching hash within time window (5s)
3. If match found:
   - Update existing Evolu row: change path, clear isDeleted
   - Delete record from _recentDeletions
   - Log rename: "Detected rename: oldPath → newPath"
4. If no match:
   - Insert as new file (existing behavior)
```

**Rationale:**
- Works multi-device (hash syncs reliably)
- No platform-specific code
- Detects moves across directories
- Simple to implement and test
- Foundation for future enhancements

**Alternatives considered:**

**Option B: Inode tracking**
- ❌ Device-local only (each device has different inodes)
- ❌ Doesn't help multi-device scenario
- ❌ Platform-specific (Windows file IDs vs Unix inodes)
- ❌ Breaks on cross-filesystem moves

**Option C: No rename detection**
- ✅ Simplest (current behavior)
- ❌ User confusion with false deletion conflicts
- ❌ Bandwidth waste on renames
- ❌ Missed competitive advantage

### **Decision 2: Time Window of 5 Seconds**

Match deletions within 5 seconds of new file creation.

**Rationale:**
- Fast enough: Most renames complete within 1s
- Safe enough: Reduces false positives (two identical files)
- Forgiving: Allows for slow disk I/O or network latency
- Tunable: Can adjust based on field data

**Trade-offs:**
- Too short: Miss genuine renames (false negatives)
- Too long: Match unrelated files (false positives)

**Future:** Make configurable via CLI flag or config file

### **Decision 3: Local-Only `_recentDeletions` Table**

Use underscore prefix to prevent sync across devices.

**Rationale:**
- Deletion tracking is local concern (device's view of recent operations)
- No need to sync deletion history to other devices
- Reduces Evolu sync overhead
- Simpler conflict model (no cross-device deletion tracking)

**Alternative considered:** Sync deletions table
- ❌ Increased sync overhead
- ❌ Complex conflict model (what if devices disagree on deletions?)
- ❌ No clear benefit (each device detects renames locally)

### **Decision 4: Update Existing Row Path (Not Delete + Insert)**

When rename detected, update the `path` field on existing Evolu row.

**Implementation:**
```typescript
// New action type
type UpdatePathAction = {
  type: "UPDATE_PATH";
  evolFileId: FileId;
  newPath: string;
  oldPath: string;
};

// Executor
const executeUpdatePath = async (action: UpdatePathAction) => {
  await evolu.update("file", {
    id: action.evolFileId,
    path: action.newPath,
    updatedAt: new Date(),
  });
};
```

**Rationale:**
- Maintains file identity (same Evolu row ID)
- Preserves `createdAt`, `ownerId` (history intact)
- Simpler than managing deletion + insertion atomically
- Evolu handles update sync automatically

**Breaking change:** This changes sync behavior (Evolu history shows path update instead of delete + create)

### **Decision 5: Garbage Collection Every 60 Seconds**

Periodically clean old records from `_recentDeletions`.

**Strategy:**
```typescript
setInterval(() => {
  const cutoff = Date.now() - 10000; // 10 seconds ago
  evolu.delete("_recentDeletions", (row) => row.deletedAt < cutoff);
}, 60000); // Every 60 seconds
```

**Rationale:**
- 10-second retention (2x time window) ensures no false negatives
- 60-second cleanup frequency is low overhead
- Prevents unbounded growth of deletion tracking table

**Alternative considered:** Cleanup on every query
- ❌ Higher overhead (cleanup per file operation)
- ✅ Current approach: Amortized cost

### **Decision 6: Log Detected Renames at INFO Level**

```typescript
logger.info(`[rename] Detected: ${oldPath} → ${newPath}`);
```

**Rationale:**
- Helps users understand system behavior
- Foundation for `mk status` observability
- Non-invasive (no behavior changes, just logging)

**Future enhancement:** Add to `mk status` output:
```
Recent renames (last 5 minutes):
  notes.md → journal.md
  draft.txt → final.txt
```

### **Decision 7: False Positive Handling - Log Warning**

When two identical files are deleted + created (false rename):

```typescript
logger.warn(
  `[rename] Possible false positive: ${oldPath} → ${newPath} (identical content)`
);
```

**Rationale:**
- Users aware of ambiguous situations
- Can manually verify if needed
- Behavior still correct (updates path, preserves content)

**Trade-off:** Accepting false positives in rare cases (two identical files) to enable rename detection in common cases

## Risks / Trade-offs

### **Risk: False Positives (Two Identical Files)**

**Scenario:**
- User has `notes.md` and `backup.md` with identical content
- Deletes `notes.md`, creates `copy.md` (also identical)
- System thinks `notes.md` was renamed to `copy.md`
- `backup.md` unaffected (correct), but history confusing

**Mitigation:**
- Log warning for suspicious renames
- Time window (5s) reduces likelihood
- User can check logs if behavior seems wrong
- **Accepted:** Rare edge case, behavior is still safe (no data loss)

### **Risk: Rename + Edit Simultaneously**

**Scenario:**
- User renames file while editing content
- contentHash changes, breaks detection
- Falls back to delete + create behavior

**Mitigation:**
- Document as known limitation
- Most rename operations don't change content
- Graceful degradation (still works, just less efficient)

### **Risk: Time Window Tuning**

5 seconds may be too short for slow devices or network mounts.

**Mitigation:**
- Make configurable in future (CLI flag: `--rename-window 10`)
- Monitor false negatives via user reports
- Default (5s) is conservative based on typical rename latency

### **Risk: Cross-Device Timing**

Device A renames `notes.md` → `journal.md` at T=0. Device B syncs at T=6s (after time window).

**Result:** Device B doesn't detect rename locally (sees delete + create in Evolu).

**Mitigation:**
- Each device detects renames independently (best effort)
- Evolu sync shows path update (Device B sees update operation)
- Works correctly: Device B applies path update from Evolu
- **Not a bug:** Local detection is optimization, Evolu sync is source of truth

### **Trade-off: Schema Complexity**

Adding `_recentDeletions` table increases schema surface area.

**Accepted because:**
- Local-only (doesn't complicate sync)
- Well-defined lifetime (garbage collected)
- Significant user benefit (fewer conflicts, better UX)

### **Trade-off: Query Overhead**

Every file creation queries `_recentDeletions` table.

**Measurement needed:**
- Benchmark: 1000 file operations with/without rename detection
- Expected: <5ms per query (local SQLite, indexed by contentHash)
- Acceptable: <10% overhead on file sync operations

**If too slow:** Add flag to disable rename detection

## Migration Plan

**Schema migration:**
```typescript
// On CLI startup, check for _recentDeletions table
const hasTable = await evolu.loadQuery((db) =>
  db.selectFrom("_recentDeletions").selectAll()
);

if (!hasTable) {
  // Create table (Evolu handles this automatically from schema)
  logger.info("[migration] Created _recentDeletions table");
}
```

**Deployment:**
1. Add `_recentDeletions` to schema.ts
2. CLI auto-creates table on first run (Evolu handles migration)
3. No data migration needed (start with empty table)
4. Gradual rollout: Users get rename detection as they update CLI

**Rollback:**
1. Revert code changes
2. `_recentDeletions` table remains but unused
3. System falls back to delete + create behavior
4. No data corruption (table is local-only)

**Breaking changes:**
- Evolu sync history: Path updates instead of delete + create
- Observable in Evolu history viewer (if inspecting `evolu_history` table)
- Does NOT break sync compatibility (Evolu handles path updates)

**Testing strategy:**
1. Unit tests: Rename detection logic (match hash within window)
2. Integration tests: Multi-device rename scenarios
3. Performance tests: Measure query overhead on 1000 file operations
4. Edge case tests: False positives, time window edge, concurrent renames

## Open Questions

### 1. **Should we add a CLI flag to disable rename detection?**

**Use case:** Users experiencing false positives or performance issues

**Proposed:** `--no-rename-detection` flag (default: enabled)

**Decision:** Defer until field feedback shows need

### 2. **Should garbage collection be configurable?**

**Current:** Hardcoded 10-second retention, 60-second cleanup interval

**Alternative:** Config file settings

**Decision:** Defer until performance data shows need for tuning

### 3. **How to handle directory renames?**

**Current design:** Per-file detection (each file in directory detected independently)

**Alternative:** Detect batch renames (all files in `foo/*` → `bar/*`)

**Decision:** Out of scope for Phase 6. Could add in Phase 7+ if needed.

**Rationale:** Per-file is simpler, works correctly, just less efficient for large directory moves

### 4. **Should we expose rename detection in `mk status` command?**

**Proposed output:**
```
Recent renames (last 5 minutes):
  notes.md → journal.md (2 minutes ago)
  draft.txt → final.txt (4 minutes ago)
```

**Decision:** Yes, add in Phase 8 (Observability)

### 5. **What happens with case-only renames on macOS/Windows?**

**Scenario:** `Notes.md` → `notes.md` on case-insensitive filesystem

**Behavior:** 
- Filesystem sees as same file (inode unchanged)
- contentHash unchanged
- Chokidar may not emit events (same path)

**Research needed:** Test on macOS to determine actual behavior

**Mitigation if broken:** Path normalization layer (lowercase paths for comparison)
