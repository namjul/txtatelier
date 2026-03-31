import { setup } from "@zag-js/core";

/** Save UX and valid transitions only; actual Evolu I/O lives in useFileEditor. */
const { createMachine } = setup<{
  props: {
    readonly isDirty: boolean;
    readonly hasConflict: boolean;
    readonly canSaveAsOwner: boolean;
  };
  state: "idle" | "dirty" | "saving" | "saved" | "error";
  event:
    | { type: "TYPE" }
    | { type: "SAVE" }
    | { type: "SAVE_SUCCESS" }
    | { type: "SAVE_ERROR" }
    | { type: "RESET" };
  guard:
    | "hasLocalEdits"
    | "preventSaveWhenNoChanges"
    | "preventSaveWhenConflict"
    | "preventSaveWhenOwnerMismatch"
    | "canPersist";
}>();

/** TYPE tracks editor dirtiness; SAVE is emitted only after debounce when canPersist passes. */
export const autoSaveMachine = createMachine({
  initialState: () => "idle",
  states: {
    idle: {
      on: {
        TYPE: [
          { target: "dirty", guard: "hasLocalEdits" },
          { target: "idle" },
        ],
      },
    },
    dirty: {
      on: {
        TYPE: { target: "dirty" },
        SAVE: { target: "saving", guard: "canPersist" },
        RESET: { target: "idle" },
      },
    },
    saving: {
      on: {
        SAVE_SUCCESS: { target: "saved" },
        SAVE_ERROR: { target: "error" },
      },
    },
    saved: {
      on: {
        TYPE: [
          { target: "dirty", guard: "hasLocalEdits" },
          { target: "idle" },
        ],
        RESET: { target: "idle" },
      },
    },
    error: {
      on: {
        SAVE: { target: "saving", guard: "canPersist" },
        TYPE: { target: "dirty" },
        RESET: { target: "idle" },
      },
    },
  },
  implementations: {
    guards: {
      hasLocalEdits: ({ prop }) => prop("isDirty"),
      preventSaveWhenNoChanges: ({ prop }) => !prop("isDirty"),
      preventSaveWhenConflict: ({ prop }) => prop("hasConflict"),
      preventSaveWhenOwnerMismatch: ({ prop }) => !prop("canSaveAsOwner"),
      /** Composes the three `prevent*` guards (named for spec / readability). */
      canPersist: ({ guard }) =>
        !guard("preventSaveWhenNoChanges") &&
        !guard("preventSaveWhenConflict") &&
        !guard("preventSaveWhenOwnerMismatch"),
    },
  },
});
