"use client";

import { Button } from "@/components/ui/button";
import { updatePricingAction } from "../actions";
import { LIMITS } from "../schemas";
import { TextAreaField } from "../ui/controls";
import { SaveBar, useSettingsForm } from "../ui/section-form";

const EXAMPLE = `Trial class: free for first-time students.
Kids program: $120 per month, no sign-up fee.
Adults program: $140 per month, or $75 for four classes.
Uniform: $60, ordered after the first month.
Family discount: 10% off for each additional sibling.`;

export function PricingSection({ pricing }: { pricing: string }) {
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
    action: updatePricingAction,
    initialValues: { pricing },
    dirtyKey: "pricing:text",
  });

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-6">
      <TextAreaField
        label="Prices and conditions your agent may share"
        name="pricing"
        rows={10}
        maxLength={LIMITS.pricing}
        value={values.pricing}
        onValueChange={(value) => setField("pricing", value)}
        error={errorFor("pricing")}
        helper="Your agent shares only what you write here — nothing else, and it never invents a price. One line per price works well."
        placeholder="Trial class: free for first-time students…"
      />

      {values.pricing.trim().length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed p-4">
          <p className="text-sm font-medium text-foreground">
            Not sure what to include?
          </p>
          <pre className="max-w-full overflow-x-auto text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground">
            {EXAMPLE}
          </pre>
          <Button
            type="button"
            variant="outline"
            onClick={() => setField("pricing", EXAMPLE)}
          >
            Start From This Example
          </Button>
        </div>
      ) : null}

      <SaveBar
        saveLabel="Save Pricing"
        pending={pending}
        dirty={dirty}
        onDiscard={reset}
        state={state}
        idleHint="Saved pricing is available to your agent right away."
      />
    </form>
  );
}
