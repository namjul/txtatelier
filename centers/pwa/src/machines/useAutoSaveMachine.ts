import { useMachine } from "@zag-js/solid";
import type { Accessor } from "solid-js";
import { autoSaveMachine } from "./auto-save-machine";

/** Props are re-read each run so Zag guards see current Solid memos. */
export const useAutoSaveMachine = (props: {
  readonly isDirty: Accessor<boolean>;
  readonly hasConflict: Accessor<boolean>;
  readonly canSaveAsOwner: Accessor<boolean>;
}) =>
  useMachine(autoSaveMachine, () => ({
    id: "txtatelier-auto-save",
    // Zag scope; this machine has no DOM nodes but the adapter expects a root.
    getRootNode: () => document,
    isDirty: props.isDirty(),
    hasConflict: props.hasConflict(),
    canSaveAsOwner: props.canSaveAsOwner(),
  }));
