import { Combobox, createListCollection } from "@ark-ui/solid";
import {
  createFormatTypeError,
  type EvoluError,
  type MaxLengthError,
  type MinLengthError,
  Mnemonic,
} from "@evolu/common";
import { deriveShardOwner } from "@evolu/common/local-first";
import { debounce } from "@solid-primitives/scheduled";
import { createVirtualizer } from "@tanstack/solid-virtual";
import type { Accessor } from "solid-js";
import {
  createEffect,
  createMemo,
  createResource,
  createSignal,
  For,
  onCleanup,
  Show,
  Suspense,
} from "solid-js";
import {
  defaultRelayUrl,
  evolu,
  getFilesShardMutationOptions,
} from "./evolu/client";
import { computeContentHash } from "./evolu/contentHash";
import {
  EvoluProvider,
  createUseEvolu,
  useEvoluError,
  useQuery,
} from "./evolu/evolu";
import { type FilesRow, filesQuery } from "./evolu/files";
import { useAutoSaveMachine } from "./machines/useAutoSaveMachine";

// =============================================================================
// SETUP
// =============================================================================

const useEvolu = createUseEvolu(evolu);

// =============================================================================
// TYPES
// =============================================================================

type Page = "files" | "settings";
type StatusTone = "idle" | "ok" | "error";
type ConflictStrategy = "local" | "remote";

interface StatusState {
  readonly message: string;
  readonly tone: StatusTone;
  readonly lastAction: string | null;
}

interface StatusOps {
  readonly setOk: (message: string) => void;
  readonly setError: (message: string) => void;
  readonly setIdle: (message: string) => void;
  readonly setLastAction: (action: string) => void;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

const createConflictArtifactPath = (
  path: string,
  ownerId: string,
  timestamp: number,
): string => {
  const slashIndex = path.lastIndexOf("/");
  const dir = slashIndex === -1 ? "" : path.slice(0, slashIndex + 1);
  const fileName = slashIndex === -1 ? path : path.slice(slashIndex + 1);
  const dotIndex = fileName.lastIndexOf(".");

  if (dotIndex <= 0) {
    return `${dir}${fileName}.conflict-${ownerId}-${timestamp}`;
  }

  const base = fileName.slice(0, dotIndex);
  const ext = fileName.slice(dotIndex);
  return `${dir}${base}.conflict-${ownerId}-${timestamp}${ext}`;
};

const formatTypeError = createFormatTypeError<MinLengthError | MaxLengthError>(
  (error): string => {
    switch (error.type) {
      case "MinLength":
        return `Text must be at least ${error.min} characters`;
      case "MaxLength":
        return `Text is too long (max ${error.max})`;
    }
    return "Invalid input";
  },
);

const formatEvoluError = (error: EvoluError): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { readonly message: unknown }).message);
  }
  return JSON.stringify(error);
};

// =============================================================================
// HOOK: FILE LIST MANAGEMENT
// =============================================================================

const useFileList = () => {
  const fileRows = useQuery(filesQuery);
  const files = createMemo(
    () => (fileRows() ?? [])
  );
  const [selectedFileId, setSelectedFileId] = createSignal<
    FilesRow["id"] | null
  >(null);

  const selectedFile = createMemo(() => {
    const id = selectedFileId();
    if (id == null) return null;
    return files().find((file) => file.id === id) ?? null;
  });

  // Auto-select first file when list changes
  createEffect(() => {
    const list = files();
    const current = selectedFileId();

    if (list.length === 0) {
      if (current != null) setSelectedFileId(null);
      return;
    }

    if (current == null) {
      const first = list.at(0);
      if (first) setSelectedFileId(first.id);
      return;
    }

    const stillExists = list.some((file) => file.id === current);
    if (!stillExists) {
      const first = list.at(0);
      if (first) setSelectedFileId(first.id);
    }
  });

  return {
    fileRows,
    files,
    selectedFileId,
    selectedFile,
    selectFile: setSelectedFileId,
  };
};

type AutoSaveUiState = "idle" | "dirty" | "saving" | "saved" | "error";

// =============================================================================
// HOOK: FILE EDITOR MANAGEMENT
// =============================================================================

