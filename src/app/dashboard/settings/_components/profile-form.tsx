"use client";

import { useActionState, useEffect, useRef } from "react";
import { idleSettingsActionState } from "../action-state";
import { updateProfileAction } from "../actions";
import { FormActions, useFocusFirstError } from "./action-status";
import { SelectField, TextAreaField, TextField } from "./field";
import { useSectionDirty } from "./unsaved-changes";

export function ProfileForm({
  school,
  timezones,
}: {
  school: {
    name: string;
    slug: string;
    timezone: string;
    notificationEmail: string;
    phone: string;
    website: string;
    address: string;
    city: string;
    country: string;
    parkingNotes: string;
    accessNotes: string;
    trialGuidance: string;
    published: boolean;
  };
  timezones: string[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(
    updateProfileAction,
    idleSettingsActionState,
  );
  const { markDirty, markClean } = useSectionDirty();
  useFocusFirstError(state, formRef);

  useEffect(() => {
    if (state.status === "success") markClean();
  }, [state, markClean]);

  const errors = state.fieldErrors;

  return (
    <form
      ref={formRef}
      action={formAction}
      autoComplete="off"
      className="flex max-w-2xl flex-col gap-8"
      onInput={markDirty}
      onReset={() => markClean()}
    >
      <section className="flex flex-col gap-4">
        <h3 className="text-sm font-medium text-zinc-200">School details</h3>
        <TextField
          id="name"
          name="name"
          label="School name"
          hint="Parents see this on your trial-booking page and in messages from your agent."
          defaultValue={school.name}
          required
          maxLength={80}
          autoComplete="organization"
          error={errors.name}
        />
        <TextField
          id="slug"
          name="slug"
          label="Public URL"
          hint={
            school.published
              ? "This URL is locked after you publish so existing links keep working."
              : "Lowercase letters, numbers, and hyphens. This becomes /s/your-url."
          }
          defaultValue={school.slug}
          required={!school.published}
          disabled={school.published}
          minLength={3}
          maxLength={48}
          spellCheck={false}
          autoComplete="off"
          error={errors.slug}
        />
        <SelectField
          id="timezone"
          name="timezone"
          label="Timezone"
          hint={
            school.published
              ? "Timezone is locked after you publish so class times stay consistent for booked students."
              : "Class times are shown to parents in this timezone."
          }
          defaultValue={school.timezone}
          disabled={school.published}
          error={errors.timezone}
        >
          {timezones.map((zone) => (
            <option key={zone} value={zone}>
              {zone}
            </option>
          ))}
        </SelectField>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-medium text-zinc-200">
            Contact and location
          </h3>
          <p className="text-pretty text-sm text-zinc-400">
            Phone, website, and address can be shared with parents. Notification
            email is only for your school — it is not shown to prospects.
          </p>
        </div>
        <TextField
          id="notificationEmail"
          name="notificationEmail"
          type="email"
          label="Notification email"
          hint="New bookings and leads are sent here."
          defaultValue={school.notificationEmail}
          required
          autoComplete="email"
          spellCheck={false}
          error={errors.notificationEmail}
        />
        <TextField
          id="phone"
          name="phone"
          type="tel"
          label="Phone"
          hint="Your agent uses this if parents ask how to reach the school."
          defaultValue={school.phone}
          maxLength={32}
          autoComplete="tel"
          placeholder="(555) 555-0100…"
          error={errors.phone}
        />
        <TextField
          id="website"
          name="website"
          type="url"
          label="Website"
          hint="A link parents can use for more about the school."
          defaultValue={school.website}
          maxLength={2048}
          autoComplete="url"
          spellCheck={false}
          placeholder="https://www.yourschool.com…"
          error={errors.website}
        />
        <TextField
          id="address"
          name="address"
          label="Street address"
          hint="Your agent uses this when parents ask where you are."
          defaultValue={school.address}
          maxLength={500}
          autoComplete="street-address"
          placeholder="123 Main St…"
          error={errors.address}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="city"
            name="city"
            label="City"
            defaultValue={school.city}
            maxLength={80}
            autoComplete="address-level2"
            placeholder="Austin…"
            error={errors.city}
          />
          <TextField
            id="country"
            name="country"
            label="Country"
            hint="Two-letter code."
            defaultValue={school.country}
            maxLength={2}
            autoComplete="country"
            spellCheck={false}
            error={errors.country}
          />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-medium text-zinc-200">Arrival</h3>
          <p className="text-pretty text-sm text-zinc-400">
            These notes help parents get to class. Your agent uses them to
            answer questions; it will not invent extra details.
          </p>
        </div>
        <TextAreaField
          id="parkingNotes"
          name="parkingNotes"
          label="Parking"
          hint="Your agent uses this to explain where students can park."
          defaultValue={school.parkingNotes}
          maxLength={2000}
          placeholder="Lot behind the building, enter from Oak Street…"
          error={errors.parkingNotes}
        />
        <TextAreaField
          id="accessNotes"
          name="accessNotes"
          label="Getting in"
          hint="Door codes, which entrance to use, or where to check in."
          defaultValue={school.accessNotes}
          maxLength={2000}
          placeholder="Come in the front door and check in at the desk…"
          error={errors.accessNotes}
        />
        <TextAreaField
          id="trialGuidance"
          name="trialGuidance"
          label="Trial class guidance"
          hint="What to expect on the first visit — arrive early, bring water, and so on."
          defaultValue={school.trialGuidance}
          maxLength={2000}
          placeholder="Arrive 10 minutes early. We will fit a loaner uniform if needed…"
          error={errors.trialGuidance}
        />
      </section>

      <FormActions state={state} pending={pending} saveLabel="Save profile" />
    </form>
  );
}
