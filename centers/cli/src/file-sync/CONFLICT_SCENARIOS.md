# Conflict Scenarios Truth Table

This document maps all possible conflict scenarios in the file sync system.

## Legend

- **Disk**: File state on local filesystem
- **Evolu**: File state in Evolu database
- **lastApplied**: Last hash we wrote to disk (tracking state)
- **Action**: What the system should do
- **✅**: Implemented
- **❌**: Not implemented
- **Runtime**: During normal sync operation (Loop A/B active)
- **Startup**: During startup reconciliation (offline changes)

## Truth Table

| # | Disk Exists | Disk Modified | Evolu Exists | Evolu Modified | Evolu Deleted | Context | Action | Status |
|---|-------------|---------------|--------------|----------------|---------------|---------|--------|--------|
| 1 | No | - | No | - | - | Startup | No action | ✅ |
| 2 | Yes | - | No | - | - | Startup | Insert to Evolu | ✅ |
| 3 | No | - | Yes | - | No | Startup | Write to disk | ❌ |
| 4 | No | - | Yes | - | Yes | Startup | No action (already deleted) | ✅ |
| 5 | Yes | No | Yes | No | No | Startup | No action (in sync) | ✅ |
| 6 | Yes | Yes | Yes | No | No | Startup | Update Evolu | ❌ |
| 7 | Yes | No | Yes | Yes | No | Startup | Update disk | ❌ |
| 8 | Yes | Yes | Yes | Yes | No | Startup | **CONFLICT** - create conflict file | ❌ |
| 9 | Yes | No | Yes | - | Yes | Startup | Delete from disk | ❌ |
| 10 | Yes | Yes | Yes | - | Yes | Startup | **CONFLICT** - local edit vs remote delete | ❌ |
| 11 | No | - | Yes | Yes | No | Startup | Write to disk (remote created offline) | ❌ |
| 12 | Yes | No | Yes | No | No | Runtime | No action (in sync) | ✅ |
| 13 | Yes | No | Yes | Yes | No | Runtime | Update disk | ✅ |
| 14 | Yes | Yes | Yes | Yes | No | Runtime | **CONFLICT** - create conflict file | ✅ |
| 15 | Yes | Yes | Yes | - | Yes | Runtime | **CONFLICT** - local edit vs remote delete | ✅ |
| 16 | Yes | No | Yes | - | Yes | Runtime | Delete from disk | ✅ |

## Scenario Details

### Scenario 2: Disk-only file (Startup)
- **State**: File exists on disk but not in Evolu
- **Cause**: File created while CLI offline
- **Action**: Insert into Evolu via captureChange
- **Status**: ✅ Implemented in startup-reconciliation.ts (Step 1)

### Scenario 3: Evolu-only file (Startup) 
- **State**: File exists in Evolu but not on disk
- **Cause**: File created in Evolu (from another device) while CLI offline
- **Action**: Write to disk (materialize)
- **Status**: ❌ **MISSING** - Need to implement Loop B during reconciliation

### Scenario 6: Disk modified offline (Startup)
- **State**: File exists in both, disk hash ≠ Evolu hash, lastApplied = Evolu hash
- **Cause**: User edited file on disk while CLI offline
- **Action**: Update Evolu with disk content
- **Status**: ❌ **MISSING** - Currently skips if path exists (line 47-50)

### Scenario 7: Evolu modified offline (Startup)
- **State**: File exists in both, disk hash = lastApplied, Evolu hash ≠ lastApplied
- **Cause**: File edited on another device while CLI offline
- **Action**: Update disk with Evolu content
- **Status**: ❌ **MISSING** - Need to implement Loop B during reconciliation

### Scenario 8: Both modified offline (Startup)
- **State**: File exists in both, disk hash ≠ lastApplied, Evolu hash ≠ lastApplied, disk ≠ Evolu
- **Cause**: File edited on disk AND on another device while CLI offline
- **Action**: Create conflict file with Evolu content, leave disk untouched
- **Status**: ❌ **MISSING** - Need conflict detection in reconciliation

### Scenario 9: Remote delete, local unchanged (Startup)
- **State**: File exists on disk, marked deleted in Evolu, disk hash = lastApplied
- **Cause**: File deleted on another device while CLI offline
- **Action**: Delete from disk
- **Status**: ❌ **MISSING** - Currently being implemented

### Scenario 10: Remote delete, local modified (Startup)
- **State**: File exists on disk, marked deleted in Evolu, disk hash ≠ lastApplied
- **Cause**: File deleted remotely AND edited locally while CLI offline
- **Action**: Create conflict file (or keep local file and mark conflict)
- **Status**: ❌ **MISSING** - Need delete conflict detection

### Scenario 11: Remote created offline (Startup)
- **State**: File in Evolu but not on disk, not in lastApplied tracking
- **Cause**: File created on another device while CLI offline
- **Action**: Write to disk
- **Status**: ❌ **MISSING** - Same as Scenario 3

### Scenario 13: Remote edit during runtime (Runtime)
- **State**: File exists in both, remote edit arrives
- **Cause**: Another device edited the file
- **Action**: Update disk if no local changes, else conflict
- **Status**: ✅ Implemented in state-materialization.ts

### Scenario 14: Concurrent edits (Runtime)
- **State**: Local edit + remote edit both happen
- **Cause**: Two devices edit simultaneously
- **Action**: Create conflict file
- **Status**: ✅ Implemented via detectConflict() in state-materialization.ts

### Scenario 15: Remote delete vs local edit (Runtime)
- **State**: Local file modified, remote marks deleted
- **Cause**: Concurrent delete and edit
- **Action**: Create conflict file
- **Status**: ✅ Implemented in state-materialization.ts (deletion handling)

### Scenario 16: Remote delete, no local changes (Runtime)
- **State**: Local file unchanged, remote marks deleted
- **Cause**: Another device deleted the file
- **Action**: Delete from disk
- **Status**: ✅ Implemented in state-materialization.ts

## Implementation Checklist

### Startup Reconciliation Missing Features
- [ ] Scenario 3/11: Materialize Evolu-only files to disk
- [ ] Scenario 6: Detect and sync disk modifications to Evolu
- [ ] Scenario 7: Detect and apply Evolu modifications to disk
- [ ] Scenario 8: Detect and handle offline concurrent edits (conflict)
- [ ] Scenario 9: Apply remote deletions to disk (in progress)
- [ ] Scenario 10: Detect and handle delete vs edit conflicts

### Runtime Features (Complete)
- [✅] Scenario 13: Remote edits
- [✅] Scenario 14: Concurrent edit conflicts
- [✅] Scenario 15: Delete vs edit conflicts
- [✅] Scenario 16: Remote deletions

## Notes

**Key insight**: Startup reconciliation needs to implement the same 3-way merge logic as runtime, but must scan all files instead of processing incremental changes.

**Detection logic**:
```typescript
const diskHash = await computeFileHash(absolutePath);
const lastApplied = await getTrackedHash(evolu, relativePath);
const evolHash = row.contentHash;

// Scenario 5: In sync
if (diskHash === evolHash) return;

// Scenario 6: Disk modified only
if (diskHash !== lastApplied && evolHash === lastApplied) {
  // Update Evolu
}

// Scenario 7: Evolu modified only  
if (diskHash === lastApplied && evolHash !== lastApplied) {
  // Update disk
}

// Scenario 8: Both modified
if (diskHash !== lastApplied && evolHash !== lastApplied && diskHash !== evolHash) {
  // Create conflict
}
```
