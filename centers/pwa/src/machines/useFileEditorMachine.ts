import { useMachine } from "@zag-js/solid";
import type { Accessor } from "solid-js";
import { fileEditorMachine } from "./file-editor-machine";

/** Props are re-read each run so Zag guards see current Solid memos. */
export const useFileEditorMachine = (props: {
  readonly isDirty: Accessor<boolean>;
  readonly canSaveAsOwner: Accessor<boolean>;
}) =>
  useMachine(fileEditorMachine, () => ({
    id: "txtatelier-file-editor",
    getRootNode: () => document,
    isDirty: props.isDirty(),
    canSaveAsOwner: props.canSaveAsOwner(),
  }));
