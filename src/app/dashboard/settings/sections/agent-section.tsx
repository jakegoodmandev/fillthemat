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
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <form ref={formRef} action={formAction} className="flex flex-col gap-6">
        <FieldGroup title="Welcome message">
          <TextAreaField
            label="Welcome message"
            name="welcomeMessage"
            rows={4}
            maxLength={LIMITS.welcomeMessage}
            value={values.welcomeMessage}
            onValueChange={(value) => setField("welcomeMessage", value)}
            error={errorFor("welcomeMessage")}
            helper="First message families see on your booking page."
            placeholder="Hi! I can answer questions about our classes and help you book a free trial…"
          />
        </FieldGroup>

        <FieldGroup title="Tone and qualification questions">
          <TextAreaField
            label="Instructions for your agent"
            name="agentInstructions"
            rows={8}
            maxLength={LIMITS.agentInstructions}
            value={values.agentInstructions}
            onValueChange={(value) => setField("agentInstructions", value)}
            error={errorFor("agentInstructions")}
            helper="Tone and qualification questions (one per line). Facts belong in other settings."
            placeholder="Sound warm and encouraging, and keep answers short…"
          />
          {values.agentInstructions.trim().length === 0 ? (
            <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-border p-4">
              <p className="text-sm font-medium text-foreground">
                Example instructions:
              </p>
              <pre className="max-w-full overflow-x-auto text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground">
                {EXAMPLE_INSTRUCTIONS}
              </pre>
              <button
                type="button"
                className={secondaryButtonClass}
                onClick={() =>
                  setField("agentInstructions", EXAMPLE_INSTRUCTIONS)
                }
              >
                Start From Example
              </button>
            </div>
          ) : null}
        </FieldGroup>

        <Callout title="Fixed safeguards">
          <ul className="list-disc pl-5 text-xs space-y-1">
            <li>Answers only from your provided settings.</li>
            <li>Never invents prices or discounts.</li>
            <li>Eligibility derived strictly from trial class age ranges.</li>
            <li>Only offers real open class times from your schedule.</li>
          </ul>
        </Callout>

        <SaveBar
          saveLabel="Save Agent Settings"
          pending={pending}
          dirty={dirty}
          onDiscard={reset}
          state={state}
          idleHint="Saved changes take effect immediately."
        />
      </form>

      <PreviewPanel
        title="Welcome preview"
        dirty={dirty}
        note="Representative view of your page."
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
