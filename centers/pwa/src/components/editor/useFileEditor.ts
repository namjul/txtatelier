import {
  classifyRemoteChange,
  computeContentHash,
} from "@txtatelier/sync-invariants";
import { createEffect, createMemo, createSignal, onCleanup } from "solid-js";
import { evolu, getFilesShardMutationOptions } from "../../evolu/client";
import { createUseEvolu } from "../../evolu/evolu";
import type { FilesRow } from "../../evolu/files";
import { useFileEditorMachine } from "../../machines/useFileEditorMachine";
import { createConflictArtifactPath } from "./conflict-artifact-path";
import type { AutoSaveUiState, StatusOps } from "./types";

const useEvolu = createUseEvolu(evolu);

// Synchronous ref for lastPersistedHash - avoids race with Solid reactivity
let currentLastPersistedHash: string | null = null;

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
  const [lastAppliedHash, setLastAppliedHash] = createSignal<string | null>(
    null,
  );
  const [draftHash, setDraftHash] = createSignal<string | null>(null);

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

  const persistDraft = async (): Promise<{
    ok: boolean;
    persistedHash: string;
  }> => {
    const file = selectedFile();
    if (file == null || !isDirty() || !canSaveAsOwner()) {
      return { ok: false, persistedHash: "" };
    }

    const content = draft();
    const contentHash = await computeContentHash(content);
    if (contentHash === file.contentHash) {
      setBaseContent(content);
      return { ok: true, persistedHash: contentHash };
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
      return { ok: false, persistedHash: "" };
    }

    // Update synchronous ref immediately (avoids race with Solid batching)
    currentLastPersistedHash = contentHash;

    status.setLastAction(`saved ${file.path}`);
    status.setIdle("ready");
    return { ok: true, persistedHash: contentHash };
  };

  const session = useFileEditorMachine({
    isDirty,
    canSaveAsOwner,
    onPersist: persistDraft,
  });

  const hasConflict = createMemo(() => session.state.matches("conflict"));
  const hasError = createMemo(() => session.state.matches("error"));
  const isSaving = createMemo(() => session.state.matches("saving"));

  const autoSaveUi = createMemo((): AutoSaveUiState => {
    if (hasError()) return "error";
    if (isSaving()) return "saving";
    if (session.state.matches("dirty")) return "dirty";
    if (hasConflict()) return "dirty";
    return "clean";
  });

  // Effect 1: Compute draft hash asynchronously
  // Runs on draft changes, no conflict detection
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

  // Effect 2: Handle local state changes
  // Runs on draft/baseContent changes, sends DRAFT_CHANGED
  // NO conflict detection - local changes are not conflicts
  createEffect(() => {
    const file = selectedFile();
    draft();
    baseContent();

    if (file == null) return;

    session.send({ type: "DRAFT_CHANGED" });
  });

  // Effect 3: Handle remote state changes and conflict detection
  // ONLY runs when file.contentHash changes (remote update)
  // This is where conflicts are detected - remote divergence from local
  createEffect(() => {
    const file = selectedFile();

    if (file == null) {
      session.send({ type: "RESET" });
      setEditorFileId(null);
      setBaseContent("");
      setLastAppliedHash(null);
      currentLastPersistedHash = null;
      setDraft("");
      return;
    }

    const currentContent = file.content ?? "";
    const remoteHash = file.contentHash; // This is the dependency - only re-runs when this changes

    if (editorFileId() !== file.id) {
      session.send({ type: "FILE_SELECTED" });
      setEditorFileId(file.id);
      setBaseContent(currentContent);
      setLastAppliedHash(remoteHash);
      currentLastPersistedHash = null;
      setDraft(currentContent);
      return;
    }

    if (isSaving()) {
      return;
    }

    const lastApplied = lastAppliedHash();
    if (lastApplied !== null && remoteHash === lastApplied) {
      return;
    }

    const dh = draftHash();
    if (dh === null || lastApplied === null) {
      return;
    }

    // Conflict detection only runs when remoteHash changes
    const outcome = classifyRemoteChange({
      diskHash: dh,
      lastAppliedHash: lastApplied,
      remoteHash: remoteHash,
      lastPersistedHash: currentLastPersistedHash,
    });

    if (outcome === "true_divergence") {
      if (isDirty()) {
        if (!hasConflict()) {
          status.setError("conflict detected");
        }
        session.send({ type: "ROW_TRUE_DIVERGENCE" });
      }
      return;
    }

    // Full convergence: remote === disk
    // Update lastAppliedHash per CONFLICT_RULES.md §5
    if (remoteHash === dh) {
      const remoteBody = file.content ?? "";
      setBaseContent(remoteBody);
      setLastAppliedHash(remoteHash);
      if (draft() !== remoteBody) {
        setDraft(remoteBody);
      }
      return;
    }

    // Clean sync: not dirty, adopt remote
    // Per spec: only update lastAppliedHash when remote === disk
    if (!isDirty()) {
      setBaseContent(currentContent);
      setDraft(currentContent);
    }
  });

  const replaceDraftWithRemote = () => {
    const file = selectedFile();
    if (file == null || !hasConflict()) return;

    const remoteContent = file.content ?? "";
    setDraft(remoteContent);
    setBaseContent(remoteContent);
    setLastAppliedHash(file.contentHash);
    currentLastPersistedHash = null;
    session.send({ type: "CONFLICT_RESOLVED_ADOPT" });
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
    setLastAppliedHash(file.contentHash);
    currentLastPersistedHash = null;
    session.send({ type: "CONFLICT_RESOLVED_PARK" });
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
    savedFlash: () => false,
    saveFailedFinal: hasError,
    replaceDraftWithRemote,
    saveDraftAsConflictArtifact,
  };
};
