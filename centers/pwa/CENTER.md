# PWA Center

**Status:** Proposed
**Created:** 2026-03-04
**Last Updated:** 2026-03-04

---

## Current Description

The PWA center is the web interaction surface for txtatelier. It is responsible for user-facing editing and file interaction in browser contexts while keeping the core local-first contract intact.

### Operational Definition

**This center:**
- Provides browser-based interfaces for creating, reading, updating, and resolving file content.
- Provides browser-based settings for owner lifecycle and mnemonic recovery actions.
- Reads and writes file state through Evolu queries and mutations only.
- Preserves the system contract that filesystem writes happen through CLI synchronization loops.
- Makes sync and conflict state legible to users through explicit UI feedback and actions.

**Editor conflict policy:** [`CONFLICT_RULES.md`](../../openspec/changes/archive/2026-04-01-pwa-editor-fsm-zag-unify/CONFLICT_RULES.md) (archived change) — `classifyRemoteChange` / `detectConflict` via `@txtatelier/sync-invariants`; session FSM in [`EDITOR_SESSION_FSM.md`](../../openspec/changes/archive/2026-04-01-pwa-editor-fsm-zag-unify/EDITOR_SESSION_FSM.md). Main spec: [`openspec/specs/pwa-editor-session/spec.md`](../../openspec/specs/pwa-editor-session/spec.md).

**Contact test for "is this a center?"**
- Success-if: Web editing concerns (query, editing state, save, conflict UX) converge in `centers/pwa`, and removing this workspace removes browser editing as a coherent capability.
- Failure-if: Browser editing logic is scattered across non-PWA modules, or `centers/pwa` is only a thin shell with no organizing behavior.

### Current Strength

Weak

**Evidence:**
- `centers/pwa/IMPLEMENTATION_PLAN.md` defines architecture, invariants, and phased delivery.
- `centers/pwa/CENTER.md` exists and captures boundary/intent.
- Implementation remains early, so most organizing power is still at the architectural level.

---

## History

### 2026-03-04 - Define PWA center baseline

**What changed:** Established full center definition for PWA with status, operational definition, boundaries, and intervention plan.

**Why:** Make the center explicit before substantial implementation work.

**Expected:** Future PWA implementation decisions remain aligned with filesystem-canonical architecture and explicit conflict policy.

**Actual:** Baseline center document now includes falsifiable contact tests and planned interventions.

**Learned:** The strongest load-bearing constraint is not UI shape but architectural boundary: browser writes Evolu only.

---

## Planned Interventions

### 2026-03-04 - Establish core web interaction loop

**Aim:** Establish reliable browser read/write workflows over Evolu.

**Claim:** A stable core interaction loop (discover files, edit content, persist changes, reflect remote updates) will establish this center as an active organizer.

**Assumptions:**
- Existing schema and Evolu client contracts are sufficient for browser queries/mutations.
- A correctness-first baseline can scale into broader UX without violating architectural boundaries.

**Contact Test:**
- Success-if: Browser workflows reliably persist through Evolu and are reflected back via CLI materialization without boundary violations.
- Failure-if: Read/write behavior is inconsistent, or browser code bypasses Evolu/CLI architecture.
- Measurement: End-to-end workflow validation across browser edit, Evolu propagation, and filesystem reflection.
- Timeline: Immediate after initial implementation baseline.

**Status:** Planned

---

### 2026-03-04 - Strengthen explicit conflict handling UX

**Aim:** Prevent silent overwrite during dirty-draft collisions and provide explicit resolution path.

**Claim:** Explicit conflict detection and guided resolution actions will preserve user intent while maintaining system-level conflict semantics.

**Assumptions:**
- Local editing state can be compared against incoming remote state to detect meaningful collisions.
- Conflict artifacts can follow existing `.conflict-<ownerId>-<timestamp>` naming without introducing hidden merge behavior.

**Contact Test:**
- Success-if: Dirty local edits are never silently overwritten and users can resolve conflicts through explicit actions.
- Failure-if: Hidden overwrite occurs or resolution flows produce inconsistent artifacts.
- Measurement: Targeted conflict scenario validation including propagation and artifact visibility.
- Timeline: After first production-like conflict exercises.

**Status:** Planned

---

### 2026-03-04 - Add mnemonic settings and owner recovery workflows

**Aim:** Make cross-device recovery and owner lifecycle actions explicit, safe, and discoverable in the PWA.

**Claim:** A dedicated settings surface for mnemonic visibility, restore, reset, and backup export will strengthen account safety without violating architecture boundaries.

**Assumptions:**
- Evolu owner APIs are sufficient for mnemonic reveal/restore/reset and local database export.
- Sensitive owner actions should be isolated from file editing workflows.

**Contact Test:**
- Success-if: Mnemonic is hidden by default, restore validates input, reset requires explicit confirmation, and backup export completes.
- Failure-if: Mnemonic exposure is accidental, restore/reset behavior is ambiguous, or owner actions bypass Evolu boundaries.
- Measurement: Manual workflow validation across settings actions and post-restore data visibility.
- Timeline: Immediate after settings page baseline is implemented.

**Status:** Planned

---

## Relationships to Other Centers

**Strengthens:**
- `centers/cli/src/file-sync/CENTER.md` - increases real-world traffic through Evolu <-> filesystem loops, exposing integration issues earlier.

**Strengthened by:**
- `centers/cli/src/file-sync/CENTER.md` - materializes PWA writes to disk and returns disk edits back to Evolu.
- `centers/cli/CENTER.md` - provides runtime commands and observability around sync behavior.

**Weakens:**
- None currently identified.

**Competes with:**
- Direct filesystem editing workflows in external editors for attention, but not as architectural replacement.

---

## Open Questions

- What default save model best balances responsiveness and conflict clarity?
- What minimum conflict interaction set is sufficient before adding advanced comparison tooling?
- How should conflict artifacts be represented in navigation so they stay visible without overwhelming normal file workflows?
- Should mnemonic settings remain a standalone page long-term or become part of a broader account center as observability features grow?
