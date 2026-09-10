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
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { IDLE_STATE, type SettingsFormState } from "../form-state";
import { useDirtyRegistration } from "./dirty-context";
import { SectionStatus, type SettingsAction } from "./section-form";

type Values = Record<string, string>;

function sameValues(a: Values, b: Values): boolean {
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((key) => a[key] === b[key]);
}

export type SaveResult = {
  status: "success" | "error";
  /** Fields the owner typed while the save was in flight. */
  typedDuringSave: string[];
  state: SettingsFormState;
};

export type RecordForm = {
  state: SettingsFormState;
  formAction: (formData: FormData) => void;
  formRef: React.RefObject<HTMLFormElement | null>;
  pending: boolean;
  values: Values;
  setField: (name: string, value: string) => void;
  dirty: boolean;
  reset: () => void;
  errorFor: (name: string) => string | undefined;
};

/**
 * Controlled form state for an inline create/edit record editor. On a
 * confirmed save it re-baselines to the server-normalized values but pins the
 * fields the owner typed while the request was in flight, so those edits are
 * never silently thrown away (they surface as "Unsaved changes").
 */
export function useRecordForm({
  action,
  initialValues,
  dirtyKey,
}: {
  action: SettingsAction;
  initialValues: Values;
  dirtyKey: string;
}): RecordForm & { result: SaveResult | null } {
  const [state, dispatch, pending] = useActionState(action, IDLE_STATE);
  const [values, setValues] = useState<Values>(initialValues);
  const [baseline, setBaseline] = useState<Values>(initialValues);
  const [editedFields, setEditedFields] = useState<string[]>([]);
  const [result, setResult] = useState<SaveResult | null>(null);
  const editedSinceSubmit = useRef<string[]>([]);
  const submittedValues = useRef<Values>(initialValues);
  const blankRef = useRef(initialValues);
  const formRef = useRef<HTMLFormElement>(null);

  const formAction = useCallback(
    (formData: FormData) => {
      setEditedFields([]);
      editedSinceSubmit.current = [];
      setResult(null);
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
      setResult({ status: "error", typedDuringSave: [], state });
      return;
    }
    const saved = state.values ?? submittedValues.current;
    const typedDuringSave = editedSinceSubmit.current;
    setValues((previous) => {
      const next = { ...previous };
      for (const [field, value] of Object.entries(saved)) {
        if (!typedDuringSave.includes(field)) next[field] = value;
      }
      return next;
    });
    setBaseline((previous) => {
      const next = { ...previous };
      for (const [field, value] of Object.entries(saved)) {
        if (!typedDuringSave.includes(field)) next[field] = value;
      }
      return next;
    });
    setResult({ status: "success", typedDuringSave, state });
  }, [state]);

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
    result,
  };
}

/**
 * Shared inline editor frame: contextual heading, configurable form body,
 * Save + Cancel, and a result bar. The success announcement itself lives in the
 * section (outside this frame) so it stays visible after the editor closes.
 */
export function RecordEditPanel({
  action,
  initialValues,
  dirtyKey,
  heading,
  saveLabel,
  savingLabel,
  onCancel,
  onResult,
  onDirtyChange,
  onReload,
  renderFields,
}: {
  action: SettingsAction;
  initialValues: Values;
  dirtyKey: string;
  heading: string;
  saveLabel: string;
  savingLabel?: string;
  onCancel: () => void;
  onResult?: (result: SaveResult) => void;
  onDirtyChange?: (dirty: boolean) => void;
  onReload?: () => void;
  renderFields: (form: RecordForm) => React.ReactNode;
}) {
  const form = useRecordForm({ action, initialValues, dirtyKey });
  const delivered = useRef<SaveResult | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  useEffect(() => {
    onDirtyChange?.(form.dirty);
  }, [form.dirty, onDirtyChange]);

  useEffect(() => {
    if (form.result && form.result !== delivered.current) {
      delivered.current = form.result;
      onResult?.(form.result);
    }
  }, [form.result, onResult]);

  return (
    <form
      ref={form.formRef}
      action={form.formAction}
      className="flex flex-col gap-4 rounded-md border border-border bg-card/40 p-3 md:p-4"
    >
      <h3 className="text-base font-semibold">{heading}</h3>

      <div className="flex flex-col gap-3">{renderFields(form)}</div>

      <div className="flex flex-col gap-3 border-t border-border pt-3 sm:flex-row-reverse sm:items-center">
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            type="submit"
            disabled={form.pending}
            aria-busy={form.pending || undefined}
          >
            {form.pending ? (savingLabel ?? "Saving…") : saveLabel}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => (form.dirty ? setConfirmCancel(true) : onCancel())}
            disabled={form.pending}
          >
            Cancel
          </Button>
        </div>
        <SectionStatus
          state={form.state}
          pending={form.pending}
          dirty={form.dirty}
        />
      </div>

      {form.state.conflict ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-warning/40 px-3 py-2">
          <p className="min-w-0 flex-1 text-sm text-warning text-pretty">
            {form.state.message}
          </p>
          {onReload ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onReload}
            >
              Reload latest
            </Button>
          ) : null}
        </div>
      ) : null}

      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard these changes?</AlertDialogTitle>
            <AlertDialogDescription>
              Your edits have not been saved. Cancelling now throws them away.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Editing</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                setConfirmCancel(false);
                onCancel();
              }}
            >
              Discard Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}
