/**
 * Shared result shape for every settings server action.
 *
 * Actions never throw for expected problems: they return a state the form can
 * render as inline validation, a server error, or a success confirmation.
 */
export type SettingsFormState = {
  status: "idle" | "success" | "error";
  /** Human sentence shown in the section status area. */
  message: string | null;
  /** Field name -> first problem with that field. */
  fieldErrors: Record<string, string>;
  /**
   * Normalized values that were saved. Forms use this to reset their
   * "unsaved changes" baseline without losing anything the owner typed while
   * the save was in flight.
   */
  values: Record<string, string> | null;
};

export const IDLE_STATE: SettingsFormState = {
  status: "idle",
  message: null,
  fieldErrors: {},
  values: null,
};

export function successState(
  message: string,
  values?: Record<string, string>,
): SettingsFormState {
  return {
    status: "success",
    message,
    fieldErrors: {},
    values: values ?? null,
  };
}

export function errorState(
  message: string,
  fieldErrors: Record<string, string> = {},
): SettingsFormState {
  return { status: "error", message, fieldErrors, values: null };
}

/**
 * A successful save the form should display but not totally celebrate.
 * Used after a `updatedAt`-based optimistic concurrency conflict so owners
 * can see the new value without losing their in-flight edit.
 */
export function conflictState(
  message: string,
  values: Record<string, string>,
): SettingsFormState {
  return {
    status: "error",
    message,
    fieldErrors: {},
    values,
  };
}

export const GENERIC_SERVER_ERROR =
  "We could not save that. Nothing changed — try again in a moment.";

export const STALE_EDIT_MESSAGE =
  "Someone else saved this while you were editing. We kept what you typed — refresh to see the latest values.";
