"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { idleSettingsActionState } from "../action-state";
import { updateAgentAction } from "../actions";
import { FormActions, useFocusFirstError } from "./action-status";
import { AppearancePreview, PreviewSwitch } from "./appearance-preview";
import { CharacterCount, Field } from "./field";
import { ghostButtonClassName, textareaClassName } from "./styles";
import { useSectionDirty, useUnsavedChanges } from "./unsaved-changes";

const WELCOME_EXAMPLE =
  "Hi — thanks for reaching out. I can help you find a trial class that fits.";
const TONE_EXAMPLE =
  "Keep answers warm and concise. You may ask the student’s age and whether they have any injuries that would affect a trial class.";

function CountedArea({
  id,
  name,
  label,
  hint,
  error,
  defaultValue,
  maxLength,
  placeholder,
}: {
  id: string;
  name: string;
  label: string;
  hint: string;
  error?: string;
  defaultValue: string;
  maxLength: number;
  placeholder: string;
}) {
  const [count, setCount] = useState(defaultValue.length);
  const describedBy = [
    error ? `${id}-error` : null,
    `${id}-hint`,
    `${id}-count`,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <Field id={id} label={label} hint={hint} error={error}>
      <textarea
        id={id}
        name={name}
        defaultValue={defaultValue}
        maxLength={maxLength}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={textareaClassName}
        onInput={(event) =>
          setCount((event.currentTarget as HTMLTextAreaElement).value.length)
        }
      />
      <CharacterCount id={`${id}-count`} count={count} max={maxLength} />
    </Field>
  );
}

export function AgentForm({
  schoolName,
  location,
  logoUrl,
  primaryColor,
  welcomeMessage,
  agentInstructions,
}: {
  schoolName: string;
  location: string | null;
  logoUrl: string;
  primaryColor: string;
  welcomeMessage: string;
  agentInstructions: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(
    updateAgentAction,
    idleSettingsActionState,
  );
  const [welcomeDraft, setWelcomeDraft] = useState(welcomeMessage);
  const { markDirty, markClean } = useSectionDirty();
  const { dirty } = useUnsavedChanges();
  useFocusFirstError(state, formRef);

  useEffect(() => {
    if (state.status === "success") markClean();
  }, [state, markClean]);

  const fill = (field: string, value: string) => {
    const el = formRef.current?.elements.namedItem(
      field,
    ) as HTMLTextAreaElement | null;
    if (!el) return;
    el.value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.focus();
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)] lg:items-start">
      <form
        ref={formRef}
        action={formAction}
        autoComplete="off"
        className="flex min-w-0 max-w-2xl flex-col gap-8"
        onInput={(event) => {
          markDirty();
          const target = event.target as HTMLTextAreaElement;
          if (target.name === "welcomeMessage") setWelcomeDraft(target.value);
        }}
        onReset={() => {
          markClean();
          setWelcomeDraft(welcomeMessage);
        }}
      >
        <section className="flex flex-col gap-4">
          <h3 className="text-sm font-medium text-zinc-200">Welcome message</h3>
          <p className="text-pretty text-sm text-zinc-400">
            Shown at the start of the chat. Your agent uses this as opening
            context; it may not quote it word for word later.
          </p>
          <button
            type="button"
            className={ghostButtonClassName}
            onClick={() => fill("welcomeMessage", WELCOME_EXAMPLE)}
          >
            Insert an example
          </button>
          <CountedArea
            id="welcomeMessage"
            name="welcomeMessage"
            label="Welcome message"
            hint="Up to 1,000 characters."
            defaultValue={welcomeMessage}
            maxLength={1000}
            placeholder={`${WELCOME_EXAMPLE}…`}
            error={state.fieldErrors.welcomeMessage}
          />
        </section>

        <section className="flex flex-col gap-4">
          <h3 className="text-sm font-medium text-zinc-200">
            Tone and qualification
          </h3>
          <p className="text-pretty text-sm text-zinc-400">
            Owner notes may set tone and the qualification questions you
            approve. They cannot override the rules below.
          </p>
          <ul className="list-disc space-y-1 pl-5 text-pretty text-sm text-zinc-400">
            <li>Who can join is decided only by age ranges in Offerings.</li>
            <li>Open times come only from Schedule.</li>
            <li>Prices come only from Pricing — no invented discounts.</li>
            <li>Your agent cannot take payment or collect a waiver.</li>
            <li>
              Your agent cannot create a booking; parents confirm that
              themselves.
            </li>
            <li>It will not ask for birthdates, IDs, or medical diagnoses.</li>
          </ul>
          <button
            type="button"
            className={ghostButtonClassName}
            onClick={() => fill("agentInstructions", TONE_EXAMPLE)}
          >
            Insert an example
          </button>
          <CountedArea
            id="agentInstructions"
            name="agentInstructions"
            label="Tone and qualification notes"
            hint="Up to 2,000 characters. Do not paste eligibility, times, or prices here."
            defaultValue={agentInstructions}
            maxLength={2000}
            placeholder={`${TONE_EXAMPLE}…`}
            error={state.fieldErrors.agentInstructions}
          />
        </section>

        <FormActions state={state} pending={pending} saveLabel="Save agent" />
      </form>
      <PreviewSwitch>
        <AppearancePreview
          schoolName={schoolName}
          location={location}
          logoUrl={logoUrl}
          primaryColor={primaryColor}
          welcomeMessage={welcomeDraft}
          saved={!dirty}
        />
      </PreviewSwitch>
    </div>
  );
}