const useFileEditor = (
  filesShardOwnerId: () => string | undefined,
  ownerId: () => string | undefined,
  selectedFile: () => FilesRow | null,
  status: StatusOps,
) => {
  const evoluClient = useEvolu();
  const [editorFileId, setEditorFileId] = createSignal<FilesRow["id"] | null>(
    null,
  );
  const [draft, setDraft] = createSignal("");
  const [baseContent, setBaseContent] = createSignal("");
  const [baseFingerprint, setBaseFingerprint] = createSignal<string | null>(
    null,
  );
  const [conflictRemote, setConflictRemote] = createSignal<FilesRow | null>(
    null,
  );
  const [isSaving, setIsSaving] = createSignal(false);
  const [saveFailedFinal, setSaveFailedFinal] = createSignal(false);
  /** Counts failed persist attempts for exponential backoff (see runScheduledPersist). */
  let persistRetryCount = 0;

  const isDirty = createMemo(() => {
    if (selectedFile() == null) return false;
    return draft() !== baseContent();
  });

  const hasConflict = createMemo(() => conflictRemote() != null);

  // Row `ownerId` is the files shard id (see getFilesShardMutationOptions), not appOwner.id.
  const canSaveAsOwner = createMemo(() => {
    const file = selectedFile();
    const shardOid = filesShardOwnerId();
    if (file == null || shardOid == null) return false;
    return file.ownerId === shardOid;
  });

  // FSM for indicator text; debounced work below decides when to call Evolu.
  const autoSave = useAutoSaveMachine({
    isDirty,
    hasConflict,
    canSaveAsOwner,
  });

  const autoSaveUi = createMemo((): AutoSaveUiState => {
    if (autoSave.state.matches("saving")) return "saving";
    if (autoSave.state.matches("saved")) return "saved";
    if (autoSave.state.matches("error")) return "error";
    if (autoSave.state.matches("dirty")) return "dirty";
    return "idle";
  });

  // Sync editor with selected file
  createEffect(() => {
    const file = selectedFile();

    if (file == null) {
      // Pending debounced save must not run after the editor is closed or file list empties.
      scheduleAutoSave.clear();
      persistRetryCount = 0;
      setSaveFailedFinal(false);
      autoSave.send({ type: "RESET" });
      setEditorFileId(null);
      setBaseContent("");
      setBaseFingerprint(null);
      setConflictRemote(null);
      setDraft("");
      return;
    }

    const currentContent = file.content ?? "";

    // New file selected - reset editor
    if (editorFileId() !== file.id) {
      scheduleAutoSave.clear();
      persistRetryCount = 0;
      setSaveFailedFinal(false);
      autoSave.send({ type: "RESET" });
      setEditorFileId(file.id);
      setBaseContent(currentContent);
      setBaseFingerprint(file.contentHash);
      setConflictRemote(null);
      setDraft(currentContent);
      return;
    }

    // Skip sync processing while we're in the middle of saving
    if (isSaving()) {
      return;
    }

    // No remote changes
    if (file.contentHash === baseFingerprint()) {
      return;
    }

    // Conflict: remote changed while draft is dirty
    if (isDirty()) {
      if (!hasConflict()) {
        status.setError("conflict detected");
      }
      setConflictRemote(file);
      return;
    }

    // No local changes - accept remote
    setBaseContent(currentContent);
    setBaseFingerprint(file.contentHash);
    setConflictRemote(null);
    setDraft(currentContent);
    autoSave.send({ type: "RESET" });
  });

  const persistDraft = async (): Promise<boolean> => {
    const file = selectedFile();
    if (
      file == null ||
      !isDirty() ||
      hasConflict() ||
      !canSaveAsOwner()
    ) {
      return false;
    }

    const content = draft();
    const contentHash = await computeContentHash(content);
    if (contentHash === file.contentHash) {
      // No Evolu mutation needed; still align baseline so the sync effect stays quiet.
      setBaseContent(content);
      setBaseFingerprint(contentHash);
      return true;
    }

    setIsSaving(true);

    const shard = await getFilesShardMutationOptions(evoluClient);
    const result = evoluClient.update(
      "file",
      {
        id: file.id,
        content,
        contentHash,
      },
      shard,
    );

    if (!result.ok) {
      setIsSaving(false);
      status.setError("invalid value");
      return false;
    }

    setBaseContent(content);
    setBaseFingerprint(contentHash);
    setIsSaving(false);
    status.setLastAction(`saved ${file.path}`);
    status.setIdle("ready");
    return true;
  };

  const runScheduledPersist = async (): Promise<void> => {
    if (!isDirty() || hasConflict() || !canSaveAsOwner()) {
      autoSave.send({ type: "RESET" });
      return;
    }

    autoSave.send({ type: "SAVE" });
    // Zag applies transitions in a microtask; without this, matches("saving") is still stale.
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    if (!autoSave.state.matches("saving")) return; // SAVE didn't pass guards (e.g. race with cleared draft)

    const ok = await persistDraft();
    if (ok) {
      persistRetryCount = 0;
      setSaveFailedFinal(false);
      autoSave.send({ type: "SAVE_SUCCESS" });
      return;
    }

    autoSave.send({ type: "SAVE_ERROR" });
    if (persistRetryCount < 3) {
      persistRetryCount += 1;
      const delayMs = 1000 * 2 ** (persistRetryCount - 1);
      window.setTimeout(() => void runScheduledPersist(), delayMs);
    } else {
      setSaveFailedFinal(true);
    }
  };

  const scheduleAutoSave = debounce(() => {
    void runScheduledPersist();
  }, 300); // trailing edge; cleared on file close/switch or when persist is disallowed

  createEffect(() => {
    const file = selectedFile();
    draft();
    baseContent();

    if (file == null) return;

    // Keep FSM in sync with the editor; debounce only arms when a persist is actually allowed.
    autoSave.send({ type: "TYPE" });

    if (!isDirty() || hasConflict() || !canSaveAsOwner()) {
      scheduleAutoSave.clear();
      return;
    }

    scheduleAutoSave();
  });

  createEffect(() => {
    if (!autoSave.state.matches("saved")) return;
    // Brief "Saved" label without leaving the UI stuck in saved forever.
    const handle = window.setTimeout(() => {
      autoSave.send({ type: "RESET" });
    }, 2000);
    onCleanup(() => window.clearTimeout(handle));
  });

  const resolveConflict = (strategy: ConflictStrategy) => {
    const remote = conflictRemote();
    if (remote == null) return;

    if (strategy === "remote") {
      const remoteContent = remote.content ?? "";
      setDraft(remoteContent);
      setBaseContent(remoteContent);
      setBaseFingerprint(remote.contentHash);
    }

    setConflictRemote(null);
    const detail =
      strategy === "remote"
        ? "draft replaced with remote"
        : "conflict dismissed";
    status.setLastAction(detail);
    status.setIdle("ready");
  };

  const saveDraftAsConflictArtifact = async () => {
    const file = selectedFile();
    if (file == null || !hasConflict()) return;

    const appOwnerId = ownerId();
    if (appOwnerId == null) {
      status.setError("owner not loaded");
      return;
    }

    status.setIdle("saving conflict artifact…");
    const draftContent = draft();
    const draftHash = await computeContentHash(draftContent);
    const artifactPath = createConflictArtifactPath(
      file.path,
      appOwnerId.slice(0, 8),
      Date.now(),
    );

    const shard = await getFilesShardMutationOptions(evoluClient);
    const result = evoluClient.insert(
      "file",
      {
        path: artifactPath,
        content: draftContent,
        contentHash: draftHash,
      },
      shard,
    );

    if (!result.ok) {
      status.setError("could not save conflict artifact");
      return;
    }

    const remoteContent = file.content ?? "";
    setDraft(remoteContent);
    setBaseContent(remoteContent);
    setBaseFingerprint(file.contentHash);
    setConflictRemote(null);
    const msg = `saved conflict artifact ${artifactPath}`;
    status.setLastAction(msg);
    status.setIdle("ready");
  };

  return {
    draft,
    setDraft,
    isDirty,
    hasConflict,
    conflictRemote,
    autoSaveUi,
    saveFailedFinal,
    resolveConflict,
    saveDraftAsConflictArtifact,
  };
};

