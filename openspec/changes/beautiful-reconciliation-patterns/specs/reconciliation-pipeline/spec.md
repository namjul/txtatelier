# Delta Spec: reconciliation-pipeline

## What behavior is being added?

A reusable, composable pipeline abstraction for batch processing files during reconciliation. The pipeline supports:
- Lazy async iteration via generators
- Configurable batch sizing
- Concurrent processing within batches
- Streaming result aggregation
- Progress tracking via scan

## What behavior is changing?

The manual batch loops in `startup-reconciliation.ts` will be replaced with the pipeline abstraction. Function signatures remain compatible (preloading still supported), but internal implementation becomes composable.

Example transformation:
```typescript
// BEFORE: Manual batching repeated 4 times
for (let i = 0; i < files.length; i += CONCURRENCY) {
  await Promise.all(files.slice(i, i + CONCURRENCY).map(processFile));
}

// AFTER: Composable pipeline
await pipe(
  files,
  batch(CONCURRENCY),
  concurrentMap(processFile),
  reduce(aggregateStats, initialStats)
);
```

## What behavior is being removed?

Nothing. The pipeline is additive — existing functions remain, internal implementation becomes more elegant.

## What stays the same?

- Concurrency limits (20 files at a time)
- Error handling (continue on per-file errors, track in stats)
- Preloading optimization (still uses Maps for O(1) lookup)
- All external APIs remain unchanged
