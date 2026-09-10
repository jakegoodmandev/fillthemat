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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cancelBookingAction } from "./actions";

export function CancelBookingButton({ bookingId }: { bookingId: string }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          Cancel
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel this booking?</AlertDialogTitle>
          <AlertDialogDescription>
            The family is notified and the spot opens up for someone else. This
            cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel type="button">Keep booking</AlertDialogCancel>
          <form action={cancelBookingAction}>
            <input type="hidden" name="id" value={bookingId} />
            <AlertDialogAction type="submit" variant="destructive">
              Cancel booking
            </AlertDialogAction>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
