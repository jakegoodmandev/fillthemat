import { addDays } from "date-fns";
import { and, eq, isNull, sql } from "drizzle-orm";
import { type UIMessage, validateUIMessages } from "ai";
import { getDb } from "@/db";
import { conversations, messages, schools } from "@/db/schema";
import { hashToken, hashWaId, randomToken } from "@/lib/crypto";
import { TRANSCRIPT_RETENTION_DAYS } from "@/lib/schedule/constants";
import { MAX_CHAT_MESSAGES_PER_CONVERSATION } from "@/lib/security/limits";
import { loadValidatedConversationMessages } from "./messages";
import type { InboundWhatsAppMessage } from "./parse";

export type PersistInboundResult =
  | {
      persisted: false;
      reason:
        | "unknown_phone_number"
        | "empty_text"
        | "limit"
        | "generation_in_progress";
    }
  | { persisted: boolean; duplicate: boolean; conversationId: string };

/**
 * Single-flight claim, mirroring `chat/route.ts`. Only one inbound may hold the
 * `generating_at` lock per conversation at a time. A bounded retry serializes
 * concurrent in-flight webhooks against the same conversation instead of
 * dropping the loser (Phase 4 replaces this inline path with enqueue-then-ack).
 */
async function claimGenerating(
  conversationId: string,
  now: Date,
): Promise<boolean> {
  const db = getDb();
  for (let attempt = 0; attempt < 120; attempt++) {
    const [claimed] = await db
      .update(conversations)
      .set({ generatingAt: now, updatedAt: now })
      .where(
        and(
          eq(conversations.id, conversationId),
          isNull(conversations.generatingAt),
        ),
      )
      .returning({ id: conversations.id });
    if (claimed) return true;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return false;
}

async function releaseGenerating(conversationId: string): Promise<void> {
  const db = getDb();
  await db
    .update(conversations)
    .set({ generatingAt: null, updatedAt: new Date() })
    .where(eq(conversations.id, conversationId));
}

/**
 * Resolve the school from `metadata.phone_number_id`, find/create the WhatsApp
 * conversation keyed `(school_id, wa_id_hash)`, and persist the inbound message
 * as UIMessage parts. Dedupe is by `wamid` via the `(conversation_id, message_id)`
 * unique constraint, so a Meta retry produces at most one row.
 *
 * `generating_at` is claimed/released around the load+persist so concurrent
 * inbound on the same conversation is serialized (agent run is Phase 4).
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

  let [conversation] = await db
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.schoolId, school.id),
        eq(conversations.waIdHash, waIdHash),
      ),
    )
    .limit(1);

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
        where: sql`${conversations.waIdHash} IS NOT NULL`,
      })
      .returning();
    conversation = inserted;
    if (!conversation) {
      const [again] = await db
        .select()
        .from(conversations)
        .where(
          and(
            eq(conversations.schoolId, school.id),
            eq(conversations.waIdHash, waIdHash),
          ),
        )
        .limit(1);
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

  if (!(await claimGenerating(conversation.id, now))) {
    return { persisted: false, reason: "generation_in_progress" };
  }

  try {
    const history = await loadValidatedConversationMessages(conversation.id);

    if (history.some((row) => row.id === input.wamid)) {
      return {
        persisted: false,
        duplicate: true,
        conversationId: conversation.id,
      };
    }

    if (history.length >= MAX_CHAT_MESSAGES_PER_CONVERSATION) {
      return { persisted: false, reason: "limit" };
    }

    // Validate the full context that Phase 4 will feed the agent; text parts
    // pass through untouched, and a corrupt persisted row surfaces here.
    const inboundUIMessage: UIMessage = {
      id: input.wamid,
      role: "user",
      parts: [{ type: "text", text: input.text }],
    };
    await validateUIMessages({ messages: [...history, inboundUIMessage] });

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
  } finally {
    await releaseGenerating(conversation.id);
  }
}
