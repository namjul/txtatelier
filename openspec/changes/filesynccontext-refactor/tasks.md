## 1. Create Context Type

- [x] 1.1 Create `sync/context.ts` with `EvoluDatabase` type alias and `FileSyncContext` interface

## 2. Update Sync Functions

- [x] 2.1 Update `sync/executor.ts` — replace individual params with ctx, remove local EvoluDatabase
- [x] 2.2 Update `sync/change-capture.ts` — replace params with ctx, destructure internally
- [x] 2.3 Update `sync/state-materialization.ts` — replace params with ctx, remove local EvoluDatabase
- [x] 2.4 Update `sync/startup-reconciliation.ts` — replace params with ctx, remove local EvoluDatabase

## 3. Update Public API

- [x] 3.1 Add `FileSyncContext` re-export to `sync/index.ts`

## 4. Update Entry Point

- [x] 4.1 Import FileSyncContext type in `file-sync/index.ts`
- [x] 4.2 Construct syncCtx object after resolving ownerSession
- [x] 4.3 Replace all 5 call sites to use syncCtx instead of individual params

## 5. Verify

- [x] 5.1 Run tests: `cd centers/cli && npm test`
- [x] 5.2 Verify 86/88 tests pass (2 pre-existing failures remain)
- [x] 5.3 Type check passes: `cd centers/cli && npm run typecheck` or `bun run typecheck`
