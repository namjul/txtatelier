import {
  createFormatTypeError,
  type MaxLengthError,
  type MinLengthError,
  Mnemonic,
} from "@evolu/common";
import * as combobox from "@zag-js/combobox";
import { normalizeProps, useMachine } from "@zag-js/solid";
import {
  createEffect,
  createMemo,
  createResource,
  createSignal,
  createUniqueId,
  For,
  Show,
} from "solid-js";
import { defaultRelayUrl, evolu } from "./evolu/client";
import { computeContentHash } from "./evolu/contentHash";
import { createUseEvolu, EvoluProvider } from "./evolu/evolu";
import { type FilesRow, filesQuery } from "./evolu/files";

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
}

interface StatusOps {
  readonly setOk: (message: string) => void;
  readonly setError: (message: string) => void;
  readonly setIdle: (message: string) => void;
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

// =============================================================================
// HOOK: FILE LIST MANAGEMENT
// =============================================================================

const useFileList = () => {
  const evoluClient = useEvolu();
  const [files, setFiles] = createSignal<ReadonlyArray<FilesRow>>([]);
  const [isLoading, setIsLoading] = createSignal(true);
  const [selectedFileId, setSelectedFileId] = createSignal<
    FilesRow["id"] | null
  >(null);

  const selectedFile = createMemo(() => {
    const id = selectedFileId();
    if (id == null) return null;
    return files().find((file) => file.id === id) ?? null;
  });

  // Load files from Evolu
  createEffect(() => {
    let isActive = true;

    void evoluClient.loadQuery(filesQuery).then((rows) => {
      if (!isActive) return;
      setFiles(rows);
      setIsLoading(false);
    });

    const unsubscribe = evoluClient.subscribeQuery(filesQuery)(() => {
      if (!isActive) return;
      setFiles(evoluClient.getQueryRows(filesQuery));
      setIsLoading(false);
    });

    return () => {
      isActive = false;
      unsubscribe();
    };
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
    files,
    isLoading,
    selectedFileId,
    selectedFile,
    selectFile: setSelectedFileId,
  };
};

// =============================================================================
// HOOK: FILE EDITOR MANAGEMENT
// =============================================================================

const useFileEditor = (
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

  const isDirty = createMemo(() => {
    if (selectedFile() == null) return false;
    return draft() !== baseContent();
  });

  const hasConflict = createMemo(() => conflictRemote() != null);

  // Sync editor with selected file
  createEffect(() => {
    const file = selectedFile();

    if (file == null) {
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
      setEditorFileId(file.id);
      setBaseContent(currentContent);
      setBaseFingerprint(file.contentHash);
      setConflictRemote(null);
      setDraft(currentContent);
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
  });

  const save = async () => {
    const file = selectedFile();
    if (file == null || !isDirty() || hasConflict()) return;

    status.setIdle("saving");
    const content = draft();
    const contentHash = await computeContentHash(content);
    const result = evoluClient.update("file", {
      id: file.id,
      content,
      contentHash,
    });

    if (!result.ok) {
      status.setError("invalid value");
      return;
    }

    setBaseContent(content);
    setBaseFingerprint(contentHash);
    status.setOk("saved");
  };

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
    status.setOk(
      strategy === "remote"
        ? "draft replaced with remote"
        : "conflict dismissed",
    );
  };

  const saveDraftAsConflictArtifact = async () => {
    const file = selectedFile();
    if (file == null || !hasConflict()) return;

    const appOwnerId = ownerId();
    if (appOwnerId == null) {
      status.setError("owner not loaded");
      return;
    }

    status.setIdle("saving conflict artifact");
    const draftContent = draft();
    const draftHash = await computeContentHash(draftContent);
    const artifactPath = createConflictArtifactPath(
      file.path,
      appOwnerId.slice(0, 8),
      Date.now(),
    );

    const result = evoluClient.insert("file", {
      path: artifactPath,
      content: draftContent,
      contentHash: draftHash,
    });

    if (!result.ok) {
      status.setError("could not save conflict artifact");
      return;
    }

    const remoteContent = file.content ?? "";
    setDraft(remoteContent);
    setBaseContent(remoteContent);
    setBaseFingerprint(file.contentHash);
    setConflictRemote(null);
    status.setOk("conflict artifact saved");
  };

  return {
    draft,
    setDraft,
    isDirty,
    hasConflict,
    conflictRemote,
    save,
    resolveConflict,
    saveDraftAsConflictArtifact,
  };
};

// =============================================================================
// COMPONENT: FILE PICKER
// =============================================================================

interface FileOption {
  readonly label: string;
  readonly value: string;
}

type InputChangeDetails = combobox.InputValueChangeDetails;
type ValueChangeDetails = combobox.ValueChangeDetails<FileOption>;

const FilePicker = (props: {
  files: ReadonlyArray<FilesRow>;
  selectedFileId: FilesRow["id"] | null;
  onSelect: (id: FilesRow["id"]) => void;
}) => {
  const [search, setSearch] = createSignal("");

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

  const fileCollection = createMemo(() =>
    combobox.collection({
      items: fileOptions(),
      itemToString: (item: FileOption) => item.label,
      itemToValue: (item: FileOption) => item.value,
    }),
  );

  const filePickerService = useMachine(combobox.machine, {
    id: createUniqueId(),
    get collection() {
      return fileCollection();
    },
    openOnClick: true,
    positioning: { placement: "bottom-start" },
    get value() {
      const id = props.selectedFileId;
      if (id == null) return [];
      return [String(id)];
    },
    onInputValueChange(details: InputChangeDetails) {
      setSearch(details.inputValue);
    },
    onValueChange(details: ValueChangeDetails) {
      const selectedValue = details.value.at(0);
      if (!selectedValue) return;

      const selected = props.files.find(
        (file) => String(file.id) === selectedValue,
      );
      if (!selected) return;

      props.onSelect(selected.id);
      setSearch(selected.path);
    },
  });

  const filePicker = createMemo(() =>
    combobox.connect(filePickerService, normalizeProps),
  );

  return (
    <div {...filePicker().getRootProps()} class="relative max-w-3xl">
      <div class="mb-1 block text-xs">Search files</div>
      <div {...filePicker().getControlProps()} class="flex">
        <input
          {...filePicker().getInputProps()}
          class="w-full rounded-none border border-black/25 bg-transparent px-2.5 py-2 text-sm outline-none focus:border-black dark:border-white/25 dark:focus:border-white"
          placeholder="Type a path"
        />
        <button
          type="button"
          {...filePicker().getTriggerProps()}
          class="border border-l-0 border-black/25 px-3 text-xs dark:border-white/25"
        >
          open
        </button>
      </div>
      <div {...filePicker().getPositionerProps()} class="z-10">
        <Show when={fileOptions().length > 0}>
          <ul
            {...filePicker().getContentProps()}
            class="max-h-72 overflow-auto border border-black/25 bg-[#f2f1ee] p-1 dark:border-white/25 dark:bg-[#151617]"
          >
            <For each={fileOptions()}>
              {(item) => (
                <li
                  {...filePicker().getItemProps({ item })}
                  class="cursor-pointer px-2 py-1 text-sm data-[highlighted]:bg-black/10 dark:data-[highlighted]:bg-white/10"
                >
                  {item.label}
                </li>
              )}
            </For>
          </ul>
        </Show>
      </div>
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
  onDraftChange: (value: string) => void;
  onSave: () => void;
  onResolveConflict: (strategy: ConflictStrategy) => void;
  onSaveConflictArtifact: () => void;
}) => {
  return (
    <>
      <div class="flex items-center justify-between gap-4">
        <p>{props.file.path}</p>
        <button
          type="button"
          class="rounded-none border border-black/25 px-3 py-1.5 text-xs hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-45 dark:border-white/25 dark:hover:bg-white/10"
          disabled={!props.isDirty || props.hasConflict}
          onClick={() => void props.onSave()}
        >
          save
        </button>
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
  ownerId: () => string | undefined;
  status: StatusOps;
}) => {
  const fileList = useFileList();
  const editor = useFileEditor(
    props.ownerId,
    () => fileList.selectedFile(),
    props.status,
  );

  return (
    <>
      <section class="space-y-5 text-sm leading-6">
        <div class="space-y-2">
          <h2 class="text-base font-bold">Files</h2>
          <Show
            when={!fileList.isLoading()}
            fallback={
              <p class="text-sm text-black/65 dark:text-white/65">
                loading files
              </p>
            }
          >
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
        </div>

        <div class="space-y-3">
          <h3 class="text-base font-bold">Open File</h3>
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
                onDraftChange={editor.setDraft}
                onSave={editor.save}
                onResolveConflict={editor.resolveConflict}
                onSaveConflictArtifact={editor.saveDraftAsConflictArtifact}
              />
            )}
          </Show>
        </div>
      </section>

      <section class="mt-6 space-y-3 text-sm leading-6">
        <h2 class="text-base font-bold">Files</h2>
        <p>Read, write, and conflict guard baseline are active.</p>
        <p>Current owner: {props.ownerId() ?? "loading"}</p>
      </section>
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
  status: StatusOps;
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
      props.status.setError(formatTypeError(parsed.error));
      return;
    }

