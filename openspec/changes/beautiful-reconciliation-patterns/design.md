# Design: beautiful-reconciliation-patterns

## Approach

Create a small utility module with generator-based pipeline functions inspired by the "dope" library. Apply these to replace manual batch loops in startup reconciliation.

## Why this approach?

The "dope" library demonstrates that data-oriented programming patterns (generators, composition) can be both elegant and efficient. Manual batch loops are repetitive and don't compose.

## What are our load-bearing assumptions?

1. **Generators are performant** — JavaScript generators have low overhead
2. **Composition beats repetition** — One `batch()` function is better than 4 copy-pasted loops
3. **TypeScript inference works** — Generators maintain proper typing

## Risks and trade-offs

- **Risk:** Generators add abstraction that might confuse debugging
  - Mitigation: Keep functions small and well-named
- **Trade-off:** Pipeline syntax vs familiar loops
  - Some developers find loops more intuitive than functional composition

## What we are not doing

- Not changing external APIs
- Not removing preloading optimization (still using Maps)
- Not adding new dependencies (implementing patterns ourselves)

## Known unknowns

None. Patterns are proven (dope library), scope is narrow.

## Co-variance: what else might this touch?

- Other batch operations in the codebase (watch queue, state materialization)
- Could enable more elegant filter composition later