// =============================================================================
// COMPONENT: FILE PICKER (Virtualized)
// =============================================================================

interface FileOption {
  readonly label: string;
  readonly value: string;
}

const FilePicker = (props: {
  files: ReadonlyArray<FilesRow>;
  selectedFileId: FilesRow["id"] | null;
  onSelect: (id: FilesRow["id"]) => void;
}) => {
  const [search, setSearch] = createSignal("");
  const [isOpen, setIsOpen] = createSignal(false);
  let scrollRef: HTMLDivElement | undefined;

  // Filter files based on search (show all when empty)
  const fileOptions = createMemo<ReadonlyArray<FileOption>>(() => {
    const searchTerm = search().trim().toLowerCase();
    return props.files
      .filter((file) => {
        if (searchTerm === "") return true;
        return file.path.toLowerCase().includes(searchTerm);
      })
      .map((file) => ({
        label: file.path,
        value: String(file.id),
      }));
  });

  // Create collection with filtered items
  const collection = createMemo(() =>
    createListCollection<FileOption>({
      items: fileOptions(),
      itemToString: (item) => item.label,
      itemToValue: (item) => item.value,
    }),
  );

  // Virtualizer setup: 32px per item, 288px viewport (9 items), 5 overscan
  const virtualizer = createVirtualizer({
    get count() {
      return fileOptions().length;
    },
    getScrollElement: () => scrollRef ?? null,
    estimateSize: () => 32,
    overscan: 5,
  });

  // Subscribe to virtual items and total size - makes them reactive
  const virtualItems = createMemo(() => virtualizer.getVirtualItems());
  const totalSize = createMemo(() => virtualizer.getTotalSize());

  // Re-measure when dropdown opens or files change
  createEffect(() => {
    // Trigger when open state changes or file count changes
    const open = isOpen();
    const count = fileOptions().length;
    if (open && scrollRef && count > 0) {
      // Small delay to ensure DOM is ready
      setTimeout(() => virtualizer.measure(), 0);
    }
  });

  const value = createMemo(() =>
    props.selectedFileId == null ? [] : [String(props.selectedFileId)],
  );

  return (
    <div class="relative w-full">
      <Combobox.Root
        collection={collection()}
        value={value()}
        openOnClick
        positioning={{ placement: "bottom-start" }}
        onOpenChange={(details) => setIsOpen(details.open)}
        onInputValueChange={(details) => setSearch(details.inputValue)}
        onValueChange={(details) => {
          const selectedValue = details.value.at(0);
          if (!selectedValue) return;

          const selected = props.files.find(
            (file) => String(file.id) === selectedValue,
          );
          if (!selected) return;

          props.onSelect(selected.id);
        }}
        scrollToIndexFn={(details) => {
          virtualizer.scrollToIndex(details.index, { align: "start" });
        }}
      >
        <Combobox.Label class="mb-1 block text-xs">Search files</Combobox.Label>
        <Combobox.Control class="flex">
          <Combobox.Input
            class="w-full rounded-none border border-black/25 bg-transparent px-2.5 py-2 text-sm outline-none focus:border-black dark:border-white/25 dark:focus:border-white"
            placeholder="Type a path"
          />
          <Combobox.Trigger
            type="button"
            class="border border-l-0 border-black/25 px-3 text-xs dark:border-white/25"
          >
            open
          </Combobox.Trigger>
        </Combobox.Control>
        <Combobox.Positioner class="z-10">
          <Combobox.Content class="border border-black/25 bg-[#f2f1ee] dark:border-white/25 dark:bg-[#151617]">
            <Show
              when={fileOptions().length > 0}
              fallback={
                <div class="px-2 py-3 text-sm text-black/65 dark:text-white/65">
                  No result found for "{search()}"
                </div>
              }
            >
              <div ref={scrollRef} class="h-72 overflow-auto">
                <div
                  style={{
                    height: `${totalSize()}px`,
                    position: "relative",
                  }}
                >
                  <For each={virtualItems()}>
                    {(virtualItem) => {
                      const item = fileOptions()[virtualItem.index];
                      if (!item) return null;
                      const isSelected = value().includes(item.value);
                      return (
                        <Combobox.Item
                          item={item}
                          class={`
                            absolute left-0 w-full cursor-pointer px-2 py-1 text-sm
                            data-[highlighted]:bg-black/10 dark:data-[highlighted]:bg-white/10
                            ${isSelected ? "bg-black/5 dark:bg-white/5 font-medium" : ""}
                          `}
                          style={{
                            height: `${virtualItem.size}px`,
                            transform: `translateY(${virtualItem.start}px)`,
                          }}
                        >
                          <Combobox.ItemText>{item.label}</Combobox.ItemText>
                        </Combobox.Item>
                      );
                    }}
                  </For>
                </div>
              </div>
            </Show>
          </Combobox.Content>
        </Combobox.Positioner>
      </Combobox.Root>
    </div>
  );
};

