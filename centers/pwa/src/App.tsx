import {
  createFormatTypeError,
  type MaxLengthError,
  type MinLengthError,
  Mnemonic,
} from "@evolu/common";
import {
  createEffect,
  createMemo,
  createResource,
  createSignal,
  For,
  Show,
} from "solid-js";
import { evolu } from "./evolu/client";
import { computeContentHash } from "./evolu/contentHash";
import { createUseEvolu, EvoluProvider } from "./evolu/evolu";
import { type FilesRow, filesQuery } from "./evolu/files";

type Page = "files" | "settings";
type StatusTone = "idle" | "ok" | "error";

interface StatusState {
  readonly message: string;
  readonly tone: StatusTone;
}

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

const useEvolu = createUseEvolu(evolu);

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
  const [showMnemonic, setShowMnemonic] = createSignal(false);
  const [files, setFiles] = createSignal<ReadonlyArray<FilesRow>>([]);
  const [filesLoaded, setFilesLoaded] = createSignal(false);
  const [selectedFileId, setSelectedFileId] = createSignal<
    FilesRow["id"] | null
  >(null);
  const [editorFileId, setEditorFileId] = createSignal<FilesRow["id"] | null>(
    null,
  );
  const [baseContent, setBaseContent] = createSignal("");
  const [baseFingerprint, setBaseFingerprint] = createSignal<string | null>(
    null,
  );
  const [conflictRemote, setConflictRemote] = createSignal<FilesRow | null>(
    null,
  );
  const [localDraft, setLocalDraft] = createSignal("");
  const [status, setStatus] = createSignal<StatusState>({
    message: "ready",
    tone: "idle",
  });

  const [owner] = createResource(async () => evoluClient.appOwner);

  const ownerId = createMemo(() => owner()?.id ?? "loading");
  const selectedFile = createMemo(() => {
    const id = selectedFileId();
    if (id == null) {
      return null;
    }

    return files().find((file) => file.id === id) ?? null;
  });
  const draftDirty = createMemo(() => {
    if (selectedFile() == null) {
      return false;
    }

    return localDraft() !== baseContent();
  });
  const conflictActive = createMemo(() => conflictRemote() != null);

  createEffect(() => {
    let isActive = true;

    void evoluClient.loadQuery(filesQuery).then((rows) => {
      if (!isActive) {
        return;
      }

      setFiles(rows);
      setFilesLoaded(true);
    });

    const unsubscribe = evoluClient.subscribeQuery(filesQuery)(() => {
      if (!isActive) {
        return;
      }

      setFiles(evoluClient.getQueryRows(filesQuery));
      setFilesLoaded(true);
    });

    return () => {
      isActive = false;
      unsubscribe();
    };
  });

  createEffect(() => {
    const list = files();
    const current = selectedFileId();

    if (list.length === 0) {
      if (current != null) {
        setSelectedFileId(null);
      }
      return;
    }

    if (current == null) {
      const first = list.at(0);
      if (first) {
        setSelectedFileId(first.id);
      }
      return;
    }

    const stillExists = list.some((file) => file.id === current);
    if (!stillExists) {
      const first = list.at(0);
      if (first) {
        setSelectedFileId(first.id);
      }
    }
  });

  createEffect(() => {
    const file = selectedFile();

    if (file == null) {
      setEditorFileId(null);
      setBaseContent("");
      setBaseFingerprint(null);
      setConflictRemote(null);
      setLocalDraft("");
      return;
    }

    const currentContent = file.content ?? "";

    if (editorFileId() !== file.id) {
      setEditorFileId(file.id);
      setBaseContent(currentContent);
      setBaseFingerprint(file.contentHash);
      setConflictRemote(null);
      setLocalDraft(currentContent);
      return;
    }

    if (file.contentHash === baseFingerprint()) {
      return;
    }

    if (draftDirty()) {
      if (!conflictActive()) {
        setError("conflict detected");
      }
      setConflictRemote(file);
      return;
    }

    setBaseContent(currentContent);
    setBaseFingerprint(file.contentHash);
    setConflictRemote(null);
    setLocalDraft(currentContent);
  });

  const setOk = (message: string) => {
    setStatus({ message, tone: "ok" });
  };

  const setError = (message: string) => {
    setStatus({ message, tone: "error" });
  };

  const setIdle = (message: string) => {
    setStatus({ message, tone: "idle" });
  };

  const handleRestoreFromMnemonic = async () => {
    const value = window.prompt("Enter mnemonic");
    if (value == null) {
      return;
    }

    const parsed = Mnemonic.from(value.trim());
    if (!parsed.ok) {
      setError(formatTypeError(parsed.error));
      return;
    }

    setIdle("restoring");
    await evoluClient.restoreAppOwner(parsed.value);
    setOk("restored");
  };

  const handleResetOwner = async () => {
    const confirmed = window.confirm(
      "Reset local owner and data? This action is destructive.",
    );
    if (!confirmed) {
      return;
    }

    setIdle("resetting");
    await evoluClient.resetAppOwner();
    setOk("reset complete");
  };

  const handleExportDatabase = async () => {
    setIdle("exporting backup");
    const array = await evoluClient.exportDatabase();
    const blob = new Blob([array], { type: "application/x-sqlite3" });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "txtatelier-pwa.sqlite3";
    anchor.click();
    window.URL.revokeObjectURL(url);
    setOk("backup exported");
  };

  const handleSaveFile = async () => {
    const file = selectedFile();
    if (file == null || !draftDirty() || conflictActive()) {
      return;
    }

    setIdle("saving");
    const content = localDraft();
    const contentHash = await computeContentHash(content);
    const result = evoluClient.update("file", {
      id: file.id,
      content,
      contentHash,
    });

    if (!result.ok) {
      setError("invalid value");
      return;
    }

    setBaseContent(content);
    setBaseFingerprint(contentHash);
    setOk("saved");
  };

  const handleReplaceDraftWithRemote = () => {
    const remote = conflictRemote();
    if (remote == null) {
      return;
    }

    const remoteContent = remote.content ?? "";
    setLocalDraft(remoteContent);
    setBaseContent(remoteContent);
    setBaseFingerprint(remote.contentHash);
    setConflictRemote(null);
    setOk("draft replaced with remote");
  };

  const handleSaveDraftAsConflictArtifact = async () => {
    const file = selectedFile();
    if (file == null || !conflictActive()) {
      return;
    }

    const appOwnerId = owner()?.id;
    if (appOwnerId == null) {
      setError("owner not loaded");
      return;
    }

    setIdle("saving conflict artifact");
    const draft = localDraft();
    const draftHash = await computeContentHash(draft);
    const artifactPath = createConflictArtifactPath(
      file.path,
      String(appOwnerId).slice(0, 8),
      Date.now(),
    );

    const result = evoluClient.insert("file", {
      path: artifactPath,
      content: draft,
      contentHash: draftHash,
    });

    if (!result.ok) {
      setError("could not save conflict artifact");
      return;
    }

    const remoteContent = file.content ?? "";
    setLocalDraft(remoteContent);
    setBaseContent(remoteContent);
    setBaseFingerprint(file.contentHash);
    setConflictRemote(null);
    setOk("conflict artifact saved");
  };

  return (
    <main class="mx-auto min-h-screen max-w-4xl bg-[#f2f1ee] px-5 py-10 font-mono text-[#111111] dark:bg-[#151617] dark:text-[#efefef]">
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
            onClick={() => {
              setPage("files");
            }}
          >
            files
          </button>
          <button
            type="button"
            class="text-sm text-[#0047cc] underline hover:opacity-80 dark:text-[#6ea8ff]"
            data-active={page() === "settings"}
            onClick={() => {
              setPage("settings");
            }}
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
        <section class="grid gap-8 md:grid-cols-[minmax(14rem,20rem)_1fr]">
          <div>
            <h2 class="mb-3 text-base font-bold">Files</h2>
            <Show
              when={filesLoaded()}
              fallback={
                <p class="text-sm text-black/65 dark:text-white/65">
                  loading files
                </p>
              }
            >
              <Show
                when={files().length > 0}
                fallback={
                  <p class="text-sm text-black/65 dark:text-white/65">
                    no files available
                  </p>
                }
              >
                <ul class="space-y-1 text-sm">
                  <For each={files()}>
                    {(file) => (
                      <li>
                        <button
                          type="button"
                          class="text-left text-[#0047cc] underline hover:opacity-80 dark:text-[#6ea8ff]"
                          data-active={selectedFileId() === file.id}
                          onClick={() => {
                            setSelectedFileId(file.id);
                          }}
                        >
                          {file.path}
                        </button>
                      </li>
                    )}
                  </For>
                </ul>
              </Show>
            </Show>
          </div>

          <div class="space-y-3 text-sm leading-6">
            <h3 class="text-base font-bold">Open File</h3>
            <Show
              when={selectedFile()}
              fallback={
                <p class="text-black/65 dark:text-white/65">
                  select a file to open its content
                </p>
              }
            >
              {(file) => (
                <>
                  <div class="flex items-center justify-between gap-4">
                    <p>{file().path}</p>
                    <button
                      type="button"
                      class="rounded-none border border-black/25 px-3 py-1.5 text-xs hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-45 dark:border-white/25 dark:hover:bg-white/10"
                      disabled={!draftDirty() || conflictActive()}
                      onClick={() => void handleSaveFile()}
                    >
                      save
                    </button>
                  </div>
                  <Show when={conflictActive()}>
                    <div class="space-y-2 border border-[#a32222]/40 p-3 text-xs dark:border-[#ff8f8f]/50">
                      <p>
                        conflict detected: remote changed while this draft is
                        dirty
                      </p>
                      <p>
                        remote owner:{" "}
                        {String(conflictRemote()?.ownerId ?? "unknown")}
                      </p>
                      <div class="flex flex-wrap gap-2">
                        <button
                          type="button"
                          class="rounded-none border border-black/25 px-2.5 py-1 hover:bg-black/5 dark:border-white/25 dark:hover:bg-white/10"
                          onClick={() =>
                            void handleSaveDraftAsConflictArtifact()
                          }
                        >
                          save draft as conflict artifact
                        </button>
                        <button
                          type="button"
                          class="rounded-none border border-black/25 px-2.5 py-1 hover:bg-black/5 dark:border-white/25 dark:hover:bg-white/10"
                          onClick={handleReplaceDraftWithRemote}
                        >
                          replace draft with remote
                        </button>
                      </div>
                    </div>
                  </Show>
                  <textarea
                    class="min-h-64 w-full rounded-none border border-black/25 bg-transparent p-2 font-mono text-xs leading-5 dark:border-white/25"
                    value={localDraft()}
                    onInput={(event) => {
                      setLocalDraft(event.currentTarget.value);
                    }}
                  />
                </>
              )}
            </Show>
          </div>
        </section>

        <section class="mt-6 max-w-2xl space-y-3 text-sm leading-6">
          <h2 class="text-base font-bold">Files</h2>
          <p>Read, write, and conflict guard baseline are active.</p>
          <p>Current owner: {ownerId()}</p>
        </section>
      </Show>

      <Show when={page() === "settings"}>
        <section class="max-w-2xl space-y-4 text-sm leading-6">
          <h2 class="text-base font-bold">Mnemonic Settings</h2>
          <p>
            Mnemonic remains hidden by default. Use restore, reset, and backup
            actions from this page.
          </p>

          <div class="grid max-w-sm gap-2">
            <button
              type="button"
              class="rounded-none border border-black/25 px-3 py-2 text-left text-sm hover:bg-black/5 dark:border-white/25 dark:hover:bg-white/10"
              onClick={() => {
                setShowMnemonic((value) => !value);
              }}
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

          <Show when={showMnemonic() && owner()?.mnemonic}>
            <textarea
              class="mt-1 min-h-24 w-full max-w-2xl rounded-none border border-black/25 bg-transparent p-2 font-mono text-xs dark:border-white/25"
              rows={3}
              readOnly
              value={owner()?.mnemonic ?? ""}
            />
          </Show>
        </section>
      </Show>
    </main>
  );
};
