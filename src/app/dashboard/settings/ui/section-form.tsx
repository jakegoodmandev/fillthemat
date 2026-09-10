"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
import { IDLE_STATE, type SettingsFormState } from "../form-state";
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
  let tone = "text-muted-foreground";
  if (pending) {
    message = "Saving…";
    tone = "text-foreground";
  } else if (state.status === "error") {
    message = state.message ?? "That did not save.";
    tone = "text-destructive";
  } else if (dirty) {
    message = "Unsaved changes";
    tone = "text-warning";
  } else if (state.status === "success") {
    message = state.message ?? "Saved.";
    tone = "text-success";
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
    <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row-reverse sm:items-center">
      <div className="flex shrink-0 gap-2">
        <Button
          type="submit"
          disabled={pending}
          aria-busy={pending || undefined}
        >
          {pending ? savingLabel : saveLabel}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onDiscard}
          disabled={!dirty || pending}
        >
          Discard
        </Button>
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
  const destructive = variant === "danger";

  return (
    <div className={`flex min-w-0 flex-col gap-1 ${className ?? ""}`}>
      <form ref={formRef} action={formAction} className="contents">
        <input type="hidden" name="id" value={id} />
        {confirm ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant={destructive ? "ghost" : "outline"}
                size="sm"
                disabled={pending}
                aria-busy={pending || undefined}
                className={
                  destructive
                    ? "text-destructive hover:bg-destructive/10 hover:text-destructive"
                    : undefined
                }
              >
                {pending ? pendingLabel : label}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{confirm.title}</AlertDialogTitle>
                <AlertDialogDescription>{confirm.body}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel type="button">Keep it</AlertDialogCancel>
                <AlertDialogAction
                  type="button"
                  variant="destructive"
                  onClick={() => formRef.current?.requestSubmit()}
                >
                  {confirm.confirmLabel}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : (
          <Button
            type="submit"
            variant={destructive ? "destructive" : "outline"}
            size="sm"
            disabled={pending}
            aria-busy={pending || undefined}
          >
            {pending ? pendingLabel : label}
          </Button>
        )}
      </form>
      {state.status !== "idle" ? (
        <p
          role="status"
          aria-live="polite"
          className={`text-xs leading-relaxed text-pretty ${
            state.status === "error" ? "text-destructive" : "text-success"
          }`}
        >
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
