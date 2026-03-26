## Why

Current file-sync implementation tightly couples sync decision logic with I/O operations (filesystem, Evolu database), making it difficult to test critical sync scenarios without full infrastructure. Tests require real databases, filesystem operations, and async delays (500ms+), making them slow and brittle. Pure sync logic (conflict detection, change decisions, reconciliation strategies) cannot be validated independently from side effects.

## What Changes

- Extract sync decision logic into pure planning functions that return action plans as data
- Separate plan execution (side effects) from plan generation (pure logic)
- Define sync actions as discriminated union types using Evolu's Type system for validation
- Create state collector layer that gathers filesystem/Evolu state for planning
- Add comprehensive unit tests for pure planning functions (no I/O required)
- Refactor change-capture, state-materialization, and startup-reconciliation to plan-execute pattern
- Keep existing integration tests for end-to-end validation

## Capabilities

### New Capabilities
- `plan-execute-sync`: Core plan-execute pattern for sync operations - planning functions receive state, return action plans; executor dispatches actions to I/O layer
- `sync-actions`: Discriminated union types representing all sync operations (write file, delete, create conflict, update Evolu, etc.) with Evolu Type validation
- `state-collection`: Pure data structures representing filesystem/Evolu state snapshots; collectors gather state for planning functions
- `pure-sync-tests`: Fast unit tests for sync logic without I/O - test conflict detection, reconciliation decisions, action sequencing

### Modified Capabilities
<!-- No existing capabilities have requirement changes - this is an internal refactor that maintains the same external behavior -->

## Impact

**Code:**
- `centers/cli/src/file-sync/sync/` - Complete refactor of sync modules
  - New: `actions.ts`, `state-types.ts`, `state-collector.ts`, `executor.ts`
  - Refactored: `change-capture.ts`, `state-materialization.ts`, `startup-reconciliation.ts`
  - New: `*-plan.ts` files for pure planning logic
- Test files - Add `*-plan.test.ts` for pure function tests, keep existing `*.test.ts` integration tests

**Dependencies:**
- No new runtime dependencies (uses existing Evolu Type system)
- No changes to Evolu schema or external APIs

**Performance:**
- Improved: Unit tests run in <10ms vs 1500ms+ for integration tests
- Same: Runtime performance unchanged (same operations, just reorganized)

**Breaking Changes:**
- None - internal refactor only, same external API
