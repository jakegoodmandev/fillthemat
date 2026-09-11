import { generateId, type UIMessage, validateUIMessages } from "ai";
import { addHours } from "date-fns";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { schools, type WhatsAppJob } from "@/db/schema";
import { runBookingAgentToCompletion } from "@/lib/ai/run-agent";
import { loadSchoolCatalog } from "@/lib/schools/public";
import { MAX_CHAT_MESSAGES_PER_CONVERSATION } from "@/lib/security/limits";
import {
  attemptWhatsAppDeliveriesNow,
  drainDueWhatsAppDeliveries,
  enqueueWhatsAppDelivery,
  recoverStuckWhatsAppDeliveries,
} from "./deliveries";
import {
  claimGenerating,
  messageExists,
  persistAssistantMessage,
  persistUserMessage,
  releaseGenerating,
  resolveInboundConversation,
} from "./inbound";
import {
  claimDueWhatsAppJobs,
  failJob,
  markJobDone,
  recoverStuckWhatsAppJobs,
  rescheduleJob,
} from "./jobs";
import { loadValidatedConversationMessages } from "./messages";
import type { InboundWhatsAppMessage } from "./parse";
import { splitWhatsAppText } from "./text";

export const WHATSAPP_WINDOW_MS = 24 * 60 * 60 * 1000;

export type ProcessJobResult = "done" | "failed";

/**
 * Claim-then-process one inbound job. The webhook never runs this — it only
 * enqueues — so the agent loop + outbound send happen here on the worker
 * (decision D12 / H).
 */
export async function processWhatsAppJob(
  job: WhatsAppJob,
  runId: string,
): Promise<ProcessJobResult> {
  const message = job.payload as InboundWhatsAppMessage;
  let conversationId: string | null = null;
  try {
    const resolved = await resolveInboundConversation(message, new Date());
    if (!resolved.resolved) {
      if (resolved.reason === "unknown_phone_number") {
        await failJob(job.id, job.attempts, "unknown_phone_number");
        return "failed";
      }
      // Empty/non-text payload: nothing to persist or reply to.
      await markJobDone(job.id);
      return "done";
    }
    conversationId = resolved.conversationId;
    const now = new Date();

    // Retry idempotency: if a previous attempt already persisted this inbound
    // message, do not run the agent a second time.
    if (await messageExists(conversationId, message.wamid)) {
      await markJobDone(job.id, resolved.schoolId);
      return "done";
    }

    if (!(await claimGenerating(conversationId, now))) {
      // Another job is mid-flight on this conversation; try again shortly.
      await rescheduleJob(job.id, 2000);
      return "done";
    }

    try {
      const history = await loadValidatedConversationMessages(conversationId);
      if (history.length >= MAX_CHAT_MESSAGES_PER_CONVERSATION) {
        await markJobDone(job.id, resolved.schoolId);
        return "done";
      }

      const inboundUIMessage: UIMessage = {
        id: message.wamid,
        role: "user",
        parts: [{ type: "text", text: message.text ?? "" }],
      };
      const uiMessages = await validateUIMessages({
        messages: [...history, inboundUIMessage],
      });

      const catalog = await loadSchoolCatalog(resolved.schoolId);
      const db = getDb();
      const [school] = await db
        .select()
        .from(schools)
        .where(eq(schools.id, resolved.schoolId))
        .limit(1);
      if (!school) throw new Error("school_missing");

      const run = await runBookingAgentToCompletion({
        school,
        offerings: catalog.offerings,
        windows: catalog.windows,
        occurrences: catalog.occurrences,
        faqs: catalog.faqs,
        uiMessages,
        now,
      });

      await persistUserMessage({
        conversationId,
        messageId: message.wamid,
        text: message.text ?? "",
        purgeAt: resolved.purgeAt,
      });

      const replyText = run;
      const assistantMessageId = generateId();
      await persistAssistantMessage({
        conversationId,
        messageId: assistantMessageId,
        parts: replyText ? [{ type: "text", text: replyText }] : [],
        purgeAt: resolved.purgeAt,
      });

      // Inline send on inbound completion (decision H): the 24h window is open
      // by definition right after an inbound message.
      const chunks = splitWhatsAppText(replyText);
      const windowExpiresAt = addHours(now, 24);
      const deliveryIds: string[] = [];
      for (let index = 0; index < chunks.length; index++) {
        const deliveryId = await enqueueWhatsAppDelivery({
          schoolId: resolved.schoolId,
          recipientWaId: message.waId,
          phoneNumberId: message.phoneNumberId,
          providerIdempotencyKey: `wa-reply/${assistantMessageId}/${index}`,
          body: chunks[index],
          windowExpiresAt,
        });
        if (deliveryId) deliveryIds.push(deliveryId);
      }
      if (deliveryIds.length > 0) {
        await attemptWhatsAppDeliveriesNow(deliveryIds, runId);
      }

      await markJobDone(job.id, resolved.schoolId);
      return "done";
    } finally {
      await releaseGenerating(conversationId);
    }
  } catch (error) {
    // `releaseGenerating` is handled by the inner `finally`: the lock is only
    // ever held between `claimGenerating` and that finally, so there is no
    // second release here (fail the job + backoff, never leak the lock).
    const message =
      error instanceof Error ? error.message : "whatsapp_job_failed";
    await failJob(job.id, job.attempts, message);
    console.error("whatsapp: job failed", job.id, message);
    return "failed";
  }
}

export async function drainWhatsAppJobs(
  runId: string,
  limit = 10,
): Promise<{ claimed: number; done: number; failed: number }> {
  const claimed = await claimDueWhatsAppJobs(runId, { limit });
  let done = 0;
  let failed = 0;
  for (const job of claimed) {
    const result = await processWhatsAppJob(job, runId);
    if (result === "done") done += 1;
    else failed += 1;
  }
  return { claimed: claimed.length, done, failed };
}

/**
 * One full worker tick: process due inbound jobs, then due outbound deliveries
 * (retries/backoff) — no infinite tail-chasing of freshly-claimed rows.
 *
 * The drain below only re-claims `pending`/`failed` rows whose `nextAttemptAt`
 * is due. Delivery rows sent inline above (in `processWhatsAppJob`) are already
 * `sent`, and failed inline rows have a future `nextAttemptAt`, so neither needs
 * re-picking-up here.
 */
export async function runWhatsAppWorkerOnce(runId: string) {
  await recoverStuckWhatsAppJobs();
  await recoverStuckWhatsAppDeliveries();
  const jobs = await drainWhatsAppJobs(runId);
  const deliveries = await drainDueWhatsAppDeliveries(runId);
  return { jobs, deliveries };
}
