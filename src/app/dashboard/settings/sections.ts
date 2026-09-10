export const SECTION_IDS = [
  "profile",
  "offerings",
  "schedule",
  "pricing",
  "faqs",
  "agent",
  "branding",
] as const;

export type SectionId = (typeof SECTION_IDS)[number];

export type SectionMeta = {
  id: SectionId;
  /** Short label used in the settings navigation. */
  label: string;
  /** One line shown under the label in the navigation. */
  hint: string;
  /** Heading for the section itself. */
  title: string;
  /** Why the section exists, in owner language. */
  purpose: string;
};

export const SECTIONS: readonly SectionMeta[] = [
  {
    id: "profile",
    label: "School",
    hint: "Name, contact, arrival",
    title: "School details",
    purpose:
      "Your agent uses these facts to answer questions about who you are, where you are, and what to do on arrival.",
  },
  {
    id: "offerings",
    label: "Trial classes",
    hint: "What families can book",
    title: "Trial classes",
    purpose:
      "Your agent uses these to decide who is eligible for a trial and what to expect in class.",
  },
  {
    id: "schedule",
    label: "Schedule",
    hint: "Weekly class times",
    title: "Weekly schedule",
    purpose:
      "Your agent only offers times that come from this schedule. It never invents or holds a time.",
  },
  {
    id: "pricing",
    label: "Pricing",
    hint: "Prices you allow",
    title: "Pricing",
    purpose:
      "Add the prices and conditions your agent may share. It will not invent discounts.",
  },
  {
    id: "faqs",
    label: "FAQs",
    hint: "Common parent questions",
    title: "Frequently asked questions",
    purpose:
      "Your agent uses these answers when a parent asks something your other settings do not cover.",
  },
  {
    id: "agent",
    label: "Agent",
    hint: "Welcome and tone",
    title: "Your agent",
    purpose:
      "Set the first thing families see and the tone your agent uses. Some behavior is fixed for every school.",
  },
  {
    id: "branding",
    label: "Branding",
    hint: "Logo and color",
    title: "Branding",
    purpose:
      "Your logo and accent color appear on the public page families use to book a trial class.",
  },
] as const;

export const DEFAULT_SECTION: SectionId = "profile";

export function isSectionId(value: unknown): value is SectionId {
  return (
    typeof value === "string" &&
    (SECTION_IDS as readonly string[]).includes(value)
  );
}

/** Unknown or missing sections fall back to the first category. */
export function resolveSection(value: unknown): SectionId {
  return isSectionId(value) ? value : DEFAULT_SECTION;
}

export function sectionMeta(id: SectionId): SectionMeta {
  const found = SECTIONS.find((section) => section.id === id);
  if (!found) throw new Error(`Unknown settings section: ${id}`);
  return found;
}

/**
 * Settings categories are deep-linkable through the `section` query parameter,
 * e.g. `/dashboard/settings?section=schedule`.
 */
export function sectionHref(id: SectionId): string {
  return id === DEFAULT_SECTION
    ? "/dashboard/settings"
    : `/dashboard/settings?section=${id}`;
}
