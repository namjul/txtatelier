import { Show } from "solid-js";
import type { FilesRow } from "../../evolu/files";
import type { AutoSaveUiState, ConflictStrategy } from "./types";

export const FileEditor = (props: {
  file: FilesRow;
  draft: string;
  hasConflict: boolean;
  conflictRemote: FilesRow | null;
  autoSaveUi: AutoSaveUiState;
  saveFailedFinal: boolean;
  editorRef: (el: HTMLTextAreaElement) => void;
  onDraftChange: (value: string) => void;
  onResolveConflict: (strategy: ConflictStrategy) => void;
  onSaveConflictArtifact: () => void;
}) => {
  return (
    <div class="flex min-h-0 min-w-0 flex-1 flex-col">
      <Show when={props.hasConflict}>
        <div class="shrink-0 space-y-2 border border-[#a32222]/40 p-2 text-xs dark:border-[#ff8f8f]/50">
          <p>conflict detected: remote changed while this draft is dirty</p>
          <p>
            remote owner: {String(props.conflictRemote?.ownerId ?? "unknown")}
          </p>
          <div class="flex flex-wrap gap-2">
            <button
              type="button"
              class="rounded-none border border-black/25 px-2 py-1 hover:bg-black/5 dark:border-white/25 dark:hover:bg-white/10"
              onClick={() => void props.onSaveConflictArtifact()}
            >
              save draft as conflict artifact
            </button>
            <button
              type="button"
              class="rounded-none border border-black/25 px-2 py-1 hover:bg-black/5 dark:border-white/25 dark:hover:bg-white/10"
              onClick={() => props.onResolveConflict("remote")}
            >
              replace draft with remote
            </button>
          </div>
        </div>
      </Show>

      <div class="relative min-h-0 min-w-0 flex-1">
        <textarea
          ref={props.editorRef}
          id="txtatelier-editor"
          aria-label="File content"
          class="box-border h-full min-h-0 w-full resize-none border-0 bg-transparent p-0 font-mono text-sm leading-relaxed outline-none focus:ring-0 md:text-xs md:leading-5"
          value={props.draft}
          onInput={(event) => props.onDraftChange(event.currentTarget.value)}
        />
        <Show when={props.autoSaveUi !== "idle"}>
          <div
            class="pointer-events-none absolute right-0 top-0 max-w-[40%] truncate text-right text-[10px] text-black/45 dark:text-white/45"
            aria-live="polite"
          >
            <Show when={props.autoSaveUi === "saving"}>
              <span>Saving…</span>
            </Show>
            <Show when={props.autoSaveUi === "saved"}>
              <span class="text-[#0f6a31] dark:text-[#6fc38c]">Saved</span>
            </Show>
            <Show when={props.autoSaveUi === "error"}>
              <span
                class="text-[#a32222] dark:text-[#ff8f8f]"
                title="Save failed"
              >
                {props.saveFailedFinal ? "Save failed" : "Error — retrying…"}
              </span>
            </Show>
          </div>
        </Show>
      </div>
    </div>
  );
};
