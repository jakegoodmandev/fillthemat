"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import {
  RecordEditPanel,
  type RecordForm,
  type SaveResult,
} from "../ui/record-editor";
import { ItemActionForm } from "../ui/section-form";

export type OfferingItem = {
  id: string;
  name: string;
  description: string | null;
  minimumAge: number | null;
  maximumAge: number | null;
  attire: string | null;
  expectations: string | null;
  active: boolean;
  updatedAt: string;
  windowCount: number;
  activeWindowCount: number;
};

const CREATE_FIELDS = {
  name: "",
  minimumAge: "",
  maximumAge: "",
  description: "",
  attire: "",
  expectations: "",
};

function offeringFields(item: OfferingItem): Record<string, string> {
  return {
    name: item.name,
    minimumAge: item.minimumAge == null ? "" : String(item.minimumAge),
    maximumAge: item.maximumAge == null ? "" : String(item.maximumAge),
    description: item.description ?? "",
    attire: item.attire ?? "",
    expectations: item.expectations ?? "",
  };
}

type EditorTarget =
  | { mode: "create" }
  | { mode: "edit"; offering: OfferingItem };

export function OfferingsSection({ offerings }: { offerings: OfferingItem[] }) {
  const router = useRouter();
  const [editor, setEditor] = useState<EditorTarget | null>(
    offerings.length === 0 ? { mode: "create" } : null,
  );
  const [editorDirty, setEditorDirty] = useState(false);
  const [announcement, setAnnouncement] = useState<string | null>(null);
  const [pendingSwitch, setPendingSwitch] = useState<EditorTarget | null>(null);
  const [focusRowId, setFocusRowId] = useState<string | null>(null);
  const editButtons = useRef(new Map<string, HTMLButtonElement>());
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const activeCount = offerings.filter((offering) => offering.active).length;
  const editingId =
    editor?.mode === "edit" ? editor.offering.id : (null as string | null);

  const openEditor = useCallback(
    (target: EditorTarget) => {
      if (editorDirty) {
        setPendingSwitch(target);
        return;
      }
      setAnnouncement(null);
      setEditor(target);
    },
    [editorDirty],
  );

  const applySwitch = useCallback((target: EditorTarget) => {
    setAnnouncement(null);
    setEditor(target);
    setPendingSwitch(null);
  }, []);

  const closeEditor = useCallback(() => {
    setEditor(null);
    setEditorDirty(false);
  }, []);

  // After a create succeeds the server returns the new id; once the revalidated
  // props include that row, move focus to it so it is announced and discoverable.
  useEffect(() => {
    if (
      focusRowId &&
      offerings.some((offering) => offering.id === focusRowId)
    ) {
      const id = focusRowId;
      setFocusRowId(null);
      requestAnimationFrame(() => {
        editButtons.current.get(id)?.focus();
      });
    }
  }, [offerings, focusRowId]);

  const handleResult = useCallback(
    (result: SaveResult) => {
      if (result.status === "error") return; // editor stays open, shows the error
      setAnnouncement(result.state.message);
      const newId = result.state.values?.id ?? "";

      if (editor?.mode === "edit") {
        if (result.typedDuringSave.length === 0) {
          const rowId = editor.offering.id;
          closeEditor();
          requestAnimationFrame(() => {
            editButtons.current.get(rowId)?.focus();
          });
        }
        // typed during save -> keep the editor open; its unsaved edits remain.
        return;
      }

      // create success
      if (result.typedDuringSave.length === 0) {
        closeEditor();
        if (newId) {
          setFocusRowId(newId);
        } else {
          requestAnimationFrame(() => {
            addButtonRef.current?.focus();
          });
        }
      }
      // typed during save -> keep the panel and the typed characters.
    },
    [editor, closeEditor],
  );

  return (
    <div className="flex flex-col gap-6">
      <Callout>
        Age ranges decide who can book. A child outside every range is told they
        are not eligible.
      </Callout>

      <p aria-live="polite" role="status" className="text-sm text-success">
        {announcement ?? ""}
      </p>

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
          <EmptyState title="No trial classes yet">
            Add what a family books — for example “Kids beginner trial”.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-border border-y border-border">
            {offerings.map((offering) => {
              const isEditingThis = editingId === offering.id;
              return (
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
                        {formatAgeRange(
                          offering.minimumAge,
                          offering.maximumAge,
                        )}
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
                    <ScheduleLine offering={offering} />
                  </div>

                  <div className="flex flex-col items-start gap-2 sm:items-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isEditingThis}
                      ref={(node) => {
                        if (node) editButtons.current.set(offering.id, node);
                        else editButtons.current.delete(offering.id);
                      }}
                      onClick={() => openEditor({ mode: "edit", offering })}
                    >
                      Edit
                    </Button>
                    <ItemActionForm
                      action={toggleOfferingAction}
                      id={offering.id}
                      label={offering.active ? "Stop Offering" : "Offer Again"}
                      pendingLabel={
                        offering.active ? "Turning off…" : "Turning on…"
                      }
                      hiddenFields={{ active: String(!offering.active) }}
                      disabled={isEditingThis}
                      className="sm:items-end"
                      confirm={
                        offering.active
                          ? {
                              title: `Stop offering “${offering.name}”?`,
                              body: (
                                <>
                                  Families will no longer be able to book it.
                                  Trials already booked are not cancelled. You
                                  can offer it again anytime.
                                </>
                              ),
                              confirmLabel: "Stop Offering",
                            }
                          : undefined
                      }
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {editor ? (
        <RecordEditPanel
          key={editor.mode === "edit" ? editor.offering.id : "create"}
          action={
            editor.mode === "edit" ? updateOfferingAction : createOfferingAction
          }
          initialValues={
            editor.mode === "edit"
              ? offeringFields(editor.offering)
              : CREATE_FIELDS
          }
          dirtyKey={
            editor.mode === "edit"
              ? `offerings:${editor.offering.id}`
              : "offerings:new"
          }
          heading={
            editor.mode === "edit" ? "Edit trial class" : "Add a trial class"
          }
          saveLabel={
            editor.mode === "edit" ? "Save Changes" : "Add Trial Class"
          }
          savingLabel={editor.mode === "edit" ? "Saving…" : "Adding…"}
          onCancel={() => {
            if (editor.mode === "edit") {
              const rowId = editor.offering.id;
              closeEditor();
              requestAnimationFrame(() => {
                editButtons.current.get(rowId)?.focus();
              });
            } else {
              closeEditor();
              requestAnimationFrame(() => {
                addButtonRef.current?.focus();
              });
            }
          }}
          onResult={handleResult}
          onDirtyChange={setEditorDirty}
          onReload={() => {
            const id = editingId;
            closeEditor();
            router.refresh();
            requestAnimationFrame(() => {
              if (id) editButtons.current.get(id)?.focus();
            });
          }}
          renderFields={(form) => (
            <OfferingFields
              form={form}
              mode={editor.mode}
              offering={editor.mode === "edit" ? editor.offering : undefined}
            />
          )}
        />
      ) : (
        <div>
          <Button
            type="button"
            variant="outline"
            ref={addButtonRef}
            onClick={() => openEditor({ mode: "create" })}
          >
            Add a Trial Class
          </Button>
        </div>
      )}

      <AlertDialog
        open={pendingSwitch !== null}
        onOpenChange={(open) => {
          if (!open) setPendingSwitch(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave without saving?</AlertDialogTitle>
            <AlertDialogDescription>
              You have changes that have not been saved yet. Switching now
              discards those edits.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Editing</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (pendingSwitch) applySwitch(pendingSwitch);
              }}
            >
              Discard Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ScheduleLine({ offering }: { offering: OfferingItem }) {
  if (offering.windowCount === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No class times yet —{" "}
        <Link
          href={sectionHref("schedule")}
          className="underline underline-offset-4 hover:no-underline"
        >
          add one in Schedule
        </Link>
        .
      </p>
    );
  }
  if (offering.activeWindowCount === 0) {
    return (
      <p className="text-xs text-warning">
        Offered, but no class times are open right now.
      </p>
    );
  }
  return (
    <p className="text-xs text-muted-foreground">
      {formatCount(offering.activeWindowCount, "weekly class time")} available
      to book
    </p>
  );
}

function OfferingFields({
  form,
  mode,
  offering,
}: {
  form: RecordForm;
  mode: "create" | "edit";
  offering?: OfferingItem;
}) {
  return (
    <>
      {mode === "edit" && offering ? (
        <>
          <input type="hidden" name="id" value={offering.id} />
          <input type="hidden" name="updatedAt" value={offering.updatedAt} />
        </>
      ) : null}

      <FieldGroup
        title={
          mode === "edit"
            ? (offering?.name ?? "Trial class")
            : "New trial class"
        }
      >
        <Callout>
          {mode === "edit" ? (
            <>
              You are editing the live trial class. Changes apply to new
              bookings and your public page. Existing bookings keep the class
              name, time, and instructions they were made with.
            </>
          ) : (
            "New trial classes are offered to families as soon as they are added."
          )}
        </Callout>
        <TextField
          label="Class name"
          name="name"
          required
          maxLength={LIMITS.offeringName}
          value={form.values.name}
          onValueChange={(value) => form.setField("name", value)}
          error={form.errorFor("name")}
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
            value={form.values.minimumAge}
            onValueChange={(value) => form.setField("minimumAge", value)}
            error={form.errorFor("minimumAge")}
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
            value={form.values.maximumAge}
            onValueChange={(value) => form.setField("maximumAge", value)}
            error={form.errorFor("maximumAge")}
            helper="Leave blank for no upper limit."
            placeholder="12…"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Changing the age range affects new booking eligibility only — existing
          reservations keep their original eligibility.
        </p>
        <TextAreaField
          label="Description"
          name="description"
          rows={3}
          maxLength={LIMITS.offeringDescription}
          value={form.values.description}
          onValueChange={(value) => form.setField("description", value)}
          error={form.errorFor("description")}
          placeholder="A 45-minute beginner class focused on basics, games, and safety…"
        />
        <TextField
          label="What to wear"
          name="attire"
          maxLength={LIMITS.offeringAttire}
          value={form.values.attire}
          onValueChange={(value) => form.setField("attire", value)}
          error={form.errorFor("attire")}
          placeholder="Comfortable clothes and bare feet…"
        />
        <TextAreaField
          label="What to expect in class"
          name="expectations"
          rows={3}
          maxLength={LIMITS.offeringExpectations}
          value={form.values.expectations}
          onValueChange={(value) => form.setField("expectations", value)}
          error={form.errorFor("expectations")}
          placeholder="Warm-up, partner drills with an instructor, and time for questions afterward…"
        />
      </FieldGroup>
    </>
  );
}