// =============================================================================
// COMPONENT: EDITOR
// =============================================================================

const Editor = (props: {
  file: FilesRow;
  draft: string;
  isDirty: boolean;
  hasConflict: boolean;
  conflictRemote: FilesRow | null;
  autoSaveUi: AutoSaveUiState;
  saveFailedFinal: boolean;
  onDraftChange: (value: string) => void;
  onResolveConflict: (strategy: ConflictStrategy) => void;
  onSaveConflictArtifact: () => void;
}) => {
  return (
    <>
      <div class="flex min-w-0 items-center justify-between gap-3">
        <p class="min-w-0 flex-1 truncate text-sm">{props.file.path}</p>
        {/* Persistence is debounced in useFileEditor; conflict actions stay below. */}
        <div class="shrink-0 text-right text-xs text-black/55 dark:text-white/55">
          <Show when={props.autoSaveUi === "saving"}>
            <span class="text-black/50 dark:text-white/50">Saving…</span>
          </Show>
          <Show when={props.autoSaveUi === "saved"}>
            <span class="text-[#0f6a31] dark:text-[#6fc38c]">Saved</span>
          </Show>
          <Show when={props.autoSaveUi === "error"}>
            <span class="text-[#a32222] dark:text-[#ff8f8f]" title="Save failed">
              {props.saveFailedFinal ? "Save failed" : "Error — retrying…"}
            </span>
          </Show>
        </div>
      </div>

      <Show when={props.hasConflict}>
        <div class="space-y-2 border border-[#a32222]/40 p-3 text-xs dark:border-[#ff8f8f]/50">
          <p>conflict detected: remote changed while this draft is dirty</p>
          <p>
            remote owner: {String(props.conflictRemote?.ownerId ?? "unknown")}
          </p>
          <div class="flex flex-wrap gap-2">
            <button
              type="button"
              class="rounded-none border border-black/25 px-2.5 py-1 hover:bg-black/5 dark:border-white/25 dark:hover:bg-white/10"
              onClick={() => void props.onSaveConflictArtifact()}
            >
              save draft as conflict artifact
            </button>
            <button
              type="button"
              class="rounded-none border border-black/25 px-2.5 py-1 hover:bg-black/5 dark:border-white/25 dark:hover:bg-white/10"
              onClick={() => props.onResolveConflict("remote")}
            >
              replace draft with remote
            </button>
          </div>
        </div>
      </Show>

      <textarea
        class="min-h-[68vh] w-full rounded-none border border-black/25 bg-transparent p-2 font-mono text-xs leading-5 dark:border-white/25"
        value={props.draft}
        onInput={(event) => props.onDraftChange(event.currentTarget.value)}
      />
    </>
  );
};

