# Gesture: add-auto-save

## Gesture type
create

## What are we gesturing toward?
The automatic persistence of file edits without explicit user action (auto-save).

## Claim
Users will experience fewer lost edits when auto-save removes the need to remember pressing Ctrl+S or clicking a save button.

## What made us do this?
Auto-save was previously implemented in the PWA but was reverted (commit 8712cfe) because it caused excessive noise or reactivity issues. The current manual save button requires explicit user action, which is a friction point and creates risk of lost work.

## Load-bearing assumptions
1. Debounced auto-save can be implemented without triggering sync loops or excessive re-renders
2. The noise issue from the previous implementation was due to implementation details (timing, effect dependencies) that can be resolved
3. Users expect modern editors to auto-save and are surprised/confused when they don't

## Structures this gesture touches

### New structures
- `pwa/auto-save` — automatic persistence of file edits

### Anticipated co-variances
- `pwa/editor` — editor component needs to handle auto-save state
- `centers/pwa/save-feedback` — visual feedback during auto-save operations

## Co-variance
- Sync frequency might need adjustment to accommodate auto-save
- May need debounce tuning (200-500ms typical)
- Could affect perceived editor performance
- User mental model shifts from "I need to save" to "it's always saved"
