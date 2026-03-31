# Exploration: PWA State Machines

**Goal:** Eliminate impossible state combinations in `centers/pwa/` by expressing implicit state as explicit FSMs.

---

## TL;DR

**6 Impossible States Currently Possible:**

| # | Impossible State | Why It Happens | Risk |
|---|------------------|----------------|------|
| 1 | `hasConflict=true` AND `isSaving=true` | Manual save bypasses machine guards | Saves during conflict, data loss |
| 2 | `isDirty=false` AND `conflictRemote!=null` | No explicit resolution path | Conflict UI without dirty state |
| 3 | `persistRetryCount>0` AND `state=idle` | Counter lives outside machine | Retry scheduled but UI shows idle |
| 4 | `saveFailedFinal=true` AND `isDirty=false` | Failure indicator not coupled to content | False failure signal |
| 5 | `isSaving=true` AND `canSaveAsOwner=false` | Guard scattered in effects | Writes as non-owner, violates contract |
| 6 | Draft from old file persists into new | Reset logic implicit in effects | Content confusion |

**Proposed Solution:**
- Extract `file-editor-machine.ts` (replaces 309-line `useFileEditor.ts`)
- Extract `conflict-machine.ts` (explicit resolution states)
- Coordinate with existing `auto-save-machine.ts`

