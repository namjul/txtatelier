# Exploration: Dependency Injection Opportunities in txtatelier

**Date:** 2026-03-21  
**Source:** https://www.evolu.dev/docs/dependency-injection  
**Status:** Exploration complete - awaiting decision on implementation

---

## What is Evolu's DI Pattern?

Evolu's approach to dependency injection is lightweight and convention-based:

1. **Define interfaces** for external dependencies (Time, Logger, Config, etc.)
2. **Wrap interfaces in distinct types** (TimeDep, LoggerDep) to avoid name clashes
3. **Use currying** to separate dependencies from function arguments
4. **Factory functions** create concrete implementations (createTime, createLogger)
5. **Manual composition** in a "composition root" - no framework needed

Key principle: **Never use global service locators** (e.g., `export const db = createDb()`)

---

## Current vs. Proposed Architecture

```
┌─────────────────────────────────────────┐
│         CURRENT: Tight Coupling        │
├─────────────────────────────────────────┤
│                                         │
│  Global logger ◄──── 9 direct imports   │
│       ↑                                 │
│  Hard-coded time ──► new Date(),        │
│                      setTimeout()       │
│       ↑                                 │
│  Scattered config ──► MAX_FILE_SIZE,    │
│                       debounce timers   │
│       ↑                                 │
│  Direct FS/crypto ──► bun:sqlite,       │
│                       node:crypto       │
│                                         │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│    WITH DI: Composable & Testable      │
├─────────────────────────────────────────┤
│                                         │
│  Composition Root                       │
│  ┌────────┐┌────────┐┌────────┐        │
│  │ Time   ││Logger  ││ Config │        │
│  └───┬────┘└───┬────┘└───┬────┘        │
│      └─────────┴─────────┘             │
│                │                        │
│                ▼                        │
│         ┌──────────┐                     │
│         │  deps    │                     │
│         └────┬─────┘                     │
│    ┌─────────┼─────────┐                │
│    ▼         ▼         ▼                │
│  capture  materialize  watch             │
│                                         │
└─────────────────────────────────────────┘
```

---

## Specific Opportunities in txtatelier

### 1. Time/Clock Dependency (High Impact)

**Current Pain Point:** Testing debounce logic is difficult because `setTimeout` and `Date.now()` are global and untestable.

**Evidence (state-materialization.ts:121-150):**
```typescript
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
const SUBSCRIPTION_DEBOUNCE_MS = 500;
const triggerTime = new Date().toISOString(); // Untestable
debounceTimer = setTimeout(async () => { ... }, SUBSCRIPTION_DEBOUNCE_MS);
```

**With DI:**
```typescript
export interface TimeDep {
  readonly time: {
    now(): number;
    setTimeout(fn: () => void, ms: number): TimeoutId;
    clearTimeout(id: TimeoutId): void;
    toISOString(): string;
  }
}

// Production
export const createTime = () => ({
  now: () => Date.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  // ... etc
});

// Testing
export const createTestTime = () => {
  let currentTime = 1000;
  return {
    now: () => currentTime,
    advanceTime: (ms: number) => { currentTime += ms; },
    // ... mock implementations
  };
};
```

**Impact:**
- Enables deterministic testing of debounce logic
- Can simulate time passage without real delays
- Can freeze time for reproducible timestamps

---

### 2. Logger Dependency (High Impact)

**Current State:** Logger imported directly in 9 files

**Evidence:**
- `change-capture.ts:7` - `import { logger } from "../../logger";`
- `watch.ts:7` - `import { logger } from "../logger";`
- `BunSqliteDriver.ts:6` - `import { logger } from "../../logger";`
- `BunEvoluDeps.ts:14` - `import { logger } from "../../logger";`
- `startup-reconciliation.ts:4` - `import { logger } from "../../logger";`
- `state-materialization.ts:15` - `import { logger } from "../../logger";`
- `change-capture.ts:7` - `import { logger } from "../../logger";`
- `executor.ts:14` - `import { logger } from "../../logger";`
- `evolu.ts:13` - `import { logger } from "../logger";`

