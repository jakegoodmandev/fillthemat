"use client";

import { useActionState, useState } from "react";
import {
  idleSettingsActionState,
  type SettingsActionState,
} from "../action-state";
import { ActionStatus } from "./action-status";
import { dangerButtonClassName, ghostButtonClassName } from "./styles";

export function ConfirmDelete({
  action,
  id,
  label,
  description,
  pendingLabel = "Deleting…",
}: {
  action: (
    state: SettingsActionState,
    formData: FormData,
  ) => Promise<SettingsActionState>;
  id: string;
  label: string;
  description: string;
  pendingLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    action,
    idleSettingsActionState,
  );

  if (!open) {
    return (
      <button
        type="button"
        className={ghostButtonClassName}
        onClick={() => setOpen(true)}
      >
        {label}
      </button>
    );
  }

  return (
    <form action={formAction} className="flex min-w-0 flex-col gap-2">
      <input type="hidden" name="id" value={id} />
      <p className="text-pretty text-sm text-zinc-300">{description}</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={ghostButtonClassName}
          onClick={() => setOpen(false)}
        >
          Cancel
        </button>
        <button type="submit" className={dangerButtonClassName}>
          {pending ? pendingLabel : label}
        </button>
      </div>
      <ActionStatus state={state} pending={pending} />
    </form>
  );
}
