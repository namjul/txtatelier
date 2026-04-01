# PWA editor session — UI lifecycle FSM

**Scope:** Zag machine for **editing and persist UI phases** only. Replication, conflict **detection**, and hash causality live in `classifyRemoteChange` and the hook — not in this chart.

**Related:** [`CONFLICT_RULES.md`](./CONFLICT_RULES.md) (layers 1–2). Layer 3 here is the **editor session machine** (this file).

---

## Role

The FSM manages **local editing lifecycle** only. It **must not** interpret remote state or compare hashes inside transition logic.

---

## States

| State | Meaning |
|-------|---------|
| `clean` | No local unsaved changes; editor matches last known synced state. |
| `dirty` | Local edits exist that are not persisted. |
| `saving` | A persistence request is in flight. |
| `conflict` | A true divergent edit was reported **from outside** (`ROW_TRUE_DIVERGENCE`); the machine does not compute divergence. |

Initial state: **`clean`**.

---

## Events (machine union)

| Event |
|--------|
| `DRAFT_CHANGED` |
| `PERSIST_REQUESTED` |
| `PERSIST_COMPLETED` |
| `PERSIST_FAILED` |
| `ROW_TRUE_DIVERGENCE` |
| `ADOPT_REMOTE` |
| `LOCAL_PARKED_AS_NEW_FILE` |
| `FILE_CONTEXT_RESET` |

**`ROW_TRUE_DIVERGENCE`** is the **only** event that enters `conflict`. It is emitted by the hook when `classifyRemoteChange` returns `true_divergence`.

**Outside the machine union:** `classifyRemoteChange` outcomes `self_echo` and `remote_behind` — log in the hook or `machine.watch`; do not add FSM transitions for them unless product expands the chart later.

The following are **not** editor-session machine events: `ROW_MATCHES_BASELINE`, `ROW_CONVERGED`, `BASELINE_MATCH_WAIT_TIMED_OUT`, `ROW_DIVERGED_WHILE_DIRTY`. Convergence and baseline timing are handled **outside** this FSM.

---

## Transitions

### `clean`

| Event | Next |
|--------|------|
| `DRAFT_CHANGED` | `dirty` if `isDirty`, else `clean` |
| `PERSIST_REQUESTED` | `saving` if `canPersist` |
| `ROW_TRUE_DIVERGENCE` | `conflict` |
| `FILE_CONTEXT_RESET` | `clean` |

### `dirty`

| Event | Next |
|--------|------|
| `DRAFT_CHANGED` | `dirty` if `isDirty`, else `clean` (draft realigned with base / convergence) |
| `PERSIST_REQUESTED` | `saving` if `canPersist` |
| `ROW_TRUE_DIVERGENCE` | `conflict` |
| `FILE_CONTEXT_RESET` | `clean` |

### `saving`

| Event | Next |
|--------|------|
| `PERSIST_COMPLETED` | `dirty` if `isDirty`, else `clean` |
| `PERSIST_FAILED` | `dirty` |
| `FILE_CONTEXT_RESET` | `clean` |

No `reconciling` state; no baseline or remote comparison inside the machine.

### `conflict`

| Event | Next |
|--------|------|
| `ADOPT_REMOTE` | `clean` |
| `LOCAL_PARKED_AS_NEW_FILE` | `clean` |
| `FILE_CONTEXT_RESET` | `clean` |

`PERSIST_REQUESTED` has no transition in `conflict` (blocked / ignored) unless a later task adds policy.

---

## Conflict boundary

Only **`ROW_TRUE_DIVERGENCE`** may enter **`conflict`**, produced externally from:

`classifyRemoteChange` → `true_divergence`  

(`detectConflict` is used **only** inside `classifyRemoteChange`.)

---

## Hook boundary

```text
replication update
  ↓
classifyRemoteChange({ diskHash, lastAppliedHash, remoteHash, lastPersistedHash })
  ↓
  → send ROW_TRUE_DIVERGENCE to FSM when outcome is true_divergence
  → otherwise log or no-op (self_echo, remote_behind, no_change)
```

The FSM does not: compare hashes, interpret remote rows, track replication phases, or own baseline updates.

---

## Invariant

**Editor session FSM = UI lifecycle only** — not the conflict detector, replication interpreter, or sync engine.

---

## UX note

A brief **“Saved”** affordance may live **outside** this machine (timers/signals) since there is no `saved` state.
