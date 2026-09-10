"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import {
  createWindowAction,
  deactivateWindowAction,
  deleteWindowAction,
  updateWindowCapacityAction,
} from "../actions";
import {
  DAY_NAMES,
  formatCount,
  formatDuration,
  formatTimeRange,
  WEEK_ORDER,
} from "../format";
import { LIMITS } from "../schemas";
import { sectionHref } from "../sections";
import {
  Badge,
  Callout,
  EmptyState,
  FieldGroup,
  SelectField,
  secondaryButtonClass,
  TextField,
} from "../ui/controls";
import { ItemActionForm, SaveBar, useSettingsForm } from "../ui/section-form";

export type ScheduleWindowItem = {
  id: string;
  offeringName: string;
  offeringActive: boolean;
  dayOfWeek: number;
  startMinute: number;
  durationMinutes: number;
  capacity: number;
  label: string | null;
  active: boolean;
  onCalendar: boolean;
  hasUpcomingBooking: boolean;
  maxUpcomingBooked: number;
};

export type ScheduleOfferingOption = {
  id: string;
  name: string;
  active: boolean;
};

const DAY_OPTIONS = WEEK_ORDER.map((day) => ({
  value: String(day),
  label: DAY_NAMES[day],
}));

export function ScheduleSection({
  windows,
  offerings,
  timezoneLabel,
}: {
  windows: ScheduleWindowItem[];
  offerings: ScheduleOfferingOption[];
  timezoneLabel: string;
}) {
  const [adding, setAdding] = useState(false);
  const addRef = useRef<HTMLDivElement>(null);
  const activeCount = windows.filter((item) => item.active).length;

  const blank = {
    trialOfferingId: offerings[0]?.id ?? "",
    dayOfWeek: "1",
    startMinute: "18:00",
    durationMinutes: "60",
    capacity: "8",
    label: "",
  };

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
    action: createWindowAction,
    initialValues: blank,
    dirtyKey: "schedule:new",
    clearOnSuccess: true,
  });

  const openAddForm = () => {
    setAdding(true);
    requestAnimationFrame(() => {
      addRef.current?.querySelector("select")?.focus();
    });
  };

  if (offerings.length === 0) {
    return (
      <EmptyState
        title="Add a trial class first"
        action={
          <Link
            href={sectionHref("offerings")}
            className={secondaryButtonClass}
          >
            Go to Trial Classes
          </Link>
        }
      >
        Every class time belongs to a trial class.
      </EmptyState>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Callout>
        Class times are in your school time zone ({timezoneLabel}).
      </Callout>

      <section className="flex flex-col gap-4" aria-labelledby="schedule-list">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3
            id="schedule-list"
            className="text-sm font-semibold text-foreground"
          >
            Weekly class times
          </h3>
          <p className="text-xs text-muted-foreground">
            {windows.length === 0
              ? "None yet"
              : `${formatCount(windows.length, "class time")} · ${activeCount} open`}
          </p>
        </div>

        {windows.length === 0 ? (
          <EmptyState
            title="No class times yet"
            action={
              adding ? null : (
                <button
                  type="button"
                  className={secondaryButtonClass}
                  onClick={openAddForm}
                >
                  Add a Class Time
                </button>
              )
            }
          >
            Add the weekly times a family can try a class.
          </EmptyState>
        ) : (
          <div className="flex flex-col gap-5">
            {WEEK_ORDER.filter((day) =>
              windows.some((item) => item.dayOfWeek === day),
            ).map((day) => (
              <section key={day} className="flex flex-col gap-2">
                <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {DAY_NAMES[day]}
                </h4>
                <ul className="flex flex-col gap-3">
                  {windows
                    .filter((item) => item.dayOfWeek === day)
                    .map((item) => (
                      <WindowRow key={item.id} item={item} />
                    ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </section>

      {adding ? (
        <form ref={formRef} action={formAction} className="flex flex-col gap-6">
          <div ref={addRef}>
            <FieldGroup title="Add a class time">
              <SelectField
                label="Trial class"
                name="trialOfferingId"
                required
                value={values.trialOfferingId}
                onValueChange={(value) => setField("trialOfferingId", value)}
                error={errorFor("trialOfferingId")}
                options={offerings.map((offering) => ({
                  value: offering.id,
                  label: offering.active
                    ? offering.name
                    : `${offering.name} (not offered)`,
                }))}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField
                  label="Day of the week"
                  name="dayOfWeek"
                  value={values.dayOfWeek}
                  onValueChange={(value) => setField("dayOfWeek", value)}
                  error={errorFor("dayOfWeek")}
                  options={DAY_OPTIONS}
                />
                <TextField
                  label="Start time"
                  name="startMinute"
                  type="time"
                  value={values.startMinute}
                  onValueChange={(value) => setField("startMinute", value)}
                  error={errorFor("startMinute")}
                  helper={`Time in ${timezoneLabel}.`}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  label="Class length in minutes"
                  name="durationMinutes"
                  type="number"
                  inputMode="numeric"
                  min={LIMITS.durationMin}
                  max={LIMITS.durationMax}
                  step={5}
                  value={values.durationMinutes}
                  onValueChange={(value) => setField("durationMinutes", value)}
                  error={errorFor("durationMinutes")}
                />
                <TextField
                  label="Spots per class"
                  name="capacity"
                  type="number"
                  inputMode="numeric"
                  min={LIMITS.capacityMin}
                  max={LIMITS.capacityMax}
                  value={values.capacity}
                  onValueChange={(value) => setField("capacity", value)}
                  error={errorFor("capacity")}
                />
              </div>
              <TextField
                label="Internal label"
                name="label"
                maxLength={LIMITS.windowLabel}
                value={values.label}
                onValueChange={(value) => setField("label", value)}
                error={errorFor("label")}
                helper="Optional team note."
                placeholder="Main mat with Coach Ana…"
              />
            </FieldGroup>
          </div>

          <SaveBar
            saveLabel="Add Class Time"
            savingLabel="Adding…"
            pending={pending}
            dirty={dirty}
            onDiscard={reset}
            state={state}
            idleHint="New class times become bookable right away."
          />
        </form>
      ) : (
        <div>
          <button
            type="button"
            className={secondaryButtonClass}
            onClick={openAddForm}
          >
            Add a Class Time
          </button>
        </div>
      )}
    </div>
  );
}

function WindowRow({ item }: { item: ScheduleWindowItem }) {
  return (
    <li className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-foreground tabular-nums">
            {formatTimeRange(item.startMinute, item.durationMinutes)}
          </p>
          <span className="text-xs text-muted-foreground">
            {formatDuration(item.durationMinutes)}
          </span>
          {item.active ? (
            <Badge tone="active">Open</Badge>
          ) : (
            <Badge tone="muted">Turned off</Badge>
          )}
          {item.hasUpcomingBooking ? (
            <Badge tone="warning">Upcoming bookings</Badge>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">
          {item.offeringName}
          {item.offeringActive ? "" : " · trial class not offered"}
          {item.label ? ` · ${item.label}` : ""}
        </p>
        <p className="text-xs text-muted-foreground">
          {formatCount(item.capacity, "spot")} per class
          {item.maxUpcomingBooked > 0
            ? ` · ${formatCount(item.maxUpcomingBooked, "student")} booked`
            : ""}
        </p>
      </div>

      <CapacityForm
        id={item.id}
        capacity={item.capacity}
        minimum={item.maxUpcomingBooked}
      />

      <div className="flex flex-wrap items-start gap-2">
        {item.active ? (
          <ItemActionForm
            action={deactivateWindowAction}
            id={item.id}
            label="Turn Off"
            pendingLabel="Turning off…"
            confirm={{
              title: "Turn off this class time?",
              body: (
                <>
                  Families will stop seeing it when they book a trial. Existing
                  bookings remain.
                </>
              ),
              confirmLabel: "Turn It Off",
            }}
          />
        ) : (
          <p className="text-xs text-muted-foreground">
            Turned off. Reopening is not available yet — add a new class time
            instead.
          </p>
        )}

        {item.onCalendar ? (
          <p className="max-w-prose text-xs text-muted-foreground">
            Already on calendar (cannot delete). Turn off to stop offering.
          </p>
        ) : (
          <ItemActionForm
            action={deleteWindowAction}
            id={item.id}
            label="Delete"
            pendingLabel="Deleting…"
            variant="danger"
            confirm={{
              title: "Delete this class time?",
              body: (
                <>
                  It will be removed from your schedule. This cannot be undone.
                </>
              ),
              confirmLabel: "Delete Class Time",
            }}
          />
        )}
      </div>
    </li>
  );
}

function CapacityForm({
  id,
  capacity,
  minimum,
}: {
  id: string;
  capacity: number;
  minimum: number;
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
    action: updateWindowCapacityAction,
    initialValues: { capacity: String(capacity) },
    dirtyKey: `schedule:capacity:${id}`,
  });

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-col gap-3 border-t border-border/60 pt-3 sm:flex-row sm:items-end"
    >
      <input type="hidden" name="id" value={id} />
      <div className="w-full sm:max-w-40">
        <TextField
          label="Spots per class"
          name="capacity"
          type="number"
          inputMode="numeric"
          min={Math.max(LIMITS.capacityMin, minimum)}
          max={LIMITS.capacityMax}
          value={values.capacity}
          onValueChange={(value) => setField("capacity", value)}
          error={errorFor("capacity")}
          helper={
            minimum > 0
              ? `Min ${minimum} (booked).`
              : `Range ${LIMITS.capacityMin}–${LIMITS.capacityMax}.`
          }
        />
      </div>
      <div className="flex flex-wrap items-center gap-2 pb-1">
        <button
          type="submit"
          className={secondaryButtonClass}
          disabled={pending || !dirty}
          aria-busy={pending || undefined}
        >
          {pending ? "Saving…" : "Update Spots"}
        </button>
        {dirty && !pending ? (
          <button
            type="button"
            className={secondaryButtonClass}
            onClick={reset}
          >
            Discard
          </button>
        ) : null}
        {state.status === "error" || (state.status === "success" && !dirty) ? (
          <p
            role="status"
            aria-live="polite"
            className={`text-xs ${
              state.status === "error" ? "text-destructive" : "text-emerald-400"
            }`}
          >
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
