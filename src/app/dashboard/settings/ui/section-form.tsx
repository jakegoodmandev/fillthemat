"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { IDLE_STATE, type SettingsFormState } from "../form-state";
import {
  dangerButtonClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "./controls";
import { useDirtyRegistration } from "./dirty-context";

export type SettingsAction = (
  state: SettingsFormState,
  formData: FormData,
) => Promise<SettingsFormState>;

type Values = Record<string, string>;

function sameValues(a: Values, b: Values): boolean {
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((key) => a[key] === b[key]);
}

/**
 * Controlled form state for one settings section:
 * unsaved tracking, pending/success/error, and inline field errors.
 */
export function useSettingsForm({
  action,
  initialValues,
  dirtyKey,
  clearOnSuccess = false,
}: {
  action: SettingsAction;
  initialValues: Values;
  dirtyKey: string;
  clearOnSuccess?: boolean;
}) {
  const [state, dispatch, pending] = useActionState(action, IDLE_STATE);
  const [values, setValues] = useState<Values>(initialValues);
  const [baseline, setBaseline] = useState<Values>(initialValues);
  const [editedFields, setEditedFields] = useState<string[]>([]);
  const editedSinceSubmit = useRef<string[]>([]);
  const submittedValues = useRef<Values>(initialValues);
  const blankRef = useRef(initialValues);
  const formRef = useRef<HTMLFormElement>(null);

  // Field errors are hidden once the owner edits that field again, so clear the
  // record of edits as the submit starts rather than when the answer arrives.
  const formAction = useCallback(
    (formData: FormData) => {
      setEditedFields([]);
      editedSinceSubmit.current = [];
      // What actually went to the server, used as the fallback baseline when an
      // action reports success without echoing normalized values back.
      const submitted: Values = {};
      for (const field of Object.keys(blankRef.current)) {
        const raw = formData.get(field);
        if (typeof raw === "string") submitted[field] = raw;
      }
      submittedValues.current = submitted;
      dispatch(formData);
    },
    [dispatch],
  );

  useEffect(() => {
    if (state.status === "idle") return;
    if (state.status === "error") {
      const invalid = formRef.current?.querySelector<HTMLElement>(
        '[aria-invalid="true"]',
      );
      invalid?.focus();
      return;
    }
    if (clearOnSuccess) {
      setValues(blankRef.current);
      setBaseline(blankRef.current);
      return;
    }
    // Prefer what the server says it stored (trimmed, normalized); fall back to
    // what was submitted so a save can never leave the form stuck on
    // "Unsaved changes" with a Discard that would undo a live write.
    const saved = state.values ?? submittedValues.current;
    const typedDuringSave = editedSinceSubmit.current;
    setValues((previous) => {
      const next = { ...previous };
      for (const [field, value] of Object.entries(saved)) {
        if (!typedDuringSave.includes(field)) next[field] = value;
      }
      return next;
    });
    setBaseline((previous) => ({ ...previous, ...saved }));
  }, [state, clearOnSuccess]);

  const setField = useCallback((name: string, value: string) => {
    setValues((previous) => ({ ...previous, [name]: value }));
    if (!editedSinceSubmit.current.includes(name)) {
      editedSinceSubmit.current = [...editedSinceSubmit.current, name];
    }
    setEditedFields((previous) =>
      previous.includes(name) ? previous : [...previous, name],
    );
  }, []);

  const dirty = useMemo(
    () => !sameValues(values, baseline),
    [values, baseline],
  );

  useDirtyRegistration(dirtyKey, dirty);

  const reset = useCallback(() => {
    setValues(baseline);
    setEditedFields([]);
  }, [baseline]);

  const errorFor = useCallback(
    (name: string) =>
      state.status === "error" && !editedFields.includes(name)
        ? state.fieldErrors[name]
        : undefined,
    [state, editedFields],
  );

  return {
    state,
    formAction,
    formRef,
    pending,
    values,
    setField,
    dirty,
    reset,
    errorFor,
  };
}

export function SectionStatus({
  state,
  pending,
  dirty,
  idleHint,
}: {
  state: SettingsFormState;
  pending: boolean;
  dirty: boolean;
  idleHint?: string;
}) {
  let message = idleHint ?? "";
  let tone = "text-zinc-500";
  if (pending) {
    message = "Saving…";
    tone = "text-zinc-300";
  } else if (state.status === "error") {
    message = state.message ?? "That did not save.";
    tone = "text-red-400";
  } else if (dirty) {
    message = "Unsaved changes";
    tone = "text-amber-300";
  } else if (state.status === "success") {
    message = state.message ?? "Saved.";
    tone = "text-emerald-300";
  }

  return (
    <p
      role="status"
      aria-live="polite"
      aria-busy={pending || undefined}
      className={`min-w-0 flex-1 text-sm leading-relaxed text-pretty ${tone}`}
    >
      {message}
    </p>
  );
}

export function SaveBar({
  saveLabel,
  savingLabel = "Saving…",
  pending,
  dirty,
  onDiscard,
  state,
  idleHint,
}: {
  saveLabel: string;
  savingLabel?: string;
  pending: boolean;
  dirty: boolean;
  onDiscard: () => void;
  state: SettingsFormState;
  idleHint?: string;
}) {
  return (
    <div className="flex flex-col gap-3 border-t border-zinc-900 pt-4 sm:flex-row-reverse sm:items-center">
      <div className="flex shrink-0 gap-2">
        <button
          type="submit"
          className={primaryButtonClass}
          disabled={pending}
          aria-busy={pending || undefined}
        >
          {pending ? savingLabel : saveLabel}
        </button>
        <button
          type="button"
          className={secondaryButtonClass}
          onClick={onDiscard}
          disabled={!dirty || pending}
        >
          Discard
        </button>
      </div>
      <SectionStatus
        state={state}
        pending={pending}
        dirty={dirty}
        idleHint={idleHint}
      />
    </div>
  );
}

/**
 * A single-item action (toggle, delete, deactivate) with its own pending and
 * result state. Destructive actions ask for confirmation in a modal first.
 */
export function ItemActionForm({
  action,
  id,
  label,
  pendingLabel,
  variant = "secondary",
  confirm,
  className,
}: {
  action: SettingsAction;
  id: string;
  label: string;
  pendingLabel: string;
  variant?: "secondary" | "danger";
  confirm?: { title: string; body: React.ReactNode; confirmLabel: string };
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, IDLE_STATE);
  const formRef = useRef<HTMLFormElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const buttonClass =
    variant === "danger" ? dangerButtonClass : secondaryButtonClass;

  return (
    <div className={`flex min-w-0 flex-col gap-1 ${className ?? ""}`}>
      <form ref={formRef} action={formAction}>
        <input type="hidden" name="id" value={id} />
        <button
          type={confirm ? "button" : "submit"}
          className={buttonClass}
          disabled={pending}
          aria-busy={pending || undefined}
          onClick={confirm ? () => dialogRef.current?.showModal() : undefined}
        >
          {pending ? pendingLabel : label}
        </button>
      </form>
      {state.status !== "idle" ? (
        <p
          role="status"
          aria-live="polite"
          className={`text-xs leading-relaxed text-pretty ${
            state.status === "error" ? "text-red-400" : "text-emerald-300"
          }`}
        >
          {state.message}
        </p>
      ) : null}
      {confirm ? (
        <dialog
          ref={dialogRef}
          aria-labelledby={`${id}-confirm-title`}
          className="m-auto w-[min(28rem,calc(100vw-2rem))] overscroll-contain rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-zinc-100 backdrop:bg-black/60"
        >
          <h2
            id={`${id}-confirm-title`}
            className="text-base font-semibold text-balance"
          >
            {confirm.title}
          </h2>
          <div className="mt-2 text-sm leading-relaxed text-zinc-400 text-pretty">
            {confirm.body}
          </div>
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              className={secondaryButtonClass}
              onClick={() => dialogRef.current?.close()}
            >
              Keep it
            </button>
            <button
              type="button"
              className={dangerButtonClass}
              onClick={() => {
                dialogRef.current?.close();
                formRef.current?.requestSubmit();
              }}
            >
              {confirm.confirmLabel}
            </button>
          </div>
        </dialog>
      ) : null}
    </div>
  );
}
