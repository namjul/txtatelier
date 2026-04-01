# Gesture: pwa-editor-fsm-zag-unify

## Gesture type

revision

## What are we gesturing toward?

**PWA editor session control** — the combined behavior users experience when opening a file, typing, seeing save/sync feedback, hitting a real edit collision, or recovering via “replace with remote” / “save as conflict artifact.” Today that behavior is split between a Zag auto-save machine and a separate Solid effect plus signals (`conflictRemote`, `hasConflict` as a prop guard).

## Claim

**Falsifiable:** In a two-week window of normal single-user PWA + CLI use (debounced typing, materialization on disk), **zero** conflict banners are shown **unless** a **true divergent edit** occurs per [`CONFLICT_RULES.md`](./CONFLICT_RULES.md) (Layer 2 `true_divergence` → `ROW_TRUE_DIVERGENCE`). Sole-writer replication lag, ordering, self-echo, and remote-behind **must not** surface as conflict.

**Secondary (maintainer-facing):** A new contributor can describe the full editor sync story **from one Zag machine definition and one vocabulary of events** without reading a second parallel “conflict state” story in a `createEffect`.

## What made us do this?

We observed **spurious conflicts** when debounced saves overlapped **subscription timing** and a **narrow** `isSaving` guard; we added `reconciling` to align the FSM with the persist lifecycle. **Conflict** remains **outside** the machine as a memo fed into guards, so “who owns truth for session phase?” is still split. Naming mixes UI words (`SAVE`), mechanism words (`REMOTE_ALIGNED`), and parallel terms for the same idea (`hasConflict` vs a would-be `conflicting` state). We also concluded **dismiss / keep-local** is bad UX and should not return as a resolution path.

## Load-bearing assumptions

1. **Evolu + Solid subscription** remains the source of `FilesRow` updates in the PWA; we are not replacing it with a different row feed in this gesture.
2. **Zag** remains the FSM implementation in `centers/pwa` for this session (no parallel XState runtime for the same concern).
3. **Conflict resolution** stays **explicit**: only **adopt remote** or **persist local as artifact** then adopt remote on the original path — **no** third “dismiss” affordance.

## Structures this gesture touches

**Normative conflict and session policy (this change):** [`CONFLICT_RULES.md`](./CONFLICT_RULES.md) (layers 1–2) and [`EDITOR_SESSION_FSM.md`](./EDITOR_SESSION_FSM.md) (layer 3).

**New structures (hypothesized; document under this change’s `specs/` if they cohere):**

- `structures/pwa-editor-session/` — small **UI lifecycle** machine ([`EDITOR_SESSION_FSM.md`](./EDITOR_SESSION_FSM.md)) + **`classifyRemoteChange`** (causality) + shared **`detectConflict`** math ([`CONFLICT_RULES.md`](./CONFLICT_RULES.md)).

**Anticipated co-variances (existing specs / code):**

- `openspec/specs/file-sync-context/spec.md` — **indirect**: CLI sync unchanged in scope, but editor vocabulary should **not** collide with CLI “conflict file” language without qualification.
- `centers/pwa/` — `useFileEditor`, `FileEditor`, `file-editor-machine`, tests, and PWA center claims around explicit conflict UX.

## Co-variance

OpenSpec **contact-test** and **design** will pin vocabulary and transitions; **tasks** will touch **happy-dom / `bun test --conditions browser`** conventions if the hook under test grows. Any **Stately / docs** diagrams that duplicated the old split model should be **reconciled** to one vocabulary (redundancy) or explicitly namespaced (collision) in design.
