"use client";

import { useRef, useState } from "react";
import { createOfferingAction, toggleOfferingAction } from "../actions";
import { formatAgeRange, formatCount } from "../format";
import { LIMITS } from "../schemas";
import {
  Badge,
  EmptyState,
  FieldGroup,
  secondaryButtonClass,
  TextAreaField,
  TextField,
} from "../ui/controls";
import { ItemActionForm, SaveBar, useSettingsForm } from "../ui/section-form";

export type OfferingItem = {
  id: string;
  name: string;
  description: string | null;
  minimumAge: number | null;
  maximumAge: number | null;
  attire: string | null;
  expectations: string | null;
  active: boolean;
  windowCount: number;
  activeWindowCount: number;
};

const BLANK = {
  name: "",
  description: "",
  minimumAge: "",
  maximumAge: "",
  attire: "",
  expectations: "",
};

export function OfferingsSection({ offerings }: { offerings: OfferingItem[] }) {
  const [adding, setAdding] = useState(offerings.length === 0);
  const nameRef = useRef<HTMLDivElement>(null);
  const activeCount = offerings.filter((offering) => offering.active).length;

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
    action: createOfferingAction,
    initialValues: BLANK,
    dirtyKey: "offerings:new",
    clearOnSuccess: true,
  });

  const openAddForm = () => {
    setAdding(true);
    requestAnimationFrame(() => {
      nameRef.current?.querySelector("input")?.focus();
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3" aria-labelledby="offerings-list">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3
            id="offerings-list"
            className="text-sm font-semibold text-foreground"
          >
            Your trial classes
          </h3>
          <p className="text-xs text-muted-foreground">
            {offerings.length === 0
              ? "None yet"
              : `${formatCount(offerings.length, "class")} · ${activeCount} offered`}
          </p>
        </div>

        {offerings.length === 0 ? (
          <EmptyState
            title="No trial classes yet"
            action={
              adding ? null : (
                <button
                  type="button"
                  className={secondaryButtonClass}
                  onClick={openAddForm}
                >
                  Add a Trial Class
                </button>
              )
            }
          >
            A trial class is what a family books (e.g. &ldquo;Kids beginner
            trial&rdquo;).
          </EmptyState>
        ) : (
          <ul className="flex flex-col gap-3">
            {offerings.map((offering) => (
              <li
                key={offering.id}
                className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="flex min-w-0 flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-sm font-medium text-foreground">
                      {offering.name}
                    </h4>
                    {offering.active ? (
                      <Badge tone="active">Offered</Badge>
                    ) : (
                      <Badge tone="muted">Not offered</Badge>
                    )}
                    <Badge>
                      {formatAgeRange(offering.minimumAge, offering.maximumAge)}
                    </Badge>
                  </div>
                  {offering.description ? (
                    <p className="line-clamp-3 max-w-prose text-sm leading-relaxed text-muted-foreground">
                      {offering.description}
                    </p>
                  ) : null}
                  {offering.attire ? (
                    <p className="text-xs text-muted-foreground">
                      Attire: {offering.attire}
                    </p>
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    {offering.windowCount === 0
                      ? "No class times yet — add one in Schedule."
                      : `${formatCount(offering.activeWindowCount, "weekly class time")} available`}
                  </p>
                </div>
                <ItemActionForm
                  action={toggleOfferingAction}
                  id={offering.id}
                  label={offering.active ? "Stop Offering" : "Offer Again"}
                  pendingLabel={
                    offering.active ? "Turning off…" : "Turning on…"
                  }
                  className="sm:items-end"
                  confirm={
                    offering.active
                      ? {
                          title: `Stop offering “${offering.name}”?`,
                          body: (
                            <>
                              Families will no longer be able to book it and
                              your agent will stop suggesting it. Existing
                              bookings remain.
                            </>
                          ),
                          confirmLabel: "Stop Offering",
                        }
                      : undefined
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {adding ? (
        <form ref={formRef} action={formAction} className="flex flex-col gap-6">
          <FieldGroup title="Add a trial class">
            <div ref={nameRef}>
              <TextField
                label="Class name"
                name="name"
                required
                maxLength={LIMITS.offeringName}
                value={values.name}
                onValueChange={(value) => setField("name", value)}
                error={errorFor("name")}
                placeholder="Kids beginner trial…"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Youngest age"
                name="minimumAge"
                type="number"
                min={0}
                max={99}
                inputMode="numeric"
                value={values.minimumAge}
                onValueChange={(value) => setField("minimumAge", value)}
                error={errorFor("minimumAge")}
                helper="Blank for no lower limit."
                placeholder="6…"
              />
              <TextField
                label="Oldest age"
                name="maximumAge"
                type="number"
                min={0}
                max={99}
                inputMode="numeric"
                value={values.maximumAge}
                onValueChange={(value) => setField("maximumAge", value)}
                error={errorFor("maximumAge")}
                helper="Blank for no upper limit."
                placeholder="12…"
              />
            </div>
            <TextAreaField
              label="Description"
              name="description"
              rows={3}
              maxLength={LIMITS.offeringDescription}
              value={values.description}
              onValueChange={(value) => setField("description", value)}
              error={errorFor("description")}
              placeholder="A 45-minute beginner class focused on basics and safety…"
            />
            <TextField
              label="What to wear"
              name="attire"
              maxLength={LIMITS.offeringAttire}
              value={values.attire}
              onValueChange={(value) => setField("attire", value)}
              error={errorFor("attire")}
              placeholder="Comfortable clothes and bare feet…"
            />
            <TextAreaField
              label="What to expect in class"
              name="expectations"
              rows={3}
              maxLength={LIMITS.offeringExpectations}
              value={values.expectations}
              onValueChange={(value) => setField("expectations", value)}
              error={errorFor("expectations")}
              placeholder="Warm-up, partner drills with an instructor, and time for questions…"
            />
          </FieldGroup>

          <SaveBar
            saveLabel="Add Trial Class"
            savingLabel="Adding…"
            pending={pending}
            dirty={dirty}
            onDiscard={reset}
            state={state}
            idleHint="New trial classes take effect immediately."
          />
        </form>
      ) : (
        <div>
          <button
            type="button"
            className={secondaryButtonClass}
            onClick={openAddForm}
          >
            Add a Trial Class
          </button>
        </div>
      )}
    </div>
  );
}
