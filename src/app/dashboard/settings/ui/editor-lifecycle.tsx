"use client";

import { useCallback, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useDirtyState } from "./dirty-context";

export type EditorTarget =
  | { type: "closed" }
  | { type: "create" }
  | { type: "edit"; id: string };

function sameTarget(a: EditorTarget, b: EditorTarget): boolean {
  if (a.type !== b.type) return false;
  if (a.type === "edit" && b.type === "edit") return a.id === b.id;
  return true;
}

/**
 * One create/edit panel per category. Switching records (or opening Add)
 * while the open panel is dirty asks before discarding.
 */
export function useRecordEditor(category: string) {
  const { dirtyKeys } = useDirtyState();
  const [open, setOpen] = useState<EditorTarget>({ type: "closed" });
  const [pendingTarget, setPendingTarget] = useState<EditorTarget | null>(null);
  const categoryDirty = dirtyKeys.some((key) => key.startsWith(`${category}:`));

  const apply = useCallback((target: EditorTarget) => {
    setOpen(target);
    setPendingTarget(null);
  }, []);

  const requestOpen = useCallback(
    (target: EditorTarget) => {
      if (sameTarget(open, target)) return;
      if (categoryDirty) {
        setPendingTarget(target);
        return;
      }
      apply(target);
    },
    [apply, categoryDirty, open],
  );

  const requestClose = useCallback(() => {
    requestOpen({ type: "closed" });
  }, [requestOpen]);

  const closeImmediate = useCallback(() => {
    apply({ type: "closed" });
  }, [apply]);

  const keepEditing = useCallback(() => {
    setPendingTarget(null);
  }, []);

  const discardAndSwitch = useCallback(() => {
    if (pendingTarget) apply(pendingTarget);
  }, [apply, pendingTarget]);

  const isEditing = (id: string) => open.type === "edit" && open.id === id;
  const isCreating = open.type === "create";

  return {
    open,
    pendingTarget,
    requestOpen,
    requestClose,
    closeImmediate,
    keepEditing,
    discardAndSwitch,
    isEditing,
    isCreating,
  };
}

export function DiscardEditsDialog({
  open,
  title = "Discard unsaved changes?",
  description = "You have changes that have not been saved yet. If you continue, those edits are lost.",
  onKeepEditing,
  onDiscard,
}: {
  open: boolean;
  title?: string;
  description?: string;
  onKeepEditing: () => void;
  onDiscard: () => void;
}) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onKeepEditing();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep Editing</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onDiscard}>
            Discard Changes
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
