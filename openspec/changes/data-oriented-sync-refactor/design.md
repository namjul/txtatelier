## Context

The file-sync center implements bidirectional sync between filesystem and Evolu CRDT database. Current implementation directly interleaves sync logic (conflict detection, change decisions) with I/O operations (filesystem reads/writes, database queries/mutations).

**Current state:**
- `captureChange()` - reads file, computes hash, queries Evolu, mutates Evolu (all in one function)
- `syncEvoluRowToFile()` - queries state, detects conflicts, writes files (all in one function)
- Tests require full infrastructure: temp directories, Evolu database, 500ms+ async delays

**Constraints:**
- Filesystem is canonical - never silently overwrite
- Two independent sync directions: change capture (Filesystem → Evolu), state materialization (Evolu → Filesystem)
- Explicit conflict handling via conflict files
- Must maintain exact same external behavior (no breaking changes)

**Stakeholders:**
- Existing integration tests must continue passing
- CLI users expect same sync behavior
- Future developers need testable, maintainable sync logic

## Goals / Non-Goals

**Goals:**
- Enable testing sync decision logic without I/O infrastructure (pure function tests in <10ms)
- Separate "what should happen" (planning) from "make it happen" (execution)
- Make sync operations explicit as inspectable data structures
- Improve code clarity by separating concerns
- Enable future enhancements (dry-run mode, plan introspection, action replay)

**Non-Goals:**
- Change external sync behavior or conflict handling rules
- Modify Evolu schema or database structure
- Add new runtime dependencies beyond existing Evolu
- Optimize runtime performance (same operations, just reorganized)
- Support bidirectional transformations or complex merge algorithms

## Decisions

### Decision 1: Use Evolu Type System Instead of External Validation Library

**Choice:** Use Evolu's Type system for action/state validation instead of dope/contract.js

**Rationale:**
- Evolu Type is already a dependency and provides sophisticated validation via `object()`, `brand()`, `nullOr()`
- Returns `Result<T, Error>` for composable error handling (same pattern we already use)
- Supports branded types for semantic constraints (e.g., `NonEmptyString100` for hashes)
- Provides type guards (`.is()`), runtime validation (`.from()`), and error formatters
- More powerful than dope's contract.js (branded types, error composition, Standard Schema support)

**Alternatives considered:**
- dope/contract.js - Simpler but less powerful, would add dependency for overlapping functionality
- No validation - Rely only on TypeScript types, lose runtime safety in tests

### Decision 2: Three-Layer Architecture (Data → Planning → Execution)

**Architecture:**
```
Layer 1: Data Structures (state-types.ts, actions.ts)
  ↓
Layer 2: Pure Planning Functions (*-plan.ts)
  ↓
Layer 3: Execution (state-collector.ts, executor.ts)
```

**Rationale:**
- Clear separation of concerns: data definition, logic, side effects
- Pure planning functions are trivial to test (no mocks, no I/O)
- State collectors isolate I/O complexity from decision logic
- Executor becomes simple dispatcher (no business logic)

**Alternatives considered:**
- Two layers (state + execution with embedded logic) - Harder to test, couples decisions to I/O
- Four layers (+ validation layer) - Over-engineered for this use case

### Decision 3: Discriminated Union Actions with Switch Dispatch

**Choice:** Use TypeScript discriminated unions for actions, dispatch with switch statements

**Rationale:**
- TypeScript provides exhaustiveness checking (compiler error if missing case)
- Better IDE support (autocomplete, jump to definition) than singledispatch pattern
- No runtime overhead compared to function dispatch tables
- Simple, debuggable execution path

**Example:**
```typescript
type SyncAction =
  | { type: "WRITE_FILE"; path: string; content: string; hash: string }
  | { type: "DELETE_FILE"; path: string }
  | { type: "SKIP"; reason: string; path: string }

const executeAction = async (action: SyncAction): Promise<Result<void, Error>> => {
  switch (action.type) {
    case "WRITE_FILE": return writeFileAtomic(action.path, action.content);
    case "DELETE_FILE": return unlink(action.path);
    case "SKIP": return ok();
  }
}
```

**Alternatives considered:**
- dope/singledispatch - More functional but loses exhaustiveness checking, worse IDE support
- Class hierarchy with polymorphism - Over-engineered, not idiomatic for this codebase

