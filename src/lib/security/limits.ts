import { and, eq, gte, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { bookings, emailDeliveries, messages } from "@/db/schema";

export const MAX_BOOKINGS_PER_EMAIL_PER_DAY = 6;
export const MAX_OUTBOUND_RECIPIENTS_PER_DAY = 12;
export const MAX_CHAT_MESSAGES_PER_CONVERSATION = 30;
export const MAX_USER_MESSAGE_CHARS = 2000;
export const MAX_REQUEST_BYTES = 32_768;
export const MAX_AGENT_STEPS = 8;

export async function emailBookingQuotaExceeded(
  schoolId: string,
  email: string,
  now = new Date(),
): Promise<boolean> {
  const db = getDb();
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(bookings)
    .where(
      and(
        eq(bookings.schoolId, schoolId),
        eq(bookings.contactEmailSnapshot, email),
        gte(bookings.createdAt, since),
      ),
    );
  return (row?.count ?? 0) >= MAX_BOOKINGS_PER_EMAIL_PER_DAY;
}

export async function recipientQuotaExceeded(
  schoolId: string,
  recipient: string,
  now = new Date(),
): Promise<boolean> {
  const db = getDb();
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(emailDeliveries)
    .where(
      and(
        eq(emailDeliveries.schoolId, schoolId),
        eq(emailDeliveries.recipient, recipient),
        gte(emailDeliveries.createdAt, since),
      ),
    );
  return (row?.count ?? 0) >= MAX_OUTBOUND_RECIPIENTS_PER_DAY;
}

export async function conversationMessageCount(
  conversationId: string,
): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(messages)
    .where(eq(messages.conversationId, conversationId));
  return row?.count ?? 0;
}

export function requestBodyTooLarge(contentLength: string | null): boolean {
  if (!contentLength) return false;
  const size = Number(contentLength);
  return Number.isFinite(size) && size > MAX_REQUEST_BYTES;
}
