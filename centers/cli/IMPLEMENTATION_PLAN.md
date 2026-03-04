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

- Loop A: Delete file -> remove Evolu row.
- Loop B: Remote delete -> remove file if `lastAppliedHash[path]` matches, else create conflict.

---

## Phase 5 — Stability Hardening

### 5.1 Startup Reconciliation

- Scan disk and Evolu.
- Reconcile files:
  - Disk only -> insert to Evolu.
  - Evolu only -> write to disk.
  - Both -> compare hashes.

### 5.2 Write Debounce + Atomic Writes

- Debounce filesystem events (50-200ms).
- Use atomic temp-file rename to prevent storms.

### 5.3 Ignore Internal State

- Temporary write artifacts and system metadata files ignored.

---

## Phase 6 — PWA Integration Boundary

- PWA reads/writes only to Evolu.
- CLI handles disk synchronization.

---

## Phase 7 — Edge Case Testing

Test scenarios:

- A edits, B edits same file offline -> conflict file created.
- A edits, B deletes -> conflict or safe delete.
- Three-device simultaneous edits -> deterministic behavior, no infinite loops.

---

## Phase 8 — Observability

Add CLI commands:

```bash
mk status
mk conflicts
mk sync
mk doctor
```

- Allows introspection before adding new features.

---

## Summary

At the end of this plan, the CLI system is:

- Deterministic
- Explicit about conflicts
- Simple and observable
- Safe for multi-device edits
- Evolvable for future enhancements
