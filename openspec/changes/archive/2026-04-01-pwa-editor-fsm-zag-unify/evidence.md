# Evidence: pwa-editor-fsm-zag-unify

## Contact test result

inconclusive

## Closure (2026-04-01)

**Implementation:** `tasks.md` §5 applied in `centers/pwa` (four-state session FSM, `classifyRemoteChange` from `@txtatelier/sync-invariants`, baseline / `lastPersistedHash` per [`CONFLICT_RULES.md`](./CONFLICT_RULES.md)). Root Vitest workspace runs PWA + `sync-invariants` + CLI tests.

**Protocol C:** `bun run test` at repo root passes (Vitest projects).

**Protocols A / B:** Not re-run for this archive; contact test remains **inconclusive** for the two-week user claim until explicit runs.

## What we observed

The **attractor-protocol** artifact chain completed; design and delta spec preceded implementation. Spurious-conflict hypothesis addressed by classification layer + single session chart.

## What held

- Automated regression suite green at archive time.
- Single Zag module for editor session phases; conflict entry only via `ROW_TRUE_DIVERGENCE`.

## What didn't hold

N/A for automated checks; field contact tests still open.

## What changed in our understanding of the system

Layer 3 is **`clean` / `dirty` / `saving` / `conflict`** with replication interpretation in the hook, not extra FSM states. Package rename to **`@txtatelier/sync-invariants`** post-dates original gesture text.

## What does this change about how we understand this

Normative editor session + conflict policy lives in **archived** change docs and **`openspec/specs/pwa-editor-session/spec.md`** after sync; run contact-test protocols when validating UX claims.
