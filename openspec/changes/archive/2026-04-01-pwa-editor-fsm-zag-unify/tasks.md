# Tasks: pwa-editor-fsm-zag-unify

## Status

- **§1–§4:** done (historical: unified machine iteration, hook adapter, tests, delta spec seed).
- **§5:** done — [`CONFLICT_RULES.md`](./CONFLICT_RULES.md) + [`EDITOR_SESSION_FSM.md`](./EDITOR_SESSION_FSM.md) + PWA implementation; **5.10** closed (Zag unit file removed by choice; `sync-invariants` covers classification math).

---

## 1. Vocabulary and machine skeleton (done)

- [x] 1.1 Add `openspec/changes/pwa-editor-fsm-zag-unify/EVENTS.md` (or equivalent) listing event strings and meanings.
- [x] 1.2 Introduce unified `file-editor-machine.ts` and Zag typing (final shape in [`EDITOR_SESSION_FSM.md`](./EDITOR_SESSION_FSM.md); apply in §5).
- [x] 1.3 Earlier transition iteration (`conflicting`, reconcile); canonical chart is [`EDITOR_SESSION_FSM.md`](./EDITOR_SESSION_FSM.md) — §5 applies it.

## 2. Hook and UI adapter (done)

- [x] 2.1 `useFileEditorMachine` + Solid memos.
- [x] 2.2–2.5 `useFileEditor`, `FileEditor`, `App`, types iteration (final shapes in §5).

## 3. Cleanup and tests (done)

- [x] 3.1–3.4 Remove dead paths, migrate tests, Vitest.

## 4. Document co-variance (done)

- [x] 4.1 Delta spec under `specs/pwa-editor-session/spec.md`.

---

## 5. Editor classification + session FSM (apply)

- [x] 5.1 Optional: cross-link [`CONFLICT_RULES.md`](./CONFLICT_RULES.md) from `gesture.md` / PWA `CENTER.md`.
- [x] 5.2 **`@txtatelier/sync-invariants`:** PWA depends on workspace package; hook imports `classifyRemoteChange`.
- [x] 5.3 **Tests:** `classifyRemoteChange` coverage (order, `self_echo`, `remote_behind`, `true_divergence`) in `sync-invariants` or PWA as appropriate.
- [x] 5.4 **`file-editor-machine.ts`:** Implement [`EDITOR_SESSION_FSM.md`](./EDITOR_SESSION_FSM.md) exactly — states `clean` | `dirty` | `saving` | `conflict`, initial `clean`, transitions as specified. Do **not** add `ROW_SELF_ECHO` / `ROW_REMOTE_BEHIND` to the machine.
- [x] 5.5 **`useFileEditor.ts`:** On replication updates, compute hashes → `classifyRemoteChange` → `ROW_TRUE_DIVERGENCE` only when `true_divergence`; remove raw “remote ≠ baseline && dirty” conflict logic; log other outcomes outside FSM.
- [x] 5.6 **Baseline:** `lastAppliedHash` only when `remoteHash === diskHash` per [`CONFLICT_RULES.md`](./CONFLICT_RULES.md) §5.
- [x] 5.7 **`lastPersistedHash`:** set on successful persist; clear on file reset; wire into classification.
- [x] 5.8 **Convergence:** no `reconciling` / `ROW_CONVERGED` / baseline timeout **in** the FSM; handle in hook only.
- [x] 5.9 **UI:** `state.matches("conflict")`; update `FileEditor` / `types.ts` / `AutoSaveUiState` for `clean` | `dirty` | `saving` chip; optional “Saved” outside FSM ([`specs/pwa-editor-session/spec.md`](./specs/pwa-editor-session/spec.md)).
- [x] 5.10 **Tests:** No dedicated Zag machine unit file (`file-editor-machine.test.ts` removed by product choice). `classifyRemoteChange` / `detectConflict` covered in `centers/sync-invariants`; optional hook/App tests later.
- [x] 5.11 **Contact test:** keep [`contact-test.md`](./contact-test.md) aligned (classification = conflict brain; `detectConflict` only inside `classifyRemoteChange`).
- [x] 5.12 **Verify:** `bun run typecheck` and `bun run test` in `centers/pwa`; CLI tests if touched.
