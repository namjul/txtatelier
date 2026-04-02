import { type Machine, setup } from "@zag-js/core";

export type FileEditorPersistResult =
  | { readonly ok: true; readonly persistedHash: string }
  | { readonly ok: false };

type FileEditorEvent =
  | { type: "DRAFT_CHANGED" }
  | { type: "DEBOUNCE_FIRES" }
  | { type: "PERSIST_COMPLETED"; persistedHash: string }
  | { type: "PERSIST_FAILED" }
  | { type: "RETRY_TIMER_FIRES" }
  | { type: "ROW_TRUE_DIVERGENCE" }
  | { type: "CONFLICT_RESOLVED_ADOPT" }
  | { type: "CONFLICT_RESOLVED_PARK" }
  | { type: "FILE_SELECTED" }
  | { type: "RESET" };

/**
 * File editor state machine - makes impossible states unrepresentable.
 * Owns: UI state (clean, dirty, saving, retry_pending, error, conflict)
 * Owns: retryCount, lastPersistedHash (context)
 * Owns: all timing (debounce, retry timers via effects/refs)
 */
const { createMachine } = setup<{
  props: {
    readonly isDirty: () => boolean;
    readonly canSaveAsOwner: () => boolean;
    readonly onPersist: () => Promise<FileEditorPersistResult>;
    readonly debounceMs: number;
    readonly maxRetries: number;
  };
  context: {
    retryCount: number;
    lastPersistedHash: string | null;
  };
  refs: {
    retryTimerId: ReturnType<typeof setTimeout> | undefined;
    debounceTimerId: ReturnType<typeof setTimeout> | undefined;
  };
  state: "clean" | "dirty" | "saving" | "retry_pending" | "error" | "conflict";
  event: FileEditorEvent;
  guard: "isDirty" | "notDirty" | "canSave" | "shouldRetry" | "noRetriesLeft";
  action:
    | "resetContext"
    | "incrementRetry"
    | "clearRetryCount"
    | "recordPersistedHash"
    | "scheduleRetry"
    | "cancelRetryTimer"
    | "cancelDebounceTimer";
  effect: "autoSaveDebounce" | "runPersist";
}>();