**With DI:**
```typescript
export interface LoggerDep {
  readonly logger: {
    debug(...args: unknown[]): void;
    info(...args: unknown[]): void;
    warn(...args: unknown[]): void;
    error(...args: unknown[]): void;
  }
}

// Function signature becomes:
export const captureChange = (deps: LoggerDep & TimeDep) => 
  async (evolu: EvoluDatabase, watchDir: string, absolutePath: string) => {
    deps.logger.info("[capture:fs→evolu] Inserting...");
    // ...
  };

// Testing - silent mode
export const createSilentLogger = () => ({
  debug: () => {},
  info: () => {},
  // ... etc
});

// Testing - assertions
export const createTestLogger = () => {
  const logs: string[] = [];
  return {
    debug: (...args) => logs.push(args.join(' ')),
    info: (...args) => logs.push(args.join(' ')),
    getLogs: () => logs,
    // ... etc
  };
};
```

**Impact:**
- Can silence logs in tests (cleaner test output)
- Can assert on log messages for behavior verification
- Can swap logger implementation without changing business logic

---

### 3. Configuration Dependency (Medium Impact)

**Current State:** Constants scattered across files

**Evidence:**
- `constants.ts` - `MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024`
- `BunSqliteDriver.ts:10` - `SAVE_DEBOUNCE_MS = 5_000`
- `state-materialization.ts:122` - `SUBSCRIPTION_DEBOUNCE_MS = 500`
- `index.ts:43` - `defaultRelayUrl = "wss://free.evoluhq.com"`
- `index.ts:44` - `defaultWatchDir = join(homedir(), "Documents", "Txtatelier")`

**With DI:**
```typescript
export interface ConfigDep {
  readonly config: {
    readonly maxFileSizeBytes: number;
    readonly saveDebounceMs: number;
    readonly subscriptionDebounceMs: number;
    readonly defaultWatchDir: string;
    readonly defaultRelayUrl: string;
  }
}

// In composition root (main.ts)
const deps: ConfigDep = {
  config: {
    maxFileSizeBytes: 10 * 1024 * 1024,
    saveDebounceMs: 5_000,
    subscriptionDebounceMs: 500,
    defaultWatchDir: join(homedir(), "Documents", "Txtatelier"),
    defaultRelayUrl: "wss://free.evoluhq.com",
    // Can be overridden for testing
    ...(isTest && { maxFileSizeBytes: 1024 })
  }
};
```

**Impact:**
- Make limits user-configurable (file size, debounce timing)
- Different configs for test/prod without code changes
- Easier to adjust behavior without touching multiple files

---

### 4. File System Abstraction (Medium Impact)

**Current State:** Direct `node:fs/promises` imports

**Evidence:**
- `BunSqliteDriver.ts` - `io.readFile()`, `io.writeFile()` (already abstracted!)
- `change-capture.ts` - `stat from "node:fs/promises"` (direct)
- `state-materialization.ts` - Direct file operations

**With DI (extend existing PlatformIO):**
```typescript
export interface FileSystemDep {
  readonly fs: {
    stat(path: string): Promise<Stats>;
    readFile(path: string): Promise<Buffer>;
    writeFile(path: string, data: Buffer): Promise<void>;
    unlink(path: string): Promise<void>;
    exists(path: string): Promise<boolean>;
  }
}

// Production - wraps Node.js
export const createNodeFileSystem = () => ({
  fs: {
    stat: (path) => fs.stat(path),
    readFile: (path) => fs.readFile(path),
    // ... etc
  }
});

// Testing - in-memory FS
export const createTestFileSystem = () => {
  const files = new Map<string, Buffer>();
  return {
    fs: {
      stat: (path) => {
        const data = files.get(path);
        if (!data) throw new Error('ENOENT');
        return { size: data.length, isFile: () => true };
      },
      readFile: (path) => files.get(path) || Buffer.from(''),
      writeFile: (path, data) => files.set(path, data),
      exists: (path) => files.has(path),
      // ... etc
    }
  };
};
```

**Impact:**
- Unit tests without real file system (faster, isolated)
- Can test scenarios that are hard to reproduce (permissions, disk full)
- Can simulate network drives, cloud storage implementations

---

### 5. Crypto/Hashing (Low-Medium Impact)

