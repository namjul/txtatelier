# CLI Code Review: Refactoring Opportunities

**Source:** Review of `git diff main...HEAD` for interactive CLI features (shortcuts, session lifecycle, AbortSignal integration)

**Scope:** `centers/cli/src/` - file-sync/index.ts, shortcuts.ts, interactive-logger.ts, state-materialization.ts

---

## High Impact (Complexity Reduction)

### 1. Extract Session Commands to Separate Module

**File:** `file-sync/index.ts` (~400 lines of session methods)

**Problem:** `startFileSync()` is now 400+ lines with 6 new interactive commands embedded directly:
- `showMnemonic`
- `showStatus`
- `restoreMnemonic`
- `resetOwner`
- `clearConsole`
- `quit`

**Current State:**
All commands are defined inline within `startFileSync()`, bloating the function and mixing orchestration with implementation.

**Proposal:**
Extract to `centers/cli/src/commands/`:

```typescript
// commands/index.ts
export interface CommandContext {
  readonly session: OwnerSession;
  readonly logger: Logger;
  readonly cliShortcutInfo: (...args: unknown[]) => void;
}

export const createShowMnemonicCommand = (ctx: CommandContext) => async () => { 
  // implementation
}

export const createRestoreMnemonicCommand = (ctx: CommandContext) => async (readLine: ReadLineFn) => { 
  // implementation
}

// etc.
```

**Benefit:**
- `startFileSync()` becomes ~150 lines of orchestration only
- Commands become independently testable
- Clear separation between session lifecycle and command logic

---

### 2. Collapse interactive-logger Repetition

**File:** `interactive-logger.ts` (lines 72-115)

**Problem:** Methods `info`, `warn`, `error`, `printStartupBanner` all repeat the same `syncWithPrompt` boilerplate:

```typescript
// Repeated 4 times:
if (rl) {
  syncWithPrompt(() => { console.X(...args); });
} else {
  console.X(...args);
}
```

**Proposal:**
Factory function:

```typescript
const createSyncMethod = (
  rl: readline.Interface | null,
  baseFn: (...args: unknown[]) => void
) => (...args: unknown[]): void => {
  if (rl) {
    syncWithPrompt(() => baseFn(...args));
  } else {
    baseFn(...args);
  }
};

// Usage:
info: createSyncMethod(rl, console.info),
warn: createSyncMethod(rl, console.warn),
error: createSyncMethod(rl, baseLogger.error),
```

**Lines saved:** ~30 lines of duplication
**Benefit:** Single point of change for readline synchronization logic

---

### 3. State Materialization Flow Abstraction

**File:** `state-materialization.ts` (lines 132-275)

**Problem:** `runDebouncedMaterialization` is ~140 lines with 8 `bailIfDisposed()` checkpoints interleaved with business logic.

**Current Pattern:**
```typescript
const runDebouncedMaterialization = async (): Promise<void> => {
  if (bailIfDisposed()) return;
  // step 1
  
  if (bailIfDisposed()) return;
  // step 2
  
  if (bailIfDisposed()) return;
  // step 3
  // ... 5 more times
}
```

**Proposal:**
Pipeline with cancellation token:

```typescript
interface Cancellable<T> {
  readonly run: () => Promise<T | "cancelled">;
}

const createMaterializationPipeline = (
  ctx: FileSyncContext,
  signal: AbortSignal
): Cancellable<void> => {
  const steps = [
    loadHistoryCursorStep,
    queryHistoryChangesStep,
    processContentChangesStep,
    processDeletionsStep,
    updateCursorStep,
  ];
  
  return {
    run: async () => {
      for (const step of steps) {
        if (signal.aborted) return "cancelled";
        const result = await step(ctx);
        if (!result.ok) return result; // error path
      }
    }
  };
};
```

**Benefit:**
- Cancellation logic centralized, not scattered
- Each step becomes a pure, testable function
- Pipeline can be extended/reordered without touching checkpoint logic

---

## Medium Impact (Clean Code)

### 4. Unify Shortcut Dependencies

**File:** `shortcuts.ts` (lines 6-24)

**Problem:** 5 separate interfaces for DI, combined with intersection type:

```typescript
export interface SessionDep { ... }
export interface LoggerDep { ... }
export interface TTYDep { ... }
export interface ShortcutOptionsDep { ... }
export interface ReadlineDep { ... }

// Combined as:
deps: SessionDep & LoggerDep & TTYDep & ShortcutOptionsDep & ReadlineDep
```

**Proposal:**
Single interface with selective mocking in tests:

```typescript
export interface ShortcutDeps {
  readonly session: FileSyncSession;
  readonly logger: Logger;
  readonly isTTY: boolean;
  readonly options: { readonly print: boolean };
  readonly readline: ReadlineInterface | null;
}

// Tests can use: Pick<ShortcutDeps, 'session' | 'logger'>
// Production uses: ShortcutDeps
```

