"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { createFaqAction, deleteFaqAction, updateFaqAction } from "../actions";
import { LIMITS } from "../schemas";
import { Callout, FieldGroup, TextAreaField, TextField } from "../ui/controls";
import { useDirtyState } from "../ui/dirty-context";
import { DiscardChangesDialog } from "../ui/inline-editor";
import { ItemActionForm, SaveBar, useSettingsForm } from "../ui/section-form";

export type FaqItem = {
  id: string;
  question: string;
  answer: string;
  sortOrder: number;
  updatedAt: string;
};

const STARTER_QUESTIONS = [
  "Do we need a uniform for the first class?",
  "Can a parent stay and watch?",
  "What happens if we need to reschedule?",
  "Is there a make-up class if we miss one?",
];

type EditorMode =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "edit"; id: string };

type SuccessAnnouncement = {
  message: string;
  rowId: string;
  created: boolean;
};

export function FaqsSection({ faqs }: { faqs: FaqItem[] }) {
  const [editor, setEditor] = useState<EditorMode>({ kind: "closed" });
  const [pendingTarget, setPendingTarget] = useState<EditorMode | null>(null);
  const [pendingCancel, setPendingCancel] = useState(false);
  const [pendingStarter, setPendingStarter] = useState<string | null>(null);
  const [successAnnouncement, setSuccessAnnouncement] =
    useState<SuccessAnnouncement | null>(null);
  const rowRefs = useRef(new Map<string, HTMLLIElement>());
  const lastEditAnchor = useRef<HTMLElement | null>(null);
  const { dirtyKeys } = useDirtyState();
  const sectionDirty = dirtyKeys.some((key) => key.startsWith("faqs:"));
  const atLimit = faqs.length >= LIMITS.faqCount;

  useEffect(() => {
    if (!successAnnouncement) return;
    const timer = window.setTimeout(() => setSuccessAnnouncement(null), 10_000);
    return () => window.clearTimeout(timer);
  }, [successAnnouncement]);

  const focusRow = (id: string) => {
    rowRefs.current.get(id)?.focus();
  };

  const openRow = (mode: EditorMode, anchor: HTMLElement | null) => {
    if (anchor) lastEditAnchor.current = anchor;
    if (
      (mode.kind === "closed" && editor.kind === "closed") ||
      (mode.kind === "create" && editor.kind === "create") ||
      (mode.kind === "edit" && editor.kind === "edit" && mode.id === editor.id)
    ) {
      return;
    }
    if (editor.kind === "closed" || !sectionDirty) {
      setEditor(mode);
      return;
    }
    setPendingTarget(mode);
  };

  const closePanel = () => {
    setEditor({ kind: "closed" });
    lastEditAnchor.current?.focus();
  };

  const requestCancel = () => setPendingCancel(true);
  const discardCancel = () => {
    setPendingCancel(false);
    closePanel();
  };
  const discardAndSwitch = () => {
    if (pendingTarget) setEditor(pendingTarget);
    setPendingTarget(null);
  };

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3" aria-labelledby="faq-list">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 id="faq-list" className="text-sm font-semibold">
            Your questions
          </h3>
          <p className="text-xs text-muted-foreground tabular-nums">
            {faqs.length} of {LIMITS.faqCount} used
          </p>
        </div>

        {faqs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-pretty">
            No questions yet. Your agent can still answer from school details,
            trial classes, schedule, and pricing.
          </p>
        ) : (
          <ul className="divide-y divide-border border-y border-border">
            {faqs.map((faq) => {
              const isEditing = editor.kind === "edit" && editor.id === faq.id;
              return (
                <li
                  key={faq.id}
                  ref={(node) => {
                    if (node) rowRefs.current.set(faq.id, node);
                    else rowRefs.current.delete(faq.id);
                  }}
                  tabIndex={-1}
                  aria-label={`Question: ${faq.question}`}
                  className="flex flex-col gap-3 py-3 outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 flex-col gap-1">
                      <p className="text-sm font-medium text-pretty">
                        {faq.question}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        ID: <span className="font-mono">{faq.id}</span> · sort
                        order:{" "}
                        <span className="font-mono">{faq.sortOrder}</span>
                      </p>
                      {successAnnouncement?.rowId === faq.id ? (
                        <p
                          role="status"
                          aria-live="polite"
                          className="text-xs text-success"
                        >
                          {successAnnouncement.message}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-col items-stretch gap-2 sm:items-end">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={(event) =>
                          openRow(
                            { kind: "edit", id: faq.id },
                            event.currentTarget,
                          )
                        }
                        aria-expanded={isEditing || undefined}
                        aria-controls={
                          isEditing ? `faq-editor-${faq.id}` : undefined
                        }
                      >
                        {isEditing ? "Editing…" : "Edit"}
                      </Button>
                      <ItemActionForm
                        action={deleteFaqAction}
                        id={faq.id}
                        label="Delete"
                        pendingLabel="Deleting…"
                        variant="danger"
                        className="items-end"
                        confirm={{
                          title: "Delete this question?",
                          body: (
                            <>
                              Your agent will stop using this answer. Deleting
                              cannot be undone.
                            </>
                          ),
                          confirmLabel: "Delete Question",
                        }}
                      />
                    </div>
                  </div>
                  <details className="group">
                    <summary className="flex cursor-pointer touch-manipulation list-none items-center justify-between gap-3 rounded-md text-sm font-medium">
                      <span className="min-w-0 text-pretty text-muted-foreground">
                        Show answer
                      </span>
                      <span
                        aria-hidden="true"
                        className="shrink-0 text-xs text-muted-foreground"
                      >
                        <span className="group-open:hidden">Show answer</span>
                        <span className="hidden group-open:inline">Hide</span>
                      </span>
                    </summary>
                    <p className="mt-2 max-w-prose text-sm leading-relaxed break-words text-foreground whitespace-pre-wrap">
                      {faq.answer}
                    </p>
                  </details>
                  {isEditing ? (
                    <FaqEditor
                      key={`faq-edit-${faq.id}-${faq.updatedAt}`}
                      faq={faq}
                      onCancel={requestCancel}
                      onSaved={(message) => {
                        setSuccessAnnouncement({
                          message,
                          rowId: faq.id,
                          created: false,
                        });
                        closePanel();
                        window.setTimeout(() => focusRow(faq.id), 0);
                      }}
                      onRetainEdits={(message) => {
                        setSuccessAnnouncement({
                          message,
                          rowId: faq.id,
                          created: false,
                        });
                      }}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {atLimit ? (
        <Callout tone="warning">
          You have reached the limit of {LIMITS.faqCount} questions. Edit or
          delete one before adding another.
        </Callout>
      ) : null}

      {editor.kind === "create" ? (
        <CreateFaqForm
          key={`faq-create-${pendingStarter ?? "blank"}`}
          starter={pendingStarter}
          onCancel={requestCancel}
          onCreated={(newId, message) => {
            setSuccessAnnouncement({
              message,
              rowId: newId,
              created: true,
            });
            closePanel();
            setPendingStarter(null);
            if (newId) window.setTimeout(() => focusRow(newId), 50);
          }}
        />
      ) : null}

      {editor.kind === "closed" && !atLimit ? (
        <div className="flex flex-col gap-3">
          <Button
            type="button"
            variant="outline"
            className="self-start"
            onClick={(event) =>
              openRow({ kind: "create" }, event.currentTarget)
            }
          >
            Add a Question
          </Button>
          <div className="flex flex-col gap-1">
            <p className="text-xs text-muted-foreground">Starting points:</p>
            <ul className="flex flex-wrap gap-x-3 gap-y-1">
              {STARTER_QUESTIONS.map((question) => (
                <li key={question}>
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto px-0 text-left text-sm whitespace-normal"
                    onClick={(event) => {
                      setPendingStarter(question);
                      openRow({ kind: "create" }, event.currentTarget);
                    }}
                  >
                    {question}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      <DiscardChangesDialog
        open={pendingCancel}
        onKeepEditing={() => setPendingCancel(false)}
        onDiscard={discardCancel}
        body="Your unsaved edits to this question will be lost."
      />

      <DiscardChangesDialog
        open={pendingTarget !== null}
        onKeepEditing={() => setPendingTarget(null)}
        onDiscard={discardAndSwitch}
        title="Switch and discard your edits?"
        body="The question you were editing has unsaved changes. Switching now will lose them."
        confirmLabel="Discard & Switch"
      />
    </div>
  );
}

function CreateFaqForm({
  starter,
  onCancel,
  onCreated,
}: {
  starter: string | null;
  onCancel: () => void;
  onCreated: (newId: string, message: string) => void;
}) {
  const {
    state,
    formAction,
    formRef,
    pending,
    values,
    setField,
    dirty,
    reset,
    errorFor,
  } = useSettingsForm({
    action: createFaqAction,
    initialValues: { question: starter ?? "", answer: "" },
    dirtyKey: "faqs:create",
    clearOnSuccess: true,
  });

  const lastStatus = useRef<string>("idle");
  useEffect(() => {
    const sig = state.status;
    if (sig === lastStatus.current) return;
    lastStatus.current = sig;
    if (sig !== "success") return;
    onCreated(state.values?.id ?? "", state.message ?? "Added.");
  }, [state, onCreated]);

  return (
    <div className="flex flex-col gap-4 rounded-md border border-border p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-base font-semibold">Add a question</h3>
      </div>
      <form ref={formRef} action={formAction} className="flex flex-col gap-4">
        <FieldGroup title="Question and answer">
          <TextField
            label="Question"
            name="question"
            required
            maxLength={LIMITS.faqQuestion}
            showCount
            value={values.question}
            onValueChange={(value) => setField("question", value)}
            error={errorFor("question")}
            placeholder="Do we need a uniform for the first class?…"
          />
          <TextAreaField
            label="Answer"
            name="answer"
            required
            rows={5}
            maxLength={LIMITS.faqAnswer}
            value={values.answer}
            onValueChange={(value) => setField("answer", value)}
            error={errorFor("answer")}
            placeholder="No. Comfortable clothes are fine for the trial class…"
          />
        </FieldGroup>
        <SaveBar
          saveLabel="Add Question"
          savingLabel="Adding…"
          pending={pending}
          dirty={dirty}
          onDiscard={reset}
          onCancel={onCancel}
          state={state}
          idleHint="Your agent can use a new answer as soon as it is added."
          hideDiscard
        />
      </form>
    </div>
  );
}

function FaqEditor({
  faq,
  onCancel,
  onSaved,
  onRetainEdits,
}: {
  faq: FaqItem;
  onCancel: () => void;
  onSaved: (message: string) => void;
  onRetainEdits: (message: string) => void;
}) {
  const initialValues = useMemo(
    () => ({
      id: faq.id,
      expectedUpdatedAt: faq.updatedAt,
      question: faq.question,
      answer: faq.answer,
    }),
    [faq.id, faq.updatedAt, faq.question, faq.answer],
  );

  const {
    state,
    formAction,
    formRef,
    pending,
    values,
    setField,
    dirty,
    reset,
    errorFor,
  } = useSettingsForm({
    action: updateFaqAction,
    initialValues,
    dirtyKey: `faqs:edit:${faq.id}`,
    clearOnSuccess: false,
  });

  const lastStatus = useRef<string>("idle");
  useEffect(() => {
    const sig = state.status;
    if (sig === lastStatus.current) return;
    lastStatus.current = sig;
    if (sig !== "success") return;
    const savedValues = state.values ?? {};
    const typedDuringSave: string[] = [];
    const initialRecord = initialValues as Record<string, string>;
    const currentRecord = values as Record<string, string>;
    for (const field of Object.keys(currentRecord)) {
      const initial = initialRecord[field] ?? "";
      const current = currentRecord[field] ?? "";
      const saved = savedValues[field] ?? "";
      if (current !== initial && current !== saved) {
        typedDuringSave.push(field);
      }
    }
    if (typedDuringSave.length === 0) {
      onSaved(state.message ?? "Saved.");
    } else {
      onRetainEdits(
        state.message ??
          "Saved. Kept your in-flight edits — save again to confirm.",
      );
    }
  }, [state, values, initialValues, onSaved, onRetainEdits]);

  return (
    <div id={`faq-editor-${faq.id}`}>
      <div className="flex flex-col gap-4 rounded-md border border-border p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h3 className="text-base font-semibold">{`Edit question`}</h3>
        </div>
        <form ref={formRef} action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="id" value={faq.id} />
          <input type="hidden" name="expectedUpdatedAt" value={faq.updatedAt} />
          <FieldGroup title="Question and answer">
            <TextField
              label="Question"
              name="question"
              required
              maxLength={LIMITS.faqQuestion}
              showCount
              value={values.question}
              onValueChange={(value) => setField("question", value)}
              error={errorFor("question")}
            />
            <TextAreaField
              label="Answer"
              name="answer"
              required
              rows={5}
              maxLength={LIMITS.faqAnswer}
              value={values.answer}
              onValueChange={(value) => setField("answer", value)}
              error={errorFor("answer")}
            />
          </FieldGroup>
          <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row-reverse sm:items-center">
            <div className="flex shrink-0 gap-2">
              <Button
                type="submit"
                disabled={pending}
                aria-busy={pending || undefined}
              >
                {pending ? "Saving…" : "Save Changes"}
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={onCancel}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={reset}
                disabled={!dirty || pending}
              >
                Discard
              </Button>
            </div>
            <p
              role="status"
              aria-live="polite"
              aria-busy={pending || undefined}
              className={`min-w-0 flex-1 text-sm leading-relaxed text-pretty ${
                pending
                  ? "text-foreground"
                  : state.status === "error"
                    ? "text-destructive"
                    : dirty
                      ? "text-warning"
                      : state.status === "success"
                        ? "text-success"
                        : "text-muted-foreground"
              }`}
            >
              {pending
                ? "Saving…"
                : state.status === "error"
                  ? (state.message ?? "That did not save.")
                  : dirty
                    ? "Unsaved changes"
                    : state.status === "success"
                      ? (state.message ?? "Saved.")
                      : "Editing an existing question does not change its sort order or count."}
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