**Current State:** `createHash from "node:crypto"` in index.ts

**With DI:**
```typescript
export interface HashDep {
  readonly hash: {
    sha256(input: string): string;
    sha256Base64(input: string): string;
  }
}

// Production
export const createNodeHash = () => ({
  hash: {
    sha256: (input) => createHash("sha256").update(input).digest("hex"),
    // ... etc
  }
});

// Testing - predictable hashes
export const createTestHash = () => {
  let counter = 0;
  return {
    hash: {
      sha256: () => `test-hash-${counter++}`,
      // ... etc
    }
  };
};
```

**Impact:**
- Predictable hashes in tests (easier assertions)
- Can replace with different hashing algorithms if needed

---

## Recommended Implementation Strategy

### Phase 1: Time Dependency (Easiest Win)
- Start with `TimeDep` interface
- Refactor `state-materialization.ts` debounce logic
- Create `createTime()` and `createTestTime()` factories

**Why first:**
- High testability impact
- Self-contained (no cascading changes)
- Easy to validate (debounce tests become deterministic)

### Phase 2: Logger Dependency
- Define `LoggerDep` interface
- Replace all 9 global logger imports
- Enables silent mode, test assertions on log calls

**Why second:**
- Touches many files, but changes are mechanical
- Clear before/after comparison
- Improves test output immediately

### Phase 3: Configuration Dependency
- Consolidate scattered constants
- Makes limits user-configurable

**Why third:**
- Requires UI changes (config loading)
- Can be done incrementally per config category

### Phase 4: File System Abstraction
- Extend existing `PlatformIO` abstraction
- Virtual FS for testing

**Why last:**
- Most complex (many operations)
- Benefits only tests (no prod feature)

---

## Key Design Decisions to Make

1. **Single deps object or multiple?**
   - Option A: `function(deps: TimeDep & LoggerDep & ConfigDep)`
   - Option B: `function({ time, logger, config })`
   - Evolu recommends Option A with `&` intersection types

2. **Over-providing vs. exact deps?**
   - ✅ OK: Function needs `TimeDep`, but caller provides `TimeDep & LoggerDep`
   - ❌ Not OK: Function needs `TimeDep & LoggerDep` but only uses `TimeDep`
   - Evolu: "Keep dependencies lean"

3. **Optional dependencies?**
   - Use `Partial<LoggerDep>` for optional deps
   - Use conditional spreading: `...(enableLogging && { logger: createLogger() })`

4. **Factory functions as deps?**
   - Useful when dependency creation must be delayed
   - Example: `CreateLoggerDep` for late logger initialization

---

## Open Questions

1. **Testing strategy:** Do we want to mock all external dependencies, or just time/crypto for now?

2. **Migration approach:** Big bang refactor or gradual file-by-file migration?

3. **Existing abstractions:** PlatformIO already abstracts some file operations - should we extend it or create new interface?

4. **Evolu integration:** Does Evolu itself use DI internally that we should align with?

---

## Next Steps

To move forward:
1. Decide which phase(s) to implement
2. Create OpenSpec change proposal
3. Define interfaces and factory functions
4. Refactor one module as proof-of-concept
5. Gradually migrate remaining modules

**Ready to create a proposal?** Ask me to exit explore mode and create a change for implementing DI.

---

## Important Findings: Evolu's Actual Interface Definitions

During exploration, we discovered the actual scope of Evolu's built-in DI interfaces:

### 1. Evolu's Time Interface is Minimal

```typescript
// Actual Evolu Time interface - only two methods!
interface Time {
  readonly now: () => number;        // Like Date.now()
  readonly nowIso: () => string;     // ISO timestamp
}
```

**Missing for debounce testing:**
- ❌ No `setTimeout`
- ❌ No `clearTimeout`
- ❌ No `toISOString()` for timestamps

**Implication:** For testable debounce logic, we'd need to define our own extended interface:

```typescript
// Custom extension required
export interface TimerDep {
  readonly timer: {
    setTimeout(fn: () => void, ms: number): ReturnType<typeof setTimeout>;
    clearTimeout(id: ReturnType<typeof setTimeout>): void;
  };
}
```

### 2. Evolu's ConsoleDep is Single-Purpose

