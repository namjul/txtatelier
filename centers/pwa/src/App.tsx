import type { EvoluError } from "@evolu/common";
import { deriveShardOwner } from "@evolu/common/local-first";
import { createShortcut } from "@solid-primitives/keyboard";
import {
  createEffect,
  createResource,
  createSignal,
  Show,
  Suspense,
} from "solid-js";
import { CommandMenuDialog } from "./components/command-menu/CommandMenuDialog";
import { FileSwitcherHint } from "./components/command-menu/FileSwitcherHint";
import { MobileCommandAffordance } from "./components/command-menu/MobileCommandAffordance";
import { FileEditor } from "./components/editor/FileEditor";
import type { StatusOps, StatusState } from "./components/editor/types";
import { useFileEditor } from "./components/editor/useFileEditor";
import { useFileList } from "./components/editor/useFileList";
import { SettingsDialog } from "./components/settings/SettingsDialog";
import { evolu } from "./evolu/client";
import { createUseEvolu, EvoluProvider, useEvoluError } from "./evolu/evolu";

const useEvolu = createUseEvolu(evolu);

const formatEvoluError = (error: EvoluError): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { readonly message: unknown }).message);
  }
  return JSON.stringify(error);
};

const FilesWorkspace = (props: {
  filesShardOwnerId: () => string | undefined;
  ownerId: () => string | undefined;
  status: StatusOps;
  commandMenuOpen: boolean;
  onCommandMenuOpenChange: (open: boolean) => void;
  onEditorTextAreaRef?: (el: HTMLTextAreaElement | null) => void;
}) => {
  const fileList = useFileList();
  const editor = useFileEditor(
    props.filesShardOwnerId,
    props.ownerId,
    () => fileList.selectedFile(),
    props.status,
  );
  let editorTextAreaEl: HTMLTextAreaElement | undefined;

  createEffect(() => {
    const file = fileList.selectedFile();
    if (file) {
      document.title = `${file.path} — txtatelier`;
    } else {
      document.title = "txtatelier";
    }
  });

  createEffect(() => {
    if (fileList.selectedFile() == null) {
      props.onEditorTextAreaRef?.(null);
    }
  });

  return (
    <>
      <FileSwitcherHint />
      <section class="flex min-h-0 min-w-0 flex-1 flex-col" aria-label="Editor">
        <Suspense
          fallback={
            <p class="p-3 text-sm text-black/65 dark:text-white/65">
              loading files
            </p>
          }
        >
          <Show when={!fileList.fileRows.loading}>
            <Show
              when={fileList.files().length > 0}
              fallback={
                <p class="p-3 text-sm text-black/65 dark:text-white/65">
                  no files available
                </p>
              }
            >
              <Show
                when={fileList.selectedFile()}
                fallback={
                  <p class="p-3 text-black/65 dark:text-white/65">
                    select a file to open its content
                  </p>
                }
              >
                {(file) => (
                  <FileEditor
                    file={file()}
                    draft={editor.draft()}
                    hasConflict={editor.hasConflict()}
                    conflictRemote={editor.conflictRemote()}
                    autoSaveUi={editor.autoSaveUi()}
                    saveFailedFinal={editor.saveFailedFinal()}
                    editorRef={(el) => {
                      editorTextAreaEl = el;
                      props.onEditorTextAreaRef?.(el ?? null);
                    }}
                    onDraftChange={editor.setDraft}
                    onResolveConflict={editor.resolveConflict}
                    onSaveConflictArtifact={editor.saveDraftAsConflictArtifact}
                  />
                )}
              </Show>
            </Show>
          </Show>
        </Suspense>
      </section>

      <MobileCommandAffordance
        commandMenuOpen={props.commandMenuOpen}
        onOpenRequest={() => props.onCommandMenuOpenChange(true)}
      />

      <CommandMenuDialog
        open={props.commandMenuOpen}
        onOpenChange={props.onCommandMenuOpenChange}
        files={fileList.files()}
        selectedFileId={fileList.selectedFileId()}
        onSelectFile={fileList.selectFile}
        editorTextArea={() => editorTextAreaEl ?? null}
      />
    </>
  );
};

export const App = () => {
  return (
    <EvoluProvider value={evolu}>
      <AppShell />
    </EvoluProvider>
  );
};

const AppShell = () => {
  const evoluClient = useEvolu();
  const [settingsOpen, setSettingsOpen] = createSignal(false);
  const [commandMenuOpen, setCommandMenuOpen] = createSignal(false);
  const [editorTextArea, setEditorTextArea] =
    createSignal<HTMLTextAreaElement | null>(null);
  const [status, setStatus] = createSignal<StatusState>({
    message: "ready",
    tone: "idle",
    lastAction: null,
  });

  const [owner] = createResource(async () => evoluClient.appOwner);
  const ownerId = () => owner()?.id;
  const filesShardOwnerId = () => {
    const o = owner();
    if (o == null) return undefined;
    return deriveShardOwner(o, ["files", 1]).id;
  };

  const statusOps: StatusOps = {
    setOk: (message) =>
      setStatus((prev) => ({
        ...prev,
        message,
        tone: "ok",
        lastAction: message,
      })),
    setError: (message) =>
      setStatus((prev) => ({ ...prev, message, tone: "error" })),
    setIdle: (message) =>
      setStatus((prev) => ({ ...prev, message, tone: "idle" })),
    setLastAction: (lastAction) =>
      setStatus((prev) => ({ ...prev, lastAction })),
  };

  const evoluError = useEvoluError();
  createEffect(() => {
    const err = evoluError();
    if (err == null) return;
    setStatus((prev) => ({
      ...prev,
      message: formatEvoluError(err),
      tone: "error",
    }));
  });

  const openCommandMenu = () => {
    if (!settingsOpen()) setCommandMenuOpen(true);
  };

  const goSettings = () => {
    setSettingsOpen((open) => !open);
  };

  createEffect(() => {
    if (settingsOpen()) setCommandMenuOpen(false);
  });

  createShortcut(["META", "K"], () => openCommandMenu(), {
    preventDefault: true,
  });
  createShortcut(["CONTROL", "K"], () => openCommandMenu(), {
    preventDefault: true,
  });
  createShortcut(["META", ","], () => goSettings(), { preventDefault: true });
  createShortcut(["CONTROL", ","], () => goSettings(), {
    preventDefault: true,
  });

  return (
    <main class="fixed inset-0 flex flex-col bg-[#f2f1ee] font-mono text-[#111111] dark:bg-[#151617] dark:text-[#efefef]">
      <FilesWorkspace
        filesShardOwnerId={filesShardOwnerId}
        ownerId={ownerId}
        status={statusOps}
        commandMenuOpen={commandMenuOpen()}
        onCommandMenuOpenChange={setCommandMenuOpen}
        onEditorTextAreaRef={setEditorTextArea}
      />

      <SettingsDialog
        open={settingsOpen()}
        onOpenChange={setSettingsOpen}
        editorTextArea={() => editorTextArea()}
        owner={owner}
        ownerId={ownerId}
        appStatus={status}
        statusOps={statusOps}
      />
    </main>
  );
};
