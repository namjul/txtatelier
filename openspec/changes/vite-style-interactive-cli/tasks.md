# Tasks: vite-style-interactive-cli

## 1. Session Interface Refactoring

- [x] 1.1 Define `FileSyncSession` interface with `stop()`, owner helpers, `clearConsole()`, `quit()` (no in-process `restart`)
- [x] 1.2 Refactor `startFileSync()` return value to implement new interface (currently returns `{ok, value}` with minimal session)
- [x] 1.3 Add event emitter or callback support to session (`onStop()` hook for cleanup)

## 2. Shortcut System (Vite Pattern + Evolu DI)

- [x] 2.1 Create `src/shortcuts.ts` with dependency interfaces: `SessionDep`, `LoggerDep`, `TTYDep`
- [x] 2.2 Implement `bindShortcuts(deps)` using Evolu DI pattern: 
  - Define `SessionDep`, `LoggerDep`, `TTYDep` interfaces (wrapped types)
  - Function signature: `bindShortcuts(deps: SessionDep & LoggerDep & TTYDep)`
  - NEVER use positional arguments for dependencies
  - Access via `deps.session`, `deps.logger`, `deps.isTTY`
- [x] 2.3 Implement base shortcuts: `u` (status), `s` (show mnemonic), `p` (paste/restore mnemonic), `d` (reset owner), `c` (clear), `q` (quit), `h` (help)
- [x] 2.4 Add `actionRunning` flag to prevent concurrent shortcut execution
- [x] 2.5 TTY detection via `deps.isTTY` (auto-detected at composition root)
- [x] 2.6 Visual mode indicator: show "press h + enter" hint in TTY mode, "Running non-interactive" in background mode
- [x] 2.7 **Readline lifetime**: Create readline once after startup; tear down on session `stop`
- [x] 2.8 **Error handling**: All shortcut errors result in `process.exit(1)` - no recovery, no zombie sessions

## 3. Logger Coordination

- [x] 3.1 Create `InteractiveLogger` that coordinates with readline (clear prompt, print log, restore prompt)
- [x] 3.2 Add banner printing with `{clear: true}` option for startup

- [x] 3.3 Integrate `picocolors` for colors if not already present
- [x] 3.4 **Precise clear screen**: Use `readline.cursorTo()` + `readline.clearScreenDown()` to preserve scrollback history
- [x] 3.5 **Prior output detection**: Check `bytesWritten > 0` to avoid clearing when piped/ scripted
- [x] 3.6 **Startup banner**: Name, version, and duration (`TXTAELIER v0.1.0  ready in 1.2s`)

## 4. Owner Command Migration

- [x] 4.1 Move `showOwnerMnemonic()` logic into session as `showMnemonic()` method (displays mnemonic for manual copy - no clipboard dependency)
- [x] 4.2 Move `showOwnerContext()` into session as `showStatus()` method (includes owner info)
- [x] 4.3 Implement `restoreMnemonic()` with stdin prompt for mnemonic input + validation; instruct quit + restart process (no clipboard)
- [x] 4.4 Implement `resetOwner()` with immediate execution (no confirmation - user can restore via `p` if mnemonic was saved)
- [x] 4.5 Keep legacy `--owner --show` etc. working as non-interactive fallbacks

## 5. In-process restart

- [x] 5.1 Not implemented: no `restart()` on `FileSyncSession`; after `p`/`d`, user quits and starts the CLI again

## 6. CLI Entrypoint Updates

- [x] 6.1 Refactor `runStart()` to use new session interface and bind shortcuts
- [x] 6.2 Implement auto-detection logic in entrypoint (no explicit flags needed initially)
- [x] 6.3 Update `StartCommand` to delegate to session instead of hanging on `new Promise(() => {})`
- [x] 6.4 Remove or deprecate separate `OwnerCommand` class (fold into interactive shortcuts)

## 7. Testing & Validation

- [x] 7.1 Test TTY detection (works in terminal, skips in CI/pipe)
- [x] 7.2 Test shortcut dispatch (help, quit, clear)
- [x] 7.3 Test owner mnemonic save/restore flow
- [x] 7.4 Test non-interactive auto-detection (piped input, Docker without -it, systemd)

## 8. Document Co-variance (Delta Specs)

- [x] 8.1 Create/Update `specs/cli-interaction-loop/spec.md` documenting the new interactive pattern, shortcuts, and TTY behavior
- [x] 8.2 Create/Update `specs/owner-management/spec.md` documenting migrated owner commands (immediate reset without confirmation)
- [x] 8.3 Update `specs/logger-coordination/spec.md` (or create) documenting prompt-aware logger behavior
