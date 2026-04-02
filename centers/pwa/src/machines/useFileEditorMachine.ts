import { useMachine } from "@zag-js/solid";
import {
  type FileEditorPersistResult,
  fileEditorMachine,
} from "./file-editor-machine";

export type { FileEditorPersistResult };

export const useFileEditorMachine = (props: {
  readonly isDirty: () => boolean;
  readonly canSaveAsOwner: () => boolean;
  readonly onPersist: () => Promise<FileEditorPersistResult>;
  readonly debounceMs?: number;
  readonly maxRetries?: number;
}) =>
  useMachine(fileEditorMachine, () => ({
    id: "txtatelier-file-editor",
    getRootNode: () => document,
    debounceMs: props.debounceMs ?? 300,
    maxRetries: props.maxRetries ?? 3,
    isDirty: () => props.isDirty(),
    canSaveAsOwner: () => props.canSaveAsOwner(),
    onPersist: props.onPersist,
  }));
