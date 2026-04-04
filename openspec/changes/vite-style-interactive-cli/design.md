# Design: vite-style-interactive-cli

## Approach

Implement a **log-first interactive CLI** modeled on Vite's dev server pattern:

1. **Readline-based input** (not raw mode): `h + Enter` for help, not immediate key capture
2. **Append-only output**: Logs stream continuously; no UI redraw or cursor control
3. **Banner with shortcuts**: Print once at startup (with `{clear: true}` option), then accept commands
4. **Owner command consolidation**: Move mnemonic show, restore, reset into interactive shortcuts (`s`, `p`, `d`); merge context info (`--where`) into status command (`u`)

Architecture:
```
┌─────────────────────────────────────────────┐
│  CLI Entry (Clipanion)                      │
│  - Parse args                               │
│  - Create session                           │
└─────────────────────┬───────────────────────┘
                      ▼
┌─────────────────────────────────────────────┐
│  FileSyncSession                            │
│  - start() → begin watching                 │
│  - bindShortcuts() → readline interface     │
│  - printBanner() → logger with clear        │
└─────────────────────┬───────────────────────┘
                        ▼
┌─────────────────────────────────────────────┐
│  bindShortcuts(deps: SessionDep &            │
│                LoggerDep & TTYDep)            │
│  - Evolu DI pattern                         │
│  - Returns cleanup function                 │
│  - 'h' → show shortcuts                     │
│  - 'r' → restart                            │
│  - 'u' → status                             │
│  - 's' → show mnemonic (display for copy)   │
│  - 'p' → paste/restore mnemonic (prompt)    │
│  - 'd' → reset owner                        │
│  - 'c' → clear console                      │
│  - 'q' → quit                               │
└─────────────────────────────────────────────┘
```

Key implementation details from Vite analysis:

**1. Readline Persistence Across Restart**
Readline interface is created once and persists across server restarts. Don't close/recreate - just swap the line event listener. This prevents input loss during restart and keeps the user's typing buffer intact.

**2. Precise Clear Screen (Preserve Scrollback)**
Use readline cursor control, not `console.clear()`:
```typescript
readline.cursorTo(process.stdout, 0, 0)
readline.clearScreenDown(process.stdout)
```
This clears only the visible viewport while preserving scrollback history. Users can scroll up to see prior logs.

**3. Startup Duration + Name/Version Banner**
Format: `TXTAELIER v0.1.0  ready in 840 ms` (< 1s) or `ready in 1.2s` (≥ 1s)
- Name and version prominently displayed
- Performance-aware duration: ms for fast (sub-second feels snappy), s for slower (avoids 4-digit numbers)
- Professional feel and confirmation that startup completed

**4. Prior Output Detection**
Check `process.stdout.bytesWritten > 0 || process.stderr.bytesWritten > 0` before clearing. If prior output exists (e.g., systemd `ExecStartPre` scripts, Docker entrypoint echoes), skip clear to preserve context. Only clear when starting "fresh".



**Evolu Dependency Injection Pattern:**

Following Evolu's DI convention (https://www.evolu.dev/docs/dependency-injection):

**DI Pattern Rule:** All dependencies must be wrapped in `XxxDep` interfaces and passed as a single `deps` object. Never use positional arguments for dependencies.

**Required Interface Definitions:**
```typescript
// Dependencies wrapped in distinct interface types (prevents name clashes)
interface SessionDep { 
  readonly session: FileSyncSession;
}

interface LoggerDep { 
  readonly logger: Logger;
}

interface TTYDep { 
  readonly isTTY: boolean;
}

interface ShortcutOptionsDep {
  readonly options: { readonly print: boolean };
}
```

**Function Signature (MUST use deps object):**
```typescript
// CORRECT: Single deps parameter with combined interfaces
const bindShortcuts = (
  deps: SessionDep & LoggerDep & TTYDep & ShortcutOptionsDep
): (() => void) => {
  // Access via deps.session, deps.logger, deps.isTTY, deps.options
  if (!deps.isTTY) return () => {};
  
  // Returns cleanup function
  return () => {};
};
```

**Composition Root (Entrypoint):**
```typescript
// Wire all dependencies at composition root
const deps: SessionDep & LoggerDep & TTYDep & ShortcutOptionsDep = {
  session: fileSyncSession,
  logger,
  isTTY: process.stdin.isTTY && !process.env.CI,
  options: { print: true },
};

// Pass single deps object
const cleanup = bindShortcuts(deps);

// Cleanup on exit
process.on('SIGTERM', () => {
  cleanup();
  await deps.session.stop();
});
```

