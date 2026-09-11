import { addDays } from "date-fns";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { conversations, messages, schools } from "@/db/schema";
import { hashToken, hashWaId, randomToken } from "@/lib/crypto";
import { TRANSCRIPT_RETENTION_DAYS } from "@/lib/schedule/constants";
import type { InboundWhatsAppMessage } from "./parse";

export type PersistInboundResult =
  | { persisted: false; reason: "unknown_phone_number" | "empty_text" }
  | { persisted: boolean; duplicate: boolean; conversationId: string };

/**
 * Resolve the school from `metadata.phone_number_id`, find/create the WhatsApp
 * conversation keyed `(school_id, wa_id_hash)`, and persist the inbound message
 * as UIMessage parts. Dedupe is by `wamid` via the `(conversation_id, message_id)`
 * unique constraint, so a Meta retry produces at most one row.
 */
export async function persistInboundMessage(
  input: InboundWhatsAppMessage,
  now = new Date(),
): Promise<PersistInboundResult> {
  if (!input.text) return { persisted: false, reason: "empty_text" };

  const db = getDb();
  const [school] = await db
    .select()
    .from(schools)
    .where(eq(schools.whatsappPhoneNumberId, input.phoneNumberId))
    .limit(1);
  if (!school) return { persisted: false, reason: "unknown_phone_number" };

  const waIdHash = hashWaId(input.waId);
  const purgeAt = addDays(now, TRANSCRIPT_RETENTION_DAYS);

  const findByWaId = () =>
    db
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.schoolId, school.id),
          eq(conversations.waIdHash, waIdHash),
        ),
      )
      .limit(1);

  let [conversation] = await findByWaId();
  if (!conversation) {
    const [inserted] = await db
      .insert(conversations)
      .values({
        schoolId: school.id,
        // Web conversations keep `resume_token_hash` as their identity; the
        // WhatsApp row needs a non-null value to satisfy the column, but it is
        // never used for lookups — `wa_id_hash` is the key.
        resumeTokenHash: hashToken(randomToken()),
        waIdHash,
        expiresAt: purgeAt,
      })
      .onConflictDoNothing({
        target: [conversations.schoolId, conversations.waIdHash],
      })
      .returning();
    conversation = inserted;
    if (!conversation) {
      const [again] = await findByWaId();
      conversation = again;
    }
  }
  if (!conversation) throw new Error("whatsapp_conversation_resolution_failed");

  // Sliding retention: the conversation row stays alive while the thread is
  // active; each message still purges individually at its own `purge_at`.
  await db
    .update(conversations)
    .set({ expiresAt: purgeAt, updatedAt: now })
    .where(eq(conversations.id, conversation.id));

  const [message] = await db
    .insert(messages)
    .values({
      conversationId: conversation.id,
      messageId: input.wamid,
      role: "user",
      parts: [{ type: "text", text: input.text }],
      completion: "complete",
      purgeAt,
    })
    .onConflictDoNothing({
      target: [messages.conversationId, messages.messageId],
    })
    .returning();

  return {
    persisted: Boolean(message),
    duplicate: !message,
    conversationId: conversation.id,
  };
}
