"use client";

import { updateProfileAction } from "../actions";
import { formatTimezone } from "../format";
import { LIMITS } from "../schemas";
import {
  Callout,
  FieldGroup,
  SelectField,
  TextAreaField,
  TextField,
} from "../ui/controls";
import { SaveBar, useSettingsForm } from "../ui/section-form";

export type ProfileValues = {
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
};

export function ProfileSection({
  initialValues,
  published,
  timezones,
}: {
  initialValues: ProfileValues;
  published: boolean;
  timezones: string[];
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
    action: updateProfileAction,
    initialValues,
    dirtyKey: "profile:details",
  });

  const lockedBadge = published ? "Locked" : undefined;

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-6">
      {published ? (
        <Callout tone="locked" title="Your page is published">
          Your public web address and time zone are locked so that links you
          have shared and classes families already booked keep working.
          Everything else on this page can still change.
        </Callout>
      ) : null}

      <FieldGroup
        title="School identity"
        description="What families see when your agent introduces your school."
      >
        <TextField
          label="School name"
          name="name"
          required
          autoComplete="organization"
          maxLength={LIMITS.schoolName}
          value={values.name}
          onValueChange={(value) => setField("name", value)}
          error={errorFor("name")}
          helper="Families see this name on your public page and in every message from your agent."
          placeholder="Northside Martial Arts…"
        />
        <TextField
          label="Public page address"
          name="slug"
          disabled={published}
          badge={lockedBadge}
          value={values.slug}
          onValueChange={(value) => setField("slug", value)}
          error={errorFor("slug")}
          spellCheck={false}
          placeholder="northside-martial-arts…"
          helper={
            published
              ? `Locked after publishing. Families reach you at /s/${initialValues.slug}.`
              : "The web address families visit: /s/your-school. Use lowercase letters, numbers, and hyphens. This locks once you publish."
          }
        />
        {published ? (
          <TextField
            label="Time zone"
            name="timezoneDisplay"
            disabled
            badge={lockedBadge}
            value={formatTimezone(initialValues.timezone)}
            onValueChange={() => {}}
            helper="Locked after publishing. Every class time you enter is in this time zone."
          />
        ) : (
          <SelectField
            label="Time zone"
            name="timezone"
            value={values.timezone}
            onValueChange={(value) => setField("timezone", value)}
            error={errorFor("timezone")}
            helper="Every class time you enter is in this time zone. This locks once you publish."
            options={timezones.map((zone) => ({
              value: zone,
              label: formatTimezone(zone),
            }))}
          />
        )}
      </FieldGroup>

      <FieldGroup
        title="Contact and location"
        description="Your agent uses these facts to answer “where are you?” and “how do I reach you?”"
      >
        <TextField
          label="Notification email"
          name="notificationEmail"
          type="email"
          required
          autoComplete="email"
          spellCheck={false}
          inputMode="email"
          value={values.notificationEmail}
          onValueChange={(value) => setField("notificationEmail", value)}
          error={errorFor("notificationEmail")}
          helper="Where we send your booking and lead alerts. Internal only — your agent never shares this with families."
          placeholder="owner@example.com…"
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Phone number"
            name="phone"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            maxLength={LIMITS.phone}
            value={values.phone}
            onValueChange={(value) => setField("phone", value)}
            error={errorFor("phone")}
            helper="Your agent shares this when a parent asks how to reach you."
            placeholder="(555) 123-4567…"
          />
          <TextField
            label="Website"
            name="website"
            type="url"
            autoComplete="url"
            spellCheck={false}
            maxLength={LIMITS.website}
            value={values.website}
            onValueChange={(value) => setField("website", value)}
            error={errorFor("website")}
            helper="Your agent may point families here for more about your school."
            placeholder="https://example.com…"
          />
        </div>
        <TextField
          label="Street address"
          name="address"
          autoComplete="street-address"
          maxLength={LIMITS.address}
          value={values.address}
          onValueChange={(value) => setField("address", value)}
          error={errorFor("address")}
          helper="Your agent shares this so families can find the school."
          placeholder="120 Main Street, Suite 3…"
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="City"
            name="city"
            autoComplete="address-level2"
            maxLength={LIMITS.city}
            value={values.city}
            onValueChange={(value) => setField("city", value)}
            error={errorFor("city")}
            helper="Shown under your school name on your public page."
            placeholder="Austin…"
          />
          <TextField
            label="Country code"
            name="country"
            autoComplete="country"
            spellCheck={false}
            maxLength={2}
            value={values.country}
            onValueChange={(value) => setField("country", value)}
            error={errorFor("country")}
            helper="Two letters, such as US or CA."
            placeholder="US…"
            className="uppercase"
          />
        </div>
      </FieldGroup>

      <FieldGroup
        title="Arriving for a trial class"
        description="Practical answers your agent gives parents before their first visit."
      >
        <TextAreaField
          label="Parking"
          name="parkingNotes"
          rows={3}
          maxLength={LIMITS.parkingNotes}
          value={values.parkingNotes}
          onValueChange={(value) => setField("parkingNotes", value)}
          error={errorFor("parkingNotes")}
          helper="Your agent uses this to explain where students can park."
          placeholder="Free lot behind the building, plus street parking after 6 PM…"
        />
        <TextAreaField
          label="Finding the entrance"
          name="accessNotes"
          rows={3}
          maxLength={LIMITS.accessNotes}
          value={values.accessNotes}
          onValueChange={(value) => setField("accessNotes", value)}
          error={errorFor("accessNotes")}
          helper="Which door to use, stairs or elevator, buzzer codes families should skip."
          placeholder="Use the glass door on the left side of the plaza; we are on the second floor…"
        />
        <TextAreaField
          label="What to do on arrival"
          name="trialGuidance"
          rows={3}
          maxLength={LIMITS.trialGuidance}
          value={values.trialGuidance}
          onValueChange={(value) => setField("trialGuidance", value)}
          error={errorFor("trialGuidance")}
          helper="How early to arrive, where parents wait, what to bring. Class-specific clothing belongs in Trial classes."
          placeholder="Arrive 10 minutes early, check in at the front desk, parents watch from the benches…"
        />
      </FieldGroup>

      <SaveBar
        saveLabel="Save School Details"
        pending={pending}
        dirty={dirty}
        onDiscard={reset}
        state={state}
        idleHint="Saved changes are used by your agent right away."
      />
    </form>
  );
}
