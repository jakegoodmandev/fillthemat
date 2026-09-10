"use client";

import { Button } from "@/components/ui/button";
import { updateAgentAction } from "../actions";
import { LIMITS } from "../schemas";
import { Callout, FieldGroup, TextAreaField } from "../ui/controls";
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
        <FieldGroup title="Welcome message">
          <TextAreaField
            label="Welcome message"
            name="welcomeMessage"
            rows={4}
            maxLength={LIMITS.welcomeMessage}
            value={values.welcomeMessage}
            onValueChange={(value) => setField("welcomeMessage", value)}
            error={errorFor("welcomeMessage")}
            helper="The first thing a family sees. Greet them and say what your agent can help with. Leave blank to use a simple default greeting."
            placeholder="Hi! I can answer questions about our kids and adult classes and help you book a free trial…"
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
            helper="Plain sentences, one per line. Use these for tone and questions you approve — not facts. Facts belong in the other categories."
            placeholder="Sound warm and encouraging, and keep answers short…"
          />
          {values.agentInstructions.trim().length === 0 ? (
            <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed p-4">
              <p className="text-sm font-medium text-foreground">
                An example to start from
              </p>
              <pre className="max-w-full overflow-x-auto text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground">
                {EXAMPLE_INSTRUCTIONS}
              </pre>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setField("agentInstructions", EXAMPLE_INSTRUCTIONS)
                }
              >
                Start From This Example
              </Button>
            </div>
          ) : null}
        </FieldGroup>

        <Callout title="Fixed for every school">
          <ul className="list-disc pl-5">
            <li>Answers only from the information in these settings.</li>
            <li>
              Never invents prices or discounts, and only shares the pricing you
              wrote.
            </li>
            <li>
              Eligibility comes from the age ranges on your trial classes.
            </li>
            <li>
              Only offers real open class times, and never holds or promises a
              spot.
            </li>
            <li>
              Never takes payment, handles waivers, or confirms a booking itself
              — your booking form does that.
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
