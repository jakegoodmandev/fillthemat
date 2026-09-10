"use client";

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

export type DismissDialogProps = {
  open: boolean;
  onKeepEditing: () => void;
  onDiscard: () => void;
  title?: string;
  body?: string;
  confirmLabel?: string;
};

/**
 * One-shot modal for "leave an editor without saving?". Used by every
 * settings section that allows cancelling an in-progress edit and by the
 * category navigation guard. Keyboard: Escape falls back to Keep Editing.
 */
export function DiscardChangesDialog({
  open,
  onKeepEditing,
  onDiscard,
  body = "Your unsaved edits will be lost.",
  title = "Discard changes?",
  confirmLabel = "Discard Changes",
}: DismissDialogProps) {
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
          <AlertDialogDescription>{body}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onKeepEditing}>
            Keep Editing
          </AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onDiscard}>
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
