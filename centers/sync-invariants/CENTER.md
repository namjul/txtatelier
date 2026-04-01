# sync-invariants center

**Status:** Active  
**Created:** 2026-04-01  
**Package:** `@txtatelier/sync-invariants`

---

## What this center does

**Isomorphic, dependency-free TypeScript** that encodes **normative sync invariants** — how to interpret content hashes when reconciling local state with a replicated row:

- **`detectConflict`** — pure 3-way merge math (`diskHash`, `lastAppliedHash`, `remoteHash`).
- **`classifyRemoteChange`** — ordered causality layer (`lastPersistedHash` for self-echo); **only** caller of `detectConflict` for product rules.

**Not here:** Zag FSMs, Evolu clients, filesystem I/O, CLI commands, or PWA UI. Those centers **import** these invariants.

---

## Center definition

### Hypothesis

Shared rules prevent CLI Loop B and PWA editor from **diverging on what counts as a conflict**, while keeping orchestration in each consumer.

**Contact test**

- **Success-if:** One implementation of `detectConflict` + `classifyRemoteChange`; PWA and CLI both depend on `@txtatelier/sync-invariants`.
- **Failure-if:** Duplicate invariant logic or UI/FSM calling `detectConflict` without going through classification (except tests / documented bridge).

### Current strength

Strengthening — pure core extracted from CLI `file-sync`.

---

## History

### 2026-04-01 — Extract workspace (as `sync-contract`)

**Aim:** Browser-safe package for PWA editor Layer 1–2 (see archived `openspec/changes/archive/2026-04-01-pwa-editor-fsm-zag-unify/CONFLICT_RULES.md`); CLI materialization uses `classifyRemoteChange`.

**Co-variance:** `centers/cli`, `centers/pwa`.

### 2026-04-01 — Rename to `sync-invariants`

**Package / folder:** `@txtatelier/sync-invariants`, `centers/sync-invariants` — name reflects normative invariants rather than “contract” metaphor.
