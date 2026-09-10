"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { idleSettingsActionState } from "../action-state";
import { createFaqAction, deleteFaqAction } from "../actions";
import type { SettingsFaq } from "../load";
import { FormActions, useFocusFirstError } from "./action-status";
import { ConfirmDelete } from "./confirm-delete";
import { TextAreaField, TextField } from "./field";
import { ghostButtonClassName, secondaryButtonClassName } from "./styles";
import { useSectionDirty } from "./unsaved-changes";

const STARTER_QUESTIONS = [
  "Do I need experience?",
  "What should my child wear?",
  "Can my 7-year-old join?",
  "Where should I park?",
];

function FaqItem({ faq }: { faq: SettingsFaq }) {
  const panelId = useId();
  const [open, setOpen] = useState(false);
  return (
    <article className="rounded-xl border border-zinc-800">
      <h3>
        <button
          type="button"
          className="flex min-h-11 w-full touch-manipulation items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-100/80 focus-visible:ring-inset"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((value) => !value)}
        >
          <span className="min-w-0 break-words">{faq.question}</span>
          <span className="shrink-0 text-zinc-500">
            {open ? "Hide" : "Show"}
          </span>
        </button>
      </h3>
      {open ? (
        <div
          id={panelId}
          className="flex flex-col gap-3 border-t border-zinc-800 px-4 py-3"
        >
          <p className="whitespace-pre-wrap text-pretty text-sm break-words text-zinc-300">
            {faq.answer}
          </p>
          <ConfirmDelete
            action={deleteFaqAction}
            id={faq.id}
            label="Delete FAQ"
            description="Delete this question and answer? This cannot be undone."
          />
        </div>
      ) : null}
    </article>
  );
}

function AddFaqForm({
  openByDefault,
  atLimit,
}: {
  openByDefault: boolean;
  atLimit: boolean;
}) {
  const [open, setOpen] = useState(openByDefault);
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(
    createFaqAction,
    idleSettingsActionState,
  );
  const { markDirty, markClean } = useSectionDirty();
  useFocusFirstError(state, formRef);

  useEffect(() => {
    if (state.status === "success") {
      markClean();
      formRef.current?.reset();
      if (!openByDefault) setOpen(false);
    }
  }, [state, markClean, openByDefault]);

  if (atLimit) {
    return (
      <p className="text-pretty text-sm text-zinc-400">
        You have 20 FAQs, the maximum. Delete one to add another.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        className={secondaryButtonClassName}
        onClick={() => setOpen(true)}
      >
        Add an FAQ
      </button>
    );
  }

  const errors = state.fieldErrors;
  return (
    <form
      ref={formRef}
      action={formAction}
      autoComplete="off"
      className="flex flex-col gap-4 rounded-xl border border-zinc-800 p-4"
      onInput={markDirty}
      onReset={() => {
        markClean();
        if (!openByDefault) setOpen(false);
      }}
    >
      <h3 className="text-sm font-medium text-zinc-200">Add an FAQ</h3>
      <p className="text-pretty text-sm text-zinc-400">
        Write answers in your own words. FAQs cannot be edited after you add
        them — delete and create a new one to change an answer.
      </p>
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-zinc-200">Starter questions</p>
        <p className="text-pretty text-sm text-zinc-400">
          Optional starting points. They fill the question field only — you
          still write the answer.
        </p>
        <div className="flex flex-wrap gap-2">
          {STARTER_QUESTIONS.map((question) => (
            <button
              key={question}
              type="button"
              className={ghostButtonClassName}
              onClick={() => {
                const input = formRef.current?.elements.namedItem(
                  "question",
                ) as HTMLInputElement | null;
                if (!input) return;
                input.value = question;
                input.dispatchEvent(new Event("input", { bubbles: true }));
                input.focus();
              }}
            >
              {question}
            </button>
          ))}
        </div>
      </div>
      <TextField
        id="faq-question"
        name="question"
        label="Question"
        required
        maxLength={200}
        placeholder="Do I need experience?…"
        error={errors.question}
      />
      <TextAreaField
        id="faq-answer"
        name="answer"
        label="Answer"
        required
        maxLength={2000}
        placeholder="No. We will meet students where they are…"
        error={errors.answer}
      />
      <FormActions state={state} pending={pending} saveLabel="Add FAQ" />
    </form>
  );
}

export function FaqsPanel({ faqs }: { faqs: SettingsFaq[] }) {
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      {faqs.length === 0 ? (
        <p className="text-pretty text-sm text-zinc-400">
          No FAQs yet. Add the questions parents already ask — your agent uses
          these answers instead of guessing.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {faqs.map((faq) => (
            <li key={faq.id}>
              <FaqItem faq={faq} />
            </li>
          ))}
        </ul>
      )}
      <AddFaqForm
        openByDefault={faqs.length === 0}
        atLimit={faqs.length >= 20}
      />
    </div>
  );
}
