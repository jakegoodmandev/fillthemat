import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  faqs,
  trialOccurrences,
  trialOfferings,
  trialWindows,
} from "@/db/schema";
import { requireOwnedSchool } from "@/lib/auth/current-school";
import { listTimezones } from "@/lib/timezones";
import { SETTINGS_SECTIONS, type SettingsSection } from "./settings-sections";
import { SettingsWorkspace } from "./settings-workspace";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string | string[] }>;
}) {
  const { school } = await requireOwnedSchool();
  const sectionParam = (await searchParams).section;
  const requestedSection = Array.isArray(sectionParam)
    ? sectionParam[0]
    : sectionParam;
  const activeSection: SettingsSection = SETTINGS_SECTIONS.some(
    (section) => section.id === requestedSection,
  )
    ? (requestedSection as SettingsSection)
    : "profile";

  const db = getDb();
  const [offeringRows, windowRows, faqRows, occurrenceRows] = await Promise.all(
    [
      db
        .select()
        .from(trialOfferings)
        .where(eq(trialOfferings.schoolId, school.id)),
      db
        .select()
        .from(trialWindows)
        .where(eq(trialWindows.schoolId, school.id)),
      db.select().from(faqs).where(eq(faqs.schoolId, school.id)),
      db
        .select({
          trialWindowId: trialOccurrences.trialWindowId,
          bookedCount: trialOccurrences.bookedCount,
          startAt: trialOccurrences.startAt,
        })
        .from(trialOccurrences)
        .where(eq(trialOccurrences.schoolId, school.id)),
    ],
  );

  const now = Date.now();
  const occurrenceSummary = new Map<
    string,
    { hasOccurrence: boolean; maxFutureBooked: number }
  >();
  for (const occurrence of occurrenceRows) {
    const summary = occurrenceSummary.get(occurrence.trialWindowId) ?? {
      hasOccurrence: false,
      maxFutureBooked: 0,
    };
    summary.hasOccurrence = true;
    if (occurrence.startAt.getTime() > now) {
      summary.maxFutureBooked = Math.max(
        summary.maxFutureBooked,
        occurrence.bookedCount,
      );
    }
    occurrenceSummary.set(occurrence.trialWindowId, summary);
  }

  const offeringNames = new Map(
    offeringRows.map((offering) => [offering.id, offering.name]),
  );

  return (
    <SettingsWorkspace
      activeSection={activeSection}
      timezones={listTimezones()}
      school={{
        name: school.name,
        slug: school.slug,
        timezone: school.timezone,
        published: school.publishedAt != null,
        notificationEmail: school.notificationEmail,
        phone: school.phone,
        website: school.website,
        address: school.address,
        city: school.city,
        country: school.country,
        parkingNotes: school.parkingNotes,
        accessNotes: school.accessNotes,
        trialGuidance: school.trialGuidance,
        pricing: school.pricing,
        welcomeMessage: school.welcomeMessage,
        agentInstructions: school.agentInstructions,
        logoUrl: school.logoUrl,
        primaryColor: school.primaryColor,
      }}
      offerings={offeringRows.map((offering) => ({
        id: offering.id,
        name: offering.name,
        description: offering.description,
        minimumAge: offering.minimumAge,
        maximumAge: offering.maximumAge,
        attire: offering.attire,
        active: offering.active,
      }))}
      windows={windowRows.map((window) => ({
        id: window.id,
        trialOfferingId: window.trialOfferingId,
        offeringName:
          offeringNames.get(window.trialOfferingId) ?? "Unavailable offering",
        dayOfWeek: window.dayOfWeek,
        startMinute: window.startMinute,
        durationMinutes: window.durationMinutes,
        capacity: window.capacity,
        label: window.label,
        active: window.active,
        hasOccurrence: occurrenceSummary.get(window.id)?.hasOccurrence ?? false,
        maxFutureBooked: occurrenceSummary.get(window.id)?.maxFutureBooked ?? 0,
      }))}
      faqs={faqRows
        .toSorted((a, b) => a.sortOrder - b.sortOrder)
        .map((faq) => ({
          id: faq.id,
          question: faq.question,
          answer: faq.answer,
        }))}
    />
  );
}
