# Design: filesynccontext-refactor

## Approach

Bundle the three parameters that thread through every sync function—`evolu`, `watchDir`, and `filesOwnerId`—into a single `FileSyncContext` interface. Create a canonical `sync/context.ts` file that exports both the context interface and the `EvoluDatabase` type alias (currently duplicated across files).

The context object is constructed once in `file-sync/index.ts` immediately after resolving the owner session. All sync functions in the call chain receive `ctx: FileSyncContext` as their first parameter and destructure internally when needed.

Files to touch:
1. **Create** `sync/context.ts` — exports `EvoluDatabase` type and `FileSyncContext` interface
2. **Modify** `sync/executor.ts` — replace individual params with ctx; remove local type alias
3. **Modify** `sync/change-capture.ts` — same transformation
4. **Modify** `sync/state-materialization.ts` — same transformation
5. **Modify** `sync/startup-reconciliation.ts` — same transformation
6. **Modify** `sync/index.ts` — re-export `FileSyncContext` as public API
7. **Modify** `file-sync/index.ts` — construct context once, pass to all 5 call sites

## Rationale

**Why a context object instead of partial application or a class?**

- Partial application would create closure complexity and make testing harder (need to create bound functions)
- A class would introduce mutable state and `this` binding issues that don't exist with pure functions
- A plain context object keeps functions pure, testable, and explicit about dependencies

**Why not pass individual params selectively?**

Some functions only use 2 of the 3 params. But the cognitive overhead of remembering which function needs which parameter, combined with the inevitability of needing all three when extending functionality, makes the selective approach brittle. Every past extension to sync has needed all three parameters eventually.

**Why extract EvoluDatabase type to context.ts?**

Three files currently declare `type EvoluDatabase = Evolu<typeof Schema>`. Centralizing this eliminates duplication and makes the relationship between context and database type explicit.

## Load-bearing assumptions

1. **All three parameters are semantically related** — They represent "the sync environment": database connection, filesystem root, and ownership identity. If they turn out to have different lifecycles or concerns, bundling creates false coupling.

2. **Functions destructure, don't pass through** — Internal functions should destructure `const { evolu } = ctx` rather than passing `ctx` to deeper callees. This prevents deep context threading that would recreate the problem we're solving.

3. **Context is constructed at the boundary** — The context is built once where the sync loop starts (in `startFileSync`), not deep in the call chain. This maintains clear data flow.

## Risks and trade-offs

**Trade-off: Verbosity at call sites**
Creating a context object requires one extra line of code at construction time. This is traded for eliminating 4-5 signature changes per future extension.

**Risk: Over-bundling**
If we later need parameters with different lifecycles (e.g., a per-request transaction ID), we might need to split the context or add parallel parameter passing. We're betting that won't happen soon.

**Risk: Test mock complexity**
Tests currently pass individual mocks. They'll now need to construct minimal context objects. The mock burden shifts from "pass 3 separate values" to "construct 1 object with 3 fields" — roughly equivalent complexity.

## Out of scope

- Converting other CLI modules to use context objects (owner-session, etc.) — can follow this pattern later if it proves useful
- Adding actual new parameters to the context (epoch, conflictStrategy) — this refactor enables that, doesn't implement it
- Changing function implementations — only signatures and parameter access patterns change
- Changing types beyond the EvoluDatabase consolidation

## Known unknowns

- Will any tests mock partial functionality that needs ctx fields we haven't considered?
- Do any type guards or inference patterns depend on the current explicit parameter structure?
- Is there a future case where we'll need to pass ctx and an additional unrelated param together in a way that feels awkward?

## Co-variance

Beyond the obvious signature changes:
- Import statements will change across 6 files (add context.ts import, remove redundant Evolu imports where only the type was needed)
- JSDoc comments may reference parameters that need updating
- TypeScript's "unused parameter" detection might flag ctx in functions that destructure immediately — but destructuring counts as usage
- The pattern may inspire similar consolidation in owner-session handling

## ⚠ Design warnings

### Responsiveness
No user-facing changes. This is purely a developer ergonomics refactor. The system behaves identically; only the internal API surface changes.

### Continuity after correction
If the context bundling proves wrong, "correcting" would mean splitting ctx back into individual params. This would be mechanical but tedious across 6 files. The risk is contained to implementation time, not runtime behavior.

### Exploratory capacity
The context object is extensible by design — adding fields is the point. But if we add fields liberally, we may recreate the parameter bloat problem at the context level. Future additions should justify themselves as strongly as the original three parameters did.
