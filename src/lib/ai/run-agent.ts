import { convertToModelMessages, type UIMessage } from "ai";
import type { School, TrialOffering, TrialWindow } from "@/db/schema";
import { isLocalAiStub } from "@/lib/dev-flags";
import type { SlotOccurrence } from "@/lib/schedule/occurrences";
import { createBookingAgent } from "./booking-agent";

/**
 * Server-side, non-streaming "collect parts" wrapper (decision D3). It runs the
 * exact same `ToolLoopAgent` (same tools/rules) as the web chat but to
 * completion via `agent.generate(...)` and returns the final text.
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
}): Promise<string> {
  if (isLocalAiStub()) {
    const offeringNames = offerings
      .filter((offering) => offering.active)
      .map((offering) => offering.name);
    return offeringNames.length > 0
      ? `Local chat stub (no VERCEL_OIDC_TOKEN). ${school.name} offers ${offeringNames.join(", ")}. Use Book Trial to confirm a slot.`
      : `Local chat stub (no VERCEL_OIDC_TOKEN). Use Book Trial on this page to pick a time at ${school.name}.`;
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

  return result.text.trim();
}
