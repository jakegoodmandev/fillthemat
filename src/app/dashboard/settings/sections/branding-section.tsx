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
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_18rem]">
      <form ref={formRef} action={formAction} className="flex flex-col gap-6">
        <Callout>
          Uploading files is not available yet. Host your logo somewhere public
          — your website, a storage bucket, a design tool — and paste the direct
          image address here.
        </Callout>

        <FieldGroup
          title="Logo and color"
          description="Families see these on the page where they book a trial class."
        >
          <TextField
            label="Logo image address"
            name="logoUrl"
            type="url"
            spellCheck={false}
            maxLength={LIMITS.logoUrl}
            value={values.logoUrl}
            onValueChange={(value) => setField("logoUrl", value)}
            error={errorFor("logoUrl")}
            helper="Must start with https:// and point straight at the image file, ending in .png, .jpg, or .svg."
            placeholder="https://example.com/logo.png…"
          />

          <div className="flex min-w-0 flex-col gap-1.5">
            <label
              htmlFor={hexId}
              className="text-sm font-medium text-zinc-200"
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
                className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-zinc-800 bg-zinc-950 p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/60"
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
            <p id={`${hexId}-helper`} className="text-xs text-zinc-400">
              A 6-digit hex color, such as #1E3A8A. Leave it blank to use the
              default dark accent.
            </p>
            {colorError ? (
              <p
                id={`${hexId}-error`}
                className="text-xs font-medium text-red-400"
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
          idleHint="Saved branding appears on your public page right away."
        />
      </form>

      <PreviewPanel
        title="Public page preview"
        dirty={dirty}
        note="Representative view of your booking page — spacing and colors on the live page may differ. Nothing here creates a booking."
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
