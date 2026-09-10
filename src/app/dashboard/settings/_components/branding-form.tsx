"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { idleSettingsActionState } from "../action-state";
import { updateBrandingAction } from "../actions";
import { FormActions, useFocusFirstError } from "./action-status";
import { AppearancePreview, PreviewSwitch } from "./appearance-preview";
import { Field, TextField } from "./field";
import { inputClassName } from "./styles";
import { useSectionDirty, useUnsavedChanges } from "./unsaved-changes";

export function BrandingForm({
  schoolName,
  location,
  welcomeMessage,
  logoUrl,
  primaryColor,
}: {
  schoolName: string;
  location: string | null;
  welcomeMessage: string;
  logoUrl: string;
  primaryColor: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(
    updateBrandingAction,
    idleSettingsActionState,
  );
  const [logoDraft, setLogoDraft] = useState(logoUrl);
  const [colorDraft, setColorDraft] = useState(primaryColor);
  const { markDirty, markClean } = useSectionDirty();
  const { dirty } = useUnsavedChanges();
  useFocusFirstError(state, formRef);

  useEffect(() => {
    if (state.status === "success") markClean();
  }, [state, markClean]);

  const pickerValue = /^#[0-9A-Fa-f]{6}$/.test(colorDraft)
    ? colorDraft
    : "#111111";

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)] lg:items-start">
      <form
        ref={formRef}
        action={formAction}
        autoComplete="off"
        className="flex min-w-0 max-w-2xl flex-col gap-6"
        onInput={markDirty}
        onReset={() => {
          markClean();
          setLogoDraft(logoUrl);
          setColorDraft(primaryColor);
        }}
      >
        <TextField
          id="logoUrl"
          name="logoUrl"
          type="url"
          label="Logo URL"
          hint="Paste an HTTPS link to your logo. Uploading files is not available yet."
          defaultValue={logoUrl}
          maxLength={2048}
          spellCheck={false}
          autoComplete="url"
          placeholder="https://www.yourschool.com/logo.png…"
          error={state.fieldErrors.logoUrl}
          onInput={(event) =>
            setLogoDraft((event.currentTarget as HTMLInputElement).value)
          }
        />
        <Field
          id="primaryColor"
          label="Primary color"
          hint="Used as an accent on your trial-booking page. 6-digit hex only."
          error={state.fieldErrors.primaryColor}
        >
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="color"
              value={pickerValue}
              aria-label="Pick a color"
              className="h-11 w-14 cursor-pointer rounded-md border border-zinc-700 bg-zinc-950 p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-100/80 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
              onChange={(event) => {
                const next = event.target.value.toUpperCase();
                setColorDraft(next);
                markDirty();
                const hex = formRef.current?.elements.namedItem(
                  "primaryColor",
                ) as HTMLInputElement | null;
                if (hex) hex.value = next;
              }}
            />
            <input
              id="primaryColor"
              name="primaryColor"
              value={colorDraft}
              spellCheck={false}
              autoComplete="off"
              maxLength={7}
              placeholder="#123456…"
              aria-invalid={state.fieldErrors.primaryColor ? true : undefined}
              aria-describedby={
                state.fieldErrors.primaryColor
                  ? "primaryColor-error primaryColor-hint"
                  : "primaryColor-hint"
              }
              className={`${inputClassName} max-w-40 font-mono`}
              onChange={(event) => {
                setColorDraft(event.target.value);
                markDirty();
              }}
            />
          </div>
        </Field>
        <FormActions
          state={state}
          pending={pending}
          saveLabel="Save branding"
        />
      </form>
      <PreviewSwitch>
        <AppearancePreview
          schoolName={schoolName}
          location={location}
          logoUrl={logoDraft}
          primaryColor={colorDraft}
          welcomeMessage={welcomeMessage}
          saved={!dirty}
        />
      </PreviewSwitch>
    </div>
  );
}
