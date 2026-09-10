"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { idleSettingsActionState } from "../action-state";
import { updatePricingAction } from "../actions";
import { FormActions, useFocusFirstError } from "./action-status";
import { CharacterCount, Field } from "./field";
import { textareaClassName } from "./styles";
import { useSectionDirty } from "./unsaved-changes";

export function PricingForm({ pricing }: { pricing: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(
    updatePricingAction,
    idleSettingsActionState,
  );
  const [count, setCount] = useState(pricing.length);
  const { markDirty, markClean } = useSectionDirty();
  useFocusFirstError(state, formRef);

  useEffect(() => {
    if (state.status === "success") markClean();
  }, [state, markClean]);

  const error = state.fieldErrors.pricing;
  const describedBy = [
    error ? "pricing-error" : null,
    "pricing-hint",
    "pricing-count",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <form
      ref={formRef}
      action={formAction}
      autoComplete="off"
      className="flex max-w-2xl flex-col gap-4"
      onInput={markDirty}
      onReset={() => {
        markClean();
        setCount(pricing.length);
      }}
    >
      <Field
        id="pricing"
        label="Prices and conditions"
        hint="Add the prices and conditions your agent may share. It will not invent discounts. Put who can join in Offerings and class times in Schedule."
        error={error}
      >
        <textarea
          id="pricing"
          name="pricing"
          defaultValue={pricing}
          maxLength={4000}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={textareaClassName}
          placeholder="Drop-in trial $25. Family intro week $40 for two students…"
          onInput={(event) =>
            setCount((event.target as HTMLTextAreaElement).value.length)
          }
        />
        <CharacterCount id="pricing-count" count={count} max={4000} />
      </Field>
      <FormActions state={state} pending={pending} saveLabel="Save pricing" />
    </form>
  );
}
