"use client";

import { updatePricingAction } from "../actions";
import { LIMITS } from "../schemas";
import { Callout, secondaryButtonClass, TextAreaField } from "../ui/controls";
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
      <Callout>
        Your agent shares only what you write here. It will not invent
        discounts, guess a price it cannot find, or promise a rate you have not
        listed. Anything you leave out, it says it does not know.
      </Callout>

      <TextAreaField
        label="Prices and conditions your agent may share"
        name="pricing"
        rows={10}
        maxLength={LIMITS.pricing}
        value={values.pricing}
        onValueChange={(value) => setField("pricing", value)}
        error={errorFor("pricing")}
        helper="Write it the way you would explain it to a parent at the front desk. One line per price works well."
        placeholder="Trial class: free for first-time students…"
      />

      {values.pricing.trim().length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-zinc-800 p-4">
          <p className="text-sm font-medium text-zinc-200">
            Not sure what to include?
          </p>
          <pre className="max-w-full overflow-x-auto text-xs leading-relaxed whitespace-pre-wrap text-zinc-400">
            {EXAMPLE}
          </pre>
          <button
            type="button"
            className={secondaryButtonClass}
            onClick={() => setField("pricing", EXAMPLE)}
          >
            Start From This Example
          </button>
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
