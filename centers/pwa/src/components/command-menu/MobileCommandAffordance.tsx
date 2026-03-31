import {
  createPerPointerListeners,
  createPointerListeners,
} from "@solid-primitives/pointer";
import { createEffect, createSignal, onCleanup, Show } from "solid-js";

const SWIPE_THRESHOLD_PX = 48;

/**
 * Coarse-pointer: 8px bottom tap bar + optional swipe-up from the lower 100px.
 * Fine-pointer: hidden (desktop uses keyboard shortcut only).
 */
export const MobileCommandAffordance = (props: {
  onOpenRequest: () => void;
  commandMenuOpen: boolean;
}) => {
  const [coarsePointer, setCoarsePointer] = createSignal(false);
  const [barEl, setBarEl] = createSignal<HTMLButtonElement | undefined>();
  const [swipeZoneEl, setSwipeZoneEl] = createSignal<
    HTMLDivElement | undefined
  >();

  createEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    setCoarsePointer(mq.matches);
    const onChange = () => setCoarsePointer(mq.matches);
    mq.addEventListener("change", onChange);
    onCleanup(() => mq.removeEventListener("change", onChange));
  });

  createEffect(() => {
    if (!coarsePointer() || props.commandMenuOpen) return;
    const el = barEl();
    if (!el) return;

    let down: { x: number; y: number } | null = null;
    createPointerListeners({
      target: () => el,
      pointerTypes: ["touch", "mouse", "pen"],
      onDown: (e) => {
        down = { x: e.x, y: e.y };
      },
      onUp: (e) => {
        if (!down) return;
        const dx = e.x - down.x;
        const dy = e.y - down.y;
        if (Math.hypot(dx, dy) < 14) props.onOpenRequest();
        down = null;
      },
    });
  });

  createEffect(() => {
    if (!coarsePointer() || props.commandMenuOpen) return;
    const zone = swipeZoneEl();
    if (!zone) return;

    createPerPointerListeners({
      target: () => zone,
      pointerTypes: ["touch"],
      passive: true,
      onDown: (event, onMove, onUp) => {
        const startY = event.clientY;
        let minY = startY;
        onMove((e) => {
          if (e.clientY < minY) minY = e.clientY;
        });
        onUp(() => {
          if (startY - minY >= SWIPE_THRESHOLD_PX) props.onOpenRequest();
        });
      },
    });
  });

  return (
    <Show when={coarsePointer()}>
      <div
        class="pointer-events-none fixed bottom-0 left-0 right-0 z-30 flex h-[100px] flex-col justify-end"
        aria-hidden="true"
      >
        <div
          ref={setSwipeZoneEl}
          class="pointer-events-auto flex-1 touch-none"
        />
        <div class="h-3 w-full bg-gradient-to-t from-transparent to-black/10 dark:to-white/10" />
        <button
          ref={setBarEl}
          type="button"
          tabIndex={-1}
          class="pointer-events-auto h-2 w-full border-0 bg-black/15 p-0 dark:bg-white/20"
          aria-label="Open file switcher"
        />
      </div>
    </Show>
  );
};
