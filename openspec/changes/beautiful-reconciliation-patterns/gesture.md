# Gesture: beautiful-reconciliation-patterns

## Gesture type
strengthen

## What are we gesturing toward?
The startup reconciliation system in `startup-reconciliation.ts`. Currently uses repetitive manual batching patterns that could be more elegant.

## Claim
Applying data-oriented programming patterns (from the "dope" library style) will make the reconciliation code more composable, testable, and beautiful while maintaining performance.

## What made us do this?
The recent performance optimization added significant value but introduced repetitive boilerplate:
- Manual batch loops repeated 4+ times
- Map preloading plumbing through multiple function signatures
- Sequential error collection logic

The "dope" library shows beautiful patterns: generators for lazy iteration, pipe for composition, scan for state tracking.

## What are our load-bearing assumptions?

1. **Generators are efficient** — lazy evaluation won't harm performance
2. **Composition is clearer** — pipe/flow is more readable than nested loops
3. **TypeScript can express this** — no need for runtime overhead

## Spec files this gesture touches

- `specs/reconciliation-pipeline/spec.md` — composable pipeline for file processing

## Co-variance: what else might this touch?

- Error handling patterns throughout sync system
- Test patterns for batch operations
- Future filter composition needs

---

## Patterns to Implement

Based on https://github.com/gordonbrander/dope:

### 1. **pipe** — Left-to-right composition
Replace nested function calls with linear data flow

### 2. **batchAsync** — Generator-based batching  
Replace manual `for (let i = 0; i < len; i += batchSize)` loops

### 3. **scan** — Stream of states
Replace manual progress tracking counters

### 4. **mapAsync/filterAsync** — Lazy async iteration
Replace eager Promise.all arrays

### 5. **reduceAsync** — Aggregating results
Replace manual error array building