export const fileEditorMachine = createMachine({
  initialState: () => "clean",

  refs: () => ({
    retryTimerId: undefined,
    debounceTimerId: undefined,
  }),

  context({ bindable }) {
    return {
      retryCount: bindable(() => ({ defaultValue: 0 })),
      lastPersistedHash: bindable(() => ({
        defaultValue: null as string | null,
      })),
    };
  },

  states: {
    clean: {
      on: {
        DRAFT_CHANGED: [
          { target: "dirty", guard: "isDirty" },
          { target: "clean" },
        ],
        FILE_SELECTED: { target: "clean" },
        RESET: { target: "clean" },
      },
    },

    dirty: {
      entry: ["clearRetryCount"],
      effects: ["autoSaveDebounce"],
      exit: ["cancelDebounceTimer"],
      on: {
        DEBOUNCE_FIRES: [
          { target: "saving", guard: "canSave" },
          { target: "dirty" },
        ],
        ROW_TRUE_DIVERGENCE: { target: "conflict" },
        DRAFT_CHANGED: [
          { target: "clean", guard: "notDirty" },
          { target: "dirty" },
        ],
        FILE_SELECTED: {
          target: "clean",
          actions: ["resetContext"],
        },
        RESET: {
          target: "clean",
          actions: ["resetContext"],
        },
      },
    },

    saving: {
      effects: ["runPersist"],
      on: {
        PERSIST_COMPLETED: [
          {
            target: "clean",
            guard: "notDirty",
            actions: ["recordPersistedHash"],
          },
          {
            target: "dirty",
            guard: "isDirty",
            actions: ["recordPersistedHash"],
          },
        ],
        PERSIST_FAILED: [
          {
            target: "retry_pending",
            guard: "shouldRetry",
            actions: ["incrementRetry"],
          },
          {
            target: "error",
            guard: "noRetriesLeft",
          },
        ],
        FILE_SELECTED: {
          target: "clean",
          actions: ["resetContext"],
        },
        RESET: {
          target: "clean",
          actions: ["resetContext"],
        },
      },
    },

    retry_pending: {
      entry: ["scheduleRetry"],
      exit: ["cancelRetryTimer"],
      on: {
        RETRY_TIMER_FIRES: { target: "saving" },
        ROW_TRUE_DIVERGENCE: { target: "conflict" },
        FILE_SELECTED: {
          target: "clean",
          actions: ["resetContext"],
        },
        RESET: {
          target: "clean",
          actions: ["resetContext"],
        },
      },
    },

    error: {
      on: {
        DEBOUNCE_FIRES: [
          { target: "saving", guard: "canSave" },
          { target: "error" },
        ],
        DRAFT_CHANGED: [
          { target: "dirty", guard: "isDirty" },
          { target: "clean" },
        ],
        FILE_SELECTED: {
          target: "clean",
          actions: ["resetContext"],
        },
        RESET: {
          target: "clean",
          actions: ["resetContext"],
        },
      },
    },

    conflict: {
      // TRAP STATE: no save transitions defined
      on: {
        CONFLICT_RESOLVED_ADOPT: { target: "clean" },
        CONFLICT_RESOLVED_PARK: { target: "clean" },
        FILE_SELECTED: {
          target: "clean",
          actions: ["resetContext"],
        },
        RESET: {
          target: "clean",
          actions: ["resetContext"],
        },
      },
    },
  },

  implementations: {
    guards: {
      isDirty: ({ prop }) => prop("isDirty")(),
      notDirty: ({ prop }) => !prop("isDirty")(),
      canSave: ({ prop }) => prop("isDirty")() && prop("canSaveAsOwner")(),
      shouldRetry: ({ context, prop }) =>
        context.get("retryCount") < prop("maxRetries"),
      noRetriesLeft: ({ context, prop }) =>
        context.get("retryCount") >= prop("maxRetries"),
    },

    effects: {
      autoSaveDebounce: ({ send, prop, refs }) => {
        const id = setTimeout(() => {
          send({ type: "DEBOUNCE_FIRES" });
        }, prop("debounceMs"));
        refs.set("debounceTimerId", id);
        return () => {
          clearTimeout(id);
          refs.set("debounceTimerId", undefined);
        };
      },

      runPersist: ({ prop, send }) => {
        let cancelled = false;
        queueMicrotask(() => {
          void prop("onPersist")().then((result) => {
            if (cancelled) return;
            if (result.ok) {
              send({
                type: "PERSIST_COMPLETED",
                persistedHash: result.persistedHash,
              });
            } else {
              send({ type: "PERSIST_FAILED" });
            }
          });
        });
        return () => {
          cancelled = true;
        };
      },
    },

    actions: {
      resetContext: ({ context }) => {
        context.set("retryCount", 0);
        context.set("lastPersistedHash", null);
      },

      incrementRetry: ({ context }) => {
        context.set("retryCount", (c) => c + 1);
      },

      clearRetryCount: ({ context }) => {
        context.set("retryCount", 0);
      },

      recordPersistedHash: ({ context, event }) => {
        if (event.type === "PERSIST_COMPLETED") {
          context.set("lastPersistedHash", event.persistedHash);
        }
      },

      scheduleRetry: ({ context, refs, send }) => {
        // Cancel any existing retry timer
        const prev = refs.get("retryTimerId");
        if (prev !== undefined) {
          clearTimeout(prev);
        }

        const rc = context.get("retryCount");
        const delayMs = 1000 * 2 ** rc;
        const id = setTimeout(() => {
          refs.set("retryTimerId", undefined);
          send({ type: "RETRY_TIMER_FIRES" });
        }, delayMs);
        refs.set("retryTimerId", id);
      },

      cancelRetryTimer: ({ refs }) => {
        const id = refs.get("retryTimerId");
        if (id !== undefined) {
          clearTimeout(id);
          refs.set("retryTimerId", undefined);
        }
      },

      cancelDebounceTimer: ({ refs }) => {
        const id = refs.get("debounceTimerId");
        if (id !== undefined) {
          clearTimeout(id);
          refs.set("debounceTimerId", undefined);
        }
      },
    },
  },
});

export type FileEditorMachineState =
  typeof fileEditorMachine extends Machine<infer S> ? S["state"] : never;
