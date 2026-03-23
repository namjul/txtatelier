# Exploration: Beautiful Reconciliation Patterns

Exploring data-oriented programming (DOP) patterns from the [dope library](https://github.com/gordonbrander/dope) to make the reconciliation code more beautiful, composable, and maintainable.

## Current Pain Points

The recent performance optimization added value but introduced repetitive code:

```typescript
// Pattern repeated 4+ times in startup-reconciliation.ts
for (let i = 0; i < files.length; i += CONCURRENCY) {
  await Promise.all(files.slice(i, i + CONCURRENCY).map(processFile));
}

// Manual Map plumbing through call chains
processFile(file, syncStateMap.get(file.path))
  -> captureChange(..., preloadedHash)
    -> collectState(..., preloadedHash)
```

This is imperative, hard to test, and doesn't compose.

---

## Pattern 1: Generator-Based Batching (batchConcurrent)

Replace manual slicing with lazy async generators.

### Code

```typescript
// centers/cli/src/file-sync/utils/pipeline.ts

/**
 * Batch and process concurrently in one operation.
 * Combines batching + concurrentMap for convenience.
 */
export async function* batchConcurrent<T, U>(
  iterable: Iterable<T> | AsyncIterable<T>,
  transform: (item: T) => Promise<U>,
  batchSize: number
): AsyncGenerator<U, void, void> {
  let currentBatch: T[] = [];

  for (const value of iterable) {
    currentBatch.push(value);
    if (currentBatch.length >= batchSize) {
      const results = await Promise.all(currentBatch.map(transform));
      for (const result of results) {
        yield result;
      }
      currentBatch = [];
    }
  }

  if (currentBatch.length > 0) {
    const results = await Promise.all(currentBatch.map(transform));
    for (const result of results) {
      yield result;
    }
  }
}
```

### Usage

```typescript
// BEFORE: Manual batch loop
for (let i = 0; i < filesToReconcile.length; i += 20) {
  await Promise.all(
    filesToReconcile.slice(i, i + 20).map(processFile)
  );
}

// AFTER: Generator-based
for await (const _ of batchConcurrent(
  filesToReconcile,
  async (file) => processFile(file),
  20
)) {
  // Results processed as they complete
}
```

### Benefits
- **Lazy evaluation**: Items processed on-demand
- **Memory efficient**: No intermediate arrays of all results
- **Composable**: Can chain with other generators
- **Testable**: Pure function, easy to unit test

### Trade-offs
- Slightly more abstract than familiar loops
- Requires understanding of generators

---

## Pattern 2: Function Composition (pipe)

Data flows left-to-right through transformations.

### Code

```typescript
// centers/cli/src/file-sync/utils/pipeline.ts

/**
 * Pipe a value through a series of functions (left to right).
 */
export const pipe = <T>(value: T, ...fns: Array<(arg: any) => any>): any =>
  fns.reduce((acc, fn) => fn(acc), value);
```

### Usage

```typescript
// BEFORE: Nested function calls
const result = aggregateStats(
  collectErrors(
    await batchProcess(
      filterIgnored(files)
    )
  )
);

// AFTER: Linear data flow
const result = await pipe(
  files,
  filterIgnored,
  batch(20),
  concurrentMap(processFile),
  collectErrors,
  aggregateStats
);
```

### Benefits
- **Readable**: Data flows left-to-right
- **Composable**: Each function is independent and reusable
- **No nesting**: Flat structure vs pyramid of doom

### Trade-offs
- TypeScript inference can be tricky with complex chains
- Requires all functions to have compatible signatures

---

## Pattern 3: Scan for Progress Tracking

Stream of intermediate states instead of manual counters.

### Code

```typescript
// centers/cli/src/file-sync/utils/pipeline.ts

/**
 * Scan over an iterable, yielding intermediate states.
 * Like reduce but emits each step.
 */
export async function* scanAsync<T, U>(
  iterable: AsyncIterable<T>,
  step: (state: U, value: T) => Promise<U>,
  initial: U
): AsyncGenerator<U, void, void> {
  let state = initial;
  for await (const value of iterable) {
    state = await step(state, value);
    yield state;
  }
}
```

### Usage

```typescript
// BEFORE: Manual progress tracking
let processed = 0;
for (const file of files) {
  await processFile(file);
  processed++;
  if (processed % 100 === 0) {
    logProgress(processed, total);
  }
}

// AFTER: Stream of states
for await (const stats of scanAsync(
  toAsyncIterable(files),
  async (acc, file) => ({
    processed: acc.processed + 1,
    succeeded: acc.succeeded + (await processFile(file) ? 1 : 0)
  }),
  { processed: 0, succeeded: 0 }
)) {
  if (stats.processed % 100 === 0) {
    logProgress(stats);
  }
}
```

### Benefits
- **Immutable states**: Each state is a snapshot
- **Observable**: Can tap into progress at any point
- **Functional**: No mutable counters

### Trade-offs
- More memory allocations (new state objects)
- Can be overkill for simple counting

---

## Pattern 4: Lazy Filter and Map

Process only what you need, when you need it.

### Code

```typescript
// centers/cli/src/file-sync/utils/pipeline.ts

export async function* filterAsync<T>(
  iterable: AsyncIterable<T>,
  predicate: (value: T) => Promise<boolean>
): AsyncGenerator<T, void, void> {
  for await (const value of iterable) {
    if (await predicate(value)) {
      yield value;
    }
  }
}

export async function* mapAsync<T, U>(
  iterable: AsyncIterable<T>,
  transform: (value: T) => Promise<U>
): AsyncGenerator<U, void, void> {
  for await (const value of iterable) {
    yield await transform(value);
  }
}
```

### Usage

```typescript
// Compose filtering, mapping, and batching
const processedFiles = pipe(
  toAsyncIterable(allFiles),
  filterAsync(async (file) => !isIgnored(file.path)),
  mapAsync(async (file) => ({
    ...file,
    hash: await computeHash(file.path)
  })),
  batchConcurrent(async (file) => syncToEvolu(file), 20)
);
```

### Benefits
- **Memory efficient**: No intermediate arrays
- **Composable**: Chain operations elegantly
- **Lazy**: Nothing happens until you consume the generator

### Trade-offs
- Async generators have slight overhead
- Error handling requires try/catch at consumption point

---

## Pattern 5: Reduce for Aggregation

Collect results into a final value.

### Code

```typescript
// centers/cli/src/file-sync/utils/pipeline.ts

export async function reduceAsync<T, U>(
  iterable: AsyncIterable<T>,
  step: (state: U, value: T) => Promise<U>,
  initial: U
): Promise<U> {
  let state = initial;
  for await (const value of iterable) {
    state = await step(state, value);
  }
  return state;
}
```

### Usage

```typescript
// Aggregate all results into stats
const finalStats = await reduceAsync(
  batchConcurrent(files, processFile, 20),
  async (stats, result) => ({
    processed: stats.processed + 1,
    failed: stats.failed + (result.ok ? 0 : 1),
    errors: result.ok
      ? stats.errors
      : [...stats.errors, result.error]
  }),
  { processed: 0, failed: 0, errors: [] }
);
```

### Benefits
- **Declarative**: "Reduce this stream to a summary"
- **Immutable accumulator**: Each step returns new state
- **Type-safe**: Accumulator type is explicit

---

## Complete Example: Beautiful Reconciliation

Putting it all together:

```typescript
// centers/cli/src/file-sync/sync/startup-reconciliation.ts

import {
  pipe,
  toAsyncIterable,
  filterAsync,
  batchConcurrent,
  scanAsync,
  reduceAsync,
} from "../utils/pipeline";

export const reconcileStartupFilesystemState = async (
  evolu: EvoluDatabase,
  watchDir: string,
): Promise<Result<ReconcileStats, ReconcileFatalError>> => {
  // ... setup code ...

  // Preload data (still using Maps for O(1) lookup)
  const fileRecordsMap = await preloadFileRecords(evolu);
  const existingPaths = new Set(fileRecordsMap.keys());

  // Beautiful pipeline: declarative data flow
  const finalStats = await pipe(
    filesToReconcile,
    toAsyncIterable,
    filterAsync(async (path) => isTextFile(path)),
    batchConcurrent(async (absolutePath) => {
      const relativePath = relative(watchDir, absolutePath);
      const preloaded = fileRecordsMap.get(relativePath);

      const result = await captureChange(evolu, watchDir, absolutePath, preloaded);

      return {
        path: absolutePath,
        ok: result.ok,
        error: result.ok ? null : result.error,
        isNew: !existingPaths.has(relativePath),
      };
    }, 20),
    reduceAsync(
      async (stats, result) => ({
        processed: stats.processed + 1,
        failed: stats.failed + (result.ok ? 0 : 1),
        inserted: stats.inserted + (result.ok && result.isNew ? 1 : 0),
        errors: result.ok
          ? stats.errors
          : [...stats.errors, { path: result.path, error: result.error }],
      }),
      { processed: 0, failed: 0, inserted: 0, errors: [] }
    )
  );

  return ok(finalStats);
};
```

## Comparison

| Aspect | Before | After |
|--------|--------|-------|
| **Batching** | Manual slicing (4x repeated) | `batchConcurrent` utility |
| **Filtering** | Array.filter (eager) | `filterAsync` (lazy) |
| **Aggregation** | Manual counters | `reduceAsync` declarative |
| **Progress** | Manual logging | `scanAsync` stream |
| **Composability** | Low (copy-paste) | High (pipe functions) |
| **Testability** | Hard (nested loops) | Easy (pure functions) |

## Recommendation

Start with **Pattern 1 (batchConcurrent)** - it's the biggest win with minimal disruption. Then consider **Pattern 2 (pipe)** for new code. Reserve **Pattern 3 (scanAsync)** for when you need real-time progress tracking.

All patterns maintain:
- Same concurrency limits
- Same error handling (continue on per-file errors)
- Same preloading optimization
- All existing tests pass
