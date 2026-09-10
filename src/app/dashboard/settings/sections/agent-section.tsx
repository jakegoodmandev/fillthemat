"use client";

import { updateAgentAction } from "../actions";
import { LIMITS } from "../schemas";
import {
  Callout,
  FieldGroup,
  secondaryButtonClass,
  TextAreaField,
} from "../ui/controls";
import { PreviewPanel } from "../ui/preview-panel";
import { PublicPagePreview } from "../ui/public-page-preview";
import { SaveBar, useSettingsForm } from "../ui/section-form";

const EXAMPLE_INSTRUCTIONS = `Sound warm and encouraging, and keep answers short.
Call students by their first name once you know it.
Before booking, ask whether the student has any previous martial arts experience.
Ask whether there are injuries or conditions our instructors should know about.
Mention that parents are welcome to watch from the benches.`;

export function AgentSection({
  welcomeMessage,
  agentInstructions,
  schoolName,
  location,
  logoUrl,
  primaryColor,
}: {
  welcomeMessage: string;
  agentInstructions: string;
  schoolName: string;
  location: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
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
    action: updateAgentAction,
    initialValues: { welcomeMessage, agentInstructions },
    dirtyKey: "agent:settings",
  });

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_18rem]">
      <form ref={formRef} action={formAction} className="flex flex-col gap-6">
        <FieldGroup
          title="Welcome message"
          description="The first thing a family sees when they open your booking page."
        >
          <TextAreaField
            label="Welcome message"
            name="welcomeMessage"
            rows={4}
            maxLength={LIMITS.welcomeMessage}
            value={values.welcomeMessage}
            onValueChange={(value) => setField("welcomeMessage", value)}
            error={errorFor("welcomeMessage")}
            helper="Greet the family and say what your agent can help with. Leave it blank to use a simple default greeting."
            placeholder="Hi! I can answer questions about our kids and adult classes and help you book a free trial…"
          />
        </FieldGroup>

        <FieldGroup
          title="Tone and qualification questions"
          description="How your agent should sound, and what it is allowed to ask a family before they book."
        >
          <TextAreaField
            label="Instructions for your agent"
            name="agentInstructions"
            rows={8}
            maxLength={LIMITS.agentInstructions}
            value={values.agentInstructions}
            onValueChange={(value) => setField("agentInstructions", value)}
            error={errorFor("agentInstructions")}
            helper="Write plain sentences, one per line. Your agent uses this for tone and for questions you approve — not for facts. Facts belong in the other categories."
            placeholder="Sound warm and encouraging, and keep answers short…"
          />
          {values.agentInstructions.trim().length === 0 ? (
            <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-zinc-800 p-4">
              <p className="text-sm font-medium text-zinc-200">
                An example to start from
              </p>
              <pre className="max-w-full overflow-x-auto text-xs leading-relaxed whitespace-pre-wrap text-zinc-400">
                {EXAMPLE_INSTRUCTIONS}
              </pre>
              <button
                type="button"
                className={secondaryButtonClass}
                onClick={() =>
                  setField("agentInstructions", EXAMPLE_INSTRUCTIONS)
                }
              >
                Start From This Example
              </button>
            </div>
          ) : null}
        </FieldGroup>

        <Callout title="What you can and cannot change">
          <p>You can shape:</p>
          <ul className="mt-1 list-disc pl-5">
            <li>How your agent sounds — warm, brief, formal.</li>
            <li>
              Extra questions it may ask before booking, such as previous
              experience or injuries to know about.
            </li>
          </ul>
          <p className="mt-3">
            These rules apply to every school and cannot be changed here:
          </p>
          <ul className="mt-1 list-disc pl-5">
            <li>It answers only from the information in these settings.</li>
            <li>
              It never invents prices or discounts, and only shares the pricing
              you wrote.
            </li>
            <li>
              Eligibility comes from the age ranges on your trial classes.
            </li>
            <li>
              It only offers real open class times, and never holds or promises
              a spot.
            </li>
            <li>
              It never takes payment, handles waivers, or confirms a booking
              itself — your booking form does that.
            </li>
          </ul>
        </Callout>

        <SaveBar
          saveLabel="Save Agent Settings"
          pending={pending}
          dirty={dirty}
          onDiscard={reset}
          state={state}
          idleHint="Saved changes apply to the next conversation a family starts."
        />
      </form>

      <PreviewPanel
        title="Welcome preview"
        dirty={dirty}
        note="Representative view of your booking page. It shows your welcome message, not what your agent will answer next."
      >
        <PublicPagePreview
          schoolName={schoolName}
          location={location}
          logoUrl={logoUrl ?? undefined}
          accentColor={primaryColor ?? undefined}
          welcomeMessage={values.welcomeMessage}
        />
      </PreviewPanel>
    </div>
  );
}
