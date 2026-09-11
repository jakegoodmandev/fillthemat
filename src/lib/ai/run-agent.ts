import { convertToModelMessages, type UIMessage } from "ai";
import type { School, TrialOffering, TrialWindow } from "@/db/schema";
import { isLocalAiStub } from "@/lib/dev-flags";
import type { SlotOccurrence } from "@/lib/schedule/occurrences";
import { createBookingAgent } from "./booking-agent";

export type PrepareBookingCapture = {
  offeringId: string;
  slotId: string;
  participantName: string | null;
  participantAge: number | null;
};

export type BookingAgentRunResult = {
  text: string;
  prepareBooking: PrepareBookingCapture | null;
};

type PrepareBookingOutput = {
  ok: boolean;
  participant?: {
    name?: string | null;
    age?: number | null;
  };
  offering?: { id?: string };
  slot?: { slotId?: string };
};

/**
 * Server-side, non-streaming "collect parts" wrapper (decision D3). It runs the
 * exact same `ToolLoopAgent` (same tools/rules) as the web chat but to
 * completion via `agent.generate(...)` and returns the final text plus the last
 * successful `prepare_booking` capture for Phase 5 intent storage.
 *
 * Local dev (no `VERCEL_OIDC_TOKEN`) short-circuits to the same deterministic
 * stub the web chat uses, so the outbound queue is exercised without a model.
 */
export async function runBookingAgentToCompletion({
  school,
  offerings,
  windows,
  occurrences,
  faqs,
  uiMessages,
  now,
}: {
  school: School;
  offerings: TrialOffering[];
  windows: TrialWindow[];
  occurrences: SlotOccurrence[];
  faqs: Array<{ question: string; answer: string }>;
  uiMessages: UIMessage[];
  now: Date;
}): Promise<BookingAgentRunResult> {
  if (isLocalAiStub()) {
    const offeringNames = offerings
      .filter((offering) => offering.active)
      .map((offering) => offering.name);
    const text =
      offeringNames.length > 0
        ? `Local chat stub (no VERCEL_OIDC_TOKEN). ${school.name} offers ${offeringNames.join(", ")}. Use Book Trial to confirm a slot.`
        : `Local chat stub (no VERCEL_OIDC_TOKEN). Use Book Trial on this page to pick a time at ${school.name}.`;
    return { text, prepareBooking: null };
  }

  const agent = createBookingAgent({
    school,
    offerings,
    windows,
    occurrences,
    faqs,
    now,
  });

  const modelMessages = await convertToModelMessages(uiMessages, {
    tools: agent.tools,
  });
  const result = await agent.generate({ messages: modelMessages });

  const prepare = [...result.toolResults]
    .reverse()
    .find(
      (entry) =>
        entry.type === "tool-result" &&
        entry.toolName === "prepare_booking" &&
        (entry.output as PrepareBookingOutput | undefined)?.ok === true,
    );

  let prepareBooking: PrepareBookingCapture | null = null;
  if (prepare && prepare.type === "tool-result") {
    const output = prepare.output as PrepareBookingOutput;
    const input = prepare.input as {
      offeringId: string;
      slotId: string;
      participantName?: string;
      participantAge?: number;
    };
    prepareBooking = {
      offeringId: output.offering?.id ?? input.offeringId,
      slotId: output.slot?.slotId ?? input.slotId,
      participantName:
        output.participant?.name ?? input.participantName ?? null,
      participantAge: output.participant?.age ?? input.participantAge ?? null,
    };
  }

  return { text: result.text.trim(), prepareBooking };
}
