import {
  createFormatTypeError,
  type MaxLengthError,
  type MinLengthError,
  Mnemonic,
} from "@evolu/common";
import type { Accessor, Resource } from "solid-js";
import { createSignal, Match, Show, Switch } from "solid-js";
import { defaultRelayUrl, evolu } from "../../evolu/client";
import { createUseEvolu } from "../../evolu/evolu";
import type { StatusOps, StatusState } from "../editor/types";

const useEvolu = createUseEvolu(evolu);

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

interface OwnerData {
  readonly id: string;
  readonly mnemonic?: string | null;
}

type OwnerResourceSlot = Resource<OwnerData>;

const formatOwnerResourceError = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { readonly message: unknown }).message);
  }
  return typeof error === "string" ? error : JSON.stringify(error);
};

export const SettingsPanel = (props: {
  owner: OwnerResourceSlot;
  appStatus: Accessor<StatusState>;
  statusOps: StatusOps;
  onBack: () => void;
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
      props.statusOps.setError(formatTypeError(parsed.error));
      return;
    }

    props.statusOps.setIdle("restoring…");
    try {
      // reload: false so the promise resolves; Evolu's default reload skips onComplete.
      await evoluClient.restoreAppOwner(parsed.value, { reload: false });
      props.statusOps.setLastAction("restored from mnemonic");
      props.statusOps.setIdle("ready");
      evoluClient.reloadApp();
    } catch (error) {
      props.statusOps.setError(
        error instanceof Error ? error.message : "restore failed",
      );
    }
  };

  const handleResetOwner = async () => {
    const confirmed = window.confirm(
      "Reset local owner and data? This action is destructive.",
    );
    if (!confirmed) return;

    props.statusOps.setIdle("resetting…");
    try {
      await evoluClient.resetAppOwner({ reload: false });
      props.statusOps.setLastAction("reset local owner");
      props.statusOps.setIdle("ready");
      evoluClient.reloadApp();
    } catch (error) {
      props.statusOps.setError(
        error instanceof Error ? error.message : "reset failed",
      );
    }
  };

  const handleExportDatabase = async () => {
    props.statusOps.setIdle("exporting backup…");
    const array = await evoluClient.exportDatabase();
    const blob = new Blob([array], { type: "application/x-sqlite3" });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "txtatelier-pwa.sqlite3";
    anchor.click();
    window.URL.revokeObjectURL(url);
    props.statusOps.setLastAction("backup exported");
    props.statusOps.setIdle("ready");
  };

  const handleSaveTransport = () => {
    const url = transportUrl().trim();
    localStorage.setItem("transportUrl", url);
    props.statusOps.setLastAction("transport saved — reload to apply");
    props.statusOps.setIdle("ready");
  };

  return (
    <div class="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4 text-sm leading-6">
      <button
        type="button"
        class="mb-4 w-fit border border-black/25 px-2 py-1 text-xs hover:bg-black/5 dark:border-white/25 dark:hover:bg-white/10"
        onClick={props.onBack}
      >
        ← Editor
      </button>
      <div class="w-full max-w-lg space-y-10">
        <section class="space-y-3">
          <h2 class="text-base font-bold">Status</h2>
          <dl class="grid gap-1 text-black/80 dark:text-white/80">
            <div class="flex flex-wrap gap-x-2">
              <dt class="text-black/55 dark:text-white/55">current:</dt>
              <dd
                class="data-[tone=error]:text-[#a32222] data-[tone=ok]:text-[#0f6a31] dark:data-[tone=error]:text-[#ff8f8f] dark:data-[tone=ok]:text-[#6fc38c]"
                data-tone={props.appStatus().tone}
              >
                {props.appStatus().message}
              </dd>
            </div>
            <div class="flex flex-wrap gap-x-2">
              <dt class="text-black/55 dark:text-white/55">last action:</dt>
              <dd>
                {props.appStatus().lastAction ?? (
                  <span class="text-black/45 dark:text-white/45">—</span>
                )}
              </dd>
            </div>
          </dl>
        </section>

        <section class="space-y-3">
          <h2 class="text-base font-bold">Identity</h2>
          <p class="break-all font-mono text-xs">
            owner:{" "}
            <Switch>
              <Match when={props.owner.state === "errored"}>
                <span class="text-[#a32222] dark:text-[#ff8f8f]">
                  error — {formatOwnerResourceError(props.owner.error)}
                </span>
              </Match>
              <Match
                when={
                  props.owner.state === "ready" ||
                  props.owner.state === "refreshing"
                    ? props.owner()
                    : false
                }
              >
                {(o) => {
                  const row = o();
                  const id = row.id;
                  return <span>{id !== "" ? id : "unavailable"}</span>;
                }}
              </Match>
              <Match when={true}>
                <span class="text-black/55 dark:text-white/55">loading…</span>
              </Match>
            </Switch>
          </p>
          <p class="text-black/65 dark:text-white/65">
            Mnemonic stays hidden until you choose show.
          </p>

          <div class="grid w-full gap-2">
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
              restore
            </button>
            <button
              type="button"
              class="rounded-none border border-black/25 px-3 py-2 text-left text-sm hover:bg-black/5 dark:border-white/25 dark:hover:bg-white/10"
              onClick={() => void handleResetOwner()}
            >
              reset
            </button>
            <button
              type="button"
              class="rounded-none border border-black/25 px-3 py-2 text-left text-sm hover:bg-black/5 dark:border-white/25 dark:hover:bg-white/10"
              onClick={() => void handleExportDatabase()}
            >
              backup
            </button>
          </div>

          <Show when={showMnemonic()}>
            <textarea
              class="mt-1 min-h-24 w-full rounded-none border border-black/25 bg-transparent p-2 font-mono text-xs dark:border-white/25"
              rows={3}
              readOnly
              placeholder={
                props.owner()?.mnemonic ? undefined : "mnemonic not available"
              }
              value={props.owner()?.mnemonic ?? ""}
            />
          </Show>
        </section>

        <section class="space-y-3">
          <h2 class="text-base font-bold">Sync</h2>
          <div class="w-full space-y-2">
            <div class="block text-xs text-black/65 dark:text-white/65">
              websocket
            </div>
            <input
              type="text"
              class="w-full rounded-none border border-black/25 bg-transparent px-2.5 py-2 font-mono text-xs outline-none focus:border-black dark:border-white/25 dark:focus:border-white"
              placeholder={defaultRelayUrl}
              value={transportUrl()}
              onInput={(e) => setTransportUrl(e.currentTarget.value)}
            />
            <button
              type="button"
              class="rounded-none border border-black/25 px-3 py-2 text-sm hover:bg-black/5 dark:border-white/25 dark:hover:bg-white/10"
              onClick={handleSaveTransport}
            >
              apply
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};
