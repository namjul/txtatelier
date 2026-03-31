import { debounce } from "@solid-primitives/scheduled";
import { createEffect, createMemo, createSignal, onCleanup } from "solid-js";
import { evolu, getFilesShardMutationOptions } from "../../evolu/client";
import { computeContentHash } from "../../evolu/contentHash";
import { createUseEvolu } from "../../evolu/evolu";
import type { FilesRow } from "../../evolu/files";
import { useAutoSaveMachine } from "../../machines/useAutoSaveMachine";
import type { AutoSaveUiState, ConflictStrategy, StatusOps } from "./types";

const useEvolu = createUseEvolu(evolu);

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

export const useFileEditor = (
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
  let persistRetryCount = 0;

  const isDirty = createMemo(() => {
    if (selectedFile() == null) return false;
    return draft() !== baseContent();
  });

  const hasConflict = createMemo(() => conflictRemote() != null);

  const canSaveAsOwner = createMemo(() => {
    const file = selectedFile();
    const shardOid = filesShardOwnerId();
    if (file == null || shardOid == null) return false;
    return file.ownerId === shardOid;
  });

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

  createEffect(() => {
    const file = selectedFile();

    if (file == null) {
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

    if (isSaving()) {
      return;
    }

    if (file.contentHash === baseFingerprint()) {
      return;
    }

    if (isDirty()) {
      if (!hasConflict()) {
        status.setError("conflict detected");
      }
      setConflictRemote(file);
      return;
    }

    setBaseContent(currentContent);
    setBaseFingerprint(file.contentHash);
    setConflictRemote(null);
    setDraft(currentContent);
    autoSave.send({ type: "RESET" });
  });

  const persistDraft = async (): Promise<boolean> => {
    const file = selectedFile();
    if (file == null || !isDirty() || hasConflict() || !canSaveAsOwner()) {
      return false;
    }

    const content = draft();
    const contentHash = await computeContentHash(content);
    if (contentHash === file.contentHash) {
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
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    if (!autoSave.state.matches("saving")) return;

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
  }, 300);

  createEffect(() => {
    const file = selectedFile();
    draft();
    baseContent();

    if (file == null) return;

    autoSave.send({ type: "TYPE" });

    if (!isDirty() || hasConflict() || !canSaveAsOwner()) {
      scheduleAutoSave.clear();
      return;
    }

    scheduleAutoSave();
  });

  createEffect(() => {
    if (!autoSave.state.matches("saved")) return;
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
