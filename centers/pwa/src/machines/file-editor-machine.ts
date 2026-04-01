import { setup, type Machine } from "@zag-js/core";

/**
 * PWA editor session — UI lifecycle only.
 * @see openspec/changes/archive/2026-04-01-pwa-editor-fsm-zag-unify/EDITOR_SESSION_FSM.md
 */
const { createMachine } = setup<{
  props: {
    readonly isDirty: boolean;
    readonly canSaveAsOwner: boolean;
  };
  state: "clean" | "dirty" | "saving" | "conflict";
  event:
    | { type: "DRAFT_CHANGED" }
    | { type: "PERSIST_REQUESTED" }
    | { type: "PERSIST_COMPLETED" }
    | { type: "PERSIST_FAILED" }
    | { type: "ROW_TRUE_DIVERGENCE" }
    | { type: "ADOPT_REMOTE" }
    | { type: "LOCAL_PARKED_AS_NEW_FILE" }
    | { type: "FILE_CONTEXT_RESET" };
  guard: "hasLocalEdits" | "noLocalEdits" | "canPersist";
}>();

export const fileEditorMachine = createMachine({
  initialState: () => "clean",
  states: {
    clean: {
      on: {
        DRAFT_CHANGED: [
          { target: "dirty", guard: "hasLocalEdits" },
          { target: "clean" },
        ],
        PERSIST_REQUESTED: { target: "saving", guard: "canPersist" },
        ROW_TRUE_DIVERGENCE: { target: "conflict" },
        FILE_CONTEXT_RESET: { target: "clean" },
      },
    },
    dirty: {
      on: {
        DRAFT_CHANGED: [
          { target: "clean", guard: "noLocalEdits" },
          { target: "dirty" },
        ],
        PERSIST_REQUESTED: { target: "saving", guard: "canPersist" },
        ROW_TRUE_DIVERGENCE: { target: "conflict" },
        FILE_CONTEXT_RESET: { target: "clean" },
      },
    },
    saving: {
      on: {
        PERSIST_COMPLETED: [
          { target: "dirty", guard: "hasLocalEdits" },
          { target: "clean" },
        ],
        PERSIST_FAILED: { target: "dirty" },
        FILE_CONTEXT_RESET: { target: "clean" },
      },
    },
    conflict: {
      on: {
        DRAFT_CHANGED: { target: "conflict" },
        ADOPT_REMOTE: { target: "clean" },
        LOCAL_PARKED_AS_NEW_FILE: { target: "clean" },
        FILE_CONTEXT_RESET: { target: "clean" },
      },
    },
  },
  implementations: {
    guards: {
      hasLocalEdits: ({ prop }) => prop("isDirty"),
      noLocalEdits: ({ prop }) => !prop("isDirty"),
      canPersist: ({ prop, state }) =>
        !state.matches("conflict") &&
        prop("isDirty") &&
        prop("canSaveAsOwner"),
    },
  },
});

export type FileEditorMachineState = typeof fileEditorMachine extends Machine<
  infer S
>
  ? S["state"]
  : never;
