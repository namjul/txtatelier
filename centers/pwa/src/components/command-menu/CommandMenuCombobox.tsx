import { Combobox, useListCollection } from "@ark-ui/solid/combobox";
import { useFilter } from "@ark-ui/solid/locale";
import { createVirtualizer } from "@tanstack/solid-virtual";
import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import type { FilesRow } from "../../evolu/files";
import {
  COMMAND_MENU_OPEN_SETTINGS_VALUE,
  isCommandMenuActionMode,
} from "./commandMenuActionMode";

type CommandMenuListItem =
  | {
      readonly kind: "file";
      readonly label: string;
      readonly value: string;
    }
  | {
      readonly kind: "action";
      readonly label: string;
      readonly value: typeof COMMAND_MENU_OPEN_SETTINGS_VALUE;
    };

export const CommandMenuCombobox = (props: {
  files: ReadonlyArray<FilesRow>;
  selectedFileId: FilesRow["id"] | null;
  onSelect: (id: FilesRow["id"]) => void;
  onOpenSettings: () => void;
  inputRef: (el: HTMLInputElement) => void;
  onFileCountChange?: (info: { total: number; filtered: number }) => void;
}) => {
  const [search, setSearch] = createSignal("");
  let scrollRef: HTMLDivElement | undefined;

  const setScrollRef = (el: HTMLDivElement | undefined) => {
    scrollRef = el;
  };

  const isActionMode = createMemo(() => isCommandMenuActionMode(search()));

  const filterFn = useFilter({ sensitivity: "base" });

  const fileItems = createMemo(() =>
    props.files.map((file) => ({
      kind: "file" as const,
      label: file.path,
      value: String(file.id),
    })),
  );

  const { collection, filter, reset, set } =
    useListCollection<CommandMenuListItem>({
      get initialItems() {
        return fileItems();
      },
      filter: filterFn().contains,
      itemToString: (item) => item.label,
      itemToValue: (item) => item.value,
    });

  // Sync when props.files changes (e.g., as files sync in from CLI)
  createEffect(() => {
    set(fileItems());
  });

  const virtualizer = createVirtualizer({
    get count() {
      return isActionMode() ? 0 : collection().size;
    },
    getScrollElement: () => scrollRef ?? null,
    estimateSize: () => 32,
    overscan: 5,
  });

  const virtualItems = createMemo(() => virtualizer.getVirtualItems());
  const totalSize = createMemo(() => virtualizer.getTotalSize());

  createEffect(() => {
    if (isActionMode()) return;
    const count = collection().size;
    if (scrollRef && count > 0) {
      queueMicrotask(() => virtualizer.measure());
    }
  });

  // Emit file count changes for title display
  createEffect(() => {
    const total = props.files.length;
    const filtered = isActionMode() ? 0 : collection().size;
    props.onFileCountChange?.({ total, filtered });
  });

  const value = createMemo(() =>
    props.selectedFileId == null ? [] : [String(props.selectedFileId)],
  );

  const handleInputChange = (details: { inputValue: string }) => {
    const input = details.inputValue;
    setSearch(input);
    if (isCommandMenuActionMode(input)) {
      reset();
    } else {
      filter(input);
    }
  };

  return (
    <Combobox.Root
      collection={collection()}
      value={value()}
      defaultOpen
      closeOnSelect
      openOnClick={false}
      inputBehavior="autohighlight"
      selectionBehavior="clear"
      onInputValueChange={handleInputChange}
      onSelect={(details) => {
        if (details.itemValue === COMMAND_MENU_OPEN_SETTINGS_VALUE) {
          props.onOpenSettings();
          return;
        }
        const selected = props.files.find(
          (file) => String(file.id) === details.itemValue,
        );
        if (!selected) return;
        props.onSelect(selected.id);
      }}
      scrollToIndexFn={(details) => {
        if (isActionMode()) return;
        virtualizer.scrollToIndex(details.index, { align: "start" });
      }}
      positioning={{ placement: "bottom-start", strategy: "fixed" }}
    >
      <Combobox.Label class="sr-only">Search files by path</Combobox.Label>
      <Combobox.Control class="flex border-b border-black/20 dark:border-white/20">
        <Combobox.Input
          ref={props.inputRef}
          class="w-full border-0 bg-transparent px-3 py-2.5 text-sm text-[#111111] outline-none dark:text-[#efefef]"
          placeholder="Filter files…"
          autocomplete="off"
        />
      </Combobox.Control>
      <Combobox.Positioner class="relative z-0 w-full">
        <Combobox.Content class="max-h-[min(50vh,320px)] w-full border-0 bg-[#f2f1ee] shadow-none dark:bg-[#151617]">
          <div ref={setScrollRef} class="max-h-[min(50vh,320px)] overflow-auto">
            <Show
              when={collection().size > 0}
              fallback={
                <div class="px-3 py-4 text-sm text-black/65 dark:text-white/65">
                  No files match "{search()}"
                </div>
              }
            >
              <Show
                when={isActionMode()}
                fallback={
                  <div
                    style={{
                      height: `${totalSize()}px`,
                      position: "relative",
                    }}
                  >
                    <For each={virtualItems()}>
                      {(virtualItem) => {
                        const item = collection().items[virtualItem.index];
                        if (!item || item.kind !== "file") return null;
                        const isSelected = value().includes(item.value);
                        return (
                          <Combobox.Item
                            item={item}
                            class={`
                          absolute left-0 w-full max-w-full cursor-pointer overflow-hidden px-3 py-1.5 text-left
                          text-sm text-[#111111] data-[highlighted]:bg-black/10 dark:text-[#efefef]
                          dark:data-[highlighted]:bg-white/10
                          ${isSelected ? "bg-black/5 font-medium dark:bg-white/5" : ""}
                        `}
                            style={{
                              height: `${virtualItem.size}px`,
                              transform: `translateY(${virtualItem.start}px)`,
                            }}
                          >
                            <Combobox.ItemText class="block truncate">
                              {item.label}
                            </Combobox.ItemText>
                          </Combobox.Item>
                        );
                      }}
                    </For>
                  </div>
                }
              >
                <Combobox.Item
                  item={{
                    kind: "action",
                    label: "Open Settings",
                    value: COMMAND_MENU_OPEN_SETTINGS_VALUE,
                  }}
                  class="
                    flex w-full min-w-0 max-w-full cursor-pointer items-center overflow-hidden border-l-2
                    border-[#111111]/25 px-3 py-2 text-left text-sm text-[#111111] data-[highlighted]:bg-black/10
                    dark:border-[#efefef]/30 dark:text-[#efefef] dark:data-[highlighted]:bg-white/10
                  "
                >
                  <span class="shrink-0 text-black/50 dark:text-white/50">
                    Action ·{" "}
                  </span>
                  <Combobox.ItemText class="min-w-0 flex-1 truncate">
                    Open Settings
                  </Combobox.ItemText>
                </Combobox.Item>
              </Show>
            </Show>
          </div>
        </Combobox.Content>
      </Combobox.Positioner>
    </Combobox.Root>
  );
};
