import { gateway, isStepCount, ToolLoopAgent, tool } from "ai";
import { z } from "zod";
import type { School, TrialOffering, TrialWindow } from "@/db/schema";
import {
  isAgeEligible,
  listOpenSlots,
  type SlotOccurrence,
} from "@/lib/schedule/occurrences";
import { parseSlotId } from "@/lib/schedule/slot-id";
import { MAX_AGENT_STEPS } from "@/lib/security/limits";
import { buildBookingAgentInstructions } from "./system-prompt";

export const BOOKING_AGENT_MODEL =
  process.env.BOOKING_AGENT_MODEL || "anthropic/claude-sonnet-4.6";

export function createBookingAgent({
  school,
  offerings,
  windows,
  occurrences,
  faqs,
  now,
}: {
  school: School;
  offerings: TrialOffering[];
  windows: TrialWindow[];
  occurrences: SlotOccurrence[];
  faqs: Array<{ question: string; answer: string }>;
  now: Date;
}) {
  return new ToolLoopAgent({
    model: gateway(BOOKING_AGENT_MODEL),
    instructions: buildBookingAgentInstructions({
      name: school.name,
      timezone: school.timezone,
      city: school.city,
      address: school.address,
      phone: school.phone,
      website: school.website,
      parkingNotes: school.parkingNotes,
      accessNotes: school.accessNotes,
      trialGuidance: school.trialGuidance,
      pricing: school.pricing,
      welcomeMessage: school.welcomeMessage,
      agentInstructions: school.agentInstructions,
      faqs,
    }),
    stopWhen: isStepCount(MAX_AGENT_STEPS),
    providerOptions: {
      gateway: {
        tags: ["feature:booking-chat"],
        user: school.id,
      },
    },
    tools: {
      list_trial_offerings: tool({
        description:
          "List trial offerings. Optionally filter by participant age in years.",
        inputSchema: z.object({
          participantAge: z.number().int().min(0).max(99).optional(),
        }),
        execute: async ({ participantAge }) => {
          const filtered = offerings.filter((offering) => {
            if (!offering.active) return false;
            if (participantAge == null) return true;
            return isAgeEligible(participantAge, offering);
          });
          return {
            offerings: filtered.map((offering) => ({
              id: offering.id,
              name: offering.name,
              description: offering.description,
              minimumAge: offering.minimumAge,
              maximumAge: offering.maximumAge,
              attire: offering.attire,
              expectations: offering.expectations,
            })),
            noMatch: filtered.length === 0,
          };
        },
      }),
      list_trial_slots: tool({
        description: "List currently open trial slots for one offering.",
        inputSchema: z.object({
          offeringId: z.string().uuid(),
        }),
        execute: async ({ offeringId }) => {
          const offering = offerings.find(
            (row) => row.id === offeringId && row.active,
          );
          if (!offering) {
            return { slots: [], noMatch: true, reason: "unknown_offering" };
          }
          const slots = listOpenSlots({
            offeringId,
            timezone: school.timezone,
            windows,
            occurrences,
            now,
          });
          return {
            slots: slots.map((slot) => ({
              slotId: slot.slotId,
              localDateLabel: slot.localDateLabel,
              localTimeLabel: slot.localTimeLabel,
              remaining: slot.remaining,
              timezone: slot.timezone,
            })),
            noMatch: slots.length === 0,
          };
        },
      }),
      prepare_booking: tool({
        description:
          "Revalidate an offering and slot and return data for the booking form. This does not create a booking.",
        inputSchema: z.object({
          offeringId: z.string().uuid(),
          slotId: z.string().min(1),
        }),
        execute: async ({ offeringId, slotId }) => {
          const offering = offerings.find(
            (row) => row.id === offeringId && row.active,
          );
          const parsed = parseSlotId(slotId);
          if (!offering || !parsed) {
            return { ok: false, reason: "invalid" };
          }
          const slots = listOpenSlots({
            offeringId,
            timezone: school.timezone,
            windows,
            occurrences,
            now,
          });
          const slot = slots.find((candidate) => candidate.slotId === slotId);
          if (!slot) return { ok: false, reason: "slot_unavailable" };
          return {
            ok: true,
            offering: {
              id: offering.id,
              name: offering.name,
            },
            slot: {
              slotId: slot.slotId,
              localDateLabel: slot.localDateLabel,
              localTimeLabel: slot.localTimeLabel,
              timezone: slot.timezone,
            },
          };
        },
      }),
    },
  });
}
