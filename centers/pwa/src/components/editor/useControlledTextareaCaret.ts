import { createSelection } from "@solid-primitives/selection";
import { createEffect } from "solid-js";

export interface ControlledTextareaCaretOptions {
  readonly value: () => string;
  /** When this changes (e.g. selected file id), skip caret restore and reset tracking. */
  readonly scopeId: () => string;
  readonly forwardRef?: (el: HTMLTextAreaElement) => void;
  readonly onValueChange: (value: string) => void;
}

/**
 * Keeps selection stable when a controlled textarea's `value` updates from the parent.
 * Snapshots offsets on user events; after a parent-driven value change, reapplies via
 * `@solid-primitives/selection` (the primitive's live `selection()` can already reflect
 * the browser's post-reset range).
 */
export const useControlledTextareaCaret = (args: ControlledTextareaCaretOptions) => {
  const [, setDomSelection] = createSelection();

  let textareaEl: HTMLTextAreaElement | undefined;
  let lastCaretStart = 0;
  let lastCaretEnd = 0;
  let prevValue = "";
  let prevScopeId: string | null = null;

  const captureCaret = (el: HTMLTextAreaElement) => {
    lastCaretStart = el.selectionStart;
    lastCaretEnd = el.selectionEnd;
  };

  createEffect(() => {
    const scope = args.scopeId();
    const next = args.value();

    if (prevScopeId !== scope) {
      prevScopeId = scope;
      prevValue = next;
      return;
    }

    const el = textareaEl;
    if (!el || document.activeElement !== el) {
      prevValue = next;
      return;
    }

    if (prevValue === next) {
      return;
    }

    const len = next.length;
    const start = Math.min(lastCaretStart, len);
    const end = Math.min(lastCaretEnd, len);
    queueMicrotask(() => {
      if (document.activeElement !== el || el.value !== next) return;
      setDomSelection([el, start, end]);
    });

    prevValue = next;
  });

  const textareaRef = (el: HTMLTextAreaElement) => {
    textareaEl = el;
    args.forwardRef?.(el);
  };

  const onInput = (
    event: InputEvent & { currentTarget: HTMLTextAreaElement },
  ) => {
    const el = event.currentTarget;
    captureCaret(el);
    args.onValueChange(el.value);
  };

  const onSelect = (
    event: Event & { currentTarget: HTMLTextAreaElement },
  ) => {
    captureCaret(event.currentTarget);
  };

  const onKeyUp = (
    event: KeyboardEvent & { currentTarget: HTMLTextAreaElement },
  ) => {
    captureCaret(event.currentTarget);
  };

  const onClick = (
    event: MouseEvent & { currentTarget: HTMLTextAreaElement },
  ) => {
    captureCaret(event.currentTarget);
  };

  return {
    textareaRef,
    onInput,
    onSelect,
    onKeyUp,
    onClick,
  };
};
