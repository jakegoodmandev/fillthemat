"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  createOfferingAction,
  toggleOfferingAction,
  updateOfferingAction,
} from "../actions";
import { formatAgeRange, formatCount } from "../format";
import { LIMITS } from "../schemas";
import { sectionHref } from "../sections";
import {
  Badge,
  Callout,
  EmptyState,
  FieldGroup,
  TextAreaField,
  TextField,
} from "../ui/controls";
import { useDirtyState } from "../ui/dirty-context";
import { DiscardChangesDialog } from "../ui/inline-editor";
import { ItemActionForm, SaveBar, useSettingsForm } from "../ui/section-form";

export type OfferingItem = {
  id: string;
  name: string;
  description: string | null;
  minimumAge: number | null;
  maximumAge: number | null;
  attire: string | null;
  expectations: string | null;
  waiverNotes: string | null;
  active: boolean;
  windowCount: number;
  activeWindowCount: number;
  updatedAt: string;
};

type EditorMode =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "edit"; id: string };

const BLANK = {
  name: "",
  description: "",
  minimumAge: "",
  maximumAge: "",
  attire: "",
  expectations: "",
};

function toFormValues(offering: OfferingItem) {
  return {
    id: offering.id,
    expectedUpdatedAt: offering.updatedAt,
    name: offering.name,
    description: offering.description ?? "",
    minimumAge: offering.minimumAge == null ? "" : String(offering.minimumAge),
    maximumAge: offering.maximumAge == null ? "" : String(offering.maximumAge),
    attire: offering.attire ?? "",
    expectations: offering.expectations ?? "",
  };
}

type SuccessAnnouncement = {
  message: string;
  rowId: string;
  created: boolean;
};

