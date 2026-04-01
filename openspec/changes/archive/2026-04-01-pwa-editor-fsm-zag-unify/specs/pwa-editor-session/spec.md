# Delta spec: pwa-editor-session

## ADDED Requirements

### Requirement: Editor session FSM (Zag)

The PWA file editor SHALL use a single Zag state machine for the **editor session** with exactly four states: `clean`, `dirty`, `saving`, `conflict`. Initial state SHALL be `clean`. Transitions and events SHALL match [`EDITOR_SESSION_FSM.md`](../../EDITOR_SESSION_FSM.md).

#### Scenario: User types after load

- **WHEN** the user edits the draft so it differs from the base
- **THEN** the machine SHALL transition to `dirty` (via `DRAFT_CHANGED` or equivalent)

#### Scenario: Debounced save

- **WHEN** persist is requested and the machine is in `dirty`
- **THEN** the machine SHALL transition to `saving` on `PERSIST_REQUESTED`

#### Scenario: Save completes

- **WHEN** persist completes successfully from `saving`
- **THEN** the machine SHALL transition to `clean` if the draft matches the base, else `dirty` (`PERSIST_COMPLETED`)

#### Scenario: Save fails

- **WHEN** persist fails from `saving`
- **THEN** the machine SHALL transition to `dirty` (`PERSIST_FAILED`)

#### Scenario: True divergence conflict

- **WHEN** the hook classifies a remote row change as `true_divergence` per [`CONFLICT_RULES.md`](../../CONFLICT_RULES.md) Layer 2 (`classifyRemoteChange`)
- **THEN** the machine SHALL transition to `conflict` (`ROW_TRUE_DIVERGENCE`)

#### Scenario: Conflict resolution

- **WHEN** the user adopts remote or parks local as a new file from `conflict`
- **THEN** the machine SHALL transition to `clean` (`ADOPT_REMOTE` or `LOCAL_PARKED_AS_NEW_FILE`)

#### Scenario: File context reset

- **WHEN** the editor file context is cleared or switched
- **THEN** the machine SHALL transition to `clean` (`FILE_CONTEXT_RESET`)

---

### Requirement: Conflict classification in the hook

The PWA SHALL use `classifyRemoteChange` from `@txtatelier/sync-invariants` (or equivalent shared module) for replication-driven conflict decisions. The editor session machine SHALL NOT implement Layer 1–2 logic; it SHALL only receive `ROW_TRUE_DIVERGENCE` when classification yields `true_divergence`. Outcomes `self_echo` and `remote_behind` SHALL be handled outside the FSM (log or hook-only).

#### Scenario: Self-echo

- **WHEN** classification yields `self_echo`
- **THEN** the machine SHALL NOT enter `conflict` on that update

#### Scenario: Remote behind

- **WHEN** classification yields `remote_behind`
- **THEN** the machine SHALL NOT enter `conflict` on that update

---

### Requirement: Baseline alignment

`lastAppliedHash` (base fingerprint) SHALL be updated only when the remote row matches the on-disk file per [`CONFLICT_RULES.md`](../../CONFLICT_RULES.md) §5–§6. Baseline alignment SHALL NOT be modeled as FSM states.

---

### Requirement: Persisted snapshot for classification

The hook SHALL maintain `lastPersistedHash` (content hash after last successful persist for the current file context). It SHALL be cleared on file context reset. It SHALL be passed into `classifyRemoteChange` per [`CONFLICT_RULES.md`](../../CONFLICT_RULES.md).

---

### Requirement: UI affordances

The editor UI SHALL show a conflict affordance when `state.matches("conflict")`. Auto-save / status chip SHALL reflect `clean`, `dirty`, or `saving`. An optional ephemeral “Saved” indicator MAY exist outside the FSM per [`EDITOR_SESSION_FSM.md`](../../EDITOR_SESSION_FSM.md).

---

### Requirement: Vocabulary

Event strings used by the machine SHALL match [`EVENTS.md`](../../EVENTS.md) and [`EDITOR_SESSION_FSM.md`](../../EDITOR_SESSION_FSM.md).
