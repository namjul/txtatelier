# Gesture: text-file-filter-patterns

## Gesture type
exploration (feedback on `markdown-as-txtfiles`)

## What are we gesturing toward?
The text file filter system in `change-capture-plan.ts` and its surrounding architecture. This is an active component that determines what files enter the sync system.

## Claim
There are five distinct patterns that could improve the text file filter implementation. Each has different trade-offs. This exploration captures them for future reference so we can make informed decisions when needs arise.

## What made us do this?
After implementing `markdown-as-txtfiles`, the hardcoded extension check worked but felt like it could be more robust. Adding `.md` required:
1. Modifying the Set in the source
2. Updating 6 separate test cases
3. No ability for users to configure

The ignore system (`ignore.ts`) already has a nice configurable pattern — why don't extensions? And what other patterns could improve this?

## What are our load-bearing assumptions?

1. **Patterns are worth capturing before need arises** — when we need them, we'll have the analysis ready
2. **Not all patterns should be implemented** — some are speculative and should wait for concrete need
3. **The current implementation is sufficient for now** — these are improvements, not fixes

## Spec files this gesture touches

None yet. This is an exploration change capturing patterns for future use. If we decide to implement any pattern, it would create:
- `specs/txt-file-filter/spec.md` — if we modify the filter behavior
- `specs/file-sync-config/spec.md` — if we add configuration options

## Co-variance: what else might this touch?

- Test files would need updates for any pattern implemented
- `FileSyncConfig` interface if we add configuration
- Documentation that mentions supported file types

---

## Pattern 1: Table-Driven Tests

**Current state:** 6 individual test cases for extension filtering

```typescript
// Current — 6 separate tests
describe("text file filter", () => {
  test("WHEN non-text file...", () => { ... });
  test("WHEN non-text file has evolu record...", () => { ... });
  test("WHEN txt file...", () => { ... });
  test("WHEN uppercase .TXT...", () => { ... });
  test("WHEN md file...", () => { ... });  // Added recently
  test("WHEN uppercase .MD...", () => { ... });  // Added recently
});
```

**Proposed:**
```typescript
// Table-driven — one test, multiple cases
test.each([
  { path: "note.txt",    shouldSync: true,  reason: "txt extension" },
  { path: "note.md",     shouldSync: true,  reason: "md extension" },
  { path: "note.TXT",    shouldSync: true,  reason: "uppercase TXT" },
  { path: "note.MD",     shouldSync: true,  reason: "uppercase MD" },
  { path: "script.py",   shouldSync: false, reason: "python file" },
  { path: "image.png",   shouldSync: false, reason: "image file" },
  { path: "data.json",   shouldSync: false, reason: "json file" },
])("extension filter: $reason — $path", ({ path, shouldSync }) => {
  const state: ChangeCaptureState = {
    path,
    diskHash: "hash123",
    diskContent: "content",
    evolHash: null,
    evolId: null,
  };
  
  const plan = planChangeCapture(state);
  const hasInsert = plan.some((a) => a.type === "INSERT_EVOLU");
  
  expect(hasInsert).toBe(shouldSync);
});
```

**Benefits:**
- Adding new extensions requires one line, not a new test
- Clear visual table of what's supported
- Easier to see gaps (scan the table)