// =============================================================================
// COMPONENT: FILE WORKSPACE
// =============================================================================

const FileWorkspace = (props: {
  filesShardOwnerId: () => string | undefined;
  ownerId: () => string | undefined;
  status: StatusOps;
}) => {
  return (
    <section class="w-full space-y-5 text-sm leading-6">
      <Suspense
        fallback={
          <p class="text-sm text-black/65 dark:text-white/65">loading files</p>
        }
      >
        <FileWorkspaceContent {...props} />
      </Suspense>
    </section>
  );
};

const FileWorkspaceContent = (props: {
  filesShardOwnerId: () => string | undefined;
  ownerId: () => string | undefined;
  status: StatusOps;
}) => {
  const fileList = useFileList();
  const editor = useFileEditor(
    props.filesShardOwnerId,
    props.ownerId,
    () => fileList.selectedFile(),
    props.status,
  );

  return (
    <>
      <Show when={!fileList.fileRows.loading}>
        <Show
          when={fileList.files().length > 0}
          fallback={
            <p class="text-sm text-black/65 dark:text-white/65">
              no files available
            </p>
          }
        >
          <FilePicker
            files={fileList.files()}
            selectedFileId={fileList.selectedFileId()}
            onSelect={fileList.selectFile}
          />
        </Show>
      </Show>

      <Show
        when={fileList.selectedFile()}
        fallback={
          <p class="text-black/65 dark:text-white/65">
            select a file to open its content
          </p>
        }
      >
        {(file) => (
          <Editor
            file={file()}
            draft={editor.draft()}
            isDirty={editor.isDirty()}
            hasConflict={editor.hasConflict()}
            conflictRemote={editor.conflictRemote()}
            autoSaveUi={editor.autoSaveUi()}
            saveFailedFinal={editor.saveFailedFinal()}
            onDraftChange={editor.setDraft}
            onResolveConflict={editor.resolveConflict}
            onSaveConflictArtifact={editor.saveDraftAsConflictArtifact}
          />
        )}
      </Show>
    </>
  );
};

