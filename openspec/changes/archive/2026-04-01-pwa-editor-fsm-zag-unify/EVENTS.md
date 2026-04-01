# PWA editor session — event vocabulary

Normative machine strings and meanings: [`EDITOR_SESSION_FSM.md`](./EDITOR_SESSION_FSM.md) (transitions) and the table below (quick reference for `file-editor-machine.ts`).

| Event | Meaning |
|--------|---------|
| `DRAFT_CHANGED` | Draft vs base relation may have changed. |
| `PERSIST_REQUESTED` | Debounced (or retry) persist should run; guard → `saving`. |
| `PERSIST_COMPLETED` | Persist finished; from `saving` → `dirty` or `clean` per `isDirty`. |
| `PERSIST_FAILED` | Persist failed; → `dirty`. |
| `ROW_TRUE_DIVERGENCE` | External conflict signal (`classifyRemoteChange` → `true_divergence`); → `conflict`. |
| `ADOPT_REMOTE` | User replaced draft with row; exit `conflict` → `clean`. |
| `LOCAL_PARKED_AS_NEW_FILE` | Conflict artifact done; exit `conflict` → `clean`. |
| `FILE_CONTEXT_RESET` | File closed / switched / cleared → `clean`. |

**Not in the machine union:** `self_echo` / `remote_behind` from `classifyRemoteChange` — log only, no transitions.

**Not used in the editor session machine:** `ROW_MATCHES_BASELINE`, `ROW_CONVERGED`, `BASELINE_MATCH_WAIT_TIMED_OUT`, `ROW_DIVERGED_WHILE_DIRTY` — convergence and baseline belong in the hook, not this chart.
