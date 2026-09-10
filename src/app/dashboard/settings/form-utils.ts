/** Pure helpers for settings form lifecycle. Kept out of client modules so tests can import them. */

export type FormValues = Record<string, string>;

export function sameValues(a: FormValues, b: FormValues): boolean {
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((key) => a[key] === b[key]);
}

/**
 * After a confirmed save, copy server-normalized values into the form except
 * for fields the owner typed while the request was in flight.
 */
export function applySavedValues(
  previous: FormValues,
  saved: FormValues,
  typedDuringSave: readonly string[],
): FormValues {
  const next = { ...previous };
  for (const [field, value] of Object.entries(saved)) {
    if (!typedDuringSave.includes(field)) next[field] = value;
  }
  return next;
}

/**
 * After a confirmed create, reset to the blank form but keep characters typed
 * after submit. Those leftover fields are unsaved relative to the new blank
 * baseline.
 */
export function applyCreateSuccessValues(
  previous: FormValues,
  blank: FormValues,
  typedDuringSave: readonly string[],
): FormValues {
  const next = { ...blank };
  for (const field of typedDuringSave) {
    if (field in previous) next[field] = previous[field];
  }
  return next;
}

export function nullToEmpty(value: string | number | null | undefined): string {
  if (value == null) return "";
  return String(value);
}

export function serializeTimestamp(value: Date | string): string {
  if (typeof value === "string") return value;
  return value.toISOString();
}
