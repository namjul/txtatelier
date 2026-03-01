# CLI Center

**Status:** Proposed
**Created:** 2026-03-01
**Last Updated:** 2026-03-01

---

## What This Center Does

Command-line interface for txtatelier. Provides user commands for sync operations, conflict management, and system observability.

Currently: Blank canvas - no functionality implemented.

## Installation

```bash
# From repository root
bun install

# Run CLI
bun run --cwd centers/cli start
```

## Center Definition

### Hypothesis

The CLI center will organize user interaction with the file sync system,
providing commands for status, conflict resolution, and manual sync triggers.

**This center:**
- Provides command-line interface for users (when implemented)
- Orchestrates file-sync and evolu-sync centers (Phase 0+)
- Offers observability commands (Phase 8)

**Contact test for "will this become a center?"**
- Success-if: Users rely on CLI commands daily, removing it blocks workflow
- Failure-if: CLI is just thin wrapper, could be replaced with shell scripts

### Current Strength

Proposed - blank canvas only, no functionality

**Evidence:**
- None yet - awaiting Phase 0 implementation

---

## Planned Interventions

### 2026-03-01 - Create Blank Canvas

**Aim:** Establish CLI workspace structure before Phase 0 implementation

**Claim:** Creating workspace structure now enables Phase 0 work to begin immediately

**Status:** In Progress

---

## Relationships to Other Centers

**Will orchestrate:**
- file-sync (Phase 0) - trigger sync operations
- evolu-sync (Phase 1) - coordinate both sync loops
- conflict-handler (Phase 3) - provide conflict resolution commands

**Will be strengthened by:**
- workspace-center-field - validates CLI as legitimate center

---

## Open Questions

- Which CLI framework to use? (commander, yargs, or custom)
- How granular should commands be?
- Should CLI have interactive mode or just commands?

---

## Development

```bash
# Watch mode
bun run --cwd centers/cli dev

# Run once
bun run --cwd centers/cli start

# Run tests (when added)
bun run --cwd centers/cli test
```
