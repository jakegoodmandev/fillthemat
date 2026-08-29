import { REMINDER_MIN_LEAD_HOURS, REMINDER_WINDOW_HOURS } from "./constants";

export function shouldCreateReminder({
  createdAt,
  startAt,
  now,
}: {
  createdAt: Date;
  startAt: Date;
  now: Date;
}): boolean {
  const createdLeadMs = REMINDER_MIN_LEAD_HOURS * 60 * 60 * 1000;
  const windowMs = REMINDER_WINDOW_HOURS * 60 * 60 * 1000;
  if (startAt.getTime() - createdAt.getTime() < createdLeadMs) return false;
  if (startAt.getTime() <= now.getTime()) return false;
  return startAt.getTime() - now.getTime() <= windowMs;
}