export function OfferingsSection({ offerings }: { offerings: OfferingItem[] }) {
  const [editor, setEditor] = useState<EditorMode>({ kind: "closed" });
  const [pendingTarget, setPendingTarget] = useState<EditorMode | null>(null);
  const [pendingCancel, setPendingCancel] = useState(false);
  const [successAnnouncement, setSuccessAnnouncement] =
    useState<SuccessAnnouncement | null>(null);
  const rowRefs = useRef(new Map<string, HTMLLIElement>());
  const lastEditAnchor = useRef<HTMLElement | null>(null);
  const { dirtyKeys } = useDirtyState();
  const sectionDirty = dirtyKeys.some((key) => key.startsWith("offerings:"));

  useEffect(() => {
    if (!successAnnouncement) return;
    // Re-announce after the panel closes by keeping the message in the row.
    // We auto-clear after 10 seconds so it does not linger forever.
    const timer = window.setTimeout(() => setSuccessAnnouncement(null), 10_000);
    return () => window.clearTimeout(timer);
  }, [successAnnouncement]);

  const focusRow = (id: string) => {
    rowRefs.current.get(id)?.focus();
  };

  const openRow = (mode: EditorMode, anchor: HTMLElement | null) => {
    if (anchor) lastEditAnchor.current = anchor;
    // Same target already open — no-op.
    if (
      (mode.kind === "closed" && editor.kind === "closed") ||
      (mode.kind === "create" && editor.kind === "create") ||
      (mode.kind === "edit" && editor.kind === "edit" && mode.id === editor.id)
    ) {
      return;
    }
    // Either no editor is open, or it's clean: switch immediately.
    if (editor.kind === "closed" || !sectionDirty) {
      setEditor(mode);
      return;
    }
    // Switch but ask first; do NOT set editor until the user confirms.
    setPendingTarget(mode);
  };

  const closePanel = () => {
    setEditor({ kind: "closed" });
    lastEditAnchor.current?.focus();
  };

  const requestCancel = () => setPendingCancel(true);
  const discardCancel = () => {
    setPendingCancel(false);
    closePanel();
  };

  const discardAndSwitch = () => {
    if (pendingTarget) setEditor(pendingTarget);
    setPendingTarget(null);
  };

  return (
    <div className="flex flex-col gap-6">
      <Callout>
        Age ranges decide who can book. A child outside every range is told they
        are not eligible. Changing ages affects future bookings only —
        reservations already on the calendar keep their age snapshot.
      </Callout>

      <section className="flex flex-col gap-3" aria-labelledby="offerings-list">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 id="offerings-list" className="text-sm font-semibold">
            Your trial classes
          </h3>
          <p className="text-xs text-muted-foreground">
            {offerings.length === 0
              ? "None yet"
              : `${formatCount(offerings.length, "class")} · ${formatCount(offerings.filter((o) => o.active).length, "offered")}`}
          </p>
        </div>

        {offerings.length === 0 ? (
          <EmptyState
            title="No trial classes yet"
            action={
              editor.kind !== "create" ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={(event) =>
                    openRow({ kind: "create" }, event.currentTarget)
                  }
                >
                  Add a Trial Class
                </Button>
              ) : null
            }
          >
            Add what a family books — for example "Kids beginner trial".
          </EmptyState>
        ) : (
          <ul className="divide-y divide-border border-y border-border">
            {offerings.map((offering) => {
              const isEditing =
                editor.kind === "edit" && editor.id === offering.id;
              return (
                <li
                  key={offering.id}
                  ref={(node) => {
                    if (node) rowRefs.current.set(offering.id, node);
                    else rowRefs.current.delete(offering.id);
                  }}
                  tabIndex={-1}
                  aria-label={`Trial class: ${offering.name}`}
                  className="flex flex-col gap-3 py-3 outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
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
                          {formatAgeRange(
                            offering.minimumAge,
                            offering.maximumAge,
                          )}
                        </Badge>
                        {!offering.active && offering.windowCount > 0 ? (
                          <Badge tone="warning">
                            Turned off — class times hidden
                          </Badge>
                        ) : null}
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
                        {offering.windowCount === 0 ? (
                          offering.active ? (
                            <>
                              Offered, but no weekly class times exist —{" "}
                              <Link
                                href={sectionHref("schedule")}
                                className="underline-offset-4 hover:underline"
                              >
                                add a class time
                              </Link>{" "}
                              so families can book.
                            </>
                          ) : (
                            "No weekly class times yet. Add one in Schedule when you turn this class back on."
                          )
                        ) : (
                          `${formatCount(offering.activeWindowCount, "weekly class time")} bookable · ${formatCount(offering.windowCount, "total")}`
                        )}
                      </p>
                      {successAnnouncement?.rowId === offering.id ? (
                        <p
                          role="status"
                          aria-live="polite"
                          className="text-xs text-success"
                        >
                          {successAnnouncement.message}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-col items-stretch gap-2 sm:items-end">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={(event) =>
                          openRow(
                            { kind: "edit", id: offering.id },
                            event.currentTarget,
                          )
                        }
                        aria-expanded={isEditing || undefined}
                        aria-controls={
                          isEditing
                            ? `offering-editor-${offering.id}`
                            : undefined
                        }
                      >
                        {isEditing ? "Editing…" : "Edit"}
                      </Button>
                      <ItemActionForm
                        action={toggleOfferingAction}
                        id={offering.id}
                        label={
                          offering.active ? "Stop Offering" : "Offer Again"
                        }
                        pendingLabel={
                          offering.active ? "Turning off…" : "Turning on…"
                        }
                        className="items-end"
                        confirm={
                          offering.active
                            ? {
                                title: `Stop offering “${offering.name}”?`,
                                body: (
                                  <>
                                    Families will no longer be able to book it.
                                    Trials already booked are not cancelled.
                                  </>
                                ),
                                confirmLabel: "Stop Offering",
                              }
                            : undefined
                        }
                      />
                    </div>
                  </div>
                  {isEditing ? (
                    <OfferingEditor
                      key={`offering-${offering.id}-${offering.updatedAt}`}
                      offering={offering}
                      onCancel={requestCancel}
                      isOtherEditorDirty={false}
                      onSaved={(values) => {
                        const message =
                          values.name && values.name !== offering.name
                            ? `“${values.name}” saved. Bookings use the new settings.`
                            : `Saved. Bookings use the new settings.`;
                        setSuccessAnnouncement({
                          message,
                          rowId: offering.id,
                          created: false,
                        });
                        closePanel();
                        window.setTimeout(() => focusRow(offering.id), 0);
                      }}
                      onRetainEdits={(message) => {
                        // Owner typed during save: keep panel open, retain
                        // edits, surface "Unsaved changes" affordance via the
                        // form's dirty state.
                        setSuccessAnnouncement({
                          message,
                          rowId: offering.id,
                          created: false,
                        });
                      }}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
        {editor.kind === "closed" ? (
          <div>
            <Button
              type="button"
              variant="outline"
              onClick={(event) =>
                openRow({ kind: "create" }, event.currentTarget)
              }
            >
              Add a Trial Class
            </Button>
          </div>
        ) : null}
      </section>

      {editor.kind === "create" ? (
        <CreateOfferingForm
          key="offering-create"
          onCancel={requestCancel}
          onCreated={(newId, message) => {
            setSuccessAnnouncement({
              message,
              rowId: newId,
              created: true,
            });
            closePanel();
            if (newId) window.setTimeout(() => focusRow(newId), 50);
          }}
        />
      ) : null}

      <DiscardChangesDialog
        open={pendingCancel}
        onKeepEditing={() => setPendingCancel(false)}
        onDiscard={discardCancel}
        body="Your unsaved edits to this trial class will be lost."
      />

      <DiscardChangesDialog
        open={pendingTarget !== null}
        onKeepEditing={() => setPendingTarget(null)}
        onDiscard={discardAndSwitch}
        title="Switch and discard your edits?"
        body="The trial class you were editing has unsaved changes. Switching now will lose them."
        confirmLabel="Discard & Switch"
      />
    </div>
  );
}

function CreateOfferingForm({
  onCancel,
  onCreated,
}: {
  onCancel: () => void;
  onCreated: (newId: string, message: string) => void;
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
    action: createOfferingAction,
    initialValues: BLANK,
    dirtyKey: "offerings:create",
    clearOnSuccess: true,
  });

  const lastStatus = useRef<string>("idle");
  useEffect(() => {
    const sig = state.status;
    if (sig === lastStatus.current) return;
    lastStatus.current = sig;
    if (sig !== "success") return;
    onCreated(state.values?.id ?? "", state.message ?? "Added.");
  }, [state, onCreated]);

  return (
    <div className="flex flex-col gap-4 rounded-md border border-border p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-base font-semibold">Add a trial class</h3>
      </div>
      <form ref={formRef} action={formAction} className="flex flex-col gap-4">
        <FieldGroup title="Class details">
          <Callout>
            Saved trial classes can be edited and turned on or off afterwards.
          </Callout>
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
          <p className="text-xs text-muted-foreground">
            Age ranges decide who can book this class. Reservations already on
            the calendar keep the age range at the time of booking.
          </p>
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
          onCancel={onCancel}
          state={state}
          idleHint="New classes become bookable as soon as they're added."
          hideDiscard
        />
      </form>
    </div>
  );
}

function OfferingEditor({
  offering,
  onCancel,
  isOtherEditorDirty,
  onSaved,
  onRetainEdits,
}: {
  offering: OfferingItem;
  onCancel: () => void;
  isOtherEditorDirty: boolean;
  onSaved: (values: Record<string, string>) => void;
  onRetainEdits: (message: string) => void;
}) {
  const initialValues = useMemo(
    () => toFormValues(offering),
    [
      offering.id,
      offering.updatedAt,
      offering.name,
      offering.description,
      offering.minimumAge,
      offering.maximumAge,
      offering.attire,
      offering.expectations,
      offering,
    ],
  );

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
    action: updateOfferingAction,
    initialValues,
    dirtyKey: `offerings:edit:${offering.id}`,
    clearOnSuccess: false,
  });

  const lastStatus = useRef<string>("idle");
  useEffect(() => {
    const sig = state.status;
    if (sig === lastStatus.current) return;
    lastStatus.current = sig;
    if (sig !== "success") return;
    const savedValues = state.values ?? {};
    const typedDuringSave: string[] = [];
    const initialRecord = initialValues as Record<string, string>;
    const currentRecord = values as Record<string, string>;
    for (const field of Object.keys(currentRecord)) {
      const initial = initialRecord[field] ?? "";
      const current = currentRecord[field] ?? "";
      const saved = savedValues[field] ?? "";
      if (current !== initial && current !== saved) {
        typedDuringSave.push(field);
      }
    }
    if (typedDuringSave.length === 0) {
      onSaved(savedValues);
    } else {
      onRetainEdits(
        state.message ??
          "Saved. Kept your in-flight edits — save again to confirm.",
      );
    }
  }, [state, values, initialValues, onSaved, onRetainEdits]);

  return (
    <div id={`offering-editor-${offering.id}`}>
      <div className="flex flex-col gap-4 rounded-md border border-border p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h3 className="text-base font-semibold">{`Edit “${offering.name}”`}</h3>
        </div>
        <form ref={formRef} action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="id" value={offering.id} />
          <input
            type="hidden"
            name="expectedUpdatedAt"
            value={offering.updatedAt}
          />
          <FieldGroup title="Class details">
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
            <p className="text-xs text-muted-foreground">
              Age ranges decide who can book this class. Reservations already on
              the calendar keep the age range at the time of booking.
            </p>
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
          <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row-reverse sm:items-center">
            <div className="flex shrink-0 gap-2">
              <Button
                type="submit"
                disabled={pending}
                aria-busy={pending || undefined}
              >
                {pending ? "Saving…" : "Save Changes"}
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={onCancel}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={reset}
                disabled={!dirty || pending}
              >
                Discard
              </Button>
            </div>
            <p
              role="status"
              aria-live="polite"
              aria-busy={pending || undefined}
              className={`min-w-0 flex-1 text-sm leading-relaxed text-pretty ${
                pending
                  ? "text-foreground"
                  : state.status === "error"
                    ? "text-destructive"
                    : dirty
                      ? "text-warning"
                      : state.status === "success"
                        ? "text-success"
                        : "text-muted-foreground"
              }`}
            >
              {pending
                ? "Saving…"
                : state.status === "error"
                  ? (state.message ?? "That did not save.")
                  : dirty
                    ? "Unsaved changes"
                    : state.status === "success"
                      ? (state.message ?? "Saved.")
                      : "Saved edits apply to new bookings right away."}
            </p>
          </div>
        </form>
      </div>
      {isOtherEditorDirty ? (
        <p className="mt-2 text-xs text-muted-foreground">
          You have unsaved edits in another editor that will be lost if you
          switch.
        </p>
      ) : null}
    </div>
  );
}
