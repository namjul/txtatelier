import { createEffect, createMemo, createSignal } from "solid-js";
import { useQuery } from "../../evolu/evolu";
import { type FilesRow, filesQuery } from "../../evolu/files";

export const useFileList = () => {
  const fileRows = useQuery(filesQuery);
  const files = createMemo(() => fileRows() ?? []);
  const [selectedFileId, setSelectedFileId] = createSignal<
    FilesRow["id"] | null
  >(null);

  const selectedFile = createMemo(() => {
    const id = selectedFileId();
    if (id == null) return null;
    return files().find((file) => file.id === id) ?? null;
  });

  createEffect(() => {
    const list = files();
    const current = selectedFileId();

    if (list.length === 0) {
      if (current != null) setSelectedFileId(null);
      return;
    }

    if (current == null) {
      const first = list.at(0);
      if (first) setSelectedFileId(first.id);
      return;
    }

    const stillExists = list.some((file) => file.id === current);
    if (!stillExists) {
      const first = list.at(0);
      if (first) setSelectedFileId(first.id);
    }
  });

  return {
    fileRows,
    files,
    selectedFileId,
    selectedFile,
    selectFile: setSelectedFileId,
  };
};
