# Project Description — Local-First File Sync with Evolu

This project implements a **local-first, multi-device file synchronization system** with a minimal, robust conflict model. The goal is to provide a fully replicated environment where the **filesystem is always canonical**, while Evolu serves as a distributed, replicated mirror, enabling multi-device collaboration without risking data loss or complicated merge conflicts.

---

## Key Principles

1. **Filesystem is canonical**
   All truth resides on disk. Users and external tools (editors, scripts, git) operate directly on files. Evolu reflects this state and never overrides it silently.

2. **Two independent synchronization loops**
   - **Loop A:** Filesystem → Evolu
     CLI watches file changes and updates Evolu accordingly.
   - **Loop B:** Evolu → Filesystem
     CLI applies replicated Evolu changes to disk, respecting local modifications.

3. **Explicit conflict handling**
   If a remote change conflicts with a local modification, a **conflict file** is created:

```
<filename>.conflict-<ownerId>-<timestamp>.md
```

   Conflicts are first-class objects that sync like any other file, ensuring transparency and safety.

4. **Simple state tracking**
   The system relies only on Evolu’s `ownerId` and a local map of `lastAppliedHash[path]` to prevent loops. No baseHash, shadow hashes, or CRDTs are used.

5. **PWA integration**
   The web interface reads and writes only to Evolu. It never touches the filesystem. The CLI is the sole bridge between Evolu and disk.

6. **Safe multi-device replication**
   Evolu synchronizes changes across devices. The CLI enforces deterministic, conflict-aware projections to disk, guaranteeing that simultaneous edits never silently overwrite one another.

---

## Architecture Overview

```
     +-----------+
     |   PWA     |
     | (Editor)  |
     +-----+-----+
           |
           v
     +-----+-----+
     |   Evolu   |
     | (Mirror)  |
     +-----+-----+
      ↑        ↓
      |        |
+-----+-----+  |
| CLI Sync  |  |
|  Loops    |  |
+-----+-----+  |
      ↑        ↓
      |        |
  +---+--------+---+
  |  Filesystem    |
  | (Canonical FS) |
  +----------------+
```

---

## System Benefits

- **Local-first:** Users can edit files offline, without requiring servers.
- **Robust conflict resolution:** Conflicts are explicit and visible, not hidden metadata.
- **Safe for external tools:** Editors, scripts, and git workflows remain compatible.
- **Simple mental model:** No complex merge algorithms or ancestry tracking.
- **Evolvable:** Future intelligence (e.g., optional ancestry or structured sync) can be layered without breaking the current workflow.

---

## Use Cases

- Multi-device note-taking with markdown files
- Collaborative coding with plain files
- Scripted workflows with full external tool compatibility
- Safe experiments with file-based datasets

---

**Summary:**

This project provides a **deterministic, human-transparent, local-first file sync system**. It leverages Evolu for replication, CLI loops for synchronization, and filesystem as the single source of truth. Conflicts are materialized as files, creating a system that is **simple, reliable, and fully observable**.
