import type { EvoluError } from "@evolu/common";
import { deriveShardOwner } from "@evolu/common/local-first";
import { FILES_SHARD } from "@txtatelier/sync-invariants";
import { createShortcut } from "@solid-primitives/keyboard";
import { createPageVisibility } from "@solid-primitives/page-visibility";
import {
  createEffect,
  createResource,
  createSignal,
  onCleanup,
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
import { PENDING_SHARE_MESSAGE_TYPE } from "./share-target/constants";
import { tryProcessPendingShare } from "./share-target/process-pending-share";

/** Interval (ms) to poll for pending shares when page is visible */
const PENDING_SHARE_POLL_MS = 8000;

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
  onOpenSettings: () => void;
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
      <Suspense
        fallback={
          <p class="p-3 text-sm text-black/65 dark:text-white/65">
            loading files
          </p>
        }
      >
        <section
          class="flex min-h-0 min-w-0 flex-1 flex-col"
          aria-label="Editor"
        >
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
                <div class="relative flex min-h-0 min-w-0 flex-1 flex-col">
                  <FileEditor
                    file={file()}
                    draft={editor.draft()}
                    hasConflict={editor.hasConflict()}
                    editorRef={(el) => {
                      editorTextAreaEl = el;
                      props.onEditorTextAreaRef?.(el ?? null);
                    }}
                    onDraftChange={editor.setDraft}
                    onReplaceDraftWithRemote={editor.replaceDraftWithRemote}
                    onSaveConflictArtifact={editor.saveDraftAsConflictArtifact}
                  />
                  <Show
                    when={
                      editor.autoSaveUi() !== "clean" || editor.savedFlash()
                    }
                  >
                    <div
                      class="pointer-events-none absolute bottom-2 right-0 max-w-[40%] truncate text-right text-[10px] text-black/45 dark:text-white/45"
                      aria-live="polite"
                    >
                      <Show when={editor.autoSaveUi() === "saving"}>
                        <span>Saving…</span>
                      </Show>
                      <Show when={editor.autoSaveUi() === "dirty"}>
                        <span>Unsaved</span>
                      </Show>
                      <Show when={editor.savedFlash()}>
                        <span class="text-[#0f6a31] dark:text-[#6fc38c]">
                          Saved
                        </span>
                      </Show>
                      <Show when={editor.autoSaveUi() === "error"}>
                        <span
                          class="text-[#a32222] dark:text-[#ff8f8f]"
                          title="Save failed"
                        >
                          {editor.saveFailedFinal()
                            ? "Save failed"
                            : "Error — retrying…"}
                        </span>
                      </Show>
                    </div>
                  </Show>
                </div>
              )}
            </Show>
          </Show>
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
          onOpenSettings={props.onOpenSettings}
          editorTextArea={() => editorTextAreaEl ?? null}
        />
      </Suspense>
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
  const pageVisible = createPageVisibility();
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
    return deriveShardOwner(o, FILES_SHARD).id;
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

  createEffect(() => {
    const handler = (ev: MessageEvent): void => {
      if (ev.data?.type === PENDING_SHARE_MESSAGE_TYPE) {
        void tryProcessPendingShare(evoluClient);
      }
    };
    navigator.serviceWorker.addEventListener("message", handler);
    onCleanup(() => {
      navigator.serviceWorker.removeEventListener("message", handler);
    });
  });

  createEffect(() => {
    if (!pageVisible()) return;
    void tryProcessPendingShare(evoluClient);
    const id = window.setInterval(() => {
      void tryProcessPendingShare(evoluClient);
    }, PENDING_SHARE_POLL_MS);
    onCleanup(() => window.clearInterval(id));
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
        onOpenSettings={() => setSettingsOpen(true)}
        onEditorTextAreaRef={setEditorTextArea}
      />

      <SettingsDialog
        open={settingsOpen()}
        onOpenChange={setSettingsOpen}
        editorTextArea={() => editorTextArea()}
        owner={owner}
        appStatus={status}
        statusOps={statusOps}
      />
    </main>
  );
};
