import { createEffect, createSignal, onCleanup, Show } from "solid-js";

const STORAGE_KEY = "txtatelier.file-switcher-hint-dismissed";

export const FileSwitcherHint = () => {
  const [dismissed, setDismissed] = createSignal(
    typeof localStorage !== "undefined" &&
      localStorage.getItem(STORAGE_KEY) === "1",
  );
  const [finePointer, setFinePointer] = createSignal(true);

  createEffect(() => {
    const mq = window.matchMedia("(pointer: fine)");
    setFinePointer(mq.matches);
    const onChange = () => setFinePointer(mq.matches);
    mq.addEventListener("change", onChange);
    onCleanup(() => mq.removeEventListener("change", onChange));
  });

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setDismissed(true);
  };

  return (
    <Show when={!dismissed()}>
      <aside
        class="shrink-0 border-b border-black/15 bg-black/[0.03] px-3 py-2 text-xs text-black/80 dark:border-white/15 dark:bg-white/[0.04] dark:text-white/85"
        aria-live="polite"
        aria-label="File switcher tips"
      >
        <div class="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <div class="min-w-0 space-y-1">
            <Show
              when={finePointer()}
              fallback={
                <p>
                  Tap the bottom bar or swipe up from the lower screen edge to
                  open the file switcher.
                </p>
              }
            >
              <p>
                Press{" "}
                <kbd class="rounded border border-black/20 px-1 py-0.5 font-mono dark:border-white/25">
                  ⌘K
                </kbd>{" "}
                (Mac) or{" "}
                <kbd class="rounded border border-black/20 px-1 py-0.5 font-mono dark:border-white/25">
                  Ctrl+K
                </kbd>{" "}
                (Windows/Linux) to open the file switcher.{" "}
                <kbd class="rounded border border-black/20 px-1 py-0.5 font-mono dark:border-white/25">
                  ⌘,
                </kbd>{" "}
                /{" "}
                <kbd class="rounded border border-black/20 px-1 py-0.5 font-mono dark:border-white/25">
                  Ctrl+,
                </kbd>{" "}
                opens settings.
              </p>
            </Show>
          </div>
          <button
            type="button"
            class="shrink-0 self-end rounded-none border border-black/25 px-2 py-1 hover:bg-black/5 dark:border-white/25 dark:hover:bg-white/10 sm:self-start"
            onClick={dismiss}
          >
            Got it
          </button>
        </div>
      </aside>
    </Show>
  );
};
