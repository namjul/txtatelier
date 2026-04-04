# Evidence: vite-style-interactive-cli

## What cohered

- **Session:** `FileSyncSession` now exposes `restart`, owner helpers, `clearConsole`, `quit`, and `onStop`, with `restart` clearing `_syncState` via `clearAllSyncStateTracking`, re-running startup reconciliation, and reattaching watch + materialization without closing Evolu.
- **CLI entry:** Composition root creates one readline + `createInteractiveLogger`, prints a Vite-style banner after `startFileSync`, binds `bindShortcuts` with a single `deps` object, and registers readline cleanup on `onStop`.
- **Shortcuts:** Letter + Enter dispatch with `actionRunning`, non-TTY banner string, and `process.exit(1)` on handler failure.
- **Logger:** `InteractiveLogger` coordinates logs with the prompt, viewport clear with scrollback preservation + `bytesWritten` guard, and `picocolors` on the banner line.
- **Specs:** Change-local deltas under `specs/cli-interaction-loop`, `specs/owner-management`, and `specs/logger-coordination`.

## Tests run

- `bunx vitest run src/shortcuts.test.ts src/file-sync/index.test.ts` — shortcuts suite green; two pre-existing failures remain in `index.test.ts` (offline disk / conflict scenarios; same failure on `HEAD` `file-sync/index.ts`).
