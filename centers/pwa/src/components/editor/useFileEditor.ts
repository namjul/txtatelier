import { classifyRemoteChange } from "@txtatelier/sync-invariants";
import { debounce } from "@solid-primitives/scheduled";
import { createEffect, createMemo, createSignal, onCleanup } from "solid-js";
import { evolu, getFilesShardMutationOptions } from "../../evolu/client";
import { computeContentHash } from "../../evolu/contentHash";
import { createUseEvolu } from "../../evolu/evolu";
import type { FilesRow } from "../../evolu/files";
import { useFileEditorMachine } from "../../machines/useFileEditorMachine";
import type { AutoSaveUiState, StatusOps } from "./types";

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
  const [lastPersistedHash, setLastPersistedHash] = createSignal<string | null>(
    null,
  );
  const [draftHash, setDraftHash] = createSignal<string | null>(null);
  const [saveFailedFinal, setSaveFailedFinal] = createSignal(false);
  const [savedFlash, setSavedFlash] = createSignal(false);
  let persistRetryCount = 0;

  const isDirty = createMemo(() => {
    if (selectedFile() == null) return false;
    return draft() !== baseContent();
  });

  const canSaveAsOwner = createMemo(() => {
    const file = selectedFile();
    const shardOid = filesShardOwnerId();
    if (file == null || shardOid == null) return false;
    return file.ownerId === shardOid;
  });

  const session = useFileEditorMachine({
    isDirty,
    canSaveAsOwner,
  });

  const hasConflict = createMemo(() => session.state.matches("conflict"));

  const autoSaveUi = createMemo((): AutoSaveUiState => {
    if (saveFailedFinal()) return "error";
    if (session.state.matches("saving")) return "saving";
    if (session.state.matches("dirty")) return "dirty";
    if (session.state.matches("conflict")) return "dirty";
    return "clean";
  });

  createEffect(() => {
    const file = selectedFile();
    const d = draft();
    if (file == null) {
      setDraftHash(null);
      return;
    }
    let cancelled = false;
    void computeContentHash(d).then((h) => {
      if (!cancelled) {
        setDraftHash(h);
      }
    });
    onCleanup(() => {
      cancelled = true;
    });
  });

  let prevIsDirty = false;
  createEffect(() => {
    const d = isDirty();
    const file = selectedFile();
    if (prevIsDirty && !d && file != null && !hasConflict()) {
      setSavedFlash(true);
      const h = window.setTimeout(() => setSavedFlash(false), 2000);
      onCleanup(() => window.clearTimeout(h));
    }
    prevIsDirty = d;
  });

  createEffect(() => {
    const file = selectedFile();

    if (file == null) {
      scheduleAutoSave.clear();
      persistRetryCount = 0;
      setSaveFailedFinal(false);
      session.send({ type: "FILE_CONTEXT_RESET" });
      setEditorFileId(null);
      setBaseContent("");
      setBaseFingerprint(null);
      setLastPersistedHash(null);
      setDraft("");
      return;
    }

    const currentContent = file.content ?? "";

    if (editorFileId() !== file.id) {
      scheduleAutoSave.clear();
      persistRetryCount = 0;
      setSaveFailedFinal(false);
      session.send({ type: "FILE_CONTEXT_RESET" });
      setEditorFileId(file.id);
      setBaseContent(currentContent);
      setBaseFingerprint(file.contentHash);
      setDraft(currentContent);
      setLastPersistedHash(null);
      return;
    }

    if (session.state.matches("saving")) {
      return;
    }

    const base = baseFingerprint();
    if (base !== null && file.contentHash === base) {
      return;
    }

    const dh = draftHash();
    if (dh === null || base === null) {
      return;
    }

    const outcome = classifyRemoteChange({
      diskHash: dh,
      lastAppliedHash: base,
      remoteHash: file.contentHash,
      lastPersistedHash: lastPersistedHash(),
    });

    if (outcome === "true_divergence") {
      if (isDirty()) {
        if (!session.state.matches("conflict")) {
          status.setError("conflict detected");
        }
        session.send({ type: "ROW_TRUE_DIVERGENCE" });
      }
      return;
    }

    if (file.contentHash === dh) {
      const remoteBody = file.content ?? "";
      setBaseContent(remoteBody);
      setBaseFingerprint(file.contentHash);
      if (draft() !== remoteBody) {
        setDraft(remoteBody);
      }
      return;
    }

    if (!isDirty()) {
      setBaseContent(currentContent);
      setBaseFingerprint(file.contentHash);
      setDraft(currentContent);
    }
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
      setLastPersistedHash(contentHash);
      return true;
    }

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
      status.setError("invalid value");
      return false;
    }

    setLastPersistedHash(contentHash);
    status.setLastAction(`saved ${file.path}`);
    status.setIdle("ready");
    return true;
  };

  const runScheduledPersist = async (): Promise<void> => {
    if (!isDirty() || hasConflict() || !canSaveAsOwner()) {
      return;
    }

    session.send({ type: "PERSIST_REQUESTED" });
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    if (!session.state.matches("saving")) return;

    const ok = await persistDraft();
    if (ok) {
      persistRetryCount = 0;
      setSaveFailedFinal(false);
      session.send({ type: "PERSIST_COMPLETED" });
      return;
    }

    session.send({ type: "PERSIST_FAILED" });
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

    session.send({ type: "DRAFT_CHANGED" });

    if (!isDirty() || hasConflict() || !canSaveAsOwner()) {
      scheduleAutoSave.clear();
      return;
    }

    scheduleAutoSave();
  });

  const replaceDraftWithRemote = () => {
    const file = selectedFile();
    if (file == null || !hasConflict()) return;

    const remoteContent = file.content ?? "";
    setDraft(remoteContent);
    setBaseContent(remoteContent);
    setBaseFingerprint(file.contentHash);
    setLastPersistedHash(null);
    session.send({ type: "ADOPT_REMOTE" });
    status.setLastAction("draft replaced with remote");
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
    const draftHashValue = await computeContentHash(draftContent);
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
        contentHash: draftHashValue,
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
    setLastPersistedHash(null);
    session.send({ type: "LOCAL_PARKED_AS_NEW_FILE" });
    const msg = `saved conflict artifact ${artifactPath}`;
    status.setLastAction(msg);
    status.setIdle("ready");
  };

  return {
    draft,
    setDraft,
    isDirty,
    hasConflict,
    autoSaveUi,
    savedFlash,
    saveFailedFinal,
    replaceDraftWithRemote,
    saveDraftAsConflictArtifact,
  };
};