### Decision 4: Readonly Arrays for Action Plans

**Choice:** Planning functions return `readonly SyncAction[]`

**Rationale:**
- Plans are immutable data (no mutation after generation)
- TypeScript `readonly` enforces immutability at compile time
- No runtime overhead (vs dope/freeze which adds Object.freeze() calls)
- Consistent with existing codebase patterns

**Alternatives considered:**
- dope/freeze for runtime immutability - Unnecessary overhead when TypeScript already prevents mutation
- Mutable arrays - Could accidentally mutate plans, loses safety

### Decision 5: State Collectors Isolate I/O from Planning

**Choice:** Create separate `collectChangeCaptureState()` and `collectMaterializationState()` functions that gather all required state, return `Result<State, Error>`

**Rationale:**
- Planning functions receive complete state snapshot, no I/O during planning
- Collectors handle all error-prone I/O in one place
- Easy to mock state for testing (just construct state objects)
- Clear boundary between I/O layer and pure logic layer

**Example flow:**
```typescript
// Collector (I/O)
const stateResult = await collectChangeCaptureState(evolu, watchDir, path);
if (!stateResult.ok) return stateResult;

// Planner (pure)
const plan = planChangeCapture(stateResult.value);

// Executor (I/O)
await executePlan(evolu, watchDir, plan);
```

**Alternatives considered:**
- Planning functions do their own I/O - Couples logic to side effects, hard to test
- Pass database/filesystem handles to planners - Still requires mocking, not truly pure

### Decision 6: Keep Existing Integration Tests

**Choice:** Add new unit tests for planning functions, keep existing integration tests unchanged

**Rationale:**
- Integration tests validate end-to-end behavior (filesystem + Evolu + debouncing)
- Refactor is internal - external behavior must remain identical
- Unit tests provide fast feedback on logic, integration tests ensure correctness
- Regression safety: if refactor changes behavior, integration tests will catch it

**Test strategy:**
- Unit tests (`*-plan.test.ts`): Test planning logic with constructed state objects (<10ms each)
- Integration tests (`index.test.ts`): Verify full sync flow with real I/O (keep existing)

## Risks / Trade-offs

**[Risk] More code complexity from three-layer architecture**
→ **Mitigation:** Clear naming conventions (*-plan.ts, state-collector.ts, executor.ts) and comprehensive documentation. Trade-off accepted for testability gains.

**[Risk] State collectors might not capture all relevant state**
→ **Mitigation:** Integration tests validate end-to-end behavior. If collector misses state, integration tests will fail.

**[Risk] Action types could grow unwieldy (many variants)**
→ **Mitigation:** Group related actions (FileSystemAction, EvoluAction, StateAction, MetaAction). TypeScript discriminated unions scale well to 10-20 variants.

**[Risk] Pure planning functions might need async operations later**
→ **Mitigation:** Planning functions are synchronous by design. If future needs require async, refactor at that time. Current sync logic is deterministic and doesn't need async.

**[Risk] Refactor might introduce subtle behavior changes**
→ **Mitigation:** Existing integration tests validate behavior. Run full test suite before/after refactor to ensure identical behavior.

**[Trade-off] More files and indirection**
→ **Benefit:** Testability, maintainability, clarity of responsibilities. Worth the extra navigation.

**[Trade-off] State collector duplicates some state gathering logic**
→ **Benefit:** Isolation of I/O from logic. Small duplication acceptable for clean separation.

## Migration Plan

**Phase 1: Create new modules (non-breaking)**
- Add `actions.ts`, `state-types.ts`, `state-collector.ts`, `executor.ts`
- Add `*-plan.ts` files with pure planning functions
- Add `*-plan.test.ts` unit tests

**Phase 2: Refactor existing modules**
- Update `change-capture.ts` to use plan-execute pattern (same external API)
- Update `state-materialization.ts` to use plan-execute pattern (same external API)
- Update `startup-reconciliation.ts` to use plan-execute pattern (same external API)

**Phase 3: Validation**
- Run existing integration tests - must all pass
- Run new unit tests - comprehensive coverage of planning logic
- Manual smoke test: sync files between two devices

**Rollback strategy:**
- Git revert commit if integration tests fail
- No database migrations or schema changes, so rollback is safe
- Internal refactor only - no API changes to reverse

## Open Questions

None - design is clear and constraints are well understood from existing implementation.