```typescript
interface ConsoleDep {
  readonly console: Console;  // Just the console instance
}
```

**What this means:**
- ✅ Can inject different console implementations
- ❌ Doesn't provide module scoping (bound prefixes)
- ❌ Still need custom solution for `createLogger('[prefix]')` pattern

### 3. AppOwnerDep Exists But We Use OwnerSession

```typescript
interface AppOwnerDep {
  readonly appOwner: AppOwner;
}
```

**Current approach:** We pass `OwnerSession` (aggregate of evolu + owner + config)
**DI approach:** Would need to break into individual deps

**Trade-off:** Fine-grained mocking vs. simpler signatures

---

## Refined DI Opportunities (Post-Discovery)

After reviewing actual Evolu APIs, here are the real opportunities:

| Dependency | What Evolu Provides | What We Need | Priority |
|------------|-------------------|--------------|----------|
| **Time** | ✅ `now()`, `nowIso()` | ❌ Timer control (setTimeout/clearTimeout) | **HIGH** - Need custom TimerDep |
| **Console** | ✅ `ConsoleDep` | ❌ Module-bound prefixes | **MEDIUM** - Optional enhancement |
| **Config** | ❌ Nothing | ❌ Consolidate scattered constants | **HIGH** - Clear win |
| **FileSystem** | ❌ Nothing | ❌ Virtual FS abstraction | **MEDIUM** - Test-only benefit |

### Real Implementation Complexity

**ConfigDep:** Straightforward - consolidate constants into interface

**TimeDep (with timers):**
```typescript
// Would need to define ourselves
export interface TimeControlDep {
  readonly time: Time;  // Evolu's interface
  readonly timer: {
    setTimeout: typeof setTimeout;
    clearTimeout: typeof clearTimeout;
  };
}
```

**Implementation example:**
```typescript
// BEFORE (current)
const startStateMaterialization = (
  evolu: EvoluDatabase,
  watchDir: string,
  options?: StateMaterializationOptions,
): (() => void) => {
  const SUBSCRIPTION_DEBOUNCE_MS = 500;  // Hard-coded
  const triggerTime = new Date().toISOString();  // Global Date
  debounceTimer = setTimeout(() => {...}, 500);  // Global setTimeout
};

// AFTER (with ConfigDep + TimeControlDep)
export const startStateMaterialization = (deps: ConfigDep & TimeControlDep) =>
  (evolu: EvoluDatabase, watchDir: string, options?: StateMaterializationOptions): 
  (() => void) => {
    const debounceMs = deps.config.subscriptionDebounceMs;  // From config
    const triggerTime = deps.time.nowIso();  // Evolu's Time
    debounceTimer = deps.timer.setTimeout(() => {...}, debounceMs);  // Injected timer
  };
```

---

## Decision: Not Implementing Now

**Rationale:**

1. **Current system works** - Global logger with manual prefixes is functional
2. **Benefit vs. effort** - DI adds boilerplate for marginal testing improvement
3. **TimeDep complexity** - Would need custom TimerDep, not just Evolu's Time
4. **ConfigDep alone** - Worthwhile but not urgent (constants work fine)
5. **Integration tests suffice** - We're testing with real Evolu, not mocking

**When to reconsider:**
- Unit testing becomes painful with current approach
- Need deterministic debounce timing for flaky tests  
- Want user-configurable limits (MAX_FILE_SIZE, debounce delays)
- Preparing for non-Bun environments (Node.js, Deno)

**If we implement later:**
- Start with **ConfigDep** (clear value, self-contained)
- Add **TimeControlDep** only if debounce testing becomes critical
- Keep **ConsoleDep** as-is (global logger is simpler)
- Skip **FileSystemDep** unless pure unit tests needed

---

## Final Assessment

**DI is valuable for:**
- External system boundaries (Time, FileSystem)
- User-configurable behavior (Config)
- Test isolation (mocking)

**Not critical for:**
- Internal modules (already testable via integration tests)
- Logging (Evolu's console is sufficient)
- Owner/App state (aggregate pattern works well)

**Status:** Exploration complete. No immediate implementation needed. Revisit if testing requirements change.
