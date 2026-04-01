# Contact Test: pwa-editor-fsm-zag-unify

## Evidence tier

proximal

## Canonical policy

Round 2 contact expectations are governed by [`CONFLICT_RULES.md`](./CONFLICT_RULES.md): conflicts **only** on `true_divergence` after `classifyRemoteChange`; never from sole-writer lag, self-echo, or remote-behind.

## What would success look like?

1. **End-user (single device, PWA + CLI running, one watched directory):** Over a fixed window, you complete **at least 20** separate edit sessions where each session includes **≥ 3** debounced auto-save cycles (type, pause for save, type again, repeat) on the **same** open file. The red conflict banner **never** appears.

2. **Maintainer:** You open `centers/pwa` and identify **exactly one** Zag machine module that defines **UI lifecycle** only ([`EDITOR_SESSION_FSM.md`](./EDITOR_SESSION_FSM.md): `clean` / `dirty` / `saving` / `conflict`), and **zero** `createEffect` blocks whose **sole** job is to derive “conflict vs not” from raw `contentHash` vs baseline **without** going through **`classifyRemoteChange`**. (Effects may compute hashes and call `classifyRemoteChange`, then `send` `ROW_TRUE_DIVERGENCE` only when appropriate.)

3. **`detectConflict`:** Grep shows it is **only** used from `classifyRemoteChange` (plus that module’s tests), not from UI or FSM.

## What would falsify this claim?

**Either** of these counts as falsification:

- **A.** The conflict banner appears **once** during a session that satisfies: only **this** browser tab edits the file in Evolu; CLI only materializes; **no** second device, **no** second tab, **no** manual edit of the same path on disk that could advance Evolu via Loop A with a different hash before the PWA save completes.

- **B.** Conflict UI state is driven by raw `remote !== baseline && dirty` (or equivalent) **without** `classifyRemoteChange` → `true_divergence` → `ROW_TRUE_DIVERGENCE`, or `detectConflict` is invoked from the Zag machine or `FileEditor` (it MUST stay inside `classifyRemoteChange` only).

## How will we check?

1. **Protocol A (spurious conflict):** Start CLI + PWA, open one `.md` file, run the 20-session / 3-save-minimum exercise above; **log** each time the conflict banner appears (screenshot or timestamp + file path). Stop early if **A** triggers.

2. **Protocol B (maintainer claim):** Read `useFileEditor.ts` (or successor): list every `createEffect` and one sentence each. Confirm **no** parallel conflict brain; confirm classification + FSM path.

3. **Protocol C (regression automation):** From `centers/pwa`, run `bun run test` (Vitest). Confirm **no new failures**; `classifyRemoteChange` and updated machine tests **pass**.

## When will we check?

- **Protocol C:** On every PR that touches `centers/pwa/src/components/editor/`, `centers/pwa/src/machines/`, or shared conflict modules until this change is archived.

- **Protocol A:** **Once** within **14 days** after round 2 merges to the branch you use daily (or **2026-04-15**, whichever is later)—whichever date is explicit in your release notes.

- **Protocol B:** Once when **tasks** round 5 are marked complete (pre-archive review).
