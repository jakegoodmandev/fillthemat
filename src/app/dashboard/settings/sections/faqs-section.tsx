"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
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
import { createFaqAction, deleteFaqAction, updateFaqAction } from "../actions";
import { LIMITS } from "../schemas";
import {
  Callout,
  EmptyState,
  FieldGroup,
  TextAreaField,
  TextField,
} from "../ui/controls";
import {
  RecordEditPanel,
  type RecordForm,
  type SaveResult,
} from "../ui/record-editor";
import { ItemActionForm } from "../ui/section-form";

export type FaqItem = {
  id: string;
  question: string;
  answer: string;
  updatedAt: string;
};

const STARTER_QUESTIONS = [
  "Do we need a uniform for the first class?",
  "Can a parent stay and watch?",
  "What happens if we need to reschedule?",
  "Is there a make-up class if we miss one?",
];

function faqFields(item: FaqItem): Record<string, string> {
  return { question: item.question, answer: item.answer };
}

type EditorTarget =
  | { mode: "create"; starter?: string }
  | { mode: "edit"; faq: FaqItem };

export function FaqsSection({ faqs }: { faqs: FaqItem[] }) {
  const router = useRouter();
  const [editor, setEditor] = useState<EditorTarget | null>(
    faqs.length === 0 ? { mode: "create" } : null,
  );
  const [editorDirty, setEditorDirty] = useState(false);
  const [announcement, setAnnouncement] = useState<string | null>(null);
  const [pendingSwitch, setPendingSwitch] = useState<EditorTarget | null>(null);
  const [focusRowId, setFocusRowId] = useState<string | null>(null);
  const editButtons = useRef(new Map<string, HTMLButtonElement>());
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const atLimit = faqs.length >= LIMITS.faqCount;
  const editingId = editor?.mode === "edit" ? editor.faq.id : null;

  const openEditor = useCallback(
    (target: EditorTarget) => {
      if (editorDirty) {
        setPendingSwitch(target);
        return;
      }
      setAnnouncement(null);
      setEditor(target);
    },
    [editorDirty],
  );

  const applySwitch = useCallback((target: EditorTarget) => {
    setAnnouncement(null);
    setEditor(target);
    setPendingSwitch(null);
  }, []);

  const closeEditor = useCallback(() => {
    setEditor(null);
    setEditorDirty(false);
  }, []);

  useEffect(() => {
    if (focusRowId && faqs.some((faq) => faq.id === focusRowId)) {
      const id = focusRowId;
      setFocusRowId(null);
      requestAnimationFrame(() => {
        editButtons.current.get(id)?.focus();
      });
    }
  }, [faqs, focusRowId]);

  const handleResult = useCallback(
    (result: SaveResult) => {
      if (result.status === "error") return;
      setAnnouncement(result.state.message);
      const newId = result.state.values?.id ?? "";

      if (editor?.mode === "edit") {
        if (result.typedDuringSave.length === 0) {
          const rowId = editor.faq.id;
          closeEditor();
          requestAnimationFrame(() => {
            editButtons.current.get(rowId)?.focus();
          });
        }
        return;
      }

      if (result.typedDuringSave.length === 0) {
        closeEditor();
        if (newId) {
          setFocusRowId(newId);
        } else {
          requestAnimationFrame(() => {
            addButtonRef.current?.focus();
          });
        }
      }
    },
    [editor, closeEditor],
  );

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
          <EmptyState title="No questions yet">
            Without FAQs your agent still answers from school details, trial
            classes, schedule, and pricing.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-border border-y border-border">
            {faqs.map((faq) => {
              const isEditingThis = editingId === faq.id;
              return (
                <li key={faq.id} className="py-3">
                  <details className="group">
                    <summary className="flex cursor-pointer touch-manipulation list-none items-center justify-between gap-3 rounded-md text-sm font-medium">
                      <span className="min-w-0 text-pretty">
                        {faq.question}
                      </span>
                      <span
                        aria-hidden="true"
                        className="shrink-0 text-xs text-muted-foreground"
                      >
                        <span className="group-open:hidden">Show answer</span>
                        <span className="hidden group-open:inline">Hide</span>
                      </span>
                    </summary>
                    <p className="mt-2 max-w-prose text-sm leading-relaxed break-words text-muted-foreground whitespace-pre-wrap">
                      {faq.answer}
                    </p>
                  </details>
                  <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isEditingThis}
                      ref={(node) => {
                        if (node) editButtons.current.set(faq.id, node);
                        else editButtons.current.delete(faq.id);
                      }}
                      onClick={() => openEditor({ mode: "edit", faq })}
                    >
                      Edit
                    </Button>
                    <ItemActionForm
                      action={deleteFaqAction}
                      id={faq.id}
                      label="Delete"
                      pendingLabel="Deleting…"
                      variant="danger"
                      disabled={isEditingThis}
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
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p aria-live="polite" role="status" className="text-sm text-success">
        {announcement ?? ""}
      </p>

      {atLimit ? (
        <Callout tone="warning">
          You have reached the limit of {LIMITS.faqCount} questions. Delete one
          to make room for another — editing existing questions still works.
        </Callout>
      ) : editor ? (
        <RecordEditPanel
          key={
            editor.mode === "edit"
              ? editor.faq.id
              : `create:${editor.starter ?? ""}`
          }
          action={editor.mode === "edit" ? updateFaqAction : createFaqAction}
          initialValues={
            editor.mode === "edit"
              ? faqFields(editor.faq)
              : { question: editor.starter ?? "", answer: "" }
          }
          dirtyKey={
            editor.mode === "edit" ? `faqs:${editor.faq.id}` : "faqs:new"
          }
          heading={editor.mode === "edit" ? "Edit question" : "Add a question"}
          saveLabel={editor.mode === "edit" ? "Save Changes" : "Add Question"}
          savingLabel={editor.mode === "edit" ? "Saving…" : "Adding…"}
          onCancel={() => {
            if (editor.mode === "edit") {
              const rowId = editor.faq.id;
              closeEditor();
              requestAnimationFrame(() => {
                editButtons.current.get(rowId)?.focus();
              });
            } else {
              closeEditor();
              requestAnimationFrame(() => {
                addButtonRef.current?.focus();
              });
            }
          }}
          onResult={handleResult}
          onDirtyChange={setEditorDirty}
          onReload={() => {
            const id = editingId;
            closeEditor();
            router.refresh();
            requestAnimationFrame(() => {
              if (id) editButtons.current.get(id)?.focus();
            });
          }}
          renderFields={(form) => (
            <FaqFields
              form={form}
              mode={editor.mode}
              faq={editor.mode === "edit" ? editor.faq : undefined}
            />
          )}
        />
      ) : (
        <div className="flex flex-col gap-3">
          <Button
            type="button"
            variant="outline"
            className="self-start"
            ref={addButtonRef}
            onClick={() => openEditor({ mode: "create" })}
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
                    onClick={() =>
                      openEditor({ mode: "create", starter: question })
                    }
                  >
                    {question}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <AlertDialog
        open={pendingSwitch !== null}
        onOpenChange={(open) => {
          if (!open) setPendingSwitch(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave without saving?</AlertDialogTitle>
            <AlertDialogDescription>
              You have changes that have not been saved yet. Switching now
              discards those edits.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Editing</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (pendingSwitch) applySwitch(pendingSwitch);
              }}
            >
              Discard Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function FaqFields({
  form,
  mode,
  faq,
}: {
  form: RecordForm;
  mode: "create" | "edit";
  faq?: FaqItem;
}) {
  return (
    <>
      {mode === "edit" && faq ? (
        <>
          <input type="hidden" name="id" value={faq.id} />
          <input type="hidden" name="updatedAt" value={faq.updatedAt} />
        </>
      ) : null}
      <FieldGroup title={mode === "edit" ? "Edit question" : "Add a question"}>
        <Callout>
          {mode === "edit"
            ? "You are editing the live answer your agent may share."
            : "Questions cannot be reordered, but you can edit an answer anytime."}
        </Callout>
        <TextField
          label="Question"
          name="question"
          required
          maxLength={LIMITS.faqQuestion}
          showCount
          value={form.values.question}
          onValueChange={(value) => form.setField("question", value)}
          error={form.errorFor("question")}
          placeholder="Do we need a uniform for the first class?…"
        />
        <TextAreaField
          label="Answer"
          name="answer"
          required
          rows={5}
          maxLength={LIMITS.faqAnswer}
          value={form.values.answer}
          onValueChange={(value) => form.setField("answer", value)}
          error={form.errorFor("answer")}
          placeholder="No. Comfortable clothes are fine for the trial class…"
        />
      </FieldGroup>
    </>
  );
}
