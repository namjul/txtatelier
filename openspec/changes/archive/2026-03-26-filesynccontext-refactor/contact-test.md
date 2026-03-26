# Contact Test: filesynccontext-refactor

## Evidence tier
proximal

## What would success look like?
When adding a new parameter to the sync system (e.g., adding an `epoch` field for conflict detection to FileSyncContext), only one file requires modification: `sync/context.ts` to add the field to the interface. All 5 call sites and 4-5 function signatures in executor.ts, change-capture.ts, state-materialization.ts, and startup-reconciliation.ts pass the context through unchanged.

Specifically, the count of signature changes for adding one new sync parameter drops from:
- Current state: 4-5 function signatures + 5 call sites = ~9-10 changes
- After refactor: 1 interface definition change + 1 context construction site = ~2 changes

## What would falsify this claim?
- Any sync function in the call chain requires only a subset of (evolu, watchDir, filesOwnerId) parameters, forcing us to destructure ctx early or pass individual params alongside ctx
- Adding a new sync parameter still requires modifying 2+ function signatures beyond just the context interface
- The bundling creates coupling that makes tests significantly more complex (requiring full context objects when mocking)
- Developer still needs to touch 3+ files to add a new sync parameter despite having FileSyncContext

## How will we check?
1. Implement the FileSyncContext refactor per the plan
2. Create a test branch that adds a mock parameter (e.g., `epoch: number`) to FileSyncContext
3. Count files that require modification to support this new parameter:
   - Should be: context.ts (interface) + file-sync/index.ts (construction site) only
   - Measure: actual count of files with signature changes beyond these two
4. Verify all call sites (reconcileStartupEvoluState, reconcileStartupFilesystemState, captureChange, startStateMaterialization) pass ctx without destructuring into individual params
5. Run `cd centers/cli && npm test` to ensure 86/88 tests pass (2 pre-existing failures remain)

## When will we check?
Immediately after completing the refactor (same day), before moving to any new sync features. This validates the structural claim before we depend on it for future work.
