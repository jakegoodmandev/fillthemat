"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { idleSettingsActionState } from "../action-state";
import {
  createWindowAction,
  deactivateWindowAction,
  deleteWindowAction,
  updateWindowCapacityAction,
} from "../actions";
import { DAY_NAMES, formatDuration, formatMinutesAsTime } from "../format";
import type { SettingsOffering, SettingsWindow } from "../load";
import { ActionStatus, FormActions, useFocusFirstError } from "./action-status";
import { ConfirmDelete } from "./confirm-delete";
import { SelectField, TextField } from "./field";
import { ghostButtonClassName, secondaryButtonClassName } from "./styles";
import { useSectionDirty, useUnsavedChanges } from "./unsaved-changes";

function WindowRow({ window }: { window: SettingsWindow }) {
  const { setDirty } = useUnsavedChanges();
  const [state, formAction, pending] = useActionState(
    updateWindowCapacityAction,
    idleSettingsActionState,
  );
  useEffect(() => {
    if (state.status === "success") setDirty(false);
  }, [state, setDirty]);
  const [deactivateState, deactivateAction, deactivatePending] = useActionState(
    deactivateWindowAction,
    idleSettingsActionState,
  );
  const minCapacity = Math.max(1, window.maxFutureBooked);

  return (
    <article className="flex min-w-0 flex-col gap-3 rounded-xl border border-zinc-800 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="text-pretty font-medium break-words">
            {window.offeringName}
          </h4>
          <p className="text-sm text-zinc-400">
            {formatMinutesAsTime(window.startMinute)} ·{" "}
            {formatDuration(window.durationMinutes)}
            {window.label ? ` · ${window.label}` : ""}
          </p>
        </div>
        <span
          className={`rounded-full px-2 py-1 text-xs font-medium ${
            window.active
              ? "bg-emerald-950 text-emerald-300"
              : "bg-zinc-800 text-zinc-400"
          }`}
        >
          {window.active ? "Open for booking" : "Inactive"}
        </span>
      </div>
      {!window.offeringActive ? (
        <p className="text-pretty text-sm text-zinc-500">
          This time belongs to a hidden trial class. Parents will not be offered
          it until that class is visible again.
        </p>
      ) : null}
      {!window.active ? (
        <p className="text-pretty text-sm text-zinc-500">
          Inactive times cannot be turned back on here.
        </p>
      ) : null}
      {window.hasFutureBooking ? (
        <p className="text-pretty text-sm text-zinc-500">
          Parents already have upcoming bookings in this time. Capacity cannot
          go below {window.maxFutureBooked}.
        </p>
      ) : window.hasOccurrence ? (
        <p className="text-pretty text-sm text-zinc-500">
          This time already has a class on the calendar, so it cannot be
          deleted. You can deactivate it so parents are not offered new spots.
        </p>
      ) : null}

      <form
        action={formAction}
        className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end"
        onInput={() => setDirty(true)}
      >
        <input type="hidden" name="id" value={window.id} />
        <TextField
          id={`capacity-${window.id}`}
          name="capacity"
          type="number"
          inputMode="numeric"
          min={minCapacity}
          max={50}
          defaultValue={window.capacity}
          label="How many students can book"
          hint={
            window.maxFutureBooked > 0
              ? `Cannot go below ${window.maxFutureBooked} because of upcoming bookings.`
              : "Between 1 and 50."
          }
          error={state.fieldErrors.capacity}
        />
        <button type="submit" className={ghostButtonClassName}>
          {pending ? "Saving…" : "Update capacity"}
        </button>
      </form>
      <ActionStatus state={state} pending={pending} />

      <div className="flex flex-col gap-2">
        {window.active ? (
          <form action={deactivateAction}>
            <input type="hidden" name="id" value={window.id} />
            <button type="submit" className={ghostButtonClassName}>
              {deactivatePending ? "Saving…" : "Deactivate"}
            </button>
            <ActionStatus state={deactivateState} pending={deactivatePending} />
          </form>
        ) : null}
        {window.hasOccurrence ? null : (
          <ConfirmDelete
            action={deleteWindowAction}
            id={window.id}
            label="Delete"
            description="Delete this weekly time? This cannot be undone."
          />
        )}
      </div>
    </article>
  );
}

