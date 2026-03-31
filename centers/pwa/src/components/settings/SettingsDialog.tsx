import { Dialog } from "@ark-ui/solid";
import type { Accessor, createResource } from "solid-js";
import type { StatusOps, StatusState } from "../editor/types";
import { SettingsPanel } from "./SettingsPanel";

interface OwnerData {
  readonly id: string;
  readonly mnemonic?: string | null;
}

type OwnerResourceSlot = ReturnType<typeof createResource<OwnerData>>[0];

export const SettingsDialog = (props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editorTextArea: () => HTMLTextAreaElement | null;
  owner: OwnerResourceSlot;
  ownerId: () => string | undefined;
  appStatus: Accessor<StatusState>;
  statusOps: StatusOps;
}) => {
  return (
    <Dialog.Root
      open={props.open}
      onOpenChange={(d) => props.onOpenChange(d.open)}
      closeOnEscape
      closeOnInteractOutside={false}
      finalFocusEl={() => props.editorTextArea()}
      restoreFocus
      modal
      trapFocus
      preventScroll
    >
      <Dialog.Backdrop class="fixed inset-0 z-[60] bg-[#f2f1ee] dark:bg-[#151617]" />
      <Dialog.Positioner class="fixed inset-0 z-[70] flex overflow-y-auto">
        <Dialog.Content
          class="flex min-h-full w-full flex-col bg-[#f2f1ee] font-mono text-[#111111] dark:bg-[#151617] dark:text-[#efefef]"
          aria-labelledby="txtatelier-settings-title"
        >
          <Dialog.Title id="txtatelier-settings-title" class="sr-only">
            Settings
          </Dialog.Title>
          <Dialog.Description class="sr-only">
            Application status, identity, and sync. Press Escape or use Back to
            return to the editor.
          </Dialog.Description>
          <SettingsPanel
            owner={props.owner}
            ownerId={props.ownerId}
            appStatus={props.appStatus}
            statusOps={props.statusOps}
            onBack={() => props.onOpenChange(false)}
          />
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
};
