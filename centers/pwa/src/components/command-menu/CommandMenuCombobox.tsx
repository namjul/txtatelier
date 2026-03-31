import { Combobox, createListCollection } from "@ark-ui/solid";
import { createVirtualizer } from "@tanstack/solid-virtual";
import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import type { FilesRow } from "../../evolu/files";
import { filterFilesBySubstring } from "./filterFiles";

interface FileOption {
  readonly label: string;
  readonly value: string;
}

export const CommandMenuCombobox = (props: {
  files: ReadonlyArray<FilesRow>;
  selectedFileId: FilesRow["id"] | null;
  onSelect: (id: FilesRow["id"]) => void;
  inputRef: (el: HTMLInputElement) => void;
}) => {
  const [search, setSearch] = createSignal("");
  let scrollRef: HTMLDivElement | undefined;

  const fileOptions = createMemo<ReadonlyArray<FileOption>>(() => {
    return filterFilesBySubstring(props.files, search()).map((file) => ({
      label: file.path,
      value: String(file.id),
    }));
  });

  const collection = createMemo(() =>
    createListCollection<FileOption>({
      items: fileOptions(),
      itemToString: (item) => item.label,
      itemToValue: (item) => item.value,
    }),
  );

  const virtualizer = createVirtualizer({
    get count() {
      return fileOptions().length;
    },
    getScrollElement: () => scrollRef ?? null,
    estimateSize: () => 32,
    overscan: 5,
  });

  const virtualItems = createMemo(() => virtualizer.getVirtualItems());
  const totalSize = createMemo(() => virtualizer.getTotalSize());

  createEffect(() => {
    const count = fileOptions().length;
    if (scrollRef && count > 0) {
      setTimeout(() => virtualizer.measure(), 0);
    }
  });

  const value = createMemo(() =>
    props.selectedFileId == null ? [] : [String(props.selectedFileId)],
  );

  return (
    <Combobox.Root
      collection={collection()}
      value={value()}
      defaultOpen
      closeOnSelect
      openOnClick={false}
      inputBehavior="autohighlight"
      selectionBehavior="clear"
      onInputValueChange={(details) => setSearch(details.inputValue)}
      onSelect={(details) => {
        const selected = props.files.find(
          (file) => String(file.id) === details.itemValue,
        );
        if (!selected) return;
        props.onSelect(selected.id);
      }}
      scrollToIndexFn={(details) => {
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
          <Show
            when={fileOptions().length > 0}
            fallback={
              <div class="px-3 py-4 text-sm text-black/65 dark:text-white/65">
                No files match "{search()}"
              </div>
            }
          >
            <div ref={scrollRef} class="max-h-[min(50vh,320px)] overflow-auto">
              <div
                style={{
                  height: `${totalSize()}px`,
                  position: "relative",
                }}
              >
                <For each={virtualItems()}>
                  {(virtualItem) => {
                    const item = fileOptions()[virtualItem.index];
                    if (!item) return null;
                    const isSelected = value().includes(item.value);
                    return (
                      <Combobox.Item
                        item={item}
                        class={`
                          absolute left-0 w-full cursor-pointer px-3 py-1.5 text-left text-sm text-[#111111]
                          data-[highlighted]:bg-black/10 dark:text-[#efefef] dark:data-[highlighted]:bg-white/10
                          ${isSelected ? "bg-black/5 font-medium dark:bg-white/5" : ""}
                        `}
                        style={{
                          height: `${virtualItem.size}px`,
                          transform: `translateY(${virtualItem.start}px)`,
                        }}
                      >
                        <Combobox.ItemText>{item.label}</Combobox.ItemText>
                      </Combobox.Item>
                    );
                  }}
                </For>
              </div>
            </div>
          </Show>
        </Combobox.Content>
      </Combobox.Positioner>
    </Combobox.Root>
  );
};
