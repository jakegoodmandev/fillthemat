"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { createOfferingAction, toggleOfferingAction } from "../actions";
import { formatAgeRange, formatCount } from "../format";
import { LIMITS } from "../schemas";
import {
  Badge,
  Callout,
  EmptyState,
  FieldGroup,
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
      <Callout>
        Age ranges decide who can book. A child outside every range is told they
        are not eligible.
      </Callout>

      <section className="flex flex-col gap-3" aria-labelledby="offerings-list">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 id="offerings-list" className="text-sm font-semibold">
            Your trial classes
          </h3>
          <p className="text-xs text-muted-foreground">
            {offerings.length === 0
              ? "None yet"
              : `${formatCount(offerings.length, "class")} · ${activeCount} offered to families`}
          </p>
        </div>

        {offerings.length === 0 ? (
          <EmptyState
            title="No trial classes yet"
            action={
              adding ? null : (
                <Button type="button" variant="outline" onClick={openAddForm}>
                  Add a Trial Class
                </Button>
              )
            }
          >
            Add what a family books — for example “Kids beginner trial”.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-border border-y border-border">
            {offerings.map((offering) => (
              <li
                key={offering.id}
                className="flex flex-col gap-3 py-3 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="flex min-w-0 flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-sm font-medium text-pretty">
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
                    <p className="line-clamp-3 max-w-prose text-sm leading-relaxed text-muted-foreground text-pretty">
                      {offering.description}
                    </p>
                  ) : null}
                  {offering.attire ? (
                    <p className="text-xs text-muted-foreground">
                      What to wear: {offering.attire}
                    </p>
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    {offering.windowCount === 0
                      ? "No weekly class times yet — add one in Schedule."
                      : `${formatCount(offering.activeWindowCount, "weekly class time")} available to book`}
                  </p>
                  {!offering.active && offering.activeWindowCount > 0 ? (
                    <p className="text-xs text-warning">
                      Turned off, so its class times are not offered.
                    </p>
                  ) : null}
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
                              Families will no longer be able to book it. Trials
                              already booked are not cancelled.
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
        <form ref={formRef} action={formAction} className="flex flex-col gap-5">
          <FieldGroup title="Add a trial class">
            <Callout>
              Once added, a trial class can be turned on or off, but not edited
              or deleted yet.
            </Callout>
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
            <div className="grid gap-3 sm:grid-cols-2">
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
                helper="Leave blank for no lower limit."
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
                helper="Leave blank for no upper limit."
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
              placeholder="A 45-minute beginner class focused on basics, games, and safety…"
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
              placeholder="Warm-up, partner drills with an instructor, and time for questions afterward…"
            />
          </FieldGroup>

          <SaveBar
            saveLabel="Add Trial Class"
            savingLabel="Adding…"
            pending={pending}
            dirty={dirty}
            onDiscard={reset}
            state={state}
            idleHint="New trial classes are offered to families as soon as they are added."
          />
        </form>
      ) : (
        <div>
          <Button type="button" variant="outline" onClick={openAddForm}>
            Add a Trial Class
          </Button>
        </div>
      )}
    </div>
  );
}
