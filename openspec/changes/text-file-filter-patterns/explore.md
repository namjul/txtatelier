# Explore: text-file-filter-patterns

## What we are noticing

The recent `markdown-as-txtfiles` change successfully added `.md` support by hardcoding two extensions in a Set. While this works, it revealed several patterns that could improve the text file filter system:

**Current implementation:**
```typescript
const TEXT_EXTENSIONS = new Set([".txt", ".md"]);
export const isTxtFile = (filePath: string): boolean =>
  TEXT_EXTENSIONS.has(extname(filePath).toLowerCase());
```

**What caught attention:**
1. Tests for the filter require 6 individual test cases — adding a new extension means adding more tests
2. The ignore system (`ignore.ts`) uses a nice pattern with `DEFAULT_IGNORE_PATTERNS` but extensions are hardcoded
3. There's no way for users to configure which extensions they want to sync
4. The filter is a one-off check — not composed with other potential filters
5. Path validation happens at runtime with plain strings — no type safety

## What we don't understand

- Which of these patterns would have the best ROI for this specific codebase?
- Would configuration-driven extensions actually be used, or is hardcoding sufficient?
- How often do we anticipate adding new text file extensions?
- Is the filter composition pattern overkill for a CLI tool, or does it enable future capabilities?
- Would branded types add too much ceremony for a small CLI project?
- What's the performance cost of content-based detection vs extension-based?

## What we want to poke at

**Pattern 1: Table-driven tests** — Rewrite the 6 individual filter tests as a single table-driven test with multiple cases. See if it improves maintainability.

**Pattern 2: Configuration-driven** — Add `textExtensions` to `FileSyncConfig` following the existing config pattern. See if it integrates cleanly.

**Pattern 3: Filter composition** — Create a composable filter pipeline that can chain `ignoreFilter`, `extensionFilter`, and future filters. See if it improves testability.

**Pattern 4: Branded types** — Create a `TextFilePath` branded type and see if it catches real bugs at compile time.

**Pattern 5: Content-based detection** — Explore using magic number detection for files with wrong extensions. Measure performance impact.

## What would make this worth a full intervention

**Any of these:**
1. A pattern demonstrably improves test maintainability (table-driven tests)
2. Users request configurable extensions (configuration-driven)
3. We need to add a third filter and composition would help (filter pipeline)
4. A bug occurs that branded types would have prevented (type safety)
5. Users need to sync files without standard extensions (content detection)

**Or:** Multiple patterns work well together and form a coherent improvement to the filter system architecture.

## Patterns Captured

See `gesture.md` for detailed pattern descriptions with trade-offs and implementation sketches.