**Decision:** Options A/B/C at [end of doc](#decision)

---

## Current Architecture

### What Exists: AutoSaveMachine

```
┌─────────────────────────────────────────┐
│         auto-save-machine.ts            │
│           (already exists)              │
│                                         │
│   idle ──TYPE(dirty)──► dirty           │
│    ▲                    │               │
│    │                    │ SAVE(canPersist)
│    │                    ▼               │
│    │                 saving              │
│    │                    │               │
│    │       SAVE_SUCCESS│ SAVE_ERROR    │
│    │                    ▼               │
│   idle ◄───────────── error            │
│    ▲                    │               │
│    └────────────────────┘ (retry)       │
│                                         │
│ Guards:                                 │
│   canPersist = !conflict && dirty && owner
│                                         │
└─────────────────────────────────────────┘
```

**Limitation:** Guards prevent invalid transitions, but external code can bypass by calling `persistDraft()` directly. The machine tracks UI intent, not system state.

### What Should Exist: FileEditorMachine

**Current: useFileEditor.ts (309 lines)**

```typescript
// 8 interdependent signals + 3 derived memos + 1 plain variable
const [editorFileId, setEditorFileId] = createSignal<...>(null);
const [draft, setDraft] = createSignal("");
const [baseContent, setBaseContent] = createSignal("");
const [baseFingerprint, setBaseFingerprint] = createSignal<...>(null);
const [conflictRemote, setConflictRemote] = createSignal<...>(null);
const [isSaving, setIsSaving] = createSignal(false);
const [saveFailedFinal, setSaveFailedFinal] = createSignal(false);
let persistRetryCount = 0;

const isDirty = createMemo(() => ...);
const hasConflict = createMemo(() => ...);
const canSaveAsOwner = createMemo(() => ...);
```

**Every state change requires manually syncing 5-8 variables.** This is where impossible states emerge.

---

## Proposed: File Editor State Machine

### States

```
┌─────────────────────────────────────────┐
│         FileEditorMachine               │
│                                         │
│  pristine ──select──► clean             │
│    ▲                   │                │
│    │                   │ edit            │
│    │                   ▼                │
│    │                dirty ──save──► saving
│    │                   │                │
│    │         conflict  │ error          │
│    │            ▲       ▼                │
│    │            │    error ──retry─────┤
│    │            │                      │
│    │     remote changed               │
│    │     while dirty                  │
│    │                                   │
│    └───────────────────────────────────┘
│         resolve / file change           │
│                                         │
└─────────────────────────────────────────┘
```

### Guards (Compile-Time Safety)

```
hasFileSelected    → file != null
isDirty           → draft !== baseContent
hasConflict       → conflictRemote != null
canSaveAsOwner    → file.ownerId === shardOwnerId
canPersist        → isDirty && !hasConflict && canSaveAsOwner
canResolve        → hasConflict
```

With these guards, **impossible states become compile-time errors**.

### Events

```typescript
type FileEditorEvent =
  | { type: "FILE_SELECTED"; file: FilesRow }
  | { type: "DRAFT_CHANGE"; content: string }
  | { type: "AUTO_SAVE" }
  | { type: "SAVE_SUCCESS" }
  | { type: "SAVE_ERROR"; error: Error }
  | { type: "SAVE_RETRY" }
  | { type: "CONFLICT_DETECTED"; remote: FilesRow }
  | { type: "RESOLVE"; strategy: Strategy }
  | { type: "FILE_CHANGE" }
```

---

## Proposed: Conflict Resolution Machine

### Current (Ad-Hoc)

```typescript
// Guards inline, scattered logic
const resolveConflict = (strategy) => {
  if (conflictRemote() == null) return;  // Guard here
  // ... logic
};

const saveDraftAsConflictArtifact = async () => {
  if (!hasConflict()) return;  // Guard here too
  // ... logic
};
```

### Proposed (Explicit States)

```
┌─────────────────────────────────────────┐
│         ConflictMachine                 │
│                                         │
│   none ──detect──► detected             │
│    ▲                │                   │
│    │                ├─keep-local──►     │
│    │                ├─use-remote──►     │
│    │                └─save-artifact──► │
│    │                   │               │
│    │                   ▼               │
│    └────────────── resolved            │
│                                         │
│ Impossible states eliminated:           │
│   • resolve when no conflict            │
│   • artifact save after cleared         │
│   • multiple concurrent strategies      │
│                                         │
└─────────────────────────────────────────┘
```

---

## Machine Composition

```
┌─────────────────────────────────────────┐
│         PWA State Machines               │
│                                          │
│  ┌───────────────────────────────────┐  │
│  │       FileEditorMachine           │  │
│  │                                   │  │
│  │  clean ──edit──► dirty ──save──►  │  │
│  │    ▲              │      saving   │  │
│  │    │              │       │      │  │
│  │    └──────────────┴───────┘      │  │
│  │              │                   │  │
│  │              ▼ conflict          │  │
│  │    ┌─────────────────────┐       │  │
│  │    │   ConflictMachine   │◄──────┘  │
│  │    │  detected ───► resolved        │  │
│  │    └─────────────────────┘          │  │
│  │                                   │  │
│  └───────────────────────────────────┘  │
│                  ▲                      │
│                  │                      │
│  ┌───────────────┴───────────────┐     │
│  │      AutoSaveMachine          │     │
│  │  (watches dirty, triggers)    │     │
│  └───────────────────────────────┘     │
│                                         │
│ Interactions:                           │
│   • AutoSave monitors FileEditor.dirty  │
│   • FileEditor delegates conflict to child
│   • Conflict reports back on resolve    │
│                                         │
└─────────────────────────────────────────┘
```

---

## Impact

### File Changes

| File | Current | After |
|------|---------|-------|
| `useFileEditor.ts` | 309 lines, 8 signals | ~180 lines, 1 machine |
| `auto-save-machine.ts` | Works standalone | Coordinates |
| NEW: `file-editor-machine.ts` | — | State machine |
| NEW: `conflict-machine.ts` | — | Resolution FSM |

### Benefits vs. Trade-offs

**Benefits:**
- Impossible states become compile-time errors
- Single source of truth (1 state vs 8 signals)
- Testable: send events, assert state
- Debuggable: trace `dirty → saving → saved`

**Trade-offs:**
- Learning curve (FSM patterns)
- More files (4 vs 1)
- Potential overkill for simple flows

---

## Decision

**Options:**

| Option | Scope | Effort | Confidence |
|--------|-------|--------|------------|
| **A** | Full refactor (FileEditor + Conflict machines) | 3-4 days | High |
| **B** | Keep ad-hoc | 0 days | Current bugs persist |
| **C** | Partial (Conflict machine only) | 1-2 days | Medium |

**Contact Test:**
```
Success-if: Refactored code prevents all 6 impossible states at compile time
           AND tests pass without mocking 8 interdependent signals

Failure-if: Refactor introduces complexity without eliminating bugs
           OR state transitions become harder to trace than current code

Timeline: 1 week implementation + 1 week validation
```

**Recommended:** Option A. The 309-line `useFileEditor.ts` is a complexity hotspot. The current ad-hoc approach already requires understanding 8 signal interactions—replacing with explicit FSM states reduces cognitive load long-term.

---

## Appendix: Additional Context

### FilesWorkspace State (Optional)

The file list view (`App.tsx` + `useFileList`) also has implicit states:

```
loading ──► empty ──► browsing
   │          │          │
   ▼          ▼          ▼
  error    (no files)   editor
```

**Decision:** Can stay ad-hoc (simple 3-state flow) OR extract to `files-workspace-machine` if additional states added (offline, retry UI, etc.).

### Settings / Owner Lifecycle

Sequential actions (show mnemonic → restore → reset). Probably **doesn't need FSM** unless adding:
- Async loading states
- Confirmation flows
- Error recovery paths

### Command Menu

Simple action mode toggle (`?` prefix). **Doesn't need FSM.**

---

*Last updated: 2026-03-31*
