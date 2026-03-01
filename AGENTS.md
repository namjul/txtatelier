# Agent Instructions for txtatelier

This file provides coding guidelines for AI agents working on this local-first file synchronization system.

## Project Overview

**txtatelier** is a local-first, multi-device file sync system where:
- **Filesystem is canonical** - all truth resides on disk
- **Evolu** provides distributed replication
- **CLI** bridges filesystem ↔ Evolu with two independent sync loops
- **PWA** provides web editing interface (reads/writes only Evolu)

See [[PROJECT]] for architecture details and [[IMPLEMENTATION_PLAN]] for phases and [[STACK]] for choosen technologies.

---

## Workspace Structure

**Rule 1: Bun workspaces MUST be valid centers.**

Every workspace in `centers/` must justify itself as a center:
- Not every center needs to be a workspace (centers can be modules, patterns, concepts)
- Cannot create workspaces for utilities/organization without demonstrating organizing power

**Rule 2: Every explicit center MUST have a CENTER.md file.**

**Location:**
- Workspace centers: `centers/{center-name}/CENTER.md`
- Module centers: Colocated with code (e.g., `centers/cli/src/file-sync/CENTER.md`)

**What qualifies as a center?** See ATTRACTOR_PROTOCOL.md § Center (operational definition)

**Why these rules:**
- Aligns technical organization (workspaces) with conceptual organization (centers)
- Prevents utility bloat and arbitrary package proliferation
- Makes centers explicit and discoverable through CENTER.md files
- Tracks center evolution through documented interventions

**See:** CENTER_PLANNING.md for center documentation protocol

## Build, Lint, and Test Commands

### Setup
```bash
bun install              # Install dependencies
```

### Development
```bash
bun run dev              # Start development server
bun run build            # Build for production
bun run preview          # Preview production build
```

### Testing
```bash
bun test                 # Run all tests
bun test <file>          # Run single test file
bun test --watch         # Run tests in watch mode
bun test --coverage      # Run with coverage
```

### Linting and Formatting
```bash
bun run lint             # Run ESLint
bun run lint:fix         # Auto-fix linting issues
bun run format           # Run Prettier
bun run format:check     # Check formatting without changes
bun run typecheck        # Run TypeScript compiler check
```

### CLI Commands (when implemented)
```bash
bun run cli status       # Show sync status
bun run cli conflicts    # List conflict files
bun run cli sync         # Manually trigger sync
bun run cli doctor       # Diagnose issues
```

---

## Code Style Guidelines

### Imports

**Use named imports only:**
```typescript
import { createSignal, createEffect } from "solid-js";
import { hashContent, debounceFileWatch } from "./utils";
```

**Avoid namespaces** - use unique and descriptive names for exported members:
```typescript
// Avoid
export const Utils = { ok, trySync };

// Prefer
export const ok = ...;
export const trySync = ...;
```

### Style

- **Indentation:** 2 spaces (no tabs)
- **No trailing whitespace:** Including empty lines

### TypeScript

**Strictness:**
- Use strict mode (`strict: true` in tsconfig.json)
- No `any` types - use `unknown` and type guards
- Prefer `interface` for object shapes, `type` for unions/intersections
- Use explicit return types for exported functions
- Use arrow functions instead of `function` keyword (except for function overloads)

**Function definitions:**
```typescript
// Prefer arrow functions
export const computeHash = (content: string): string => {
  // Implementation
};

// Exception: function overloads require function keyword
export function mapArray<T, U>(
  array: NonEmptyReadonlyArray<T>,
  mapper: (item: T) => U,
): NonEmptyReadonlyArray<U>;
export function mapArray<T, U>(
  array: ReadonlyArray<T>,
  mapper: (item: T) => U,
): ReadonlyArray<U>;
export function mapArray<T, U>(
  array: ReadonlyArray<T>,
  mapper: (item: T) => U,
): ReadonlyArray<U> {
  return array.map(mapper) as ReadonlyArray<U>;
}
```

**Code organization (top-down readability):**
```typescript
// Public interface first: the contract developers rely on.
interface FileRecord {
  readonly path: string;
  readonly content: string;
  readonly contentHash: string;
  readonly updatedAt: number;
  readonly ownerId: string;
}

// Implementation after: how the contract is fulfilled.
export const createFileRecord = (data: FileData): FileRecord => {
  return {
    path: data.path,
    content: data.content,
    contentHash: computeHash(data.content),
    updatedAt: Date.now(),
    ownerId: data.ownerId,
  };
};

// Implementation details below the implementation.
const computeHash = (content: string): string => {
  // Implementation
};
```

**Immutability:**
- Use `readonly` for interface properties
- Use readonly types: `ReadonlyArray<T>`, `ReadonlySet<T>`, `ReadonlyRecord<K, V>`, `ReadonlyMap<K, V>`
- Use `NonEmptyReadonlyArray<T>` for non-empty arrays
- Use the `readonly` helper from `@evolu/common` to cast collections

```typescript
import { readonly, NonEmptyArray } from "@evolu/common";

// Interface with readonly properties
interface Example {
  readonly id: number;
  readonly items: ReadonlyArray<string>;
  readonly tags: ReadonlySet<string>;
}

// Using readonly helper
const items = readonly([1, 2, 3]);
// Type: NonEmptyReadonlyArray<number>

const ids = readonly(new Set(["a", "b"]));
// Type: ReadonlySet<string>
```

