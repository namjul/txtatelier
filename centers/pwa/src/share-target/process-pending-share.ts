import {
  getFilesShardMutationOptions,
  type TxtatelierEvolu,
} from "../evolu/client";
import { computeContentHash } from "@txtatelier/sync-invariants";
import { createFileRowByPathQuery } from "../evolu/file-by-path-query";
import { settingsQuery } from "../evolu/settings";
import { formatSharedLine } from "./format-shared-line";
import {
  DEFAULT_INBOX_PATH,
  validateInboxPath,
} from "./inbox-path-validation";
import {
  deletePendingShare,
  getPendingShare,
} from "./pending-share-idb";

let processing = false;

const resolveInboxPath = async (client: TxtatelierEvolu): Promise<string> => {
  const rows = await client.loadQuery(settingsQuery);
  const raw = rows[0]?.inboxPath ?? DEFAULT_INBOX_PATH;
  const validated = validateInboxPath(raw);
  return validated.ok ? validated.value : DEFAULT_INBOX_PATH;
};

/**
 * Reads `pendingShare` from IndexedDB, prepends a formatted line to the configured inbox
 * file in Evolu, then clears the key. No-ops if nothing pending or owner not ready.
 */
export const tryProcessPendingShare = async (
  client: TxtatelierEvolu,
): Promise<void> => {
  if (processing) return;
  processing = true;
  try {
    const pending = await getPendingShare();
    if (pending == null) return;

    await client.appOwner;

    const inboxPath = await resolveInboxPath(client);
    const pathValidation = validateInboxPath(inboxPath);
    if (!pathValidation.ok) return;

    const at = new Date(pending.timestamp);
    const line = formatSharedLine(pending.content, at);

    const fileQuery = createFileRowByPathQuery(pathValidation.value);
    const fileRows = await client.loadQuery(fileQuery);
    const fileRow = fileRows[0];

    const filesShard = await getFilesShardMutationOptions(client);
    const existing = fileRow?.content ?? "";
    const newContent =
      existing.length === 0 ? line : `${line}\n${existing}`;

    const contentHash = await computeContentHash(newContent);

    if (fileRow == null) {
      const ins = client.insert(
        "file",
        {
          path: pathValidation.value,
          content: newContent,
          contentHash,
        },
        filesShard,
      );
      if (!ins.ok) return;
    } else {
      const upd = client.update(
        "file",
        {
          id: fileRow.id,
          content: newContent,
          contentHash,
        },
        filesShard,
      );
      if (!upd.ok) return;
    }

    await deletePendingShare();
  } catch (cause) {
    console.warn("[txtatelier] pending share drain failed (will retry)", cause);
  } finally {
    processing = false;
  }
};
