"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { idleSettingsActionState } from "../action-state";
import { createOfferingAction, toggleOfferingAction } from "../actions";
import { formatAgeRange } from "../format";
import type { SettingsOffering } from "../load";
import { ActionStatus, FormActions, useFocusFirstError } from "./action-status";
import { TextAreaField, TextField } from "./field";
import { ghostButtonClassName, secondaryButtonClassName } from "./styles";
import { useSectionDirty } from "./unsaved-changes";

function OfferingCard({ offering }: { offering: SettingsOffering }) {
  const [state, formAction, pending] = useActionState(
    toggleOfferingAction,
    idleSettingsActionState,
  );
  return (
    <article className="flex min-w-0 flex-col gap-3 rounded-xl border border-zinc-800 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-pretty text-base font-medium break-words">
            {offering.name}
          </h3>
          <p className="text-sm text-zinc-400">
            {formatAgeRange(offering.minimumAge, offering.maximumAge)}
          </p>
        </div>
        <span
          className={`rounded-full px-2 py-1 text-xs font-medium ${
            offering.active
              ? "bg-emerald-950 text-emerald-300"
              : "bg-zinc-800 text-zinc-400"
          }`}
        >
          {offering.active ? "Visible to parents" : "Hidden from parents"}
        </span>
      </div>
      {offering.attire ? (
        <p className="text-pretty text-sm text-zinc-300">
          <span className="text-zinc-500">What to wear: </span>
          <span className="break-words">{offering.attire}</span>
        </p>
      ) : null}
      {offering.description ? (
        <p className="line-clamp-4 text-pretty text-sm break-words text-zinc-400">
          {offering.description}
        </p>
      ) : (
        <p className="text-sm text-zinc-500">No description yet.</p>
      )}
      {!offering.active && offering.windowCount > 0 ? (
        <p className="text-pretty text-sm text-zinc-500">
          This trial class is hidden, but it still has {offering.windowCount}{" "}
          weekly {offering.windowCount === 1 ? "time" : "times"} in Schedule.
          Deactivate those times if they should not be bookable.
        </p>
      ) : null}
      <form action={formAction}>
        <input type="hidden" name="id" value={offering.id} />
        <input type="hidden" name="active" value={String(offering.active)} />
        <button type="submit" className={ghostButtonClassName}>
          {pending
            ? "Saving…"
            : offering.active
              ? "Hide from parents"
              : "Show to parents"}
        </button>
        <ActionStatus state={state} pending={pending} />
      </form>
    </article>
  );
}

function AddOfferingForm({ openByDefault }: { openByDefault: boolean }) {
  const [open, setOpen] = useState(openByDefault);
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(
    createOfferingAction,
    idleSettingsActionState,
  );
  const { markDirty, markClean } = useSectionDirty();
  useFocusFirstError(state, formRef);

  useEffect(() => {
    if (state.status === "success") {
      markClean();
      formRef.current?.reset();
      if (!openByDefault) setOpen(false);
    }
  }, [state, markClean, openByDefault]);

  if (!open) {
    return (
      <button
        type="button"
        className={secondaryButtonClassName}
        onClick={() => setOpen(true)}
      >
        Add a trial class
      </button>
    );
  }

  const errors = state.fieldErrors;
  return (
    <form
      ref={formRef}
      action={formAction}
      autoComplete="off"
      className="flex flex-col gap-4 rounded-xl border border-zinc-800 p-4"
      onInput={markDirty}
      onReset={() => {
        markClean();
        if (!openByDefault) setOpen(false);
      }}
    >
      <h3 className="text-sm font-medium text-zinc-200">Add a trial class</h3>
      <p className="text-pretty text-sm text-zinc-400">
        Names and age ranges are what your agent uses to decide who can join.
        You can hide a class later; it cannot be edited or deleted here.
      </p>
      <TextField
        id="offering-name"
        name="name"
        label="Name"
        required
        maxLength={80}
        placeholder="Kids beginner trial…"
        error={errors.name}
      />
      <TextAreaField
        id="offering-description"
        name="description"
        label="Description"
        hint="What this trial class is like, in plain language."
        maxLength={2000}
        placeholder="A playful intro class covering basic stances and falling safely…"
        error={errors.description}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id="offering-min-age"
          name="minimumAge"
          type="number"
          inputMode="numeric"
          min={0}
          max={99}
          label="Minimum age"
          hint="Leave blank if there is no minimum."
          error={errors.minimumAge}
        />
        <TextField
          id="offering-max-age"
          name="maximumAge"
          type="number"
          inputMode="numeric"
          min={0}
          max={99}
          label="Maximum age"
          hint="Leave blank if there is no maximum."
          error={errors.maximumAge}
        />
      </div>
      <TextField
        id="offering-attire"
        name="attire"
        label="What to wear"
        hint="Your agent uses this when parents ask what students should wear."
        maxLength={1000}
        placeholder="Comfortable athletic clothes; barefoot or indoor shoes…"
        error={errors.attire}
      />
      <FormActions
        state={state}
        pending={pending}
        saveLabel="Add trial class"
      />
    </form>
  );
}

export function OfferingsPanel({
  offerings,
}: {
  offerings: SettingsOffering[];
}) {
  const active = offerings.filter((offering) => offering.active);
  const inactive = offerings.filter((offering) => !offering.active);

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      {offerings.length === 0 ? (
        <p className="text-pretty text-sm text-zinc-400">
          No trial classes yet. Add one so parents can see what a first visit
          looks like.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {active.map((offering) => (
            <OfferingCard key={offering.id} offering={offering} />
          ))}
          {inactive.length > 0 ? (
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-medium text-zinc-500">
                Hidden from parents
              </h3>
              {inactive.map((offering) => (
                <OfferingCard key={offering.id} offering={offering} />
              ))}
            </div>
          ) : null}
        </div>
      )}
      <AddOfferingForm openByDefault={offerings.length === 0} />
    </div>
  );
}
