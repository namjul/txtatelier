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
  onFileCountChange?: (info: {
    total: number;
    filtered: number;
    isActionMode: boolean;
  }) => void;
}) => {
  const [search, setSearch] = createSignal("");
  let contentRef: HTMLDivElement | undefined;

  const isActionMode = createMemo(() => isCommandMenuActionMode(search()));

  const filterFn = useFilter({ sensitivity: "base" });

  const allItems = createMemo<ReadonlyArray<CommandMenuListItem>>(() => [
    ...props.files.map((file) => ({
      kind: "file" as const,
      label: file.path,
      value: String(file.id),
    })),
    {
      kind: "action" as const,
      label: "Open Settings",
      value: COMMAND_MENU_OPEN_SETTINGS_VALUE,
    },
  ]);

  const { collection, filter, set } = useListCollection<CommandMenuListItem>({
    get initialItems() {
      return allItems();
    },
    itemToString: (item) => item.label,
    itemToValue: (item) => item.value,
    filter: (itemString, query, item) => {
      if (isCommandMenuActionMode(query)) {
        return item.kind === "action";
      }
      if (item.kind === "action") {
        return false;
      }
      return filterFn().contains(itemString, query);
    },
  });

  const virtualizer = createVirtualizer({
    get count() {
      return collection().size;
    },
    getScrollElement: () => contentRef ?? null,
    estimateSize: () => 32,
    overscan: 5,
  });


  createEffect(() => {
    set(allItems() as CommandMenuListItem[])
    queueMicrotask(() => virtualizer.measure())
  });

  createEffect(() => {
    const total = props.files.length;
    const actionCount = 1;
    const filtered = isActionMode() ? actionCount : collection().size;
    props.onFileCountChange?.({
      total,
      filtered,
      isActionMode: isActionMode(),
    });
  });

  const value = createMemo(() =>
    props.selectedFileId == null ? [] : [String(props.selectedFileId)],
  );

  const handleInputChange = (details: { inputValue: string }) => {
    filter(details.inputValue);
    setSearch(details.inputValue);
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
        virtualizer.scrollToIndex(details.index, {
          align: 'center',
          behavior: 'auto',
        })
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
            <div ref={contentRef} class="max-h-[min(50vh,320px)] overflow-auto">
              <Show
                when={collection().size > 0}
                fallback={
                  <div class="px-3 py-4 text-sm text-black/65 dark:text-white/65">
                    No files match "{search()}"
                  </div>
                }
              >
                <div
                  style={{
                    height: `${virtualizer.getTotalSize()}px`,
                    position: "relative",
                  }}
                >
                  {virtualizer.getVirtualItems().map((virtualItem) => {
                    const item = collection().items[virtualItem.index];
                    if (!item) return null;
                    const isSelected = value().includes(item.value);
                    return (
                      <Combobox.Item
                        item={item}
                        aria-setsize={collection().size}
                        aria-posinset={virtualItem.index + 1}
                        class={`
                          absolute left-0 w-full max-w-full cursor-pointer overflow-hidden px-3 py-1.5 text-left
                          text-sm text-[#111111] data-[highlighted]:bg-black/10 dark:text-[#efefef]
                          dark:data-[highlighted]:bg-white/10
                          ${isSelected ? "bg-black/5 font-medium dark:bg-white/5" : ""}
                          ${item.kind === "action" ? "border-l-2 border-[#111111]/25 dark:border-[#efefef]/30" : ""}
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
                  })}
                </div>
              </Show>
            </div>
          </Combobox.Content>
        </Combobox.Positioner>
    </Combobox.Root>
  );
};
