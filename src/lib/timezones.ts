const US_FALLBACK = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
];

export function listTimezones(): string[] {
  try {
    const values = Intl.supportedValuesOf("timeZone");
    return values.length > 0 ? values : US_FALLBACK;
  } catch {
    return US_FALLBACK;
  }
}

export function isValidTimezone(value: string): boolean {
  return listTimezones().includes(value);
}
