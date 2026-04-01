# Design: pwa-editor-fsm-zag-unify

## Canonical specs

| Topic | Document |
|--------|-----------|
| Hash layers 1–2 (`detectConflict`, `classifyRemoteChange`, baseline / `lastPersistedHash`) | [`CONFLICT_RULES.md`](./CONFLICT_RULES.md) |
| Editor UI lifecycle Zag machine (`clean` / `dirty` / `saving` / `conflict`) | [`EDITOR_SESSION_FSM.md`](./EDITOR_SESSION_FSM.md) |

---

## Approach

1. **`@txtatelier/sync-invariants`** — `detectConflict` + `classifyRemoteChange` (CLI uses classification; PWA hook wires the same).

2. **`useFileEditor`** — subscription, `draft` / `baseContent` / `lastAppliedHash` (`baseFingerprint`) / `lastPersistedHash`, draft hashing, and **`ROW_TRUE_DIVERGENCE`** only when classification yields `true_divergence`. Log `self_echo` / `remote_behind` outside the FSM (or `machine.watch`).

3. **`file-editor-machine.ts`** — matches [`EDITOR_SESSION_FSM.md`](./EDITOR_SESSION_FSM.md): four states, events and transitions as specified. `PERSIST_COMPLETED` from `saving` → `dirty` or `clean` per `isDirty`.

4. **Conflict entry** — only `ROW_TRUE_DIVERGENCE`; the machine never computes divergence.

5. **Baseline** — [`CONFLICT_RULES.md`](./CONFLICT_RULES.md) §5–§6; outside the FSM.

6. **UI** — conflict banner when `state.matches("conflict")`; optional ephemeral “Saved” outside the FSM per [`EDITOR_SESSION_FSM.md`](./EDITOR_SESSION_FSM.md).

7. **Vocabulary** — [`EVENTS.md`](./EVENTS.md).

---

## Rationale

- Small, deterministic editor-session chart; replication and causality stay in one place (`classifyRemoteChange` + hook).
- Avoids encoding replication wait and baseline alignment as FSM states.

## Alternatives considered

- **Reconciling / saved inside Zag:** Rejected — conflates UI with replication ([`EDITOR_SESSION_FSM.md`](./EDITOR_SESSION_FSM.md)).
- **FSM reads hashes:** Rejected.

## Load-bearing assumptions

1. Same content-hash algorithm for draft and row.
2. `classifyRemoteChange` runs in the hook with debounce/race control as needed.
3. `lastPersistedHash` reset on file switch / `FILE_CONTEXT_RESET` stays consistent with `lastAppliedHash`.

## Risks and trade-offs

- **“Saved” without a `saved` state:** UX uses non-FSM affordance; covered in tasks.
- **Rename `conflicting` → `conflict`:** churn in PWA grep.

## Out of scope

- Replacing Evolu or Solid.
- Non-editor PWA features.

## In scope

- `sync-invariants`, PWA classification + baseline rules, editor session machine + hook + tests ([`tasks.md`](./tasks.md)).

## Decisions

- **Workspace:** `centers/sync-invariants` / `@txtatelier/sync-invariants`.
- **Logging:** `self_echo` / `remote_behind` — hook or `machine.watch`, not FSM events.
- **Convergence:** not an FSM event; handled in the hook.

---

## Co-variance

- `centers/pwa/src/machines/file-editor-machine.ts`, `useFileEditor.ts`, `App.tsx`, `types.ts`, tests.
- [`EVENTS.md`](./EVENTS.md), [`specs/pwa-editor-session/spec.md`](./specs/pwa-editor-session/spec.md), [`tasks.md`](./tasks.md).

## Design warnings

Keep **Saving…**, error retry, and conflict banner legible when implementing.