**Trade-offs:**
- Less granular test names in output
- All cases share the same test body (can't customize per case)

**When to use:** Next time we add an extension, or when we want to audit supported types.

---

## Pattern 2: Configuration-Driven Extensions

**Current state:** Extensions hardcoded in source

```typescript
const TEXT_EXTENSIONS = new Set([".txt", ".md"]);
```

**Proposed:** Follow `ignore.ts` pattern

```typescript
// In config.ts or constants.ts
export const DEFAULT_TEXT_EXTENSIONS = [
  ".txt",
  ".md",
] as const;

// In FileSyncConfig interface
interface FileSyncConfig {
  readonly dbPath: string;
  readonly watchDir: string;
  readonly relayUrl: string;
  readonly textExtensions?: ReadonlyArray<string>;  // Optional override
}

// Usage with fallback
const extensions = config.textExtensions ?? DEFAULT_TEXT_EXTENSIONS;
const extensionSet = new Set(extensions.map(e => e.toLowerCase()));
```

**Environment variable support:**
```typescript
// In env.ts
TXTATELIER_TEXT_EXTENSIONS: ".txt,.md,.rst"
```

**Benefits:**
- Users can add extensions without code changes
- Matches existing `DEFAULT_IGNORE_PATTERNS` pattern
- Environment variable support for power users

**Trade-offs:**
- Configuration complexity
- Validation needed (what if user passes invalid extensions?)
- Potential footgun (user adds `.exe`, sync breaks?)

**When to use:** If users request more extensions, or if we want parity with the ignore system.

---

## Pattern 3: Filter Composition Pipeline

**Current state:** Two separate, sequential checks

```typescript
if (isIgnoredRelativePath(state.path)) { return skip(...); }
if (!isTxtFile(state.path)) { return skip(...); }
```

**Proposed:** Composable pipeline

```typescript
type FilterResult = { 
  readonly pass: boolean; 
  readonly reason?: string;
  readonly action?: SyncAction;
};

type FileFilter = (path: string) => FilterResult;

const createFilterPipeline = (filters: ReadonlyArray<FileFilter>): FileFilter => 
  (path) => {
    for (const filter of filters) {
      const result = filter(path);
      if (!result.pass) return result;
    }
    return { pass: true };
  };

// Individual filters
const ignoreFilter: FileFilter = (path) => ({
  pass: !isIgnoredRelativePath(path),
  reason: "ignored-path",
});

const extensionFilter = (extensions: Set<string>): FileFilter => (path) => ({
  pass: extensions.has(extname(path).toLowerCase()),
  reason: "unsupported-extension",
});

// Composed
const textFileFilter = createFilterPipeline([
  ignoreFilter,
  extensionFilter(TEXT_EXTENSIONS),
  // Future: sizeFilter, encodingFilter, etc.
]);

// Usage
const result = textFileFilter(state.path);
if (!result.pass) {
  return skip(result.reason!, state.path);
}
```

**Benefits:**
- Extensible — add new filters without touching existing code
- Testable in isolation — each filter is a pure function
- Composable — can create different pipelines for different contexts

**Trade-offs:**
- Additional abstraction
- Slight performance overhead (array iteration)
- Might be overkill for current needs

**When to use:** If we add more filters (size limit, encoding check, etc.), or if we need different filter logic in different contexts.

---

## Pattern 4: Branded Types for Type Safety

**Current state:** Plain `string` for paths

```typescript
export const isTxtFile = (filePath: string): boolean => ...
const syncFile = (path: string, content: string): void => ...

// Any string can be passed
syncFile("some.md", content);  // OK at compile time, might fail at runtime
```

**Proposed:** Branded types

```typescript
// phantom types for type safety
type TextFilePath = string & { readonly __brand: "TextFilePath" };
type RelativePath = string & { readonly __brand: "RelativePath" };

// Validation returns branded type or null
const asTextFilePath = (path: string): TextFilePath | null =>
  isTxtFile(path) ? (path as TextFilePath) : null;

// Functions that need text files require branded type
const syncFile = (path: TextFilePath, content: string): void => { ... };
const updateEvolu = (
  id: string, 
  path: TextFilePath,  // Can't pass arbitrary string
  content: string, 
  hash: string
): void => { ... };

// Call site — compile-time error if not validated
syncFile("some.md", content);        // Error: Type 'string' not assignable to 'TextFilePath'
syncFile(asTextFilePath("some.md")!, content);  // OK

// Pipeline naturally flows through validation
const processFile = (rawPath: string) => {
  const validated = asTextFilePath(rawPath);
  if (!validated) return err("not-text-file");
  
  // Now TypeScript knows validated is TextFilePath
  return syncFile(validated, content);
};
```

**Benefits:**
- Compile-time guarantees
- Self-documenting APIs
- Catches errors at boundary
- Refactoring safety

**Trade-offs:**
- Adds ceremony (validation calls)
- Might feel verbose for a small CLI
- Need discipline to use branded types consistently

**When to use:** If we have bugs from passing unvalidated paths, or if the codebase grows and needs stronger contracts.

---

## Pattern 5: Content-Based Detection (Magic Numbers)

**Current state:** Trust file extensions

```typescript
const isTxtFile = (filePath: string): boolean =>
  TEXT_EXTENSIONS.has(extname(filePath).toLowerCase());
```

**Proposed:** Hybrid approach with content detection

```typescript
import { isText } from "istextorbinary";  // or implement ourselves

// Fast path: extension check first (no I/O)
const hasTextExtension = (path: string): boolean =>
  TEXT_EXTENSIONS.has(extname(path).toLowerCase());

// Slow path: content detection (requires read)
const isTextContent = async (absolutePath: string): Promise<boolean> => {
  const buffer = await readFile(absolutePath);
  return isText(null, buffer);  // Uses magic number detection
};

// Hybrid filter
const isTextFile = async (path: string): Promise<boolean> => {
  // Fast path: known extension
  if (hasTextExtension(path)) return true;
  
  // Slow path: check content for unknown extensions
  return isTextContent(path);
};
```

**Benefits:**
- Works with files that have wrong extensions
- Handles edge cases (`.txt` files that are actually binary)
- More robust for user-generated content

**Trade-offs:**
- Requires file read (I/O cost)
- Slower than extension check
- Async vs sync complexity
- Adds dependency

**When to use:** If users report files not syncing due to wrong extensions, or if we want maximum robustness and can accept performance cost.

---

## Comparison Matrix

| Pattern | Implementation Cost | Runtime Cost | User Value | Maintenance Benefit |
|---------|-------------------|--------------|------------|-------------------|
| Table-driven tests | Low | None | None | High |
| Configuration-driven | Medium | None | High | Medium |
| Filter composition | Medium | Low | None | High |
| Branded types | Low | None | None | High |
| Content detection | High | High | Medium | Low |

---

## Recommendation

**Do now:** Pattern 1 (table-driven tests) — low cost, immediate benefit to test maintainability

**Wait for signal:**
- Pattern 2 (configuration) — if users request more extensions
- Pattern 3 (composition) — if we add more filters
- Pattern 4 (branded types) — if we have path-related bugs
- Pattern 5 (content detection) — if extension-only proves insufficient

**Keep as reference:** This exploration document for when needs arise.
