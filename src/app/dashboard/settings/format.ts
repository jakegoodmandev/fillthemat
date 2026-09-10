export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export function formatMinutesAsTime(startMinute: number): string {
  const hours = Math.floor(startMinute / 60);
  const minutes = startMinute % 60;
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2020, 0, 1, hours, minutes)));
}

export function formatMinutesAsInputValue(startMinute: number): string {
  const hours = Math.floor(startMinute / 60);
  const minutes = startMinute % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function parseTimeInput(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }
  return hours * 60 + minutes;
}

export function formatAgeRange(
  minimumAge: number | null,
  maximumAge: number | null,
): string {
  if (minimumAge == null && maximumAge == null) return "Any age";
  if (minimumAge != null && maximumAge != null) {
    return `Ages ${minimumAge}–${maximumAge}`;
  }
  if (minimumAge != null) return `Ages ${minimumAge}+`;
  return `Ages up to ${maximumAge}`;
}

export function formatDuration(minutes: number): string {
  if (minutes === 60) return "1 hour";
  if (minutes > 0 && minutes % 60 === 0) return `${minutes / 60} hours`;
  return `${minutes} minutes`;
}

export function formatLocation(
  address: string | null,
  city: string | null,
): string | null {
  const location = [address, city].filter(Boolean).join(", ");
  return location.length > 0 ? location : null;
}