// =============================================================================
// COMPONENT: SETTINGS PANEL
// =============================================================================

interface OwnerData {
  readonly id: string;
  readonly mnemonic?: string | null;
}

type OwnerResource = ReturnType<typeof createResource<OwnerData>>;

const SettingsPanel = (props: {
  owner: OwnerResource[0];
  ownerId: () => string | undefined;
  appStatus: Accessor<StatusState>;
  statusOps: StatusOps;
}) => {
  const evoluClient = useEvolu();
  const [showMnemonic, setShowMnemonic] = createSignal(false);
  const [transportUrl, setTransportUrl] = createSignal(
    localStorage.getItem("transportUrl") ?? "",
  );

  const handleRestoreFromMnemonic = async () => {
    const value = window.prompt("Enter mnemonic");
    if (value == null) return;

    const parsed = Mnemonic.from(value.trim());
    if (!parsed.ok) {
      props.statusOps.setError(formatTypeError(parsed.error));
      return;
    }

    props.statusOps.setIdle("restoring…");
    await evoluClient.restoreAppOwner(parsed.value);
    props.statusOps.setLastAction("restored from mnemonic");
    props.statusOps.setIdle("ready");
  };

  const handleResetOwner = async () => {
    const confirmed = window.confirm(
      "Reset local owner and data? This action is destructive.",
    );
    if (!confirmed) return;

    props.statusOps.setIdle("resetting…");
    await evoluClient.resetAppOwner();
    props.statusOps.setLastAction("reset local owner");
    props.statusOps.setIdle("ready");
  };

  const handleExportDatabase = async () => {
    props.statusOps.setIdle("exporting backup…");
    const array = await evoluClient.exportDatabase();
    const blob = new Blob([array], { type: "application/x-sqlite3" });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "txtatelier-pwa.sqlite3";
    anchor.click();
    window.URL.revokeObjectURL(url);
    props.statusOps.setLastAction("backup exported");
    props.statusOps.setIdle("ready");
  };

  const handleSaveTransport = () => {
    const url = transportUrl().trim();
    localStorage.setItem("transportUrl", url);
    props.statusOps.setLastAction("transport saved — reload to apply");
    props.statusOps.setIdle("ready");
  };

  return (
    <div class="w-full space-y-10 text-sm leading-6">
      <section class="space-y-3">
        <h2 class="text-base font-bold">Status</h2>
        <dl class="grid gap-1 text-black/80 dark:text-white/80">
          <div class="flex flex-wrap gap-x-2">
            <dt class="text-black/55 dark:text-white/55">current:</dt>
            <dd
              class="data-[tone=error]:text-[#a32222] data-[tone=ok]:text-[#0f6a31] dark:data-[tone=error]:text-[#ff8f8f] dark:data-[tone=ok]:text-[#6fc38c]"
              data-tone={props.appStatus().tone}
            >
              {props.appStatus().message}
            </dd>
          </div>
          <div class="flex flex-wrap gap-x-2">
            <dt class="text-black/55 dark:text-white/55">last action:</dt>
            <dd>
              {props.appStatus().lastAction ?? (
                <span class="text-black/45 dark:text-white/45">—</span>
              )}
            </dd>
          </div>
        </dl>
      </section>

      <section class="space-y-3">
        <h2 class="text-base font-bold">Identity</h2>
        <p class="break-all font-mono text-xs">
          owner: {props.ownerId() ?? "loading…"}
        </p>
        <p class="text-black/65 dark:text-white/65">
          Mnemonic stays hidden until you choose show.
        </p>

        <div class="grid w-full gap-2">
          <button
            type="button"
            class="rounded-none border border-black/25 px-3 py-2 text-left text-sm hover:bg-black/5 dark:border-white/25 dark:hover:bg-white/10"
            onClick={() => setShowMnemonic((value) => !value)}
          >
            {showMnemonic() ? "hide mnemonic" : "show mnemonic"}
          </button>
          <button
            type="button"
            class="rounded-none border border-black/25 px-3 py-2 text-left text-sm hover:bg-black/5 dark:border-white/25 dark:hover:bg-white/10"
            onClick={() => void handleRestoreFromMnemonic()}
          >
            restore
          </button>
          <button
            type="button"
            class="rounded-none border border-black/25 px-3 py-2 text-left text-sm hover:bg-black/5 dark:border-white/25 dark:hover:bg-white/10"
            onClick={() => void handleResetOwner()}
          >
            reset
          </button>
          <button
            type="button"
            class="rounded-none border border-black/25 px-3 py-2 text-left text-sm hover:bg-black/5 dark:border-white/25 dark:hover:bg-white/10"
            onClick={() => void handleExportDatabase()}
          >
            backup
          </button>
        </div>

        <Show when={showMnemonic()}>
          <textarea
            class="mt-1 min-h-24 w-full rounded-none border border-black/25 bg-transparent p-2 font-mono text-xs dark:border-white/25"
            rows={3}
            readOnly
            placeholder={
              props.owner()?.mnemonic ? undefined : "mnemonic not available"
            }
            value={props.owner()?.mnemonic ?? ""}
          />
        </Show>
      </section>

      <section class="space-y-3">
        <h2 class="text-base font-bold">Sync</h2>
        <div class="w-full space-y-2">
          <div class="block text-xs text-black/65 dark:text-white/65">
            websocket
          </div>
          <input
            type="text"
            class="w-full rounded-none border border-black/25 bg-transparent px-2.5 py-2 font-mono text-xs outline-none focus:border-black dark:border-white/25 dark:focus:border-white"
            placeholder={defaultRelayUrl}
            value={transportUrl()}
            onInput={(e) => setTransportUrl(e.currentTarget.value)}
          />
          <button
            type="button"
            class="rounded-none border border-black/25 px-3 py-2 text-sm hover:bg-black/5 dark:border-white/25 dark:hover:bg-white/10"
            onClick={handleSaveTransport}
          >
            apply
          </button>
        </div>
      </section>
    </div>
  );
};

