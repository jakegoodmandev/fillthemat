import { requireOwnedSchool } from "@/lib/auth/current-school";
import { listTimezones } from "@/lib/timezones";
import { formatTimezone } from "./format";
import { loadFaqs, loadOfferings, loadWindows } from "./queries";
import { resolveSection, type SectionId, sectionMeta } from "./sections";
import { AgentSection } from "./sections/agent-section";
import { BrandingSection } from "./sections/branding-section";
import { FaqsSection } from "./sections/faqs-section";
import { OfferingsSection } from "./sections/offerings-section";
import { PricingSection } from "./sections/pricing-section";
import { ProfileSection } from "./sections/profile-section";
import { ScheduleSection } from "./sections/schedule-section";
import { SettingsShell } from "./settings-shell";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string }>;
}) {
  const [{ school }, params] = await Promise.all([
    requireOwnedSchool(),
    searchParams,
  ]);
  const section: SectionId = resolveSection(params.section);
  const meta = sectionMeta(section);
  const location =
    [school.address, school.city].filter(Boolean).join(", ") || null;

  return (
    <main className="flex max-w-6xl flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          Settings
        </h1>
        <p className="max-w-prose text-sm leading-relaxed text-zinc-400 text-pretty">
          Teach your agent about your school and manage the trial-booking
          experience.
        </p>
      </header>

      <SettingsShell activeSection={section}>
        <section
          className="flex flex-col gap-6"
          aria-labelledby="section-title"
        >
          <div className="flex flex-col gap-2">
            <h2
              id="section-title"
              className="text-lg font-semibold text-zinc-100 text-balance"
            >
              {meta.title}
            </h2>
            <p className="max-w-prose text-sm leading-relaxed text-zinc-400 text-pretty">
              {meta.purpose}
            </p>
          </div>
          <SectionContent
            section={section}
            schoolId={school.id}
            school={school}
            location={location}
          />
        </section>
      </SettingsShell>
    </main>
  );
}

async function SectionContent({
  section,
  schoolId,
  school,
  location,
}: {
  section: SectionId;
  schoolId: string;
  school: Awaited<ReturnType<typeof requireOwnedSchool>>["school"];
  location: string | null;
}) {
  if (section === "profile") {
    const published = school.publishedAt != null;
    return (
      <ProfileSection
        published={published}
        timezones={published ? [] : listTimezones()}
        initialValues={{
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
        }}
      />
    );
  }

  if (section === "offerings") {
    const [offerings, windows] = await Promise.all([
      loadOfferings(schoolId),
      loadWindows(schoolId),
    ]);
    return (
      <OfferingsSection
        offerings={offerings.map((offering) => ({
          id: offering.id,
          name: offering.name,
          description: offering.description,
          minimumAge: offering.minimumAge,
          maximumAge: offering.maximumAge,
          attire: offering.attire,
          expectations: offering.expectations,
          active: offering.active,
          windowCount: windows.filter(
            (window) => window.trialOfferingId === offering.id,
          ).length,
          activeWindowCount: windows.filter(
            (window) => window.trialOfferingId === offering.id && window.active,
          ).length,
        }))}
      />
    );
  }

  if (section === "schedule") {
    const [offerings, windows] = await Promise.all([
      loadOfferings(schoolId),
      loadWindows(schoolId),
    ]);
    return (
      <ScheduleSection
        timezoneLabel={formatTimezone(school.timezone)}
        offerings={offerings.map((offering) => ({
          id: offering.id,
          name: offering.name,
          active: offering.active,
        }))}
        windows={windows.map((window) => ({
          id: window.id,
          offeringName: window.offeringName,
          offeringActive: window.offeringActive,
          dayOfWeek: window.dayOfWeek,
          startMinute: window.startMinute,
          durationMinutes: window.durationMinutes,
          capacity: window.capacity,
          label: window.label,
          active: window.active,
          onCalendar: window.onCalendar,
          hasUpcomingBooking: window.hasUpcomingBooking,
          maxUpcomingBooked: window.maxUpcomingBooked,
        }))}
      />
    );
  }

  if (section === "pricing") {
    return <PricingSection pricing={school.pricing ?? ""} />;
  }

  if (section === "faqs") {
    const faqRows = await loadFaqs(schoolId);
    return (
      <FaqsSection
        faqs={faqRows.map((faq) => ({
          id: faq.id,
          question: faq.question,
          answer: faq.answer,
        }))}
      />
    );
  }

  if (section === "agent") {
    return (
      <AgentSection
        welcomeMessage={school.welcomeMessage ?? ""}
        agentInstructions={school.agentInstructions ?? ""}
        schoolName={school.name}
        location={location}
        logoUrl={school.logoUrl}
        primaryColor={school.primaryColor}
      />
    );
  }

  return (
    <BrandingSection
      logoUrl={school.logoUrl ?? ""}
      primaryColor={school.primaryColor ?? ""}
      schoolName={school.name}
      location={location}
      welcomeMessage={school.welcomeMessage ?? ""}
    />
  );
}
