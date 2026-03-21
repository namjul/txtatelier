## Why

When users rename files on one device while editing them on another, txtatelier creates conflict files with "remote-delete" in the filename. This is technically correct (the rename creates a delete + create operation), but confusing for users who don't understand why their rename triggered a "deletion" conflict. Research shows that Obsidian, Logseq, and Dendron all use the same delete + create approach, but hide it through in-app rename commands. Since txtatelier is filesystem-canonical and supports external renames, explicit and helpful conflict messages are essential for user clarity.

## What Changes

- Improve conflict file content to explain rename scenarios
- Add context about why "remote-delete" conflicts occur during renames
- Provide troubleshooting guidance for resolving rename-related conflicts
- Add documentation explaining rename behavior and best practices
- Optional: Add detection logging for suspected renames (delete + create within time window)

## Capabilities

### New Capabilities
- `rename-conflict-guidance`: Clear explanations in conflict files about potential rename scenarios, with step-by-step resolution guidance

### Modified Capabilities
- `conflict-file-creation`: Enhanced conflict file content format to include metadata headers explaining common causes and resolution steps (implementation detail - no requirement changes to when/how conflicts are created)

## Impact

**Affected code:**
- `centers/cli/src/file-sync/conflicts.ts` - Conflict file content generation
- `centers/cli/src/file-sync/sync/state-materialization.ts` - Remote deletion conflict handling

**Documentation:**
- AGENTS.md - Add section on rename behavior
- New user-facing docs on understanding renames and conflicts

**User experience:**
- Reduced confusion when rename operations cause conflicts
- Clearer path to resolution with explicit guidance in conflict files
- Better understanding of system behavior through documentation