**Anti-pattern (NEVER do this):**
```typescript
// WRONG: Positional arguments - not composable, harder to test
const bindShortcuts = (
  session: FileSyncSession,  // ❌ Positional
  logger: Logger,             // ❌ Positional
  isTTY: boolean,            // ❌ Positional
  options: { print: boolean } // ❌ Positional
) => { ... };
```

const cleanup = bindShortcuts(deps);

// Cleanup on exit
process.on('SIGTERM', () => {
  cleanup();
  await deps.session.stop();
});
```

Benefits:
- **Testable**: Mock deps object for unit tests
- **Explicit**: Dependencies visible in type signature
- **Composable**: deps objects can be spread and combined
- **No globals**: No service locator antipattern
- **Consistent**: Matches Evolu patterns already used in codebase

## Auto-Detection: Foreground vs Background

**TTY Detection Logic:**
```typescript
const isInteractive = process.stdin.isTTY && !process.env.CI;
```

**Foreground Mode (TTY available):**
```
14:32:01 [cli] TXTAELIER v0.1.0  ready in 1.2s
14:32:01 [cli] 
14:32:01 [cli]   ➜  Watching: /home/user/notes
14:32:01 [cli]   ➜  12 files, 0 conflicts
14:32:01 [cli]   ➜  Owner: abc123...def456
14:32:01 [cli] 
➜  press h + enter to show help

                            ← cursor (no visible prompt marker)
14:32:05 [sync:watch] File changed: notes.md
14:32:05 [sync:evolu] Updated row for notes.md
r                           ← user types 'r' + Enter
14:32:06 [cli] Restarting...
```

**Background Mode (no TTY):**
```
14:32:01 [cli] TXTAELIER v0.1.0  ready in 1.2s
14:32:01 [cli] Watching: /home/user/notes
14:32:01 [cli] Running non-interactive (shortcuts disabled)
14:32:01 [sync:watch] File changed: notes.md
14:32:05 [sync:evolu] Sync complete
```

**Visual indicator in non-TTY mode is critical**: Users viewing logs (Docker, systemd journal) must understand why keystrokes don't work. No prompt appears, but the "non-interactive" indicator clarifies the mode.

**Background Service Requirements:**
- No readline interface created (avoids resource waste)
- SIGTERM/SIGINT handlers remain (graceful shutdown for systemd)
- No "press h for help" hint in logs (reduces noise)
- Still functions fully as sync service

**Deployment Patterns:**

*systemd service:*
```ini
[Unit]
Description=Txtatelier File Sync

[Service]
Type=simple
ExecStart=/usr/bin/txtatelier --watch-dir /home/user/notes
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
```
Auto-detects non-TTY, runs log-only, responds to SIGTERM.

*Docker (detached):*
```bash
docker run -d --name txtatelier \
  -v ~/notes:/data \
  txtatelier/cli --watch-dir /data
```
Detached mode = no TTY = non-interactive mode automatically.

*Docker (interactive):*
```bash
docker run -it --rm \
  -v ~/notes:/data \
  txtatelier/cli --watch-dir /data
