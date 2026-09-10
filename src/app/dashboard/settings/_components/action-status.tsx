"use client";

import { type RefObject, useEffect, useRef } from "react";
import type { SettingsActionState } from "../action-state";
import { primaryButtonClassName, secondaryButtonClassName } from "./styles";

export function ActionStatus({
  state,
  pending,
}: {
  state: SettingsActionState;
  pending: boolean;
}) {
  let message: string | null = null;
  let tone = "text-zinc-400";
  if (pending) {
    message = "Saving…";
  } else if (state.status === "error") {
    message = state.message;
    tone = "text-red-400";
  } else if (state.status === "success") {
    message = state.message;
    tone = "text-emerald-400";
  }
  if (!message) return null;
  return (
    <p className={`min-w-0 text-pretty text-sm ${tone}`} aria-live="polite">
      {message}
    </p>
  );
}

export function FormActions({
  state,
  pending,
  saveLabel,
  showDiscard = true,
}: {
  state: SettingsActionState;
  pending: boolean;
  saveLabel: string;
  showDiscard?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <ActionStatus state={state} pending={pending} />
      <div className="flex flex-wrap gap-2">
        {showDiscard ? (
          <button type="reset" className={secondaryButtonClassName}>
            Discard
          </button>
        ) : null}
        <button type="submit" className={primaryButtonClassName}>
          {pending ? "Saving…" : saveLabel}
        </button>
      </div>
    </div>
  );
}

export function useFocusFirstError(
  state: SettingsActionState,
  formRef: RefObject<HTMLFormElement | null>,
) {
  const lastMessage = useRef<string | null>(null);
  useEffect(() => {
    if (state.status !== "error") return;
    const signature = `${state.message}:${Object.keys(state.fieldErrors).join(",")}`;
    if (signature === lastMessage.current) return;
    lastMessage.current = signature;
    const first = Object.keys(state.fieldErrors)[0];
    const form = formRef.current;
    if (!form) return;
    const target = first
      ? form.querySelector<HTMLElement>(`[name="${CSS.escape(first)}"]`)
      : null;
    target?.focus();
  }, [state, formRef]);
}
