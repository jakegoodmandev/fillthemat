"use client";

import { useState } from "react";
import { cancelBookingAction } from "@/app/dashboard/bookings/actions";
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

export function CancelBookingButton({
  bookingId,
  participantName,
  offeringName,
  formattedDate,
}: {
  bookingId: string;
  participantName: string;
  offeringName: string;
  formattedDate: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          Cancel
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel trial booking?</AlertDialogTitle>
          <AlertDialogDescription>
            This will cancel {participantName}&apos;s trial for {offeringName}{" "}
            on {formattedDate}.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep booking</AlertDialogCancel>
          <form
            action={async (formData) => {
              setOpen(false);
              await cancelBookingAction(formData);
            }}
          >
            <input type="hidden" name="id" value={bookingId} />
            <AlertDialogAction
              type="submit"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Cancel booking
            </AlertDialogAction>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
