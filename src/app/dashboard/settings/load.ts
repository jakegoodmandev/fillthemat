import { and, eq, gt, sql } from "drizzle-orm";
import { cache } from "react";
import { getDb } from "@/db";
import {
  faqs,
  trialOccurrences,
  trialOfferings,
  trialWindows,
} from "@/db/schema";
import { requireOwnedSchool } from "@/lib/auth/current-school";
import { listTimezones } from "@/lib/timezones";
import { formatLocation } from "./format";

export type SettingsOffering = {
  id: string;
  name: string;
  description: string | null;
  minimumAge: number | null;
  maximumAge: number | null;
  attire: string | null;
  active: boolean;
  windowCount: number;
};

export type SettingsWindow = {
  id: string;
  trialOfferingId: string;
  offeringName: string;
  offeringActive: boolean;
  dayOfWeek: number;
  startMinute: number;
  durationMinutes: number;
  capacity: number;
  label: string | null;
  active: boolean;
  hasOccurrence: boolean;
  maxFutureBooked: number;
  hasFutureBooking: boolean;
};

export type SettingsFaq = {
  id: string;
  question: string;
  answer: string;
};

export const loadSettings = cache(async () => {
  const { school } = await requireOwnedSchool();
  const db = getDb();
  const [offeringRows, windowRows, faqRows, occurrenceWindows, futureStats] =
    await Promise.all([
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
        .select({ trialWindowId: trialOccurrences.trialWindowId })
        .from(trialOccurrences)
        .where(eq(trialOccurrences.schoolId, school.id))
        .groupBy(trialOccurrences.trialWindowId),
      db
        .select({
          trialWindowId: trialOccurrences.trialWindowId,
          maxBooked: sql<number>`coalesce(max(${trialOccurrences.bookedCount}), 0)::int`,
          hasBooking: sql<boolean>`coalesce(bool_or(${trialOccurrences.bookedCount} > 0), false)`,
        })
        .from(trialOccurrences)
        .where(
          and(
            eq(trialOccurrences.schoolId, school.id),
            gt(trialOccurrences.startAt, new Date()),
          ),
        )
        .groupBy(trialOccurrences.trialWindowId),
    ]);

  const occurrenceIds = new Set(
    occurrenceWindows.map((row) => row.trialWindowId),
  );
  const futureByWindow = new Map(
    futureStats.map((row) => [
      row.trialWindowId,
      { maxBooked: row.maxBooked, hasBooking: Boolean(row.hasBooking) },
    ]),
  );
  const windowCountByOffering = new Map<string, number>();
  for (const window of windowRows) {
    windowCountByOffering.set(
      window.trialOfferingId,
      (windowCountByOffering.get(window.trialOfferingId) ?? 0) + 1,
    );
  }
  const offeringNameById = new Map(
    offeringRows.map((offering) => [offering.id, offering]),
  );

  const offerings: SettingsOffering[] = offeringRows.map((offering) => ({
    id: offering.id,
    name: offering.name,
    description: offering.description,
    minimumAge: offering.minimumAge,
    maximumAge: offering.maximumAge,
    attire: offering.attire,
    active: offering.active,
    windowCount: windowCountByOffering.get(offering.id) ?? 0,
  }));

  const windows: SettingsWindow[] = windowRows.map((window) => {
    const offering = offeringNameById.get(window.trialOfferingId);
    const future = futureByWindow.get(window.id);
    return {
      id: window.id,
      trialOfferingId: window.trialOfferingId,
      offeringName: offering?.name ?? "Unknown trial class",
      offeringActive: offering?.active ?? false,
      dayOfWeek: window.dayOfWeek,
      startMinute: window.startMinute,
      durationMinutes: window.durationMinutes,
      capacity: window.capacity,
      label: window.label,
      active: window.active,
      hasOccurrence: occurrenceIds.has(window.id),
      maxFutureBooked: future?.maxBooked ?? 0,
      hasFutureBooking: future?.hasBooking ?? false,
    };
  });

  const faqItems: SettingsFaq[] = faqRows
    .slice()
    .sort(
      (a, b) =>
        a.sortOrder - b.sortOrder ||
        a.createdAt.getTime() - b.createdAt.getTime(),
    )
    .map((faq) => ({
      id: faq.id,
      question: faq.question,
      answer: faq.answer,
    }));

  return {
    school: {
      name: school.name,
      slug: school.slug,
      timezone: school.timezone,
      notificationEmail: school.notificationEmail,
      phone: school.phone ?? "",
      website: school.website ?? "",
      address: school.address ?? "",
      city: school.city ?? "",
      country: school.country,
      parkingNotes: school.parkingNotes ?? "",
      accessNotes: school.accessNotes ?? "",
      trialGuidance: school.trialGuidance ?? "",
      pricing: school.pricing ?? "",
      welcomeMessage: school.welcomeMessage ?? "",
      agentInstructions: school.agentInstructions ?? "",
      logoUrl: school.logoUrl ?? "",
      primaryColor: school.primaryColor ?? "",
      published: school.publishedAt != null,
      location: formatLocation(school.address, school.city),
    },
    offerings,
    windows,
    faqs: faqItems,
    timezones: listTimezones(),
  };
});
