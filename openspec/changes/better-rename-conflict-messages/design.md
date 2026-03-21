## Context

**Current state:**
Conflict files generated for remote deletions contain only the preserved file content with a filename like `notes.conflict-remote-delete-1234567890.md`. Users must infer why the conflict occurred.

**Problem:**
File renames across devices are treated as delete + create operations (industry standard approach used by Obsidian, Logseq, Dendron). This causes "remote-delete" conflicts when:
- Device A renames `notes.md` → `journal.md` offline
- Device B edits `notes.md` offline
- Both sync: Device B sees `notes.md` deleted remotely, creates conflict file

**User confusion:** "I just renamed it, why is there a deletion conflict?"

**Constraints:**
- Filesystem is canonical - users can rename files externally (git, file manager)
- No app-controlled rename operations (CLI just watches filesystem)
- No actual rename detection implemented yet (future Phase 6+ feature)
- Must work with current delete + create behavior

## Goals / Non-Goals

**Goals:**
- Reduce user confusion about rename-related conflicts through clear messaging
- Explain common scenarios that trigger "remote-delete" conflicts
- Provide actionable resolution steps in conflict file content
- Document rename behavior and best practices
- Maintain compatibility with existing conflict file handling

**Non-Goals:**
- Implement actual rename detection (content-based identity tracking - deferred to Phase 6+)
- Change when/how conflicts are created (behavioral changes)
- Add interactive conflict resolution UI
- Track file identity across renames

## Decisions

### **Decision 1: Embed Guidance in Conflict File Content**

Add markdown header to conflict file content explaining the situation.

**Format:**
```markdown
# Conflict: Remote Deletion

This file was deleted on another device while you had local changes.

**Common causes:**
- File was renamed on the other device
- File was intentionally deleted
- External tool (git, file manager) moved the file

**To resolve:**
1. Check if file was renamed - look for similar content elsewhere
2. If renamed: Copy your changes below to the new location, delete this conflict file
3. If truly deleted: Review changes below and decide whether to keep or discard
4. If unsure: Keep both files temporarily and investigate

**Your preserved changes:**
---
[original file content]
```

**Rationale:**
- Self-documenting conflict files
- No external docs required at resolution time
- Markdown format preserves readability
- Users can resolve without CLI commands

**Alternative considered:** External CLI command (`mk conflicts explain <file>`)
- **Rejected:** Requires users to discover and run command, less immediate

### **Decision 2: No Behavioral Changes**

Keep existing conflict detection and creation logic unchanged.

**Rationale:**
- Separation of concerns: messaging vs. detection logic
- Can improve messaging without risking regression in conflict handling
- Future rename detection (Phase 6+) can build on this foundation
- Tested and stable conflict creation remains intact

### **Decision 3: Add Optional Rename Suspicion Logging**

Log when suspected renames occur (delete + create within 5s window with same contentHash).

**Implementation:**
```typescript
// In state-materialization.ts or watch.ts
const suspectedRename = recentDeletions.find(
  del => del.contentHash === newFileHash && 
         Date.now() - del.timestamp < 5000
);

if (suspectedRename) {
  logger.info(`[sync] Possible rename detected: ${suspectedRename.path} → ${newPath}`);
}
```

**Output in logs:**
```
[sync] Possible rename detected: notes.md → journal.md
```

**Rationale:**
- Helps users understand what happened when debugging
- Foundation for future rename detection feature
- Non-invasive (logging only, no behavior changes)
- Can be added to `mk status` output later

**Alternative considered:** No logging
- **Rejected:** Missed opportunity for observability without implementation cost

### **Decision 4: Update AGENTS.md, Not Create User Docs Yet**

Add rename behavior section to AGENTS.md (for AI agents), but defer user-facing docs until PWA exists.

**Rationale:**
- Current users are developers who can read AGENTS.md
- Avoids premature documentation (might change with PWA UI)
- Focus on improving immediate experience (conflict file content)
- Can create user docs later when usage patterns are clearer

## Risks / Trade-offs

### **Risk: Verbose Conflict Files**
**Mitigation:** Markdown headers are collapsible in most editors, clear `---` separator before content

### **Risk: Rename Suspicion Logging False Positives**
Two identical files deleted + created looks like rename.

**Mitigation:** 
- Log as "possible rename" not "rename detected"
- 5s window reduces false positives
- Logging-only (no automated actions)

### **Trade-off: Still No Actual Rename Detection**
This change improves messaging but doesn't solve the underlying inefficiency (delete + create).

**Accepted because:**
- Industry standard approach (Obsidian, Logseq, Dendron all use this)
- Proper rename detection requires 3-4 days implementation (Phase 6+)
- Messaging improvements have immediate value with lower risk
- Can layer rename detection on top of this foundation later

### **Risk: Users Might Not Read Conflict File Content**
Some users might just see filename and panic.

**Mitigation:**
- Clear filename format remains: `*.conflict-remote-delete-*.md`
- First line of content is attention-grabbing header: `# Conflict: Remote Deletion`
- Markdown rendering makes headers prominent

## Migration Plan

**Deployment:**
1. Update conflict file content generation in `conflicts.ts`
2. Add optional logging in state materialization
3. Update AGENTS.md with rename behavior section
4. No database migrations or breaking changes
5. Existing conflict files remain as-is (new format applies to new conflicts)

**Rollback:**
Simple revert of `conflicts.ts` changes - no persistent state affected.

**Testing:**
- Integration test: Create rename scenario, verify conflict content includes guidance
- Manual test: Rename file on Device A, edit on Device B, sync and inspect conflict file

## Open Questions

None - design is straightforward with low risk.
