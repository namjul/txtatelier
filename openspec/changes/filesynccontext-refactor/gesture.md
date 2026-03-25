# Gesture: filesynccontext-refactor

## Gesture type
simplify

## What are we gesturing toward?
sync-call-chain — the parameter-passing pattern through executor, change-capture, state-materialization, and startup-reconciliation

## Claim
Developers adding new sync functionality will need to modify 0 function signatures in the call chain (versus 4-5 currently), because FileSyncContext bundles the three required parameters.

## What made us do this?
The sync call chain threads (evolu, watchDir, filesOwnerId) through every function. Adding a fourth parameter (e.g., epoch number for conflict detection, or conflictStrategy) would require updating 4-5 function signatures across 6 files. The current structure creates friction for extending sync behavior.

## Load-bearing assumptions

1. The three parameters (evolu, watchDir, filesOwnerId) are required together at every call site in the sync flow
2. No sync function needs only a subset of these parameters (if so, bundling forces unnecessary coupling)
3. The EvoluDatabase type alias is currently redeclared in multiple files (sync/executor.ts, sync/state-materialization.ts, sync/startup-reconciliation.ts), creating duplication

## Structures this gesture touches

### New structures
- structures/file-sync-context/ — container for sync state passed through the call chain
- structures/evolu-database-type/ — canonical type alias for Evolu<typeof Schema>

### Anticipated co-variances
- structures/sync-call-chain/ — parameter signatures throughout will change from individual params to ctx

## Co-variance

What else might shift:
- Test mocks may need to create FileSyncContext objects instead of passing individual params
- Type imports will centralize through sync/context.ts
- sync/index.ts will re-export FileSyncContext as part of public API
- The context object pattern may inspire similar refactors in other CLI modules (e.g., owner-session contexts)

If future sync features need additional state (epoch counter, conflict resolution strategy, feature flags), they can be added to FileSyncContext without signature churn.
