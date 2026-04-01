# PWA editor — conflict rules (canonical)

**Status:** Normative for this change. Supersedes ad-hoc “remote ≠ baseline ⇒ conflict” behavior.

**PWA mapping (filesystem vs Evolu):** The editor buffer is Evolu-backed; there is no on-disk file for the open row in the PWA. In code and tests, map spec terms as follows unless a future artifact renames them:

| Spec term           | PWA meaning |
|---------------------|-------------|
| `diskHash`          | Content hash of the **current draft** (same algorithm as row `contentHash`). |
| `lastAppliedHash`   | **True base** — last hash where editor and row were judged fully converged (`remote === disk`); replaces optimistic “baseline on save” uses. |
| `remoteHash`        | `FilesRow.contentHash` from subscription. |
| `lastPersistedHash` | Content hash of the draft **at last successful persist** (own-write echo detection). |

---

## Purpose

Ensure conflicts are **only** raised for **real divergent edits**.  
Never raise conflicts due to replication lag, ordering, or own writes.

---

## 1) Three distinct layers (do not mix)

### Layer 1 — `detectConflict` (pure logic)

- **Input:** `diskHash`, `lastAppliedHash`, `remoteHash` (nullable rules per function contract).
- **Output:** `boolean`.
- **Responsibility:** Pure 3-way merge math only.

**Rules:**

- No timing awareness.
- No replication awareness.
- No knowledge of “who wrote what.”
- No FSM interaction.

**Definition:**

- `conflict` ⇔ `localChanged && remoteChanged`
- `localChanged`  = `disk !== base` (with null handling as today in `detectConflict`).
- `remoteChanged` = `remote !== base`

**Usage:**

- **Only** called inside `classifyRemoteChange`.
- **Never** used directly by UI or FSM.

**Implementation note:** `detectConflict` and `classifyRemoteChange` live in **`centers/sync-invariants`** (`@txtatelier/sync-invariants`). CLI re-exports `detectConflict` from `conflicts.ts` for legacy imports; **materialization** uses `classifyRemoteChange`. PWA depends on the same package.

---

### Layer 2 — `classifyRemoteChange` (causality layer)

**Most important layer.**

**Input:**

- `diskHash`
- `lastAppliedHash` (true base)
- `remoteHash`
- `lastPersistedHash` (own last write)

**Output (exactly one):**

- `"no_change"`
- `"self_echo"`
- `"remote_behind"`
- `"true_divergence"`

**Responsibilities:**

- Interpret replication state.
- Filter false positives.
- Invoke `detectConflict` only when rules below reach step 5.

**Rules (order matters):**

1. If no disk or no base → `"no_change"`.
2. If `remote === disk` → `"no_change"` (fully aligned).
3. If `remote === lastPersisted` → `"self_echo"`.
4. If `remote === lastApplied` → `"remote_behind"`.
5. If `detectConflict(...)` is true → `"true_divergence"`.
6. Otherwise → `"no_change"`.

**Critical guarantee:**  
`"true_divergence"` is **only** returned when both local and remote changed from the same base **and** the situation is **not** explainable by replication lag, ordering, or self-writes (per rules 2–4).

---

### Layer 3 — FSM (UI lifecycle only)

**Normative chart:** [`EDITOR_SESSION_FSM.md`](./EDITOR_SESSION_FSM.md).

- Layers **1–2** (this file) are unchanged.
- The Zag machine **must not** compare hashes or interpret remote state.
- **Only** `ROW_TRUE_DIVERGENCE` enters the **`conflict`** state.
- `self_echo` / `remote_behind`: **outside FSM** — log in the hook or `machine.watch`; **do not** extend the FSM event union for them unless product explicitly requires it.
- **No** `reconciling` / `saved` / `ROW_CONVERGED` **inside** the FSM; convergence and baseline updates stay in the hook / subscription layer.

FSM events and transitions are defined only in [`EDITOR_SESSION_FSM.md`](./EDITOR_SESSION_FSM.md) and [`EVENTS.md`](./EVENTS.md).

---

## 5) Baseline (`lastAppliedHash`) rule

**Critical invariant**

Update **`lastAppliedHash` only** when:

```text
remoteHash === diskHash
```

Meaning: system is **fully converged** — real shared state.

**Never** update baseline:

- On save request alone
- On local write alone
- During post-persist replication wait **outside FSM** until convergence (remote === disk)
- On partial replication observations

---

## 6) Last persisted hash (own-write tracking)

On successful save (draft persisted to Evolu):

```text
lastPersistedHash = diskHash
```

(at save completion, hash of the content that was written)

**Purpose:** Identify self-writes when they return from replication.

**Rule:** If `remote === lastPersistedHash` → **never** a conflict (Layer 2 step 3).

---

## 7) What is not a conflict

| Case | Pattern (conceptual) | Classification |
|------|----------------------|----------------|
| A — Remote behind | base A, local B, remote A | `remote_behind` |
| B — Self echo | base A, local B, remote B | `self_echo` |
| C — Replication lag | transient remote vs stable disk/base | absorbed by Layer 2 before `true_divergence` |
| D — Replication catch-up | before remote matches disk; handled **outside** the editor session FSM | `self_echo` / `remote_behind` / `no_change`, not `true_divergence` |

All of the above **must not** produce conflicts.

---

## 8) What is a real conflict

**All** must hold for `true_divergence` (and thus `ROW_TRUE_DIVERGENCE`):

1. `diskHash !== lastAppliedHash`
2. `remoteHash !== lastAppliedHash`
3. `remoteHash !== lastPersistedHash`
4. `detectConflict(disk, lastApplied, remote) === true` (after Layer 2 ordering; equivalent to combined rule set)

Then → `ROW_TRUE_DIVERGENCE` → FSM `conflict` (see [`EDITOR_SESSION_FSM.md`](./EDITOR_SESSION_FSM.md)).

---

## 9) Data flow (final)

```text
replication update
    ↓
classifyRemoteChange(...)
    ↓
(if "true_divergence") send ROW_TRUE_DIVERGENCE
    ↓
FSM
    ↓
UI shows conflict
```

**All other cases:** do **nothing** at the conflict UI (hook may still update converged baseline per §5 when `remote === disk`).

---

## 10) Core principle

`remote !== baseline` **is not** a conflict. It is a transport observation.

A conflict exists **only** when:

> This change cannot be explained by my own write **and** does not descend from my current base (per Layer 2 + `detectConflict`).

---

## End