function AddWindowForm({
  offerings,
  openByDefault,
}: {
  offerings: SettingsOffering[];
  openByDefault: boolean;
}) {
  const [open, setOpen] = useState(openByDefault);
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(
    createWindowAction,
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

  if (offerings.length === 0) {
    return (
      <p className="text-pretty text-sm text-zinc-400">
        Add a trial class in Offerings before you can add weekly times.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        className={secondaryButtonClassName}
        onClick={() => setOpen(true)}
      >
        Add a weekly time
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
      <h3 className="text-sm font-medium text-zinc-200">Add a weekly time</h3>
      <p className="text-pretty text-sm text-zinc-400">
        Your agent only offers these times. After a class exists on the
        calendar, you can change capacity or deactivate, but you cannot delete
        the time or turn it back on.
      </p>
      <SelectField
        id="window-offering"
        name="trialOfferingId"
        label="Trial class"
        required
        error={errors.trialOfferingId}
      >
        {offerings.map((offering) => (
          <option key={offering.id} value={offering.id}>
            {offering.name}
            {offering.active ? "" : " (hidden)"}
          </option>
        ))}
      </SelectField>
      <SelectField
        id="window-day"
        name="dayOfWeek"
        label="Day"
        defaultValue={1}
        error={errors.dayOfWeek}
      >
        {DAY_NAMES.map((day, index) => (
          <option key={day} value={index}>
            {day}
          </option>
        ))}
      </SelectField>
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField
          id="window-start"
          name="startTime"
          type="time"
          step={60}
          label="Start time"
          required
          defaultValue="18:00"
          error={errors.startTime}
        />
        <TextField
          id="window-duration"
          name="durationMinutes"
          type="number"
          inputMode="numeric"
          min={1}
          label="Duration (minutes)"
          required
          defaultValue={60}
          error={errors.durationMinutes}
        />
        <TextField
          id="window-capacity"
          name="capacity"
          type="number"
          inputMode="numeric"
          min={1}
          max={50}
          label="Capacity"
          required
          defaultValue={8}
          error={errors.capacity}
        />
      </div>
      <TextField
        id="window-label"
        name="label"
        label="Label (optional)"
        hint="A short note for you, such as “Tiny Tigers room”."
        maxLength={80}
        placeholder="Tiny Tigers room…"
        error={errors.label}
      />
      <FormActions
        state={state}
        pending={pending}
        saveLabel="Add weekly time"
      />
    </form>
  );
}

export function SchedulePanel({
  offerings,
  windows,
}: {
  offerings: SettingsOffering[];
  windows: SettingsWindow[];
}) {
  const grouped = DAY_NAMES.map((day, index) => ({
    day,
    windows: windows
      .filter((window) => window.dayOfWeek === index)
      .slice()
      .sort((a, b) => a.startMinute - b.startMinute),
  })).filter((group) => group.windows.length > 0);

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      {windows.length === 0 ? (
        <p className="text-pretty text-sm text-zinc-400">
          No weekly times yet. Add times so parents can book a trial class.
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {grouped.map((group) => (
            <section key={group.day} className="flex flex-col gap-3">
              <h3 className="text-sm font-medium text-zinc-200">{group.day}</h3>
              {group.windows.map((window) => (
                <WindowRow key={window.id} window={window} />
              ))}
            </section>
          ))}
        </div>
      )}
      <AddWindowForm
        offerings={offerings}
        openByDefault={windows.length === 0 && offerings.length > 0}
      />
    </div>
  );
}
