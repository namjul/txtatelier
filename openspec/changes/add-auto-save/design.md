# Design: add-auto-save

## Approach

Re-implement debounced auto-save in the PWA Editor component with careful attention to avoiding the issues that led to the previous revert.

**Key implementation aspects:**

1. **Debounced save effect**: Use `debounce` from `@solid-primitives/scheduled` to wrap the save callback with a 300ms delay. This provides a battle-tested, memory-safe debounce primitive designed for Solid.js.

2. **State machine**: Use `@zag-js/react` (via `@zag-js/solid` adapter) to build a finite state machine for save state (idle/dirty/saving/saved/error). This provides explicit, predictable state transitions and guards against invalid states.

3. **Sync loop prevention**: Use `ownerId` check and `lastSavedHash` tracking to ensure auto-save updates don't trigger downstream sync reactions that loop back to the editor.

4. **Visual feedback**: Minimal indicator in the editor header (bottom or top-right) showing current save state without being intrusive.

## Rationale

The previous implementation was reverted due to excessive noise/reactivity, not because auto-save itself was wrong. Modern editors (VS Code, Notion) all use auto-save as the default expectation.

The manual save button was a conservative fix but adds cognitive overhead. Re-implementing with:
- `@solid-primitives/scheduled` for reliable, memory-safe debouncing
- `@zag-js/solid` for a proper finite state machine managing save state transitions
- Content hash comparisons to prevent duplicate saves

This avoids the pitfalls of the previous attempt while delivering the expected user experience.

## Load-bearing assumptions

1. The PWA's Evolu integration supports updating rows without triggering downstream observer loops
2. `@solid-primitives/scheduled` provides memory-safe debouncing for Solid.js signals
3. `@zag-js/solid` provides a clean state machine abstraction for Solid.js
4. Content hashing/comparison is fast enough to run on every keystroke
5. The save button component can be removed/replaced without losing critical functionality

## Risks and trade-offs

**Risk**: Even with debounce, auto-save could cause more frequent database writes
**Mitigation**: 300ms debounce ensures writes only happen after user pauses

**Trade-off**: More complex state management vs simple button
**Acceptance**: State machine complexity is worth the UX improvement

**Risk**: Auto-save could interfere with conflict detection during sync
**Mitigation**: Content hash comparison ensures we only save when actual changes exist

## Out of scope

- Keyboard shortcut (Ctrl+S) can remain optional since auto-save handles the primary case
- Configurable debounce timing (use 300ms as sensible default)
- "Save version" or explicit snapshot functionality
- Offline queueing of saves (Evolu handles this)

## Known unknowns

1. Exact root cause of previous reactivity issues — need to verify fix during implementation
2. Whether 300ms debounce feels responsive enough
3. How auto-save interacts with conflict resolution UI

## Co-variance

- `centers/pwa/src/App.tsx` — Editor component needs auto-save logic
- `@solid-primitives/scheduled` — Add as dependency for debounce primitive
- `@zag-js/solid` — Add as dependency for state machine
- `centers/pwa/src/machines/` — New directory for Zag state machines
- Sync loop logic in CLI — ensure auto-save doesn't trigger conflicts
- Editor state management — needs Zag machine integration

## ⚠ Design warnings

### Responsiveness
The debounce introduces a small delay (300ms) between stopping typing and saving. This must be clearly communicated with a "Saving..." indicator so users know their work is being captured.

### Continuity after correction
If save fails (network/Evolu issue), the editor must remain usable. The state should show an error indicator and allow the user to continue editing. Auto-save should retry automatically.

### Exploratory capacity
Not applicable — auto-save doesn't restrict exploration, it removes a friction point.
