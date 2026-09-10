"use client";

import { useId } from "react";
import { updateBrandingAction } from "../actions";
import { LIMITS } from "../schemas";
import {
  Callout,
  FieldGroup,
  inputClass,
  invalidInputClass,
  TextField,
} from "../ui/controls";
import { PreviewPanel } from "../ui/preview-panel";
import { PublicPagePreview } from "../ui/public-page-preview";
import { SaveBar, useSettingsForm } from "../ui/section-form";

export function BrandingSection({
  logoUrl,
  primaryColor,
  schoolName,
  location,
  welcomeMessage,
}: {
  logoUrl: string;
  primaryColor: string;
  schoolName: string;
  location: string | null;
  welcomeMessage: string;
}) {
  const hexId = useId();
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
    action: updateBrandingAction,
    initialValues: { logoUrl, primaryColor },
    dirtyKey: "branding:settings",
  });

  const colorError = errorFor("primaryColor");
  const pickerValue = /^#[0-9A-Fa-f]{6}$/.test(values.primaryColor)
    ? values.primaryColor
    : "#111111";

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <form ref={formRef} action={formAction} className="flex flex-col gap-6">
        <Callout>
          Paste a direct image URL (https://) for your logo. File upload is not
          yet available.
        </Callout>

        <FieldGroup title="Logo and color">
          <TextField
            label="Logo image address"
            name="logoUrl"
            type="url"
            spellCheck={false}
            maxLength={LIMITS.logoUrl}
            value={values.logoUrl}
            onValueChange={(value) => setField("logoUrl", value)}
            error={errorFor("logoUrl")}
            helper="Direct HTTPS image link (.png, .jpg, .svg)."
            placeholder="https://example.com/logo.png…"
          />

          <div className="flex min-w-0 flex-col gap-1.5">
            <label
              htmlFor={hexId}
              className="text-sm font-medium text-foreground"
            >
              Accent color
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                aria-label="Choose accent color with a color picker"
                value={pickerValue}
                onChange={(event) =>
                  setField("primaryColor", event.target.value.toUpperCase())
                }
                className="h-9 w-12 shrink-0 cursor-pointer rounded-md border border-input bg-background p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <input
                id={hexId}
                name="primaryColor"
                value={values.primaryColor}
                onChange={(event) =>
                  setField("primaryColor", event.target.value)
                }
                spellCheck={false}
                autoComplete="off"
                maxLength={7}
                placeholder="#1E3A8A…"
                aria-describedby={`${hexId}-helper${colorError ? ` ${hexId}-error` : ""}`}
                aria-invalid={colorError ? true : undefined}
                className={`${inputClass} font-mono uppercase ${colorError ? invalidInputClass : ""}`}
              />
            </div>
            <p id={`${hexId}-helper`} className="text-xs text-muted-foreground">
              6-digit hex color, e.g. #1E3A8A.
            </p>
            {colorError ? (
              <p
                id={`${hexId}-error`}
                className="text-xs font-medium text-destructive"
              >
                {colorError}
              </p>
            ) : null}
          </div>
        </FieldGroup>

        <SaveBar
          saveLabel="Save Branding"
          pending={pending}
          dirty={dirty}
          onDiscard={reset}
          state={state}
          idleHint="Saved branding takes effect immediately."
        />
      </form>

      <PreviewPanel
        title="Public page preview"
        dirty={dirty}
        note="Representative view of your page."
      >
        <PublicPagePreview
          schoolName={schoolName}
          location={location}
          logoUrl={values.logoUrl}
          accentColor={values.primaryColor}
          welcomeMessage={welcomeMessage}
        />
      </PreviewPanel>
    </div>
  );
}