// =============================================================================
// MAIN APP
// =============================================================================

export const App = () => {
  return (
    <EvoluProvider value={evolu}>
      <AppShell />
    </EvoluProvider>
  );
};

const AppShell = () => {
  const evoluClient = useEvolu();
  const [page, setPage] = createSignal<Page>("files");
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

  return (
    <main class="min-h-screen w-full bg-[#f2f1ee] px-4 py-8 font-mono text-[#111111] sm:px-6 lg:px-8 dark:bg-[#151617] dark:text-[#efefef]">
      <header class="mb-9 flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <h1 class="text-2xl font-bold tracking-tight">txtatelier</h1>
        <nav class="flex gap-4 text-sm">
          <button
            type="button"
            class="text-sm text-[#0047cc] underline hover:opacity-80 dark:text-[#6ea8ff]"
            data-active={page() === "files"}
            onClick={() => setPage("files")}
          >
            files
          </button>
          <button
            type="button"
            class="text-sm text-[#0047cc] underline hover:opacity-80 dark:text-[#6ea8ff]"
            data-active={page() === "settings"}
            onClick={() => setPage("settings")}
          >
            settings
          </button>
        </nav>
      </header>

      <Show when={page() === "files"}>
        <FileWorkspace
          filesShardOwnerId={filesShardOwnerId}
          ownerId={ownerId}
          status={statusOps}
        />
      </Show>

      <Show when={page() === "settings"}>
        <SettingsPanel
          owner={owner}
          ownerId={ownerId}
          appStatus={status}
          statusOps={statusOps}
        />
      </Show>
    </main>
  );
};
