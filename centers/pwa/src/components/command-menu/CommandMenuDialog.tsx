import { Dialog } from "@ark-ui/solid";
import { createEffect, createMemo, createSignal } from "solid-js";
import type { FilesRow } from "../../evolu/files";
import { CommandMenuCombobox } from "./CommandMenuCombobox";

export const CommandMenuDialog = (props: {
  open: boolean;
  files: ReadonlyArray<FilesRow>;
  selectedFileId: FilesRow["id"] | null;
  onOpenChange: (open: boolean) => void;
  onSelectFile: (id: FilesRow["id"]) => void;
  onOpenSettings: () => void;
  editorTextArea: () => HTMLTextAreaElement | null;
}) => {
  let inputEl: HTMLInputElement | undefined;
  const [a11yMsg, setA11yMsg] = createSignal("");
  const [fileCount, setFileCount] = createSignal<{
    total: number;
    filtered: number;
    isActionMode: boolean;
  }>({ total: 0, filtered: 0, isActionMode: false });

  const selectedFile = createMemo(() => {
    if (props.selectedFileId == null) return null;
    return props.files.find((f) => f.id === props.selectedFileId) ?? null;
  });

  const titleText = createMemo(() => {
    const { total, filtered, isActionMode } = fileCount();
    const selected = selectedFile();
    const selectedPart = selected ? ` · ${selected.path}` : "";
    if (isActionMode) return "Actions";
    if (total === 0) return "File switcher";
    if (filtered === total)
      return `File switcher${selectedPart} · ${total} files`;
    return `File switcher${selectedPart} · ${filtered} of ${total} files`;
  });

  createEffect(() => {
    if (props.open) {
      setA11yMsg("File switcher opened");
      queueMicrotask(() => inputEl?.focus());
    } else {
      setA11yMsg("File switcher closed");
    }
  });

  return (
    <>
      <div class="sr-only" aria-live="polite" aria-atomic="true">
        {a11yMsg()}
      </div>
      <Dialog.Root
        open={props.open}
        onOpenChange={(d) => props.onOpenChange(d.open)}
        closeOnEscape
        closeOnInteractOutside
        initialFocusEl={() => inputEl ?? null}
        finalFocusEl={() => props.editorTextArea()}
        restoreFocus
        modal
        trapFocus
        preventScroll
      >
        <Dialog.Backdrop class="fixed inset-0 z-40 bg-black/45 backdrop-blur-[1px] dark:bg-black/60" />
        <Dialog.Positioner class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 pt-[12vh]">
          <Dialog.Content
            class="w-full max-w-lg border border-black/20 bg-[#f2f1ee] text-[#111111] shadow-lg dark:border-white/20 dark:bg-[#1a1b1c] dark:text-[#efefef]"
            aria-labelledby="txtatelier-file-switcher-title"
          >
            <Dialog.Title
              id="txtatelier-file-switcher-title"
              class="border-b border-black/15 px-3 py-2 text-sm font-semibold dark:border-white/15"
            >
              {titleText()}
            </Dialog.Title>
            <Dialog.Description class="sr-only">
              Type to filter files by path. Type a question mark for actions
              including settings. Use arrow keys to move, Enter to open, Escape
              to close.
            </Dialog.Description>
            <CommandMenuCombobox
              files={props.files}
              selectedFileId={props.selectedFileId}
              onSelect={(id) => {
                props.onSelectFile(id);
                props.onOpenChange(false);
              }}
              onOpenSettings={() => {
                props.onOpenSettings();
                props.onOpenChange(false);
              }}
              inputRef={(el) => {
                inputEl = el;
              }}
              onFileCountChange={setFileCount}
            />
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </>
  );
};