    props.status.setIdle("restoring");
    await evoluClient.restoreAppOwner(parsed.value);
    props.status.setOk("restored");
  };

  const handleResetOwner = async () => {
    const confirmed = window.confirm(
      "Reset local owner and data? This action is destructive.",
    );
    if (!confirmed) return;

    props.status.setIdle("resetting");
    await evoluClient.resetAppOwner();
    props.status.setOk("reset complete");
  };

  const handleExportDatabase = async () => {
    props.status.setIdle("exporting backup");
    const array = await evoluClient.exportDatabase();
    const blob = new Blob([array], { type: "application/x-sqlite3" });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "txtatelier-pwa.sqlite3";
    anchor.click();
    window.URL.revokeObjectURL(url);
    props.status.setOk("backup exported");
  };

  const handleSaveTransport = () => {
    const url = transportUrl().trim();
    localStorage.setItem("transportUrl", url);
    props.status.setOk("transport saved - reload page to apply");
  };

  return (
    <>
      <section class="space-y-4 text-sm leading-6">
        <h2 class="text-base font-bold">Mnemonic Settings</h2>
        <p>
          Mnemonic remains hidden by default. Use restore, reset, and backup
          actions from this page.
        </p>

        <div class="grid max-w-sm gap-2">
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
            restore from mnemonic
          </button>
          <button
            type="button"
            class="rounded-none border border-black/25 px-3 py-2 text-left text-sm hover:bg-black/5 dark:border-white/25 dark:hover:bg-white/10"
            onClick={() => void handleResetOwner()}
          >
            reset local owner
          </button>
          <button
            type="button"
            class="rounded-none border border-black/25 px-3 py-2 text-left text-sm hover:bg-black/5 dark:border-white/25 dark:hover:bg-white/10"
            onClick={() => void handleExportDatabase()}
          >
            download backup
          </button>
        </div>

        <Show when={showMnemonic() && props.owner()?.mnemonic}>
          <textarea
            class="mt-1 min-h-24 w-full max-w-2xl rounded-none border border-black/25 bg-transparent p-2 font-mono text-xs dark:border-white/25"
            rows={3}
            readOnly
            value={props.owner()?.mnemonic ?? ""}
          />
        </Show>
      </section>

      <section class="mt-6 space-y-4 text-sm leading-6">
        <h2 class="text-base font-bold">Sync Transport</h2>
        <div class="max-w-lg space-y-2">
          <div class="block text-xs">WebSocket URL</div>
          <input
            type="text"
            class="w-full rounded-none border border-black/25 bg-transparent px-2.5 py-2 text-sm outline-none focus:border-black dark:border-white/25 dark:focus:border-white"
            placeholder={defaultRelayUrl}
            value={transportUrl()}
            onInput={(e) => setTransportUrl(e.currentTarget.value)}
          />
          <button
            type="button"
            class="rounded-none border border-black/25 px-3 py-2 text-sm hover:bg-black/5 dark:border-white/25 dark:hover:bg-white/10"
            onClick={handleSaveTransport}
          >
            apply (requires reload)
          </button>
        </div>
      </section>
    </>
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
  });

  const [owner] = createResource(async () => evoluClient.appOwner);
  const ownerId = () => owner()?.id;

  const statusOps: StatusOps = {
    setOk: (message) => setStatus({ message, tone: "ok" }),
    setError: (message) => setStatus({ message, tone: "error" }),
    setIdle: (message) => setStatus({ message, tone: "idle" }),
  };

  return (
    <main class="min-h-screen w-full bg-[#f2f1ee] px-4 py-8 font-mono text-[#111111] sm:px-6 lg:px-8 dark:bg-[#151617] dark:text-[#efefef]">
      <header class="mb-9 flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <h1 class="text-2xl font-bold tracking-tight">txtatelier</h1>
          <p class="mt-2 text-sm text-black/65 dark:text-white/65">
            PWA baseline: Phase 6.0
          </p>
        </div>
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

      <p
        class="mb-9 text-sm text-black/65 data-[tone=error]:text-[#a32222] data-[tone=ok]:text-[#0f6a31] dark:text-white/65 dark:data-[tone=error]:text-[#ff8f8f] dark:data-[tone=ok]:text-[#6fc38c]"
        data-tone={status().tone}
      >
        status: {status().message}
      </p>

      <Show when={page() === "files"}>
        <FileWorkspace ownerId={ownerId} status={statusOps} />
      </Show>

      <Show when={page() === "settings"}>
        <SettingsPanel owner={owner} status={statusOps} />
      </Show>
    </main>
  );
};