```
`-it` allocates TTY = interactive mode with shortcuts.

## Rationale

**Why Vite-style over alternatives:**

| Approach | Pros | Cons |
|----------|------|------|
| **Vite-style (chosen)** | Works everywhere (readline), familiar pattern, no deps | Requires Enter after each command |
| Raw stdin mode | Instant response | Breaks in CI/Docker, needs special handling |
| Full TUI (Ink/blessed) | Rich UI possible | Overkill, fights log-first philosophy, heavy deps |
| Keep current (Ctrl+C only) | Simple | Slow for repeated operations, poor discoverability |

**Why consolidate owner commands:**
- Owner management is rare but critical; burying in flags makes it invisible
- Interactive shortcuts make mnemonic save/restore visible and fast
- One interface for all operations reduces mental model complexity

## Load-bearing assumptions

1. **TTY detection correctly bifurcates modes**: `process.stdin.isTTY && !process.env.CI` correctly identifies foreground (interactive) vs background (service) environments. This is critical for both UX (hint visibility) and resource efficiency (no readline in background).
2. **Readline is sufficient**: Node.js built-in readline handles all input needs; no need for external terminal libraries
3. **Logger coordination is simple**: Vite's pattern (clear line, print log, restore prompt) works without complex state management
4. **Owner operations fit interactive flow**: Users will discover `s` (save) and `p` (paste) without explicit help; mnemonic sensitivity is acceptable for the speed gain
5. **Background services need no special handling**: SIGTERM/SIGINT graceful shutdown works identically in both modes; systemd/Docker require no additional CLI flags

## Risks and trade-offs

**Even if assumptions hold:**
- **Non-TTY mode feels "broken"**: When piped/CI, shortcuts don't appear—users may think CLI is hung; need clear "Running non-interactive" indicator
- **Destructive owner operations (reset)**: `d` executes immediately without confirmation; acceptable because reset is rare and user can restore via `p` if mnemonic was backed up

## Out of scope

- **Build mode separation**: No `txtatelier dev` vs `txtatelier start`; single command with mode auto-detection
- **Explicit override flags**: `--interactive` or `--no-interactive` flags not needed initially; auto-detection handles 99% of cases. Can add later if edge cases emerge.

- **Persistent history**: No arrow-key history across sessions; shell history is sufficient
- **Plugin system for shortcuts**: Hardcoded shortcuts only; extensibility deferred
- **Windows service mode**: No special handling for Windows services; falls back to non-interactive
- **Watchdog/health checks**: No built-in HTTP endpoint or health check; systemd `Restart=` handles process death

## Known Unknowns (Deferred)

1. **Force interactive flag need**: Will there be edge cases where TTY detection fails but user wants interactive mode (e.g., `screen` sessions, unusual terminal emulators)? **Decision**: Defer until reported. Auto-detection handles 99% of cases.

## Decisions Made During Planning

**Owner Reset: No Confirmation**
The `d` (reset owner) shortcut executes immediately without confirmation. Rationale: Reset is rare, users should have mnemonic backed up, and immediate execution keeps the log-first design simple. User can restore via `p` if needed.

**Restart Event Safety: Reconciliation Handles It**
File changes during the restart window (100-600ms) are not lost. Startup reconciliation runs after restart, comparing filesystem to Evolu state and syncing any missed changes. The "loss" is temporary until reconciliation completes.

**Multiple Instances: Already Works**
Instance locking is per-watch-directory (hash-based lockfile names). Running `txtatelier --watch-dir /notes` and `txtatelier --watch-dir /work` simultaneously works correctly - each gets its own lock file.

**Error Handling: Exit on Any Error**
To keep implementation simple and avoid complex recovery logic, all errors during shortcut execution result in immediate process exit with code 1. This includes:
- restart() failures (even partial state)
- restoreMnemonic() with failed flush
- Any uncaught exception in shortcut action

Rationale: Predictable behavior, no zombie sessions, fast restart available via shell history. User simply restarts CLI with up-arrow + Enter.

**Error Handling: Exit on Any Error**
To keep implementation simple and avoid complex recovery logic, all errors during shortcut execution result in immediate process exit with code 1. This includes:
- restart() failures (even partial state)
- restoreMnemonic() with failed flush
- Any uncaught exception in shortcut action

Rationale: Predictable behavior, no zombie sessions, fast restart available via shell history. User simply restarts CLI with up-arrow + Enter.

## Co-variance

**This motion will touch:**
- `centers/cli/src/index.ts`: Entrypoint becomes async composition root, wires DI deps
- `centers/cli/src/logger.ts`: Needs prompt-aware coordination (or new `InteractiveLogger`)
- `centers/cli/src/file-sync/index.ts`: Session interface expands with methods for shortcuts
- `centers/cli/src/shortcuts.ts`: New module using Evolu DI pattern (SessionDep, LoggerDep, TTYDep)
- Owner commands deleted from `OwnerCommand` class (or reduced to `--no-interactive` aliases)
- Instance lock messaging: Currently prints error and exits; may integrate into banner
- DI interfaces: New dependency interfaces establish pattern for future CLI components

## ⚠ Design warnings

### Responsiveness
The readline approach requires `Enter` after each command. This is slightly slower than raw key capture but ensures reliability. The tradeoff is explicit: one extra keystroke for universal compatibility.

### Continuity after correction
If a user accidentally presses `r` (restart) instead of `c` (clear), they lose sync state momentarily. The restart completes quickly, but any pending file events during the restart window are lost. This is acceptable for development but should be noted in documentation.

### Exploratory capacity
Consolidating owner commands into shortcuts reduces discoverability for users who expect `--help` to list all functionality. The banner mitigates this, but users running non-interactive mode may not realize owner commands moved. Mitigation: Keep `--owner --show` working in non-interactive mode as legacy aliases.