**Benefit:**
- Simpler type signatures
- Easier to instantiate for tests
- Still allows partial mocking via TypeScript's `Pick`

---

### 5. Consolidate eslint-disable Comments

**Files:** Multiple files have `// eslint-disable-next-line no-console` (8 instances)

**Problem:** Repetitive eslint-disable comments for the same architectural exception (CLI UX output must bypass logger at ERROR level).

**Proposal:**
Create utility that documents the exception once:

```typescript
// logger-utils.ts
/** 
 * Console output that bypasses the logger system.
 * Used for CLI UX (banners, shortcuts, help) that must be visible 
 * even when TXTATELIER_LOG_LEVEL=ERROR.
 */
export const uxOutput = (...args: unknown[]): void => {
  // eslint-disable-next-line no-console
  console.info(...args);
};
```

**Usage:**
```typescript
import { uxOutput } from "./logger-utils.js";
uxOutput("Banner text here"); // No eslint-disable needed
```

**Benefit:**
- Single place to document why we bypass the logger
- Reduces eslint-disable noise
- Centralizes the "UX output" concept

---

## Lower Impact (Polish)

### 6. Extract Shortcut Definitions

**File:** `shortcuts.ts` (lines 61-72)

**Problem:** Hardcoded array with mixed formatting:

```typescript
const shortcuts: readonly CLIShortcut[] = [
  { key: "u", description: "show status" },
  { key: "s", description: "show mnemonic (copy manually)" },
  {
    key: "p",
    description:
      "restore mnemonic (type words, Ctrl+Shift+V / middle-click to paste, or Enter alone for clipboard)",
  },
  // ...
];
```

**Proposal:**
Table-driven with uniform structure and derived types:

```typescript
const SHORTCUTS = [
  { key: "u", desc: "show status", handler: (s) => s.showStatus() },
  { key: "s", desc: "show mnemonic (copy manually)", handler: (s) => s.showMnemonic() },
  { key: "p", desc: "restore mnemonic...", handler: (s, readLine) => s.restoreMnemonic(readLine) },
  // ...
] as const;

type ShortcutKey = typeof SHORTCUTS[number]['key'];
// "u" | "s" | "p" | ...
```

**Benefit:**
- Type-safe shortcut keys
- Handler functions colocated with descriptions
- Could auto-generate help text

---

### 7. Simplify Detach Pattern

**File:** `file-sync/index.ts` (lines 107-116)

**Problem:** `SyncLoopHandles` type + `detachSyncLoop` function is verbose:

```typescript
type SyncLoopHandles = {
  stopWatching: (() => void) | null;
  stopSyncing: (() => void) | null;
};

const detachSyncLoop = (handles: SyncLoopHandles): void => {
  if (handles.stopSyncing) {
    handles.stopSyncing();
    handles.stopSyncing = null;
  }
  if (handles.stopWatching) {
    handles.stopWatching();
    handles.stopWatching = null;
  }
};
```

**Proposal:**
Use array of disposables pattern already common in codebase:

```typescript
const disposables: Array<() => void> = [];

// Start operations push their cleanup:
disposables.push(startWatching());
disposables.push(startSyncing());

// Cleanup:
const stopSyncOnly = (): void => {
  for (const dispose of disposables.splice(0)) dispose();
};
```

**Benefit:**
- Fewer types to maintain
- Extensible (just push more disposables)
- No null checks needed

---

## Recommended Implementation Order

1. **Session Commands Extraction** (#1) - Biggest win, makes `startFileSync` readable
2. **interactive-logger Factory** (#2) - Quick win, removes duplication
3. **Materialization Pipeline** (#3) - Most complex, but significantly improves testability
4. **Unify Shortcut Dependencies** (#4) - Cleaner API surface
5. **Consolidate eslint-disable** (#5) - Documentation win
6. **Shortcut Definitions** (#6) - Nice to have, type safety
7. **Detach Pattern** (#7) - Optional, current code works fine

---

## Related Files

- `centers/cli/src/file-sync/index.ts` - Main session orchestration
- `centers/cli/src/shortcuts.ts` - Readline shortcut binding
- `centers/cli/src/interactive-logger.ts` - TTY-aware logging
- `centers/cli/src/file-sync/sync/state-materialization.ts` - Evolu → Filesystem sync

## Context

These refactorings were identified during review of PR adding:
- Interactive CLI shortcuts (s, p, d, c, q, h, u keys)
- Clipboard integration for mnemonics
- AbortController integration for clean shutdown
- onStop handlers and quit guards

The code works correctly; these are opportunities to improve maintainability and reduce complexity for future evolution.
