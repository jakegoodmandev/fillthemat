"use client";

import { useRef, useState } from "react";
import { createFaqAction, deleteFaqAction } from "../actions";
import { LIMITS } from "../schemas";
import {
  Callout,
  EmptyState,
  FieldGroup,
  quietButtonClass,
  secondaryButtonClass,
  TextAreaField,
  TextField,
} from "../ui/controls";
import { ItemActionForm, SaveBar, useSettingsForm } from "../ui/section-form";

export type FaqItem = {
  id: string;
  question: string;
  answer: string;
};

const STARTER_QUESTIONS = [
  "Do we need a uniform for the first class?",
  "Can a parent stay and watch?",
  "What happens if we need to reschedule?",
  "Is there a make-up class if we miss one?",
];

export function FaqsSection({ faqs }: { faqs: FaqItem[] }) {
  const [adding, setAdding] = useState(faqs.length === 0);
  const addRef = useRef<HTMLDivElement>(null);
  const atLimit = faqs.length >= LIMITS.faqCount;

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
    initialValues: { question: "", answer: "" },
    dirtyKey: "faqs:new",
    clearOnSuccess: true,
  });

  const openAddForm = (question?: string) => {
    setAdding(true);
    if (question) setField("question", question);
    requestAnimationFrame(() => {
      const selector = question ? "textarea" : "input";
      addRef.current?.querySelector<HTMLElement>(selector)?.focus();
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <Callout>
        Your agent uses these answers word for word as facts. Add the questions
        parents actually ask you, and answer only what you are happy for the
        agent to repeat.
      </Callout>

      <section className="flex flex-col gap-3" aria-labelledby="faq-list">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 id="faq-list" className="text-sm font-semibold text-zinc-100">
            Your questions
          </h3>
          <p className="text-xs text-zinc-500 tabular-nums">
            {faqs.length} of {LIMITS.faqCount} used
          </p>
        </div>

        {faqs.length === 0 ? (
          <EmptyState title="No questions yet">
            Without FAQs your agent still answers from your school details,
            trial classes, schedule, and pricing — it just says it does not know
            anything else.
          </EmptyState>
        ) : (
          <ul className="flex flex-col gap-3">
            {faqs.map((faq) => (
              <li
                key={faq.id}
                className="rounded-xl border border-zinc-900 bg-zinc-950/40 p-4"
              >
                <details className="group">
                  <summary className="flex cursor-pointer touch-manipulation list-none items-center justify-between gap-3 rounded-lg text-sm font-medium text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/70">
                    <span className="min-w-0 text-pretty">{faq.question}</span>
                    <span
                      aria-hidden="true"
                      className="shrink-0 text-xs text-zinc-500"
                    >
                      <span className="group-open:hidden">Show answer</span>
                      <span className="hidden group-open:inline">Hide</span>
                    </span>
                  </summary>
                  <p className="mt-3 max-w-prose text-sm leading-relaxed break-words text-zinc-400 whitespace-pre-wrap">
                    {faq.answer}
                  </p>
                </details>
                <div className="mt-3 flex justify-end">
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
                          cannot be undone — you would add the question again
                          from scratch.
                        </>
                      ),
                      confirmLabel: "Delete Question",
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {atLimit ? (
        <Callout tone="warning">
          You have reached the limit of {LIMITS.faqCount} questions. Delete one
          to make room for another.
        </Callout>
      ) : adding ? (
        <form ref={formRef} action={formAction} className="flex flex-col gap-6">
          <div ref={addRef}>
            <FieldGroup
              title="Add a question"
              description="Questions cannot be edited or reordered yet. To change an answer, delete the question and add it again."
            >
              <TextField
                label="Question"
                name="question"
                required
                maxLength={LIMITS.faqQuestion}
                showCount
                value={values.question}
                onValueChange={(value) => setField("question", value)}
                error={errorFor("question")}
                helper="Write it the way a parent would ask it."
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
                helper="Your agent treats this as a fact about your school."
                placeholder="No. Comfortable clothes are fine for the trial class…"
              />
            </FieldGroup>
          </div>

          <SaveBar
            saveLabel="Add Question"
            savingLabel="Adding…"
            pending={pending}
            dirty={dirty}
            onDiscard={reset}
            state={state}
            idleHint="Your agent can use a new answer as soon as it is added."
          />
        </form>
      ) : (
        <div className="flex flex-col gap-3">
          <button
            type="button"
            className={`${secondaryButtonClass} self-start`}
            onClick={() => openAddForm()}
          >
            Add a Question
          </button>
          <div className="flex flex-col gap-2">
            <p className="text-xs text-zinc-500">
              Common starting points — you write the answer:
            </p>
            <ul className="flex flex-wrap gap-x-4 gap-y-1">
              {STARTER_QUESTIONS.map((question) => (
                <li key={question}>
                  <button
                    type="button"
                    className={quietButtonClass}
                    onClick={() => openAddForm(question)}
                  >
                    {question}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