### Error Handling

**Principles:**
- Throw errors for programmer mistakes (wrong types, invalid config)
- Return Result types for expected failures (file not found, network issues)
- Log errors with context for debugging
- Never silently swallow errors

**Pattern:**
```typescript
// For expected failures, use Result pattern
type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };

function readFile(path: string): Result<string> {
  try {
    const content = Bun.file(path).text();
    return { ok: true, value: content };
  } catch (error) {
    return { ok: false, error: error as Error };
  }
}

// For programmer errors, throw
function invariant(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Invariant violation: ${message}`);
  }
}
```

### Comments

- **Avoid redundant comments** - code should be self-documenting
- **Document "why" not "what"** - explain reasoning, not mechanics
- **Use JSDoc for public APIs** - include examples where helpful
- **Mark TODOs clearly:** `// TODO(phase-3): Add conflict detection`

**Good:**
```typescript
// Prevents infinite sync loops by tracking last applied hash
const lastAppliedHash = new Map<string, string>();
```

**Bad:**
```typescript
// Create a map
const lastAppliedHash = new Map<string, string>();
```

---

## Architecture Guidelines

### Filesystem is Canonical

- **Never silently overwrite filesystem** - always create conflict files
- Users and external tools (editors, git) operate directly on files
- Evolu reflects filesystem state, not the other way around

### Two Independent Sync Loops

**Loop A (Filesystem → Evolu):**
- Watch filesystem changes with debouncing (50-200ms)
- Compute content hash and compare with Evolu
- Update Evolu row if hash differs

**Loop B (Evolu → Filesystem):**
- Watch Evolu changes (subscriptions)
- Check for conflicts before writing
- Update `lastAppliedHash` after applying changes

### Conflict Handling

Conflicts are **explicit and first-class**:
```
original-file.md
original-file.conflict-<ownerId>-<timestamp>.md
```

- Original file remains untouched
- Conflict files sync like any other file
- Users resolve conflicts manually

---

## Testing Guidelines

- **Unit tests:** For pure functions (hashing, validation, utilities)
- **Integration tests:** For sync loops and conflict scenarios
- Test file naming: `<module-name>.test.ts`
- Use descriptive test names: `test("creates conflict file when hashes differ")`

---

## Git Workflow

This project uses **Living Systems Commits** - a protocol that treats software as living structure, not mechanical assembly.

**Core principle:** Every non-trivial commit includes a **contact test** - specifying what would make the claim wrong.

**CRITICAL RULE: Only commit after the user was asked and explicitly confirmed it.**

Agents must:
1. Prepare changes (edit files, stage with `git add`)
2. Show proposed commit message to user
3. Wait for explicit user confirmation
4. Only then execute `git commit`

Never commit autonomously, even if changes seem complete.

**See [COMMIT_CONVENTION.md](./COMMIT_CONVENTION.md) for complete documentation.**

### Quick Reference

**Format:**
```
<type>(<scope>): <subject>
<body>
Center-Impact: ...
Contact: ...
```

**Common types:** `strengthen`, `create`, `dissolve`, `revision`, `simplify`, `refactor`, `chore`

**Required sections:**
- `Center-Impact:` for non-trivial changes (which centers strengthened/weakened/created/dissolved)
- `Contact:` with both `Success-if:` and `Failure-if:` conditions

**Contact test patterns for this project:**
- Self-experience: "I can modify code 1 week later without re-reading"
- Binary: "Tests pass, no behavior changes"
- Comparative: "Code reduces from 340 to <200 lines"
- Counting: "Zero crashes in 1 week of use"

**Example (minimal):**
```
strengthen(file-sync): reduce debounce to 50ms

Center-Impact:
  Strengthened: file-sync-loop - faster feedback

Contact:
  Success-if: Sync feels instant, CPU <5% increase
  Failure-if: High CPU or sync instability
  Timeline: 1 week
```

**Git configuration:**
```bash
git config commit.template .gitmessage
```

---

## Key Design Constraints

1. **No complex merge algorithms** - conflicts are explicit files
2. **No ancestry tracking** - rely only on `ownerId` and `lastAppliedHash`
3. **Deterministic behavior** - same inputs always produce same outputs
4. **Loop prevention** - check `row.ownerId === myOwnerId` to avoid echoes
5. **Atomic operations** - use temp-file + rename pattern for writes

---

## Implementation Phases

Follow IMPLEMENTATION_PLAN.md strictly:
- **Phase 0:** Foundations (single device, no replication)
- **Phase 1:** Add Loop B (single device)
- **Phase 2:** Multi-device replication
- **Phase 3:** Conflict detection
- **Phase 4:** Deletion handling
- **Phase 5:** Stability hardening
- **Phase 6:** PWA integration
- **Phase 7:** Edge case testing
- **Phase 8:** Observability (CLI commands)

Always implement features in phase order. Do not skip ahead.

---

## Questions or Clarifications

Refer to:
- PROJECT.md for architecture and principles
- STACK.md for technology choices
- IMPLEMENTATION_PLAN.md for detailed phases
- DOCS.md for external documentation links
